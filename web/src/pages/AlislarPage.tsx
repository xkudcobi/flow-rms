import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import Combobox from '../components/Combobox';
import { Button, Field, Input, NumberInput, Select } from '../components/ui';
import { downloadCSV, printHTML, esc } from '../utils/export';

interface StockItem {
  id: string;
  name: string;
  unit: string;
  group?: string | null;
}
interface Account {
  id: string;
  name: string;
  taxNumber?: string | null;
  taxOffice?: string | null;
  phone?: string | null;
}
interface PItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  lineNet: number;
  lineVat: number;
  lineTotal: number;
  stockItemId?: string | null;
}
interface Purchase {
  id: string;
  invoiceNo?: string;
  invoiceDate: string;
  category?: string;
  paymentStatus: string;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  supplier?: { name: string } | null;
  items: PItem[];
}

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
const dmy = (s: string) => new Date(s).toLocaleDateString('tr-TR');
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const VAT_RATES = [0, 1, 10, 20];
const CATEGORIES = [
  ['GIDA', 'Gıda'],
  ['ICECEK', 'İçecek'],
  ['TEMIZLIK', 'Temizlik'],
  ['AMBALAJ', 'Ambalaj'],
  ['DEMIRBAS', 'Demirbaş'],
  ['GENEL_GIDER', 'Genel Gider (kira/fatura)'],
  ['DIGER', 'Diğer'],
];
const CAT_LABEL = Object.fromEntries(CATEGORIES);

