#!/bin/sh
set -e

REPO="Enriquefft/prez"
BRANCH="main"
TARGET="${1:-deck}"

if [ -d "$TARGET" ]; then
  echo "Error: $TARGET/ already exists."
  exit 1
fi

echo "Scaffolding presentation into $TARGET/..."

# Download template via GitHub archive
TMP=$(mktemp -d)
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" | tar -xz -C "$TMP"
cp -r "$TMP/prez-$BRANCH/template" "$TARGET"
rm -rf "$TMP"

echo ""
echo "Created $TARGET/"
echo ""
echo "Next steps:"
echo "  cd $TARGET"
echo "  bun install"
echo "  bun run dev"
echo ""
echo "Install the skill so your AI agent knows how to build slides:"
echo "  bunx skills add $REPO"
echo ""
