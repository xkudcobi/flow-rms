/**
 * npm run remote:harden            (şifreleri siz yazarsınız)
 * npm run remote:harden -- --auto  (hepsini üretsin, soru sormasın)
 *
 * Uzaktan erişim açmadan önce sistemi güvenli hale getirir:
 *   1) JWT_SECRET'i rastgele yeniler (eski oturumlar geçersiz olur).
 *   2) Varsayılan şifreli hesaplara yeni şifre koyar.
 *
 * Idempotent: tekrar çalıştırmak zarar vermez, sadece hâlâ zayıf olanı düzeltir.
 * Bu betik boot-guard'ın "düzeltmek için şunu çalıştır" dediği araçtır.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const envPath = join(root, 'server', '.env');

/**
 * Bağımlılığı yükler. npm workspaces bağımlılıkları kök node_modules'a "hoist"
 * eder, ama her zaman değil (çakışma varsa server/node_modules'da kalır).
 * Sabit bir yola güvenmek yerine iki konumu da dene.
 */
function loadDep(name) {
  for (const base of [root, join(root, 'server')]) {
    try {
      return createRequire(join(base, 'index.js'))(name);
    } catch (err) {
      if (err?.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error(
    `"${name}" bulunamadı. Proje kökünde "npm install" çalıştırıp tekrar deneyin.`,
  );
}

const DEFAULTS = [
  { username: 'patron', password: 'patron123' },
  { username: 'garson', password: 'garson123' },
  { username: 'mutfak', password: 'mutfak123' },
];

/**
 * server/.env'i process.env'e yükler. PrismaClient DATABASE_URL'i ortamdan
 * okur; bu betik sunucu üzerinden değil doğrudan çalıştığı için onu biz veriyoruz.
 * Zaten tanımlı değişkenlerin üzerine yazmayız (test/CI ortamı ezebilsin).
 */
function loadServerEnv() {
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function strongPassword() {
  // Karışması kolay karakterler (0/O, 1/l/I) yok — personel elle yazacak.
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function setEnvVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text)
    ? text.replace(re, `${key}=${value}`)
    : text.trimEnd() + `\n${key}=${value}\n`;
}

async function rotateJwtSecret() {
  if (!existsSync(envPath)) {
    console.error(`✗ ${envPath} bulunamadı. Önce "npm run setup" çalıştırın.`);
    process.exit(1);
  }
  let env = readFileSync(envPath, 'utf8');
  const current = /^JWT_SECRET="?([^"\n]*)"?$/m.exec(env)?.[1] ?? '';
  const weak =
    current.length < 32 ||
    current.toLowerCase().includes('degistir') ||
    current.toLowerCase().includes('dev-secret');

  if (!weak) {
    console.log('• JWT_SECRET zaten güçlü — dokunulmadı.');
    return;
  }
  env = setEnvVar(env, 'JWT_SECRET', `"${randomBytes(48).toString('hex')}"`);
  writeFileSync(envPath, env, 'utf8');
  console.log('✓ JWT_SECRET yenilendi (açık oturumlar kapanacak, tekrar giriş gerekir).');
}

async function rotatePasswords({ auto }) {
  const { PrismaClient } = loadDep('@prisma/client');
  const bcrypt = loadDep('bcryptjs');
  const prisma = new PrismaClient();
  // --auto ise ya da terminal interaktif değilse (boru hattı, servis, CI) hiç
  // soru sorma; sorarsak stdin kapanınca çökeriz.
  const interactive = !auto && stdin.isTTY;
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
  const assigned = [];

  try {
    for (const def of DEFAULTS) {
      const user = await prisma.user.findUnique({ where: { username: def.username } });
      if (!user) continue;
      if (!(await bcrypt.compare(def.password, user.password))) {
        console.log(`• "${def.username}" şifresi zaten değiştirilmiş — dokunulmadı.`);
        continue;
      }

      let chosen = '';
      while (true) {
        if (!rl) {
          chosen = strongPassword();
          break;
        }
        const answer = (
          await rl.question(`\n"${def.username}" için yeni şifre (boş bırakırsanız güçlü bir tane üretilir): `)
        ).trim();

        if (!answer) {
          chosen = strongPassword();
          break;
        }
        if (answer.length < 8) {
          console.log('  ✗ En az 8 karakter olmalı.');
          continue;
        }
        if (DEFAULTS.some((d) => d.password === answer)) {
          console.log('  ✗ Bu varsayılan şifrelerden biri — başka bir şey seçin.');
          continue;
        }
        chosen = answer;
        break;
      }

      await prisma.user.update({
        where: { username: def.username },
        data: { password: await bcrypt.hash(chosen, 10) },
      });
      assigned.push({ username: def.username, password: chosen });
    }
  } finally {
    rl?.close();
    await prisma.$disconnect();
  }

  if (assigned.length) {
    const line = '='.repeat(58);
    console.log('\n' + line);
    console.log('  YENİ ŞİFRELER — ŞİMDİ KAYDEDİN, BİR DAHA GÖSTERİLMEYECEK');
    console.log(line);
    for (const a of assigned) console.log(`   ${a.username.padEnd(8)} ${a.password}`);
    console.log(line + '\n');
  }
}

const auto = process.argv.includes('--auto');

loadServerEnv();
await rotateJwtSecret();
await rotatePasswords({ auto });
console.log('Hazır. Uzaktan erişimi açmak için: npm run remote:setup\n');
