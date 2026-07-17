import { Role, ROLES } from './roles';

// Uygulamadaki korunan sayfaların anahtarları. Her anahtar bir frontend
// rotasına karşılık gelir (ör. "stok" → /stok). Yetki kontrolünün tek kaynağı:
// bir kullanıcı bir sayfayı, ROLÜ o sayfaya varsayılan erişime sahipse VEYA
// patron ona kişiye özel ek erişim (User.extraPages) tanımladıysa görebilir.
//
// ÖNEMLİ: Bu tablo web/src/auth/pages.ts ile birebir aynı tutulmalıdır.
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

const ALL: Role[] = Object.values(ROLES);

// Sayfa → o sayfaya VARSAYILAN erişimi olan roller.
export const PAGE_ROLES: Record<PageKey, Role[]> = {
  salon: ALL,
  menu: ALL,
  gorevler: ALL,
  tavsiyeler: ALL,
  rezervasyonlar: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER],
  mutfak: [ROLES.PATRON, ROLES.MUDUR, ROLES.MUTFAK],
  kasa: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER],
  cari: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER],
  musteriler: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER],
  adisyonlar: [ROLES.PATRON, ROLES.MUDUR],
  karlilik: [ROLES.PATRON, ROLES.MUDUR],
  stok: [ROLES.PATRON, ROLES.MUDUR],
  alislar: [ROLES.PATRON, ROLES.MUDUR],
  belgeler: [ROLES.PATRON, ROLES.MUDUR],
  raporlar: [ROLES.PATRON, ROLES.MUDUR],
  personel: [ROLES.PATRON, ROLES.MUDUR],
  geribildirim: [ROLES.PATRON, ROLES.MUDUR],
  ongoruler: [ROLES.PATRON, ROLES.MUDUR],
  denetim: [ROLES.PATRON, ROLES.MUDUR],
  kullanicilar: [ROLES.PATRON, ROLES.MUDUR],
  veri: [ROLES.PATRON, ROLES.MUDUR],
  ayarlar: [ROLES.PATRON, ROLES.MUDUR],
};

// Kişiye özel verilebilecek sayfalar. Herkese zaten açık olanlar (ALL) ile
// patron/müdürün yönetim sayfaları listeden çıkarılır — geri kalanlar bir
// personele "ekstra" olarak açılabilir.
export function grantablePages(): PageKey[] {
  return PAGE_KEYS.filter((k) => PAGE_ROLES[k].length < ALL.length);
}

export function isPageKey(v: string): v is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(v);
}

// Bir rol + kişiye özel ek sayfalar, belirli bir sayfaya erişebilir mi?
export function canAccessPage(
  role: string,
  extraPages: string[] | null | undefined,
  page: PageKey,
): boolean {
  if (PAGE_ROLES[page].includes(role as Role)) return true;
  return !!extraPages && extraPages.includes(page);
}

// User.extraPages (JSON string) → güvenli PageKey dizisi.
export function parseExtraPages(raw: string | null | undefined): PageKey[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is PageKey => typeof x === 'string' && isPageKey(x));
  } catch {
    return [];
  }
}
