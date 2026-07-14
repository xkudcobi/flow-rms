// AI'ı açar: server/.env içinde AI_PROVIDER=ollama ve AI_MODEL=<model> yapar.
// install-ai betiğinin son adımı — kullanıcı manuel düzenleme yapmaz.
// Model adı argümandan alınır (varsayılan llama3.2).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const model = process.argv[2] || 'llama3.2';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, 'server', '.env');

if (!existsSync(envPath)) {
  console.error('[enable-ai] server/.env yok — önce kurulumu (setup) çalıştırın.');
  process.exit(1);
}

let env = readFileSync(envPath, 'utf8');
function setVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  return text.trimEnd() + `\n${key}=${value}\n`;
}
env = setVar(env, 'AI_PROVIDER', 'ollama');
env = setVar(env, 'AI_MODEL', model);
if (!/^AI_URL=/m.test(env)) env = env.trimEnd() + '\nAI_URL=http://localhost:11434\n';

writeFileSync(envPath, env, 'utf8');
console.log(`[enable-ai] Yapay zeka açıldı (model: ${model}). Sunucuyu yeniden başlatın.`);
