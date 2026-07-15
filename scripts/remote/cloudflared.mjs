/**
 * cloudflared (Cloudflare Tunnel istemcisi) indirme ve konum yönetimi.
 *
 * Neden kendimiz indiriyoruz: işletmedeki kişiden "şu siteye gir, doğru
 * dosyayı seç, PATH'e ekle" beklemek kurulumun en çok takıldığı yer. Betik
 * doğru ikiliyi indirip proje içine koyar; kullanıcı hiçbir şey seçmez.
 */
import { existsSync, mkdirSync, chmodSync, createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const binDir = join(root, '.cloudflared');

const RELEASE_BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download';

/** Bu makine için doğru cloudflared indirme dosyası. */
function assetFor(platform, arch) {
  const a = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'amd64' : null;
  if (!a) return null;
  if (platform === 'win32') return { file: `cloudflared-windows-${a}.exe`, exe: 'cloudflared.exe' };
  if (platform === 'linux') return { file: `cloudflared-linux-${a}`, exe: 'cloudflared' };
  if (platform === 'darwin') return { file: `cloudflared-darwin-${a}.tgz`, exe: 'cloudflared', tgz: true };
  return null;
}

/** cloudflared'in kurulu olduğu yol (indirilmemişse de beklenen yol). */
export function cloudflaredPath() {
  const asset = assetFor(process.platform, process.arch);
  if (!asset) return null;
  return join(binDir, asset.exe);
}

/** Sistemde zaten kurulu bir cloudflared varsa onu kullan (tekrar indirme). */
async function systemCloudflared() {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execFileAsync(cmd, ['cloudflared']);
    const found = stdout.split(/\r?\n/).find((l) => l.trim());
    return found?.trim() || null;
  } catch {
    return null;
  }
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`İndirme başarısız (HTTP ${res.status}): ${url}`);
  const tmp = dest + '.indiriliyor';
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, dest);
}

/**
 * cloudflared'i hazırlar ve çalıştırılabilir yolunu döndürür.
 * Sırayla: proje içinde var mı → sistemde var mı → indir.
 */
export async function ensureCloudflared() {
  const asset = assetFor(process.platform, process.arch);
  if (!asset) {
    throw new Error(
      `Desteklenmeyen sistem: ${process.platform}/${process.arch}. ` +
        'cloudflared\'i elle kurup PATH\'e ekleyin.',
    );
  }

  const local = join(binDir, asset.exe);
  if (existsSync(local)) return local;

  const system = await systemCloudflared();
  if (system) {
    console.log(`• cloudflared sistemde zaten kurulu: ${system}`);
    return system;
  }

  mkdirSync(binDir, { recursive: true });
  const url = `${RELEASE_BASE}/${asset.file}`;
  console.log('• cloudflared indiriliyor (~20 MB)...');

  if (asset.tgz) {
    // macOS sürümü tgz olarak yayınlanıyor; sistemdeki tar ile açıyoruz.
    const tgz = join(binDir, asset.file);
    await download(url, tgz);
    await execFileAsync('tar', ['-xzf', tgz, '-C', binDir]);
    await rm(tgz, { force: true });
  } else {
    await download(url, local);
  }

  if (process.platform !== 'win32') chmodSync(local, 0o755);
  console.log(`✓ cloudflared hazır: ${local}`);
  return local;
}
