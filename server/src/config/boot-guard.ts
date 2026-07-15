/**
 * Açılış güvenlik kontrolü.
 *
 * Yerel ağda çalışırken zayıf bir şifre ancak restorana giren biri için risktir.
 * Uzaktan erişim açıldığı anda aynı şifre TÜM İNTERNETE açılır — bu yüzden
 * REMOTE_MODE != off iken aşağıdaki kontroller geçilemez (sunucu başlamaz).
 *
 * Amaç, kurulumu yapan kişiyi cezalandırmak değil; sistemi "açtım, çalışıyor"
 * deyip varsayılan şifreyle internete bırakmasını imkânsız kılmak.
 */
import * as bcrypt from 'bcryptjs';
import { remoteEnabled, remoteMode } from './remote-config';

/** Kurulum betiklerinden/örnek dosyadan gelen, üretimde asla kalmaması gereken değerler. */
const KNOWN_WEAK_SECRETS = [
  'degistir-bu-gizli-anahtari-uretimde',
  'dev-secret-degistir-uretimde-3f9a1c7e',
  'secret',
  'changeme',
];

/** seed.ts'in kurduğu varsayılan hesaplar. */
const SEED_DEFAULTS: Array<{ username: string; password: string }> = [
  { username: 'patron', password: 'patron123' },
  { username: 'garson', password: 'garson123' },
  { username: 'mutfak', password: 'mutfak123' },
];

type UserRow = { username: string; password: string };
type PrismaLike = {
  user: { findMany(args?: unknown): Promise<UserRow[]> };
};

function checkJwtSecret(): string[] {
  const secret = (process.env.JWT_SECRET || '').trim();
  const problems: string[] = [];

  if (!secret) {
    problems.push('JWT_SECRET boş.');
    return problems;
  }
  const lowered = secret.toLowerCase();
  if (KNOWN_WEAK_SECRETS.some((weak) => lowered.includes(weak))) {
    problems.push('JWT_SECRET hâlâ kurulumdan gelen örnek değer.');
  } else if (lowered.includes('degistir') || lowered.includes('degiştir')) {
    problems.push('JWT_SECRET "degistir" içeriyor — değiştirilmemiş görünüyor.');
  }
  if (secret.length < 32) {
    problems.push(`JWT_SECRET çok kısa (${secret.length} karakter, en az 32 olmalı).`);
  }
  return problems;
}

async function checkDefaultPasswords(prisma: PrismaLike): Promise<string[]> {
  const problems: string[] = [];
  let users: UserRow[];
  try {
    users = await prisma.user.findMany({
      where: { username: { in: SEED_DEFAULTS.map((d) => d.username) } },
      select: { username: true, password: true },
    });
  } catch {
    // Veritabanı okunamadıysa şifre kontrolünü sessizce atla; asıl hatayı
    // uygulamanın kendi başlatma akışı zaten bildirecek.
    return problems;
  }

  for (const user of users) {
    const seed = SEED_DEFAULTS.find((d) => d.username === user.username);
    if (!seed) continue;
    if (await bcrypt.compare(seed.password, user.password)) {
      problems.push(`"${user.username}" hesabı hâlâ varsayılan şifreyi kullanıyor.`);
    }
  }
  return problems;
}

/**
 * Uzaktan erişim açıksa güvenlik ön koşullarını doğrular.
 * Sorun varsa açıklayıcı bir mesaj basıp süreci sonlandırır.
 */
export async function assertRemoteSecurity(prisma: PrismaLike): Promise<void> {
  if (!remoteEnabled()) return;

  const problems = [...checkJwtSecret(), ...(await checkDefaultPasswords(prisma))];
  if (problems.length === 0) return;

  const line = '='.repeat(64);
  console.error('\n' + line);
  console.error('  UZAKTAN ERİŞİM AÇILAMADI — ÖNCE GÜVENLİK');
  console.error(line);
  console.error(`  REMOTE_MODE=${remoteMode()} yani sistem internete açılacak.`);
  console.error('  Aşağıdakiler düzeltilmeden bu güvenli değil:\n');
  for (const p of problems) console.error('   ✗ ' + p);
  console.error('\n  Nasıl düzeltilir:');
  console.error('     npm run remote:harden      (şifreleri ve JWT_SECRET\'i yeniler)');
  console.error('\n  Ya da uzaktan erişimi kapatmak için server/.env içinde:');
  console.error('     REMOTE_MODE=off');
  console.error(line + '\n');
  process.exit(1);
}
