import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Check, RefreshCw, Send, X } from 'lucide-react';
import { api } from '../api/client';

// Rota → asistanın "sayfa" anahtarı (backend işlem kataloğu bununla eşleşir).
function pageKey(pathname: string): { key: string; label: string } {
  if (pathname.startsWith('/salon')) return { key: 'salon', label: 'Salon Planı' };
  if (pathname.startsWith('/mutfak')) return { key: 'mutfak', label: 'Mutfak (KDS)' };
  if (pathname.startsWith('/adisyon')) return { key: 'adisyon', label: 'Adisyon' };
  if (pathname.startsWith('/menu')) return { key: 'menu', label: 'Menü' };
  if (pathname.startsWith('/stok')) return { key: 'stok', label: 'Stok' };
  if (pathname.startsWith('/karlilik')) return { key: 'karlilik', label: 'Kârlılık' };
  if (pathname.startsWith('/musteriler')) return { key: 'musteriler', label: 'Müşteriler' };
  if (pathname.startsWith('/personel')) return { key: 'personel', label: 'Personel' };
  if (pathname.startsWith('/kasa')) return { key: 'kasa', label: 'Kasa' };
  if (pathname.startsWith('/raporlar')) return { key: 'raporlar', label: 'Gün Sonu' };
  if (pathname.startsWith('/ongoruler')) return { key: 'ongoruler', label: 'Öngörüler' };
  return { key: 'genel', label: 'Genel' };
}

interface ActionMsg {
  actionId: string;
  params: Record<string, any>;
  summary: string;
  status: 'pending' | 'done' | 'cancelled';
  result?: string;
}
interface Msg {
  role: 'user' | 'ai';
  text?: string;
  action?: ActionMsg;
}

export default function AiDock() {
  const { pathname } = useLocation();
  const page = pageKey(pathname);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ enabled: boolean; reason?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  function checkStatus() {
    setChecking(true);
    api
      .get<{ enabled: boolean; reason?: string }>('/insights/ai/status')
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, reason: 'Durum alınamadı' }))
      .finally(() => setChecking(false));
  }
  useEffect(() => { if (open && !status) checkStatus(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setQ('');
    setBusy(true);
    try {
      const r = await api.post<any>('/insights/ai/ask', { question, page: page.key });
      if (r?.type === 'action') {
        setMsgs((m) => [...m, { role: 'ai', action: { actionId: r.actionId, params: r.params, summary: r.summary, status: 'pending' } }]);
      } else {
        setMsgs((m) => [...m, { role: 'ai', text: r?.answer || '(boş yanıt)' }]);
      }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'ai', text: '⚠️ ' + e.message }]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(idx: number) {
    const msg = msgs[idx];
    if (!msg?.action) return;
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>('/insights/ai/act', {
        actionId: msg.action.actionId,
        params: msg.action.params,
      });
      setMsgs((m) => m.map((x, i) => (i === idx && x.action ? { ...x, action: { ...x.action, status: 'done', result: res.message } } : x)));
      // Sayfaların (ör. Salon) yeni veriyi çekmesi için sinyal.
      window.dispatchEvent(new Event('flow:refresh'));
    } catch (e: any) {
      setMsgs((m) => m.map((x, i) => (i === idx && x.action ? { ...x, action: { ...x.action, status: 'done', result: '⚠️ ' + e.message } } : x)));
    } finally {
      setBusy(false);
    }
  }
  function cancelAction(idx: number) {
    setMsgs((m) => m.map((x, i) => (i === idx && x.action ? { ...x, action: { ...x.action, status: 'cancelled' } } : x)));
  }

  return (
    <>
      {/* Yüzen buton — sol alt */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Yapay Zeka Asistanı"
        data-tour="ai-assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition hover:scale-105 hover:bg-brand-dark"
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[520px] w-[370px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl">
          {/* Başlık */}
          <div className="flex items-center justify-between border-b border-line bg-surface-low px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-brand" />
              <div>
                <div className="text-sm font-bold text-ink">FLOW Asistan</div>
                <div className="text-[11px] text-faint">{page.label} ekranı</div>
              </div>
            </div>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status?.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {status?.enabled ? 'Bağlı' : 'Kapalı'}
            </span>
          </div>

          {/* Mesajlar */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {status && !status.enabled ? (
              <div className="rounded-lg bg-surface-low p-3 text-xs text-muted">
                <p className="mb-1 font-medium text-ink">Asistan bağlı değil</p>
                <p>{status.reason}</p>
                <button onClick={checkStatus} disabled={checking} className="mt-2 inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-brand hover:bg-surface-card">
                  <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> Yeniden dene
                </button>
              </div>
            ) : (
              <>
                {msgs.length === 0 && (
                  <div className="mt-6 text-center text-xs text-faint">
                    <Bot size={28} className="mx-auto mb-2 text-line" />
                    Bu ekranla ilgili soru sorun veya işlem isteyin.
                    <div className="mt-2 text-[11px]">
                      {page.key === 'salon' && '"bahçeye 2 masa ekle", "masa 3 ve 5\'i birleştir"'}
                      {page.key !== 'salon' && '"bugün ciro ne?", "en çok satan ürün?"'}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.action ? (
                      <div className="max-w-[90%] rounded-lg border border-brand/30 bg-brand-light p-3 text-sm">
                        <div className="mb-2 text-ink">{m.action.summary}</div>
                        {m.action.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => confirmAction(i)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50">
                              <Check size={14} /> Onayla
                            </button>
                            <button onClick={() => cancelAction(i)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-card">
                              <X size={14} /> Vazgeç
                            </button>
                          </div>
                        )}
                        {m.action.status === 'done' && <div className="text-xs font-medium text-success">{m.action.result}</div>}
                        {m.action.status === 'cancelled' && <div className="text-xs text-faint">İptal edildi.</div>}
                      </div>
                    ) : (
                      <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-brand text-white' : 'border border-line bg-surface-low text-ink'}`}>
                        {m.text}
                      </div>
                    )}
                  </div>
                ))}
                {busy && <div className="text-xs text-faint">Asistan çalışıyor…</div>}
                <div ref={endRef} />
              </>
            )}
          </div>

          {/* Giriş */}
          {status?.enabled && (
            <div className="flex gap-2 border-t border-line p-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                placeholder="Sor ya da işlem iste…"
                className="flex-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button onClick={ask} disabled={busy || !q.trim()} className="flex items-center justify-center rounded-lg bg-brand px-3 text-white hover:bg-brand-dark disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
