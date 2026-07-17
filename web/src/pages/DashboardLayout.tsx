import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  Menu,
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
  KeyRound,
  ListChecks,
  Lightbulb,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, AuthUser } from '../auth/AuthContext';
import { canAccessRoute } from '../auth/pages';
import { api } from '../api/client';
import CallsPanel from '../components/CallsPanel';
import AiDock from '../components/AiDock';
import ReviewNotifier from '../components/ReviewNotifier';
import NotificationBell from '../components/NotificationBell';
import HelpButton from '../components/HelpButton';
import ChangePasswordModal from '../components/ChangePasswordModal';
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
      { to: '/gorevler', label: 'Görevler', icon: ListChecks },
      { to: '/tavsiyeler', label: 'Tavsiyeler', icon: Lightbulb },
      { to: '/mesai', label: 'Mesai', icon: Clock },
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
  // Mobilde sidebar çekmece olarak açılır. Tablet/masaüstünde (md+) her zaman
  // görünür olduğu için bu durum orada hiç kullanılmaz.
  const [navOpen, setNavOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  // Mesai (QR giriş/çıkış) menü öğesi yalnızca ayardan açıksa görünür.
  const [attendanceOn, setAttendanceOn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api
      .get<{ attendanceQrEnabled?: boolean }>('/settings')
      .then((s) => setAttendanceOn(!!s.attendanceQrEnabled))
      .catch(() => undefined);
  }, []);

  // Sayfa değişince çekmeceyi kapat — mobilde bir menü seçtikten sonra
  // çekmecenin açık kalması içeriği gizler.
  useEffect(() => setNavOpen(false), [location.pathname]);

  // Escape ile kapat + çekmece açıkken arkadaki sayfa kaymasın.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

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
        // Rol varsayılanı VEYA patronun kişiye özel verdiği sayfa izni (extraPages).
        canAccessRoute(user, i.to) &&
        // Mesai öğesi yalnızca ayardan açıksa.
        (i.to !== '/mesai' || attendanceOn) &&
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
      {/* Mobil üst bar — yalnız telefonda. Sidebar burada çekmeceye taşındığı
          için FLOW başlığı ve bildirimler bu barda durur. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-sidebar px-4 md:hidden">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Menüyü aç"
          className="-ml-1 rounded p-1.5 text-white transition-colors hover:bg-white/10"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        <h1 className="font-display text-lg font-bold tracking-tight text-white">FLOW</h1>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </header>

      {/* Çekmece arkası karartma — dokununca kapanır. */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — siyah, Signal Blue aktif durum.
          Mobilde: ekran dışında duran, kaydırarak açılan çekmece (fixed).
          md ve üstünde: eskisi gibi sabit sütun (static) — tablet/masaüstü
          deneyimi hiç değişmez. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between px-5 pb-6 pt-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              FLOW
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-muted">
              Restoran Yönetimi
            </p>
          </div>
          {/* Mobilde zil üst barda duruyor; burada yerine kapatma butonu var. */}
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Menüyü kapat"
            className="-mr-1 rounded p-1 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white md:hidden"
          >
            <X size={20} strokeWidth={2} />
          </button>
          <div className="hidden md:block">
            <NotificationBell />
          </div>
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
          <div className="flex gap-2">
            <button
              onClick={() => setPwdOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              title="Şifremi Değiştir"
            >
              <KeyRound size={16} strokeWidth={2} />
              Şifre
            </button>
            <button
              onClick={logout}
              className="flex flex-1 items-center justify-center gap-2 rounded bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              <LogOut size={16} strokeWidth={2} />
              Çıkış
            </button>
          </div>
        </div>
      </aside>

      {pwdOpen && <ChangePasswordModal onClose={() => setPwdOpen(false)} />}

      {/* İçerik — mobilde sabit üst barın (h-14) altından başlar.
          min-w-0: flex çocuğu varsayılan olarak içeriğinden küçülemez; bu
          olmadan geniş bir tablo tüm sayfayı yatay kaydırtır (asıl "sıkışma"
          hissinin sebeplerinden). */}
      <main className="min-w-0 flex-1 overflow-auto bg-surface pt-14 md:pt-0">
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
