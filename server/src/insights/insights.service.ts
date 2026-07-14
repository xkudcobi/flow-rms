import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { StockService } from '../stock/stock.service';
import { SettingsService } from '../settings/settings.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function orderNet(o: {
  items: { unitPrice: number; quantity: number; status: string }[];
  discountType: string | null;
  discountValue: number;
}): number {
  const itemsTotal = o.items
    .filter((i) => i.status !== 'IPTAL')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let disc = 0;
  if (o.discountType === 'YUZDE') disc = (itemsTotal * o.discountValue) / 100;
  else if (o.discountType === 'TUTAR') disc = o.discountValue;
  disc = Math.min(disc, itemsTotal);
  return itemsTotal - disc;
}

export interface Suggestion {
  severity: 'info' | 'warning' | 'success';
  icon: string;
  title: string;
  text: string;
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menu: MenuService,
    private readonly stock: StockService,
    private readonly settings: SettingsService,
  ) {}

  // Tüm öngörü paketini tek çağrıda döndürür (her zaman çalışır, LLM'siz, local).
  async overview() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 56); // son 8 hafta

    // İşletme çalışma saatleri — ölü saat/ısı haritası yalnız AÇIK saatleri dikkate alsın.
    const cfg = await this.settings.get();
    const openHours = this.computeOpenHours(cfg.openHour, cfg.closeHour);

    const orders = await this.prisma.order.findMany({
      where: { status: 'KAPANDI', closedAt: { gte: start } },
      include: { items: true },
    });

    // Haftanın günü ve saat bazında ciro toplamı.
    const byWeekday = Array.from({ length: 7 }, () => ({ rev: 0, days: new Set<string>() }));
    const byHour = Array.from({ length: 24 }, () => ({ rev: 0, count: 0 }));
    const heat: Record<string, number> = {}; // "wd-hour" → ciro

    for (const o of orders) {
      if (!o.closedAt) continue;
      const d = new Date(o.closedAt);
      const wd = d.getDay();
      const hr = d.getHours();
      const net = orderNet(o);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byWeekday[wd].rev += net;
      byWeekday[wd].days.add(dayKey);
      byHour[hr].rev += net;
      byHour[hr].count += 1;
      heat[`${wd}-${hr}`] = round2((heat[`${wd}-${hr}`] || 0) + net);
    }

    // Haftanın günü ortalaması (o güne denk gelen tarih sayısına bölerek).
    const weekdayAvg = byWeekday.map((w) => (w.days.size ? w.rev / w.days.size : 0));

    // Önümüzdeki 7 gün tahmini (haftanın günü ortalaması).
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1);
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        label: GUNLER[d.getDay()],
        forecast: round2(weekdayAvg[d.getDay()]),
      };
    });

    // Isı haritası: yalnızca işletmenin açık olduğu saatler.
    const heatmap: { day: number; label: string; hours: { hour: number; value: number }[] }[] = [];
    for (let wd = 0; wd < 7; wd++) {
      const hours = openHours.map((hr) => ({
        hour: hr,
        value: round2(heat[`${wd}-${hr}`] || 0),
      }));
      heatmap.push({ day: wd, label: GUNLER[wd].slice(0, 3), hours });
    }

    const suggestions = await this.buildSuggestions(orders, byHour, openHours);

    // Özet
    const totalRev = round2(orders.reduce((s, o) => s + orderNet(o), 0));
    const bestWeekday = weekdayAvg
      .map((v, i) => ({ i, v }))
      .sort((a, b) => b.v - a.v)[0];

    return {
      rangeDays: 56,
      orderCount: orders.length,
      totalRev,
      avgPerDay: round2(totalRev / 56),
      bestWeekday: bestWeekday && bestWeekday.v > 0 ? GUNLER[bestWeekday.i] : null,
      forecast,
      hourly: byHour.map((h, i) => ({ hour: i, rev: round2(h.rev), count: h.count })).filter((h) => h.count > 0),
      heatmap,
      suggestions,
    };
  }

  // Açık saatlerin listesi. closeHour>24 ise gece yarısını geçer (ör. 26=02:00).
  private computeOpenHours(openHour: number, closeHour: number): number[] {
    const hours: number[] = [];
    const total = Math.max(1, Math.min(24, closeHour - openHour));
    for (let k = 0; k < total; k++) hours.push((openHour + k) % 24);
    return hours;
  }

  private async buildSuggestions(
    orders: any[],
    byHour: { rev: number; count: number }[],
    openHours: number[],
  ): Promise<Suggestion[]> {
    const out: Suggestion[] = [];

    // 1) Ölü saat → happy-hour önerisi (yalnız AÇIK saatler içinde en düşük ciro).
    const openSet = new Set(openHours);
    const active = byHour
      .map((h, i) => ({ i, rev: h.rev }))
      .filter((h) => openSet.has(h.i));
    if (active.length >= 3) {
      const avg = active.reduce((s, h) => s + h.rev, 0) / active.length;
      const dead = active.filter((h) => h.rev < avg * 0.5).sort((a, b) => a.rev - b.rev);
      if (dead.length) {
        const hrs = dead.slice(0, 3).map((h) => `${String(h.i).padStart(2, '0')}:00`).join(', ');
        out.push({
          severity: 'info',
          icon: '🕒',
          title: 'Ölü saatler tespit edildi',
          text: `${hrs} saatleri ortalamanın çok altında. Bu saatlere özel "happy hour" indirimi veya set menü ile yoğunluğu dengeleyebilirsiniz.`,
        });
      }
    }

    // 2) Menü mühendisliği (son 30 gün): Köpek ve Yıldız ürünler.
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      const profRes: any = await this.menu.profitability(fromStr);
      const prof: any[] = Array.isArray(profRes) ? profRes : profRes.rows || [];
      const dogs = prof.filter((r) => r.klass === 'DOG').sort((a, b) => a.marginPct - b.marginPct);
      const stars = prof.filter((r) => r.klass === 'STAR').sort((a, b) => b.qty - a.qty);
      if (dogs.length) {
        out.push({
          severity: 'warning',
          icon: '🐶',
          title: 'Zayıf ürünler (Köpek)',
          text: `${dogs.slice(0, 3).map((d) => d.name).join(', ')} hem az satıyor hem düşük marjlı. Menüden çıkarmayı, fiyatı/porsiyonu gözden geçirmeyi veya reçete maliyetini düşürmeyi değerlendirin.`,
        });
      }
      if (stars.length) {
        out.push({
          severity: 'success',
          icon: '⭐',
          title: 'Yıldız ürünler',
          text: `${stars.slice(0, 3).map((s) => s.name).join(', ')} hem çok satıyor hem kârlı. Menüde öne çıkarın, garsonlara önerdirin — cironun lokomotifi bunlar.`,
        });
      }
    } catch {
      /* menü verisi yoksa atla */
    }

    // 3) Kritik stok uyarısı.
    try {
      const low: any[] = await this.stock.alerts();
      if (low.length) {
        out.push({
          severity: 'warning',
          icon: '📦',
          title: 'Kritik stok',
          text: `${low.slice(0, 5).map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', ')} kritik seviyede. Reçeteli ürünler "tükendi" durumuna düşmeden tedarik planlayın.`,
        });
      }
    } catch {
      /* atla */
    }

    // 4) Anomali: bugünkü iptal/ikram, son 14 günün ortalamasının belirgin üstünde mi?
    try {
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const hist14 = new Date(dayStart);
      hist14.setDate(hist14.getDate() - 14);
      const logs = await this.prisma.auditLog.findMany({
        where: { createdAt: { gte: hist14 }, action: { in: ['IPTAL_ADISYON', 'IPTAL_KALEM', 'IKRAM'] } },
      });
      const todayCount = logs.filter((l) => l.createdAt >= dayStart).length;
      const histCount = logs.filter((l) => l.createdAt < dayStart).length;
      const avgPerDay = histCount / 14;
      if (todayCount >= 3 && todayCount > avgPerDay * 1.8 + 1) {
        out.push({
          severity: 'warning',
          icon: '⚠️',
          title: 'Olağandışı iptal/ikram',
          text: `Bugün ${todayCount} iptal/ikram işlemi var (14 günlük ort. ${avgPerDay.toFixed(1)}/gün). Denetim ekranından personel kırılımını inceleyin — kayıp/suistimal işareti olabilir.`,
        });
      }
    } catch {
      /* atla */
    }

    if (!out.length) {
      out.push({
        severity: 'info',
        icon: '📊',
        title: 'Yeterli veri birikiyor',
        text: 'Daha fazla satış geçmişi biriktikçe tahminler ve öneriler keskinleşecek. Şimdilik her şey normal görünüyor.',
      });
    }
    return out;
  }
}
