import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  // Bir zaman aralığı için nakit akışı: satış (nakit ödeme) + hareket giriş/çıkış.
  private async flow(openedAt: Date, closedAt?: Date | null) {
    const range = { gte: openedAt, ...(closedAt ? { lt: closedAt } : {}) };
    const [payments, movements] = await Promise.all([
      this.prisma.payment.findMany({
        where: { method: 'NAKIT', createdAt: range },
        select: { amount: true },
      }),
      this.prisma.cashMovement.findMany({
        where: { createdAt: range },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const cashSales = round2(payments.reduce((s, p) => s + p.amount, 0));
    const cashIn = round2(
      movements.filter((m) => m.type === 'GIRIS').reduce((s, m) => s + m.amount, 0),
    );
    const cashOut = round2(
      movements.filter((m) => m.type === 'CIKIS').reduce((s, m) => s + m.amount, 0),
    );
    return { cashSales, cashIn, cashOut, movements };
  }

  async getActive() {
    const s = await this.prisma.cashSession.findFirst({
      where: { status: 'ACIK' },
      orderBy: { openedAt: 'desc' },
    });
    if (!s) return null;
    const f = await this.flow(s.openedAt);
    const expected = round2(s.openingCash + f.cashSales + f.cashIn - f.cashOut);
    return {
      ...s,
      cashSales: f.cashSales,
      cashIn: f.cashIn,
      cashOut: f.cashOut,
      movements: f.movements,
      expectedCash: expected,
    };
  }

  // Manuel nakit hareketi (giriş/çıkış). Kasadan çıkan/giren her nakit.
  async addMovement(
    input: {
      type: string;
      amount: number;
      category?: string;
      description?: string;
    },
    userId?: string,
  ) {
    if (!['GIRIS', 'CIKIS'].includes(input.type))
      throw new BadRequestException('Geçersiz hareket türü (GIRIS/CIKIS)');
    if (!(input.amount > 0))
      throw new BadRequestException('Tutar 0’dan büyük olmalı');
    return this.prisma.cashMovement.create({
      data: {
        type: input.type,
        amount: input.amount,
        category: input.category || 'DIGER',
        description: input.description,
        createdById: userId,
      },
    });
  }

  async open(openingCash: number, userId: string) {
    const existing = await this.prisma.cashSession.findFirst({
      where: { status: 'ACIK' },
    });
    if (existing)
      throw new BadRequestException('Zaten açık bir kasa oturumu var.');
    return this.prisma.cashSession.create({
      data: { openingCash: openingCash || 0, openedById: userId },
    });
  }

  async close(
    id: string,
    countedCash: number,
    note: string | undefined,
    userId: string,
  ) {
    const s = await this.prisma.cashSession.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Kasa oturumu bulunamadı');
    if (s.status !== 'ACIK')
      throw new BadRequestException('Oturum zaten kapalı');
    const now = new Date();
    const f = await this.flow(s.openedAt, now);
    const expected = round2(
      s.openingCash + f.cashSales + f.cashIn - f.cashOut,
    );
    const variance = round2((countedCash || 0) - expected);
    return this.prisma.cashSession.update({
      where: { id },
      data: {
        status: 'KAPANDI',
        closedAt: now,
        closedById: userId,
        countedCash: countedCash || 0,
        variance,
        note,
      },
    });
  }

  async sessions(dateStr?: string) {
    const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.prisma.cashSession.findMany({
      where: { openedAt: { gte: start, lt: end } },
      orderBy: { openedAt: 'desc' },
    });
  }
}
