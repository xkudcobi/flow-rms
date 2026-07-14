import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, ReceiptText, Minus, Plus, Star } from 'lucide-react';
import { api } from '../api/client';

interface Category {
  id: string;
  name: string;
  color?: string;
}
interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
}
interface TableInfo {
  table: { id: string; name: string; floor?: string };
  order: { total: number; items: { nameSnapshot: string; quantity: number; status: string }[] } | null;
}
interface Line {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';

export default function PublicMenuPage() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  async function loadInfo() {
    try {
      setInfo(await api.get<TableInfo>(`/public/t/${token}`));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    loadInfo();
    api
      .get<{ categories: Category[]; products: Product[] }>('/public/menu')
      .then((m) => {
        setCats(m.categories);
        setProducts(m.products);
        if (m.categories.length) setActiveCat(m.categories[0].id);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }
  function add(p: Product) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], quantity: c[i].quantity + 1 };
        return c;
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }
  function changeQty(i: number, d: number) {
    setCart((prev) => {
      const c = [...prev];
      const q = c[i].quantity + d;
      if (q <= 0) return c.filter((_, idx) => idx !== i);
      c[i] = { ...c[i], quantity: q };
      return c;
    });
  }

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart]);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const shown = products.filter((p) => p.categoryId === activeCat);

  async function sendOrder() {
    if (cart.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/public/t/${token}/order`, {
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
      setCart([]);
      flash('Siparişiniz mutfağa iletildi ✓');
      loadInfo();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function call(type: 'GARSON' | 'HESAP') {
    try {
      await api.post(`/public/t/${token}/call`, { type });
      flash(type === 'GARSON' ? 'Garson çağrıldı 🔔' : 'Hesap istendi 🧾');
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !info) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6 text-center text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Üst bar */}
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-white">
        <div>
          <div className="font-display text-lg font-bold">FLOW</div>
          <div className="text-[11px] text-white/60">
            Masa {info?.table.name} {info?.table.floor ? `· ${info.table.floor}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => call('GARSON')} className="flex items-center gap-1 rounded bg-white/15 px-2.5 py-1.5 text-xs font-semibold">
            <Bell size={14} /> Garson
          </button>
          <button onClick={() => call('HESAP')} className="flex items-center gap-1 rounded bg-white/15 px-2.5 py-1.5 text-xs font-semibold">
            <ReceiptText size={14} /> Hesap
          </button>
        </div>
      </header>

      {/* Mevcut adisyon özeti */}
      {info?.order && info.order.items.length > 0 && (
        <div className="border-b border-line bg-brand/5 px-4 py-2 text-xs text-muted">
          Masanızda {info.order.items.reduce((s, i) => s + i.quantity, 0)} ürün · {tl(info.order.total)}
        </div>
      )}

      {/* Kategori sekmeleri */}
      <div className="flex gap-2 overflow-x-auto border-b border-line bg-surface-card px-3 py-2">
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              activeCat === c.id ? 'bg-brand text-white' : 'bg-surface-high text-muted'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Ürünler */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-28">
        <div className="space-y-2">
          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-surface-card px-4 py-3 text-left active:bg-surface-low"
            >
              <span className="font-medium text-ink">{p.name}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-brand">{tl(p.price)}</span>
                <Plus size={18} className="text-brand" />
              </span>
            </button>
          ))}
        </div>

        {/* Geri bildirim */}
        <div className="mt-6">
          {!showFeedback ? (
            <button onClick={() => setShowFeedback(true)} className="w-full rounded-lg border border-dashed border-line py-3 text-sm text-muted">
              ⭐ Deneyiminizi değerlendirin
            </button>
          ) : (
            <FeedbackBox token={token} onDone={() => { setShowFeedback(false); flash('Geri bildiriminiz için teşekkürler 🙏'); }} />
          )}
        </div>
      </div>

      {/* Sepet çubuğu */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface-card p-3 shadow-float">
          <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
            {cart.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink">{l.name}</span>
                <span className="flex items-center gap-2">
                  <button onClick={() => changeQty(i, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-surface-high"><Minus size={14} /></button>
                  <span className="w-5 text-center">{l.quantity}</span>
                  <button onClick={() => changeQty(i, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-surface-high"><Plus size={14} /></button>
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={sendOrder}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            <span>{busy ? 'Gönderiliyor…' : `Sipariş Ver (${cartCount})`}</span>
            <span>{tl(cartTotal)}</span>
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-float">
          {toast}
        </div>
      )}
    </div>
  );
}

function FeedbackBox({ token, onDone }: { token: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (rating < 1) return;
    setBusy(true);
    try {
      await api.post(`/public/t/${token}/feedback`, { rating, comment: comment || undefined });
      onDone();
    } catch {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-lg border border-line bg-surface-card p-4">
      <div className="mb-2 text-sm font-semibold text-ink">Deneyiminiz nasıldı?</div>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)}>
            <Star size={28} className={n <= rating ? 'fill-warning text-warning' : 'text-line'} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Yorumunuz (opsiyonel)"
        className="mb-3 w-full rounded border border-line px-3 py-2 text-sm"
        rows={2}
      />
      <button onClick={send} disabled={busy || rating < 1} className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white disabled:opacity-50">
        Gönder
      </button>
    </div>
  );
}
