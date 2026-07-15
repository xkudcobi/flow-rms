/**
 * npm run remote:provision -- <isletme-adi> [--email patron@ornek.com] [--port 3011]
 *
 * SİSTEMİ SATAN/KURAN TARAF içindir, işletme için değil.
 *
 * Yeni bir işletmeye kalıcı uzaktan adres açar. Cloudflare panelinde hiçbir şey
 * tıklamadan, tek komutla:
 *
 *   1) Tünel oluşturur            → flow-<isletme>
 *   2) Tünel token'ını alır       → işletmeye verilecek tek şey
 *   3) Ingress kuralını yazar     → <isletme>.<domain> → http://localhost:3011
 *   4) DNS CNAME kaydını açar     → adres internette çözümlenir
 *   5) (--email ile) Cloudflare Access → adrese sadece o e-posta girebilir
 *
 * Tek domain, sınırsız işletme: her işletme bir alt alan adı alır, domain
 * maliyeti işletme başına değil toplamda bir kez ödenir.
 *
 * Idempotent: aynı işletme için tekrar çalıştırınca yenisini oluşturmaz,
 * mevcudu bulup token'ını tekrar basar.
 *
 * Gerekli ayarlar — proje kökünde .cf-provision.env (git'e girmez):
 *   CF_API_TOKEN=...      Cloudflare API token
 *   CF_ACCOUNT_ID=...     Hesap kimliği
 *   CF_ZONE_ID=...        Domain'in zone kimliği
 *   CF_BASE_DOMAIN=...    Ana domain (ör. flowrms.com)
 *
 * API token izinleri:  Account → Cloudflare Tunnel → Edit
 *                      Zone    → DNS → Edit
 *                      (--email kullanacaksanız: Account → Access: Apps and Policies → Edit)
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const credsPath = join(root, '.cf-provision.env');
const API = 'https://api.cloudflare.com/client/v4';

// ── Ayarları yükle ────────────────────────────────────────────────────────
function loadCreds() {
  if (existsSync(credsPath)) {
    for (const raw of readFileSync(credsPath, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function requireCreds() {
  const need = ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_ZONE_ID', 'CF_BASE_DOMAIN'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('\n✗ Eksik ayar: ' + missing.join(', '));
    console.error(`\n  ${credsPath} dosyası oluşturun:\n`);
    console.error('    CF_API_TOKEN=cloudflare-api-token');
    console.error('    CF_ACCOUNT_ID=hesap-kimligi');
    console.error('    CF_ZONE_ID=zone-kimligi');
    console.error('    CF_BASE_DOMAIN=flowrms.com\n');
    console.error('  Token: Cloudflare → My Profile → API Tokens → Create Token');
    console.error('  İzinler: Account→Cloudflare Tunnel→Edit, Zone→DNS→Edit\n');
    process.exit(1);
  }
}

// ── Cloudflare API yardımcısı ─────────────────────────────────────────────
async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let json = {};
  try {
    json = await res.json();
  } catch {
    /* gövdesiz yanıt */
  }

  if (!res.ok || json.success === false) {
    const detail = (json.errors ?? [])
      .map((e) => `[${e.code}] ${e.message}`)
      .join('; ');
    throw new Error(
      `${method} ${path} → HTTP ${res.status}` + (detail ? `\n    ${detail}` : ''),
    );
  }
  return json.result;
}

// ── Adımlar ───────────────────────────────────────────────────────────────
async function findOrCreateTunnel(name) {
  // is_deleted=false: silinmiş aynı isimli tüneller listeye karışmasın.
  const existing = await cf(
    'GET',
    `/accounts/${process.env.CF_ACCOUNT_ID}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
  );
  if (Array.isArray(existing) && existing.length) {
    console.log(`• Tünel zaten var, yeniden kullanılıyor: ${name}`);
    return existing[0];
  }
  // config_src: 'cloudflare' → uzaktan yönetilen tünel. İşletme tarafında
  // yapılandırma dosyası yok; ingress'i biz API'den yazıyoruz, onlar sadece
  // token'ı yapıştırıyor.
  const created = await cf('POST', `/accounts/${process.env.CF_ACCOUNT_ID}/cfd_tunnel`, {
    name,
    config_src: 'cloudflare',
  });
  console.log(`✓ Tünel oluşturuldu: ${name}`);
  return created;
}

async function tunnelToken(tunnel) {
  // Oluşturma yanıtı bazı sürümlerde token'ı içeriyor, bazılarında içermiyor.
  // İkisini de destekle: yoksa ayrı uçtan çek.
  if (tunnel.token) return tunnel.token;
  return cf('GET', `/accounts/${process.env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnel.id}/token`);
}

async function setIngress(tunnelId, hostname, port) {
  try {
    await cf(
      'PUT',
      `/accounts/${process.env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnelId}/configurations`,
      {
        config: {
          ingress: [
            { hostname, service: `http://localhost:${port}`, originRequest: {} },
            // Eşleşmeyen her istek için zorunlu son kural.
            { service: 'http_status:404' },
          ],
        },
      },
    );
    console.log(`✓ Yönlendirme: ${hostname} → http://localhost:${port}`);
  } catch (err) {
    if (/not allowed for the api_token/i.test(String(err.message))) {
      throw new Error(
        'API token bu işlemi yapamıyor. Token izinlerine ' +
          '"Account → Cloudflare Tunnel → Edit" ekleyin.\n    Ayrıntı: ' + err.message,
      );
    }
    throw err;
  }
}

