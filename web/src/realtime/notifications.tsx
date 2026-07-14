import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { useSocketEvent } from './socket';

export interface Notif {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  page: string;
  at: string;
}
interface Snapshot {
  count: number;
  items: Notif[];
  badges: Record<string, number>;
}
interface NotifCtx {
  items: Notif[];
  badges: Record<string, number>;
  unread: number;
  refresh: () => void;
  markSeen: () => void;
}

const SEEN_KEY = 'flow_notif_seen';
const Ctx = createContext<NotifCtx>({
  items: [],
  badges: {},
  unread: 0,
  refresh: () => undefined,
  markSeen: () => undefined,
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>({ count: 0, items: [], badges: {} });
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    } catch {
      return new Set<string>();
    }
  });

  const refresh = useCallback(() => {
    api.get<Snapshot>('/notifications').then(setSnap).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  // Canlı olaylarda anında tazele (gecikme olmadan).
  useSocketEvent('waiter:call', refresh, [refresh]);
  useSocketEvent('calls:update', refresh, [refresh]);
  useSocketEvent('review:new', refresh, [refresh]);
  useSocketEvent('kds:update', refresh, [refresh]);
  useSocketEvent('order:update', refresh, [refresh]);

  const unread = useMemo(
    () => snap.items.filter((n) => !seen.has(n.id)).length,
    [snap.items, seen],
  );

  const markSeen = useCallback(() => {
    const ids = new Set(snap.items.map((n) => n.id));
    setSeen(ids);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  }, [snap.items]);

  const value = useMemo(
    () => ({ items: snap.items, badges: snap.badges, unread, refresh, markSeen }),
    [snap.items, snap.badges, unread, refresh, markSeen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNotifications = () => useContext(Ctx);
