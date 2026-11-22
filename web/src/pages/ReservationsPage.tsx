import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Button, Field, Input, Select } from '../components/ui';

interface TableRow {
  id: string;
  name: string;
}
interface Reservation {
  id: string;
  customerName: string;
  phone?: string | null;
  partySize: number;
  reservedAt: string;
  note?: string | null;
  status: string;
  table?: { id: string; name: string } | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const hhmm = (s: string) =>
  new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const STATUS: Record<string, { label: string; cls: string }> = {
  BEKLIYOR: { label: 'Bekliyor', cls: 'bg-warning-light text-warning' },
  GELDI: { label: 'Geldi', cls: 'bg-success-light text-success' },
  IPTAL: { label: 'İptal', cls: 'bg-surface-high text-muted' },
  GELMEDI: { label: 'Gelmedi', cls: 'bg-danger-light text-danger-fg' },
};

export default function ReservationsPage() {
  const [date, setDate] = useState(today());
  const [list, setList] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  function load() {
    api
      .get<Reservation[]>(`/reservations?date=${date}`)
      .then(setList)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function setStatus(id: string, status: string) {
    try {
      if (status === 'IPTAL') await api.delete(`/reservations/${id}`);
      else await api.patch(`/reservations/${id}`, { status });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const upcoming = list.filter((r) => r.status === 'BEKLIYOR').length;

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Rezervasyonlar</h1>
          <p className="text-sm text-muted">
            Masaları belli saatlere rezerve edin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-line px-3 py-1.5 text-sm"
          />
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Rezervasyon
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 text-sm">
        <span className="rounded-lg bg-surface-card px-4 py-2 shadow-card">
          Toplam: <b>{list.length}</b>
        </span>
        <span className="rounded-lg bg-brand/5 px-4 py-2 font-semibold text-brand shadow-card">
          Bekleyen: {upcoming}
        </span>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface-card">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Saat</th>
              <th className="px-4 py-3">Masa</th>
              <th className="px-4 py-3">Müşteri</th>
              <th className="px-4 py-3">Kişi</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">
                  {hhmm(r.reservedAt)}
                </td>
                <td className="px-4 py-3">{r.table ? `Masa ${r.table.name}` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{r.customerName}</div>
                  {r.note && <div className="text-xs text-faint">{r.note}</div>}
                </td>
                <td className="px-4 py-3 text-muted">{r.partySize}</td>
                <td className="px-4 py-3 text-muted">{r.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.cls || ''}`}
                  >
                    {STATUS[r.status]?.label || r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.status === 'BEKLIYOR' && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setStatus(r.id, 'GELDI')}
                        className="rounded px-2 py-1 text-xs font-medium text-success hover:bg-success-light"
                      >
                        Geldi
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'GELMEDI')}
                        className="rounded px-2 py-1 text-xs font-medium text-muted hover:bg-surface-high"
                      >
                        Gelmedi
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'IPTAL')}
                        className="rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger-light"
                      >
                        İptal
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-faint">
                  Bu tarihte rezervasyon yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <ReservationForm
          date={date}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReservationForm({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [when, setWhen] = useState(`${date}T19:00`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<TableRow[]>('/tables').then(setTables).catch(() => undefined);
  }, []);

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/reservations', {
        tableId: tableId || undefined,
        customerName,
        phone: phone || undefined,
        partySize: Number(partySize),
        reservedAt: new Date(when).toISOString(),
        note: note || undefined,
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
      title="Yeni Rezervasyon"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !customerName.trim()}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Field label="Müşteri Adı">
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tarih & Saat">
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>
        <Field label="Masa">
          <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">— seçin —</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Masa {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kişi Sayısı">
          <Input
            type="number"
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
          />
        </Field>
        <Field label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <Field label="Not">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
