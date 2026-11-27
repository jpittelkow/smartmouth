#!/usr/bin/env bash
# Build Smartmouth ON the home server from the committed source (git archive | docker build -) and (re)start its
# Compose Manager stack, the same way GlanceTV deploys. Needs only git + key-based SSH here; no local Docker.
#   scripts/deploy.sh            # deploy HEAD (commit first: uncommitted changes are not shipped)
set -euo pipefail
HOST=${SMARTMOUTH_HOST:-root@192.168.1.4}
PORT=8470
PROJECT=/boot/config/plugins/compose.manager/projects/smartmouth

cd "$(dirname "$0")/.."
TAG=$(git rev-parse --short HEAD)
[ -n "$(git status --porcelain)" ] && echo "note: uncommitted changes are NOT deployed (building $TAG)"

echo "==> building smartmouth:$TAG on $HOST"
git archive --format=tar HEAD | ssh "$HOST" "docker build -q -t smartmouth:$TAG -t smartmouth:latest - >/dev/null && echo built"

echo "==> stack files"
ssh "$HOST" "mkdir -p $PROJECT"
ssh "$HOST" "cat > $PROJECT/docker-compose.yml" < deploy/docker-compose.unraid.yml
ssh "$HOST" "echo smartmouth > $PROJECT/name"
# Compose Manager starts again after a reboot only the stacks that carry this file.
ssh "$HOST" "echo true > $PROJECT/autostart"
ssh "$HOST" "bash -s" < deploy/init-env.sh

echo "==> starting"
ssh "$HOST" "cd $PROJECT && docker compose up -d --remove-orphans 2>&1 | tail -2"

echo "==> waiting for /api/health"
for _ in $(seq 1 30); do
  if ssh "$HOST" "curl -fsS -m 3 http://127.0.0.1:$PORT/api/health" 2>/dev/null; then
    echo; echo "==> smartmouth:$TAG is up at http://${HOST#*@}:$PORT (public: https://play.303.social)"
    exit 0
  fi
  sleep 2
done
echo "smartmouth did not come up; logs:"; ssh "$HOST" "docker logs --tail 40 smartmouth"; exit 1
