#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LitAssist — MongoDB Auto-Backup
# Runs mongodump inside the literature_mongodb container,
# saves to ./backups/YYYY-MM-DD_HH-MM/, keeps last 7 backups.
#
# Setup (run once):
#   chmod +x scripts/backup.sh
#   crontab -e
#   # Add this line (backup every day at 02:00):
#   0 2 * * * /bin/bash /path/to/jurnal-scraper-pipeline/scripts/backup.sh >> /path/to/jurnal-scraper-pipeline/backups/backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
CONTAINER="literature_mongodb"
DATABASE="literature_assistant"
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
KEEP_LAST=7   # Number of backups to retain
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
DEST="${BACKUP_DIR}/${TIMESTAMP}"

# ── Pre-checks ────────────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Starting backup → ${DEST}"

# Check container is running
if ! podman ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "[backup] ERROR: Container '${CONTAINER}' is not running. Aborting."
    exit 1
fi

# ── Run mongodump inside container ───────────────────────────────────────────
podman exec "${CONTAINER}" mongodump \
    --db "${DATABASE}" \
    --out "/backups/${TIMESTAMP}" \
    --quiet

echo "[backup] mongodump complete."

# ── Rotate: keep only last N backups ─────────────────────────────────────────
BACKUP_COUNT=$(ls -1d "${BACKUP_DIR}"/[0-9][0-9][0-9][0-9]-* 2>/dev/null | wc -l || echo 0)

if [ "${BACKUP_COUNT}" -gt "${KEEP_LAST}" ]; then
    TO_DELETE=$(( BACKUP_COUNT - KEEP_LAST ))
    echo "[backup] Rotating — removing ${TO_DELETE} old backup(s)..."
    ls -1dt "${BACKUP_DIR}"/[0-9][0-9][0-9][0-9]-* | tail -n "${TO_DELETE}" | xargs rm -rf
fi

# ── Summary ───────────────────────────────────────────────────────────────────
FINAL_COUNT=$(ls -1d "${BACKUP_DIR}"/[0-9][0-9][0-9][0-9]-* 2>/dev/null | wc -l)
SIZE=$(du -sh "${DEST}" 2>/dev/null | cut -f1 || echo "?")

echo "[backup] Done. Size: ${SIZE} | Total backups retained: ${FINAL_COUNT}/${KEEP_LAST}"
echo "---"