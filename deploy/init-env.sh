#!/usr/bin/env bash
# Runs ON the server (piped by scripts/deploy.sh). Creates the settings file once; never overwrites it, so keys
# added by hand (OPENROUTER_API_KEY, ADMIN_TOKEN) survive deploys.
set -euo pipefail
APPDATA=/mnt/apps/appdata/smartmouth
mkdir -p "$APPDATA/data"
chown 1000:1000 "$APPDATA/data"
if [ ! -f "$APPDATA/.env" ]; then
  ADMIN=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
  cat > "$APPDATA/.env" <<EOF
PORT=8470
PUBLIC_URL=https://play.303.social
EXTRA_ORIGINS=
DATA_DIR=/data
ADMIN_TOKEN=$ADMIN
OPENROUTER_API_KEY=
AI_VOICE_MODEL=elevenlabs/eleven-v4
EOF
  chmod 600 "$APPDATA/.env"
  echo "created $APPDATA/.env (add OPENROUTER_API_KEY there by hand)"
fi
