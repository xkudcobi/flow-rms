import { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

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
