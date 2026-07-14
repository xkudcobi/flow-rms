import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Her 10₺ net harcama = 1 sadakat puanı. Puan kullanımı: 1 puan = 1₺.
const POINTS_PER_TL = 1 / 10;

interface CustomerInput {
  name: string;
  phone?: string;
  birthday?: string; // YYYY-MM-DD
  note?: string;
}

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
  return round2(itemsTotal - disc);
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // Müşteri listesi (opsiyonel ad/telefon arama). Son ziyaret / ada göre sıralı.
  list(search?: string) {
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {};
    return this.prisma.customer.findMany({
      where,
      orderBy: [{ lastVisitAt: 'desc' }, { name: 'asc' }],
    });
  }

  // Telefonla eşleştirme (müdavim tanıma — ödeme/rezervasyonda kullanılır).
  findByPhone(phone: string) {
    if (!phone) return null;
    return this.prisma.customer.findFirst({ where: { phone } });
  }

  // Müşteri detay + ziyaret geçmişi (kapanmış adisyonlardan türetilir).
  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');
    const orders = await this.prisma.order.findMany({
      where: { customerId: id, status: 'KAPANDI' },
      include: { items: true, table: true },
      orderBy: { closedAt: 'desc' },
      take: 50,
    });
    const visits = orders.map((o) => ({
      id: o.id,
      date: o.closedAt,
      table: o.table?.name ?? o.mergedLabel ?? '—',
      net: orderNet(o),
    }));
    return { ...customer, visits };
  }

  async create(input: CustomerInput) {
    if (!input.name?.trim())
      throw new BadRequestException('Müşteri adı gerekli');
    if (input.phone) {
      const exists = await this.prisma.customer.findFirst({
        where: { phone: input.phone },
      });
      if (exists)
        throw new BadRequestException('Bu telefon numarası zaten kayıtlı');
    }
    return this.prisma.customer.create({
      data: {
        name: input.name.trim(),
        phone: input.phone || null,
        birthday: input.birthday ? new Date(input.birthday + 'T00:00:00') : null,
        note: input.note || null,
      },
    });
  }

  async update(id: string, input: Partial<CustomerInput>) {
    await this.getOrThrow(id);
    if (input.phone) {
      const exists = await this.prisma.customer.findFirst({
        where: { phone: input.phone, id: { not: id } },
      });
      if (exists)
        throw new BadRequestException('Bu telefon numarası başka müşteride kayıtlı');
    }
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        phone: input.phone === '' ? null : input.phone,
        birthday:
          input.birthday === undefined
            ? undefined
            : input.birthday
              ? new Date(input.birthday + 'T00:00:00')
              : null,
        note: input.note,
      },
    });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    // Adisyon bağlarını koru: müşteriyi sil ama siparişlerdeki customerId null'lanır.
    await this.prisma.order.updateMany({
      where: { customerId: id },
      data: { customerId: null },
    });
    return this.prisma.customer.delete({ where: { id } });
  }

  // Bu ay doğum günü olan müşteriler (gün sırasıyla).
  async birthdays() {
    const month = new Date().getMonth() + 1; // 1-12
    const all = await this.prisma.customer.findMany({
      where: { birthday: { not: null } },
    });
    return all
      .filter((c) => c.birthday && c.birthday.getMonth() + 1 === month)
      .sort((a, b) => (a.birthday!.getDate() - b.birthday!.getDate()))
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        day: c.birthday!.getDate(),
        birthday: c.birthday,
      }));
  }

  // En çok harcayan müşteriler.
  top(limit = 10) {
    return this.prisma.customer.findMany({
      where: { totalSpent: { gt: 0 } },
      orderBy: { totalSpent: 'desc' },
      take: limit,
    });
  }

  // --- sadakat (orders.service tarafından çağrılır) ---

  // Adisyon kapanışında ziyaret + puan işle.
  async recordVisit(customerId: string, net: number) {
    const earned = Math.floor(net * POINTS_PER_TL);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        visitCount: { increment: 1 },
        totalSpent: { increment: round2(net) },
        loyaltyPoints: { increment: earned },
        lastVisitAt: new Date(),
      },
    });
    return earned;
  }

  // Puan kullan (ödemede). Yetersiz puanda hata.
  async deductPoints(customerId: string, points: number) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!c) throw new NotFoundException('Müşteri bulunamadı');
    if (points <= 0) throw new BadRequestException('Geçersiz puan');
    if (c.loyaltyPoints < points)
      throw new BadRequestException(
        `Yetersiz puan (mevcut: ${c.loyaltyPoints})`,
      );
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: points } },
    });
    return c.loyaltyPoints - points;
  }

  private async getOrThrow(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Müşteri bulunamadı');
    return c;
  }
}
