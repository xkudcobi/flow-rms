import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      {/* max-h-[90vh] + gövdede overflow-y-auto: uzun formlar (ör. ürün ekleme)
          dar/kısa ekranda taşıp kesiliyordu — başlık ve alt butonlar sabit
          kalır, yalnız içerik kayar. */}
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-line bg-surface-card shadow-float"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-faint transition-colors hover:bg-surface-high hover:text-ink"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
