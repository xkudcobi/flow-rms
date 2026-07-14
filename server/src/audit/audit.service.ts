import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

function dayRange(dateStr?: string) {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

interface AuditInput {
  action: string;
  userId?: string;
  userName?: string;
  tableName?: string | null;
  orderId?: string;
  amount?: number;
  detail?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Best-effort: kayıt hata verse bile iş akışını bozmaz (çağıran .catch eder).
  log(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId,
        userName: input.userName,
        tableName: input.tableName ?? null,
        orderId: input.orderId,
        amount: round2(input.amount ?? 0),
        detail: input.detail,
      },
    });
  }

  list(dateStr?: string, action?: string) {
    const { start, end } = dayRange(dateStr);
    return this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async summary(dateStr?: string) {
    const logs = await this.list(dateStr);
    const isIptal = (a: string) => a === 'IPTAL_ADISYON' || a === 'IPTAL_KALEM';

    const totals = {
      iptal: { count: 0, amount: 0 },
      iskonto: { count: 0, amount: 0 },
      ikram: { count: 0, amount: 0 },
    };
    const users = new Map<
      string,
      {
        userName: string;
        iptal: number;
        iptalAmount: number;
        iskonto: number;
        iskontoAmount: number;
        ikram: number;
        ikramAmount: number;
        total: number;
        count: number;
      }
    >();

    for (const l of logs) {
      const key = l.userName || 'Bilinmiyor';
      const u =
        users.get(key) ?? {
          userName: key,
          iptal: 0,
          iptalAmount: 0,
          iskonto: 0,
          iskontoAmount: 0,
          ikram: 0,
          ikramAmount: 0,
          total: 0,
          count: 0,
        };
      if (isIptal(l.action)) {
        u.iptal += 1;
        u.iptalAmount += l.amount;
        totals.iptal.count += 1;
        totals.iptal.amount += l.amount;
      } else if (l.action === 'ISKONTO') {
        u.iskonto += 1;
        u.iskontoAmount += l.amount;
        totals.iskonto.count += 1;
        totals.iskonto.amount += l.amount;
      } else if (l.action === 'IKRAM') {
        u.ikram += 1;
        u.ikramAmount += l.amount;
        totals.ikram.count += 1;
        totals.ikram.amount += l.amount;
      }
      u.total = round2(u.iptalAmount + u.iskontoAmount + u.ikramAmount);
      u.count += 1;
      users.set(key, u);
    }

    const byUser = [...users.values()]
      .map((u) => ({
        ...u,
        iptalAmount: round2(u.iptalAmount),
        iskontoAmount: round2(u.iskontoAmount),
        ikramAmount: round2(u.ikramAmount),
      }))
      .sort((a, b) => b.total - a.total);

    // Basit anomali: ortalamanın 1.8 katından fazla + en az 3 işlem yapan personel.
    const avg = byUser.length
      ? byUser.reduce((s, u) => s + u.total, 0) / byUser.length
      : 0;
    for (const u of byUser as any[]) {
      u.flagged = byUser.length > 1 && u.count >= 3 && u.total > avg * 1.8;
    }

    return {
      totals: {
        iptal: { count: totals.iptal.count, amount: round2(totals.iptal.amount) },
        iskonto: {
          count: totals.iskonto.count,
          amount: round2(totals.iskonto.amount),
        },
        ikram: { count: totals.ikram.count, amount: round2(totals.ikram.amount) },
      },
      byUser,
    };
  }
}
