import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Button, Field, Input, Select } from '../components/ui';

interface Account {
  id: string;
  name: string;
  type: string;
  phone?: string;
  note?: string;
  taxNumber?: string;
  taxOffice?: string;
  address?: string;
  email?: string;
  iban?: string;
  balance: number;
}
interface Txn {
  id: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
}
interface AccountDetail extends Account {
  transactions: Txn[];
}

const TYPES = ['MUSTERI', 'TEDARIKCI', 'PERSONEL'];
const TYPE_LABEL: Record<string, string> = {
  MUSTERI: 'Müşteri',
  TEDARIKCI: 'Tedarikçi',
  PERSONEL: 'Personel',
};
const tl = (n: number) => n.toLocaleString('tr-TR') + ' ₺';

// Hareket türü görünümü (işaret = bakiye etkisi).
const TXN: Record<string, { label: string; color: string; sign: string }> = {
  BORC: { label: 'Borç', color: 'text-red-600', sign: '+' },
  ALACAK: { label: 'Tahsilat', color: 'text-green-600', sign: '−' },
  ALIS: { label: 'Alış', color: 'text-red-600', sign: '−' },
  ODEME: { label: 'Ödeme', color: 'text-green-600', sign: '+' },
};

// Bakiye rengi: + cari bize borçlu (alacağımız, yeşil), - biz borçluyuz (kırmızı)
function balanceView(b: number) {
  if (b > 0) return { text: `${tl(b)} alacak`, cls: 'text-green-600' };
  if (b < 0) return { text: `${tl(-b)} borç`, cls: 'text-red-600' };
  return { text: '0 ₺', cls: 'text-gray-500' };
}

export default function CariPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState('HEPSI');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Account | 'new' | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  function load() {
    const q = filter === 'HEPSI' ? '' : `?type=${filter}`;
    api
      .get<Account[]>(`/accounts${q}`)
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cari Hesaplar</h1>
        <Button onClick={() => setEdit('new')}>+ Cari</Button>
      </div>

      <div className="mb-4 flex gap-2">
        {['HEPSI', ...TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === t
                ? 'bg-brand text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t === 'HEPSI' ? 'Hepsi' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Tür</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3 text-right">Bakiye</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const bv = balanceView(a.balance);
              return (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {a.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {TYPE_LABEL[a.type] || a.type}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.phone || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${bv.cls}`}>
                    {bv.text}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setDetail(a.id)}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        ekstre / hareket
                      </button>
                      <button
                        onClick={() => setEdit(a)}
                        className="text-xs text-gray-500 hover:text-brand"
                      >
                        düzenle
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Cari hesap yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <AccountForm
          value={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
      {detail && (
        <DetailModal
          id={detail}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function AccountForm({
  value,
  onClose,
  onSaved,
}: {
  value: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.name || '');
  const [type, setType] = useState(value?.type || 'MUSTERI');
  const [phone, setPhone] = useState(value?.phone || '');
  const [note, setNote] = useState(value?.note || '');
  const [taxNumber, setTaxNumber] = useState(value?.taxNumber || '');
  const [taxOffice, setTaxOffice] = useState(value?.taxOffice || '');
  const [address, setAddress] = useState(value?.address || '');
  const [email, setEmail] = useState(value?.email || '');
  const [iban, setIban] = useState(value?.iban || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const body = {
        name, type, phone, note,
        taxNumber, taxOffice, address, email, iban,
      };
      if (value) await api.patch(`/accounts/${value.id}`, body);
      else await api.post('/accounts', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={value ? 'Cari Düzenle' : 'Yeni Cari'}
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
      <Field label="Ad / Ünvan">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Tür">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Telefon">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>

      {type === 'TEDARIKCI' && (
        <div className="mb-2 rounded-lg border border-gray-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">
            Tedarikçi Detayları
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Vergi / TC No">
              <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
            </Field>
            <Field label="Vergi Dairesi">
              <Input value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} />
            </Field>
          </div>
          <Field label="E-posta">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="IBAN">
            <Input value={iban} onChange={(e) => setIban(e.target.value)} />
          </Field>
          <Field label="Adres">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Not">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

function DetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [acc, setAcc] = useState<AccountDetail | null>(null);
  const [type, setType] = useState('ALACAK');
  const [amount, setAmount] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function load() {
    api
      .get<AccountDetail>(`/accounts/${id}`)
      .then((a) => {
        setAcc(a);
        setType(a.type === 'TEDARIKCI' ? 'ODEME' : 'ALACAK');
      })
      .catch((e) => setErr(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function add() {
    if (!(amount > 0)) return;
    setBusy(true);
    setErr('');
    try {
      await api.post(`/accounts/${id}/transactions`, {
        type,
        amount: Number(amount),
        description: desc || undefined,
      });
      setAmount(0);
      setDesc('');
      load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const bv = acc ? balanceView(acc.balance) : null;

  return (
    <Modal open title={acc ? acc.name : 'Cari'} onClose={onClose}>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      {acc && (
        <>
          <div className="mb-4 rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500">Güncel Bakiye</div>
            <div className={`text-2xl font-bold ${bv!.cls}`}>{bv!.text}</div>
          </div>

          {/* Hareket ekle */}
          <div className="mb-4 rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex gap-2">
              {(acc.type === 'TEDARIKCI'
                ? [
                    ['ODEME', 'Ödeme yaptık', 'green'],
                    ['ALIS', 'Alış / Borç', 'red'],
                  ]
                : [
                    ['ALACAK', 'Tahsilat', 'green'],
                    ['BORC', 'Borçlandır', 'red'],
                  ]
              ).map(([k, label, color]) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`flex-1 rounded-lg border-2 py-1.5 text-sm ${
                    type === k
                      ? color === 'green'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Tutar"
                className="w-32"
              />
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Açıklama"
              />
              <Button onClick={add} disabled={busy || !(amount > 0)}>
                Ekle
              </Button>
            </div>
          </div>

          {/* Ekstre */}
          <div className="max-h-64 overflow-auto">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-400">
              Hareketler
            </div>
            {acc.transactions.length === 0 ? (
              <p className="text-sm text-gray-400">Hareket yok.</p>
            ) : (
              <div className="space-y-1">
                {acc.transactions.map((t) => {
                  const v = TXN[t.type] || {
                    label: t.type,
                    color: 'text-gray-600',
                    sign: '',
                  };
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <span>
                        <span className="text-xs text-gray-400">
                          {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                        </span>{' '}
                        {t.description || v.label}
                      </span>
                      <span className={v.color}>
                        {v.sign}
                        {tl(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
