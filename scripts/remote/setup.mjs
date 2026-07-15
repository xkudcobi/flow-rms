/**
 * npm run remote:setup   (veya setup-remote.bat / setup-remote.sh)
 *
 * İşletmenin uzaktan erişimi açması için tek adım. İki mod:
 *
 *   quick — trycloudflare.com. Domain/hesap/token gerekmez, ücretsiz.
 *           Adres her başlatmada değişir. Test ve deneme için.
 *
 *   named — Kalıcı adres (ör. bistro.flowrms.com). Kurulumu yapan kişiden
 *           sadece token istenir; token'ı sistemi satan taraf provision.mjs
 *           ile üretir. Windows'ta servis olarak kurulur → bilgisayar
 *           açıldığında kendiliğinden başlar, kimsenin bir şey yapması gerekmez.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureCloudflared, root } from './cloudflared.mjs';

const execFileAsync = promisify(execFile);
const envPath = join(root, 'server', '.env');

function readEnv() {
  if (!existsSync(envPath)) {
    console.error(`✗ ${envPath} yok. Önce "npm run setup" çalıştırın.`);
    process.exit(1);
  }
  return readFileSync(envPath, 'utf8');
}

function setEnvVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text)
    ? text.replace(re, `${key}=${value}`)
    : text.trimEnd() + `\n${key}=${value}\n`;
}

function envValue(text, key) {
  return new RegExp(`^${key}="?([^"\n]*)"?$`, 'm').exec(text)?.[1]?.trim() ?? '';
}

/**
 * Uzaktan erişimi açmadan önce güvenlik ön koşulu.
 * Sunucu zaten boot-guard ile başlamayı reddeder; burada erkenden ve
 * anlaşılır biçimde uyarmak, kullanıcının "kurdum ama açılmıyor" yaşamasını önler.
 */
function securityBlockers(env) {
  const problems = [];
  const secret = envValue(env, 'JWT_SECRET');
  const low = secret.toLowerCase();
  if (secret.length < 32 || low.includes('degistir') || low.includes('dev-secret')) {
    problems.push('JWT_SECRET hâlâ kurulumdan gelen örnek değer.');
  }
  return problems;
}

async function installWindowsService(bin, token) {
  console.log('\n• Windows servisi kuruluyor (bilgisayar açılınca otomatik başlar)...');
  try {
    await execFileAsync(bin, ['service', 'install', token]);
    console.log('✓ Servis kuruldu ve çalışıyor.');
    return true;
  } catch (err) {
    const msg = String(err.stderr || err.message || '');
    if (/administrator|access is denied|erişim engellendi/i.test(msg)) {
      console.log('\n✗ Servis kurulumu için YÖNETİCİ yetkisi gerekiyor.');
      console.log('  setup-remote.bat dosyasına sağ tıklayıp');
      console.log('  "Yönetici olarak çalıştır" deyin.\n');
    } else {
      console.log('\n✗ Servis kurulamadı: ' + msg.trim());
      console.log('  Servissiz de çalışır: npm run remote:start\n');
    }
    return false;
  }
}

async function main() {
  let env = readEnv();

  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log('  FLOW — Uzaktan Erişim Kurulumu');
  console.log(line);

  const blockers = securityBlockers(env);
  if (blockers.length) {
    console.log('\n  Önce güvenlik: uzaktan erişim sistemi internete açar.\n');
    for (const b of blockers) console.log('   ✗ ' + b);
    console.log('\n  Şunu çalıştırıp tekrar deneyin:  npm run remote:harden\n');
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log('\n  1) Hızlı test  — ücretsiz, domain gerekmez, adres her başlatmada değişir');
    console.log('  2) Kalıcı adres — token gerekir (sistemi kurandan alın), adres sabit');
    const choice = (await rl.question('\nSeçiminiz [1/2]: ')).trim();

    const bin = await ensureCloudflared();

    if (choice === '2') {
      const token = (await rl.question('\nTunnel token (uzun bir yazı, yapıştırın): ')).trim();
      if (!token) {
        console.log('✗ Token boş. Kurulum iptal edildi.');
        process.exit(1);
      }
      const host = (await rl.question('Adresiniz (ör. bistro.flowrms.com): ')).trim();

      env = setEnvVar(env, 'REMOTE_MODE', 'named');
      env = setEnvVar(env, 'REMOTE_HOSTNAME', host);
      env = setEnvVar(env, 'TUNNEL_TOKEN', token);
      writeFileSync(envPath, env, 'utf8');
      console.log('✓ Ayarlar server/.env dosyasına yazıldı.');

      if (process.platform === 'win32') await installWindowsService(bin, token);

      console.log('\n' + line);
      console.log('  Kurulum tamam.');
      console.log(line);
      console.log(`  Uzaktan adresiniz:  https://${host}`);
      console.log('  FLOW sunucusu çalışır durumdayken bu adres her yerden açılır.');
      console.log(line + '\n');
    } else {
      env = setEnvVar(env, 'REMOTE_MODE', 'quick');
      writeFileSync(envPath, env, 'utf8');
      console.log('✓ Hızlı test modu açıldı.');

      console.log('\n' + line);
      console.log('  Kurulum tamam.');
      console.log(line);
      console.log('  Başlatmak için:  npm run remote:start');
      console.log('  Adres o pencerede yazacak (her başlatmada değişir).');
      console.log(line + '\n');
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('\n✗ Kurulum hatası: ' + (err?.message ?? err) + '\n');
  process.exit(1);
});
