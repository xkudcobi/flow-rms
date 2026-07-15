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
  // GIRIS hareketi kaydeder. PurchasesService çağırır.
  async receiveStock(
    itemId: string,
    quantity: number,
    unitCost?: number,
    note?: string,
  ) {
    const item = await this.prisma.stockItem.update({
      where: { id: itemId },
      data: {
        quantity: { increment: quantity },
        ...(unitCost != null ? { cost: unitCost } : {}),
      },
    });
    await this.prisma.stockMovement.create({
      data: {
        stockItemId: itemId,
        type: 'GIRIS',
        quantity,
        note: note ?? 'Alış',
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
        const delta = round3(-r.quantity * it.quantity);
        await this.applyDelta(
          r.stockItemId,
          delta,
          'CIKIS',
          undefined,
          orderId,
        );
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

  // --- yardımcılar ---
  private async applyDelta(
    itemId: string,
    delta: number,
    type: string,
    note?: string,
    orderId?: string,
    userId?: string,
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
      },
    });
    return { ...item, isLow: item.quantity <= item.criticalLevel };
  }

  private async getItemOrThrow(id: string) {
    const i = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Stok kalemi bulunamadı');
    return i;
  }
}
