# Deployment · `spec:implementation:deployment`

How CoGra runs in production: one rented host, one container per
service under systemd, Caddy as the only door in. The artifacts live
in [`deploy/`](../../deploy/README.md); this doc is their reasoning
and the procedures that use them — deploy, rollback, backup, restore,
and the bring-up checklist that turns a rented box into an instance.
Development runs the same services through compose
([development.md](development.md)); the production units mirror its
services, names and volumes one for one, so the two stay comparable.

The instance runs on the L1 stand-in
([roadmap.md](roadmap.md)): its `l1_*` tables live in the same
Postgres as everything else, which shapes the backup rules below.

---

## Topology

```
                 Internet
                    │ 80/443 only (and 22 for ssh, key-only)
           ┌────────▼─────────┐
           │   cogra-proxy    │  Caddy: ACME TLS, HTTP→HTTPS, the one ingress
           └─┬──────┬───────┬─┘
  /graphql   │      │       │  everything else
  /media/uploads*   │ /media/* (GET/HEAD)
           ┌─▼───┐  │   ┌───▼─────┐
           │ api │  │   │   web   │  next start; SSR GraphQL via the proxy's :8081
           └┬┬┬┬─┘  │   └─────────┘
            │││└────▼──────────┐
            │││  cogra-media   │  live + carried buckets
            ││└─► cogra-media-held   held bucket, its own instance
            │└──► cogra-postgres     the one store, l1_* included
            ├───► cogra-ranker       its own pod; slice reads via :8081
            └───► SMTP submission    egress only
   host timers: backup pair, disk watch, log alert; off-box probe
```

| Unit | Image | Networks | Host ports |
|---|---|---|---|
| `cogra-proxy` | `caddy:2.11.7-alpine` | edge, internal | 80, 443/tcp, 443/udp |
| `cogra-web` | `cogra-web:<commit>` | edge | none |
| `cogra-api` | `cogra-api:<commit>` | edge, internal | none |
| `cogra-ranker` | `cogra-ranker:<commit>` | internal | none |
| `cogra-postgres` | `postgres:18-alpine` | internal | none |
| `cogra-media` | MinIO, dev's pin | internal | none |
| `cogra-media-held` | MinIO, dev's pin | internal | none |
| `cogra-media-init`, `cogra-media-held-init` | MinIO, one-shot | internal | none |

Every service is a **Quadlet** unit — a `.container`, `.network` or
`.volume` file the podman systemd generator turns into a service,
the form podman documents in place of the deprecated `podman generate
systemd` (`podman-systemd.unit(5)`). systemd orders, restarts and
boots them; nothing depends on compose in production. The host runs
Ubuntu 24.04 LTS with its podman 4.9, the release the dev toolbox
runs, and podman runs rootful with non-root users inside the
application images.

Two networks split what may reach what. **Internal** is a podman
`--internal` network — no route off the host — holding Postgres, both
stores, the ranker, and the API and proxy that reach them. **Edge**
holds the proxy, the web server and the API: the members that take
the proxy's traffic or need a way out (ACME, SMTP submission, the
HIBP range API). Postgres and the stores therefore cannot dial out
at all, and nothing but the proxy is published.

