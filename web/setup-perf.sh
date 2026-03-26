#!/bin/bash
# ================================================================
# LitAssist — Performance Setup Script
# Run once inside the web/ directory:  bash setup-perf.sh
# ================================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "=== LitAssist Performance Setup ==="
echo ""

# ── 1. Install new npm dependencies ──
echo "[1/4] Installing compression & tailwindcss..."
npm install compression --save
npm install tailwindcss --save-dev
echo "  Done."

# ── 2. Create vendor directory ──
echo "[2/4] Downloading Alpine.js to /vendor (self-hosted)..."
mkdir -p vendor

# Download Alpine.js main
curl -sL "https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js" \
     -o vendor/alpine.min.js
echo "  alpine.min.js downloaded ($(du -sh vendor/alpine.min.js | cut -f1))"

# Download Alpine collapse plugin
curl -sL "https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.14.3/dist/cdn.min.js" \
     -o vendor/alpine-collapse.min.js
echo "  alpine-collapse.min.js downloaded ($(du -sh vendor/alpine-collapse.min.js | cut -f1))"

# ── 3. Compile Tailwind CSS ──
echo "[3/4] Compiling Tailwind CSS..."
mkdir -p src
npx tailwindcss \
    -c tailwind.config.js \
    -i src/input.css \
    -o app.css \
    --minify
echo "  app.css compiled ($(du -sh app.css | cut -f1))"

# ── 4. Done ──
echo "[4/4] All done!"
echo ""
echo "Files created:"
echo "  vendor/alpine.min.js"
echo "  vendor/alpine-collapse.min.js"
echo "  app.css"
echo ""
echo "Next steps:"
echo "  - Replace the CDN references in ALL your other HTML files"
echo "    using the same pattern as index.html (see MIGRATION.md)"
echo "  - docker restart literature_web"
echo ""