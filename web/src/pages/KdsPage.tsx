import { useCallback, useEffect, useState } from 'react';
import { Clock, Play, Check, CheckCheck, AlertTriangle, UtensilsCrossed } from 'lucide-react';
import { api } from '../api/client';
import { useSocketEvent } from '../realtime/socket';

interface KdsItem {
  id: string;
  nameSnapshot: string;
  quantity: number;
  note?: string | null;
  station: string;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  prepSeconds?: number | null;
  orderId: string;
  tableName: string | null;
  orderType: string;
}

const STATIONS = ['HEPSI', 'MUTFAK', 'IZGARA', 'BAR', 'TATLI'];
const DELAY_MIN = 15; // bu dakikayı geçince "gecikti"

const COLUMNS: {
  key: string;
  title: string;
  topBorder: string;
  next: { to: string; label: string; icon: typeof Play; btn: string };
}[] = [
  {
    key: 'YENI',
    title: 'Bekleyen',
    topBorder: 'border-t-faint',
    next: { to: 'HAZIRLANIYOR', label: 'Başla', icon: Play, btn: 'bg-brand text-white hover:bg-brand-dark' },
  },
  {
    key: 'HAZIRLANIYOR',
    title: 'Hazırlanıyor',
    topBorder: 'border-t-brand',
    next: { to: 'HAZIR', label: 'Hazır', icon: Check, btn: 'bg-success text-white hover:opacity-90' },
  },
  {
    key: 'HAZIR',
    title: 'Servise Hazır',
    topBorder: 'border-t-success',
    next: { to: 'SERVIS', label: 'Servis Et', icon: CheckCheck, btn: 'bg-ink text-white hover:bg-black' },
  },
];

function elapsedSec(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}
function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function dakika(sec: number) {
  const m = Math.round(sec / 60);
  return m < 1 ? '<1 dk' : `${m} dk`;
}

export default function KdsPage() {
  const [items, setItems] = useState<KdsItem[]>([]);
  const [station, setStation] = useState('HEPSI');
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    api.get<KdsItem[]>('/orders/kds/queue').then(setItems).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useSocketEvent('kds:update', load, [load]);
  // Canlı sayaçlar için her 5 sn'de bir tazele.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  async function advance(item: KdsItem, to: string) {
    setItems((prev) =>
      to === 'SERVIS'
        ? prev.filter((i) => i.id !== item.id)
        : prev.map((i) => (i.id === item.id ? { ...i, status: to } : i)),
    );
    try {
      await api.patch(`/orders/items/${item.id}`, { status: to });
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  const shown = station === 'HEPSI' ? items : items.filter((i) => i.station === station);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mutfak Ekranı</h1>
          <p className="text-sm text-muted">Siparişler aşamaya göre; süreler canlı</p>
        </div>
        <div className="flex gap-1">
          {STATIONS.map((s) => {
            const count = s === 'HEPSI' ? items.length : items.filter((i) => i.station === s).length;
            return (
              <button
                key={s}
                onClick={() => setStation(s)}
                className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                  station === s ? 'bg-brand text-white' : 'bg-surface-card text-muted hover:text-ink'
                }`}
              >
                {s === 'HEPSI' ? 'Hepsi' : s}
                {count > 0 && (
                  <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-xs">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      <div data-tour="kds-board" className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colItems = shown.filter((i) => i.status === col.key);
          return (
            <section
              key={col.key}
              className={`flex min-h-0 flex-col rounded-lg border border-line border-t-4 bg-surface ${col.topBorder}`}
            >
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                  {col.title}
                </h3>
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold text-ink">
                  {colItems.length}
                </span>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                {colItems.map((it) => (
                  <Card key={it.id} item={it} next={col.next} onAdvance={advance} />
                ))}
                {colItems.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center py-8 text-faint">
                    <UtensilsCrossed size={28} />
                    <span className="mt-2 text-sm">Boş</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  item: it,
  next,
  onAdvance,
}: {
  item: KdsItem;
  next: { to: string; label: string; icon: typeof Play; btn: string };
  onAdvance: (i: KdsItem, to: string) => void;
}) {
  const Icon = next.icon;
  // Bekleyen → oluşturulmadan bu yana; Hazırlanıyor → başlamadan bu yana (canlı sayaç).
  const timerSrc = it.status === 'HAZIRLANIYOR' ? it.startedAt : it.createdAt;
  const sec = timerSrc ? elapsedSec(timerSrc) : 0;
  const delayed = sec > DELAY_MIN * 60 && it.status !== 'HAZIR';

  return (
    <article
      className={`rounded-lg border bg-surface-card p-3 shadow-card transition-colors ${
        delayed ? 'border-l-4 border-l-danger border-y-line border-r-line' : 'border-line'
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <span className="rounded bg-ink px-1.5 py-0.5 text-xs font-bold text-white">
            {it.orderType === 'MASA' ? `Masa ${it.tableName}` : it.orderType}
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-wide text-faint">
            {it.station}
          </span>
        </div>
        {it.status === 'HAZIR' ? (
          it.prepSeconds != null && (
            <span className="tabular flex items-center gap-1 text-xs font-medium text-success">
              <Check size={13} /> {dakika(it.prepSeconds)}
            </span>
          )
        ) : (
          <span
            className={`tabular flex items-center gap-1 text-xs font-bold ${
              delayed ? 'text-danger' : it.status === 'HAZIRLANIYOR' ? 'text-brand' : 'text-muted'
            }`}
          >
            {delayed ? <AlertTriangle size={13} /> : <Clock size={13} />}
            {mmss(sec)}
          </span>
        )}
      </div>

      <div className="text-base font-semibold text-ink">
        {it.quantity} × {it.nameSnapshot}
      </div>
      {it.note && (
        <div className="mt-1 rounded bg-danger-light px-2 py-1 text-sm font-medium text-danger-fg">
          {it.note}
        </div>
      )}

      <button
        onClick={() => onAdvance(it, next.to)}
        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded py-2 text-sm font-semibold transition-colors ${next.btn}`}
      >
        <Icon size={16} /> {next.label}
      </button>
    </article>
  );
}
