import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { GraphMemoryService } from '../graph-memory/graph-memory.service';
import { SettingsService } from '../settings/settings.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

// QR self-servis: auth YOK; erişim masaya özel qrToken ile doğrulanır.
@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly gateway: OrdersGateway,
    private readonly graphMem: GraphMemoryService,
    private readonly settings: SettingsService,
  ) {}

  private async tableByToken(token: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { qrToken: token },
      include: { floor: true },
    });
    if (!table) throw new NotFoundException('Geçersiz QR / masa bulunamadı');
    return table;
  }

  async menu() {
    const [categories, products] = await Promise.all([
      this.prisma.category.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return { categories, products };
  }

  async tableInfo(token: string) {
    const table = await this.tableByToken(token);
    const [order, settings] = await Promise.all([
      this.orders.getTableActiveOrder(table.id),
      this.settings.get(),
    ]);
    return {
      table: { id: table.id, name: table.name, floor: table.floor?.name },
      // Müşteri "hesabım" ekranında satır tutarlarını da görebilsin diye
      // birim fiyat ve satır toplamı da dönüyor (eskiden yalnız ad+adet vardı,
      // müşteri ne ödeyeceğini göremiyordu).
      order: order
        ? {
            total: order.total,
            discount: order.discount ?? 0,
            openedAt: order.createdAt,
            items: order.items
              .filter((i: any) => i.status !== 'IPTAL')
              .map((i: any) => ({
                nameSnapshot: i.nameSnapshot,
                quantity: i.quantity,
                status: i.status,
                unitPrice: i.unitPrice,
                lineTotal: round2(i.unitPrice * i.quantity),
              })),
          }
        : null,
      // QR'dan sipariş açık mı — ekran sepet/sipariş butonlarını buna göre gizler.
      // Asıl kural sunucuda order() içinde; bu yalnız görünüm içindir.
      orderingEnabled: settings.qrOrderingEnabled,
    };
  }

  // Müşteri sepetini masanın adisyonuna ekle → KDS'e düşer.
  async order(
    token: string,
    items: { productId: string; quantity?: number; note?: string }[],
  ) {
    if (!items?.length) throw new BadRequestException('Sepet boş');
    // Ayar kapalıyken sipariş kabul edilmez. Ekranda butonu gizlemek yeterli
    // değil — bu uç kimlik doğrulaması olmayan açık bir uç, doğrudan istek
    // atılabilir. Kural burada uygulanır.
    const settings = await this.settings.get();
    if (!settings.qrOrderingEnabled) {
      throw new BadRequestException(
        'QR üzerinden sipariş kapalı. Lütfen garson çağırın.',
      );
    }
    const table = await this.tableByToken(token);
    const opened = await this.orders.openTableOrder(table.id, 'qr');
    await this.orders.addItems(opened.id, items, 'qr');
    return { ok: true };
  }

  async call(token: string, type: string) {
    const t = type === 'HESAP' ? 'HESAP' : 'GARSON';
    const table = await this.tableByToken(token);
    const call = await this.prisma.waiterCall.create({
      data: { tableId: table.id, type: t },
    });
    this.gateway.emitWaiterCall({
      id: call.id,
      tableId: table.id,
      tableName: table.name,
      type: t,
      createdAt: call.createdAt,
    });
    return { ok: true };
  }

  async feedback(token: string, rating: number, comment?: string) {
    const r = Math.max(1, Math.min(5, Math.round(rating)));
    const table = await this.tableByToken(token).catch(() => null);
    await this.prisma.feedback.create({
      data: { tableId: table?.id ?? null, rating: r, comment },
    });

    // Oto-hafıza: yorum ile masa ve memnuniyet düzeyi arasındaki bağı öğren.
    this.graphMem.observe([
      { from: 'Review', rel: 'rated', to: `${r}-star` },
      ...(table ? [{ from: 'Review', rel: 'aboutTable', to: 'Table' }] : []),
    ]);
    return { ok: true };
  }
}
