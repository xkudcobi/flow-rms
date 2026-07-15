import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import Combobox from '../components/Combobox';
import { Button, Field, Input, NumberInput, Select } from '../components/ui';

interface StockItem {
  id: string;
  name: string;
  unit: string;
  group?: string | null;
  quantity: number;
  criticalLevel: number;
  cost?: number;
  isLow?: boolean;
}
interface Product {
  id: string;
  name: string;
  categoryId: string;
  /** Reçetesi var mı — yoksa satışta stok düşmez, ekranda uyarılır. */
  hasRecipe?: boolean;
}
interface RecipeLine {
  id: string;
  stockItemId: string;
  quantity: number;
  stockItem: StockItem;
}

const UNITS = ['adet', 'kg', 'gr', 'lt', 'cl', 'ml'];
const num = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 });

export default function StockPage() {
  const [tab, setTab] = useState<'stok' | 'recete'>('stok');
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Stok Yönetimi</h1>
        <div data-tour="stok-tabs" className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <TabBtn active={tab === 'stok'} onClick={() => setTab('stok')}>
            Stok Kalemleri
          </TabBtn>
          <TabBtn active={tab === 'recete'} onClick={() => setTab('recete')}>
            Reçeteler
          </TabBtn>
        </div>
      </div>
      {tab === 'stok' ? <StockItems /> : <Recipes />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-white text-brand shadow-sm' : 'text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

function StockItems() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<StockItem | 'new' | null>(null);
  const [move, setMove] = useState<StockItem | null>(null);

  function load() {
    api
      .get<StockItem[]>('/stock/items')
      .then(setItems)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, []);

  const low = items.filter((i) => i.isLow);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        {low.length > 0 ? (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            ⚠ Kritik stok: {low.map((i) => i.name).join(', ')}
          </div>
        ) : (
          <span className="text-sm text-gray-400">
            Kritik seviyede stok yok.
          </span>
        )}
        <Button onClick={() => setEdit('new')}>+ Stok Kalemi</Button>
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Hammadde</th>
              <th className="px-4 py-3 text-right">Mevcut</th>
              <th className="px-4 py-3 text-right">Kritik</th>
              <th className="px-4 py-3 text-right">Maliyet</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                className={`border-t border-gray-100 ${it.isLow ? 'bg-red-50/50' : ''}`}
              >
                <td className="px-4 py-3 font-medium text-gray-800">
                  {it.name}
                </td>
                <td className="px-4 py-3 text-right">
                  {num(it.quantity)} {it.unit}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {num(it.criticalLevel)} {it.unit}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {it.cost ? `${num(it.cost)} ₺/${it.unit}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {it.isLow ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Kritik
                    </span>
                  ) : (
                    <span className="text-green-600">Yeterli</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setMove(it)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      hareket
                    </button>
                    <button
                      onClick={() => setEdit(it)}
                      className="text-xs text-gray-500 hover:text-brand"
                    >
                      düzenle
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Henüz stok kalemi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <ItemForm
          value={edit === 'new' ? null : edit}
          knownGroups={[
            ...new Set(items.map((i) => i.group).filter((g): g is string => !!g)),
          ].sort((a, b) => a.localeCompare(b, 'tr'))}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
      {move && (
        <MovementForm
          item={move}
          onClose={() => setMove(null)}
          onSaved={() => {
            setMove(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ItemForm({
  value,
  knownGroups,
  onClose,
  onSaved,
}: {
  value: StockItem | null;
  /** Mevcut kalemlerden toplanan grup adları — datalist önerisi için. */
  knownGroups: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.name || '');
  const [unit, setUnit] = useState(value?.unit || 'adet');
  const [group, setGroup] = useState(value?.group || '');
  const [quantity, setQuantity] = useState<number>(value?.quantity ?? 0);
  const [criticalLevel, setCritical] = useState<number>(
    value?.criticalLevel ?? 0,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      // Boş grup null olarak gitsin — "" ile null'ı karıştırmayalım.
      const groupValue = group.trim() || null;
      if (value) {
        await api.patch(`/stock/items/${value.id}`, {
          name,
          unit,
          group: groupValue,
          criticalLevel: Number(criticalLevel),
        });
      } else {
        await api.post('/stock/items', {
          name,
          unit,
          group: groupValue,
          quantity: Number(quantity),
          criticalLevel: Number(criticalLevel),
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={value ? 'Stok Kalemi Düzenle' : 'Yeni Stok Kalemi'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            Kaydet
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Hammadde Adı">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Birim">
        <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Grup (reçete seçicisinde gruplamak için)">
        {/* Serbest metin + mevcut grupların önerisi: işletme kendi grubunu
            yazabilsin, ama var olanı da tek tıkla seçebilsin. */}
        <Input
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          list="stok-gruplari"
          placeholder="ör. Et Ürünleri, Kuru Gıda — boş bırakılabilir"
        />
        <datalist id="stok-gruplari">
          {knownGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Field>
      {!value && (
        <Field label="Başlangıç Miktarı">
          <NumberInput value={quantity} onChange={setQuantity} placeholder="0" />
        </Field>
      )}
      <Field label="Kritik Seviye (bu değere inince uyarı)">
        <NumberInput value={criticalLevel} onChange={setCritical} placeholder="0" />
      </Field>
    </Modal>
  );
}

function MovementForm({
  item,
  onClose,
  onSaved,
}: {
  item: StockItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState('GIRIS');
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const labels: Record<string, string> = {
    GIRIS: 'Giriş (alım)',
    FIRE: 'Fire (zayi)',
    SAYIM: 'Sayım (mevcut miktarı düzelt)',
  };

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/stock/items/${item.id}/movement`, {
        type,
        quantity: Number(quantity),
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
      title={`Stok Hareketi — ${item.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy}>
            Kaydet
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <p className="mb-3 text-sm text-gray-500">
        Mevcut: {num(item.quantity)} {item.unit}
      </p>
      <Field label="Hareket Türü">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={
          type === 'SAYIM'
            ? `Yeni Mevcut Miktar (${item.unit})`
            : `Miktar (${item.unit})`
        }
      >
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          autoFocus
        />
      </Field>
      <Field label="Not (opsiyonel)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

function Recipes() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [error, setError] = useState('');

  function load() {
    api
      .get<Product[]>('/menu/products')
      .then(setProducts)
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const eksik = products.filter((p) => !p.hasRecipe).length;

  return (
    <>
      {error && <p className="mb-3 text-red-600">{error}</p>}
      <p className="mb-3 text-sm text-gray-500">
        Bir ürünün reçetesini tanımlayın; o ürün satılınca hammaddeler otomatik
        düşer.
      </p>

      {/* Reçetesi olmayan ürün satılınca stoktan hiçbir şey düşmez. Bu sessiz
          davranış "stok çalışmıyor" sanılmasına yol açıyordu — açıkça söyle. */}
      {eksik > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-light px-3 py-2.5 text-sm">
          <span className="text-warning">⚠</span>
          <span className="text-ink">
            <b>{eksik} ürünün reçetesi yok.</b> Bu ürünler satıldığında stoktan
            hiçbir şey düşmez. Aşağıda “reçete yok” işaretli olanlar.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm hover:border-brand ${
              p.hasRecipe ? 'border-gray-200' : 'border-warning/40'
            }`}
          >
            <div className="font-medium text-gray-800">{p.name}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs text-brand">reçeteyi düzenle →</span>
              {!p.hasRecipe && (
                <span className="shrink-0 rounded bg-warning-light px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  reçete yok
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {editing && (
        <RecipeEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(); // "reçete yok" rozeti kaydedince güncellensin
          }}
        />
      )}
    </>
  );
}

function RecipeEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [lines, setLines] = useState<{ stockItemId: string; quantity: number }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<StockItem[]>('/stock/items'),
      api.get<RecipeLine[]>(`/stock/recipe/${product.id}`),
    ])
      .then(([si, recipe]) => {
        setStockItems(si);
        setLines(
          recipe.map((r) => ({ stockItemId: r.stockItemId, quantity: r.quantity })),
        );
      })
      .catch((e) => setErr(e.message));
  }, [product.id]);

  function addLine() {
    if (stockItems.length === 0) return;
    // Boş başla: eskiden listenin ilk hammaddesi otomatik seçiliyordu ve
    // kullanıcı değiştirmeyi unutunca yanlış reçete kaydediliyordu.
    // Combobox boşken "Hammadde ara…" yazar, seçim bilinçli olur.
    setLines((p) => [...p, { stockItemId: '', quantity: 1 }]);
  }
  function setLine(i: number, patch: Partial<{ stockItemId: string; quantity: number }>) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
  }

  async function save() {
    // Seçilmemiş satır (stockItemId boş) sunucuda 500'e yol açardı — burada ele.
    const gecerli = lines.filter((l) => l.stockItemId && l.quantity > 0);
    if (lines.length > 0 && gecerli.length === 0) {
      setErr('En az bir hammadde seçip miktar girin.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.put(`/stock/recipe/${product.id}`, { items: gecerli });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Reçete — ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy}>
            Kaydet
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      {stockItems.length === 0 ? (
        <p className="text-sm text-gray-500">
          Önce "Stok Kalemleri" sekmesinden hammadde ekleyin.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const si = stockItems.find((s) => s.id === l.stockItemId);
              return (
                <div key={i} className="flex items-center gap-2">
                  <Combobox
                    className="min-w-0 flex-1"
                    value={l.stockItemId}
                    onChange={(v) => setLine(i, { stockItemId: v })}
                    placeholder="Hammadde ara…"
                    emptyText="Bu isimde hammadde yok"
                    options={stockItems.map((s) => ({
                      value: s.id,
                      label: s.name,
                      group: s.group || undefined,
                      hint: s.unit,
                    }))}
                  />
                  <NumberInput
                    value={l.quantity}
                    onChange={(n) => setLine(i, { quantity: n })}
                    placeholder="0"
                    className="w-24 shrink-0"
                  />
                  <span className="w-8 shrink-0 text-xs text-gray-400">{si?.unit}</span>
                  <button
                    onClick={() => removeLine(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {lines.length === 0 && (
              <p className="text-sm text-gray-400">
                Bu ürünün reçetesi yok. "+ Hammadde ekle" ile ekleyin.
              </p>
            )}
          </div>
          <button
            onClick={addLine}
            className="mt-3 text-sm font-medium text-brand hover:underline"
          >
            + Hammadde ekle
          </button>
        </>
      )}
    </Modal>
  );
}
