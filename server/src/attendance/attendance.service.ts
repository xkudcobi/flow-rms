import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async assertEnabled() {
    const s = await this.settings.get();
    if (!s.attendanceQrEnabled) {
      throw new BadRequestException('Personel giriş/çıkış takibi kapalı');
    }
  }

  // QR okutma: açık kayıt varsa çıkış yap, yoksa giriş yap (toggle).
  async clock(userId: string, userName: string, source = 'QR') {
    await this.assertEnabled();
    const open = await this.prisma.attendance.findFirst({
      where: { userId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (open) {
      const now = new Date();
      const minutes = Math.max(
        0,
        Math.round((now.getTime() - new Date(open.clockIn).getTime()) / 60000),
      );
      const rec = await this.prisma.attendance.update({
        where: { id: open.id },
        data: { clockOut: now, workedMinutes: minutes },
      });
      return { action: 'CIKIS', record: rec, workedMinutes: minutes };
    }
    const rec = await this.prisma.attendance.create({
      data: { userId, userName, source, clockIn: new Date() },
    });
    return { action: 'GIRIS', record: rec };
  }

  // Kullanıcının mevcut durumu + son kayıtları.
  async me(userId: string) {
    const [open, recent] = await Promise.all([
      this.prisma.attendance.findFirst({
        where: { userId, clockOut: null },
        orderBy: { clockIn: 'desc' },
      }),
      this.prisma.attendance.findMany({
        where: { userId },
        orderBy: { clockIn: 'desc' },
        take: 15,
      }),
    ]);
    return { open, recent };
  }

  // Yönetici raporu: aralıktaki kayıtlar + kişi bazında toplam çalışılan dakika.
  async report(filter: { from?: string; to?: string; userId?: string }) {
    const where: any = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.from || filter.to) {
      where.clockIn = {};
      if (filter.from) where.clockIn.gte = new Date(filter.from + 'T00:00:00');
      if (filter.to) {
        const t = new Date(filter.to + 'T00:00:00');
        t.setDate(t.getDate() + 1);
        where.clockIn.lt = t;
      }
    }
    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { clockIn: 'desc' },
      take: 1000,
    });

    const byUser = new Map<
      string,
      { userId: string; userName: string; minutes: number; days: number; open: number }
    >();
    for (const r of records) {
      const cur =
        byUser.get(r.userId) || {
          userId: r.userId,
          userName: r.userName,
          minutes: 0,
          days: 0,
          open: 0,
        };
      cur.minutes += r.workedMinutes || 0;
      cur.days += 1;
      if (!r.clockOut) cur.open += 1;
      byUser.set(r.userId, cur);
    }

    return {
      records,
      totals: [...byUser.values()]
        .map((u) => ({ ...u, hours: Math.round((u.minutes / 60) * 100) / 100 }))
        .sort((a, b) => b.minutes - a.minutes),
    };
  }
}
