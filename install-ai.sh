#!/usr/bin/env bash
# FLOW - Yapay Zeka kurulumu (opsiyonel, macOS / Linux)
set -e
cd "$(dirname "$0")"
echo "Ollama (yerel yapay zeka) kuruluyor..."
if [ "$(uname)" = "Darwin" ]; then
  brew install --cask ollama || echo "brew yoksa https://ollama.com adresinden kurun."
  open -a Ollama || true
  sleep 3
else
  curl -fsSL https://ollama.com/install.sh | sh
fi
echo "Model indiriliyor (llama3.2)..."
ollama pull llama3.2
node scripts/enable-ai.mjs llama3.2
echo ""
echo "Yapay zeka hazir! Sunucuyu yeniden baslatin (./start.sh)."
echo "(Daha guclu Turkce icin: ollama pull llama3.1:8b && node scripts/enable-ai.mjs llama3.1:8b)"
