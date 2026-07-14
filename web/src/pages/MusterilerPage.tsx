import { useEffect, useMemo, useState } from 'react';
import { Cake, Plus, Search, Trash2, Trophy } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Button, Field, Input } from '../components/ui';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  birthday?: string | null;
  note?: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  lastVisitAt?: string | null;
}
interface Visit {
  id: string;
  date: string | null;
  table: string;
  net: number;
}
interface Birthday {
  id: string;
  name: string;
  phone?: string | null;
  day: number;
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const dshort = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const bday = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' }) : '—';

export default function MusterilerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [top, setTop] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get<Customer[]>(`/crm${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(setCustomers).catch((e) => setError(e.message));
    api.get<Birthday[]>('/crm/birthdays').then(setBirthdays).catch(() => undefined);
    api.get<Customer[]>('/crm/top').then(setTop).catch(() => undefined);
  }
  useEffect(load, [search]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ink">Müşteriler</h1>
          <p className="text-sm text-muted">Müdavim takibi, sadakat puanı ve doğum günü kampanyaları</p>
        </div>
        <Button data-tour="crm-add" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> Yeni Müşteri
        </Button>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Ana liste */}
        <div className="lg:col-span-2">
          <div data-tour="crm-search" className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface-card px-3">
            <Search size={16} className="text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad veya telefon ara…"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3 text-right">Ziyaret</th>
                  <th className="px-4 py-3 text-right">Harcama</th>
                  <th className="px-4 py-3 text-right">Puan</th>
                  <th className="px-4 py-3">Son</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setDetailId(c.id)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-low"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {c.name}
                        {c.visitCount >= 5 && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">VIP</span>
                        )}
                      </div>
                      <div className="text-xs text-faint">{c.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{c.visitCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{tl(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-right font-medium text-brand">{c.loyaltyPoints}</td>
                    <td className="px-4 py-3 text-xs text-muted">{dshort(c.lastVisitAt)}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-faint">Müşteri yok. "Yeni Müşteri" ile ekleyin.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Yan panel: doğum günü + top */}
        <div className="space-y-5">
          <Panel icon={<Cake size={16} className="text-pink-500" />} title="Bu Ay Doğum Günü">
            {birthdays.length === 0 ? (
              <Empty>Bu ay doğum günü yok.</Empty>
            ) : (
              birthdays.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-medium text-ink">{b.name}</span>
                  <span className="text-xs text-muted">{b.day}. gün {b.phone ? `• ${b.phone}` : ''}</span>
                </div>
              ))
            )}
          </Panel>

          <Panel icon={<Trophy size={16} className="text-amber-500" />} title="En Çok Harcayan">
            {top.length === 0 ? (
              <Empty>Henüz harcama verisi yok.</Empty>
            ) : (
              top.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-ink">
                    <span className="mr-2 text-muted">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                    {c.name}
                  </span>
                  <span className="font-semibold text-ink">{tl(c.totalSpent)}</span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>

      {addOpen && <CustomerForm onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />}
      {detailId && (
        <CustomerDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon} {title}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-xs text-faint">{children}</div>;
}

function CustomerDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<(Customer & { visits: Visit[] }) | null>(null);
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState('');

  function load() {
    api.get<Customer & { visits: Visit[] }>(`/crm/${id}`).then(setData).catch((e) => setErr(e.message));
  }
  useEffect(load, [id]);

  async function remove() {
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return;
    await api.delete(`/crm/${id}`);
    onChanged();
    onClose();
  }

  const chart = useMemo(
    () =>
      (data?.visits || [])
        .slice()
        .reverse()
        .map((v) => ({ name: dshort(v.date), tutar: v.net })),
    [data],
  );

  if (edit && data)
    return (
      <CustomerForm
        existing={data}
        onClose={() => setEdit(false)}
        onSaved={() => { setEdit(false); load(); onChanged(); }}
      />
    );

  return (
    <Modal open title={data?.name || 'Müşteri'} onClose={onClose}
      footer={<>
        <Button variant="danger" onClick={remove}><Trash2 size={15} /> Sil</Button>
        <Button variant="secondary" onClick={() => setEdit(true)}>Düzenle</Button>
        <Button onClick={onClose}>Kapat</Button>
      </>}>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      {data && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ziyaret" value={String(data.visitCount)} />
            <Stat label="Toplam Harcama" value={tl(data.totalSpent)} />
            <Stat label="Sadakat Puanı" value={String(data.loyaltyPoints)} accent />
            <Stat label="Doğum Günü" value={bday(data.birthday)} />
          </div>
          <div className="mb-4 space-y-1 rounded-lg bg-surface-low p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Telefon</span><span className="text-ink">{data.phone || '—'}</span></div>
            {data.note && <div className="flex justify-between gap-4"><span className="text-muted">Not</span><span className="text-right text-ink">{data.note}</span></div>}
          </div>

          {chart.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Harcama Geçmişi</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chart} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => (v as number).toLocaleString('tr-TR')} />
                  <Tooltip formatter={(v) => tl(v as number)} />
                  <Bar dataKey="tutar" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Ziyaretler</div>
          <div className="mt-1 max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {data.visits.length === 0 && <div className="px-3 py-4 text-center text-xs text-faint">Henüz ziyaret yok.</div>}
            {data.visits.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-muted">{dshort(v.date)} • Masa {v.table}</span>
                <span className="font-medium text-ink">{tl(v.net)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${accent ? 'border-brand/30 bg-brand-light' : 'border-line bg-surface-card'}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 font-display text-lg font-bold ${accent ? 'text-brand-dark' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function CustomerForm({ existing, onClose, onSaved }: { existing?: Customer; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.name || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [birthday, setBirthday] = useState(existing?.birthday ? existing.birthday.slice(0, 10) : '');
  const [note, setNote] = useState(existing?.note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!name.trim()) { setErr('Ad gerekli'); return; }
    setBusy(true);
    setErr('');
    const body = { name: name.trim(), phone: phone || undefined, birthday: birthday || undefined, note: note || undefined };
    try {
      if (existing) await api.patch(`/crm/${existing.id}`, body);
      else await api.post('/crm', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal open title={existing ? 'Müşteri Düzenle' : 'Yeni Müşteri'} onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={busy}>Kaydet</Button>
      </>}>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Field label="Ad Soyad"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Telefon"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx…" /></Field>
      <Field label="Doğum Günü"><Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></Field>
      <Field label="Not (tercih / alerji)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}
