import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, X, Users, Trash2, Combine, Clock, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useSocketEvent } from '../realtime/socket';
import Modal from '../components/Modal';
import { Button, Field, Input } from '../components/ui';

interface Table {
  id: string;
  name: string;
  seats: number;
  floorId: string;
  status: 'BOS' | 'DOLU' | 'ODENDI' | 'REZERVE';
}
interface Floor {
  id: string;
  name: string;
  tables: Table[];
}
interface ActiveOrder {
  orderId: string;
  total: number;
  createdAt: string;
  mergedLabel?: string | null;
}

const tl = (n: number) => '₺' + n.toLocaleString('tr-TR');
const hhmm = (s: string) =>
  new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
function since(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)}s ${m % 60}dk`;
}

export default function SalonPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === 'PATRON' || user?.role === 'MUDUR';

  const [floors, setFloors] = useState<Floor[]>([]);
  const [orders, setOrders] = useState<Record<string, ActiveOrder>>({});
  const [reservations, setReservations] = useState<
    Record<string, { reservedAt: string; customerName: string; partySize: number }>
  >({});
  const [active, setActive] = useState<string>('');
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState('');
  const [tableModal, setTableModal] = useState<Table | 'new' | null>(null);
  const [floorModal, setFloorModal] = useState(false);
  const [, setTick] = useState(0);
  // Masa birleştirme modu
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSource, setMergeSource] = useState<Table | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Table | null>(null);
  const [qrModal, setQrModal] = useState<{ name: string; url: string } | null>(null);

  async function loadFloors() {
    try {
      const data = await api.get<Floor[]>('/tables/floors');
      setFloors(data);
      setActive((cur) => cur || data[0]?.id || '');
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadOrders() {
    try {
      const list = await api.get<
        {
          id: string;
          table?: { id: string };
          total: number;
          createdAt: string;
          mergedLabel?: string | null;
        }[]
      >('/orders/active');
      const map: Record<string, ActiveOrder> = {};
      for (const o of list)
        if (o.table)
          map[o.table.id] = {
            orderId: o.id,
            total: o.total,
            createdAt: o.createdAt,
            mergedLabel: o.mergedLabel,
          };
      setOrders(map);
    } catch {
      /* sessiz */
    }
  }

  async function loadReservations() {
    try {
      const list = await api.get<
        {
          tableId: string;
          reservedAt: string;
          customerName: string;
          partySize: number;
        }[]
      >('/reservations/active');
      const map: Record<
        string,
        { reservedAt: string; customerName: string; partySize: number }
      > = {};
      // İlk (en yakın) rezervasyonu masaya ata.
      for (const r of list)
        if (r.tableId && !map[r.tableId])
          map[r.tableId] = {
            reservedAt: r.reservedAt,
            customerName: r.customerName,
            partySize: r.partySize,
          };
      setReservations(map);
    } catch {
      /* sessiz */
    }
  }

  useEffect(() => {
    loadFloors();
    loadOrders();
    loadReservations();
  }, []);

  // AI asistanı bir işlem uyguladığında (ör. masa ekleme) salonu tazele.
  useEffect(() => {
    const h = () => {
      loadFloors();
      loadOrders();
    };
    window.addEventListener('flow:refresh', h);
    return () => window.removeEventListener('flow:refresh', h);
  }, []);

  // Canlı: masa durumu / sipariş değişince tazele.
  useSocketEvent('table:update', () => {
    loadFloors();
    loadOrders();
  });
  useSocketEvent('order:update', loadOrders);
  // Geçen süre etiketlerini dakikada bir tazele.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  function onTileClick(t: Table) {
    if (mergeMode) {
      if (t.status !== 'DOLU') return; // yalnız dolu masalar birleştirilebilir
      if (!mergeSource) {
        setMergeSource(t);
        return;
      }
      if (t.id === mergeSource.id) {
        setMergeSource(null);
        return;
      }
      setMergeTarget(t); // onay modalı açılır
      return;
    }
    navigate(`/adisyon/${t.id}`);
  }

  async function doMerge() {
    if (!mergeSource || !mergeTarget) return;
    const src = orders[mergeSource.id];
    if (!src) {
      setError('Kaynak masada açık adisyon yok.');
      return;
    }
    try {
      await api.post(`/orders/${src.orderId}/merge`, {
        targetTableId: mergeTarget.id,
      });
      setMergeSource(null);
      setMergeTarget(null);
      setMergeMode(false);
      loadFloors();
      loadOrders();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openQr(t: Table) {
    try {
      const { token } = await api.get<{ token: string }>(`/tables/${t.id}/qr`);
      setQrModal({ name: t.name, url: `${window.location.origin}/m/${token}` });
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeFloor(f: Floor) {
    const msg =
      f.tables.length > 0
        ? `"${f.name}" katını ve içindeki ${f.tables.length} masayı silmek istiyor musunuz?`
        : `"${f.name}" katını silmek istiyor musunuz?`;
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/tables/floors/${f.id}`);
      if (active === f.id) setActive('');
      loadFloors();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const allTables = floors.flatMap((f) => f.tables);
  const stat = {
    total: allTables.length,
    dolu: allTables.filter((t) => t.status === 'DOLU').length,
    bos: allTables.filter((t) => t.status === 'BOS').length,
    rezerve: allTables.filter((t) => t.status === 'REZERVE').length,
  };
  const current = floors.find((f) => f.id === active);

  return (
    <div className="p-6">
      {/* Başlık */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Salon Planı</h1>
          <p className="text-sm text-muted">
            Masaya dokunarak adisyon açın · durumlar canlı güncellenir
          </p>
        </div>
        <div className="flex gap-2" data-tour="salon-actions">
          {!edit && (
            <Button
              data-tour="salon-merge"
              variant={mergeMode ? 'dark' : 'secondary'}
              onClick={() => {
                setMergeMode((v) => !v);
                setMergeSource(null);
                setMergeTarget(null);
              }}
            >
              <Combine size={16} /> {mergeMode ? 'Vazgeç' : 'Birleştir'}
            </Button>
          )}
          {canEdit && !mergeMode && (
            <>
              {edit && (
                <>
                  <Button variant="secondary" onClick={() => setFloorModal(true)}>
                    <Plus size={16} /> Kat/Salon
                  </Button>
                  <Button onClick={() => setTableModal('new')} disabled={!active}>
                    <Plus size={16} /> Masa
                  </Button>
                </>
              )}
              <Button
                data-tour="salon-edit"
                variant={edit ? 'dark' : 'secondary'}
                onClick={() => setEdit((v) => !v)}
              >
                {edit ? 'Bitir' : 'Düzenle'}
              </Button>
            </>
          )}
        </div>
      </div>

      {mergeMode && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm text-brand">
          🔗 Birleştirme:{' '}
          {!mergeSource
            ? 'Birleştirilecek ilk (dolu) masayı seçin.'
            : `Masa ${mergeSource.name} seçildi. Hesabın aktarılacağı ikinci masayı seçin.`}
        </div>
      )}

      {error && <p className="mb-3 text-danger">{error}</p>}

      {/* Özet sayaç kartları */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam Masa" value={stat.total} />
        <StatCard label="Dolu" value={stat.dolu} tone="brand" />
        <StatCard label="Boş" value={stat.bos} tone="success" />
        <StatCard label="Rezerve" value={stat.rezerve} tone="danger" />
      </div>

      {/* Kat/salon sekmeleri (Stitch stili) */}
      <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-line">
        {floors.map((f) => (
          <div
            key={f.id}
            className={`flex items-center border-b-2 ${
              active === f.id ? 'border-brand' : 'border-transparent'
            }`}
          >
            <button
              onClick={() => setActive(f.id)}
              className={`py-2 pl-4 text-sm font-semibold transition-colors ${
                active === f.id ? 'text-ink' : 'text-muted hover:text-ink'
              } ${edit ? 'pr-1' : 'pr-4'}`}
            >
              {f.name}
              <span className="ml-1.5 text-xs text-faint">
                ({f.tables.length})
              </span>
            </button>
            {edit && (
              <button
                onClick={() => removeFloor(f)}
                className="mr-2 rounded p-1 text-faint transition-colors hover:bg-danger-light hover:text-danger"
                title="Katı sil"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Masa grid'i */}
      {current && (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {current.tables.map((t) => (
            <TableTile
              key={t.id}
              table={t}
              order={orders[t.id]}
              reservation={reservations[t.id]}
              edit={edit}
              mergeMode={mergeMode}
              selected={mergeSource?.id === t.id}
              onClick={() => onTileClick(t)}
              onEdit={() => setTableModal(t)}
              onQr={() => openQr(t)}
              onDelete={() => removeTable(t.id, () => { loadFloors(); loadOrders(); }, setError)}
            />
          ))}
          {current.tables.length === 0 && (
            <p className="col-span-full py-8 text-center text-faint">
              Bu katta masa yok. {edit && '"+ Masa" ile ekleyin.'}
            </p>
          )}
        </div>
      )}

      {tableModal && current && (
        <TableForm
          value={tableModal === 'new' ? null : tableModal}
          floorId={active}
          onClose={() => setTableModal(null)}
          onSaved={() => {
            setTableModal(null);
            loadFloors();
          }}
        />
      )}
      {floorModal && (
        <FloorForm
          onClose={() => setFloorModal(false)}
          onSaved={() => {
            setFloorModal(false);
            loadFloors();
          }}
        />
      )}

      {qrModal && (
        <Modal
          open
          title={`Masa ${qrModal.name} — QR Menü`}
          onClose={() => setQrModal(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => window.print()}>
                Yazdır
              </Button>
              <Button variant="secondary" onClick={() => setQrModal(null)}>
                Kapat
              </Button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 print:py-8" id="qr-print">
            <div className="font-display text-lg font-bold text-ink">
              Masa {qrModal.name}
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <QRCodeSVG value={qrModal.url} size={200} />
            </div>
            <p className="text-center text-sm text-muted">
              Menüyü görüntülemek ve sipariş vermek için QR'ı okutun
            </p>
            <p className="break-all text-center text-[10px] text-faint">
              {qrModal.url}
            </p>
          </div>
        </Modal>
      )}

      {mergeSource && mergeTarget && (
        <Modal
          open
          title="Masaları Birleştir"
          onClose={() => setMergeTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setMergeTarget(null)}>
                Vazgeç
              </Button>
              <Button onClick={doMerge}>Birleştir</Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            <b>Masa {mergeSource.name}</b> hesabı <b>Masa {mergeTarget.name}</b>{' '}
            ile birleştirilecek. İki masanın adisyonu tek hesapta toplanır ve{' '}
            <b>Masa {mergeSource.name}</b> boşalır.
          </p>
          <p className="mt-2 text-xs text-muted">
            Birleşik masa <b>Masa {mergeTarget.name} + {mergeSource.name}</b>{' '}
            olarak görünür; ürünlerde hangi masadan geldiği renkli işaretlenir.
          </p>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'brand' | 'success' | 'danger';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-light border-brand/20',
    success: 'bg-success-light border-success/20',
    danger: 'bg-danger-light border-danger/20',
  };
  return (
    <div
      className={`rounded-lg border p-4 ${tone ? tones[tone] : 'border-line bg-surface-card'}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-bold text-ink">{value}</div>
    </div>
  );
}

function TableTile({
  table: t,
  order,
  reservation,
  edit,
  mergeMode,
  selected,
  onClick,
  onEdit,
  onQr,
  onDelete,
}: {
  table: Table;
  order?: ActiveOrder;
  reservation?: { reservedAt: string; customerName: string; partySize: number };
  edit: boolean;
  mergeMode: boolean;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onQr: () => void;
  onDelete: () => void;
}) {
  // Boş masada bekleyen rezervasyon varsa "rezerve" görünümü.
  const reserved = t.status === 'BOS' && !!reservation;
  const styles: Record<Table['status'], string> = {
    BOS: reserved
      ? 'bg-danger-light border-danger/40 text-danger-fg'
      : 'bg-surface-card border-line text-ink hover:border-brand hover:shadow-card',
    DOLU: 'bg-brand border-brand text-white shadow-float hover:bg-brand-dark',
    ODENDI: 'bg-warning-light border-warning/30 text-warning',
    REZERVE: 'bg-danger-light border-danger/30 text-danger-fg',
  };
  // 8+ kişilik ya da birleşik masalar geniş (uzun) görünür.
  const big = t.seats >= 8 || !!order?.mergedLabel;
  // Birleştirme modunda yalnız dolu masalar seçilebilir.
  const dim = mergeMode && t.status !== 'DOLU';
  const label = order?.mergedLabel ? order.mergedLabel : t.name;
  return (
    <div
      onClick={() => !edit && !dim && onClick()}
      className={`relative flex ${
        big ? 'col-span-2 aspect-[2/1]' : 'aspect-square'
      } flex-col items-center justify-center rounded-lg border-2 p-3 text-center transition-all ${
        styles[t.status]
      } ${dim ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${
        selected ? 'ring-4 ring-brand ring-offset-2' : ''
      }`}
    >
      {order?.mergedLabel && (
        <span className="absolute left-1.5 top-1.5 rounded bg-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase">
          Birleşik
        </span>
      )}
      <span className="font-display text-lg font-bold leading-tight">
        Masa {label}
      </span>

      {t.status === 'DOLU' && order ? (
        <div className="mt-2 flex flex-col items-center gap-0.5">
          <span className="tabular text-[11px] opacity-90">
            {since(order.createdAt)}
          </span>
          <span className="tabular text-sm font-semibold">
            {tl(order.total)}
          </span>
        </div>
      ) : t.status === 'BOS' && reserved && reservation ? (
        <div className="mt-1.5 flex flex-col items-center gap-0.5">
          <span className="tabular flex items-center gap-1 text-[11px] font-semibold">
            <Clock size={11} /> {hhmm(reservation.reservedAt)}
          </span>
          <span className="max-w-full truncate text-[10px]">
            {reservation.customerName} · {reservation.partySize} kişi
          </span>
        </div>
      ) : t.status === 'BOS' ? (
        <span className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
          <Users size={11} /> {t.seats}
        </span>
      ) : (
        <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide">
          {t.status === 'ODENDI' ? 'Ödendi' : 'Rezerve'}
        </span>
      )}

      {edit && (
        <div className="absolute -right-2 -top-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQr();
            }}
            className="rounded-full bg-brand p-1 text-white shadow hover:bg-brand-dark"
            title="QR Kodu"
          >
            <QrCode size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-full bg-ink p-1 text-white shadow hover:bg-black"
            title="Düzenle"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-full bg-danger p-1 text-white shadow hover:opacity-90"
            title="Sil"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

async function removeTable(
  id: string,
  reload: () => void,
  setError: (s: string) => void,
) {
  try {
    await api.delete(`/tables/${id}`);
    reload();
  } catch (e: any) {
    setError(e.message);
  }
}

function TableForm({
  value,
  floorId,
  onClose,
  onSaved,
}: {
  value: Table | null;
  floorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.name || '');
  const [seats, setSeats] = useState<number>(value?.seats ?? 4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const body: any = { name, seats: Number(seats), floorId };
      if (value) await api.patch(`/tables/${value.id}`, body);
      else await api.post('/tables', { ...body, posX: 40, posY: 40 });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={value ? 'Masa Düzenle' : 'Yeni Masa'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Field label="Masa Adı/No">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Kişi Kapasitesi">
        <Input
          type="number"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
        />
      </Field>
    </Modal>
  );
}

function FloorForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/tables/floors', { name });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Yeni Kat/Salon"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Field label="Kat/Salon Adı">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="İç Salon, Bahçe, Teras…"
        />
      </Field>
    </Modal>
  );
}