The ranker is its own container on the internal network, never part
of the API process ([miner-api.md](miner-api.md)). The API relays
`feedRanking` to it over `RANKER_URL`; it reads the slice back
through the proxy (see [Routing](#routing)).

---

## Images

| Image | Built from | Contents |
|---|---|---|
| `cogra-api` | [`deploy/Containerfile.api`](../../deploy/Containerfile.api) | `api`, `bootstrap`, `release` on Ubuntu 24.04 with its `ffmpeg` and `ca-certificates`; the migrations directory, read only; user `cogra` (10001) |
| `cogra-web` | [`deploy/Containerfile.web`](../../deploy/Containerfile.web) | the `next build` output and production dependencies on Node 24.18.0 (`web/.nvmrc`); user `node` |
| `cogra-ranker` | [`crates/ranker-server/Containerfile`](../../crates/ranker-server/Containerfile) | `cogra-ranker` on Debian slim; user `ranker` |

`make deploy-images` builds all three from a clean tree, tagged with
the commit (`cogra-api:<12-hex>`), and stamps the full hash into each
image's `org.opencontainers.image.revision` label. `CONTAINER`
selects the CLI ([development.md](development.md#environment-variables)).
The images are built off the box and shipped as an archive:

```bash
podman save -m cogra-api:<c> cogra-web:<c> cogra-ranker:<c> | ssh <host> podman load
```

`l1-dev` is not in the API image: its money and clock surfaces are
development tools. The runtime is Ubuntu for its `ffmpeg`, which
carries the encoders and filters the ingest worker's startup probe
asks for; `ca-certificates` is required because the SMTP transport
and the breach check verify TLS against the OS trust store. The web
image runs `next start` directly — TLS is the proxy's, and
`web/scripts/prod.mjs` is the dev machine's TLS front. Its build
bakes the production upstreams into `next.config.ts`'s rewrites,
which the proxy pre-empts, so they are only a correct fallback.

**Units never name a commit.** Each application unit runs
`localhost/cogra-<component>:deployed`; a deploy retags a loaded
commit image as `:deployed` and restarts the unit. Podman 4.9's
Quadlet has no drop-in files, so a moving tag is what keeps the unit
files identical across releases. The public images (Postgres, MinIO,
Caddy) are pinned in the units and pulled by hand at bring-up; every
unit sets `Pull=never`, and nothing auto-updates.

---

## Configuration

Non-secret configuration is one env file per unit in `/etc/cogra/`
(root, `0600`), installed from the templates in
[`deploy/env/`](../../deploy/env/), which document every value they
set. Bucket names live in `buckets.env` alone and are read by every
unit that names a bucket. Podman reads these files literally: no
quotes around values.

Secrets are **podman secrets**, handed to containers as environment
variables through Quadlet's `Secret=…,type=env,target=…`. They never
sit in the repository, an env file or a unit file. Every secret has
an off-box copy in the operator's password manager: a rebuilt box
must be able to read its own backups.

| Secret | Read by | Notes |
|---|---|---|
| `cogra-postgres-password` | postgres (`POSTGRES_PASSWORD`), api (`PGPASSWORD`) | The API's `DATABASE_URL` names no password; sqlx reads libpq's `PGPASSWORD` under it, so one secret serves both sides |
| `cogra-media-root-user`, `cogra-media-root-password` | cogra-media, its init, the backup | The live store's root; the API never holds it |
| `cogra-media-api-key`, `cogra-media-api-secret` | api (`MEDIA_ACCESS_KEY_ID`, `MEDIA_SECRET_ACCESS_KEY`) | Created by the init, scoped to the live and carried buckets |
| `cogra-held-root-user`, `cogra-held-root-password` | cogra-media-held, its init, the backup | The held store's root |
| `cogra-held-api-key`, `cogra-held-api-secret` | api (`MEDIA_HELD_ACCESS_KEY_ID`, `MEDIA_HELD_SECRET_ACCESS_KEY`) | Scoped to the held bucket |
| `cogra-session-signing-seed` | api (`SESSION_SIGNING_SEED`) | 32 bytes of hex (`openssl rand -hex 32`). Rotating it signs every session out ([auth.md](auth.md#tokens)) |
| `cogra-smtp-url` | api (`SMTP_URL`) | The mail provider's credential |
| `cogra-genesis-password` | bootstrap, once | Afterwards an ordinary account password |
| restic password, backend credentials | the backup timer | Files under `/etc/cogra/secrets/`; without the password every backup is unreadable |

A secret is created from standard input so it never lands in shell
history: `podman secret create cogra-session-signing-seed -`.

The production values that differ from development, beside the
origins and endpoints:

- `CLIENT_IP_SOURCE=RightmostXForwardedFor` — sound because the proxy
  is the sole ingress ([auth.md](auth.md#rate-limiting)).
- `L1_EPOCH_CLOSE_INTERVAL_SECS=3` — on the stand-in an unset clock
  closes an epoch only at 10,000 acts, so a small instance's writes
  would never land. Three seconds is the cadence the pending states
  were tested against.
- `MAILER=smtp` with `MAIL_FROM` on the instance's domain; no
  `DEV_MAILER_LOG`, so no token log file exists on the disk.
- `RUST_LOG=info` and `NO_COLOR=1`: plain info-level lines in the
  journal.
- `WEB_ORIGIN` and `MEDIA_BASE_URL` on the instance's one origin;
  `WEB_ORIGIN` defaults to the local dev server, so it is always set.

---

## Routing

[`deploy/proxy/Caddyfile`](../../deploy/proxy/Caddyfile) carries the
table the dev front and `next.config.ts` settled:

| Path | Upstream | Rule |
|---|---|---|
| `/graphql`, `/media/uploads`, `/media/uploads/*` | api:8080 | Matched before `/media/*`: below the narrower rule a part `PUT` reaches the store |
| `/media/<key>` | the live bucket on cogra-media | `GET`/`HEAD` with an object key and no query string; anything else under `/media` answers 404 |
| `/.well-known/assetlinks.json` | a static file | The Android App Links statement; its fingerprints come with the release signing key |
| everything else | web:3000 | `next start` |

**Media reads are the only store traffic from outside.** The store's
write API, bucket listing and sub-resources (`?acl`,
`?response-content-type=`) are not on the public network. Responses
carry `X-Content-Type-Options: nosniff` and a sandboxing
`Content-Security-Policy`, because media shares the app's origin and
an uploaded file must never execute there as a document.
`MEDIA_BASE_URL` is `https://<domain>/media`: one origin, one
certificate, the shape both clients are built on.

**In-cluster GraphQL goes through the proxy.** The API's
`RightmostXForwardedFor` refuses a request that carries no
`X-Forwarded-For` — and the web server's server-side renders and the
ranker's slice reads are such requests when they dial the API
directly. The Caddyfile's second site, plain HTTP on `:8081`,
published by no unit, proxies `/graphql` alone and sets the header
to the caller's own address; `GRAPHQL_URL` (web) and `API_URL`
(ranker) point at it. Caddy ignores `X-Forwarded-*` from clients it
does not trust and sets its own, so the rightmost hop is always the
peer Caddy saw.

**No compression at the proxy.** The API compresses `/graphql` itself
and never a mutation's answer; Next compresses its own responses. A
proxy encoder would compress twice or undo that rule.

**Caching.** Next marks dynamic pages `no-store`; a statically
prerendered page carries an `s-maxage`, which a browser may read as
licence to reuse it. On those HTML responses the proxy sets
`Cache-Control: no-cache`, so a reload after a deploy revalidates the
document. Hashed `/_next/static/*` assets keep their `immutable`.

**Timeouts.** Caddy sets no body or write timeout, so a 100 MiB upload
over a slow link is never cut; the Caddyfile writes the header and
idle timeouts down as configured facts.

---

## Media stores

`cogra-media-init` provisions the live store on every boot
([`deploy/media/provision.sh`](../../deploy/media/provision.sh)): the
live and carried buckets, anonymous `GetObject` on the live bucket's
objects — no listing, unlike the `download` canned policy dev uses —
and no anonymous policy on the carried bucket. It then creates the
API's own key with a policy limited to those buckets' object
operations: the API never holds a store's root credential, and its
key cannot change a bucket policy or reach another bucket. The web
console is off (`MINIO_BROWSER=off`); operators use `podman exec
<store> mc …` over ssh.

### The held store

The held area ([data-model.md](data-model.md#media-areas)) runs as a
store instance of its own: `cogra-media-held`, with its own volume,
its own root credential and its own scoped API key, on the internal
network only, with no published port and no proxy route. A deleted
asset's bytes therefore leave the live store's process, credential
and disk area entirely. The API reaches it through
`MEDIA_HELD_S3_ENDPOINT` and the held keys; unset, those fall back to
the live store's, which is how compose runs it. The operator reaches
it from the host: `podman exec cogra-media-held mc ls
local/cogra-media-held`.

### The media store

Both stores run the MinIO image development pins. Its upstream
repository was archived in April 2026, and the community edition is
now distributed as source only: the pinned image receives no further
fixes. The internal-only placement and the proxy's GET-only route
bound its exposure. Whether production keeps it or moves to another
S3 store (Garage, or provider object storage) is decision D-4 in the
[bring-up checklist](#bring-up); the API's S3 `BlobStore` makes the
move an endpoint change, and the backups copy at the S3 level, so a
backup restores into any S3 store.

---

## Health

| Unit | Probe | On failure |
|---|---|---|
| cogra-postgres | `pg_isready` over TCP | restart by systemd |
| cogra-media, cogra-media-held | `mc ready local` | restart by systemd |
| cogra-api | `GET /health` (process liveness) | killed and restarted |
| cogra-web | `GET /favicon.ico`, served without the API | killed and restarted |
| cogra-ranker | `GET /health` | killed and restarted |

A unit counts as started only once its container is healthy: each
long-running unit's `ExecStartPost` waits for `podman wait
--condition=healthy` (podman 4.9 predates `Notify=healthy`). Ordering
follows from that: the API starts after Postgres answers and both
stores are provisioned; web and ranker after the API; the proxy last.
Every unit restarts always and starts at boot, and a unit that fails
outright triggers `cogra-alert@`, an ntfy alert.

Readiness end to end is the GraphQL query through the proxy:

```graphql
{ health { backendVersion postgresConnected mirrorEpoch } }
```

`postgresConnected: true` is the signal. `mirrorEpoch` advancing is
not a liveness signal: an idle epoch publishes nothing.

---

## Logs

Containers log to the journal: `journalctl -u cogra-api`. The
journal is capped (`SystemMaxUse=2G`,
[`deploy/host/journald-cogra.conf`](../../deploy/host/journald-cogra.conf))
so logs cannot fill the disk.

---

## Monitoring

A box cannot report its own death, so an **off-box probe** polls the
readiness query every one to five minutes and alerts the operator's
ntfy topic (where it runs is decision D-7). On the box, three timers
post to the same topic:

- **the backup pair** — a failed run alerts through `OnFailure=`;
- **the disk watch**, every 15 minutes — the data filesystem below
  15% free, or the live media volume past a set size (media is the
  growth term: uploads are rate-limited, not priced);
- **the log alert**, every 5 minutes — new `ERROR` lines from the API
  and the ranker. A container's stdout reaches the journal at
  priority info whatever the line says, so the match is on the level
  in the text, not on `journalctl -p err`. The alert carries counts,
  never log lines.

An alert repeats at most every few hours per condition.

---

## Backups

**What.** The whole database and all three buckets. On the stand-in
the published sequence and the host seal seed live in Postgres, so
the dump is the substrate's only copy: the rule "no backup of the
mirror is meaningful" holds against a real L1, not here. Every dump
is therefore secret-bearing. Not backed up: images (rebuildable from
git), Caddy's certificates (re-issuable), and `/etc/cogra`, whose
values are in the password manager and whose templates are in git.

**The order is the pairing.** Objects are written before the row that
points at them ([architecture.md](architecture.md#infrastructure)),
so a dump taken first references only objects that already exist
when the media copy after it starts. The nightly pair needs no
downtime. An object deleted between the two steps is either an
orphan the reaper collects again, or erased content that must not
come back anyway. The pre-deploy pair is taken with the API stopped.

**Mechanics** ([`deploy/scripts/backup.sh`](../../deploy/scripts/backup.sh)):

1. `pg_dump -Fc` from `cogra-postgres` — the custom format
   `pg_restore` restores selectively;
2. `mc mirror` of each bucket to a staging directory — an S3-level
   copy, restorable into any S3 store, where a volume tar restores
   only into the same store and version;
3. `restic backup` of the staging directory to the off-box
   repository, which restic encrypts; each snapshot is tagged with
   the deployed commit, the pair's stamp;
4. `restic forget --prune` with seven dailies and four weeklies.

The nightly timer runs it at 03:30, catching up after downtime.
Retention bounds how long an erasure takes to leave every backup,
and the privacy policy states the window (decision D-6).

### Restore drill

`restore.sh drill [snapshot]` restores a snapshot into a scratch
Postgres, a scratch store and a scratch API on a scratch internal
network, checks that the API reads the restored database and that
the media its rows name is in the restored store, and tears it all
down. The production units are never touched. The drill runs at
bring-up before the first invite, and monthly; a backup whose drill
never ran counts as no backup.

---

## Deploy

[`deploy/scripts/deploy.sh <commit>`](../../deploy/scripts/deploy.sh),
after `podman load` of that commit's three images:

1. refuse if the database is ahead of the image's migrations;
2. stop web, ranker and API;
3. take the pre-deploy backup pair, and log its snapshot id against
   the commit in `/var/lib/cogra/deploys.log`;
4. retag the commit's images `:deployed`;
5. start the API, which applies pending migrations before it listens,
   and check `_sqlx_migrations` against the migrations the image
   carries;
6. start ranker and web, then smoke through the proxy: the health
   query, `/playground` answering 404, introspection refused.

Migrations run in the API at start, which is race-free with one
instance. They are forward-only: never edit an applied migration —
the migrator checksums each one and refuses an edited file.

## Rollback

- **No migration in between:** `deploy.sh --rollback-to <previous>`
  retags and restarts.
- **Across a migration:** `deploy.sh --rollback-to <previous> --restore
  <pre-deploy snapshot>` restores the pair taken before the deploy,
  then starts the previous images. Writes made since that pair are
  lost — which is why the pair is taken immediately before the
  switch.

`restore.sh production <snapshot> --overwrite-production` is the same
restore alone, for a disaster: it replaces the database and the
buckets and leaves the API, web and ranker stopped.

## Release publish

The registry row for a web release is written last, once the new
build serves ([development.md](development.md#the-release-cli)):

```bash
podman exec -i cogra-api release publish --component web --version <v> \
  --notes-file /dev/stdin < notes.txt
```

## Postgres upgrades

The pin is `postgres:18-alpine`. A major upgrade is a dump and
restore, never a tag bump in place: the data directory's format
changes between majors.

---

## Bring-up

Decisions the instance waits on, and what each unlocks:

| | Decision | Unlocks |
|---|---|---|
| D-1 | Host and server spec (floor: 8 cores, 32 GB RAM, 1 TB NVMe, mirrored) | B-1 onward |
| D-2 | Domain, registrar, DNS host | B-4: TLS, mail authentication, App Links, the APK's baked origin |
| D-3 | Outbound mail: a transactional provider over SMTP submission, a send-only MTA on the box, or both | B-13, `cogra-smtp-url` |
| D-4 | The media store: keep the pinned MinIO, Garage, or provider object storage | the store units as written, or their replacement |
| D-5 | The off-box backup target, at a different provider or data centre | B-15, `backup.env` |
| D-6 | The backup retention window | `BACKUP_KEEP_*`, the privacy policy's figure |
| D-7 | Where the off-box probe runs | B-17 |
| D-8 | The admission burn for the cohort, and a break-glass top-up | `ADMISSION_BURN_MICRO` |

The checklist. Each step records its wall time at first execution;
that measurement plus a tolerance becomes the step's budget, written
into [Budgets](#budgets).

| # | Step | Done when |
|---|---|---|
| B-1 | Rent the box (D-1); install Ubuntu 24.04 LTS | ssh as root works with a key |
| B-2 | Admin user, ssh key-only, firewall 22/80/443 in, `unattended-upgrades`, time sync | an external scan shows 22 only |
| B-3 | `apt install podman restic`; data filesystem per D-1 | `podman --version` is 4.9.x |
| B-4 | DNS (D-2): `A`/`AAAA` for the domain; mail DNS per D-3 (SPF, DKIM, DMARC) | `dig` resolves from outside |
| B-5 | `deploy/scripts/install.sh` from a checkout; fill `/etc/cogra/*.env`; create every secret; `restic init` | `podman secret ls` lists every secret |
| B-6 | Check the generated units | `podman-system-generator --dryrun` is clean |
| B-7 | `podman pull` the pinned public images; `podman load` the commit's images; tag them `:deployed` | `podman images` shows all six |
| B-8 | Start postgres, both stores and their inits | healthy; the buckets exist |
| B-9 | Start the API | `PostgreSQL connected, migrations applied` in its journal |
| B-10 | Start web, ranker, proxy; ACME issues the certificate | `https://<domain>` serves a valid chain; `http://` redirects |
| B-11 | Smoke: the health query, `/playground` 404, introspection refused, no dev credential answers | all green |
| B-12 | `bootstrap.sh`, once, in a terminal; the recovery code into the password manager | the operator login works |
| B-13 | Mail: a verification mail reaches an external inbox | SPF, DKIM, DMARC pass; the link is on the domain |
| B-14 | Media and feed: a picture post and a video post land and play; a `PUT` to `/media/x` is refused | all green |
| B-15 | `systemctl enable --now cogra-backup.timer cogra-disk-watch.timer cogra-log-alert.timer`; run the first pair by hand | the snapshot exists off-box |
| B-16 | `restore.sh drill` | it passes |
| B-17 | The off-box probe (D-7); stop the proxy and see the alert | alert received, green after restart |
| B-18 | Reboot the host | every unit returns healthy on its own; a signed-in session survives |
| B-19 | `release publish` the first web row | `appVersions` returns it |
| B-20 | The hand test, then the first invite | the operator's call |

---

## Budgets

Measured at the artifacts' first build on the dev toolbox
(claude-podman, podman 4.9.3); the host's figures replace them at
bring-up.

| Action | Measured | Budget |
|---|---|---|
| `cogra-api` image build, cold | *to measure* | *from the first run* |
| `cogra-web` image build, cold | *to measure* | *from the first run* |
| `cogra-ranker` image build, cold | *to measure* | *from the first run* |
| `cogra-api` image size | *to measure* | — |
| `cogra-web` image size | *to measure* | — |
| Backup pair, restore drill, deploy, reboot to healthy | at bring-up (B-15, B-16, B-18) | from the first run |

---

## Operator scripts

Installed to `/usr/local/lib/cogra/`, run as root; every step logs
its wall time, and none prints a secret.

| Script | Does |
|---|---|
| `install.sh` | puts a checkout's `deploy/` tree in place; never overwrites an instance's env file |
| `deploy.sh` | deploy and rollback |
| `backup.sh` | one backup pair; prints the snapshot id |
| `restore.sh` | the restore drill, and the production restore |
| `bootstrap.sh` | the one-time genesis bootstrap |
| `alert.sh`, `disk-watch.sh`, `log-alert.sh` | monitoring |

---

## Scaling

The seams for a second host are cut: media sits behind the S3
`BlobStore`, the ranker is its own container, rate-limit state lives
in Postgres, and Postgres moves by `DATABASE_URL`. The first real
seam is the API's in-process loops — the ingest, the stand-in's epoch
clock and the reapers assume one instance. Scaling out splits a
worker role (the loops, migrations as a one-shot) from stateless
serving instances, and several web servers then share
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and a deployment id.
