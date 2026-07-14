import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Printer, Trash2, Trophy } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Button, Field, Input, Select } from '../components/ui';
import { esc, printHTML } from '../utils/export';

interface Shift {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string | null;
  hours: number;
}
interface Perf {
  userId: string;
  userName: string;
  orders: number;
  revenue: number;
  tips: number;
  avgTicket: number;
}
interface User {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const BAR_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#1e40af'];

// Verilen tarihin haftasının Pazartesi'sini yerel olarak döndürür (YYYY-MM-DD).
function weekMonday(d: Date): string {
  const day = (d.getDay() + 6) % 7; // Pzt=0 … Paz=6
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return ymd(mon);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(str: string, n: number): string {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export default function PersonelPage() {
  const [tab, setTab] = useState<'vardiya' | 'performans'>('vardiya');
  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-ink">Personel</h1>
      <p className="mb-5 text-sm text-muted">Vardiya planlama ve garson performansı</p>

      <div data-tour="personel-tabs" className="mb-5 inline-flex rounded-lg border border-line bg-surface-card p-1">
        {(['vardiya', 'performans'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-brand text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t === 'vardiya' ? <CalendarDays size={15} /> : <Trophy size={15} />}
            {t === 'vardiya' ? 'Vardiya Planı' : 'Performans'}
          </button>
        ))}
      </div>

      {tab === 'vardiya' ? <VardiyaTab /> : <PerformansTab />}
    </div>
  );
}

function VardiyaTab() {
  const [weekStart, setWeekStart] = useState(() => weekMonday(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [addFor, setAddFor] = useState<string | null>(null); // gün (YYYY-MM-DD)
  const [error, setError] = useState('');

  function load() {
    api.get<Shift[]>(`/shifts?start=${weekStart}`).then(setShifts).catch((e) => setError(e.message));
  }
  useEffect(load, [weekStart]);
  useEffect(() => {
    api.get<User[]>('/users').then((u) => setUsers(u.filter((x) => x.active))).catch(() => undefined);
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const m: Record<string, Shift[]> = {};
    for (const s of shifts) {
      const key = ymd(new Date(s.date));
      (m[key] ||= []).push(s);
    }
    return m;
  }, [shifts]);

  const totalHours = shifts.reduce((s, x) => s + x.hours, 0);
  const weekEnd = addDays(weekStart, 6);
  const fmtRange = (a: string, b: string) => {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return `${da.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} – ${db.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}`;
  };

  async function remove(id: string) {
    await api.delete(`/shifts/${id}`);
    load();
  }

  // Panoya asmalık haftalık program: personel (satır) × 7 gün (sütun) + toplam saat.
  function printSchedule() {
    // Personel bazında grupla (o hafta vardiyası olan herkes).
    const staff = new Map<string, { name: string; total: number }>();
    for (const s of shifts) {
      const cur = staff.get(s.userId) || { name: s.userName, total: 0 };
      cur.total += s.hours;
      staff.set(s.userId, cur);
    }
    const staffList = [...staff.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));

    const dayHead = days
      .map((d, i) => {
        const dd = new Date(d + 'T00:00:00');
        return `<th>${GUNLER[i]}<br><span style="font-weight:400;color:#666">${dd.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span></th>`;
      })
      .join('');

    const bodyRows = staffList
      .map(([uid, info]) => {
        const cells = days
          .map((d) => {
            const list = (byDay[d] || []).filter((s) => s.userId === uid);
            if (list.length === 0) return `<td style="text-align:center;color:#bbb">—</td>`;
            return `<td>${list
              .map((s) => `${s.startTime}–${s.endTime}${s.note ? `<br><span style="color:#888;font-size:10px">${esc(s.note)}</span>` : ''}`)
              .join('<br>')}</td>`;
          })
          .join('');
        return `<tr><th style="text-align:left">${esc(info.name)}</th>${cells}<td class="right" style="font-weight:700">${info.total} s</td></tr>`;
      })
      .join('');

    const html = `
      <h1>Haftalık Vardiya Programı</h1>
      <div class="sub">${fmtRange(weekStart, weekEnd)} • Toplam ${totalHours} saat</div>
      <table>
        <thead><tr><th style="text-align:left">Personel</th>${dayHead}<th class="right">Toplam</th></tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="9" style="text-align:center;color:#999;padding:20px">Bu hafta vardiya yok.</td></tr>`}</tbody>
      </table>`;
    printHTML('Haftalık Vardiya Programı', html);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[180px] text-center text-sm font-semibold text-ink">
            {fmtRange(weekStart, weekEnd)}
          </div>
          <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart(weekMonday(new Date()))}>
            Bu Hafta
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted">
            Haftalık toplam: <span className="font-semibold text-ink">{totalHours} saat</span>
          </div>
          <Button variant="secondary" onClick={printSchedule} disabled={shifts.length === 0}>
            <Printer size={16} /> Programı Yazdır
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d, i) => {
          const list = byDay[d] || [];
          const isToday = d === ymd(new Date());
          return (
            <div
              key={d}
              className={`flex min-h-[140px] flex-col rounded-lg border bg-surface-card ${
                isToday ? 'border-brand/50' : 'border-line'
              }`}
            >
              <div className={`flex items-center justify-between border-b px-3 py-2 ${isToday ? 'border-brand/30' : 'border-line'}`}>
                <div>
                  <div className={`text-xs font-semibold uppercase ${isToday ? 'text-brand' : 'text-muted'}`}>{GUNLER[i]}</div>
                  <div className="text-[11px] text-faint">{new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</div>
                </div>
                <button onClick={() => setAddFor(d)} className="rounded p-1 text-brand hover:bg-brand-light" title="Vardiya ekle">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex-1 space-y-1.5 p-2">
                {list.map((s) => (
                  <div key={s.id} className="group rounded border border-line bg-surface-low px-2 py-1.5 text-xs">
                    <div className="flex items-start justify-between">
                      <span className="font-medium text-ink">{s.userName}</span>
                      <button onClick={() => remove(s.id)} className="text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="text-muted">
                      {s.startTime}–{s.endTime} <span className="text-faint">({s.hours}s)</span>
                    </div>
                    {s.note && <div className="mt-0.5 text-[11px] italic text-faint">{s.note}</div>}
                  </div>
                ))}
                {list.length === 0 && <div className="pt-4 text-center text-[11px] text-faint">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {addFor && (
        <ShiftForm
          date={addFor}
          users={users}
          onClose={() => setAddFor(null)}
          onSaved={() => {
            setAddFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ShiftForm({
  date,
  users,
  onClose,
  onSaved,
}: {
  date: string;
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    if (!userId) return;
    setBusy(true);
    setErr('');
    try {
      await api.post('/shifts', { userId, date, startTime, endTime, note: note || undefined });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }
  const dLabel = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' });
  return (
    <Modal
      open
      title={`Vardiya Ekle — ${dLabel}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>İptal</Button>
          <Button onClick={save} disabled={busy || !userId}>Kaydet</Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Field label="Personel">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Başlangıç">
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="Bitiş">
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Not (opsiyonel)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. açılış, kapanış…" />
      </Field>
    </Modal>
  );
}

function PerformansTab() {
  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Perf[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Perf[]>(`/shifts/performance?from=${from}&to=${to}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [from, to]);

  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalTips = rows.reduce((s, r) => s + r.tips, 0);
  const chartData = rows.map((r) => ({ name: r.userName, ciro: r.revenue }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Başlangıç">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Bitiş">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="ml-auto flex gap-6 text-sm">
          <div>
            <div className="text-xs uppercase text-muted">Toplam Ciro</div>
            <div className="font-display text-xl font-bold text-brand-dark">{tl(totalRev)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted">Adisyon</div>
            <div className="font-display text-xl font-bold text-ink">{totalOrders}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted">Toplam Bahşiş</div>
            <div className="font-display text-xl font-bold text-success">{tl(totalTips)}</div>
          </div>
        </div>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-card p-8 text-center text-faint">
          Bu aralıkta kapanmış adisyon yok.
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-lg border border-line bg-surface-card p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Ciro Sıralaması</div>
            <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 46)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(v) => (v as number).toLocaleString('tr-TR')} fontSize={12} />
                <YAxis type="category" dataKey="name" width={110} fontSize={12} />
                <Tooltip formatter={(v) => tl(v as number)} />
                <Bar dataKey="ciro" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Personel</th>
                  <th className="px-4 py-3 text-right">Adisyon</th>
                  <th className="px-4 py-3 text-right">Ciro</th>
                  <th className="px-4 py-3 text-right">Ort. Adisyon</th>
                  <th className="px-4 py-3 text-right">Bahşiş</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.userId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-muted">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{r.userName}</td>
                    <td className="px-4 py-3 text-right">{r.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{tl(r.revenue)}</td>
                    <td className="px-4 py-3 text-right text-muted">{tl(r.avgTicket)}</td>
                    <td className="px-4 py-3 text-right font-medium text-success">{r.tips > 0 ? tl(r.tips) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
