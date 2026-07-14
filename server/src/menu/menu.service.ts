import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // Kârlılık & menü mühendisliği: ürün başına maliyet/marj + popülerlik sınıfı.
  async profitability(fromStr?: string, toStr?: string) {
    const now = new Date();
    const toBase = toStr ? new Date(toStr + 'T00:00:00') : now;
    const toEnd = new Date(
      toBase.getFullYear(),
      toBase.getMonth(),
      toBase.getDate() + 1,
    );
    const fromBase = fromStr
      ? new Date(fromStr + 'T00:00:00')
      : new Date(now.getTime() - 30 * 86400000);
    const fromStart = new Date(
      fromBase.getFullYear(),
      fromBase.getMonth(),
      fromBase.getDate(),
    );

    const products = await this.prisma.product.findMany({
      include: {
        recipeItems: { include: { stockItem: true } },
        category: true,
      },
      orderBy: { name: 'asc' },
    });
    const soldItems = await this.prisma.orderItem.findMany({
      where: {
        status: { not: 'IPTAL' },
        order: { status: 'KAPANDI', closedAt: { gte: fromStart, lt: toEnd } },
      },
      select: { productId: true, quantity: true, unitPrice: true },
    });
    const sold = new Map<string, { qty: number; revenue: number }>();
    for (const it of soldItems) {
      const c = sold.get(it.productId) ?? { qty: 0, revenue: 0 };
      c.qty += it.quantity;
      c.revenue += it.unitPrice * it.quantity;
      sold.set(it.productId, c);
    }

    const rows = products.map((p) => {
      const cost = round2(
        p.recipeItems.reduce(
          (s, r) => s + r.quantity * (r.stockItem?.cost ?? 0),
          0,
        ),
      );
      const price = p.price;
      const profit = round2(price - cost);
      const marginPct = price > 0 ? round1((profit / price) * 100) : 0;
      const foodCostPct = price > 0 ? round1((cost / price) * 100) : 0;
      const s = sold.get(p.id) ?? { qty: 0, revenue: 0 };
      return {
        id: p.id,
        name: p.name,
        category: p.category?.name ?? null,
        active: p.active,
        hasRecipe: p.recipeItems.length > 0,
        price,
        cost,
        profit,
        marginPct,
        foodCostPct,
        qty: s.qty,
        revenue: round2(s.revenue),
        klass: null as string | null,
      };
    });

    // Menü mühendisliği: satışı olan ürünler arasında popülerlik × kârlılık.
    const withSales = rows.filter((r) => r.qty > 0);
    const avgQty = withSales.length
      ? withSales.reduce((s, r) => s + r.qty, 0) / withSales.length
      : 0;
    const avgMargin = withSales.length
      ? withSales.reduce((s, r) => s + r.marginPct, 0) / withSales.length
      : 0;
    for (const r of rows) {
      if (r.qty <= 0) continue;
      const popular = r.qty >= avgQty;
      const profitable = r.marginPct >= avgMargin;
      r.klass =
        popular && profitable
          ? 'STAR'
          : !popular && profitable
            ? 'PUZZLE'
            : popular && !profitable
              ? 'PLOW'
              : 'DOG';
    }

    return {
      rows,
      avgQty: round1(avgQty),
      avgMargin: round1(avgMargin),
    };
  }

  // --- Kategoriler ---
  listCategories(includeInactive = false) {
    return this.prisma.category.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  createCategory(data: {
    name: string;
    sortOrder?: number;
    color?: string;
  }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(
    id: string,
    data: { name?: string; sortOrder?: number; color?: string; active?: boolean },
  ) {
    await this.getCategoryOrThrow(id);
    return this.prisma.category.update({ where: { id }, data });
  }

  async removeCategory(id: string) {
    await this.getCategoryOrThrow(id);
    return this.prisma.category.update({
      where: { id },
      data: { active: false },
    });
  }

  // --- Ürünler ---
  listProducts(includeInactive = false) {
    return this.prisma.product.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    });
  }

  createProduct(data: {
    name: string;
    price: number;
    categoryId: string;
    station?: string;
    sortOrder?: number;
    imageUrl?: string;
  }) {
    return this.prisma.product.create({ data });
  }

  async updateProduct(
    id: string,
    data: {
      name?: string;
      price?: number;
      categoryId?: string;
      station?: string;
      sortOrder?: number;
      active?: boolean;
      imageUrl?: string;
    },
  ) {
    await this.getProductOrThrow(id);
    return this.prisma.product.update({ where: { id }, data });
  }

  async removeProduct(id: string) {
    await this.getProductOrThrow(id);
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  private async getCategoryOrThrow(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kategori bulunamadı');
    return c;
  }

  private async getProductOrThrow(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Ürün bulunamadı');
    return p;
  }
}
