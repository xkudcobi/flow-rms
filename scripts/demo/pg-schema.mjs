// Demo yayını (Render + Neon Postgres) için şemanın Postgres kopyasını üretir.
// Yerel kurulum SQLite'la çalışmaya devam eder; bu dosya yalnız bulut demosunda kullanılır.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'server', 'prisma', 'schema.prisma');
const outDir = join(root, 'server', 'prisma', 'pg');
const schema = readFileSync(src, 'utf8').replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
if (!schema.includes('"postgresql"')) throw new Error('Şemada sqlite provider bulunamadı');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'schema.prisma'), schema);
console.log('✓ Postgres şeması: server/prisma/pg/schema.prisma');
