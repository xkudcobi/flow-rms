import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSocketEvent } from '../realtime/socket';
import Modal from '../components/Modal';
import { Button } from '../components/ui';
import { downloadCSV, printHTML, esc } from '../utils/export';

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note?: string | null;
  status: string;
}
interface DayOrder {
  id: string;
  type: string;
  status: string;
  tableName: string | null;
  createdAt: string;
  closedAt: string | null;
  itemsTotal: number;
  discount: number;
  net: number;
  paidTotal: number;
  items: OrderItem[];
  payments: { method: string; amount: number }[];
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const time = (s: string) => new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const today = () => new Date().toISOString().slice(0, 10);

const METHOD_LABEL: Record<string, string> = {
  NAKIT: 'Nakit',
  KREDI_KARTI: 'Kredi Kartı',
  YEMEK_KARTI: 'Yemek Kartı',
  ACIK_HESAP: 'Açık Hesap',
};
const STATUS: Record<string, { label: string; cls: string }> = {
  ACIK: { label: 'Açık', cls: 'bg-amber-100 text-amber-800' },
  KAPANDI: { label: 'Kapandı', cls: 'bg-green-100 text-green-800' },
  IPTAL: { label: 'İptal', cls: 'bg-red-100 text-red-800' },
};

function itemsText(o: DayOrder) {
  return o.items
    .filter((i) => i.status !== 'IPTAL')
    .map((i) => `${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''}`)
    .join(', ');
}
function paymentsText(o: DayOrder) {
  return o.payments
    .map((p) => `${METHOD_LABEL[p.method] || p.method}: ${p.amount}`)
    .join(' + ');
}

function ModeTabs({
  mode,
  setMode,
}: {
  mode: 'aktif' | 'gunluk';
  setMode: (m: 'aktif' | 'gunluk') => void;
}) {
  return (
    <div className="mb-5 flex gap-1 border-b border-line">
      {(
        [
          ['aktif', 'Aktif Adisyonlar'],
          ['gunluk', 'Günlük Geçmiş'],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          onClick={() => setMode(k)}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            mode === k
              ? 'border-b-2 border-brand text-ink'
              : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function AdisyonlarPage() {
  const [mode, setMode] = useState<'aktif' | 'gunluk'>('aktif');
  const [date, setDate] = useState(today());
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<DayOrder | null>(null);

  function load(d: string) {
    api
      .get<DayOrder[]>(`/reports/orders?date=${d}`)
      .then(setOrders)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (mode === 'gunluk') load(date);
  }, [date, mode]);

  if (mode === 'aktif') {
    return (
      <div className="flex h-full flex-col p-6">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ink">Adisyonlar</h1>
          <p className="mb-4 text-sm text-muted">
            Tüm masalardaki canlı adisyonlar · teslim/bekleyen takibi
          </p>
          <ModeTabs mode={mode} setMode={setMode} />
        </div>
        <ActiveOrdersView />
      </div>
    );
  }

  const closed = orders.filter((o) => o.status === 'KAPANDI');
  const totalNet = closed.reduce((s, o) => s + o.net, 0);

  function exportCSV() {
    downloadCSV(
      `adisyonlar_${date}`,
      ['Saat', 'Masa', 'Durum', 'Ürünler', 'Ara Toplam', 'İndirim', 'Net', 'Ödeme'],
      orders.map((o) => [
        time(o.createdAt),
        o.tableName ?? o.type,
        STATUS[o.status]?.label ?? o.status,
        itemsText(o),
        o.itemsTotal,
        o.discount,
        o.net,
        paymentsText(o),
      ]),
    );
  }

  function exportPDF() {
    const rows = orders
      .map(
        (o) => `<tr>
          <td>${time(o.createdAt)}</td>
          <td>${esc(o.tableName ?? o.type)}</td>
          <td>${STATUS[o.status]?.label ?? o.status}</td>
          <td>${esc(itemsText(o))}</td>
          <td class="right">${o.net.toLocaleString('tr-TR')} ₺</td>
          <td>${esc(paymentsText(o))}</td>
        </tr>`,
      )
      .join('');
    printHTML(
      `Adisyonlar — ${date}`,
      `<h1>Günlük Adisyonlar</h1>
       <div class="sub">${date} · Toplam ${orders.length} adisyon · Kapanan ciro ${totalNet.toLocaleString('tr-TR')} ₺</div>
       <table><thead><tr><th>Saat</th><th>Masa</th><th>Durum</th><th>Ürünler</th><th class="right">Net</th><th>Ödeme</th></tr></thead>
       <tbody>${rows}</tbody></table>`,
    );
  }

  return (
    <div className="p-6">
      <ModeTabs mode={mode} setMode={setMode} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Günlük Adisyonlar</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <Button variant="secondary" onClick={exportCSV}>
            ⬇ CSV
          </Button>
          <Button variant="secondary" onClick={exportPDF}>
            🖨 PDF
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 text-sm">
        <span className="rounded-lg bg-white px-4 py-2 shadow-sm">
          Toplam adisyon: <b>{orders.length}</b>
        </span>
        <span className="rounded-lg bg-white px-4 py-2 shadow-sm">
          Kapanan: <b>{closed.length}</b>
        </span>
        <span className="rounded-lg bg-brand/5 px-4 py-2 font-semibold text-brand shadow-sm">
          Ciro: {tl(totalNet)}
        </span>
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Saat</th>
              <th className="px-4 py-3">Masa</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Ürünler</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => setDetail(o)}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-gray-500">{time(o.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {o.tableName ?? o.type}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[o.status]?.cls || 'bg-gray-100'}`}
                  >
                    {STATUS[o.status]?.label || o.status}
                  </span>
                </td>
                <td className="max-w-md truncate px-4 py-3 text-gray-600">
                  {itemsText(o) || '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {tl(o.net)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-brand">
                  detay →
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Bu tarihte adisyon yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <OrderDetail order={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function OrderDetail({
  order,
  onClose,
}: {
  order: DayOrder;
  onClose: () => void;
}) {
  function printOne() {
    const rows = order.items
      .map(
        (i) => `<tr>
          <td>${i.quantity}</td>
          <td>${esc(i.name)}${i.note ? ` <i>(${esc(i.note)})</i>` : ''}${i.status === 'IPTAL' ? ' <s>iptal</s>' : ''}</td>
          <td class="right">${i.unitPrice.toLocaleString('tr-TR')} ₺</td>
          <td class="right">${i.lineTotal.toLocaleString('tr-TR')} ₺</td>
        </tr>`,
      )
      .join('');
    printHTML(
      `Masa ${order.tableName ?? ''} Adisyonu`,
      `<h1>Masa ${esc(order.tableName ?? order.type)} — Adisyon</h1>
       <div class="sub">${new Date(order.createdAt).toLocaleString('tr-TR')} · ${STATUS[order.status]?.label ?? order.status}</div>
       <table><thead><tr><th>Adet</th><th>Ürün</th><th class="right">Birim</th><th class="right">Tutar</th></tr></thead>
       <tbody>${rows}</tbody></table>
       <h2>Ara Toplam: ${order.itemsTotal.toLocaleString('tr-TR')} ₺${order.discount > 0 ? ` · İndirim: ${order.discount.toLocaleString('tr-TR')} ₺` : ''} · Net: ${order.net.toLocaleString('tr-TR')} ₺</h2>
       <div>${order.payments.map((p) => `${METHOD_LABEL[p.method] || p.method}: ${p.amount.toLocaleString('tr-TR')} ₺`).join(' &nbsp;·&nbsp; ')}</div>`,
    );
  }

  return (
    <Modal
      open
      title={`Masa ${order.tableName ?? order.type} — Adisyon`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={printOne}>
            🖨 Yazdır / PDF
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </>
      }
    >
      <div className="mb-2 flex justify-between text-xs text-gray-500">
        <span>
          {new Date(order.createdAt).toLocaleString('tr-TR')}
          {order.closedAt && ` → ${time(order.closedAt)} kapandı`}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${STATUS[order.status]?.cls || 'bg-gray-100'}`}
        >
          {STATUS[order.status]?.label || order.status}
        </span>
      </div>

      <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {order.items.map((i, idx) => (
          <div
            key={idx}
            className={`flex items-start justify-between px-3 py-2 text-sm ${i.status === 'IPTAL' ? 'text-gray-400 line-through' : ''}`}
          >
            <div>
              <span className="font-medium">
                {i.quantity} × {i.name}
              </span>
              {i.note && (
                <span className="ml-1 text-xs text-gray-500">({i.note})</span>
              )}
            </div>
            <span>{tl(i.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Ara Toplam</span>
          <span>{tl(order.itemsTotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>İndirim</span>
            <span>−{tl(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-800">
          <span>Net</span>
          <span>{tl(order.net)}</span>
        </div>
        {order.payments.length > 0 && (
          <div className="border-t border-gray-200 pt-1 text-xs text-gray-500">
            {paymentsText(order)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- Aktif Adisyonlar: usta-detay (liste solda, özet sağda) ---

interface ActiveItem {
  id: string;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  status: string;
  note?: string | null;
}
interface ActiveOrder {
  id: string;
  type: string;
  total: number;
  createdAt: string;
  table?: { id: string; name: string } | null;
  items: ActiveItem[];
}

const ITEM_ST: Record<string, { label: string; cls: string }> = {
  YENI: { label: 'Bekliyor', cls: 'bg-surface-high text-muted' },
  HAZIRLANIYOR: { label: 'Hazırlanıyor', cls: 'bg-brand-light text-brand' },
  HAZIR: { label: 'Hazır', cls: 'bg-warning-light text-warning' },
  SERVIS: { label: 'Teslim', cls: 'bg-success-light text-success' },
};

function activeItems(o: ActiveOrder) {
  return o.items.filter((i) => i.status !== 'IPTAL');
}

function ActiveOrdersView() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    api
      .get<ActiveOrder[]>('/orders/active')
      .then((list) => setOrders(list.filter((o) => o.table)))
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, []);
  useSocketEvent('order:update', load);
  useSocketEvent('table:update', load);

  // Seçili yoksa ilkini seç; seçili kapandıysa seçimi temizle.
  useEffect(() => {
    if (orders.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !orders.some((o) => o.id === selectedId)) {
      setSelectedId(orders[0].id);
    }
  }, [orders, selectedId]);

  const selected = orders.find((o) => o.id === selectedId) || null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface-card">
      {/* Sol: adisyon listesi */}
      <div className="flex w-72 flex-col border-r border-line">
        <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Aktif adisyonlar ({orders.length})
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}
          {orders.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-faint">
              Açık adisyon yok.
            </p>
          )}
          {orders.map((o) => {
            const items = activeItems(o);
            const pending = items.filter((i) => i.status !== 'SERVIS').length;
            const isSel = o.id === selectedId;
            return (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`flex w-full items-center justify-between gap-2 border-b border-line px-4 py-3 text-left transition-colors ${
                  isSel ? 'bg-brand/10' : 'hover:bg-surface-low'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-ink">
                    Masa {o.table?.name}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {time(o.createdAt)} · {items.length} kalem
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-ink">
                    {tl(o.total)}
                  </span>
                  {pending > 0 && (
                    <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                      {pending}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sağ: seçili adisyon özeti */}
      <div className="flex min-h-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-faint">
            Soldan bir adisyon seçin
          </div>
        ) : (
          <ActiveDetail
            order={selected}
            onGo={() => navigate(`/adisyon/${selected.table?.id}`)}
          />
        )}
      </div>
    </div>
  );
}

function ActiveDetail({
  order: o,
  onGo,
}: {
  order: ActiveOrder;
  onGo: () => void;
}) {
  const items = activeItems(o);
  const delivered = items.filter((i) => i.status === 'SERVIS').length;
  const pending = items.length - delivered;
  const pct = items.length ? (delivered / items.length) * 100 : 0;

  return (
    <>
      {/* Başlık */}
      <div className="border-b border-line px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              Masa {o.table?.name}
            </h2>
            <p className="text-sm text-muted">
              {time(o.createdAt)} · açık adisyon
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-ink">
              {tl(o.total)}
            </div>
            <div className="text-xs text-muted">
              {delivered} teslim · {pending} bekliyor
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-high">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Kalemler */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-1.5">
          {items.map((i) => {
            const st = ITEM_ST[i.status] || {
              label: i.status,
              cls: 'bg-surface-high text-muted',
            };
            return (
              <div
                key={i.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <span className="font-medium text-ink">
                    {i.quantity} × {i.nameSnapshot}
                  </span>
                  {i.note && (
                    <span className="ml-1 text-xs text-faint">({i.note})</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${st.cls}`}
                  >
                    {st.label}
                  </span>
                  <span className="tabular w-20 text-right text-muted">
                    {tl(i.unitPrice * i.quantity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alt: masaya yönlendirme */}
      <div className="border-t border-line px-6 py-4">
        <Button onClick={onGo} className="w-full py-3 text-base">
          Masaya Git — Hesabı Al
        </Button>
      </div>
    </>
  );
}
