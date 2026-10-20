#!/usr/bin/env bash
#
# DIBUJEITOR TV — trae el trabajo desde GitHub.
#
# Uso:  bash scripts/traer-github.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${DIBUJEITOR_REMOTE:-origin}"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "✗ No es un repositorio git. Ejecutá 'git init' primero."
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "✗ No hay remote '$REMOTE'. Agregá uno con:"
  echo "  git remote add $REMOTE https://github.com/GabrielYuvone/dibujeitor2000.git"
  exit 1
fi

git fetch "$REMOTE" "$BRANCH"

LOCAL="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "$REMOTE/$BRANCH")"

if [ "$LOCAL" = "$REMOTE_HEAD" ]; then
  echo "• Ya estás al día con $REMOTE/$BRANCH."
  exit 0
fi

if git diff --quiet; then
  git merge --ff-only "$REMOTE/$BRANCH"
  echo "✓ Actualizado a $REMOTE/$BRANCH"
else
  git pull --rebase "$REMOTE" "$BRANCH"
  echo "✓ Actualizado (rebase) desde $REMOTE/$BRANCH"
fi
