import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';

interface Log {
  id: string;
  action: string;
  userName?: string | null;
  tableName?: string | null;
  amount: number;
  detail?: string | null;
  createdAt: string;
}
interface UserRow {
  userName: string;
  iptal: number;
  iptalAmount: number;
  iskonto: number;
  iskontoAmount: number;
  ikram: number;
  ikramAmount: number;
  total: number;
  count: number;
  flagged: boolean;
}
interface Summary {
  totals: {
    iptal: { count: number; amount: number };
    iskonto: { count: number; amount: number };
    ikram: { count: number; amount: number };
  };
  byUser: UserRow[];
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const today = () => new Date().toISOString().slice(0, 10);
const dtime = (s: string) =>
  new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const ACTION: Record<string, { label: string; cls: string }> = {
  IPTAL_ADISYON: { label: 'Adisyon İptal', cls: 'bg-danger-light text-danger-fg' },
  IPTAL_KALEM: { label: 'Kalem İptal', cls: 'bg-danger-light text-danger-fg' },
  ISKONTO: { label: 'İskonto', cls: 'bg-warning-light text-warning' },
  IKRAM: { label: 'İkram', cls: 'bg-brand-light text-brand' },
};

export default function DenetimPage() {
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState('');

  function load() {
    api.get<Summary>(`/audit/summary?date=${date}`).then(setSummary).catch((e) => setError(e.message));
    api.get<Log[]>(`/audit?date=${date}`).then(setLogs).catch(() => undefined);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const chart = summary
    ? summary.byUser.map((u) => ({ name: u.userName, total: u.total, flagged: u.flagged }))
    : [];

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Denetim</h1>
          <p className="text-sm text-muted">İptal, iskonto ve ikram takibi — kayıp önleme</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-line px-3 py-1.5 text-sm" />
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {summary && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="Adisyon/Kalem İptal" count={summary.totals.iptal.count} value={tl(summary.totals.iptal.amount)} tone="danger" />
            <Kpi label="İskonto" count={summary.totals.iskonto.count} value={tl(summary.totals.iskonto.amount)} tone="warning" />
            <Kpi label="İkram" count={summary.totals.ikram.count} value={tl(summary.totals.ikram.amount)} tone="brand" />
          </div>

          {/* Personel kırılımı */}
          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">Personel Bazında Toplam (₺)</h3>
              {chart.length === 0 ? (
                <div className="flex h-52 items-center justify-center text-faint">Kayıt yok</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chart} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4c4546' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#4c4546' }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(v: number) => [tl(v), 'Toplam']} />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#276EF1" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2.5">Personel</th>
                    <th className="px-3 py-2.5 text-right">İptal</th>
                    <th className="px-3 py-2.5 text-right">İskonto</th>
                    <th className="px-3 py-2.5 text-right">İkram</th>
                    <th className="px-3 py-2.5 text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byUser.map((u) => (
                    <tr key={u.userName} className={`border-b border-line last:border-0 ${u.flagged ? 'bg-danger-light/50' : ''}`}>
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {u.flagged && <AlertTriangle size={13} className="mr-1 inline text-danger" />}
                        {u.userName}
                      </td>
                      <td className="px-3 py-2.5 text-right">{u.iptal} · {tl(u.iptalAmount)}</td>
                      <td className="px-3 py-2.5 text-right">{u.iskonto} · {tl(u.iskontoAmount)}</td>
                      <td className="px-3 py-2.5 text-right">{u.ikram} · {tl(u.ikramAmount)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink">{tl(u.total)}</td>
                    </tr>
                  ))}
                  {summary.byUser.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-faint">Kayıt yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {summary.byUser.some((u) => u.flagged) && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-light px-4 py-2.5 text-sm text-danger-fg">
              <AlertTriangle size={16} /> ⚠ İşaretli personelin iptal/iskonto/ikram toplamı ortalamanın belirgin üzerinde — kontrol önerilir.
            </div>
          )}

          {/* Log listesi */}
          <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
            <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">İşlem Kayıtları</div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 text-xs text-faint">{dtime(l.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ACTION[l.action]?.cls || ''}`}>
                          {ACTION[l.action]?.label || l.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink">{l.userName || '—'}</td>
                      <td className="px-4 py-2.5 text-muted">{l.tableName ? `Masa ${l.tableName}` : '—'}</td>
                      <td className="px-4 py-2.5 text-muted">{l.detail || ''}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink">{tl(l.amount)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-faint">Bu tarihte kayıt yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, count, value, tone }: { label: string; count: number; value: string; tone: 'danger' | 'warning' | 'brand' }) {
  const tones = {
    danger: 'border-danger/20 bg-danger-light',
    warning: 'border-warning/20 bg-warning-light',
    brand: 'border-brand/20 bg-brand-light',
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-muted">{count} işlem</div>
    </div>
  );
}