async function upsertDns(hostname, tunnelId) {
  const target = `${tunnelId}.cfargotunnel.com`;
  const found = await cf(
    'GET',
    `/zones/${process.env.CF_ZONE_ID}/dns_records?name=${encodeURIComponent(hostname)}`,
  );

  if (Array.isArray(found) && found.length) {
    const rec = found[0];
    if (rec.content === target && rec.type === 'CNAME') {
      console.log(`• DNS kaydı zaten doğru: ${hostname}`);
      return;
    }
    await cf('PATCH', `/zones/${process.env.CF_ZONE_ID}/dns_records/${rec.id}`, {
      type: 'CNAME',
      name: hostname,
      content: target,
      proxied: true,
    });
    console.log(`✓ DNS kaydı güncellendi: ${hostname}`);
    return;
  }

  // proxied: true zorunlu — tünel trafiği Cloudflare üzerinden geçmeli,
  // HTTPS sertifikası da buradan gelir.
  await cf('POST', `/zones/${process.env.CF_ZONE_ID}/dns_records`, {
    type: 'CNAME',
    name: hostname,
    content: target,
    proxied: true,
  });
  console.log(`✓ DNS kaydı açıldı: ${hostname}`);
}

async function setupAccess(hostname, email) {
  const acc = `/accounts/${process.env.CF_ACCOUNT_ID}/access/apps`;
  const apps = await cf('GET', acc);
  let app = (apps ?? []).find((a) => a.domain === hostname);

  if (!app) {
    app = await cf('POST', acc, {
      name: `FLOW — ${hostname}`,
      domain: hostname,
      type: 'self_hosted',
      session_duration: '24h',
    });
    console.log(`✓ Access uygulaması oluşturuldu: ${hostname}`);
  } else {
    console.log(`• Access uygulaması zaten var: ${hostname}`);
  }

  const policies = await cf('GET', `${acc}/${app.id}/policies`);
  if ((policies ?? []).some((p) => p.name === 'FLOW patron')) {
    console.log('• Access politikası zaten var.');
    return;
  }
  await cf('POST', `${acc}/${app.id}/policies`, {
    name: 'FLOW patron',
    decision: 'allow',
    include: [{ email: { email } }],
  });
  console.log(`✓ Access: yalnızca ${email} girebilir (e-posta kodu ile doğrulama).`);
}

// ── Ana akış ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { slug: '', email: '', port: '3011' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') args.email = argv[++i] ?? '';
    else if (a === '--port') args.port = argv[++i] ?? '3011';
    else if (!a.startsWith('--') && !args.slug) args.slug = a;
  }
  return args;
}

async function main() {
  loadCreds();
  const args = parseArgs(process.argv.slice(2));

  if (!args.slug) {
    console.error('\nKullanım: npm run remote:provision -- <isletme-adi> [--email patron@ornek.com]');
    console.error('Örnek:    npm run remote:provision -- bistro-ahmet --email ahmet@ornek.com\n');
    process.exit(1);
  }
  if (!/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/.test(args.slug)) {
    console.error(`\n✗ Geçersiz işletme adı: "${args.slug}"`);
    console.error('  Sadece küçük harf, rakam ve tire. Örnek: bistro-ahmet\n');
    process.exit(1);
  }
  requireCreds();

  const hostname = `${args.slug}.${process.env.CF_BASE_DOMAIN}`;
  const tunnelName = `flow-${args.slug}`;
  const line = '='.repeat(64);

  console.log(`\n${line}\n  Yeni işletme kuruluyor: ${hostname}\n${line}`);

  const tunnel = await findOrCreateTunnel(tunnelName);
  const token = await tunnelToken(tunnel);
  await setIngress(tunnel.id, hostname, args.port);
  await upsertDns(hostname, tunnel.id);
  if (args.email) await setupAccess(hostname, args.email);

  console.log(`\n${line}`);
  console.log('  HAZIR — İŞLETMEYE ŞUNLARI VERİN');
  console.log(line);
  console.log(`\n  Adres:  https://${hostname}\n`);
  console.log('  Token (gizli, sadece işletmeye):\n');
  console.log('  ' + token + '\n');
  console.log('  İşletmede yapılacak tek şey:');
  console.log('    1) setup-remote.bat  → sağ tık, "Yönetici olarak çalıştır"');
  console.log('    2) "2" seçip yukarıdaki token\'ı yapıştırmak');
  console.log(`    3) adres olarak ${hostname} yazmak`);
  if (!args.email) {
    console.log('\n  Not: --email vermediniz. Adrese linki bilen herkes ulaşıp giriş');
    console.log('  ekranını görür (şifre yine gerekir). Tek e-postaya kilitlemek için:');
    console.log(`    npm run remote:provision -- ${args.slug} --email patron@ornek.com`);
  }
  console.log(line + '\n');
}

main().catch((err) => {
  console.error('\n✗ Provisioning başarısız:\n  ' + (err?.message ?? err) + '\n');
  process.exit(1);
});
