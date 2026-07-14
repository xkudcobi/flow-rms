import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { useNotifications, type Notif } from '../realtime/notifications';

const DOT: Record<Notif['severity'], string> = {
  info: 'bg-brand',
  warning: 'bg-amber-500',
  danger: 'bg-danger',
};

const hhmm = (s: string) =>
  new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function NotificationBell() {
  const { items, unread, markSeen, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    markSeen();
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, markSeen]);

  function go(n: Notif) {
    setOpen(false);
    navigate('/' + n.page);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Bildirimler"
        data-tour="notif-bell"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 top-16 z-[70] max-h-[70vh] w-80 overflow-hidden rounded-xl border border-line bg-surface-card text-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-bold">Bildirimler</span>
            <button onClick={refresh} className="text-xs text-muted hover:text-ink">Yenile</button>
          </div>
          <div className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-faint">
                <Check size={26} className="text-success" />
                Her şey yolunda, bekleyen bir şey yok.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-low"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.severity]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-faint">{hhmm(n.at)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{n.message}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
