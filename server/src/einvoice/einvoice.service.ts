import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EInvoiceProvider } from './einvoice.provider';
import { createEInvoiceProvider } from './providers';

@Injectable()
export class EInvoiceService {
  private readonly provider: EInvoiceProvider = createEInvoiceProvider();

  constructor(private readonly prisma: PrismaService) {}

  get providerName() {
    return this.provider.name;
  }

  list() {
    return this.prisma.eInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // Bir siparişten e-Belge (varsayılan e-Arşiv) oluştur.
  async createFromOrder(
    orderId: string,
    docType: 'EFATURA' | 'EARSIV' = 'EARSIV',
    accountId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    const activeItems = order.items.filter((i) => i.status !== 'IPTAL');
    const itemsTotal = activeItems.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );
    let disc = 0;
    if (order.discountType === 'YUZDE')
      disc = (itemsTotal * order.discountValue) / 100;
    else if (order.discountType === 'TUTAR') disc = order.discountValue;
    const total = Math.round((itemsTotal - Math.min(disc, itemsTotal)) * 100) / 100;

    let customerName: string | undefined;
    if (accountId) {
      const acc = await this.prisma.account.findUnique({
        where: { id: accountId },
      });
      customerName = acc?.name;
    }

    const res = await this.provider.createInvoice({
      orderId,
      accountId,
      docType,
      total,
      customerName,
      items: activeItems.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    });

    return this.prisma.eInvoice.create({
      data: {
        orderId,
        accountId,
        uuid: res.uuid,
        docType,
        status: res.status,
        total,
        provider: res.provider,
      },
    });
  }
}
