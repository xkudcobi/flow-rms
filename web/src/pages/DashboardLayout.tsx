import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ChevronDown,
  Search,
  X,
  LayoutGrid,
  ChefHat,
  BookOpen,
  Package,
  ShoppingCart,
  Wallet,
  ReceiptText,
  FileText,
  CalendarCheck,
  CalendarClock,
  Star,
  TrendingUp,
  Calculator,
  ShieldAlert,
  Users,
  UserCog,
  Heart,
  Sparkles,
  Settings,
  Database,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, AuthUser } from '../auth/AuthContext';
import CallsPanel from '../components/CallsPanel';
import AiDock from '../components/AiDock';
import ReviewNotifier from '../components/ReviewNotifier';
import NotificationBell from '../components/NotificationBell';
import HelpButton from '../components/HelpButton';
import { useNotifications } from '../realtime/notifications';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: AuthUser['role'][]; // tanımsız = herkes
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: 'Operasyon',
    items: [
      { to: '/salon', label: 'Salon Planı', icon: LayoutGrid },
      { to: '/rezervasyonlar', label: 'Rezervasyonlar', icon: CalendarClock, roles: ['PATRON', 'MUDUR', 'KASIYER'] },
      { to: '/mutfak', label: 'Mutfak', icon: ChefHat, roles: ['PATRON', 'MUDUR', 'MUTFAK'] },
      { to: '/adisyonlar', label: 'Adisyonlar', icon: ReceiptText, roles: ['PATRON', 'MUDUR'] },
    ],
  },
  {
    title: 'Menü & Stok',
    items: [
      { to: '/menu', label: 'Menü', icon: BookOpen },
      { to: '/karlilik', label: 'Kârlılık', icon: TrendingUp, roles: ['PATRON', 'MUDUR'] },
      { to: '/stok', label: 'Stok', icon: Package, roles: ['PATRON', 'MUDUR'] },
      { to: '/alislar', label: 'Alışlar', icon: ShoppingCart, roles: ['PATRON', 'MUDUR'] },
    ],
  },
  {
    title: 'Finans',
    items: [
      { to: '/kasa', label: 'Kasa', icon: Calculator, roles: ['PATRON', 'MUDUR', 'KASIYER'] },
      { to: '/cari', label: 'Cari', icon: Wallet, roles: ['PATRON', 'MUDUR', 'KASIYER'] },
      { to: '/belgeler', label: 'Mali Belgeler', icon: FileText, roles: ['PATRON', 'MUDUR'] },
      { to: '/raporlar', label: 'Gün Sonu', icon: CalendarCheck, roles: ['PATRON', 'MUDUR'] },
    ],
  },
  {
    title: 'Müşteri & Ekip',
    items: [
      { to: '/musteriler', label: 'Müşteriler', icon: Heart, roles: ['PATRON', 'MUDUR', 'KASIYER'] },
      { to: '/personel', label: 'Personel', icon: UserCog, roles: ['PATRON', 'MUDUR'] },
      { to: '/geribildirim', label: 'Geri Bildirim', icon: Star, roles: ['PATRON', 'MUDUR'] },
    ],
  },
  {
    title: 'Analiz & Yönetim',
    items: [
      { to: '/ongoruler', label: 'Öngörüler', icon: Sparkles, roles: ['PATRON', 'MUDUR'] },
      { to: '/denetim', label: 'Denetim', icon: ShieldAlert, roles: ['PATRON', 'MUDUR'] },
      { to: '/kullanicilar', label: 'Kullanıcılar', icon: Users, roles: ['PATRON', 'MUDUR'] },
      { to: '/veri', label: 'Veri İçe Aktar', icon: Database, roles: ['PATRON', 'MUDUR'] },
      { to: '/ayarlar', label: 'Ayarlar', icon: Settings, roles: ['PATRON', 'MUDUR'] },
    ],
  },
];

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  PATRON: 'Patron',
  MUDUR: 'Müdür',
  KASIYER: 'Kasiyer',
  GARSON: 'Garson',
  MUTFAK: 'Mutfak',
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  // Katlanan grupların başlıkları — localStorage'da saklanır (oturumlar arası korunur).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('flow_nav_collapsed') || '[]'));
    } catch {
      return new Set<string>();
    }
  });
  const [navQuery, setNavQuery] = useState('');
  function toggleGroup(title: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      localStorage.setItem('flow_nav_collapsed', JSON.stringify([...next]));
      return next;
    });
  }
  // Hook'lardan SONRA erken çıkış (rules-of-hooks).
  if (!user) return null;

  const q = navQuery.trim().toLocaleLowerCase('tr');
  const searching = q.length > 0;
  const groups = NAV.map((g) => ({
    title: g.title,
    items: g.items.filter(
      (i) =>
        (!i.roles || i.roles.includes(user.role)) &&
        (!searching || i.label.toLocaleLowerCase('tr').includes(q)),
    ),
  })).filter((g) => g.items.length > 0);

  const { badges } = useNotifications();
  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full">
      {/* Sidebar — siyah, Signal Blue aktif durum */}
      <aside className="flex w-64 flex-col bg-sidebar text-white">
        <div className="flex items-start justify-between px-5 pb-6 pt-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              FLOW
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-muted">
              Restoran Yönetimi
            </p>
          </div>
          <NotificationBell />
        </div>

        {/* Hızlı menü arama */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 focus-within:bg-white/10">
            <Search size={14} className="shrink-0 text-sidebar-muted" />
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Menüde ara…"
              className="w-full bg-transparent text-sm text-white placeholder:text-sidebar-muted focus:outline-none"
            />
            {navQuery && (
              <button onClick={() => setNavQuery('')} className="shrink-0 text-sidebar-muted hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-2">
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-sidebar-muted">Sonuç yok.</p>
          )}
          {groups.map((group) => {
            const isCollapsed = !searching && collapsed.has(group.title);
            return (
            <div key={group.title} className="mb-2">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between rounded px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/70 transition-colors hover:text-white"
              >
                {group.title}
                <ChevronDown
                  size={13}
                  className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>
              <div className={`space-y-0.5 overflow-hidden ${isCollapsed ? 'hidden' : ''}`}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const badge = badges[item.to.slice(1)] || 0;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'border-brand bg-brand/15 text-white'
                            : 'border-transparent text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
                        }`
                      }
                    >
                      <Icon size={18} strokeWidth={2} />
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">
                {user.fullName}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-sidebar-muted">
                {ROLE_LABEL[user.role]}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <LogOut size={16} strokeWidth={2} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* İçerik */}
      <main className="flex-1 overflow-auto bg-surface">
        <Outlet />
      </main>

      {/* Sayfa bazlı eğitim turu (💡) */}
      <HelpButton />

      {/* Canlı garson/hesap çağrıları (her ekranda) */}
      <CallsPanel />

      {/* Yapay zeka asistanı — sağ altta, her ekranda */}
      <AiDock />

      {/* Yeni Google yorumu bildirimleri — her ekranda */}
      <ReviewNotifier />
    </div>
  );
}
