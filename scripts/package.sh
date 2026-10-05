#!/usr/bin/env bash
# Gera release/pavio-<versão>.zip a partir de dist/ (o arquivo que vai para a Chrome Web Store).
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./package.json').version")
manifest_version=$(node -p "require('./dist/manifest.json').version")
if [ "$version" != "$manifest_version" ]; then
  echo "Versão do package.json ($version) diferente do manifest ($manifest_version). Rode 'npm run build' antes." >&2
  exit 1
fi
mkdir -p release
out="release/pavio-$version.zip"
rm -f "$out"
(cd dist && zip -qr "../$out" . -x "*.DS_Store" -x "__MACOSX/*")
echo "Pacote criado: $out ($(du -h "$out" | cut -f1))"
unzip -Z1 "$out" | sed 's/^/  /'
