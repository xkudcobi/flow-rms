import { useCallback, useEffect, useState } from 'react';
import { Bell, ReceiptText, Check } from 'lucide-react';
import { api } from '../api/client';
import { useSocketEvent } from '../realtime/socket';

interface Call {
  id: string;
  type: string;
  createdAt: string;
  table: { id: string; name: string } | null;
}

function beep() {
  try {
    const Ctx =
      window.AudioContext || (window as unknown as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.start();
    setTimeout(() => (o.frequency.value = 1174), 140);
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 300);
  } catch {
    /* ses desteklenmiyorsa sessiz geç */
  }
}

const hhmm = (s: string) =>
  new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

// Her personel ekranında görünen canlı çağrı bildirimleri (garson/hesap).
export default function CallsPanel() {
  const [calls, setCalls] = useState<Call[]>([]);

  const load = useCallback(() => {
    api.get<Call[]>('/calls/active').then(setCalls).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent(
    'waiter:call',
    () => {
      beep();
      load();
    },
    [load],
  );
  useSocketEvent('calls:update', load, [load]);

  async function handle(id: string) {
    setCalls((prev) => prev.filter((c) => c.id !== id)); // iyimser
    try {
      await api.patch(`/calls/${id}/handled`, {});
    } catch {
      load();
    }
  }

  if (calls.length === 0) return null;

  return (
    // Mobilde top-16: sabit üst bar (h-14) burada duruyor, top-4 olsaydı
    // çağrı kartları hamburger menünün üstünü kapatırdı.
    <div className="fixed right-4 top-16 z-[60] w-72 max-w-[calc(100vw-2rem)] space-y-2 md:top-4">
      {calls.map((c) => {
        const isBill = c.type === 'HESAP';
        return (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border-l-4 border-brand bg-surface-card p-3 shadow-float"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isBill ? 'bg-warning-light text-warning' : 'bg-brand-light text-brand'}`}
            >
              {isBill ? <ReceiptText size={18} /> : <Bell size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">
                Masa {c.table?.name ?? '?'}
              </div>
              <div className="text-xs text-muted">
                {isBill ? 'Hesap istiyor' : 'Garson çağırıyor'} · {hhmm(c.createdAt)}
              </div>
            </div>
            <button
              onClick={() => handle(c.id)}
              className="flex items-center gap-1 rounded bg-brand px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              <Check size={14} /> Tamam
            </button>
          </div>
        );
      })}
    </div>
  );
}
