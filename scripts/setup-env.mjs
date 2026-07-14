// FLOW kurulum: server/.env yoksa server/.env.example'dan üretir.
// - JWT_SECRET her kuruluma özel rastgele değer alır (güvenlik).
// - GRAPH_MEMORY=off (hedefte graphify/pip gerekmez).
// - AI_PROVIDER=none (AI opsiyonel; install-ai betiği açar).
// Idempotent: .env zaten varsa dokunmaz (sahibinin ayarlarını korur).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, 'server', '.env');
const examplePath = join(root, 'server', '.env.example');

if (existsSync(envPath)) {
  console.log('[setup-env] server/.env zaten var — dokunulmadı.');
  process.exit(0);
}
if (!existsSync(examplePath)) {
  console.error('[setup-env] server/.env.example bulunamadı!');
  process.exit(1);
}

let env = readFileSync(examplePath, 'utf8');
const secret = randomBytes(48).toString('hex');

function setVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  return text.trimEnd() + `\n${key}=${value}\n`;
}

env = setVar(env, 'JWT_SECRET', `"${secret}"`);
env = setVar(env, 'GRAPH_MEMORY', 'off');
env = setVar(env, 'AI_PROVIDER', 'none');

writeFileSync(envPath, env, 'utf8');
console.log('[setup-env] server/.env oluşturuldu (rastgele JWT_SECRET, GRAPH_MEMORY=off, AI kapalı).');
