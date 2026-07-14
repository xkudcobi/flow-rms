import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useSocketEvent } from '../realtime/socket';
import Modal from '../components/Modal';
import { Button, Field, Input } from '../components/ui';

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';

interface Category {
  id: string;
  name: string;
  color?: string;
}
interface Product {
  id: string;
  name: string;
  price: number;
  station: string;
  categoryId: string;
}
interface OrderItem {
  id: string;
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  note?: string;
  station: string;
  status: string;
  originLabel?: string | null;
}
interface Payment {
  id: string;
  method: string;
  amount: number;
}
interface Order {
  id: string;
  status: string;
  items: OrderItem[];
  payments: Payment[];
  total: number;
  itemsTotal: number;
  discountAmount: number;
  discountType?: string | null;
  discountValue?: number;
  discountReason?: string | null;
  netTotal: number;
  paidTotal: number;
  remaining: number;
  tip?: number;
  customerId?: string | null;
  customer?: { id: string; name: string; loyaltyPoints: number } | null;
  mergedLabel?: string | null;
  table?: { id: string; name: string };
}

// Birleştirilmiş adisyonda kalem kökenini renkli göstermek için tutarlı renk.
const ORIGIN_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-fuchsia-100 text-fuchsia-800',
  'bg-rose-100 text-rose-800',
];
function originColor(label: string, all: string[]): string {
  const idx = all.indexOf(label);
  return ORIGIN_COLORS[(idx < 0 ? 0 : idx) % ORIGIN_COLORS.length];
}

const METHOD_LABEL: Record<string, string> = {
  NAKIT: 'Nakit',
  KREDI_KARTI: 'Kredi Kartı',
  YEMEK_KARTI: 'Yemek Kartı',
  ACIK_HESAP: 'Açık Hesap',
};
interface CartLine {
  productId: string;
  name: string;
  price: number;
  station: string;
  quantity: number;
  note: string;
}

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  YENI: { label: 'Yeni', cls: 'bg-gray-200 text-gray-700' },
  HAZIRLANIYOR: { label: 'Hazırlanıyor', cls: 'bg-amber-200 text-amber-800' },
  HAZIR: { label: 'Hazır', cls: 'bg-green-200 text-green-800' },
  SERVIS: { label: 'Servis edildi', cls: 'bg-blue-200 text-blue-800' },
  IPTAL: { label: 'İptal', cls: 'bg-red-200 text-red-800 line-through' },
};

