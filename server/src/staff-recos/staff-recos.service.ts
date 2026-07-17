import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { ROLES } from '../auth/roles';

interface ManualInput {
  targetType: 'ROLE' | 'USER' | 'GROUP';
  targetRole?: string;
  targetUserId?: string;
  targetGroupId?: string;
  title: string;
  body: string;
  severity?: string;
}

@Injectable()
export class StaffRecosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  // Kural tabanlı otomatik tavsiye üretimi. Şimdilik ana kaynak: SKT yaklaşan
  // partiler → o malzemeyi içeren menü ürünlerini bul → garsona "öner", mutfağa
  // "önce bunu kullan" tavsiyesi. dedupeKey ile aynı tavsiye tekrar üretilmez.
  async generate(): Promise<{ created: number }> {
    let created = 0;
    let expiring: Awaited<ReturnType<StockService['expiringLots']>> = [];
    try {
      expiring = await this.stock.expiringLots(3);
    } catch {
      expiring = [];
    }

    for (const lot of expiring) {
      // Bu stok kalemini kullanan menü ürünleri (reçete üzerinden).
      const recipes = await this.prisma.recipeItem.findMany({
        where: { stockItemId: lot.stockItemId },
        include: { product: { select: { name: true, active: true } } },
      });
      const productNames = [
        ...new Set(
          recipes
            .filter((r) => r.product?.active)
            .map((r) => r.product.name),
        ),
      ];
      const past = lot.daysLeft != null && lot.daysLeft <= 0;
      const when = past ? 'SKT geçti' : `SKT'ye ${lot.daysLeft} gün kaldı`;

      // Garsona: müşterilere öner.
      const garsonBody = productNames.length
        ? `${lot.stockItemName} (${when}). İçeren ürünleri müşterilere önerin: ${productNames.join(', ')}.`
        : `${lot.stockItemName} (${when}). Bu malzemeyi içeren ürünleri müşterilere öne çıkarın.`;
      created += await this.upsertAuto({
        dedupeKey: `expiry:${lot.id}:GARSON`,
        targetType: 'ROLE',
        targetRole: ROLES.GARSON,
        title: `${lot.stockItemName}: müşterilere önerin`,
        body: garsonBody,
        severity: past ? 'danger' : 'warning',
      });

      // Mutfağa: önce bu partiyi kullan.
      created += await this.upsertAuto({
        dedupeKey: `expiry:${lot.id}:MUTFAK`,
        targetType: 'ROLE',
        targetRole: ROLES.MUTFAK,
        title: `${lot.stockItemName}: önce bu partiyi kullanın`,
        body: `${lot.stockItemName} — ${lot.remainingQty} ${lot.unit} (${when}). Fire vermemek için önce bu partiden tüketin.`,
        severity: past ? 'danger' : 'warning',
      });
    }

    return { created };
  }

  private async upsertAuto(data: {
    dedupeKey: string;
    targetType: string;
    targetRole: string;
    title: string;
    body: string;
    severity: string;
  }): Promise<number> {
    const exists = await this.prisma.staffRecommendation.findUnique({
      where: { dedupeKey: data.dedupeKey },
    });
    if (exists) return 0;
    await this.prisma.staffRecommendation.create({
      data: {
        dedupeKey: data.dedupeKey,
        targetType: data.targetType,
        targetRole: data.targetRole,
        title: data.title,
        body: data.body,
        severity: data.severity,
        source: 'AUTO',
        status: 'BEKLIYOR',
      },
    });
    return 1;
  }

  // Yönetici görünümü: tüm tavsiyeler (üretilmiş + manuel). Önce taze üretim
  // dener, sonra listeyi döndürür.
  async listForManager(status?: string) {
    await this.generate().catch(() => undefined);
    const where: any = {};
    if (status) where.status = status;
    return this.prisma.staffRecommendation.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async createManual(input: ManualInput, createdById?: string) {
    return this.prisma.staffRecommendation.create({
      data: {
        targetType: input.targetType,
        targetRole: input.targetType === 'ROLE' ? input.targetRole : null,
        targetUserId: input.targetType === 'USER' ? input.targetUserId : null,
        targetGroupId: input.targetType === 'GROUP' ? input.targetGroupId : null,
        title: input.title,
        body: input.body,
        severity: input.severity || 'info',
        source: 'MANUAL',
        status: 'BEKLIYOR',
        createdById,
      },
    });
  }

  async approve(id: string, approvedById?: string) {
    await this.getOrThrow(id);
    return this.prisma.staffRecommendation.update({
      where: { id },
      data: { status: 'ONAYLANDI', approvedById, approvedAt: new Date() },
    });
  }

  async reject(id: string) {
    await this.getOrThrow(id);
    return this.prisma.staffRecommendation.update({
      where: { id },
      data: { status: 'REDDEDILDI' },
    });
  }

  // Personel görünümü: kendisine hedefli (rol/grup/kişi) ONAYLANMIŞ tavsiyeler.
  async listForUser(userId: string, role: string) {
    const groupIds = (
      await this.prisma.staffGroupMember.findMany({
        where: { userId },
        select: { groupId: true },
      })
    ).map((m) => m.groupId);

    const recos = await this.prisma.staffRecommendation.findMany({
      where: {
        status: 'ONAYLANDI',
        OR: [
          { targetType: 'ROLE', targetRole: role },
          { targetType: 'USER', targetUserId: userId },
          groupIds.length
            ? { targetType: 'GROUP', targetGroupId: { in: groupIds } }
            : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { approvedAt: 'desc' },
      take: 100,
    });
    return recos.map((r) => ({
      ...r,
      seen: parseSeen(r.seenBy).includes(userId),
    }));
  }

  async markSeen(id: string, userId: string) {
    const r = await this.getOrThrow(id);
    const seen = new Set(parseSeen(r.seenBy));
    seen.add(userId);
    return this.prisma.staffRecommendation.update({
      where: { id },
      data: { seenBy: JSON.stringify([...seen]) },
    });
  }

  private async getOrThrow(id: string) {
    const r = await this.prisma.staffRecommendation.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Tavsiye bulunamadı');
    return r;
  }
}

function parseSeen(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
