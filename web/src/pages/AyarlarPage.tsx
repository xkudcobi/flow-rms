import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../api/client';
import { Button, Field, Input } from '../components/ui';

interface Settings {
  businessName?: string | null;
  openHour: number;
  closeHour: number;
  openDays: string;
  address?: string | null;
  phone?: string | null;
  note?: string | null;
  qrOrderingEnabled: boolean;
}

const GUNLER = [
  { v: '1', l: 'Pzt' },
  { v: '2', l: 'Sal' },
  { v: '3', l: 'Çar' },
  { v: '4', l: 'Per' },
  { v: '5', l: 'Cum' },
  { v: '6', l: 'Cmt' },
  { v: '0', l: 'Paz' },
];

export default function AyarlarPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<Settings>('/settings').then(setS).catch((e) => setErr(e.message));
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  }

  function toggleDay(v: string) {
    if (!s) return;
    const days = new Set(s.openDays.split(',').filter(Boolean));
    if (days.has(v)) days.delete(v);
    else days.add(v);
    // Hafta sırasına göre sırala (Pzt..Paz)
    const ordered = ['1', '2', '3', '4', '5', '6', '0'].filter((d) => days.has(d));
    set('openDays', ordered.join(','));
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    setErr('');
    try {
      const updated = await api.put<Settings>('/settings', {
        businessName: s.businessName || null,
        openHour: Number(s.openHour),
        closeHour: Number(s.closeHour),
        openDays: s.openDays,
        address: s.address || null,
        phone: s.phone || null,
        note: s.note || null,
        qrOrderingEnabled: s.qrOrderingEnabled,
      });
      setS(updated);
      setSaved(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <div className="p-6 text-muted">Yükleniyor…</div>;

  const days = new Set(s.openDays.split(',').filter(Boolean));

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-ink">İşletme Ayarları</h1>
      <p className="mb-5 text-sm text-muted">
        Çalışma saatleri ve işletme bilgileri — öngörü motoru ve yapay zeka asistanı bunları dikkate alır
        (ör. kapalı saatleri "ölü saat" saymaz).
      </p>

      {err && <p className="mb-3 text-danger">{err}</p>}

      <div className="max-w-2xl space-y-5">
        <div className="rounded-lg border border-line bg-surface-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Genel</h2>
          <Field label="İşletme Adı (fiş başlığı & asistan için)">
            <Input value={s.businessName || ''} onChange={(e) => set('businessName', e.target.value)} placeholder="ör. Lezzet Restoran" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon">
              <Input value={s.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Adres">
              <Input value={s.address || ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </div>

        <div data-tour="ayarlar-hours" className="rounded-lg border border-line bg-surface-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Çalışma Saatleri</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Açılış saati">
              <select value={s.openHour} onChange={(e) => set('openHour', Number(e.target.value))} className="w-full rounded-lg border border-line px-3 py-2">
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </Field>
            <Field label="Kapanış saati (gece yarısını geçiyorsa 24+ seçin)">
              <select value={s.closeHour} onChange={(e) => set('closeHour', Number(e.target.value))} className="w-full rounded-lg border border-line px-3 py-2">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {String(h % 24).padStart(2, '0')}:00{h >= 24 ? ' (+1 gün)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-sm font-medium text-ink">Açık Günler</label>
            <div className="flex flex-wrap gap-2">
              {GUNLER.map((g) => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => toggleDay(g.v)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    days.has(g.v) ? 'border-brand bg-brand text-white' : 'border-line text-muted hover:bg-surface-low'
                  }`}
                >
                  {g.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface-card p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
            QR Menü
          </h2>
          <p className="mb-3 text-xs text-faint">
            Müşteri masadaki karekodu okuttuğunda ne yapabilsin?
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={s.qrOrderingEnabled}
              onChange={(e) => set('qrOrderingEnabled', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                QR'dan sipariş alınsın
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Kapatırsanız müşteri menüyü ve kendi hesabını görür, garson
                çağırabilir — ama sipariş gönderemez. Siparişi yalnız garsonla
                almak isteyen işletmeler için.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-line bg-surface-card p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">İşletme Notu (asistana bağlam)</h2>
          <p className="mb-2 text-xs text-faint">Konsept, hedef kitle, özel kurallar… Asistan bu bilgiyi öneri verirken kullanır.</p>
          <textarea
            value={s.note || ''}
            onChange={(e) => set('note', e.target.value)}
            rows={3}
            placeholder="ör. Aile restoranıyız, öğlen esnaf menüsü ağırlıklı, akşam à la carte. Cuma-Cmt yoğun."
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>
            <Save size={16} /> Kaydet
          </Button>
          {saved && <span className="text-sm text-success">✓ Kaydedildi</span>}
        </div>
      </div>
    </div>
  );
}
