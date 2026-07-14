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

  // Kullanıcının rolüne göre güncel bildirimler + nav rozet sayıları.
  async snapshot(role: Role) {
    const all = await this.collect();
    const items = all.filter((n) => n.roles.includes(role));
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

    return out;
  }
}
