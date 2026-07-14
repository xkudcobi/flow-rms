import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface FiscalReceipt {
  id: string;
  fiscalNo: string;
  zNo?: string;
  amount: number;
  provider: string;
  status: string;
  createdAt: string;
}
interface EInvoice {
  id: string;
  uuid: string;
  docType: string;
  status: string;
  total: number;
  provider: string;
  createdAt: string;
}

const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';
const dt = (s: string) => new Date(s).toLocaleString('tr-TR');

export default function BelgelerPage() {
  const [receipts, setReceipts] = useState<FiscalReceipt[]>([]);
  const [invoices, setInvoices] = useState<EInvoice[]>([]);
  const [fiscalProvider, setFiscalProvider] = useState('');
  const [einvoiceProvider, setEinvoiceProvider] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<FiscalReceipt[]>('/fiscal/receipts'),
      api.get<EInvoice[]>('/einvoice'),
      api.get<{ provider: string }>('/fiscal/status'),
      api.get<{ provider: string }>('/einvoice/status'),
    ])
      .then(([r, i, fs, es]) => {
        setReceipts(r);
        setInvoices(i);
        setFiscalProvider(fs.provider);
        setEinvoiceProvider(es.provider);
      })
      .catch((e) => setError(e.message));
  }, []);

  const isSim = fiscalProvider === 'simulation' || einvoiceProvider === 'simulation';

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Mali Belgeler</h1>

      {isSim && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚙️ <b>Simülasyon modu.</b> ÖKC sağlayıcı:{' '}
          <b>{fiscalProvider}</b>, e-Fatura sağlayıcı:{' '}
          <b>{einvoiceProvider}</b>. Gerçek yazarkasa (GMP3) ve e-Fatura
          entegratörü bağlandığında bu belgeler cihaz/entegratör üzerinden
          resmî olarak kesilecek.
        </div>
      )}

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mali fişler */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">
            Mali Fişler (ÖKC)
          </h2>
          {receipts.length === 0 ? (
            <p className="text-sm text-gray-400">Henüz mali fiş yok.</p>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-mono font-medium text-gray-800">
                      {r.fiscalNo}
                    </div>
                    <div className="text-xs text-gray-400">
                      {dt(r.createdAt)} · {r.zNo || '-'} · {r.provider}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-700">
                    {tl(r.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* e-Belgeler */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">
            e-Fatura / e-Arşiv
          </h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400">Henüz e-belge yok.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {i.docType === 'EFATURA' ? 'e-Fatura' : 'e-Arşiv'}{' '}
                      <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                        {i.status}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-gray-400">
                      {i.uuid.slice(0, 18)}… · {dt(i.createdAt)}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-700">
                    {tl(i.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
