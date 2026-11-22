import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GraphMemoryService } from '../graph-memory/graph-memory.service';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphMem: GraphMemoryService,
  ) {}

  // --- Stok kalemleri ---
  async listItems(includeInactive = false) {
    const items = await this.prisma.stockItem.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
    return items.map((i) => ({ ...i, isLow: i.quantity <= i.criticalLevel }));
  }

  createItem(data: {
    name: string;
    unit?: string;
    group?: string | null;
    quantity?: number;
    criticalLevel?: number;
    perishable?: boolean;
  }) {
    return this.prisma.stockItem.create({ data });
  }

  async updateItem(
    id: string,
    data: {
      name?: string;
      unit?: string;
      group?: string | null;
      criticalLevel?: number;
      active?: boolean;
      perishable?: boolean;
    },
  ) {
    await this.getItemOrThrow(id);
    return this.prisma.stockItem.update({ where: { id }, data });
  }

  async removeItem(id: string) {
    await this.getItemOrThrow(id);
    return this.prisma.stockItem.update({
      where: { id },
      data: { active: false },
    });
  }

  async alerts() {
    const items = await this.prisma.stockItem.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return items.filter((i) => i.quantity <= i.criticalLevel);
  }

  // --- Stok hareketi (manuel: GIRIS/FIRE/SAYIM) ---
  async addMovement(
    itemId: string,
    input: { type: string; quantity: number; note?: string },
    userId?: string,
  ) {
    const item = await this.getItemOrThrow(itemId);
    const { type } = input;
    const qty = Math.abs(input.quantity);
    let delta = 0;
    if (type === 'GIRIS') delta = qty;
    else if (type === 'FIRE') delta = -qty;
    else if (type === 'SAYIM')
      delta = round3(input.quantity - item.quantity); // sayımda gelen = yeni mutlak miktar
    else throw new BadRequestException('Geçersiz hareket türü (GIRIS/FIRE/SAYIM)');

    return this.applyDelta(itemId, delta, type, input.note, undefined, userId);
  }

  async movements(itemId: string) {
    await this.getItemOrThrow(itemId);
    return this.prisma.stockMovement.findMany({
      where: { stockItemId: itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // --- Reçete ---
  async getRecipe(productId: string) {
    return this.prisma.recipeItem.findMany({
      where: { productId },
      include: { stockItem: true },
    });
  }

  // Ürünün reçetesini tamamen değiştirir.
  async setRecipe(
    productId: string,
    items: { stockItemId: string; quantity: number }[],
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');

    await this.prisma.recipeItem.deleteMany({ where: { productId } });
    for (const it of items) {
      if (!(it.quantity > 0)) continue;
      await this.prisma.recipeItem.create({
        data: {
          productId,
          stockItemId: it.stockItemId,
          quantity: it.quantity,
        },
      });
    }
    return this.getRecipe(productId);
  }

  // Alış faturasından stok girişi: miktarı ekler, son birim maliyeti günceller,
  // GIRIS hareketi kaydeder. PurchasesService çağırır. Kalem perishable ise (veya
  // SKT/menşei verilmişse) ayrıca bir parti (StockLot) oluşturur ve GIRIS hareketini
  // partiye bağlar — izlenebilirlik + FIFO tüketim için.
  async receiveStock(
    itemId: string,
    quantity: number,
    unitCost?: number,
    note?: string,
    lot?: {
      origin?: string | null;
      expiryDate?: Date | string | null;
      supplierId?: string | null;
      supplierName?: string | null;
      purchaseItemId?: string | null;
    },
  ) {
    const item = await this.prisma.stockItem.update({
      where: { id: itemId },
      data: {
        quantity: { increment: quantity },
        ...(unitCost != null ? { cost: unitCost } : {}),
      },
    });

    const expiry = lot?.expiryDate ? new Date(lot.expiryDate) : null;
    const shouldTrack = item.perishable || !!expiry || !!lot?.origin;

    let lotId: string | undefined;
    if (shouldTrack) {
      const created = await this.prisma.stockLot.create({
        data: {
          stockItemId: itemId,
          purchaseItemId: lot?.purchaseItemId ?? null,
          supplierId: lot?.supplierId ?? null,
          supplierName: lot?.supplierName ?? null,
          origin: lot?.origin ?? null,
          expiryDate: expiry,
          initialQty: quantity,
          remainingQty: quantity,
          unitCost: unitCost ?? null,
          note: note ?? 'Alış',
        },
      });
      lotId = created.id;
    }

    await this.prisma.stockMovement.create({
      data: {
        stockItemId: itemId,
        type: 'GIRIS',
        quantity,
        note: note ?? 'Alış',
        lotId,
      },
    });
    return item;
  }

  // --- Otomatik düşüm (sipariş gönderilince OrdersService çağırır) ---
  // items: [{ productId, quantity }]
  async deductForOrder(
    items: { productId: string; quantity: number }[],
    orderId: string,
  ) {
    const edges: { from: string; rel: string; to: string }[] = [];
    for (const it of items) {
      const recipe = await this.prisma.recipeItem.findMany({
        where: { productId: it.productId },
        include: { stockItem: true, product: true },
      });
      for (const r of recipe) {
        const qty = round3(r.quantity * it.quantity);
        await this.consume(r.stockItemId, qty, orderId, r.stockItem?.perishable);
        // Oto-hafıza: "hangi ürün hangi stoğu eritti" bağını öğren (ağırlıklı).
        if (r.product?.name && r.stockItem?.name)
          edges.push({
            from: r.product.name,
            rel: 'consumes',
            to: r.stockItem.name,
          });
      }
    }
    this.graphMem.observe(edges);
  }

  // Belirli miktarı stoktan düşer. Perishable kalemlerde FIFO: son kullanma
  // tarihi en yakın partiden başlar; her parti için ayrı CIKIS hareketi yazar
  // ve remainingQty'yi azaltır (izlenebilirlik). Değilse tek hareketle düşer.
  private async consume(
    itemId: string,
    qty: number,
    orderId?: string,
    perishable?: boolean,
  ) {
    if (!perishable) {
      await this.applyDelta(itemId, -qty, 'CIKIS', undefined, orderId);
      return;
    }
    let remaining = qty;
    const lots = await this.prisma.stockLot.findMany({
      where: { stockItemId: itemId, active: true, remainingQty: { gt: 0 } },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
    });
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.remainingQty, remaining);
      await this.prisma.stockLot.update({
        where: { id: lot.id },
        data: { remainingQty: round3(lot.remainingQty - take) },
      });
      await this.applyDelta(itemId, -take, 'CIKIS', undefined, orderId, undefined, lot.id);
      remaining = round3(remaining - take);
    }
    // Parti yetmediyse kalanı partisiz düş (miktar tutarlılığı korunur).
    if (remaining > 0) {
      await this.applyDelta(itemId, -remaining, 'CIKIS', undefined, orderId);
    }
  }

  // --- yardımcılar ---
  private async applyDelta(
    itemId: string,
    delta: number,
    type: string,
    note?: string,
    orderId?: string,
    userId?: string,
    lotId?: string,
  ) {
    const item = await this.prisma.stockItem.update({
      where: { id: itemId },
      data: { quantity: { increment: delta } },
    });
    await this.prisma.stockMovement.create({
      data: {
        stockItemId: itemId,
        type,
        quantity: delta,
        note,
        orderId,
        createdById: userId,
        lotId,
      },
    });
    return { ...item, isLow: item.quantity <= item.criticalLevel };
  }

  private async getItemOrThrow(id: string) {
    const i = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Stok kalemi bulunamadı');
    return i;
  }

  // --- İzlenebilirlik / SKT (Faz 2A) -----------------------------------------

  // Aktif partiler (kalanı olan). Opsiyonel stok kalemine göre filtre.
  async listLots(stockItemId?: string) {
    const lots = await this.prisma.stockLot.findMany({
      where: {
        active: true,
        remainingQty: { gt: 0 },
        ...(stockItemId ? { stockItemId } : {}),
      },
      include: { stockItem: { select: { name: true, unit: true } } },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
    });
    return lots.map((l) => ({
      id: l.id,
      stockItemId: l.stockItemId,
      stockItemName: l.stockItem.name,
      unit: l.stockItem.unit,
      origin: l.origin,
      supplierName: l.supplierName,
      receivedAt: l.receivedAt,
      expiryDate: l.expiryDate,
      initialQty: l.initialQty,
      remainingQty: l.remainingQty,
      daysLeft: l.expiryDate ? daysUntil(l.expiryDate) : null,
    }));
  }

  // SKT'ye kalan günü ≤ days olan (veya geçmiş) partiler. Bildirim ve tavsiye
  // motoruna beslenir.
  async expiringLots(days = 7) {
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    const lots = await this.prisma.stockLot.findMany({
      where: {
        active: true,
        remainingQty: { gt: 0 },
        expiryDate: { not: null, lte: limit },
      },
      include: { stockItem: { select: { name: true, unit: true } } },
      orderBy: { expiryDate: 'asc' },
    });
    return lots.map((l) => ({
      id: l.id,
      stockItemId: l.stockItemId,
      stockItemName: l.stockItem.name,
      unit: l.stockItem.unit,
      remainingQty: l.remainingQty,
      expiryDate: l.expiryDate,
      daysLeft: l.expiryDate ? daysUntil(l.expiryDate) : null,
    }));
  }

  // İzlenebilirlik raporu: partiler + o partiden yapılan tüketim hareketleri
  // (hangi siparişlerde kullanıldığı). from/to giriş tarihine göre filtreler.
  async traceability(filter: { stockItemId?: string; from?: string; to?: string }) {
    const where: any = {};
    if (filter.stockItemId) where.stockItemId = filter.stockItemId;
    if (filter.from || filter.to) {
      where.receivedAt = {};
      if (filter.from) where.receivedAt.gte = new Date(filter.from + 'T00:00:00');
      if (filter.to) {
        const t = new Date(filter.to + 'T00:00:00');
        t.setDate(t.getDate() + 1);
        where.receivedAt.lt = t;
      }
    }
    const lots = await this.prisma.stockLot.findMany({
      where,
      include: {
        stockItem: { select: { name: true, unit: true } },
        movements: {
          where: { type: 'CIKIS' },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ receivedAt: 'desc' }],
      take: 500,
    });
    return lots.map((l) => ({
      id: l.id,
      stockItemName: l.stockItem.name,
      unit: l.stockItem.unit,
      origin: l.origin,
      supplierName: l.supplierName,
      receivedAt: l.receivedAt,
      expiryDate: l.expiryDate,
      initialQty: l.initialQty,
      remainingQty: l.remainingQty,
      consumed: round3(l.initialQty - l.remainingQty),
      usedIn: l.movements.map((m) => ({
        at: m.createdAt,
        quantity: Math.abs(m.quantity),
        orderId: m.orderId,
      })),
    }));
  }
}

// SKT'ye kalan gün sayısı (bugünden). Negatif = geçmiş.
function daysUntil(d: Date): number {
  const now = new Date();
  const ms = new Date(d).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