export default function AdisyonPage() {
  const { tableId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDiscount = user?.role === 'PATRON' || user?.role === 'MUDUR';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [tableName, setTableName] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<CartLine | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [preview, setPreview] = useState<
    { station: string; preview: string; sent: boolean }[] | null
  >(null);
  const [receiptText, setReceiptText] = useState<string | null>(null);
  // Adisyon tam ödenip kapandı → fiş kapatılınca salona dön.
  const [justClosed, setJustClosed] = useState(false);
  const [lastClosedId, setLastClosedId] = useState<string | null>(null);
  const [einvoiceMsg, setEinvoiceMsg] = useState('');

  async function loadOrder() {
    const o = await api.get<Order | null>(`/orders/table/${tableId}`);
    setOrder(o ?? null);
  }

  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/menu/categories'),
      api.get<Product[]>('/menu/products'),
      api.get<any[]>('/tables'),
    ])
      .then(([c, p, tabs]) => {
        setCategories(c);
        setProducts(p);
        if (c.length) setActiveCat(c[0].id);
        const t = tabs.find((x) => x.id === tableId);
        setTableName(t?.name || '');
      })
      .catch((e) => setError(e.message));
    loadOrder().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Bu masanın siparişi başka cihazda güncellenirse (mutfak hazır dedi vb.) yenile.
  useSocketEvent(
    'order:update',
    (o: Order) => {
      // Yalnız bu masanın AÇIK siparişini yansıt; kapanan sipariş ekranda kalmasın.
      if (o?.table?.id === tableId && o.status === 'ACIK') setOrder(o);
    },
    [tableId],
  );

  const shownProducts = products.filter((p) => p.categoryId === activeCat);

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.price * l.quantity, 0),
    [cart],
  );
  const sentTotal = order?.total || 0;

  function addToCart(p: Product) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id && !l.note);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          price: p.price,
          station: p.station,
          quantity: 1,
          note: '',
        },
      ];
    });
  }
  function changeQty(idx: number, delta: number) {
    setCart((prev) => {
      const copy = [...prev];
      const q = copy[idx].quantity + delta;
      if (q <= 0) return copy.filter((_, i) => i !== idx);
      copy[idx] = { ...copy[idx], quantity: q };
      return copy;
    });
  }

  async function sendToKitchen() {
    if (cart.length === 0) return;
    setBusy(true);
    setError('');
    try {
      let orderId = order?.id;
      if (!orderId) {
        const opened = await api.post<Order>(`/orders/table/${tableId}/open`);
        orderId = opened.id;
      }
      await api.post(`/orders/${orderId}/items`, {
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          note: l.note || undefined,
        })),
      });
      setCart([]);
      await loadOrder();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reprint() {
    if (!order) return;
    setError('');
    try {
      const res = await api.post<{
        tickets: { station: string; preview: string; sent: boolean }[];
      }>(`/print/kitchen/${order.id}`, {});
      // Yazıcı bağlıysa gerçek basar; değilse fişi ekranda önizleme olarak göster.
      setPreview(res.tickets);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function printReceipt(orderId?: string) {
    const id = orderId ?? order?.id;
    if (!id) return;
    try {
      const res = await api.post<{ preview: string }>(
        `/print/receipt/${id}`,
        {},
      );
      setReceiptText(res.preview);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createEInvoice() {
    if (!lastClosedId) return;
    try {
      const inv = await api.post<{ docType: string; uuid: string; status: string }>(
        `/einvoice/from-order/${lastClosedId}`,
        { docType: 'EARSIV' },
      );
      setEinvoiceMsg(
        `✓ e-Arşiv oluşturuldu (${inv.status}) · ${inv.uuid.slice(0, 13)}…`,
      );
    } catch (e: any) {
      setEinvoiceMsg('Hata: ' + e.message);
    }
  }

  async function cancelOrder() {
    if (!order) return;
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/cancel`);
      navigate('/salon');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Üst bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/salon')}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
          >
            ← Salon
          </button>
          <h1 className="text-xl font-bold text-gray-800">
            Masa {order?.mergedLabel || tableName}
          </h1>
          {order?.mergedLabel && (
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
              🔗 Birleşik
            </span>
          )}
          {order && !order.mergedLabel && (
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
              Adisyon açık
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {order && (
            <>
              <Button variant="secondary" onClick={() => setMoveOpen(true)}>
                Masa Taşı/Birleştir
              </Button>
              <Button variant="danger" onClick={cancelOrder} disabled={busy}>
                Adisyonu İptal
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 px-5 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Sol: menü */}
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200">
          <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-white p-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeCat === c.id
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={
                  activeCat === c.id
                    ? { background: c.color || '#7c3aed' }
                    : undefined
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
            {shownProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand hover:shadow-md active:scale-95"
              >
                <div className="font-medium text-gray-800">{p.name}</div>
                <div className="mt-1 font-bold text-brand">
                  {p.price.toLocaleString('tr-TR')} ₺
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sağ: adisyon */}
        <div className="flex w-96 flex-col bg-white">
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {/* Gönderilmiş kalemler */}
            {order && order.items.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-gray-400">
                    Mutfağa gönderildi
                  </span>
                  <button
                    onClick={reprint}
                    className="text-xs text-brand hover:underline"
                  >
                    🖨 Fişi tekrar yazdır
                  </button>
                </div>
                <div className="space-y-2">
                  {order.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-start justify-between rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800">
                          {it.quantity} × {it.nameSnapshot}
                        </div>
                        {it.note && (
                          <div className="text-xs text-gray-500">
                            {it.note}
                          </div>
                        )}
                        <span
                          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            ITEM_STATUS[it.status]?.cls || 'bg-gray-200'
                          }`}
                        >
                          {ITEM_STATUS[it.status]?.label || it.status}
                        </span>
                        {order.mergedLabel && it.originLabel && (
                          <span
                            className={`ml-1 mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${originColor(
                              it.originLabel,
                              [...new Set(order.items.map((i) => i.originLabel || ''))],
                            )}`}
                          >
                            Masa {it.originLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-700">
                        {(it.unitPrice * it.quantity).toLocaleString('tr-TR')} ₺
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sepet (gönderilmemiş) */}
            <div className="mb-2 text-xs font-semibold uppercase text-gray-400">
              Yeni (gönderilmedi)
            </div>
            {cart.length === 0 && (
              <p className="text-sm text-gray-400">
                Soldan ürün seçerek adisyona ekleyin.
              </p>
            )}
            <div className="space-y-2">
              {cart.map((l, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {l.name}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {(l.price * l.quantity).toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                  {l.note && (
                    <div className="text-xs text-gray-500">{l.note}</div>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => changeQty(idx, -1)}
                      className="h-7 w-7 rounded bg-gray-200 font-bold hover:bg-gray-300"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{l.quantity}</span>
                    <button
                      onClick={() => changeQty(idx, 1)}
                      className="h-7 w-7 rounded bg-gray-200 font-bold hover:bg-gray-300"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setNoteFor(l)}
                      className="ml-auto text-xs text-brand hover:underline"
                    >
                      not ekle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alt: toplam + gönder + ödeme */}
          <div className="border-t border-gray-200 p-4">
            {order && order.discountAmount > 0 && (
              <div className="mb-1 flex justify-between text-sm text-green-600">
                <span>
                  İndirim
                  {order.discountReason ? ` (${order.discountReason})` : ''}
                </span>
                <span>−{tl(order.discountAmount)}</span>
              </div>
            )}
            {order && order.paidTotal > 0 && (
              <div className="mb-1 flex justify-between text-sm text-blue-600">
                <span>Ödenen</span>
                <span>{tl(order.paidTotal)}</span>
              </div>
            )}
            <div className="mb-3 flex justify-between text-lg font-bold text-gray-800">
              <span>{order && order.paidTotal > 0 ? 'Kalan' : 'Toplam'}</span>
              <span>
                {order ? tl(order.remaining + cartTotal) : tl(cartTotal)}
              </span>
            </div>

            {cart.length > 0 ? (
              <Button
                onClick={sendToKitchen}
                disabled={busy}
                className="w-full py-3 text-base"
              >
                {busy
                  ? 'Gönderiliyor…'
                  : `Mutfağa Gönder (${cart.reduce((s, l) => s + l.quantity, 0)})`}
              </Button>
            ) : (
              order && (
                <div className="space-y-2">
                  <Button
                    onClick={() => setPayOpen(true)}
                    className="w-full py-3 text-base"
                  >
                    💳 Ödeme / Hesap
                  </Button>
                  <div className="flex gap-2">
                    {canDiscount && (
                      <Button
                        variant="secondary"
                        onClick={() => setDiscOpen(true)}
                        className="flex-1"
                      >
                        % İskonto/İkram
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => printReceipt()}
                      className="flex-1"
                    >
                      🧾 Adisyon Fişi
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {noteFor && (
        <NoteModal
          line={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={(note) => {
            setCart((prev) =>
              prev.map((l) =>
                l.productId === noteFor.productId && l.note === noteFor.note
                  ? { ...l, note }
                  : l,
              ),
            );
            setNoteFor(null);
          }}
        />
      )}

      {moveOpen && order && (
        <MoveModal
          orderId={order.id}
          currentTableId={tableId}
          onClose={() => setMoveOpen(false)}
          onDone={() => {
            setMoveOpen(false);
            navigate('/salon');
          }}
        />
      )}

      {preview && (
        <Modal
          open
          title="Mutfak Fişi"
          onClose={() => setPreview(null)}
          footer={
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Kapat
            </Button>
          }
        >
          <p className="mb-3 text-sm text-gray-500">
            {preview.some((t) => t.sent)
              ? '✓ Fiş yazıcıya gönderildi.'
              : 'Yazıcı bağlı olmadığı için fişin önizlemesi aşağıdadır. Her istasyon için ayrı fiş çıkar:'}
          </p>
          <div className="space-y-3">
            {preview.map((t, i) => (
              <pre
                key={i}
                className="whitespace-pre-wrap rounded-lg border border-dashed border-gray-400 bg-gray-50 p-3 font-mono text-xs text-gray-800"
              >
                {t.preview}
              </pre>
            ))}
          </div>
        </Modal>
      )}

      {receiptText && (
        <Modal
          open
          title={justClosed ? 'Ödeme Tamamlandı — Adisyon Fişi' : 'Adisyon Fişi'}
          onClose={() => {
            setReceiptText(null);
            if (justClosed) {
              setJustClosed(false);
              navigate('/salon');
            }
          }}
          footer={
            <Button
              variant="secondary"
              onClick={() => {
                setReceiptText(null);
                if (justClosed) {
                  setJustClosed(false);
                  navigate('/salon');
                }
              }}
            >
              {justClosed ? 'Salona Dön' : 'Kapat'}
            </Button>
          }
        >
          <pre className="whitespace-pre-wrap rounded-lg border border-dashed border-gray-400 bg-gray-50 p-3 font-mono text-xs text-gray-800">
            {receiptText}
          </pre>
          {justClosed && (
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={createEInvoice}
                className="w-full"
              >
                🧾 e-Arşiv Fatura Oluştur
              </Button>
              {einvoiceMsg && (
                <p className="mt-2 text-center text-xs text-gray-600">
                  {einvoiceMsg}
                </p>
              )}
            </div>
          )}
        </Modal>
      )}

      {payOpen && order && (
        <PaymentModal
          order={order}
          onClose={() => setPayOpen(false)}
          onChanged={loadOrder}
          onClosed={(closed) => {
            setPayOpen(false);
            setJustClosed(true);
            setLastClosedId(closed.id);
            setEinvoiceMsg('');
            printReceipt(closed.id); // kapanan adisyonun fişini göster
          }}
        />
      )}

      {discOpen && order && (
        <DiscountModal
          order={order}
          onClose={() => setDiscOpen(false)}
          onSaved={() => {
            setDiscOpen(false);
            loadOrder();
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({
  order,
  onClose,
  onChanged,
  onClosed,
}: {
  order: Order;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onClosed: (closed: Order) => void;
}) {
  const [method, setMethod] = useState('NAKIT');
  const [amount, setAmount] = useState<number>(order.remaining);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [local, setLocal] = useState<Order>(order);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState('');
  const [tip, setTip] = useState<number>(order.tip ?? 0);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<{ id: string; name: string; phone?: string | null; loyaltyPoints: number }[]>([]);

  // Müşteri ara (ad/telefon) — müdavim tanıma / sadakat için.
  useEffect(() => {
    if (custSearch.trim().length < 2) { setCustResults([]); return; }
    const t = setTimeout(() => {
      api
        .get<{ id: string; name: string; phone?: string | null; loyaltyPoints: number }[]>(`/crm?search=${encodeURIComponent(custSearch)}`)
        .then((r) => setCustResults(r.slice(0, 6)))
        .catch(() => setCustResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [custSearch]);

  async function linkCustomer(customerId: string | null) {
    try {
      const updated = await api.patch<Order>(`/orders/${order.id}/customer`, { customerId });
      setLocal(updated);
      setCustSearch('');
      setCustResults([]);
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function redeemPoints() {
    if (!local.customer) return;
    const usable = Math.min(local.customer.loyaltyPoints, Math.floor(local.remaining));
    if (usable <= 0) { setErr('Kullanılabilir puan/tutar yok'); return; }
    try {
      const updated = await api.post<Order>(`/orders/${order.id}/redeem`, { points: usable });
      if (updated.status === 'KAPANDI') { onClosed(updated); return; }
      setLocal(updated);
      setAmount(updated.remaining);
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Bahşiş kaydet (adisyon tutarından ayrı). Alan dışına çıkınca (blur) kaydeder.
  async function saveTip() {
    if ((local.tip ?? 0) === Number(tip)) return;
    try {
      const updated = await api.patch<Order>(`/orders/${order.id}/tip`, {
        tip: Number(tip) || 0,
      });
      setLocal(updated);
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Açık hesap seçilince cari listesini yükle.
  useEffect(() => {
    if (method === 'ACIK_HESAP' && accounts.length === 0) {
      api
        .get<{ id: string; name: string }[]>('/accounts')
        .then(setAccounts)
        .catch(() => undefined);
    }
  }, [method, accounts.length]);

  const activeItems = local.items.filter((i) => i.status !== 'IPTAL');

  function toggle(id: string, lineTotal: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      // Seçili kalemlerin toplamını tutara yaz
      const sum = activeItems
        .filter((it) => n.has(it.id))
        .reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      setAmount(n.size ? Math.min(sum, local.remaining) : local.remaining);
      return n;
    });
    void lineTotal;
  }

  function splitBy(n: number) {
    setSelected(new Set());
    setAmount(Math.ceil((local.remaining / n) * 100) / 100);
  }

  async function pay() {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      if (method === 'ACIK_HESAP' && !accountId) {
        setErr('Açık hesap için bir cari seçin.');
        setBusy(false);
        return;
      }
      const updated = await api.post<Order>(`/orders/${order.id}/payments`, {
        method,
        amount: Number(amount),
        accountId: method === 'ACIK_HESAP' ? accountId : undefined,
      });
      if (updated.status === 'KAPANDI') {
        // Tam ödendi: modalı kapat, fişi göster, salona dön (onClosed yönetir).
        onClosed(updated);
        return;
      }
      setLocal(updated);
      setSelected(new Set());
      setAmount(updated.remaining);
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Ödeme — Masa ${order.table?.name ?? ''}`} onClose={onClose}>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}

      {/* Hesap bölme: kalem seç */}
      <div className="mb-3 max-h-40 overflow-auto rounded-lg border border-gray-200">
        {activeItems.map((it) => {
          const line = it.unitPrice * it.quantity;
          return (
            <label
              key={it.id}
              className="flex cursor-pointer items-center justify-between border-b border-gray-100 px-3 py-1.5 text-sm last:border-0 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(it.id)}
                  onChange={() => toggle(it.id, line)}
                />
                {it.quantity} × {it.nameSnapshot}
              </span>
              <span>{tl(line)}</span>
            </label>
          );
        })}
      </div>

      <div className="mb-3 flex gap-2 text-xs">
        <span className="text-gray-500">Hızlı böl:</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => splitBy(n)}
            className="rounded bg-gray-100 px-2 py-0.5 hover:bg-gray-200"
          >
            {n}'e böl
          </button>
        ))}
      </div>

      {/* Müşteri / sadakat */}
      <div className="mb-3 rounded-lg border border-gray-200 p-3 text-sm">
        {local.customer ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-gray-800">👤 {local.customer.name}</span>
              <span className="ml-2 text-xs text-brand">{local.customer.loyaltyPoints} puan</span>
            </div>
            <div className="flex gap-2">
              {local.customer.loyaltyPoints > 0 && local.remaining > 0 && (
                <button onClick={redeemPoints} className="rounded bg-brand/10 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/20">
                  Puan Kullan ({Math.min(local.customer.loyaltyPoints, Math.floor(local.remaining))}₺)
                </button>
              )}
              <button onClick={() => linkCustomer(null)} className="text-xs text-gray-400 hover:text-red-500">Kaldır</button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Müşteri:</span>
              <input
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                placeholder="ad / telefon ara (sadakat)…"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand"
              />
            </div>
            {custResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {custResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => linkCustomer(c.id)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{c.name} <span className="text-xs text-gray-400">{c.phone || ''}</span></span>
                    <span className="text-xs text-brand">{c.loyaltyPoints}p</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Özet */}
      <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
        <Row label="Net Tutar" value={tl(local.netTotal)} />
        {local.paidTotal > 0 && (
          <Row label="Ödenen" value={tl(local.paidTotal)} cls="text-blue-600" />
        )}
        <Row
          label="Kalan"
          value={tl(local.remaining)}
          cls="font-bold text-gray-800"
        />
        <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-gray-500">Bahşiş (₺)</span>
          <input
            type="number"
            value={tip}
            onChange={(e) => setTip(Number(e.target.value))}
            onBlur={saveTip}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-right outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            placeholder="0"
          />
        </div>
      </div>

      {/* Yöntem */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {Object.entries(METHOD_LABEL).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setMethod(k)}
            className={`rounded-lg border-2 py-2 text-sm font-medium ${
              method === k
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {method === 'ACIK_HESAP' && (
        <Field label="Cari Hesap (borç yazılacak)">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          >
            <option value="">— cari seçin —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {accounts.length === 0 && (
            <span className="text-xs text-gray-400">
              Cari yok — "Cari" menüsünden ekleyin.
            </span>
          )}
        </Field>
      )}

      <Field label="Tutar (₺)">
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </Field>

      <Button
        onClick={pay}
        disabled={busy || !(amount > 0)}
        className="w-full py-3 text-base"
      >
        {busy ? 'İşleniyor…' : `${METHOD_LABEL[method]} Al — ${tl(Number(amount) || 0)}`}
      </Button>

      {local.payments.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          Alınan ödemeler:{' '}
          {local.payments
            .map((p) => `${METHOD_LABEL[p.method] || (p.method === 'PUAN' ? 'Puan' : p.method)} ${tl(p.amount)}`)
            .join(', ')}
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  cls = '',
}: {
  label: string;
  value: string;
  cls?: string;
}) {
  return (
    <div className={`flex justify-between ${cls}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DiscountModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<string>(order.discountType || 'YUZDE');
  const [value, setValue] = useState<number>(order.discountValue ?? 10);
  const [reason, setReason] = useState(order.discountReason || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(remove = false) {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/orders/${order.id}/discount`, {
        type: remove ? null : type,
        value: Number(value),
        reason,
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
      title="İskonto / İkram"
      onClose={onClose}
      footer={
        <>
          {order.discountAmount > 0 && (
            <Button variant="secondary" onClick={() => save(true)} disabled={busy}>
              İskontoyu Kaldır
            </Button>
          )}
          <Button onClick={() => save(false)} disabled={busy}>
            Uygula
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setType('YUZDE')}
          className={`flex-1 rounded-lg border-2 py-2 text-sm ${type === 'YUZDE' ? 'border-brand bg-brand/10 text-brand' : 'border-gray-200'}`}
        >
          Yüzde (%)
        </button>
        <button
          onClick={() => setType('TUTAR')}
          className={`flex-1 rounded-lg border-2 py-2 text-sm ${type === 'TUTAR' ? 'border-brand bg-brand/10 text-brand' : 'border-gray-200'}`}
        >
          Tutar (₺)
        </button>
      </div>
      <Field label={type === 'YUZDE' ? 'Yüzde (%)' : 'Tutar (₺)'}>
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          autoFocus
        />
      </Field>
      <Field label="Açıklama (ikram sebebi vb.)">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Sadık müşteri, ikram…"
        />
      </Field>
      <p className="text-xs text-gray-400">
        Tam ikram için "Tutar" seçip adisyon tutarını girebilir ya da "%100"
        uygulayabilirsiniz.
      </p>
    </Modal>
  );
}

function NoteModal({
  line,
  onClose,
  onSave,
}: {
  line: CartLine;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(line.note);
  return (
    <Modal
      open
      title={`${line.name} — Not`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={() => onSave(note)}>Kaydet</Button>
        </>
      }
    >
      <Field label="Sipariş notu">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="az pişmiş, sossuz, acısız…"
          autoFocus
        />
      </Field>
    </Modal>
  );
}

function MoveModal({
  orderId,
  currentTableId,
  onClose,
  onDone,
}: {
  orderId: string;
  currentTableId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tables, setTables] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<any[]>('/tables').then(setTables).catch((e) => setErr(e.message));
  }, []);

  async function move(targetTableId: string) {
    setBusy(true);
    setErr('');
    try {
      // merge hedef boşsa taşımaya dönüşür, doluysa birleştirir.
      await api.post(`/orders/${orderId}/merge`, { targetTableId });
      onDone();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal open title="Masa Taşı / Birleştir" onClose={onClose}>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <p className="mb-3 text-sm text-gray-500">
        Hedef masa boşsa adisyon taşınır, doluysa birleştirilir.
      </p>
      <div className="grid max-h-80 grid-cols-3 gap-2 overflow-auto">
        {tables
          .filter((t) => t.id !== currentTableId)
          .map((t) => (
            <button
              key={t.id}
              disabled={busy}
              onClick={() => move(t.id)}
              className={`rounded-lg border-2 p-3 text-sm font-semibold disabled:opacity-50 ${
                t.status === 'DOLU'
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-brand'
              }`}
            >
              Masa {t.name}
              <div className="text-[10px] font-normal opacity-70">
                {t.status === 'DOLU' ? 'dolu → birleştir' : 'boş → taşı'}
              </div>
            </button>
          ))}
      </div>
    </Modal>
  );
}
