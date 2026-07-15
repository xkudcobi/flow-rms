import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  useEffect,
  useState,
} from 'react';

// FLOW tasarım sistemi bileşenleri: keskin köşe (4px), ince kenarlık, düz (flat) yüzeyler.
const inputBase =
  'w-full rounded border border-line bg-surface-card px-3 py-2 text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/30';

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className || ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className || ''}`} />;
}

/**
 * Ondalık sayı girişi (reçete miktarı, stok, fiyat).
 *
 * Neden ayrı bir bileşen: `value={n}` + `onChange={e => set(Number(e.target.value))}`
 * kalıbı iki şeyi bozuyordu —
 *   1) "0.1" yazılamıyordu: Number("0.") === 0 olduğu için nokta anında yutulup
 *      input tekrar "0" olarak render ediliyordu.
 *   2) Değer 0'ken yazmaya başlayınca "05" gibi baştaki sıfır kalıyordu.
 * Çözüm: metni string olarak tut, dışarıya sayı ver. Virgül de kabul edilir
 * (Türkçe klavyede ondalık ayırıcı virgüldür).
 */
export function NumberInput({
  value,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(() => (value ? String(value) : ''));

  // Dışarıdan değer değişirse (ör. form sıfırlandı) metni eşitle. Kullanıcı
  // "0." yazarken parse sonucu aynı kalacağı için buraya girmez — yazım bozulmaz.
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'));
    const current = isNaN(parsed) ? 0 : parsed;
    if (current !== value) setText(value ? String(value) : '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        // Yalnız rakam, nokta/virgül ve baştaki eksi.
        if (raw !== '' && !/^-?[0-9]*[.,]?[0-9]*$/.test(raw)) return;
        setText(raw);
        const n = parseFloat(raw.replace(',', '.'));
        onChange(isNaN(n) ? 0 : n);
      }}
      onBlur={(e) => {
        // Odak çıkınca normalize et: "05" → "5", "0." → "0", "" → "0".
        setText(value ? String(value) : '0');
        props.onBlur?.(e);
      }}
      className={`${inputBase} ${className || ''}`}
    />
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'dark';
export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    // Birincil aksiyon → Signal Blue
    primary: 'bg-brand text-white hover:bg-brand-dark',
    // İkincil → ghost (beyaz zemin + ince kenarlık)
    secondary: 'bg-surface-card text-ink border border-line hover:bg-surface-low',
    danger: 'bg-danger text-white hover:opacity-90',
    // En kritik CTA → siyah
    dark: 'bg-ink text-white hover:bg-black',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${styles[variant]} ${className || ''}`}
    />
  );
}
