import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
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

        <p className="mt-6 text-center text-xs text-faint">
          Demo: patron / patron123
        </p>
      </form>
    </div>
  );
}
