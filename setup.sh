#!/usr/bin/env bash
# FLOW kurulum (macOS / Linux)
set -e
cd "$(dirname "$0")"
echo "FLOW kurulumu basliyor (paketler, veritabani, derleme)..."
npm run setup
echo ""
echo "Kurulum tamamlandi!"
echo "  1) (Linux) Guvenlik duvari: sudo ufw allow 3011/tcp"
echo "  2) ./start.sh ile baslatin"
