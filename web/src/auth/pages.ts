import type { AuthUser } from './AuthContext';

type Role = AuthUser['role'];

// Korunan sayfa anahtarları ve rol varsayılanları. ÖNEMLİ: server/src/auth/pages.ts
// ile birebir aynı tutulmalıdır. Yetki: rol varsayılanı VEYA kişiye özel extraPages.
export const PAGE_KEYS = [
  'salon',
  'rezervasyonlar',
  'mutfak',
  'adisyonlar',
  'menu',
  'karlilik',
  'stok',
  'alislar',
  'kasa',
  'cari',
  'belgeler',
  'raporlar',
  'musteriler',
  'personel',
  'geribildirim',
  'ongoruler',
  'denetim',
  'kullanicilar',
  'veri',
  'ayarlar',
  'gorevler',
  'tavsiyeler',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

const ALL: Role[] = ['PATRON', 'MUDUR', 'KASIYER', 'GARSON', 'MUTFAK'];

export const PAGE_ROLES: Record<PageKey, Role[]> = {
  salon: ALL,
  menu: ALL,
  gorevler: ALL,
  tavsiyeler: ALL,
  rezervasyonlar: ['PATRON', 'MUDUR', 'KASIYER'],
  mutfak: ['PATRON', 'MUDUR', 'MUTFAK'],
  kasa: ['PATRON', 'MUDUR', 'KASIYER'],
  cari: ['PATRON', 'MUDUR', 'KASIYER'],
  musteriler: ['PATRON', 'MUDUR', 'KASIYER'],
  adisyonlar: ['PATRON', 'MUDUR'],
  karlilik: ['PATRON', 'MUDUR'],
  stok: ['PATRON', 'MUDUR'],
  alislar: ['PATRON', 'MUDUR'],
  belgeler: ['PATRON', 'MUDUR'],
  raporlar: ['PATRON', 'MUDUR'],
  personel: ['PATRON', 'MUDUR'],
  geribildirim: ['PATRON', 'MUDUR'],
  ongoruler: ['PATRON', 'MUDUR'],
  denetim: ['PATRON', 'MUDUR'],
  kullanicilar: ['PATRON', 'MUDUR'],
  veri: ['PATRON', 'MUDUR'],
  ayarlar: ['PATRON', 'MUDUR'],
};

// İzin editöründe gösterilecek okunur etiketler.
export const PAGE_LABELS: Record<PageKey, string> = {
  salon: 'Salon Planı',
  rezervasyonlar: 'Rezervasyonlar',
  mutfak: 'Mutfak',
  adisyonlar: 'Adisyonlar',
  menu: 'Menü',
  karlilik: 'Kârlılık',
  stok: 'Stok',
  alislar: 'Alışlar',
  kasa: 'Kasa',
  cari: 'Cari',
  belgeler: 'Mali Belgeler',
  raporlar: 'Gün Sonu',
  musteriler: 'Müşteriler',
  personel: 'Personel',
  geribildirim: 'Geri Bildirim',
  ongoruler: 'Öngörüler',
  denetim: 'Denetim',
  kullanicilar: 'Kullanıcılar',
  veri: 'Veri İçe Aktar',
  ayarlar: 'Ayarlar',
  gorevler: 'Görevler',
  tavsiyeler: 'Tavsiyeler',
};

export function isPageKey(v: string): v is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(v);
}

// Rota ("/stok") → sayfa anahtarı ("stok").
export function pageKeyFromRoute(to: string): string {
  return to.replace(/^\//, '');
}

// Bir kullanıcı, verilen rota için erişime sahip mi? Rol varsayılanı VEYA extraPages.
export function canAccessRoute(user: AuthUser, to: string): boolean {
  const key = pageKeyFromRoute(to);
  if (!isPageKey(key)) return true; // korunmayan/tanımsız rota → açık
  if (PAGE_ROLES[key].includes(user.role)) return true;
  return !!user.extraPages && user.extraPages.includes(key);
}

// Kişiye özel verilebilecek sayfalar (herkese açık olanlar hariç).
export function grantablePages(): PageKey[] {
  return PAGE_KEYS.filter((k) => PAGE_ROLES[k].length < ALL.length);
}
