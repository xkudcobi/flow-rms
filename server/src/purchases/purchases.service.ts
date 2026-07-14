import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AccountsService } from '../accounts/accounts.service';
import { CashService } from '../cash/cash.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface PurchaseItemInput {
  stockItemId?: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate?: number;
}
interface PurchaseInput {
  supplierId?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  category?: string;
  note?: string;
  paymentStatus?: string; // PESIN | ACIK
  paymentMethod?: string;
  items: PurchaseItemInput[];
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly accounts: AccountsService,
    private readonly cash: CashService,
  ) {}

  async create(input: PurchaseInput, userId?: string) {
    if (!input.items?.length)
      throw new BadRequestException('En az bir kalem girin');

    // Satır ve genel toplamları hesapla (KDV dahil).
    const computed = input.items.map((it) => {
      const qty = it.quantity;
      const net = round2(qty * it.unitPrice);
      const vat = round2(net * (it.vatRate || 0) / 100);
      return {
        stockItemId: it.stockItemId || null,
        name: it.name,
        quantity: qty,
        unit: it.unit || 'adet',
        unitPrice: it.unitPrice,
        vatRate: it.vatRate || 0,
        lineNet: net,
        lineVat: vat,
        lineTotal: round2(net + vat),
      };
    });
    const subtotal = round2(computed.reduce((s, i) => s + i.lineNet, 0));
    const vatTotal = round2(computed.reduce((s, i) => s + i.lineVat, 0));
    const grandTotal = round2(subtotal + vatTotal);

    const purchase = await this.prisma.purchase.create({
      data: {
        supplierId: input.supplierId || null,
        invoiceNo: input.invoiceNo,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
        category: input.category,
        note: input.note,
        subtotal,
        vatTotal,
        grandTotal,
        paymentStatus: input.paymentStatus === 'ACIK' ? 'ACIK' : 'PESIN',
        paymentMethod: input.paymentMethod,
        createdById: userId,
        items: { create: computed },
      },
      include: { items: true, supplier: true },
    });

    // Stoğa bağlı kalemleri stoğa gir + maliyet güncelle.
    for (const it of computed) {
      if (it.stockItemId) {
        await this.stock
          .receiveStock(
            it.stockItemId,
            it.quantity,
            it.unitPrice,
            `Alış${input.invoiceNo ? ' #' + input.invoiceNo : ''}`,
          )
          .catch(() => undefined);
      }
    }

    // Veresiye (açık) alış → tedarikçi cariye borç (ALIS, bakiye azalır = biz borçlu).
    if (purchase.paymentStatus === 'ACIK' && purchase.supplierId) {
      await this.accounts
        .addTransaction(
          purchase.supplierId,
          {
            type: 'ALIS',
            amount: grandTotal,
            description: `Alış faturası${input.invoiceNo ? ' #' + input.invoiceNo : ''}`,
          },
          userId,
        )
        .catch(() => undefined);
    }

    // Peşin + NAKIT alış → kasadan çıkış (nakit takibi).
    if (purchase.paymentStatus === 'PESIN' && purchase.paymentMethod === 'NAKIT') {
      await this.cash
        .addMovement(
          {
            type: 'CIKIS',
            amount: grandTotal,
            category: 'ALIS',
            description: `Alış${input.invoiceNo ? ' #' + input.invoiceNo : ''}${purchase.supplier ? ' — ' + purchase.supplier.name : ''}`,
          },
          userId,
        )
        .catch(() => undefined);
    }

    return purchase;
  }

  list(filter: { from?: string; to?: string; supplierId?: string }) {
    const where: any = {};
    if (filter.from || filter.to) {
      where.invoiceDate = {};
      if (filter.from) where.invoiceDate.gte = new Date(filter.from + 'T00:00:00');
      if (filter.to) {
        const t = new Date(filter.to + 'T00:00:00');
        t.setDate(t.getDate() + 1);
        where.invoiceDate.lt = t;
      }
    }
    if (filter.supplierId) where.supplierId = filter.supplierId;
    return this.prisma.purchase.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      include: { items: true, supplier: true },
      take: 500,
    });
  }

  async get(id: string) {
    const p = await this.prisma.purchase.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    });
    if (!p) throw new NotFoundException('Alış bulunamadı');
    return p;
  }

  // Alış özeti (girdi): toplam alış, KDV, kategori/tedarikçi kırılımı.
  async summary(filter: { from?: string; to?: string }) {
    const list = await this.list(filter);
    const byCategory: Record<string, number> = {};
    const bySupplier: Record<string, number> = {};
    let grand = 0;
    let vat = 0;
    for (const p of list) {
      grand += p.grandTotal;
      vat += p.vatTotal;
      const cat = p.category || 'DIGER';
      byCategory[cat] = round2((byCategory[cat] || 0) + p.grandTotal);
      const sup = p.supplier?.name || 'Tedarikçisiz';
      bySupplier[sup] = round2((bySupplier[sup] || 0) + p.grandTotal);
    }
    return {
      count: list.length,
      grandTotal: round2(grand),
      vatTotal: round2(vat),
      byCategory,
      bySupplier,
    };
  }
}
