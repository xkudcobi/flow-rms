import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { useSocketEvent } from '../realtime/socket';

interface Toast {
  id: number;
  author: string;
  rating: number;
  text: string;
}

function chime(low: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    // Düşük puanlı yorum: uyarıcı alçak ton; yüksek: neşeli.
    o.frequency.value = low ? 440 : 784;
    g.gain.value = 0.07;
    o.start();
    setTimeout(() => (o.frequency.value = low ? 330 : 988), 150);
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 320);
  } catch {
    /* sessiz geç */
  }
}

// Yeni Google yorumu geldiğinde her ekranda beliren bildirim (sol alt).
export default function ReviewNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useSocketEvent('review:new', (p: any) => {
    const rating = Number(p?.rating) || 0;
    chime(rating <= 2);
    const t: Toast = {
      id: Date.now() + Math.random(),
      author: p?.author || 'Google',
      rating,
      text: p?.text || '',
    };
    setToasts((prev) => [t, ...prev].slice(0, 4));
    // 12 sn sonra otomatik kapan.
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 12000);
  });

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-5 z-[55] w-80 max-w-[calc(100vw-2.5rem)] space-y-2">
      {toasts.map((t) => {
        const low = t.rating <= 2;
        return (
          <div
            key={t.id}
            className={`rounded-lg border-l-4 bg-surface-card p-3 shadow-float ${low ? 'border-danger' : 'border-success'}`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Yeni Google Yorumu
              </span>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-faint hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{t.author}</span>
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={12} className={i <= t.rating ? 'fill-warning text-warning' : 'text-line'} />
                ))}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-muted">{t.text}</p>
            {low && (
              <p className="mt-1 text-[11px] font-medium text-danger">⚠️ Düşük puan — hızlı yanıt vermek iyi olur.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
