import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Button, Field, Input, Select } from '../components/ui';
import {
  PAGE_LABELS,
  PAGE_ROLES,
  grantablePages,
  type PageKey,
} from '../auth/pages';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
  extraPages?: string[];
}

const ROLES = ['PATRON', 'MUDUR', 'KASIYER', 'GARSON', 'MUTFAK'];

// Bir rolün varsayılan olarak gördüğü sayfalar (bilgi amaçlı, editörde kilitli gösterilir).
function roleDefaultPages(role: string): PageKey[] {
  return grantablePages().filter((k) => PAGE_ROLES[k].includes(role as any));
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<User | 'new' | null>(null);

  async function load() {
    try {
      setUsers(await api.get<User[]>('/users'));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleActive(u: User) {
    try {
      if (u.active) await api.delete(`/users/${u.id}`);
      else await api.patch(`/users/${u.id}`, { active: true });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Kullanıcılar</h1>
        <Button onClick={() => setModal('new')}>+ Kullanıcı</Button>
      </div>
      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">Kullanıcı Adı</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {u.fullName}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.active ? (
                    <span className="text-green-600">Aktif</span>
                  ) : (
                    <span className="text-gray-400">Pasif</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setModal(u)}
                      className="text-xs text-gray-500 hover:text-brand"
                    >
                      düzenle
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      {u.active ? 'pasifleştir' : 'aktifleştir'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserForm
          value={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  value,
  onClose,
  onSaved,
}: {
  value: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(value?.username || '');
  const [fullName, setFullName] = useState(value?.fullName || '');
  const [role, setRole] = useState(value?.role || 'GARSON');
  const [password, setPassword] = useState('');
  // Rol dışı kişiye özel açılan sayfalar.
  const [extraPages, setExtraPages] = useState<string[]>(value?.extraPages || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const roleGrants = roleDefaultPages(role); // rolün zaten verdiği sayfalar (kilitli)
  // Rol zaten veriyorsa ekstra listeden çıkar (çift işaret olmasın).
  const grantable = grantablePages().filter((k) => !roleGrants.includes(k));

  function toggleExtra(key: PageKey) {
    setExtraPages((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function save() {
    setBusy(true);
    setErr('');
    try {
      // Rolün zaten verdiği sayfaları extraPages'e yazmaya gerek yok.
      const cleanExtra = extraPages.filter((k) => !roleGrants.includes(k as PageKey));
      if (value) {
        const body: any = { fullName, role, extraPages: cleanExtra };
        if (password) body.password = password;
        await api.patch(`/users/${value.id}`, body);
      } else {
        await api.post('/users', {
          username,
          fullName,
          role,
          password,
          extraPages: cleanExtra,
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const valid =
    fullName.trim() &&
    (value ? true : username.trim() && password.length >= 3);

  return (
    <Modal
      open
      title={value ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !valid}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Ad Soyad">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoFocus
        />
      </Field>
      {!value && (
        <Field label="Kullanıcı Adı">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
      )}
      <Field label="Rol">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={value ? 'Yeni Şifre (boş = değişmez)' : 'Şifre'}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <div className="mt-2">
        <div className="mb-1 text-sm font-medium text-ink">Sayfa Erişimleri</div>
        <p className="mb-2 text-xs text-muted">
          Rolün verdiği sayfalar kilitlidir. İşaretlediğin ek sayfalar bu
          kullanıcıya rolü dışında açılır.
        </p>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-surface-low p-2">
          {roleGrants.map((k) => (
            <label
              key={k}
              className="flex items-center gap-2 text-sm text-muted"
              title="Rol gereği açık"
            >
              <input type="checkbox" checked disabled className="accent-brand" />
              <span>{PAGE_LABELS[k]}</span>
              <span className="text-[10px] text-faint">(rol)</span>
            </label>
          ))}
          {grantable.map((k) => (
            <label
              key={k}
              className="flex items-center gap-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                checked={extraPages.includes(k)}
                onChange={() => toggleExtra(k)}
                className="accent-brand"
              />
              <span>{PAGE_LABELS[k]}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
