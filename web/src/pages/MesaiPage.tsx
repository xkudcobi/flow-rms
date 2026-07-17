import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Clock, LogIn, LogOut } from 'lucide-react';

interface Attendance {
  id: string;
  clockIn: string;
  clockOut?: string | null;
  workedMinutes?: number | null;
}
interface MeResult {
  open: Attendance | null;
  recent: Attendance[];
}

function fmtTime(s?: string | null) {
  return s ? new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
}
function fmtDate(s?: string | null) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '—';
}
function fmtDur(min?: number | null) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}s ${m}dk`;
}

// Personelin QR okutunca geldiği mesai giriş/çıkış ekranı. Kendi oturumuyla
// tek tuşla giriş/çıkış damgalar.
export default function MesaiPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MeResult | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<MeResult>('/attendance/me').then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function clock() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await api.post<{ action: string; workedMinutes?: number }>(
        '/attendance/clock',
        {},
      );
      setMsg(
        res.action === 'GIRIS'
          ? '✓ Giriş yapıldı. İyi çalışmalar!'
          : `✓ Çıkış yapıldı. Bugün ${fmtDur(res.workedMinutes)} çalıştınız.`,
      );
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const open = data?.open;

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-center gap-2">
        <Clock className="text-brand" size={22} />
        <h1 className="font-display text-2xl font-bold text-ink">Mesai</h1>
      </div>

      <div className="rounded-2xl border border-line bg-surface-card p-6 text-center">
        <div className="text-sm text-muted">{user?.fullName}</div>
        {open ? (
          <>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success" /> Mesaide
            </div>
            <div className="mt-2 text-sm text-muted">
              Giriş: {fmtTime(open.clockIn)} ({fmtDate(open.clockIn)})
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm text-muted">Şu an mesaide değilsiniz.</div>
        )}

        <button
          onClick={clock}
          disabled={busy}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 ${
            open ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-dark'
          }`}
        >
          {open ? <LogOut size={22} /> : <LogIn size={22} />}
          {busy ? '…' : open ? 'Çıkış Yap' : 'Giriş Yap'}
        </button>

        {msg && <p className="mt-3 text-sm font-medium text-success">{msg}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      {data && data.recent.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Son Kayıtlar
          </h2>
          <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-low text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Giriş</th>
                  <th className="px-3 py-2">Çıkış</th>
                  <th className="px-3 py-2 text-right">Süre</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-3 py-2">{fmtDate(r.clockIn)}</td>
                    <td className="px-3 py-2">{fmtTime(r.clockIn)}</td>
                    <td className="px-3 py-2">{fmtTime(r.clockOut)}</td>
                    <td className="px-3 py-2 text-right">{fmtDur(r.workedMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
