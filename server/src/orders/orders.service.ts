import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from './orders.gateway';
import { PrintService } from '../print/print.service';
import { StockService } from '../stock/stock.service';
import { AccountsService } from '../accounts/accounts.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import {
  GraphMemoryService,
  GraphEdge,
} from '../graph-memory/graph-memory.service';

interface Actor {
  userId?: string;
  userName?: string;
}

interface AddItemInput {
  productId: string;
  quantity?: number;
  note?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
    private readonly print: PrintService,
    private readonly stock: StockService,
    private readonly accounts: AccountsService,
    private readonly fiscal: FiscalService,
    private readonly audit: AuditService,
    private readonly crm: CrmService,
    private readonly graphMem: GraphMemoryService,
  ) {}

  // Masanın açık siparişini getirir; yoksa oluşturur ve masayı DOLU yapar.
  async openTableOrder(tableId: string, userId: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Masa bulunamadı');

    let order = await this.prisma.order.findFirst({
      where: { tableId, status: 'ACIK' },
    });
    if (!order) {
      order = await this.prisma.order.create({
        data: { tableId, type: 'MASA', openedById: userId },
      });
      await this.setTableStatus(tableId, 'DOLU');
    }
    return this.getOrder(order.id);
  }

  // Mutfak ekranı (KDS) kuyruğu: hazırlanmayı bekleyen/süren kalemler.
  // SERVIS ve IPTAL olanlar dışarıda. İstasyon bazında gruplamayı frontend yapar.
  async getKdsQueue() {
    const items = await this.prisma.orderItem.findMany({
      where: {
        status: { in: ['YENI', 'HAZIRLANIYOR', 'HAZIR'] },
        order: { status: 'ACIK' },
      },
      orderBy: { createdAt: 'asc' },
      include: { order: { include: { table: true } } },
    });
    return items.map((it) => ({
      id: it.id,
      nameSnapshot: it.nameSnapshot,
      quantity: it.quantity,
      note: it.note,
      station: it.station,
      status: it.status,
      createdAt: it.createdAt,
      startedAt: it.startedAt,
      prepSeconds: it.prepSeconds,
      orderId: it.orderId,
      tableName: it.order.table?.name ?? null,
      orderType: it.order.type,
    }));
  }

  async getActiveOrders() {
    const orders = await this.prisma.order.findMany({
      where: { status: 'ACIK' },
      include: { items: true, table: true, payments: true },
    });
    return orders.map((o) => this.computeTotals(o));
  }

  async getTableActiveOrder(tableId: string) {
    const order = await this.prisma.order.findFirst({
      where: { tableId, status: 'ACIK' },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        table: true,
        payments: true,
      },
    });
    return order ? this.computeTotals(order) : null;
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        table: true,
        payments: { orderBy: { createdAt: 'asc' } },
        customer: true,
      },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    return this.computeTotals(order);
  }

  // Siparişe kalem(ler) ekler. Ürün adı ve fiyatı sipariş anında sabitlenir.
  async addItems(orderId: string, items: AddItemInput[], userId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status !== 'ACIK')
      throw new BadRequestException('Sipariş açık değil');
    if (!items?.length) throw new BadRequestException('Kalem yok');

    const newItemIds: string[] = [];
    for (const it of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: it.productId },
      });
      if (!product)
        throw new BadRequestException(`Ürün bulunamadı: ${it.productId}`);
      const created = await this.prisma.orderItem.create({
        data: {
          orderId,
          productId: product.id,
          nameSnapshot: product.name,
          unitPrice: product.price,
          quantity: it.quantity && it.quantity > 0 ? it.quantity : 1,
          note: it.note,
          station: product.station,
          status: 'YENI',
          addedById: userId ?? null,
        },
      });
      newItemIds.push(created.id);
    }

    const updated = await this.getOrder(orderId);
    this.gateway.emitOrderUpdate(updated);
    this.gateway.emitKdsUpdate(); // mutfağa yeni sipariş

    // Mutfak fişini otomatik bas (yalnız yeni gönderilen kalemler). Yazıcı yoksa
    // önizleme loglanır; hata olsa bile sipariş akışını bloklamaz.
    this.print
      .printKitchenForOrder(orderId, newItemIds)
      .catch(() => undefined);

    // Reçete bazlı otomatik stok düşümü. Siparişi bloklamaz (mutfak beklemesin),
    // ama hatayı YUTMAZ: eskiden .catch(() => undefined) idi ve düşüm sessizce
    // başarısız olduğunda kimse fark etmiyordu — "stok düşmüyor" şikâyetinin
    // izini sürmek imkânsızdı.
    this.stock
      .deductForOrder(
        items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity && it.quantity > 0 ? it.quantity : 1,
        })),
        orderId,
      )
      .catch((err) =>
        this.logger.error(
          `Stok düşümü başarısız (sipariş ${orderId}): ${err?.message ?? err}`,
          err?.stack,
        ),
      );

    return updated;
  }

  async updateItem(
    itemId: string,
    data: { quantity?: number; note?: string; status?: string },
    actor?: Actor,
  ) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: { include: { table: true } } },
    });
    if (!item) throw new NotFoundException('Sipariş kalemi bulunamadı');

    // Denetim: kalem iptali kaydı.
    if (data.status === 'IPTAL' && item.status !== 'IPTAL') {
      this.audit
        .log({
          action: 'IPTAL_KALEM',
          userId: actor?.userId,
          userName: actor?.userName,
          tableName: item.order?.table?.name ?? null,
          orderId: item.orderId,
          amount: item.unitPrice * item.quantity,
          detail: `${item.quantity}x ${item.nameSnapshot}`,
        })
        .catch(() => undefined);
    }

    // Durum geçişlerinde mutfak zaman damgalarını kaydet + hazırlık süresini hesapla.
    const now = new Date();
    const patch: any = {
      quantity: data.quantity,
      note: data.note,
      status: data.status,
    };
    if (data.status === 'HAZIRLANIYOR' && !item.startedAt) {
      patch.startedAt = now;
    }
    if (data.status === 'HAZIR') {
      patch.readyAt = now;
      const start = item.startedAt ?? now;
      patch.prepSeconds = Math.max(
        0,
        Math.round((now.getTime() - new Date(start).getTime()) / 1000),
      );
    }
    if (data.status === 'SERVIS') {
      patch.servedAt = now;
      if (!item.readyAt) patch.readyAt = now;
      if (item.startedAt && item.prepSeconds == null) {
        patch.prepSeconds = Math.max(
          0,
          Math.round((now.getTime() - new Date(item.startedAt).getTime()) / 1000),
        );
      }
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: patch,
    });

    const order = await this.getOrder(item.orderId);
    this.gateway.emitOrderUpdate(order);
    this.gateway.emitKdsUpdate();
    return updated;
  }

  async cancelOrder(id: string, actor?: Actor) {
    const order = await this.getOrder(id).catch(() => null);
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    await this.prisma.order.update({
      where: { id },
      data: { status: 'IPTAL', closedAt: new Date() },
    });
    if (order.tableId) await this.refreshTableStatus(order.tableId);
    this.gateway.emitKdsUpdate();

    // Denetim: adisyon iptali (dolu adisyon iptali kayba işaret olabilir).
    this.audit
      .log({
        action: 'IPTAL_ADISYON',
        userId: actor?.userId,
        userName: actor?.userName,
        tableName: order.table?.name ?? null,
        orderId: id,
        amount: order.netTotal ?? order.total ?? 0,
        detail: `${order.items?.filter((i: any) => i.status !== 'IPTAL').length ?? 0} kalem`,
      })
      .catch(() => undefined);

    return { ok: true };
  }

  // Siparişi başka bir masaya taşı.
  async moveOrder(orderId: string, targetTableId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status !== 'ACIK')
      throw new BadRequestException('Sipariş açık değil');

    const target = await this.prisma.restaurantTable.findUnique({
      where: { id: targetTableId },
    });
    if (!target) throw new NotFoundException('Hedef masa bulunamadı');

    const existing = await this.prisma.order.findFirst({
      where: { tableId: targetTableId, status: 'ACIK' },
    });
    if (existing)
      throw new BadRequestException(
        'Hedef masada zaten açık adisyon var (birleştirmeyi kullanın)',
      );

    const oldTableId = order.tableId;
    await this.prisma.order.update({
      where: { id: orderId },
      data: { tableId: targetTableId },
    });
    if (oldTableId) await this.refreshTableStatus(oldTableId);
    await this.setTableStatus(targetTableId, 'DOLU');
    return this.getOrder(orderId);
  }

  // Bir masanın adisyonunu başka masanın adisyonuyla birleştir (kalemleri taşı).
  async mergeOrder(sourceOrderId: string, targetTableId: string) {
    const source = await this.prisma.order.findUnique({
      where: { id: sourceOrderId },
    });
    if (!source) throw new NotFoundException('Kaynak sipariş bulunamadı');
    if (source.status !== 'ACIK')
      throw new BadRequestException('Kaynak sipariş açık değil');

    let target = await this.prisma.order.findFirst({
      where: { tableId: targetTableId, status: 'ACIK' },
    });
    if (!target) {
      // Hedefte açık adisyon yoksa taşımaya dönüşür.
      return this.moveOrder(sourceOrderId, targetTableId);
    }
    if (target.id === sourceOrderId)
      throw new BadRequestException('Aynı adisyon');

    // Masa adlarını al (köken işareti + birleşik etiket için).
    const [sourceTable, targetTable] = await Promise.all([
      source.tableId
        ? this.prisma.restaurantTable.findUnique({ where: { id: source.tableId } })
        : null,
      this.prisma.restaurantTable.findUnique({ where: { id: targetTableId } }),
    ]);
    const sourceName = sourceTable?.name ?? 'Paket';
    const targetName = targetTable?.name ?? 'Hedef';

    // Köken etiketlerini işaretle (önceden işaretli değilse).
    await this.prisma.orderItem.updateMany({
      where: { orderId: target.id, originLabel: null },
      data: { originLabel: targetName },
    });
    await this.prisma.orderItem.updateMany({
      where: { orderId: sourceOrderId, originLabel: null },
      data: { originLabel: sourceName },
    });

    // Kalemleri hedefe taşı.
    await this.prisma.orderItem.updateMany({
      where: { orderId: sourceOrderId },
      data: { orderId: target.id },
    });

    // Birleşik etiketi hesapla ("1 + 2"), önceki birleşimleri de koruyarak.
    const names = new Set<string>();
    (target.mergedLabel ? target.mergedLabel.split(' + ') : [targetName]).forEach(
      (n) => n && names.add(n),
    );
    (source.mergedLabel ? source.mergedLabel.split(' + ') : [sourceName]).forEach(
      (n) => n && names.add(n),
    );
    const mergedLabel = [...names].join(' + ');

    await this.prisma.order.update({
      where: { id: target.id },
      data: { mergedLabel },
    });
    await this.prisma.order.update({
      where: { id: sourceOrderId },
      data: { status: 'IPTAL', closedAt: new Date() },
    });
    if (source.tableId) await this.refreshTableStatus(source.tableId);

    const merged = await this.getOrder(target.id);
    this.gateway.emitOrderUpdate(merged);
    return merged;
  }

  // --- Ödeme & iskonto (M4) ---

  async setDiscount(
    orderId: string,
    data: { type: string | null; value?: number; reason?: string },
    actor?: Actor,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status !== 'ACIK')
      throw new BadRequestException('Sipariş açık değil');
    if (data.type && !['YUZDE', 'TUTAR'].includes(data.type))
      throw new BadRequestException('Geçersiz iskonto türü');

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        discountType: data.type,
        discountValue: data.type ? data.value ?? 0 : 0,
        discountReason: data.type ? data.reason : null,
      },
    });
    const updated = await this.getOrder(orderId);
    this.gateway.emitOrderUpdate(updated);

    // Denetim: iskonto/ikram uygulandıysa kaydet.
    if (data.type && updated.discountAmount > 0) {
      const isIkram = (data.reason || '').toLowerCase().includes('ikram');
      this.audit
        .log({
          action: isIkram ? 'IKRAM' : 'ISKONTO',
          userId: actor?.userId,
          userName: actor?.userName,
          tableName: updated.table?.name ?? null,
          orderId,
          amount: updated.discountAmount,
          detail: data.reason || undefined,
        })
        .catch(() => undefined);
    }
    return updated;
  }

  async addPayment(
    orderId: string,
    method: string,
    amount: number,
    userId: string,
    accountId?: string,
  ) {
    const valid = ['NAKIT', 'KREDI_KARTI', 'YEMEK_KARTI', 'ACIK_HESAP', 'PUAN'];
    if (!valid.includes(method))
      throw new BadRequestException('Geçersiz ödeme yöntemi');
    if (!(amount > 0)) throw new BadRequestException('Tutar 0’dan büyük olmalı');
    if (method === 'ACIK_HESAP' && !accountId)
      throw new BadRequestException('Açık hesap için cari hesap seçilmeli');

    const order = await this.getOrder(orderId);
    if (order.status !== 'ACIK')
      throw new BadRequestException('Sipariş zaten kapalı');

    await this.prisma.payment.create({
      data: { orderId, method, amount, createdById: userId },
    });

    // Açık hesap: cariye borç yaz.
    if (method === 'ACIK_HESAP' && accountId) {
      await this.accounts.addTransaction(
        accountId,
        {
          type: 'BORC',
          amount,
          description: order.table
            ? `Adisyon (Masa ${order.table.name})`
            : 'Adisyon',
          orderId,
        },
        userId,
      );
    }

    const updated = await this.getOrder(orderId);
    // Tam ödendiyse adisyonu kapat.
    if (updated.itemsTotal > 0 && updated.remaining <= 0.001) {
      return this.closeOrder(orderId);
    }
    this.gateway.emitOrderUpdate(updated);
    return updated;
  }

  // Adisyona bahşiş kaydet (adisyon tutarından ayrı ekstra para). Açık ya da
  // kapalı adisyonda güncellenebilir (bahşiş ödeme anında/sonrasında girilebilir).
  async setTip(orderId: string, tip: number) {
    if (tip < 0) throw new BadRequestException('Bahşiş 0’dan küçük olamaz');
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { tip: round2(tip) },
    });
    const updated = await this.getOrder(orderId);
    this.gateway.emitOrderUpdate(updated);
    return updated;
  }

  // Adisyona müşteri bağla/çöz (CRM). null → bağı kaldır.
  async setCustomer(orderId: string, customerId: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { customerId },
    });
    const updated = await this.getOrder(orderId);
    this.gateway.emitOrderUpdate(updated);
    return updated;
  }

  // Sadakat puanıyla ödeme (1 puan = 1₺). Adisyona bağlı müşteriden puan düşer,
  // PUAN yöntemiyle ödeme oluşturur (tam ödendiyse kapanış tetiklenir).
  async redeemPoints(orderId: string, points: number, userId: string) {
    const order = await this.getOrder(orderId);
    if (order.status !== 'ACIK')
      throw new BadRequestException('Sipariş zaten kapalı');
    if (!order.customerId)
      throw new BadRequestException('Önce adisyona müşteri bağlayın');
    if (!(points > 0)) throw new BadRequestException('Geçersiz puan');
    // Kalan tutardan fazla puan kullanılmasın.
    const usable = Math.min(points, Math.floor(order.remaining));
    if (usable <= 0)
      throw new BadRequestException('Kullanılabilir tutar yok');
    await this.crm.deductPoints(order.customerId, usable);
    return this.addPayment(orderId, 'PUAN', usable, userId);
  }

  async closeOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'KAPANDI', closedAt: new Date() },
    });
    if (order.tableId) await this.refreshTableStatus(order.tableId);

    // CRM: müşteri bağlıysa ziyaret + sadakat puanı işle (best-effort).
    if (order.customerId) {
      const { netTotal } = this.computeTotals(order);
      this.crm.recordVisit(order.customerId, netTotal).catch(() => undefined);
    }

    // Oto-hafıza: kapanan adisyondan ilişki kenarlarını öğren (sipariş-ürün-müşteri).
    // TİP düzeyinde, ağırlıklı; ana akışı bloklamaz (observe kendi içinde no-op/güvenli).
    const edges: GraphEdge[] = [];
    for (const it of order.items) {
      if (it.status === 'IPTAL') continue;
      edges.push({ from: it.nameSnapshot, rel: 'soldIn', to: 'Order' });
      if (order.customerId)
        edges.push({ from: 'Customer', rel: 'ordered', to: it.nameSnapshot });
    }
    if (order.customerId)
      edges.push({ from: 'Order', rel: 'placedBy', to: 'Customer' });
    this.graphMem.observe(edges);

    // Kapanışta mali fiş kes (ÖKC). Simülasyonda hep başarılı; gerçek cihazda
    // GMP3 ile kesilir. Best-effort — sipariş kapanışını bloklamaz.
    this.fiscal.issueForOrder(orderId).catch(() => undefined);

    const closed = await this.getOrder(orderId);
    this.gateway.emitOrderUpdate(closed);
    return closed;
  }

  // --- yardımcılar ---

  private computeTotals(order: any) {
    const itemsTotal = order.items
      .filter((i: any) => i.status !== 'IPTAL')
      .reduce((sum: number, i: any) => sum + i.unitPrice * i.quantity, 0);

    let discountAmount = 0;
    if (order.discountType === 'YUZDE')
      discountAmount = (itemsTotal * (order.discountValue || 0)) / 100;
    else if (order.discountType === 'TUTAR')
      discountAmount = order.discountValue || 0;
    discountAmount = Math.min(discountAmount, itemsTotal);

    const netTotal = round2(itemsTotal - discountAmount);
    const paidTotal = round2(
      (order.payments || []).reduce((s: number, p: any) => s + p.amount, 0),
    );
    const remaining = round2(netTotal - paidTotal);

    return {
      ...order,
      total: itemsTotal, // geriye dönük uyum (adisyon "gönderilen" toplamı)
      itemsTotal,
      discountAmount: round2(discountAmount),
      netTotal,
      paidTotal,
      remaining,
    };
  }

  private async setTableStatus(tableId: string, status: string) {
    const table = await this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status },
    });
    this.gateway.emitTableUpdate(table);
  }

  // Masada açık adisyon kaldı mı? Yoksa BOS yap.
  private async refreshTableStatus(tableId: string) {
    const openCount = await this.prisma.order.count({
      where: { tableId, status: 'ACIK' },
    });
    await this.setTableStatus(tableId, openCount > 0 ? 'DOLU' : 'BOS');
  }
}
