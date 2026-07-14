import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Star } from 'lucide-react';
import { useSocketEvent } from '../realtime/socket';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { api } from '../api/client';

interface FeedbackItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}
interface FeedbackData {
  count: number;
  avg: number;
  distribution: { rating: number; count: number }[];
  items: FeedbackItem[];
}

const dt = (s: string) => new Date(s).toLocaleString('tr-TR');
const RATING_COLORS: Record<number, string> = {
  1: '#ba1a1a',
  2: '#e11d48',
  3: '#f59e0b',
  4: '#84cc16',
  5: '#05a357',
};

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= n ? 'fill-warning text-warning' : 'text-line'}
        />
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const [d, setD] = useState<FeedbackData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<FeedbackData>('/feedback').then(setD).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-ink">Geri Bildirimler</h1>
      <p className="mb-5 text-sm text-muted">
        QR üzerinden müşteri değerlendirmeleri
      </p>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {d && (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-brand/20 bg-brand-light p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                Ortalama Puan
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-display text-3xl font-bold text-brand-dark">
                  {d.avg || '—'}
                </span>
                <Stars n={Math.round(d.avg)} />
              </div>
              <div className="mt-1 text-xs text-muted">{d.count} değerlendirme</div>
            </div>
            <div className="rounded-lg border border-line bg-surface-card p-5 lg:col-span-2">
              <div className="mb-2 text-sm font-semibold text-ink">
                Puan Dağılımı
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  layout="vertical"
                  data={[...d.distribution].reverse()}
                  margin={{ left: -20 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="rating"
                    tickFormatter={(r) => `${r}★`}
                    tick={{ fontSize: 12, fill: '#4c4546' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip formatter={(v: number) => [`${v} adet`, 'Sayı']} />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {[...d.distribution].reverse().map((x) => (
                      <Cell key={x.rating} fill={RATING_COLORS[x.rating]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-card">
            <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Yorumlar
            </div>
            {d.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-faint">
                Henüz geri bildirim yok.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {d.items.map((f) => (
                  <div key={f.id} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <Stars n={f.rating} />
                      {f.comment && (
                        <p className="mt-1 text-sm text-ink">{f.comment}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-faint">
                      {dt(f.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <GoogleReviews />
    </div>
  );
}

interface GReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  time: string;
  relativeTime?: string | null;
}
interface ReviewsData {
  enabled: boolean;
  provider: string;
  simulation: boolean;
  pollMinutes: number;
  rating: number | null;
  total: number | null;
  syncedAt: string | null;
  unseen: number;
  distribution: { rating: number; count: number }[];
  reviews: GReview[];
}

function GoogleReviews() {
  const [d, setD] = useState<ReviewsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [sumBusy, setSumBusy] = useState(false);
  const [sumErr, setSumErr] = useState('');

  const load = useCallback(() => {
    api.get<ReviewsData>('/reviews').then(setD).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    // Ekran açılınca "görüldü" işaretle (bildirim rozetini sıfırlar).
    api.post('/reviews/seen', {}).catch(() => undefined);
  }, [load]);
  // Yeni yorum bildirimi gelince listeyi tazele.
  useSocketEvent('review:new', () => setTimeout(load, 600), [load]);

  async function sync() {
    setBusy(true);
    try {
      await api.post('/reviews/sync', {});
      load();
    } finally {
      setBusy(false);
    }
  }

  async function aiSummary() {
    setSumBusy(true);
    setSumErr('');
    setSummary('');
    try {
      const r = await api.get<{ enabled: boolean; answer?: string; reason?: string }>('/insights/ai/review-summary');
      if (!r.enabled) setSumErr(r.reason || 'Yapay zeka asistanı bağlı değil.');
      else setSummary(r.answer || '(boş yanıt)');
    } catch (e: any) {
      setSumErr(e.message);
    } finally {
      setSumBusy(false);
    }
  }

  if (!d) return null;

  const distMax = Math.max(1, ...d.distribution.map((x) => x.count));

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">Google Yorumları</h2>
          <p className="text-sm text-muted">
            {d.enabled
              ? `Otomatik güncelleniyor (her ${d.pollMinutes} dk)${d.simulation ? ' • SİMÜLASYON modu' : ''}`
              : 'Kapalı — bağlamak için ayar gerekli'}
          </p>
        </div>
        {d.enabled && (
          <button
            onClick={sync}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-card px-3 py-1.5 text-sm text-ink hover:bg-surface-low disabled:opacity-50"
          >
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Yenile
          </button>
        )}
      </div>

      {!d.enabled ? (
        <div className="rounded-lg border border-line bg-surface-card p-5 text-sm text-muted">
          <p className="mb-1 font-medium text-ink">Google yorumları bağlı değil (opsiyonel)</p>
          <p>
            Bağlamak için sunucuda <code className="rounded bg-surface-high px-1">REVIEWS_PROVIDER=google</code> yapın ve
            Google Places API anahtarı + Place ID girin. Test için <code className="rounded bg-surface-high px-1">simulation</code> modunu kullanabilirsiniz.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface-card p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Google Puanı</div>
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-bold text-ink">{d.rating ?? '—'}</span>
                {d.rating != null && <Stars n={Math.round(d.rating)} />}
              </div>
            </div>
            <div className="border-l border-line pl-4">
              <div className="text-xs uppercase tracking-wide text-muted">Toplam Yorum</div>
              <div className="font-display text-2xl font-bold text-ink">{d.total ?? '—'}</div>
            </div>
            {d.syncedAt && (
              <div className="ml-auto text-xs text-faint">
                Son güncelleme: {new Date(d.syncedAt).toLocaleString('tr-TR')}
              </div>
            )}
          </div>

          {/* Puan dağılımı (Google yorumlarının yıldızları) */}
          <div className="mb-4 rounded-lg border border-line bg-surface-card p-4">
            <div className="mb-2 text-sm font-semibold text-ink">Google Puan Dağılımı</div>
            <div className="space-y-1.5">
              {[...d.distribution].reverse().map((x) => (
                <div key={x.rating} className="flex items-center gap-2">
                  <span className="flex w-10 items-center gap-0.5 text-xs text-muted">
                    {x.rating}
                    <Star size={11} className="fill-warning text-warning" />
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-surface-low">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(x.count / distMax) * 100}%`, background: RATING_COLORS[x.rating], minWidth: x.count ? 6 : 0 }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-ink">{x.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI özet */}
          <div data-tour="ai-summary" className="mb-4 rounded-lg border border-brand/30 bg-brand-light p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles size={16} className="text-brand" /> Yapay Zeka Özeti
              </div>
              <button
                onClick={aiSummary}
                disabled={sumBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {sumBusy ? 'Analiz ediliyor…' : 'Yorumları Özetle'}
              </button>
            </div>
            {sumErr && <p className="text-sm text-danger">{sumErr}</p>}
            {summary ? (
              <p className="whitespace-pre-wrap text-sm text-ink">{summary}</p>
            ) : (
              !sumErr && !sumBusy && (
                <p className="text-xs text-muted">
                  Google yorumları ve QR geri bildirimlerini AI ile analiz eder: memnuniyetler, şikayetler ve iyileştirme önerileri.
                </p>
              )
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface-card">
            {d.reviews.length === 0 ? (
              <p className="px-4 py-8 text-center text-faint">Henüz yorum çekilmedi.</p>
            ) : (
              <div className="divide-y divide-line">
                {d.reviews.map((r) => {
                  const low = r.rating <= 2;
                  return (
                    <div key={r.id} className={`px-4 py-3 ${low ? 'bg-danger/5' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{r.author}</span>
                          <Stars n={r.rating} />
                          {low && (
                            <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                              DÜŞÜK PUAN
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-faint">
                          {r.relativeTime || new Date(r.time).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      {r.text && <p className="mt-1 text-sm text-ink">{r.text}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
