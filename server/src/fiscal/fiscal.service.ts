import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FiscalProvider } from './fiscal.provider';
import { createFiscalProvider } from './providers';

@Injectable()
export class FiscalService {
  private readonly provider: FiscalProvider = createFiscalProvider();

  constructor(private readonly prisma: PrismaService) {}

  get providerName() {
    return this.provider.name;
  }

  list() {
    return this.prisma.fiscalReceipt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // Bir sipariş için mali fiş kes (ödeme sonrası). Best-effort; sim'de her zaman OK.
  async issueForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    // Zaten kesilmişse tekrar kesme.
    const existing = await this.prisma.fiscalReceipt.findFirst({
      where: { orderId, status: 'OK' },
    });
    if (existing) return existing;

    const activeItems = order.items.filter((i) => i.status !== 'IPTAL');
    const itemsTotal = activeItems.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );
    let disc = 0;
    if (order.discountType === 'YUZDE')
      disc = (itemsTotal * order.discountValue) / 100;
    else if (order.discountType === 'TUTAR') disc = order.discountValue;
    const amount = Math.round((itemsTotal - Math.min(disc, itemsTotal)) * 100) / 100;

    const res = await this.provider.printFiscalReceipt({
      orderId,
      amount,
      payments: order.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
      items: activeItems.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
        lineTotal: i.unitPrice * i.quantity,
      })),
    });

    return this.prisma.fiscalReceipt.create({
      data: {
        orderId,
        fiscalNo: res.fiscalNo,
        zNo: res.zNo,
        amount,
        provider: res.provider,
        status: res.status,
      },
    });
  }
}
