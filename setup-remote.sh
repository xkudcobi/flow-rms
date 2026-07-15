#!/usr/bin/env bash
# Uzaktan erişim kurulumu (Linux / macOS).
set -euo pipefail
cd "$(dirname "$0")"
npm run remote:setup
