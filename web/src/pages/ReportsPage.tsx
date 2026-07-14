import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import { api } from '../api/client';
import { downloadCSV, printHTML, esc } from '../utils/export';

interface Dashboard {
  date: string;
  orderCount: number;
  gross: number;
  discountTotal: number;
  byMethod: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  openOrderCount: number;
  openTotal: number;
  byHour: { hour: number; revenue: number; count: number }[];
  byCategory: { name: string; revenue: number; qty: number }[];
  avgPrepMin: number | null;
  trend: { date: string; gross: number }[];
  cashOut: number;
  cashIn: number;
}

const METHOD_LABEL: Record<string, string> = {
  NAKIT: 'Nakit',
  KREDI_KARTI: 'Kredi Kartı',
  YEMEK_KARTI: 'Yemek Kartı',
  ACIK_HESAP: 'Açık Hesap',
};
const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const tlShort = (n: number) =>
  n >= 1000 ? (n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + 'B' : String(n);
const today = () => new Date().toISOString().slice(0, 10);

// Erişilebilir, ayırt edilebilir kategorik palet (FLOW mavi öncelikli).
const PALETTE = ['#276EF1', '#05a357', '#f59e0b', '#7c3aed', '#0ea5e9', '#e11d48', '#14b8a6', '#64748b'];

export default function ReportsPage() {
  const [date, setDate] = useState(today());
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  function load(dt: string) {
    api
      .get<Dashboard>(`/reports/dashboard?date=${dt}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load(date);
  }, [date]);

  function exportCSV() {
    if (!d) return;
    const rows: (string | number)[][] = [
      ['ÖZET', ''],
      ['Ciro', d.gross],
      ['Adisyon Sayısı', d.orderCount],
      ['Ort. Hazırlık (dk)', d.avgPrepMin ?? '-'],
      ['Toplam İskonto', d.discountTotal],
      ['', ''],
      ['ÖDEME YÖNTEMLERİ', ''],
      ...Object.entries(d.byMethod).map(([m, a]) => [METHOD_LABEL[m] || m, a]),
      ['', ''],
      ['KATEGORİ', 'Ciro'],
      ...d.byCategory.map((c) => [c.name, c.revenue]),
      ['', ''],
      ['EN ÇOK SATANLAR', 'Adet / Ciro'],
      ...d.topProducts.map((p) => [p.name, `${p.qty} / ${p.revenue}`]),
    ];
    downloadCSV(`gun_sonu_${date}`, ['Kalem', 'Değer'], rows);
  }
  function exportPDF() {
    if (!d) return;
    const sec = (title: string, rows: string) =>
      `<h2>${title}</h2><table><tbody>${rows}</tbody></table>`;
    printHTML(
      `Gün Sonu — ${d.date}`,
      `<h1>Gün Sonu Raporu</h1><div class="sub">${d.date}</div>
       ${sec(
         'Özet',
         `<tr><td>Ciro</td><td class="right"><b>${tl(d.gross)}</b></td></tr>
          <tr><td>Adisyon</td><td class="right">${d.orderCount}</td></tr>
          <tr><td>Ort. Hazırlık</td><td class="right">${d.avgPrepMin ?? '-'} dk</td></tr>
          <tr><td>İskonto</td><td class="right">${tl(d.discountTotal)}</td></tr>`,
       )}
       ${sec('Ödeme Yöntemleri', Object.entries(d.byMethod).map(([m, a]) => `<tr><td>${METHOD_LABEL[m] || m}</td><td class="right">${tl(a)}</td></tr>`).join('') || '<tr><td>—</td></tr>')}
       ${sec('Kategori', d.byCategory.map((c) => `<tr><td>${esc(c.name)}</td><td class="right">${tl(c.revenue)}</td></tr>`).join('') || '<tr><td>—</td></tr>')}
       ${sec('En Çok Satanlar', d.topProducts.map((p, i) => `<tr><td>${i + 1}. ${esc(p.name)}</td><td class="right">${p.qty} adet · ${tl(p.revenue)}</td></tr>`).join('') || '<tr><td>—</td></tr>')}`,
    );
  }

  const methodData = d
    ? Object.entries(d.byMethod).map(([m, v]) => ({ name: METHOD_LABEL[m] || m, value: v }))
    : [];

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gün Sonu · Dashboard</h1>
          <p className="text-sm text-muted">Ciro, yoğunluk ve satış analizleri</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-line px-3 py-1.5 text-sm"
          />
          <button onClick={exportCSV} className="rounded bg-surface-high px-3 py-1.5 text-sm font-medium text-ink hover:bg-line">
            ⬇ CSV
          </button>
          <button onClick={exportPDF} className="rounded bg-surface-high px-3 py-1.5 text-sm font-medium text-ink hover:bg-line">
            🖨 PDF
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {d && (
        <>
          {/* KPI kartları */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Ciro (kapanan)" value={tl(d.gross)} accent />
            <Kpi label="Adisyon Sayısı" value={String(d.orderCount)} />
            <Kpi label="Ort. Hazırlık" value={d.avgPrepMin != null ? `${d.avgPrepMin} dk` : '—'} />
            <Kpi label="Kasadan Nakit Çıkış" value={tl(d.cashOut)} />
          </div>
          <p className="-mt-4 mb-6 text-xs text-muted">
            Açık adisyon: {d.openOrderCount} · {tl(d.openTotal)}
            {d.cashIn > 0 ? ` · Kasaya nakit giriş: ${tl(d.cashIn)}` : ''}
          </p>

          {/* Ciro trendi + saatlik yoğunluk */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Ciro Trendi (7 gün)">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={d.trend} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#276EF1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#276EF1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={tlShort} tick={{ fontSize: 12, fill: '#4c4546' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip formatter={(v: number) => [tl(v), 'Ciro']} />
                  <Area type="monotone" dataKey="gross" stroke="#276EF1" strokeWidth={2} fill="url(#gRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Saatlik Yoğunluk (ciro)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={d.byHour.filter((h) => h.hour >= 8 && h.hour <= 23)} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}`} tick={{ fontSize: 11, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={tlShort} tick={{ fontSize: 12, fill: '#4c4546' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip formatter={(v: number) => [tl(v), 'Ciro']} labelFormatter={(h) => `${h}:00`} />
                  <Bar dataKey="revenue" fill="#276EF1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Ödeme dağılımı + kategori + en çok satanlar */}
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Ödeme Dağılımı">
              {methodData.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {methodData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => tl(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <Legend items={methodData.map((m, i) => ({ label: m.name, color: PALETTE[i % PALETTE.length], value: tl(m.value) }))} />
            </ChartCard>

            <ChartCard title="Kategori Cirosu">
              {d.byCategory.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart layout="vertical" data={d.byCategory.slice(0, 6)} margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tickFormatter={tlShort} tick={{ fontSize: 11, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: '#1a1c1c' }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => [tl(v), 'Ciro']} />
                    <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
                      {d.byCategory.slice(0, 6).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="En Çok Satanlar (adet)">
              {d.topProducts.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart layout="vertical" data={d.topProducts.slice(0, 6)} margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#1a1c1c' }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number, _n, p: any) => [`${v} adet · ${tl(p.payload.revenue)}`, p.payload.name]} />
                    <Bar dataKey="qty" fill="#05a357" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-brand/20 bg-brand-light' : 'border-line bg-surface-card'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${accent ? 'text-brand-dark' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-faint">
      Veri yok
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; value: string }[] }) {
  return (
    <div className="mt-3 space-y-1">
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
            {it.label}
          </span>
          <span className="font-semibold text-ink">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
