import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { tourFor } from '../help/tours';

interface Rect { top: number; left: number; width: number; height: number }

export default function HelpButton() {
  const { pathname } = useLocation();
  const tour = tourFor(pathname);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Rota değişince turu kapat.
  useEffect(() => {
    setOpen(false);
    setIdx(0);
  }, [pathname]);

  const step = tour?.steps[idx];

  // Spotlight hedefini ölç (seçici varsa).
  useLayoutEffect(() => {
    if (!open || !step?.selector) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, idx, step?.selector]);

  // Ampülü sayfa başlığının (ilk h1) tam yanına konumlandır — sayfaları
  // tek tek düzenlemeden. Başlık geç render olabilir → birkaç kez ölç.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!tour) { setPos(null); return; }
    const measure = () => {
      const h1 = document.querySelector('main h1') as HTMLElement | null;
      if (!h1) { setPos((p) => (p === null ? p : null)); return; }
      const r = h1.getBoundingClientRect();
      const top = r.top + r.height / 2;
      const left = r.right + 10;
      // Yalnızca gerçekten değişince güncelle (gereksiz render'ı önle).
      setPos((p) =>
        p && Math.abs(p.top - top) < 0.5 && Math.abs(p.left - left) < 0.5
          ? p
          : { top, left },
      );
    };
    measure();
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 450);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    // Başlık geç render olursa (veri yükleniyor) yakala.
    const main = document.querySelector('main');
    const obs = main ? new MutationObserver(measure) : null;
    obs?.observe(main!, { childList: true, subtree: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      obs?.disconnect();
    };
  }, [pathname, tour]);

  if (!tour) return null;

  const total = tour.steps.length;
  const last = idx >= total - 1;
  function close() {
    setOpen(false);
    setIdx(0);
  }

  return (
    <>
      {/* Ampül tetikleyici — sayfa başlığının hemen yanında */}
      {pos && (
        <button
          onClick={() => { setIdx(0); setOpen(true); }}
          title={`${tour.title} — bu sayfayı tanıt`}
          aria-label="Sayfayı tanıt"
          className="group fixed z-30 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-amber-500 transition-transform duration-200 ease-out hover:scale-125"
          style={{ top: pos.top, left: pos.left }}
        >
          <Lightbulb
            size={18}
            className="transition-all duration-200 group-hover:text-amber-400 group-hover:[filter:drop-shadow(0_0_7px_rgba(245,158,11,0.95))]"
          />
        </button>
      )}

      {open && step && (
        <div className="fixed inset-0 z-[80]">
          {/* Karartma + (varsa) spotlight deliği */}
          {rect ? (
            <div
              className="pointer-events-none fixed rounded-lg ring-2 ring-amber-400 transition-all"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
              }}
            />
          ) : (
            <div className="fixed inset-0 bg-black/60" onClick={close} />
          )}

          {/* Açıklama kartı — vurgulanan alan alt yarıdaysa kartı üste al (örtmesin) */}
          <div
            className="fixed left-1/2 z-[81] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-line bg-surface-card p-5 shadow-2xl"
            style={
              rect && rect.top > window.innerHeight / 2
                ? { top: '8vh' }
                : { bottom: '8vh' }
            }
          >
            <button onClick={close} className="absolute right-3 top-3 text-faint hover:text-ink" title="Kapat">
              <X size={16} />
            </button>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
              <Lightbulb size={14} /> {tour.title} · {idx + 1}/{total}
            </div>
            <h3 className="mb-1.5 text-lg font-bold text-ink">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{step.body}</p>

            {/* İlerleme noktaları */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {tour.steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-brand' : 'w-1.5 bg-line'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={close} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink">
                  Atla
                </button>
                {idx > 0 && (
                  <button
                    onClick={() => setIdx((i) => i - 1)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-low"
                  >
                    Önceki
                  </button>
                )}
                <button
                  onClick={() => (last ? close() : setIdx((i) => i + 1))}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
                >
                  {last ? 'Bitir' : 'Sonraki'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
