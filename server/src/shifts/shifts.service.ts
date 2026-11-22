import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

// "09:00"–"17:00" → saat cinsinden süre (gece yarısını geçen vardiyayı da hesaba katar).
function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // gece devam eden vardiya
  return round2(mins / 60);
}

// Kapalı adisyonun net cirosu (iptal kalemler ve iskonto düşülmüş).
function orderNet(order: {
  items: { unitPrice: number; quantity: number; status: string }[];
  discountType: string | null;
  discountValue: number;
}): number {
  const itemsTotal = order.items
    .filter((i) => i.status !== 'IPTAL')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let disc = 0;
  if (order.discountType === 'YUZDE')
    disc = (itemsTotal * order.discountValue) / 100;
  else if (order.discountType === 'TUTAR') disc = order.discountValue;
  disc = Math.min(disc, itemsTotal);
  return itemsTotal - disc;
}

interface ShiftInput {
  userId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  note?: string;
}

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  // Bir haftanın (start = seçilen gün) vardiyaları + her birinin saat süresi.
  async list(startStr?: string) {
    const base = startStr ? new Date(startStr + 'T00:00:00') : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const shifts = await this.prisma.shift.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    return shifts.map((s) => ({
      ...s,
      hours: shiftHours(s.startTime, s.endTime),
    }));
  }

  // Personel performansı: verilen gün aralığında (yoksa bugün) garson/kullanıcı
  // bazında net ciro, adisyon sayısı, ortalama adisyon. Leaderboard için.
  async performance(fromStr?: string, toStr?: string) {
    const now = new Date();
    const fromBase = fromStr ? new Date(fromStr + 'T00:00:00') : now;
    const start = new Date(
      fromBase.getFullYear(),
      fromBase.getMonth(),
      fromBase.getDate(),
    );
    const toBase = toStr ? new Date(toStr + 'T00:00:00') : start;
    const end = new Date(
      toBase.getFullYear(),
      toBase.getMonth(),
      toBase.getDate(),
    );
    end.setDate(end.getDate() + 1); // bitiş günü dahil

    const [orders, users, audits] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'KAPANDI', closedAt: { gte: start, lt: end } },
        include: { items: true },
      }),
      this.prisma.user.findMany({
        where: { active: true },
        select: { id: true, fullName: true, role: true },
      }),
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: start, lt: end }, userId: { not: null } },
        select: { userId: true, action: true },
      }),
    ]);

    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    const roleById = new Map(users.map((u) => [u.id, u.role]));

    interface Row {
      userId: string;
      userName: string;
      role: string;
      orders: number; // açtığı adisyon sayısı
      revenue: number; // açtığı adisyonların net cirosu
      tips: number;
      itemsSold: number; // sattığı (eklediği) kalem adedi
      itemRevenue: number; // kalem bazlı ciro (kişinin eklediği kalemler)
      cancels: number; // iptal işlemleri (adisyon/kalem)
      treats: number; // ikram
    }
    const agg = new Map<string, Row>();
    const ensure = (key: string): Row => {
      let cur = agg.get(key);
      if (!cur) {
        cur = {
          userId: key,
          userName: nameById.get(key) || 'Bilinmeyen',
          role: roleById.get(key) || '',
          orders: 0,
          revenue: 0,
          tips: 0,
          itemsSold: 0,
          itemRevenue: 0,
          cancels: 0,
          treats: 0,
        };
        agg.set(key, cur);
      }
      return cur;
    };

    for (const o of orders) {
      // Adisyonu açan kişi: adisyon sayısı + net ciro + bahşiş.
      const opener = ensure(o.openedById);
      opener.orders += 1;
      opener.revenue += orderNet(o);
      opener.tips += o.tip || 0;

      // Kalem bazlı: kalemi ekleyen (satan) kişiye ciro + adet.
      for (const it of o.items) {
        if (it.status === 'IPTAL') continue;
        if (!it.addedById) continue;
        const seller = ensure(it.addedById);
        seller.itemsSold += it.quantity;
        seller.itemRevenue += it.unitPrice * it.quantity;
      }
    }

    for (const a of audits) {
      if (!a.userId) continue;
      const row = ensure(a.userId);
      if (a.action === 'IPTAL_ADISYON' || a.action === 'IPTAL_KALEM') row.cancels += 1;
      else if (a.action === 'IKRAM') row.treats += 1;
    }

    return [...agg.values()]
      .map((r) => ({
        ...r,
        revenue: round2(r.revenue),
        tips: round2(r.tips),
        itemRevenue: round2(r.itemRevenue),
        avgTicket: r.orders ? round2(r.revenue / r.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async create(input: ShiftInput) {
    if (!input.startTime || !input.endTime)
      throw new BadRequestException('Başlangıç ve bitiş saati gerekli');
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) throw new NotFoundException('Personel bulunamadı');
    return this.prisma.shift.create({
      data: {
        userId: input.userId,
        userName: user.fullName,
        date: new Date(input.date + 'T00:00:00'),
        startTime: input.startTime,
        endTime: input.endTime,
        note: input.note,
      },
    });
  }

  async remove(id: string) {
    const s = await this.prisma.shift.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Vardiya bulunamadı');
    return this.prisma.shift.delete({ where: { id } });
  }
}
