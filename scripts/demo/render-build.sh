#!/usr/bin/env bash
# Render demo derlemesi: bağımlılıklar → Postgres şeması → tablolar → (boşsa) demo verisi → arayüz + sunucu.
# Veritabanı Neon'da durduğu için yeniden yayınlarda veriler KORUNUR; seed yalnız boş veritabanında çalışır.
set -euo pipefail
npm install --include=dev --no-audit --no-fund
node scripts/demo/pg-schema.mjs
cd server
npx prisma generate --schema prisma/pg/schema.prisma
npx prisma db push --schema prisma/pg/schema.prisma --skip-generate
npx ts-node prisma/demo-seed.ts
cd ..
VITE_DEMO=1 npm run build
