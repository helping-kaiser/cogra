#!/bin/bash
# Bring up only the media services from this worktree's compose file. The
# database is already running from the main checkout's project and is
# deliberately left alone.
set -uo pipefail
cd /mnt/c/Users/peerp/dev/cogra/.claude/worktrees/agent-ac4ca7bd682a4a524 || exit 2
export MEDIA_ACCESS_KEY_ID=cogra_media
export MEDIA_SECRET_ACCESS_KEY=cogra_media_secret
export MEDIA_BUCKET=cogra-media
podman compose -f docker/docker-compose.yml up -d media media-init
echo "---- containers ----"
podman ps --format '{{.Names}} {{.Status}} {{.Ports}}'
