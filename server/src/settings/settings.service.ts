import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON = 'singleton';

export interface SettingsInput {
  businessName?: string | null;
  openHour?: number;
  closeHour?: number;
  openDays?: string;
  address?: string | null;
  phone?: string | null;
  note?: string | null;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Tekil ayar satırı; yoksa varsayılanlarla oluşturur.
  async get() {
    const existing = await this.prisma.businessSetting.findUnique({
      where: { id: SINGLETON },
    });
    if (existing) return existing;
    return this.prisma.businessSetting.create({ data: { id: SINGLETON } });
  }

  async update(input: SettingsInput) {
    const clamp = (n: number | undefined, lo: number, hi: number) =>
      n === undefined ? undefined : Math.max(lo, Math.min(hi, Math.round(n)));
    const data = {
      businessName: input.businessName,
      openHour: clamp(input.openHour, 0, 23),
      closeHour: clamp(input.closeHour, 1, 28),
      openDays: input.openDays,
      address: input.address,
      phone: input.phone,
      note: input.note,
    };
    return this.prisma.businessSetting.upsert({
      where: { id: SINGLETON },
      create: { id: SINGLETON, ...data },
      update: data,
    });
  }
}