export default function AlislarPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [list, setList] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);

  function load() {
    const q = `?from=${from}&to=${to}`;
    Promise.all([
      api.get<Purchase[]>(`/purchases${q}`),
      api.get<any>(`/purchases/summary${q}`),
    ])
      .then(([l, s]) => {
        setList(l);
        setSummary(s);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  function exportCSV() {
    downloadCSV(
      `alislar_${from}_${to}`,
      ['Tarih', 'Fatura No', 'Tedarikçi', 'Kategori', 'Ödeme', 'Ara Toplam', 'KDV', 'Genel Toplam'],
      list.map((p) => [
        dmy(p.invoiceDate),
        p.invoiceNo ?? '',
        p.supplier?.name ?? '',
        CAT_LABEL[p.category ?? ''] ?? p.category ?? '',
        p.paymentStatus === 'ACIK' ? 'Açık' : 'Peşin',
        p.subtotal,
        p.vatTotal,
        p.grandTotal,
      ]),
    );
  }
  function exportPDF() {
    const rows = list
      .map(
        (p) => `<tr><td>${dmy(p.invoiceDate)}</td><td>${esc(p.invoiceNo ?? '')}</td>
        <td>${esc(p.supplier?.name ?? '')}</td><td>${esc(CAT_LABEL[p.category ?? ''] ?? '')}</td>
        <td class="right">${p.subtotal.toLocaleString('tr-TR')}</td>
        <td class="right">${p.vatTotal.toLocaleString('tr-TR')}</td>
        <td class="right">${p.grandTotal.toLocaleString('tr-TR')} ₺</td></tr>`,
      )
      .join('');
    printHTML(
      `Alışlar ${from} — ${to}`,
      `<h1>Alış / Gider Raporu</h1><div class="sub">${from} — ${to} · Toplam ${summary?.grandTotal?.toLocaleString('tr-TR')} ₺ · KDV ${summary?.vatTotal?.toLocaleString('tr-TR')} ₺</div>
       <table><thead><tr><th>Tarih</th><th>Fatura</th><th>Tedarikçi</th><th>Kategori</th><th class="right">Net</th><th class="right">KDV</th><th class="right">Toplam</th></tr></thead><tbody>${rows}</tbody></table>`,
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Alışlar / Giderler</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
          <span className="text-gray-400">—</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
          <Button variant="secondary" onClick={exportCSV}>⬇ CSV</Button>
          <Button variant="secondary" onClick={exportPDF}>🖨 PDF</Button>
          <Button onClick={() => setAddOpen(true)}>+ Alış Faturası</Button>
        </div>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Toplam Alış (KDV dahil)" value={tl(summary.grandTotal)} accent />
          <Stat label="Toplam KDV (indirilecek)" value={tl(summary.vatTotal)} />
          <Stat label="Fatura Sayısı" value={String(summary.count)} />
        </div>
      )}

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Fatura No</th>
              <th className="px-4 py-3">Tedarikçi</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Ödeme</th>
              <th className="px-4 py-3 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} onClick={() => setDetail(p)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{dmy(p.invoiceDate)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{p.invoiceNo || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.supplier?.name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{CAT_LABEL[p.category ?? ''] || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.paymentStatus === 'ACIK' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {p.paymentStatus === 'ACIK' ? 'Açık' : 'Peşin'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{tl(p.grandTotal)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Bu aralıkta alış yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <PurchaseForm onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />
      )}
      {detail && <PurchaseDetail purchase={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-brand/30 bg-brand/5' : 'border-gray-200 bg-white'}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ? 'text-brand' : 'text-gray-800'}`}>{value}</div>
    </div>
  );
}

interface LineForm {
  name: string;
  stockItemId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
}
const emptyLine = (): LineForm => ({ name: '', stockItemId: '', quantity: 1, unit: 'adet', unitPrice: 0, vatRate: 1 });

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [suppliers, setSuppliers] = useState<Account[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [category, setCategory] = useState('GIDA');
  const [note, setNote] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PESIN');
  const [paymentMethod, setPaymentMethod] = useState('NAKIT');
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [newSupOpen, setNewSupOpen] = useState(false);
  // Satırdan yeni stok kalemi / menü ürünü oluşturma — hangi satır için açıldı.
  const [newItemFor, setNewItemFor] = useState<number | null>(null);

  // Seçili tedarikçinin vergi bilgileri; seçince otomatik görünür.
  const supplier = suppliers.find((s) => s.id === supplierId);

  function loadSuppliers() {
    return api
      .get<Account[]>('/accounts?type=TEDARIKCI')
      .then(setSuppliers)
      .catch(() => undefined);
  }
  function loadStock() {
    return api
      .get<StockItem[]>('/stock/items')
      .then(setStockItems)
      .catch(() => undefined);
  }
  useEffect(() => {
    loadSuppliers();
    loadStock();
  }, []);

  function setLine(i: number, patch: Partial<LineForm>) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickStock(i: number, stockItemId: string) {
    const si = stockItems.find((s) => s.id === stockItemId);
    setLine(i, si ? { stockItemId, name: si.name, unit: si.unit } : { stockItemId: '' });
  }

  const totals = useMemo(() => {
    let net = 0, vat = 0;
    for (const l of lines) {
      const n = l.quantity * l.unitPrice;
      net += n;
      vat += (n * l.vatRate) / 100;
    }
    return { net, vat, grand: net + vat };
  }, [lines]);

  async function save() {
    const valid = lines.filter((l) => l.name.trim() && l.quantity > 0);
    if (valid.length === 0) { setErr('En az bir geçerli kalem girin.'); return; }
    setBusy(true); setErr('');
    try {
      await api.post('/purchases', {
        supplierId: supplierId || undefined,
        invoiceNo: invoiceNo || undefined,
        invoiceDate,
        category,
        note: note.trim() || undefined,
        paymentStatus,
        paymentMethod: paymentStatus === 'PESIN' ? paymentMethod : undefined,
        items: valid.map((l) => ({
          stockItemId: l.stockItemId || undefined,
          name: l.name,
          quantity: Number(l.quantity),
          unit: l.unit,
          unitPrice: Number(l.unitPrice),
          vatRate: Number(l.vatRate),
        })),
      });
      onSaved();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    // Tam ekran: eskiden max-w-md bir modaldı — kalemler, KDV ve toplamlar o
    // dar alana sığmıyordu. Artık fatura girişi kendi ekranında.
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface-card px-4 py-3 md:px-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          Yeni Alış Faturası
        </h2>
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="rounded p-1.5 text-faint transition-colors hover:bg-surface-high hover:text-ink"
        >
          <X size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tedarikçi / Market">
          <div className="flex gap-2">
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="flex-1"
            >
              <option value="">— seçin —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setNewSupOpen(true)}
              className="whitespace-nowrap rounded-lg border border-brand px-2 text-sm font-medium text-brand hover:bg-brand/5"
              title="Yeni tedarikçi ekle"
            >
              + Yeni
            </button>
          </div>
        </Field>
        <Field label="Kategori">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Fatura / Fiş No">
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </Field>
        <Field label="Fatura Tarihi">
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </Field>
      </div>

      {/* Tedarikçi seçilince vergi bilgileri kendiliğinden görünür — cari
          kartında zaten kayıtlı, kullanıcı tekrar yazmasın/aramasın. */}
      {supplier && (supplier.taxNumber || supplier.taxOffice || supplier.phone) && (
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-xs">
          {supplier.taxNumber && (
            <span className="text-muted">
              Vergi No: <b className="tabular text-ink">{supplier.taxNumber}</b>
            </span>
          )}
          {supplier.taxOffice && (
            <span className="text-muted">
              Vergi Dairesi: <b className="text-ink">{supplier.taxOffice}</b>
            </span>
          )}
          {supplier.phone && (
            <span className="text-muted">
              Tel: <b className="text-ink">{supplier.phone}</b>
            </span>
          )}
        </div>
      )}
      {supplier && !supplier.taxNumber && (
        <p className="mb-3 text-xs text-faint">
          Bu tedarikçinin vergi numarası kayıtlı değil — Cari ekranından
          ekleyebilirsiniz.
        </p>
      )}

      <div className="mb-2 mt-2 flex gap-2">
        <button onClick={() => setPaymentStatus('PESIN')} className={`flex-1 rounded-lg border-2 py-1.5 text-sm ${paymentStatus === 'PESIN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>Peşin</button>
        <button onClick={() => setPaymentStatus('ACIK')} className={`flex-1 rounded-lg border-2 py-1.5 text-sm ${paymentStatus === 'ACIK' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}>Açık (veresiye → tedarikçi cariye borç)</button>
      </div>

      {paymentStatus === 'PESIN' && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Ödeme Yöntemi</div>
          <div className="flex gap-2">
            {[['NAKIT', 'Nakit'], ['KREDI_KARTI', 'Kredi Kartı'], ['HAVALE', 'Havale/EFT']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPaymentMethod(k)}
                className={`flex-1 rounded-lg border-2 py-1.5 text-sm ${paymentMethod === k ? 'border-brand bg-brand/10 text-brand' : 'border-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {paymentMethod === 'NAKIT' && (
            <p className="mt-1 text-[11px] text-muted">Nakit ödeme kasadan otomatik düşülür.</p>
          )}
        </div>
      )}

      {/* Kalemler */}
      <div className="mb-2 mt-3 text-xs font-semibold uppercase text-gray-400">Kalemler</div>
      <div className="space-y-2">
        {lines.map((l, i) => {
          const net = l.quantity * l.unitPrice;
          const total = net * (1 + l.vatRate / 100);
          return (
            <div key={i} className="rounded-lg border border-line bg-surface-card p-3">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                <div className="flex gap-2 sm:w-64">
                  <Combobox
                    className="min-w-0 flex-1"
                    value={l.stockItemId}
                    onChange={(v) => pickStock(i, v)}
                    placeholder="Stok kalemi (opsiyonel)"
                    emptyText="Bulunamadı — “+ Yeni” ile ekleyin"
                    options={stockItems.map((s) => ({
                      value: s.id,
                      label: s.name,
                      group: s.group || undefined,
                      hint: s.unit,
                    }))}
                  />
                  <button
                    type="button"
                    onClick={() => setNewItemFor(i)}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-brand px-2 text-sm font-medium text-brand hover:bg-brand/5"
                    title="Yeni stok kalemi veya menü ürünü oluştur"
                  >
                    + Yeni
                  </button>
                </div>
                <Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Ürün adı (faturada yazan)" className="flex-1" />
                <button
                  onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                  className="shrink-0 self-center px-1 text-red-500"
                  title="Satırı sil"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <NumberInput value={l.quantity} onChange={(n) => setLine(i, { quantity: n })} className="w-20" placeholder="miktar" />
                <Input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className="w-20" placeholder="birim" />
                <span className="text-gray-400">×</span>
                <NumberInput value={l.unitPrice} onChange={(n) => setLine(i, { unitPrice: n })} className="w-28" placeholder="birim fiyat" />
                <span className="text-xs text-gray-400">KDV</span>
                <Select value={l.vatRate} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })} className="w-20">
                  {VAT_RATES.map((r) => <option key={r} value={r}>%{r}</option>)}
                </Select>
                <span className="ml-auto font-semibold tabular text-gray-700">{tl(total)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setLines((p) => [...p, emptyLine()])} className="mt-2 text-sm font-medium text-brand hover:underline">+ Kalem ekle</button>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="Fatura Notu (opsiyonel)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="ör. 2 kasa çürük çıktı, iade edilecek · sonraki teslimat Salı"
            className="w-full rounded border border-line bg-surface-card px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </Field>
        <div className="space-y-1 self-start rounded-lg bg-surface-low p-3 text-sm">
          <div className="flex justify-between text-gray-600"><span>Ara Toplam (KDV hariç)</span><span className="tabular">{tl(totals.net)}</span></div>
          <div className="flex justify-between text-gray-600"><span>KDV</span><span className="tabular">{tl(totals.vat)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 text-lg font-bold text-gray-800"><span>Genel Toplam</span><span className="tabular">{tl(totals.grand)}</span></div>
        </div>
      </div>
        </div>
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t border-line bg-surface-card px-4 py-3 md:px-6">
        <Button variant="secondary" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </footer>

      {newSupOpen && (
        <QuickSupplierForm
          onClose={() => setNewSupOpen(false)}
          onCreated={async (id) => {
            await loadSuppliers();
            setSupplierId(id);
            setNewSupOpen(false);
          }}
        />
      )}
      {newItemFor !== null && (
        <NewItemForm
          onClose={() => setNewItemFor(null)}
          onCreated={async (created) => {
            const i = newItemFor;
            if (created.kind === 'stock') {
              await loadStock();
              setLine(i, {
                stockItemId: created.id,
                name: created.name,
                unit: created.unit,
              });
            } else {
              // Menü ürünü stoğa bağlanmaz (PurchaseItem yalnız stockItemId
              // tutar) — satır serbest metin olarak adıyla devam eder.
              setLine(i, { stockItemId: '', name: created.name });
            }
            setNewItemFor(null);
          }}
        />
      )}
    </div>
  );
}

type CreatedItem =
  | { kind: 'stock'; id: string; name: string; unit: string }
  | { kind: 'product'; id: string; name: string };

/**
 * Fatura satırından yeni kalem oluşturma.
 *
 * İki tür: hammadde (stok kalemi) → satıra bağlanır ve stok takibi yapılır;
 * menü ürünü → satılacak ürün olarak menüye eklenir. Faturayı girerken
 * "bu ürün sistemde yok" diye ekranı terk etmek gerekmesin.
 */
function NewItemForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (item: CreatedItem) => void;
}) {
  const [kind, setKind] = useState<'stock' | 'product'>('stock');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('adet');
  const [group, setGroup] = useState('');
  const [price, setPrice] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<{ id: string; name: string }[]>('/menu/categories')
      .then((c) => {
        setCats(c);
        if (c.length) setCategoryId(c[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      if (kind === 'stock') {
        const si = await api.post<{ id: string; name: string; unit: string }>(
          '/stock/items',
          { name: name.trim(), unit, group: group.trim() || null, quantity: 0, criticalLevel: 0 },
        );
        onCreated({ kind: 'stock', id: si.id, name: si.name, unit: si.unit });
      } else {
        if (!categoryId) {
          setErr('Önce Menü ekranından bir kategori oluşturun.');
          setBusy(false);
          return;
        }
        const p = await api.post<{ id: string; name: string }>('/menu/products', {
          name: name.trim(),
          price: Number(price),
          categoryId,
        });
        onCreated({ kind: 'product', id: p.id, name: p.name });
      }
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Yeni Kalem Oluştur"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>İptal</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Oluşturuluyor…' : 'Oluştur'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setKind('stock')}
          className={`flex-1 rounded-lg border-2 px-3 py-2 text-left text-sm ${
            kind === 'stock' ? 'border-brand bg-brand/10' : 'border-line'
          }`}
        >
          <span className="block font-semibold text-ink">Stok Kalemi</span>
          <span className="block text-xs text-muted">Hammadde — stok takibi yapılır</span>
        </button>
        <button
          type="button"
          onClick={() => setKind('product')}
          className={`flex-1 rounded-lg border-2 px-3 py-2 text-left text-sm ${
            kind === 'product' ? 'border-brand bg-brand/10' : 'border-line'
          }`}
        >
          <span className="block font-semibold text-ink">Menü Ürünü</span>
          <span className="block text-xs text-muted">Müşteriye satılacak ürün</span>
        </button>
      </div>

      <Field label="Ad">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>

      {kind === 'stock' ? (
        <>
          <Field label="Birim">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {['adet', 'kg', 'gr', 'lt', 'cl', 'ml'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="Grup (opsiyonel)">
            <Input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="ör. Et Ürünleri, Kuru Gıda"
            />
          </Field>
          <p className="text-xs text-faint">
            Miktar 0 olarak açılır; bu faturadaki miktar kaydedince stoğa girer.
          </p>
        </>
      ) : (
        <>
          <Field label="Satış Fiyatı">
            <NumberInput value={price} onChange={setPrice} placeholder="0" />
          </Field>
          <Field label="Kategori">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-faint">
            Menü ürünü stoğa bağlanmaz. Stok takibi için ayrıca bir stok kalemi
            oluşturup ürüne reçete tanımlayın.
          </p>
        </>
      )}
    </Modal>
  );
}

function QuickSupplierForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [iban, setIban] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const acc = await api.post<{ id: string }>('/accounts', {
        name,
        type: 'TEDARIKCI',
        phone,
        taxNumber,
        taxOffice,
        iban,
      });
      onCreated(acc.id);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Yeni Tedarikçi"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor…' : 'Ekle ve Seç'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Ad / Ünvan">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Metro Market, Migros…" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Vergi / TC No">
          <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
        </Field>
        <Field label="Vergi Dairesi">
          <Input value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} />
        </Field>
        <Field label="IBAN">
          <Input value={iban} onChange={(e) => setIban(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-gray-400">
        Daha fazla detayı sonra "Cari" sayfasından düzenleyebilirsiniz.
      </p>
    </Modal>
  );
}

function PurchaseDetail({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  return (
    <Modal open title={`Alış Faturası ${purchase.invoiceNo || ''}`} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Kapat</Button>}>
      <div className="mb-2 text-sm text-gray-500">
        {dmy(purchase.invoiceDate)} · {purchase.supplier?.name || 'Tedarikçisiz'} · {CAT_LABEL[purchase.category ?? ''] || ''} · {purchase.paymentStatus === 'ACIK' ? 'Açık' : 'Peşin'}
      </div>
      <table className="w-full text-sm">
        <thead className="text-gray-500">
          <tr><th className="text-left">Ürün</th><th className="text-right">Adet</th><th className="text-right">Birim</th><th className="text-right">KDV</th><th className="text-right">Tutar</th></tr>
        </thead>
        <tbody>
          {purchase.items.map((it, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="py-1.5">{it.name}</td>
              <td className="py-1.5 text-right">{it.quantity} {it.unit}</td>
              <td className="py-1.5 text-right">{tl(it.unitPrice)}</td>
              <td className="py-1.5 text-right">%{it.vatRate}</td>
              <td className="py-1.5 text-right font-medium">{tl(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex justify-between"><span>Ara Toplam</span><span>{tl(purchase.subtotal)}</span></div>
        <div className="flex justify-between"><span>KDV</span><span>{tl(purchase.vatTotal)}</span></div>
        <div className="flex justify-between font-bold"><span>Genel Toplam</span><span>{tl(purchase.grandTotal)}</span></div>
      </div>
    </Modal>
  );
}
