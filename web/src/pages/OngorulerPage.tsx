import { useEffect, useRef, useState } from 'react';
import { Bot, RefreshCw, Send, Sparkles, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { Button } from '../components/ui';

interface Suggestion {
  severity: 'info' | 'warning' | 'success';
  icon: string;
  title: string;
  text: string;
}
interface Forecast {
  date: string;
  label: string;
  forecast: number;
}
interface HeatRow {
  day: number;
  label: string;
  hours: { hour: number; value: number }[];
}
interface Overview {
  orderCount: number;
  totalRev: number;
  avgPerDay: number;
  bestWeekday: string | null;
  forecast: Forecast[];
  heatmap: HeatRow[];
  suggestions: Suggestion[];
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const SEV: Record<string, string> = {
  info: 'border-brand/30 bg-brand-light',
  warning: 'border-amber-300 bg-amber-50',
  success: 'border-emerald-300 bg-emerald-50',
};

export default function OngorulerPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Overview>('/insights').then(setOv).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles className="text-brand" size={22} />
        <div>
          <h1 className="text-2xl font-bold text-ink">Öngörüler & Asistan</h1>
          <p className="text-sm text-muted">Local analitik motoru — tahmin, öneri, doğal dil sorgu (ücretsiz)</p>
        </div>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}
      {!ov ? (
        <p className="text-muted">Yükleniyor…</p>
      ) : (
        <div className="space-y-6">
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Son 8 Hafta Ciro" value={tl(ov.totalRev)} />
            <Kpi label="Günlük Ortalama" value={tl(ov.avgPerDay)} />
            <Kpi label="Adisyon" value={String(ov.orderCount)} />
            <Kpi label="En Yoğun Gün" value={ov.bestWeekday || '—'} />
          </div>

          {/* Öneriler */}
          <div data-tour="insights-suggestions">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Akıllı Öneriler</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {ov.suggestions.map((s, i) => (
                <div key={i} className={`rounded-lg border p-4 ${SEV[s.severity]}`}>
                  <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
                    <span className="text-lg">{s.icon}</span> {s.title}
                  </div>
                  <p className="text-sm text-ink/80">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tahmin */}
          <div className="rounded-lg border border-line bg-surface-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <TrendingUp size={15} /> Önümüzdeki 7 Gün Ciro Tahmini
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={ov.forecast} margin={{ left: 10, right: 20 }}>
                <defs>
                  <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => (v as number).toLocaleString('tr-TR')} />
                <Tooltip formatter={(v) => tl(v as number)} labelFormatter={(l) => `${l}`} />
                <Area type="monotone" dataKey="forecast" stroke="#2563eb" strokeWidth={2} fill="url(#fc)" name="Tahmin" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-1 text-xs text-faint">Haftanın günü ortalamasına göre (son 8 hafta). Veri arttıkça keskinleşir.</p>
          </div>

          {/* Isı haritası */}
          <Heatmap rows={ov.heatmap} />

          {/* AI Asistan */}
          <div data-tour="ai-support">
            <Assistant />
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-xl font-bold text-ink">{value}</div>
    </div>
  );
}

function Heatmap({ rows }: { rows: HeatRow[] }) {
  const hours = rows[0]?.hours.map((h) => h.hour) || [];
  const max = Math.max(1, ...rows.flatMap((r) => r.hours.map((h) => h.value)));
  const cell = (v: number) => {
    if (v <= 0) return 'rgba(37,99,235,0.04)';
    const a = 0.12 + (v / max) * 0.78;
    return `rgba(37,99,235,${a.toFixed(2)})`;
  };
  return (
    <div className="rounded-lg border border-line bg-surface-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Yoğunluk Isı Haritası (gün × saat)</h2>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th></th>
              {hours.map((h) => (
                <th key={h} className="px-1 text-[10px] font-normal text-faint">{String(h).padStart(2, '0')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td className="pr-2 text-right text-xs font-medium text-muted">{r.label}</td>
                {r.hours.map((h) => (
                  <td key={h.hour}>
                    <div
                      title={`${r.label} ${String(h.hour).padStart(2, '0')}:00 — ${tl(h.value)}`}
                      className="h-6 w-6 rounded"
                      style={{ background: cell(h.value) }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-faint">Koyu = yüksek ciro. Ölü saatleri ve yoğun saatleri planlamak için kullanın.</p>
    </div>
  );
}

interface Msg {
  role: 'user' | 'ai';
  text: string;
}
function Assistant() {
  const [status, setStatus] = useState<{ enabled: boolean; reason?: string; model?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  function checkStatus() {
    setChecking(true);
    api
      .get<{ enabled: boolean; reason?: string; model?: string }>('/insights/ai/status')
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, reason: 'Durum alınamadı' }))
      .finally(() => setChecking(false));
  }
  useEffect(checkStatus, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setQ('');
    setBusy(true);
    try {
      const r = await api.post<{ answer: string }>('/insights/ai/ask', { question });
      setMsgs((m) => [...m, { role: 'ai', text: r.answer || '(boş yanıt)' }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'ai', text: '⚠️ ' + e.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-brand/30 bg-surface-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Bot size={20} className="text-brand" /> Yapay Zeka Desteği
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              status?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${status?.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {status?.enabled ? 'Bağlı' : 'Bağlı değil'}
          </span>
          <button
            onClick={checkStatus}
            disabled={checking}
            title="Bağlantıyı yeniden dene"
            className="rounded-lg border border-line px-2 py-1 text-muted hover:bg-surface-low disabled:opacity-50"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {status && !status.enabled ? (
        <div className="rounded-lg bg-surface-low p-4 text-sm text-muted">
          <p className="mb-1 font-medium text-ink">Asistan henüz bağlı değil (opsiyonel özellik)</p>
          <p>{status.reason}</p>
          <div className="mt-3 rounded-lg border border-line bg-surface-card p-3 text-xs text-ink/80">
            <p className="mb-1 font-semibold text-ink">Ücretsiz &amp; local kurulum (3 adım):</p>
            <ol className="ml-4 list-decimal space-y-0.5">
              <li><a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-brand underline">ollama.com</a> → Windows için indir ve kur</li>
              <li>Terminalde: <code className="rounded bg-surface-high px-1">ollama pull llama3.2</code></li>
              <li>Yukarıdaki <RefreshCw size={11} className="inline" /> "yeniden dene" butonuna bas — kutu otomatik açılır</li>
            </ol>
            <p className="mt-2 text-faint">Not: Öngörüler ve öneriler AI olmadan da çalışıyor. AI yalnızca sohbet içindir; tamamen kendi bilgisayarında, veri dışarı çıkmaz.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-faint">
            {status?.model && `Model: ${status.model} • `}İşletme verinizle konuşur. Örn: "bu ay en çok ne sattık?", "yarın ciro tahmini ne?"
          </div>
          <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface-low p-3">
            {msgs.length === 0 && <p className="text-center text-xs text-faint">Bir soru sorun…</p>}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-brand text-white' : 'border border-line bg-surface-card text-ink'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-faint">Asistan düşünüyor…</div>}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="Sorunuzu yazın…"
              className="flex-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <Button onClick={ask} disabled={busy || !q.trim()}><Send size={16} /></Button>
          </div>
        </>
      )}
    </div>
  );
}
