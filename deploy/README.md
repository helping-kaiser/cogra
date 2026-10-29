# The production tree · `guide:repo:deploy`

Everything that runs CoGra on its production host: the images, the
Quadlet units, the proxy, the env templates, and the operator scripts.
The reasoning, the topology and the bring-up checklist are in
[docs/implementation/deployment.md](../docs/implementation/deployment.md);
this file is the map and the commands.

## Layout

| Path | Installed to | What |
|---|---|---|
| `Containerfile.api`, `Containerfile.web`, `web.containerignore` | — | the two app images (the ranker's is `crates/ranker-server/Containerfile`) |
| `quadlet/` | `/etc/containers/systemd/` | one `.container` per service, the two networks, the volumes |
| `proxy/Caddyfile` | `/etc/cogra/Caddyfile` | routing and TLS |
| `env/*.env.example` | `/etc/cogra/*.env` (0600) | every unit's configuration; no secrets |
| `media/provision.sh` | `/usr/local/lib/cogra/media-provision.sh` | the stores' one-shot provisioning |
| `health/http-health.sh` | `/usr/local/bin/http-health` in the API image; `/usr/local/lib/cogra/http-health` for the ranker | the HTTP health probe |
| `web/healthcheck.mjs` | `/app/healthcheck.mjs` in the web image | the web health probe |
| `scripts/` | `/usr/local/lib/cogra/` | install, deploy, backup, restore, bootstrap, alerts |
| `systemd/` | `/etc/systemd/system/` | the backup, disk-watch and log-alert timers; the alert hook |
| `host/journald-cogra.conf` | `/etc/systemd/journald.conf.d/cogra.conf` | the journal's size cap |

## Build and ship (off the box)

```bash
make deploy-images            # cogra-{api,web,ranker}:<commit>, from a clean tree
podman save -m cogra-api:<c> cogra-web:<c> cogra-ranker:<c> | ssh root@<host> podman load
```

## First install (on the box, as root)

```bash
git clone https://github.com/helping-kaiser/cogra && cd cogra && git checkout <c>
deploy/scripts/install.sh                # units, scripts, templates into place
$EDITOR /etc/cogra/*.env                 # fill in the domain and origins
/usr/local/lib/cogra/secret.sh cogra-postgres-password --random 24   # …and every secret in deployment.md "Configuration"
podman pull docker.io/library/postgres:18-alpine docker.io/minio/minio:RELEASE.2025-09-07T16-13-09Z docker.io/library/caddy:2.11.7-alpine
for i in api web ranker; do podman tag localhost/cogra-$i:<c> localhost/cogra-$i:deployed; done
/usr/lib/systemd/system-generators/podman-system-generator --dryrun >/dev/null && echo units ok
restic init                              # with backup.env's repository and password file
systemctl start cogra-proxy.service cogra-ranker.service   # pulls in the rest, in order
/usr/local/lib/cogra/bootstrap.sh        # once, in a terminal; keep the recovery code
systemctl enable --now cogra-backup.timer cogra-disk-watch.timer cogra-log-alert.timer
/usr/local/lib/cogra/backup.sh --tag first && /usr/local/lib/cogra/restore.sh drill
```

## Every release

```bash
/usr/local/lib/cogra/deploy.sh <c>                                   # backup, retag, migrate, smoke
podman exec -i cogra-api release publish --component web --version <v> --notes-file /dev/stdin < notes.txt
```

## Rollback

```bash
/usr/local/lib/cogra/deploy.sh --rollback-to <previous>                          # no migration since
/usr/local/lib/cogra/deploy.sh --rollback-to <previous> --restore <snapshot>     # across a migration
```

The pre-deploy snapshot of every deploy is in `/var/lib/cogra/deploys.log`.

## Looking around

```bash
systemctl list-units 'cogra-*'
journalctl -u cogra-api -f
podman exec -it cogra-postgres psql -U cogra -d cogra
podman exec cogra-media-held sh -c 'mc alias set root http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc ls root/cogra-media-held'
```
