import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Button, Field, Input } from '../components/ui';

interface Movement {
  id: string;
  type: string;
  amount: number;
  category: string;
  description?: string | null;
  createdAt: string;
}
interface ActiveSession {
  id: string;
  openingCash: number;
  openedAt: string;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  movements: Movement[];
}

const CAT_LABEL: Record<string, string> = {
  ALIS: 'Alış',
  GIDER: 'Gider',
  PARA_USTU: 'Para Üstü',
  TEDARIKCI_ODEME: 'Tedarikçi Ödeme',
  PERSONEL: 'Personel',
  DIGER: 'Diğer',
};
interface Session {
  id: string;
  openingCash: number;
  openedAt: string;
  closedAt?: string | null;
  countedCash?: number | null;
  variance?: number | null;
  note?: string | null;
  status: string;
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const dtime = (s: string) =>
  new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function varianceView(v: number) {
  if (Math.abs(v) < 0.01) return { text: 'Denk', cls: 'text-success' };
  if (v < 0) return { text: `${tl(v)} (eksik)`, cls: 'text-danger' };
  return { text: `+${tl(v)} (fazla)`, cls: 'text-warning' };
}

export default function KasaPage() {
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [moveModal, setMoveModal] = useState<'GIRIS' | 'CIKIS' | null>(null);

  function load() {
    api.get<ActiveSession | null>('/cash/active').then((a) => setActive(a ?? null)).catch((e) => setError(e.message));
    api.get<Session[]>('/cash/sessions').then(setSessions).catch(() => undefined);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-ink">Kasa</h1>
      <p className="mb-5 text-sm text-muted">
        Kasa açılış-kapanış ve nakit sayım kontrolü
      </p>

      {error && <p className="mb-3 text-danger">{error}</p>}

      {/* Aktif oturum / açma */}
      {active ? (
        <div className="mb-6 rounded-lg border border-brand/20 bg-brand-light p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
              <Unlock size={16} /> Kasa Açık — {dtime(active.openedAt)}
            </div>
            <Button variant="dark" onClick={() => setCloseModal(true)}>
              <Lock size={16} /> Kasayı Kapat
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Box label="Açılış" value={tl(active.openingCash)} />
            <Box label="Nakit Satış" value={`+${tl(active.cashSales)}`} />
            <Box label="Nakit Giriş" value={`+${tl(active.cashIn)}`} />
            <Box label="Nakit Çıkış" value={`−${tl(active.cashOut)}`} />
            <Box label="Beklenen" value={tl(active.expectedCash)} accent />
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setMoveModal('CIKIS')}>
              − Nakit Çıkışı
            </Button>
            <Button variant="secondary" onClick={() => setMoveModal('GIRIS')}>
              + Nakit Girişi
            </Button>
          </div>

          {active.movements.length > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-surface-card">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Nakit Hareketleri
              </div>
              <div className="max-h-48 divide-y divide-line overflow-y-auto">
                {active.movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      <span className="text-xs text-faint">{new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>{' '}
                      {m.description || CAT_LABEL[m.category] || m.category}
                      <span className="ml-1 rounded bg-surface-high px-1 text-[10px] text-muted">{CAT_LABEL[m.category] || m.category}</span>
                    </span>
                    <span className={m.type === 'CIKIS' ? 'font-semibold text-danger' : 'font-semibold text-success'}>
                      {m.type === 'CIKIS' ? '−' : '+'}{tl(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-line bg-surface-card p-5">
          <div className="text-sm text-muted">Şu an açık kasa oturumu yok.</div>
          <Button data-tour="kasa-action" onClick={() => setOpenModal(true)}>
            <Unlock size={16} /> Kasa Aç
          </Button>
        </div>
      )}

      {/* Oturum geçmişi */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
        <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Bugünkü Oturumlar
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Açılış</th>
              <th className="px-4 py-3">Kapanış</th>
              <th className="px-4 py-3 text-right">Açılış Nakti</th>
              <th className="px-4 py-3 text-right">Sayılan</th>
              <th className="px-4 py-3 text-right">Fark</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const v = s.variance != null ? varianceView(s.variance) : null;
              return (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{dtime(s.openedAt)}</td>
                  <td className="px-4 py-3 text-muted">{s.closedAt ? dtime(s.closedAt) : '—'}</td>
                  <td className="px-4 py-3 text-right">{tl(s.openingCash)}</td>
                  <td className="px-4 py-3 text-right">{s.countedCash != null ? tl(s.countedCash) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${v?.cls || ''}`}>{v ? v.text : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.status === 'ACIK' ? 'bg-brand-light text-brand' : 'bg-surface-high text-muted'}`}>
                      {s.status === 'ACIK' ? 'Açık' : 'Kapandı'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-faint">Bugün kasa oturumu yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openModal && (
        <OpenForm onClose={() => setOpenModal(false)} onSaved={() => { setOpenModal(false); load(); }} />
      )}
      {closeModal && active && (
        <CloseForm active={active} onClose={() => setCloseModal(false)} onSaved={() => { setCloseModal(false); load(); }} />
      )}
      {moveModal && (
        <MovementForm type={moveModal} onClose={() => setMoveModal(null)} onSaved={() => { setMoveModal(null); load(); }} />
      )}
    </div>
  );
}

function MovementForm({
  type,
  onClose,
  onSaved,
}: {
  type: 'GIRIS' | 'CIKIS';
  onClose: () => void;
  onSaved: () => void;
}) {
  const cats =
    type === 'CIKIS'
      ? ['GIDER', 'PARA_USTU', 'TEDARIKCI_ODEME', 'PERSONEL', 'DIGER']
      : ['DIGER'];
  const [category, setCategory] = useState(cats[0]);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    if (!(amount > 0)) return;
    setBusy(true);
    setErr('');
    try {
      await api.post('/cash/movements', {
        type,
        amount: Number(amount),
        category,
        description: description || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={type === 'CIKIS' ? 'Nakit Çıkışı' : 'Nakit Girişi'}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>İptal</Button>
        <Button variant={type === 'CIKIS' ? 'danger' : 'primary'} onClick={save} disabled={busy || !(amount > 0)}>Kaydet</Button>
      </>}>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      {cats.length > 1 && (
        <Field label="Kategori">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-line px-3 py-2">
            {cats.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
        </Field>
      )}
      <Field label="Tutar (₺)">
        <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} autoFocus />
      </Field>
      <Field label="Açıklama">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ör. çöp poşeti, kuryeye para üstü…" />
      </Field>
    </Modal>
  );
}

function Box({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-brand/30 bg-surface-card' : 'border-line bg-surface-card'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${accent ? 'text-brand-dark' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function OpenForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [openingCash, setOpeningCash] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/cash/open', { openingCash: Number(openingCash) });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal open title="Kasa Aç" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={busy}>Aç</Button>
      </>}>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Field label="Açılış Nakti (kasadaki başlangıç para)">
        <Input type="number" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} autoFocus />
      </Field>
    </Modal>
  );
}

function CloseForm({ active, onClose, onSaved }: { active: ActiveSession; onClose: () => void; onSaved: () => void }) {
  const [counted, setCounted] = useState(active.expectedCash);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const variance = Number(counted) - active.expectedCash;
  const v = varianceView(variance);
  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/cash/${active.id}/close`, { countedCash: Number(counted), note: note || undefined });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal open title="Kasa Kapat — Nakit Sayımı" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={busy}>Kapat</Button>
      </>}>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <div className="mb-3 space-y-1 rounded-lg bg-surface-low p-3 text-sm">
        <div className="flex justify-between text-muted"><span>Açılış</span><span>{tl(active.openingCash)}</span></div>
        <div className="flex justify-between text-muted"><span>Nakit Satış</span><span>{tl(active.cashSales)}</span></div>
        <div className="flex justify-between font-semibold text-ink"><span>Beklenen Nakit</span><span>{tl(active.expectedCash)}</span></div>
      </div>
      <Field label="Sayılan Nakit (kasadaki gerçek para)">
        <Input type="number" value={counted} onChange={(e) => setCounted(Number(e.target.value))} autoFocus />
      </Field>
      <div className={`mb-3 rounded-lg p-3 text-center font-semibold ${v.cls}`}>
        Fark: {v.text}
      </div>
      <Field label="Not (opsiyonel)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
