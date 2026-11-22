import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Lightbulb, Check } from 'lucide-react';

interface Reco {
  id: string;
  title: string;
  body: string;
  severity: string;
  approvedAt?: string | null;
  seen?: boolean;
}

const sevStyle: Record<string, string> = {
  info: 'border-brand/30 bg-brand/5',
  warning: 'border-orange-300 bg-orange-50',
  danger: 'border-red-300 bg-red-50',
};

// Personelin kendisine hedefli, patron tarafından onaylanmış tavsiyeleri.
export default function TavsiyelerPage() {
  const [recos, setRecos] = useState<Reco[]>([]);
  const [error, setError] = useState('');

  function load() {
    api.get<Reco[]>('/staff-recos/mine').then(setRecos).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function markSeen(id: string) {
    try {
      await api.patch(`/staff-recos/${id}/seen`, {});
      setRecos((prev) => prev.map((r) => (r.id === id ? { ...r, seen: true } : r)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  const unseen = recos.filter((r) => !r.seen);

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Lightbulb className="text-brand" size={22} />
        <h1 className="font-display text-2xl font-bold text-ink">Tavsiyeler</h1>
      </div>
      <p className="mb-5 text-sm text-muted">
        Yönetimin sizin için onayladığı öneriler. {unseen.length > 0 && `${unseen.length} yeni.`}
      </p>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {recos.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-card p-8 text-center text-faint">
          Şu an size yönelik bir tavsiye yok.
        </div>
      ) : (
        <div className="space-y-3">
          {recos.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${sevStyle[r.severity] || sevStyle.info} ${
                r.seen ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{r.title}</div>
                  <p className="mt-1 text-sm text-ink/80">{r.body}</p>
                  {r.approvedAt && (
                    <div className="mt-2 text-xs text-faint">
                      {new Date(r.approvedAt).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
                {!r.seen && (
                  <button
                    onClick={() => markSeen(r.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-brand px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand/5"
                  >
                    <Check size={14} /> Okundu
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
