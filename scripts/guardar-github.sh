#!/usr/bin/env bash
#
# DIBUJEITOR TV — guarda el trabajo y lo sube a GitHub.
#
# Uso:  bash scripts/guardar-github.sh ["mensaje del commit"]
#
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${DIBUJEITOR_REMOTE:-origin}"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
MESSAGE="${1:-Actualización de DIBUJEITOR TV}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "✗ No es un repositorio git. Ejecutá 'git init' primero."
  exit 1
fi

# Los artefactos pesados (ffmpeg.wasm, .next, node_modules) no se versionan.
git add -A

if git diff --cached --quiet; then
  echo "• No hay cambios para guardar."
else
  git commit -m "$MESSAGE"
  echo "✓ Commit creado: $MESSAGE"
fi

if git remote get-url "$REMOTE" >/dev/null 2>&1; then
  git push "$REMOTE" "$BRANCH"
  echo "✓ Subido a $REMOTE/$BRANCH"
else
  echo "! No hay remote '$REMOTE'. Agregá uno con:"
  echo "  git remote add $REMOTE https://github.com/GabrielYuvone/dibujeitor2000.git"
fi
