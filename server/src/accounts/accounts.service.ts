import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Hareket türü → bakiye değişim yönü.
// BORC (müşteri veresiye) ve ODEME (tedarikçiye ödedik) bakiyeyi artırır (+).
// ALACAK (müşteriden tahsilat) ve ALIS (tedarikçiden veresiye aldık) azaltır (−).
const DELTA: Record<string, number> = {
  BORC: 1,
  ODEME: 1,
  ALACAK: -1,
  ALIS: -1,
};

export interface AccountInput {
  name?: string;
  type?: string;
  phone?: string;
  note?: string;
  taxNumber?: string;
  taxOffice?: string;
  address?: string;
  email?: string;
  iban?: string;
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  list(type?: string, includeInactive = false) {
    return this.prisma.account.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async detail(id: string) {
    const acc = await this.prisma.account.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!acc) throw new NotFoundException('Cari hesap bulunamadı');
    return acc;
  }

  create(data: AccountInput & { name: string }) {
    if (data.type && !['MUSTERI', 'TEDARIKCI', 'PERSONEL'].includes(data.type))
      throw new BadRequestException('Geçersiz cari türü');
    return this.prisma.account.create({ data });
  }

  async update(id: string, data: AccountInput & { active?: boolean }) {
    await this.getOrThrow(id);
    return this.prisma.account.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    return this.prisma.account.update({
      where: { id },
      data: { active: false },
    });
  }

  // Cari hareket ekle. BORC → bakiye artar (cari borçlanır), ALACAK → azalır (tahsilat).
  async addTransaction(
    accountId: string,
    input: { type: string; amount: number; description?: string; orderId?: string },
    userId?: string,
  ) {
    await this.getOrThrow(accountId);
    if (!(input.type in DELTA))
      throw new BadRequestException(
        'Geçersiz hareket türü (BORC/ALACAK/ALIS/ODEME)',
      );
    if (!(input.amount > 0))
      throw new BadRequestException('Tutar 0’dan büyük olmalı');

    const delta = DELTA[input.type] * input.amount;
    await this.prisma.accountTransaction.create({
      data: {
        accountId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        orderId: input.orderId,
        createdById: userId,
      },
    });
    const acc = await this.prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
    return { ...acc, balance: round2(acc.balance) };
  }

  private async getOrThrow(id: string) {
    const a = await this.prisma.account.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Cari hesap bulunamadı');
    return a;
  }
}
