/**
 * npm run remote:start
 *
 * Tüneli başlatır ve açık tutar. Modu server/.env'deki REMOTE_MODE belirler.
 *
 * quick modunda cloudflared adresi kendi log'una basar; o log gürültülü olduğu
 * için adresi yakalayıp burada tek başına, okunur biçimde gösteriyoruz —
 * kurulumu yapan kişinin log satırları arasında adres araması gerekmesin.
 *
 * named modunda Windows'ta servis zaten arka planda çalışıyorsa buna gerek yok;
 * bu komut servis kurulamayan durumlar için (ör. yönetici yetkisi yok) duruyor.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ensureCloudflared, root } from './cloudflared.mjs';

const envPath = join(root, 'server', '.env');

function env(key, fallback = '') {
  if (!existsSync(envPath)) return fallback;
  const text = readFileSync(envPath, 'utf8');
  return new RegExp(`^${key}="?([^"\n]*)"?$`, 'm').exec(text)?.[1]?.trim() || fallback;
}

const QUICK_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

function banner(url) {
  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log('  UZAKTAN ERİŞİM ADRESİNİZ');
  console.log(line);
  console.log('  ' + url);
  console.log('');
  console.log('  Bu adresi telefonunuzdan/başka bilgisayardan açabilirsiniz.');
  console.log('  Bu pencere kapanırsa uzaktan erişim durur.');
  console.log('  Adres, sunucu her yeniden başladığında DEĞİŞİR.');
  console.log(line + '\n');
}

async function main() {
  const mode = (env('REMOTE_MODE', 'off')).toLowerCase();
  if (mode === 'off') {
    console.log('\nUzaktan erişim kapalı (REMOTE_MODE=off).');
    console.log('Açmak için: npm run remote:setup\n');
    process.exit(0);
  }

  const bin = await ensureCloudflared();
  const port = env('PORT', '3011');

  let args;
  if (mode === 'quick') {
    args = ['tunnel', '--url', `http://localhost:${port}`];
    console.log('\n• Geçici tünel açılıyor, adres birazdan görünecek...');
  } else {
    const token = env('TUNNEL_TOKEN');
    if (!token) {
      console.error('\n✗ REMOTE_MODE=named ama TUNNEL_TOKEN boş.');
      console.error('  npm run remote:setup ile token\'ı girin.\n');
      process.exit(1);
    }
    args = ['tunnel', 'run', '--token', token];
    const host = env('REMOTE_HOSTNAME');
    console.log(`\n• Tünel başlatılıyor${host ? ` → https://${host}` : ''}`);
  }

  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let shown = false;

  const scan = (chunk) => {
    const text = chunk.toString();
    if (!shown && mode === 'quick') {
      const match = QUICK_URL.exec(text);
      if (match) {
        shown = true;
        banner(match[0]);
      }
    }
    // cloudflared log'unu bastırıyoruz; hata ayıklaması gerekirse REMOTE_DEBUG=1.
    if (process.env.REMOTE_DEBUG) process.stdout.write(text);
  };

  child.stdout.on('data', scan);
  child.stderr.on('data', scan);

  child.on('exit', (code) => {
    console.log(`\n• Tünel kapandı (çıkış kodu ${code}).`);
    process.exit(code ?? 0);
  });

  const stop = () => child.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('\n✗ Tünel başlatılamadı: ' + (err?.message ?? err) + '\n');
  process.exit(1);
});
