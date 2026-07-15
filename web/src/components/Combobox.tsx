import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Yazarak arayabilen, gruplanmış seçici.
 *
 * Neden <select> değil: hammadde listesi uzadıkça açılır listede "lavaş"ı
 * bulmak için elle kaydırmak gerekiyordu. Burada yazınca süzülür, hammaddeler
 * grubuna göre (Et Ürünleri, Kuru Gıda...) ayrılmış görünür.
 *
 * Türkçe arama: "Iğdır"/"ığdır" gibi i/ı farkları tarayıcı locale'ine
 * bırakılmaz — toLocaleLowerCase('tr') ile normalize edilir.
 */
export interface ComboOption {
  value: string;
  label: string;
  group?: string;
  /** Sağda soluk gösterilen ek bilgi (ör. birim). */
  hint?: string;
}

interface Props {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Listede sonuç yokken gösterilecek metin. */
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

const norm = (s: string) => s.toLocaleLowerCase('tr').trim();

export default function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Ara…',
  emptyText = 'Sonuç yok',
  className = '',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  // Süzülmüş ve gruplanmış liste. Klavye gezinmesi düz bir dizi üzerinden
  // yürüdüğü için hem grupları hem düz sırayı birlikte üretiyoruz.
  const { groups, flat } = useMemo(() => {
    const q = norm(query);
    const hit = q ? options.filter((o) => norm(o.label).includes(q)) : options;
    const map = new Map<string, ComboOption[]>();
    for (const o of hit) {
      const g = o.group?.trim() || 'Diğer';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    const sorted = [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], 'tr'),
    );
    return { groups: sorted, flat: sorted.flatMap(([, items]) => items) };
  }, [options, query]);

  // Dışarı tıklayınca kapat.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
    setActive(0);
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) pick(flat[active].value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded border border-line bg-surface-card px-3 py-2 text-left text-ink transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
      >
        <span className={`truncate ${selected ? '' : 'text-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {selected?.hint && (
            <span className="text-xs text-faint">{selected.hint}</span>
          )}
          <ChevronDown size={16} className="text-faint" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface-card shadow-float">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search size={14} className="shrink-0 text-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {flat.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-faint">{emptyText}</p>
            )}
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-faint">
                  {group}
                </div>
                {items.map((o) => {
                  const idx = flat.indexOf(o);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => pick(o.value)}
                      onMouseEnter={() => setActive(idx)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        idx === active ? 'bg-brand/10' : ''
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Check
                          size={14}
                          className={`shrink-0 text-brand ${o.value === value ? '' : 'invisible'}`}
                        />
                        <span className="truncate text-ink">{o.label}</span>
                      </span>
                      {o.hint && (
                        <span className="shrink-0 text-xs text-faint">{o.hint}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
