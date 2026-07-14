import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import { Button, Field, Input, Select } from '../components/ui';

interface Category {
  id: string;
  name: string;
  color?: string;
  sortOrder: number;
}
interface Product {
  id: string;
  name: string;
  price: number;
  station: string;
  categoryId: string;
}

const STATIONS = ['MUTFAK', 'BAR', 'IZGARA', 'TATLI'];

export default function MenuPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'PATRON' || user?.role === 'MUDUR';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');

  const [catModal, setCatModal] = useState<Category | 'new' | null>(null);
  const [prodModal, setProdModal] = useState<Product | 'new' | null>(null);

  async function load() {
    try {
      const [c, p] = await Promise.all([
        api.get<Category[]>('/menu/categories'),
        api.get<Product[]>('/menu/products'),
      ]);
      setCategories(c);
      setProducts(p);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Menü Yönetimi</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button data-tour="menu-add-category" variant="secondary" onClick={() => setCatModal('new')}>
              + Kategori
            </Button>
            <Button
              data-tour="menu-add-product"
              onClick={() => setProdModal('new')}
              disabled={categories.length === 0}
            >
              + Ürün
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="space-y-6">
        {categories.map((cat) => {
          const items = products.filter((p) => p.categoryId === cat.id);
          return (
            <div key={cat.id}>
              <div className="mb-2 flex items-center gap-2">
                <h2
                  className="inline-block rounded-md px-3 py-1 text-sm font-semibold text-white"
                  style={{ background: cat.color || '#6b7280' }}
                >
                  {cat.name}
                </h2>
                {canEdit && (
                  <>
                    <button
                      onClick={() => setCatModal(cat)}
                      className="text-xs text-gray-500 hover:text-brand"
                    >
                      düzenle
                    </button>
                    <button
                      onClick={() => remove('categories', cat.id, load, setError)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      sil
                    </button>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="font-medium text-gray-800">{p.name}</div>
                    <div className="mt-1 text-lg font-bold text-brand">
                      {p.price.toLocaleString('tr-TR')} ₺
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-400">{p.station}</span>
                      {canEdit && (
                        <div className="hidden gap-2 group-hover:flex">
                          <button
                            onClick={() => setProdModal(p)}
                            className="text-xs text-gray-500 hover:text-brand"
                          >
                            düzenle
                          </button>
                          <button
                            onClick={() =>
                              remove('products', p.id, load, setError)
                            }
                            className="text-xs text-gray-400 hover:text-red-500"
                          >
                            sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-gray-400">Ürün yok.</p>
                )}
              </div>
            </div>
          );
        })}
        {categories.length === 0 && (
          <p className="text-gray-400">
            Henüz kategori yok. {canEdit && '"+ Kategori" ile başlayın.'}
          </p>
        )}
      </div>

      {catModal && (
        <CategoryForm
          value={catModal === 'new' ? null : catModal}
          onClose={() => setCatModal(null)}
          onSaved={() => {
            setCatModal(null);
            load();
          }}
        />
      )}
      {prodModal && (
        <ProductForm
          value={prodModal === 'new' ? null : prodModal}
          categories={categories}
          onClose={() => setProdModal(null)}
          onSaved={() => {
            setProdModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

async function remove(
  kind: 'categories' | 'products',
  id: string,
  reload: () => void,
  setError: (s: string) => void,
) {
  try {
    await api.delete(`/menu/${kind}/${id}`);
    reload();
  } catch (e: any) {
    setError(e.message);
  }
}

function CategoryForm({
  value,
  onClose,
  onSaved,
}: {
  value: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.name || '');
  const [color, setColor] = useState(value?.color || '#7c3aed');
  const [sortOrder, setSortOrder] = useState(value?.sortOrder ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const body = { name, color, sortOrder: Number(sortOrder) };
      if (value) await api.patch(`/menu/categories/${value.id}`, body);
      else await api.post('/menu/categories', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={value ? 'Kategori Düzenle' : 'Yeni Kategori'}
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
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Kategori Adı">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Renk">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-20 cursor-pointer rounded border border-gray-300"
        />
      </Field>
      <Field label="Sıra">
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </Field>
    </Modal>
  );
}

function ProductForm({
  value,
  categories,
  onClose,
  onSaved,
}: {
  value: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.name || '');
  const [price, setPrice] = useState<number>(value?.price ?? 0);
  const [categoryId, setCategoryId] = useState(
    value?.categoryId || categories[0]?.id || '',
  );
  const [station, setStation] = useState(value?.station || 'MUTFAK');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const body = { name, price: Number(price), categoryId, station };
      if (value) await api.patch(`/menu/products/${value.id}`, body);
      else await api.post('/menu/products', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={value ? 'Ürün Düzenle' : 'Yeni Ürün'}
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
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Ürün Adı">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Fiyat (₺)">
        <Input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </Field>
      <Field label="Kategori">
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Hazırlık İstasyonu">
        <Select value={station} onChange={(e) => setStation(e.target.value)}>
          {STATIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
