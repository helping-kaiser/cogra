#!/bin/bash
# http-health PORT PATH — the container health probe for an HTTP service
# on this container's loopback (deployment.md "Health").
#
# Exits 0 only on a 200. Written against bash's /dev/tcp so the images need
# no curl: the api image carries it, and the ranker unit mounts it from the
# host (deploy/quadlet/cogra-ranker.container).
set -eu
port=${1:?usage: http-health PORT PATH}
path=${2:?usage: http-health PORT PATH}
exec 3<>"/dev/tcp/127.0.0.1/${port}"
printf 'GET %s HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n' "$path" >&3
IFS= read -r -t 5 status <&3
case $status in
  "HTTP/1."?" 200"*) exit 0 ;;
  *) exit 1 ;;
esac
