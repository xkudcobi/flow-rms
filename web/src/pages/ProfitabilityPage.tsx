import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { api } from '../api/client';

interface Row {
  id: string;
  name: string;
  category: string | null;
  active: boolean;
  hasRecipe: boolean;
  price: number;
  cost: number;
  profit: number;
  marginPct: number;
  foodCostPct: number;
  qty: number;
  revenue: number;
  klass: string | null;
}
interface Data {
  rows: Row[];
  avgQty: number;
  avgMargin: number;
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const KLASS: Record<string, { label: string; color: string; desc: string }> = {
  STAR: { label: 'Yıldız', color: '#05a357', desc: 'Popüler + kârlı → koru/öne çıkar' },
  PUZZLE: { label: 'Bulmaca', color: '#276EF1', desc: 'Kârlı ama az satan → tanıt' },
  PLOW: { label: 'Beygir', color: '#f59e0b', desc: 'Popüler ama az kârlı → maliyet/fiyat gözden geçir' },
  DOG: { label: 'Köpek', color: '#ba1a1a', desc: 'Az satan + az kârlı → menüden çıkarmayı düşün' },
};

function foodCostColor(pct: number, hasRecipe: boolean) {
  if (!hasRecipe) return 'text-faint';
  if (pct <= 30) return 'text-success font-semibold';
  if (pct <= 40) return 'text-warning font-semibold';
  return 'text-danger font-semibold';
}

export default function ProfitabilityPage() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');

  function load() {
    api
      .get<Data>(`/menu/profitability?from=${from}&to=${to}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function toggle86(r: Row) {
    try {
      await api.patch(`/menu/products/${r.id}`, { active: !r.active });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const sold = d ? d.rows.filter((r) => r.qty > 0) : [];
  const scatter = sold.map((r) => ({
    x: r.qty,
    y: r.marginPct,
    z: r.revenue,
    name: r.name,
    color: r.klass ? KLASS[r.klass].color : '#64748b',
  }));
  const counts = (k: string) => sold.filter((r) => r.klass === k).length;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Kârlılık & Menü Mühendisliği</h1>
          <p className="text-sm text-muted">
            Reçete maliyetinden ürün marjı ve popülerlik analizi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-line px-2 py-1.5 text-sm" />
          <span className="text-muted">—</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-line px-2 py-1.5 text-sm" />
        </div>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {d && (
        <>
          {/* Sınıf sayaçları */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Object.entries(KLASS).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-surface-card p-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: v.color }} />
                  <span className="text-sm font-semibold text-ink">{v.label}</span>
                  <span className="ml-auto font-display text-xl font-bold text-ink">{counts(k)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted">{v.desc}</p>
              </div>
            ))}
          </div>

          {/* Menü mühendisliği grafiği */}
          <div className="mb-5 rounded-lg border border-line bg-surface-card p-4">
            <h3 className="mb-1 text-sm font-semibold text-ink">Menü Mühendisliği Matrisi</h3>
            <p className="mb-3 text-xs text-muted">
              Yatay: satış adedi (popülerlik) · Dikey: kâr marjı % · Çizgiler ortalamalar
            </p>
            {scatter.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-faint">Bu aralıkta satış yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" dataKey="x" name="Adet" tick={{ fontSize: 12, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="y" name="Marj %" unit="%" tick={{ fontSize: 12, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} />
                  <ReferenceLine x={d.avgQty} stroke="#cfc4c5" strokeDasharray="4 4" />
                  <ReferenceLine y={d.avgMargin} stroke="#cfc4c5" strokeDasharray="4 4" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v: number, n: string) => [n === 'Marj %' ? `%${v}` : v, n]}
                    labelFormatter={() => ''}
                    content={({ payload }) => {
                      const p: any = payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div className="rounded border border-line bg-surface-card px-2 py-1 text-xs shadow-float">
                          <div className="font-semibold text-ink">{p.name}</div>
                          <div className="text-muted">{p.x} adet · %{p.y} marj</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatter}>
                    {scatter.map((p, i) => (
                      <Cell key={i} fill={p.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tablo */}
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-card">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Ürün</th>
                  <th className="px-4 py-3 text-right">Fiyat</th>
                  <th className="px-4 py-3 text-right">Maliyet</th>
                  <th className="px-4 py-3 text-right">Marj</th>
                  <th className="px-4 py-3 text-right">Food Cost</th>
                  <th className="px-4 py-3 text-right">Satış</th>
                  <th className="px-4 py-3">Sınıf</th>
                  <th className="px-4 py-3 text-right">Durum</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className={`border-b border-line last:border-0 ${!r.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{r.name}</div>
                      {r.category && <div className="text-[11px] text-faint">{r.category}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{tl(r.price)}</td>
                    <td className="px-4 py-2.5 text-right text-muted">
                      {r.hasRecipe ? tl(r.cost) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.hasRecipe ? `%${r.marginPct}` : '—'}</td>
                    <td className={`px-4 py-2.5 text-right ${foodCostColor(r.foodCostPct, r.hasRecipe)}`}>
                      {r.hasRecipe ? `%${r.foodCostPct}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.qty}</td>
                    <td className="px-4 py-2.5">
                      {r.klass ? (
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: KLASS[r.klass].color }}>
                          {KLASS[r.klass].label}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => toggle86(r)}
                        className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${r.active ? 'text-danger hover:bg-danger-light' : 'bg-success-light text-success'}`}
                        title={r.active ? 'Malzemesi bitti — satışa kapat (86)' : 'Satışa tekrar aç'}
                      >
                        {r.active ? 'Satışa Kapat' : 'Satışa Aç'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-faint">
            "Satışa Kapat" (mutfak argosunda "86"): malzemesi biten ürünü anında satışa kapatır — adisyon ekranında ve QR menüde görünmez olur; gelince "Satışa Aç" ile geri açılır. Maliyet reçeteden gelir; reçetesi olmayan ürünlerde "—".
          </p>
        </>
      )}
    </div>
  );
}
