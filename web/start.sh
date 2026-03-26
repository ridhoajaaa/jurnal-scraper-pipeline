#!/usr/bin/env bash
set -e

export DISPLAY=:99

# Hapus lock file lama jika ada (sisa dari container sebelumnya)
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

# Start Xvfb
Xvfb :99 -screen 0 1280x720x24 -ac +render -noreset &

# Tunggu display benar-benar ready
for i in $(seq 1 15); do
    DISPLAY=:99 xdpyinfo >/dev/null 2>&1 && echo "[start.sh] Xvfb ready" && break
    sleep 1
done

# Start x11vnc
x11vnc -display :99 -forever -nopw -quiet -rfbport 5900 -localhost &
sleep 2

# Start websockify
websockify 6080 localhost:5900 &
sleep 1

echo "[start.sh] All services ready on DISPLAY=:99"

# Sync node_modules with package.json on every start (handles volume drift)
echo "[start.sh] Syncing dependencies..."
cd /app/web && npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -1

exec node /app/web/server.js