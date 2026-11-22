import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { Role, ROLES } from '../auth/roles';

export interface Notification {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  page: string; // yönlenecek sayfa anahtarı (nav 'to' ile eşleşir, /'siz)
  roles: Role[]; // bu bildirimi görebilecek roller
  // Kişiye özel hedefli bildirim (ör. atanan görev). Doluysa yalnızca bu
  // kullanıcılar görür; roles yerine/ek olarak değerlendirilir.
  userIds?: string[];
  at: string;
}

// Mutfakta bir kalem "geciken" sayılır: bu süreden uzundur serviste değil (dk).
const KDS_WARN_MIN = 15;
const KDS_DANGER_MIN = 25;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  // Kullanıcının rolüne (ve kişiye özel hedefine) göre güncel bildirimler.
  async snapshot(role: Role, userId?: string) {
    const all = await this.collect();
    const items = all.filter((n) => {
      // Kişiye özel hedef varsa yalnızca hedeflenen kullanıcı görür.
      if (n.userIds && n.userIds.length) {
        return !!userId && n.userIds.includes(userId);
      }
      return n.roles.includes(role);
    });
    // Nav rozetleri: sayfa bazında bildirim sayısı (kırmızı nokta için).
    const badges: Record<string, number> = {};
    for (const n of items) badges[n.page] = (badges[n.page] || 0) + 1;
    return { count: items.length, items, badges };
  }

  private async collect(): Promise<Notification[]> {
    const out: Notification[] = [];
    const now = Date.now();

    // 1) Mutfakta geciken kalemler (uzun süredir teslim edilmemiş).
    const pending = await this.prisma.orderItem.findMany({
      where: {
        status: { in: ['YENI', 'HAZIRLANIYOR', 'HAZIR'] },
        order: { status: 'ACIK' },
      },
      include: { order: { include: { table: true } } },
    });
    for (const it of pending) {
      const mins = Math.floor((now - new Date(it.createdAt).getTime()) / 60000);
      if (mins < KDS_WARN_MIN) continue;
      out.push({
        id: `kds:${it.id}`,
        severity: mins >= KDS_DANGER_MIN ? 'danger' : 'warning',
        title: 'Geciken sipariş',
        message: `Masa ${it.order.table?.name ?? '?'} · ${it.quantity}× ${it.nameSnapshot} — ${mins} dk'dır bekliyor`,
        page: 'mutfak',
        roles: [ROLES.PATRON, ROLES.MUDUR, ROLES.MUTFAK],
        at: new Date(it.createdAt).toISOString(),
      });
    }

    // 2) Bekleyen garson/hesap çağrıları.
    const calls = await this.prisma.waiterCall.findMany({
      where: { status: 'BEKLIYOR' },
      include: { table: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const c of calls) {
      out.push({
        id: `call:${c.id}`,
        severity: 'warning',
        title: c.type === 'HESAP' ? 'Hesap isteniyor' : 'Garson çağrısı',
        message: `Masa ${c.table?.name ?? '?'} ${c.type === 'HESAP' ? 'hesap istiyor' : 'garson çağırıyor'}`,
        page: 'salon',
        roles: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER, ROLES.GARSON],
        at: new Date(c.createdAt).toISOString(),
      });
    }

    // 3) Kritik stok.
    try {
      const low = await this.stock.alerts();
      for (const i of low) {
        out.push({
          id: `stock:${i.id}`,
          severity: 'warning',
          title: 'Kritik stok',
          message: `${i.name}: ${i.quantity} ${i.unit} kaldı (kritik ${i.criticalLevel})`,
          page: 'stok',
          roles: [ROLES.PATRON, ROLES.MUDUR],
          at: new Date().toISOString(),
        });
      }
    } catch {
      /* stok modülü sorunluysa atla */
    }

    // 3b) SKT yaklaşan/geçen partiler (izlenebilirlik).
    try {
      const expiring = await this.stock.expiringLots(3);
      for (const l of expiring) {
        const past = l.daysLeft != null && l.daysLeft <= 0;
        out.push({
          id: `expiry:${l.id}`,
          severity: past ? 'danger' : 'warning',
          title: past ? 'SKT geçti' : 'SKT yaklaşıyor',
          message: `${l.stockItemName}: ${l.remainingQty} ${l.unit} — ${
            past
              ? 'süresi doldu'
              : `${l.daysLeft} gün kaldı`
          }`,
          page: 'stok',
          roles: [ROLES.PATRON, ROLES.MUDUR, ROLES.MUTFAK],
          at: l.expiryDate ? new Date(l.expiryDate).toISOString() : new Date().toISOString(),
        });
      }
    } catch {
      /* parti/SKT verisi yoksa atla */
    }

    // 4) Yeni/okunmamış Google yorumları (özellikle düşük puan).
    const unseen = await this.prisma.googleReview.findMany({
      where: { seen: false },
    });
    if (unseen.length) {
      const low = unseen.filter((r) => r.rating <= 2).length;
      out.push({
        id: `reviews:${unseen.length}:${low}`,
        severity: low > 0 ? 'danger' : 'info',
        title: 'Yeni Google yorumu',
        message: `${unseen.length} yeni yorum${low > 0 ? ` (${low} düşük puanlı — hızlı yanıt önerilir)` : ''}`,
        page: 'geribildirim',
        roles: [ROLES.PATRON, ROLES.MUDUR],
        at: new Date().toISOString(),
      });
    }

    // 5) Bugün yaklaşan rezervasyonlar (önümüzdeki 60 dk).
    try {
      const soon = new Date(now + 60 * 60000);
      const resv = await this.prisma.reservation.findMany({
        where: {
          status: 'BEKLIYOR',
          reservedAt: { gte: new Date(now), lte: soon },
        },
        include: { table: true },
        orderBy: { reservedAt: 'asc' },
      });
      for (const r of resv) {
        const mins = Math.max(0, Math.floor((new Date(r.reservedAt).getTime() - now) / 60000));
        out.push({
          id: `resv:${r.id}`,
          severity: 'info',
          title: 'Yaklaşan rezervasyon',
          message: `${r.customerName ?? 'Misafir'} · ${mins} dk sonra${r.table ? ` · Masa ${r.table.name}` : ''}`,
          page: 'rezervasyonlar',
          roles: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER],
          at: new Date(r.reservedAt).toISOString(),
        });
      }
    } catch {
      /* rezervasyon alanları farklıysa atla */
    }

    // 6) Açık görevler — atanan kişiye (veya grubun üyelerine) hedefli.
    try {
      const tasks = await this.prisma.task.findMany({
        where: { status: 'ACIK' },
        include: { assigneeGroup: { include: { members: true } } },
      });
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      for (const t of tasks) {
        // Hedef kullanıcı id'leri: doğrudan atanan veya grup üyeleri.
        const userIds =
          t.assigneeType === 'GROUP'
            ? (t.assigneeGroup?.members ?? []).map((m) => m.userId)
            : t.assigneeUserId
              ? [t.assigneeUserId]
              : [];
        if (!userIds.length) continue;
        const overdue = !!t.dueDate && new Date(t.dueDate).getTime() < now;
        const dueSoon = !!t.dueDate && new Date(t.dueDate) <= endOfToday;
        out.push({
          id: `task:${t.id}`,
          severity: overdue ? 'warning' : 'info',
          title: overdue ? 'Geciken görev' : 'Görev',
          message: t.dueDate
            ? `${t.title}${dueSoon ? ' — bugün' : ''}`
            : t.title,
          page: 'gorevler',
          roles: [],
          userIds,
          at: new Date(t.dueDate ?? t.createdAt).toISOString(),
        });
      }
    } catch {
      /* görev tablosu yoksa atla */
    }

    // 7) Onaylanan personel tavsiyeleri — hedef role/kişiye/gruba bildir (son 3 gün).
    try {
      const since = new Date(now - 3 * 24 * 60 * 60000);
      const recos = await this.prisma.staffRecommendation.findMany({
        where: { status: 'ONAYLANDI', approvedAt: { gte: since } },
      });
      // Grup hedefleri için üye listesi (tek seferde).
      const groupIds = recos
        .filter((r) => r.targetType === 'GROUP' && r.targetGroupId)
        .map((r) => r.targetGroupId as string);
      const members = groupIds.length
        ? await this.prisma.staffGroupMember.findMany({
            where: { groupId: { in: groupIds } },
            select: { groupId: true, userId: true },
          })
        : [];
      for (const r of recos) {
        const base = {
          id: `reco:${r.id}`,
          severity: (r.severity as Notification['severity']) || 'info',
          title: 'Yeni tavsiye',
          message: r.title,
          page: 'tavsiyeler',
          at: new Date(r.approvedAt ?? r.createdAt).toISOString(),
        };
        if (r.targetType === 'ROLE' && r.targetRole) {
          out.push({ ...base, roles: [r.targetRole as Role] });
        } else if (r.targetType === 'USER' && r.targetUserId) {
          out.push({ ...base, roles: [], userIds: [r.targetUserId] });
        } else if (r.targetType === 'GROUP' && r.targetGroupId) {
          const uids = members
            .filter((m) => m.groupId === r.targetGroupId)
            .map((m) => m.userId);
          if (uids.length) out.push({ ...base, roles: [], userIds: uids });
        }
      }
    } catch {
      /* tavsiye tablosu yoksa atla */
    }

    return out;
  }
}
