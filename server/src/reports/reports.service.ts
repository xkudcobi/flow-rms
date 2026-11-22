import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Verilen gün (yoksa bugün) için yerel gün başlangıç/bitiş aralığı.
function dayRange(dateStr?: string) {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function orderNet(order: {
  items: { unitPrice: number; quantity: number; status: string }[];
  discountType: string | null;
  discountValue: number;
}) {
  const itemsTotal = order.items
    .filter((i) => i.status !== 'IPTAL')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let disc = 0;
  if (order.discountType === 'YUZDE') disc = (itemsTotal * order.discountValue) / 100;
  else if (order.discountType === 'TUTAR') disc = order.discountValue;
  disc = Math.min(disc, itemsTotal);
  return { itemsTotal, discount: disc, net: itemsTotal - disc };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Günün tüm adisyonları (açık/kapalı/iptal) — masa + kalemler + ödemeler.
  // Hesap kapandıktan sonra da "hangi masada ne alındı" görünür.
  async dayOrders(dateStr?: string) {
    const { start, end } = dayRange(dateStr);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
      include: {
        table: true,
        items: { orderBy: { createdAt: 'asc' } },
        payments: true,
      },
    });

    return orders.map((o) => {
      const activeItems = o.items.filter((i) => i.status !== 'IPTAL');
      const itemsTotal = activeItems.reduce(
        (s, i) => s + i.unitPrice * i.quantity,
        0,
      );
      let disc = 0;
      if (o.discountType === 'YUZDE') disc = (itemsTotal * o.discountValue) / 100;
      else if (o.discountType === 'TUTAR') disc = o.discountValue;
      disc = Math.min(disc, itemsTotal);
      const paidTotal = o.payments.reduce((s, p) => s + p.amount, 0);
      return {
        id: o.id,
        type: o.type,
        status: o.status,
        tableName: o.table?.name ?? null,
        createdAt: o.createdAt,
        closedAt: o.closedAt,
        itemsTotal: round2(itemsTotal),
        discount: round2(disc),
        net: round2(itemsTotal - disc),
        paidTotal: round2(paidTotal),
        items: o.items.map((i) => ({
          name: i.nameSnapshot,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: round2(i.unitPrice * i.quantity),
          note: i.note,
          status: i.status,
        })),
        payments: o.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
        })),
      };
    });
  }

  // Dashboard: özet + saatlik yoğunluk + kategori + ortalama hazırlık + 7 günlük trend.
  async dashboard(dateStr?: string) {
    const summary = await this.daySummary(dateStr);
    const { start, end } = dayRange(dateStr);

    const closed = await this.prisma.order.findMany({
      where: { status: 'KAPANDI', closedAt: { gte: start, lt: end } },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    });

    const byHour = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      revenue: 0,
      count: 0,
    }));
    const catMap = new Map<string, { name: string; revenue: number; qty: number }>();
    let prepSum = 0;
    let prepCount = 0;

    for (const o of closed) {
      const { net } = orderNet(o);
      const h = o.closedAt ? new Date(o.closedAt).getHours() : 0;
      byHour[h].revenue = round2(byHour[h].revenue + net);
      byHour[h].count += 1;
      for (const it of o.items) {
        if (it.status === 'IPTAL') continue;
        const cat = it.product?.category?.name ?? 'Diğer';
        const cur = catMap.get(cat) ?? { name: cat, revenue: 0, qty: 0 };
        cur.revenue += it.unitPrice * it.quantity;
        cur.qty += it.quantity;
        catMap.set(cat, cur);
        if (it.prepSeconds != null) {
          prepSum += it.prepSeconds;
          prepCount += 1;
        }
      }
    }

    const byCategory = [...catMap.values()]
      .map((c) => ({ ...c, revenue: round2(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
    const avgPrepMin = prepCount
      ? Math.round((prepSum / prepCount / 60) * 10) / 10
      : null;

    // Son 7 gün ciro trendi (seçili gün dahil).
    const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const trend: { date: string; gross: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const s = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
      const e = new Date(s);
      e.setDate(e.getDate() + 1);
      const dayOrders = await this.prisma.order.findMany({
        where: { status: 'KAPANDI', closedAt: { gte: s, lt: e } },
        include: { items: true },
      });
      const g = dayOrders.reduce((sum, o) => sum + orderNet(o).net, 0);
      trend.push({
        date: `${String(s.getDate()).padStart(2, '0')}.${String(s.getMonth() + 1).padStart(2, '0')}`,
        gross: round2(g),
      });
    }

    return { ...summary, byHour, byCategory, avgPrepMin, trend };
  }

  // Gün sonu (Z benzeri) özet. date verilmezse bugün.
  async daySummary(dateStr?: string) {
    const { start, end } = dayRange(dateStr);

    const closed = await this.prisma.order.findMany({
      where: { status: 'KAPANDI', closedAt: { gte: start, lt: end } },
      include: { items: true, payments: true },
    });

    let gross = 0;
    let discountTotal = 0;
    const byMethod: Record<string, number> = {};
    const productMap = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();

    for (const o of closed) {
      const { discount, net } = orderNet(o);
      gross += net;
      discountTotal += discount;
      for (const p of o.payments) {
        byMethod[p.method] = round2((byMethod[p.method] || 0) + p.amount);
      }
      for (const it of o.items) {
        if (it.status === 'IPTAL') continue;
        const cur = productMap.get(it.nameSnapshot) || {
          name: it.nameSnapshot,
          qty: 0,
          revenue: 0,
        };
        cur.qty += it.quantity;
        cur.revenue += it.unitPrice * it.quantity;
        productMap.set(it.nameSnapshot, cur);
      }
    }

    const topProducts = [...productMap.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((p) => ({ ...p, revenue: round2(p.revenue) }));

    // Kasadan nakit hareketleri (gün içi)
    const movements = await this.prisma.cashMovement.findMany({
      where: { createdAt: { gte: start, lt: end } },
    });
    const cashOut = round2(
      movements.filter((m) => m.type === 'CIKIS').reduce((s, m) => s + m.amount, 0),
    );
    const cashIn = round2(
      movements.filter((m) => m.type === 'GIRIS').reduce((s, m) => s + m.amount, 0),
    );

    // Şu an açık adisyonlar (henüz kapanmamış ciro)
    const openOrders = await this.prisma.order.findMany({
      where: { status: 'ACIK' },
      include: { items: true },
    });
    const openTotal = round2(
      openOrders.reduce((s, o) => s + orderNet({ ...o }).net, 0),
    );

    // Yerel tarih etiketi (toISOString UTC'ye kaydırdığı için manuel biçimlendiriyoruz)
    const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

    return {
      date: localDate,
      orderCount: closed.length,
      gross: round2(gross),
      discountTotal: round2(discountTotal),
      byMethod,
      topProducts,
      openOrderCount: openOrders.length,
      openTotal,
      cashOut,
      cashIn,
    };
  }

  // İki tür maliyet raporu (tarih aralığı; yoksa bu ay başından bugüne):
  //  A) Saf: yalnız ürün satış geliri + mal/stok alışları.
  //  B) Toplam: + personel, temizlik, demirbaş, genel/diğer giderler.
  // Kaynaklar: kapanan adisyon (gelir), Purchase (kategori bazlı alış/gider),
  // CashMovement CIKIS (personel + nakit giderler). Alış zaten Purchase'ta
  // sayıldığı için nakit tarafında ALIS/TEDARIKCI_ODEME/PARA_USTU hariç tutulur.
  async costReport(fromStr?: string, toStr?: string) {
    const now = new Date();
    const start = fromStr
      ? new Date(fromStr + 'T00:00:00')
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endBase = toStr ? new Date(toStr + 'T00:00:00') : now;
    const end = new Date(
      endBase.getFullYear(),
      endBase.getMonth(),
      endBase.getDate(),
    );
    end.setDate(end.getDate() + 1); // bitiş günü dahil
    const range = { gte: start, lt: end };

    const [closed, purchases, movements] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'KAPANDI', closedAt: range },
        include: { items: true },
      }),
      this.prisma.purchase.findMany({ where: { invoiceDate: range } }),
      this.prisma.cashMovement.findMany({
        where: { type: 'CIKIS', createdAt: range },
      }),
    ]);

    const revenue = round2(closed.reduce((s, o) => s + orderNet(o).net, 0));

    // Alışlar kategoriye göre (grandTotal = KDV dahil gerçek maliyet).
    const byCat: Record<string, number> = {};
    for (const p of purchases) {
      const c = (p.category || 'DIGER').toUpperCase();
      byCat[c] = round2((byCat[c] || 0) + (p.grandTotal || 0));
    }
    const sumCat = (...cats: string[]) =>
      round2(cats.reduce((s, c) => s + (byCat[c] || 0), 0));
    const goods = sumCat('GIDA', 'ICECEK', 'AMBALAJ'); // satılan mal/stok
    const cleaning = sumCat('TEMIZLIK');
    const fixtures = sumCat('DEMIRBAS');
    const generalPurchase = sumCat('GENEL_GIDER', 'DIGER');

    // Nakit giderleri (personel + genel; alış/tedarikçi hariç → çift sayma yok).
    const cash: Record<string, number> = {};
    for (const m of movements) {
      const c = (m.category || 'DIGER').toUpperCase();
      cash[c] = round2((cash[c] || 0) + m.amount);
    }
    const personnel = round2(cash['PERSONEL'] || 0);
    const otherCash = round2((cash['GIDER'] || 0) + (cash['DIGER'] || 0));

    const reportA = {
      title: 'Ürün & Stok (saf)',
      revenue,
      stockCost: goods,
      gross: round2(revenue - goods),
    };

    const items = [
      { label: 'Mal / Stok Alışı', amount: goods },
      { label: 'Personel', amount: personnel },
      { label: 'Temizlik', amount: cleaning },
      { label: 'Demirbaş', amount: fixtures },
      { label: 'Genel Gider (alış)', amount: generalPurchase },
      { label: 'Diğer Nakit Gider', amount: otherCash },
    ].filter((x) => x.amount > 0);
    const totalCost = round2(items.reduce((s, x) => s + x.amount, 0));
    const reportB = {
      title: 'Toplam İşletme Maliyeti',
      revenue,
      items,
      totalCost,
      net: round2(revenue - totalCost),
    };

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const endLabel = new Date(end);
    endLabel.setDate(endLabel.getDate() - 1);
    return { from: fmt(start), to: fmt(endLabel), reportA, reportB };
  }
}
