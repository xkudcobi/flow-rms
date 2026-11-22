import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

// Herkese açık demo (VITE_DEMO=1 ile derlenir): tek tıkla rol seçip girilir.
const DEMO = import.meta.env.VITE_DEMO === '1';
const DEMO_ACCOUNTS = [
  { u: 'patron', p: 'patron123', label: 'Patron', hint: 'Her şey: raporlar, stok, kasa, ayarlar' },
  { u: 'garson', p: 'garson123', label: 'Garson', hint: 'Masalar ve sipariş alma' },
  { u: 'mutfak', p: 'mutfak123', label: 'Mutfak', hint: 'Mutfak ekranı (KDS)' },
  { u: 'kasa', p: 'kasa123', label: 'Kasiyer', hint: 'Ödeme, fiş ve kasa' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(username.trim(), password);
  }

  async function doLogin(u: string, p: string) {
    setError('');
    setBusy(true);
    try {
      await login(u, p);
    } catch (err: any) {
      setError(err.message || 'Giriş başarısız');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-sidebar p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-line bg-surface-card p-8 shadow-float"
      >
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink">
            FLOW
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-faint">
            Restoran Yönetim Sistemi
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded border border-danger/20 bg-danger-light px-4 py-2 text-sm text-danger-fg">
            {error}
          </div>
        )}

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Kullanıcı Adı
        </label>
        <input
          className="mb-4 w-full rounded border border-line bg-surface-card px-3 py-2 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Şifre
        </label>
        <input
          type="password"
          className="mb-6 w-full rounded border border-line bg-surface-card px-3 py-2 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-brand py-2.5 font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>

        {DEMO ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-faint">
              Demo · bir rolle hemen gir
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.u}
                  type="button"
                  disabled={busy}
                  onClick={() => doLogin(a.u, a.p)}
                  className="rounded border border-line px-3 py-2 text-left transition-colors hover:border-brand hover:bg-brand/5 disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-ink">{a.label}</span>
                  <span className="block text-[11px] leading-snug text-faint">{a.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
              Bu bir test sürümü. Eklediğiniz veriler kalıcıdır ve diğer ziyaretçiler de görür.
              Mutfak ekranını ayrı bir sekmede açıp garsondan sipariş girerek canlı akışı görebilirsiniz.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-center text-xs text-faint">
            Demo: patron / patron123
          </p>
        )}
      </form>
    </div>
  );
}
