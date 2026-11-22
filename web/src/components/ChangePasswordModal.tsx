import { useState } from 'react';
import { api } from '../api/client';
import Modal from './Modal';
import { Button, Field, Input } from './ui';

// Giriş yapmış kullanıcının kendi şifresini değiştirmesi.
export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const valid = current.length >= 3 && next.length >= 3 && next === next2;

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      setOk(true);
      setTimeout(onClose, 900);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Şifremi Değiştir"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !valid || ok}>
            {ok ? '✓ Değişti' : busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Mevcut Şifre">
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label="Yeni Şifre">
        <Input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <Field label="Yeni Şifre (tekrar)">
        <Input
          type="password"
          value={next2}
          onChange={(e) => setNext2(e.target.value)}
        />
      </Field>
      {next2 && next !== next2 && (
        <p className="text-xs text-red-600">Şifreler eşleşmiyor.</p>
      )}
    </Modal>
  );
}
