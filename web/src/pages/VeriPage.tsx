import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '../components/ui';

interface ImportResult {
  type: string;
  imported: number;
  skipped: number;
  errors: string[];
}

const TYPES = [
  {
    key: 'sales',
    label: 'Geçmiş Satışlar',
    desc: 'Öngörü ve analiz motorunu besler (tahmin, yoğunluk, trend).',
    columns: 'tarih, tutar, ödeme, ürün, adet',
    example: 'tarih;tutar;ödeme;ürün;adet\n2026-06-15;480;NAKIT;Adana Kebap;2\n2026-06-15 20:30;150;KREDI_KARTI;İçecek;3',
  },
  {
    key: 'products',
    label: 'Ürünler',
    desc: 'Menüye toplu ürün ekler (kategori yoksa oluşturulur).',
    columns: 'ad, fiyat, kategori, istasyon',
    example: 'ad;fiyat;kategori;istasyon\nAdana Kebap;220;Ana Yemek;MUTFAK\nAyran;25;İçecek;BAR',
  },
  {
    key: 'customers',
    label: 'Müşteriler',
    desc: 'CRM müşteri veritabanına toplu ekler (telefonla tekilleştirir).',
    columns: 'ad, telefon, doğumgünü, not',
    example: 'ad;telefon;doğumgünü\nAhmet Yılmaz;05551112233;1990-05-14\nSelin Kaya;05559998877;12.11.1988',
  },
  {
    key: 'stock',
    label: 'Stok Kalemleri',
    desc: 'Stok kalemlerini toplu ekler.',
    columns: 'ad, birim, miktar, kritik',
    example: 'ad;birim;miktar;kritik\nKıyma;kg;20;3\nLavaş;adet;200;50',
  },
];

export default function VeriPage() {
  const [type, setType] = useState(TYPES[0]);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const rowCount = csv.trim() ? Math.max(0, csv.trim().split(/\r?\n/).length - 1) : 0;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(f, 'utf-8');
  }

  async function doImport() {
    if (!csv.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await api.post<ImportResult>(`/import/${type.key}`, { csv });
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-ink">Veri İçe Aktarma</h1>
      <p className="mb-5 text-sm text-muted">
        Geçmiş verilerinizi (satış, ürün, müşteri, stok) CSV olarak yükleyin — sisteme otomatik işlenir.
      </p>

      {/* Tür seçimi */}
      <div data-tour="veri-types" className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => { setType(t); setResult(null); setError(''); }}
            className={`rounded-lg border p-3 text-left transition ${
              type.key === t.key ? 'border-brand bg-brand-light' : 'border-line bg-surface-card hover:bg-surface-low'
            }`}
          >
            <div className="font-semibold text-ink">{t.label}</div>
            <div className="mt-0.5 text-xs text-muted">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Yükleme */}
        <div data-tour="veri-upload" className="rounded-lg border border-line bg-surface-card p-5">
          <div className="mb-3 text-sm font-semibold text-ink">1. CSV Dosyası Seç</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line py-8 text-muted hover:border-brand hover:text-brand"
          >
            <Upload size={28} />
            <span className="text-sm">{fileName || 'Dosya seçmek için tıkla'}</span>
          </button>
          {csv && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-low px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <FileText size={15} /> {fileName || 'veri.csv'}
              </span>
              <span className="text-muted">{rowCount} satır</span>
            </div>
          )}
          <Button onClick={doImport} disabled={busy || !csv} className="mt-4 w-full">
            {busy ? 'İçe aktarılıyor…' : `${type.label} İçe Aktar`}
          </Button>
        </div>

        {/* Beklenen format */}
        <div className="rounded-lg border border-line bg-surface-card p-5">
          <div className="mb-2 text-sm font-semibold text-ink">Beklenen sütunlar — {type.label}</div>
          <p className="mb-2 text-xs text-muted">
            Başlık satırı zorunlu. Sütun adları esnektir (Türkçe/İngilizce). Ayraç <code className="rounded bg-surface-high px-1">;</code> veya <code className="rounded bg-surface-high px-1">,</code> olabilir.
          </p>
          <div className="mb-2 text-xs">
            <span className="text-muted">Sütunlar: </span>
            <span className="font-medium text-ink">{type.columns}</span>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-surface-low p-3 text-xs text-ink">{type.example}</pre>
          <p className="mt-2 text-xs text-faint">
            Not: Aynı isim/telefondaki kayıtlar atlanır (tekilleştirme). Geçmiş satışlar kapalı adisyon olarak işlenir.
          </p>
        </div>
      </div>

      {/* Sonuç */}
      {error && (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {result && (
        <div className="mt-5 rounded-lg border border-line bg-surface-card p-5">
          <div className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
            <CheckCircle2 size={20} className="text-success" /> İçe Aktarma Tamamlandı
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-xs uppercase text-muted">Eklenen</div>
              <div className="font-display text-2xl font-bold text-success">{result.imported}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted">Atlanan</div>
              <div className="font-display text-2xl font-bold text-muted">{result.skipped}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted">Hata</div>
              <div className="font-display text-2xl font-bold text-danger">{result.errors.length}</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface-low p-3 text-xs text-danger">
              {result.errors.slice(0, 30).map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {result.type === 'sales' && result.imported > 0 && (
            <p className="mt-3 text-sm text-muted">
              Geçmiş satışlar işlendi. Öngörüler ve Gün Sonu sayfalarındaki tahmin/analizler artık bu veriyi kullanacak.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
