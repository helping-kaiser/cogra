#!/bin/bash
# install.sh — put a checkout's deploy/ tree in place on the host (B-5/B-6;
# deployment.md "Bring-up"). Run as root from the repository root of the
# revision being deployed. Idempotent; it never overwrites an
# /etc/cogra/*.env that exists (those hold this instance's values) and
# never touches a secret.
set -euo pipefail

src=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
[ -f "$src/quadlet/cogra-api.container" ] || { echo "install.sh: run from a checkout's deploy/scripts" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "install.sh: run as root" >&2; exit 1; }

install -d -m 0755 /etc/containers/systemd /usr/local/lib/cogra /etc/cogra/well-known
install -d -m 0700 /etc/cogra/secrets /var/lib/cogra

# The Quadlet units: the generator turns them into cogra-*.service.
install -m 0644 "$src"/quadlet/*.container "$src"/quadlet/*.network "$src"/quadlet/*.volume \
  /etc/containers/systemd/

# The proxy's config: no secrets, readable by the container.
install -m 0644 "$src/proxy/Caddyfile" /etc/cogra/Caddyfile

# Operator scripts and what the units mount from the host.
install -m 0644 "$src/scripts/lib.sh" /usr/local/lib/cogra/lib.sh
for script in alert backup bootstrap deploy disk-watch log-alert restore secret; do
  install -m 0755 "$src/scripts/$script.sh" "/usr/local/lib/cogra/$script.sh"
done
install -m 0755 "$src/media/provision.sh" /usr/local/lib/cogra/media-provision.sh
install -m 0755 "$src/health/http-health.sh" /usr/local/lib/cogra/http-health

# The timers and the alert hook.
install -m 0644 "$src"/systemd/*.service "$src"/systemd/*.timer /etc/systemd/system/

# The journal's cap, so logs cannot fill the disk.
install -d -m 0755 /etc/systemd/journald.conf.d
install -m 0644 "$src/host/journald-cogra.conf" /etc/systemd/journald.conf.d/cogra.conf

# Configuration templates, only where the instance has none yet.
for template in "$src"/env/*.env.example; do
  name=$(basename "$template" .example)
  if [ ! -e "/etc/cogra/$name" ]; then
    install -m 0600 "$template" "/etc/cogra/$name"
    echo "install.sh: wrote /etc/cogra/$name from its template — fill in its values"
  fi
done

systemctl daemon-reload
systemctl restart systemd-journald
echo "install.sh: installed; check the generated units with:"
echo "  /usr/lib/systemd/system-generators/podman-system-generator --dryrun"
