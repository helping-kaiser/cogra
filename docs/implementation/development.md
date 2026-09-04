# Development Guide · `guide:implementation:development`

## Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| rustup | Language toolchain. The version is pinned in `rust-toolchain.toml`, and rustup installs it on first use — nothing here selects a channel by hand | https://rustup.rs |
| Docker + Compose | Local databases (any compose-compatible runtime works — see `DOCKER_COMPOSE` below) | https://docs.docker.com/get-docker |
| sqlx-cli | Running migrations | Auto-installed by `make init`; manual: `cargo install sqlx-cli --no-default-features --features postgres` |
| mkcert | The dev server's certificate, for phones that reach it by address ([below](#reaching-the-web-dev-server-from-the-phone)) | https://github.com/FiloSottile/mkcert |
| lychee | The markdown link check in `make ci` | `cargo install lychee` |
| Node | The web app and the design tree (`make web-ci`, `make design-ci`) | The version in `web/.nvmrc` |
| python3 | Only for `make fuzz-interchange`, whose seed script expands the RFC 8949 vectors with it | Any 3.x |

Verify everything is in place:
```bash
cargo --version        # the version rust-toolchain.toml pins
docker compose version
sqlx --version
```

---

## First-Time Setup

```bash
# Everything in one command: copies .env, installs sqlx-cli, starts DBs,
# runs migrations, starts the API
make run
```

Or step by step:
```bash
make init         # copy .env, check/install dependencies
make dev          # start DBs + migrate + start API
```

The API will be available at `http://localhost:8080`.
GraphQL playground: `http://localhost:8080/playground`.

---

## Environment Variables

All variables are in `.env` (gitignored, copied from `.env.example`).
Every binary loads `.env` at startup (dotenvy), so plain `cargo run`
behaves like the make targets; variables already set in the shell win
over file values.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://gnp:gnp_secret@localhost:5432/gnp_db` | Full Postgres connection URL (used by sqlx-cli and the app) |
| `DOCKER_COMPOSE` | `docker compose -f docker/docker-compose.yml` | Compose command the make targets drive (make-only; the binaries never read it) — override to use another compose-compatible runtime, e.g. `wsl.exe -d claude-podman --cd /mnt/c/Users/<name>/dev/cogra -- podman compose -f docker/docker-compose.yml`. `make init` probes this command rather than a binary name, so the check is right on every runtime |
| `COMPOSE_PROJECT` | `gnp` | Container-name prefix (compose-only). The default is what the `docker exec` recipes below name; set it, and move the ports, to run a second checkout's stack beside the first |
| `WAIT_TIMEOUT` | `300` | Seconds `make wait-db` and `make wait-media` allow before failing with a message (make-only) |
| `POSTGRES_USER` | `gnp` | Postgres username (used by Docker and Makefile) |
| `POSTGRES_PASSWORD` | `gnp_secret` | Postgres password |
| `POSTGRES_DB` | `gnp_db` | Postgres database name |
| `POSTGRES_PORT` | `5432` | Exposed host port |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8080` | API bind port |
| `L1_INGEST_INTERVAL_SECS` | `2` | Mirror-ingestion poll interval of the API server |
| `L1_EPOCH_CLOSE_INTERVAL_SECS` | *(unset)* | Dev epoch clock: the API host closes a stand-in epoch on this interval, so writes land without a manual `l1-dev close`; unset, epochs close only on `l1-dev close` and nothing a client writes lands |
| `STAGED_WRITE_GC_EPOCHS` | `8` | Epochs before an unlanded staged write is collected ([data-model.md "Staged writes"](data-model.md#staged-writes)) |
| `SESSION_SIGNING_SEED` | *(unset)* | 32-byte hex seed of the Ed25519 session-signing key ([auth.md](auth.md#tokens)); unset in dev, an ephemeral key is generated and sessions die with the process |
| `DEV_MAILER_LOG` | *(unset)* | Dev mailer log file (`tmp_dev/mailer.log` in `.env.example`, gitignored): every outbound message is also appended there, so hand tests read out-of-band secrets from one file; unset, no file logging |
| `WEB_ORIGIN` | `http://localhost:3000` | The per-environment web origin emailed links ride on ([auth.md "Link URLs"](auth.md#link-urls)) |
| `ADMISSION_BURN_MICRO` | `100000000` | The community-funded admission burn per approved applicant, micro-units — operational until the economics slice wires the subsidy machinery |
| `ACCOUNT_REAPER_INTERVAL_SECS` | `600` | Sweep interval of the account reaper — never-verified accounts past their 24-hour bound are deleted whole ([auth.md](auth.md#account-lifecycle)) |
| `RATE_LIMIT_LOGIN_PER_IP` | `30` | Login attempts per IP per 15 min ([auth.md "Rate limiting"](auth.md#rate-limiting)) |
| `RATE_LIMIT_REGISTER_PER_IP` | `5` | Application submits per IP per hour |
| `RATE_LIMIT_REGISTER_PER_LINK` | `20` | Application submits per invite link per day |
| `RATE_LIMIT_RESET_PER_IP` | `10` | Password-reset requests per IP per hour |
| `RATE_LIMIT_RESET_PER_EMAIL` | `3` | Password-reset requests per submitted email per hour (trips silently) |
| `RATE_LIMIT_RESEND_PER_EMAIL` | `5` | Verification resends per submitted email per hour (trips silently) |
| `RATE_LIMIT_CONFIRM_PER_IP` | `30` | Token confirmations per IP per 15 min |
| `RATE_LIMIT_GC_INTERVAL_SECS` | `3600` | Sweep interval of the idle throttle-row GC; the login backoff's shape (threshold 5, 1 s doubling, 15 min cap) changes in code, not env |
| `RATE_LIMIT_UPLOAD_PER_ACCOUNT` | `60` | Media uploads per account per hour — uploading is not an act, so this is the only cost control media has |
| `MEDIA_S3_ENDPOINT` | `http://localhost:9000` | The media service's S3 API endpoint. `stamp-net.sh` stamps it to the machine's LAN address like `DATABASE_URL` — the API and the store can live in separate WSL distros, where cross-distro localhost is dead — while the host firewall keeps the port closed to other devices; a phone reaches media through the web origin's `/media` proxy, never the store itself |
| `MEDIA_BUCKET` | `cogra-media` | Bucket the media objects live in; created by the `media-init` one-shot |
| `MEDIA_ACCESS_KEY_ID` | `cogra_media` | Media store access key (also the store's root user in compose) |
| `MEDIA_SECRET_ACCESS_KEY` | `cogra_media_secret` | Media store secret key |
| `MEDIA_REGION` | `us-east-1` | S3 region the requests are signed for; any value the store accepts |
| `MEDIA_PORT` | `9000` | Exposed host port of the media S3 API |
| `MEDIA_CONSOLE_PORT` | `9001` | Exposed host port of the media store's web console |
| `MEDIA_BASE_URL` | `http://localhost:3000/media` | The public origin every `MediaAttachment.url` is minted against. In development the web dev server's `/media` proxy, so a phone loads bytes from the https origin it already trusts; in production the media origin or the CDN in front of it |
| `MEDIA_ORIGIN` | `http://localhost:9000/cogra-media` | The web front's `/media` proxy target — the store's bucket URL (web-only; the binaries never read it). `stamp-net.sh` stamps it to the LAN address like `MEDIA_S3_ENDPOINT`, because the web server and the store can live in separate WSL distros where cross-distro localhost is dead |
| `MEDIA_MAX_UPLOAD_BYTES` | `10485760` | Per-picture upload cap. An ordinary over-cap upload gets a field-level `userError` naming `file` |
| `MEDIA_MAX_VIDEO_UPLOAD_BYTES` | `104857600` | Per-video upload cap — parity with the picture body, a post being ten pictures or one video. The multipart transport refuses at twice the larger of the two caps, which cap applies being a fact about bytes it has not sniffed yet |
| `MEDIA_ORPHAN_REAPER_INTERVAL_SECS` | `600` | Sweep interval of the media orphan reaper |
| `MEDIA_ORPHAN_MAX_AGE_SECS` | `86400` | How long an asset no parent references survives before the reaper collects it and its object |
| `MEDIA_UPLOAD_PART_SIZE_BYTES` | `8388608` | How large a piece a resumable upload is cut into ([api-spec.md "Resuming a large upload"](api-spec.md#content-authoring)). Refused below 5 MiB, the floor S3 puts under every part but the last — a smaller cut would accept every part and then fail to assemble. It also decides what a blip costs: a dropped connection loses at most the part in flight |
| `MEDIA_UPLOAD_SESSION_TTL_SECS` | `86400` | How long an unfinished upload survives before the media reaper aborts it and releases its parts. A day, matching `MEDIA_ORPHAN_MAX_AGE_SECS` — an upload nobody finished and an asset nobody attached are the same abandoned compose |
| `MEDIA_STALE_UPLOADS_EXPIRY` | `24h` | The store-side backstop, for the uploads a crash orphans before their session row exists (compose-only). MinIO implements it as a server setting, not as an S3 `AbortIncompleteMultipartUpload` lifecycle rule — it rejects such a rule — and the expiry matches the TTL above: the same abandoned upload, seen from both sides. Another store needs the lifecycle rule instead |
| `MEDIA_STALE_UPLOADS_CLEANUP_INTERVAL` | `6h` | How often the store looks for them (compose-only) |
| `BREACH_CHECK` | `hibp` | The password breach corpus ([auth.md "Password requirements"](auth.md#password-requirements)): `hibp` (live range API) or `off` (offline dev — no lookup) |
| `CLIENT_IP_SOURCE` | `ConnectInfo` | Client-IP derivation ([auth.md "Rate limiting"](auth.md#rate-limiting)): `ConnectInfo` (socket peer) by default; `RightmostXForwardedFor` only behind a reverse proxy that is the sole ingress |
| `GENESIS_HANDLE` | `genesis` | The Genesis Moderator's handle (`make bootstrap`) |
| `GENESIS_DISPLAY_NAME` | `Genesis Moderator` | The Genesis Moderator's display name |
| `GENESIS_EMAIL` | `genesis@cogra.local` | The operator login that reaches the genesis account |
| `GENESIS_PASSWORD` | *(none)* | Its password. No default: `make bootstrap` refuses without one, the posture `DATABASE_URL` takes, so a deployment that forgets it gets an error instead of an instance on a publicly-known password |
| `RUST_LOG` | `debug` | Log level filter (`trace`, `debug`, `info`, `warn`, `error`) |

The web front reads three variables of its own. They are listed here and
in `.env.example` because a developer copying that file cannot otherwise
learn they exist; no Rust binary reads any of them.

| Variable | Default | Description |
|---|---|---|
| `GRAPHQL_URL` | `http://localhost:8080/graphql` | Where the web server's `/graphql` rewrite sends requests (`web/next.config.ts`) |
| `PORT` | `3000` | The port the web server listens on (`web/scripts/prod.mjs`) |
| `WEB_UPSTREAM_PORT` | `3001` | The port the https front proxies to |

---

## Helper scripts

`scripts/` holds standalone dev helper scripts. Current inventory:

- `scripts/stamp-net.sh` — rewrites the `DATABASE_URL` host and
  `WEB_ORIGIN` in `.env` to the machine's current LAN IPv4, re-issues
  the dev server's certificate for that address, and stages the mkcert
  root CA behind it at
  `android/app/src/devCa/res/raw/cogra_dev_ca.pem` (gitignored — the CA
  is per-machine). Run it after every network change on setups where
  the DB, the API, or the phones sit on different network namespaces
  and rendezvous on the host's LAN address. It needs iproute2 for the
  address, so it runs on Linux — inside the dev shell, not on a Windows
  host.

  Its exit codes say how far it got: **0** stamped and certified, **1**
  nothing was done (a variable it stamps is missing from `.env`, or one
  did not take the stamp — either way `.env` is left as it was), **3**
  stamped but not certified, because mkcert is not on `PATH`. After a 3
  the web servers still start, on a certificate Next issues for
  `localhost` alone, and only the tunnel route works; `make web-dev` and
  `make web-prod` say so.

---

## Make Commands

`make help` prints every target with its description, generated from the
Makefile itself. It is the list — a second copy here would only drift
away from it, and did.

The three that decide the shape of a session:

- `make run` — first time: `init`, then `dev`.
- `make dev` — start the databases, migrate, start the API.
- `make ci` — the Rust gates, before pushing. `make ci-all` adds the
  client and design jobs, which need a JDK pair, the Android SDK, and
  Node.

### What the gates cost

Every recurring action gets an expected duration and a tolerance
([engineering-process.md](engineering-process.md) — a commissioned
surface has a measured, recorded budget). Exceeding one is a finding,
not a cost to absorb. Measured on the Home PC's WSL toolboxes
(`claude-cogra`, `claude-android`) with warm dependency builds unless
noted; a cold build pays its dependency graph on top.

| Action | Budget | Measured |
|---|---|---|
| `make lint-corpus` | 30 s | 12–17 s (2026-09-04, 1858 sources) |
| `cargo test -p cogra-linter` | 3 min | 90 s (2026-09-04) |
| `cargo fmt --all -- --check` | 30 s | 11 s (2026-09-04) |
| `cargo clippy -p cogra-linter --all-targets` | 2 min | 36 s (2026-09-04) |
| `make docs-link-check` | 60 s | 8.5 s (2026-09-04, 150 files / 1520 links) |
| `make android-build` | 20 min | 13 min 2 s cold (2026-08-20) |
| `make wait-db` / `make wait-media` | `WAIT_TIMEOUT`, 300 s | seconds on a warm stack; the timeout is the bound, not the expectation |

CI jobs carry the same discipline as `timeout-minutes`, which is the
budget the runner enforces: a job with none runs to GitHub's six-hour
default. The measurements are one run of every job on 2026-09-04, with
the action caches warm; a run that invalidates them — a `Cargo.lock`
bump, a new Gradle or npm dependency — pays its whole graph on top,
which is the case the headroom is for.

| Job | timeout-minutes | Measured |
|---|---|---|
| Detect code changes | 5 | 9 s |
| Corpus lint | 20 | 2 m 37 s |
| Lint | 30 | 2 m 19 s |
| Test | 45 | 12 m 34 s |
| Query budgets | 30 | 2 m 40 s |
| Android | 45 | 1 m 31 s |
| Web | 30 | 7 m 1 s |
| Design | 20 | 1 m 54 s |
| Markdown link check | 15 | 6 s |

`Test` dominates because it builds sqlx-cli from source; `Query budgets`
reaches the same database in a fifth of the time by letting
`#[sqlx::test]` apply the migrations instead.

### Reaching the web dev server from the phone

The page must arrive in a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts):
without one `crypto.subtle` is undefined, the key-custody code throws on
first paint, and nothing hydrates. Two origins qualify — `localhost`,
trusted as secure whatever the scheme, and any `https` origin, trusted by
scheme regardless of who signed the certificate. That gives two routes.

**A cabled phone: the tunnel.** Nothing to configure, and the origin is
the one the server started on:

```bash
adb reverse tcp:3000 tcp:3000    # then browse https://localhost:3000
```

**A phone on the LAN or the hotspot, and any guest's phone: https.**
`make web-dev` runs `next dev --experimental-https` and Next's dev server
listens on every interface by default. The certificate it serves is the
one `scripts/stamp-net.sh` issued through
[mkcert](https://github.com/FiloSottile/mkcert), naming `localhost` and
the machine's current address; where no stamped pair exists Next
generates its own, which names only `localhost` and so serves the tunnel
route alone. `WEB_ORIGIN` follows the same address, so emailed links
resolve for guests too: `https://<address>:3000`.

Guests browse `https://<the dev machine's LAN or hotspot address>:3000`
and step past the certificate warning — their browser does not trust
that CA, and a bypassed warning still leaves an https origin, which is
what the secure context depends on. They land on the login page, which
offers the Android app as a download from `web/public/downloads/`
(gitignored): `make web-apk` stages whatever `make android-build`
produced, and `make guest-apk` builds and stages the one a guest can
actually sign in with.

Requests for dev-only assets then come from a private-range origin rather
than the address the server started on, so `next.config.ts` allowlists the
RFC 1918 ranges under `allowedDevOrigins`; without it Next blocks `/_next/*`
and the HMR socket. If the dev server runs inside a WSL distro, the LAN
route additionally needs that distro's ports exposed on the host's
interfaces — WSL's NAT keeps them private otherwise.

The phone never talks to the API directly: the dev server proxies
`/graphql` to `GRAPHQL_URL`, default `http://localhost:8080/graphql`,
which is right whenever the API runs beside it. That hop is server-side,
so it stays plain http without mixing content into the https page — the
phone only ever talks to the web origin.

**The guest APK.** A browser can be told to proceed past an untrusted
certificate; an installed app cannot. `make guest-apk` therefore builds
the debug APK against `WEB_ORIGIN` — `cogra.graphqlUrl` becomes
`https://<address>:3000/graphql`, so the app rides the same `/graphql`
proxy the browser does, over the same https origin — and the debug
variant trusts the mkcert root CA that stamp-net.sh staged, as a
[debug-only trust anchor](https://developer.android.com/privacy-and-security/security-config#TrustingDebugCa)
Android ignores unless the build is debuggable. Nothing the phone sends
leaves TLS, and a release build cannot inherit that trust: the CA rides
a source set the debug variant alone compiles, and the anchor sits in a
`debug-overrides` block that a non-debuggable build discards.

Both the address and the CA are compiled in, so a guest phone that
followed the dev machine onto a different network needs a new APK:
re-run `scripts/stamp-net.sh`, restart the dev server, `make guest-apk`,
and have the guest download and install it again.

### Hand-testing against a production build

Hand tests run against the production build, not the dev server. The dev
server compiles each route the first time it is asked for, so on a phone
over the LAN the first visit to every screen is a wait rather than a
test; `next build` output answers at once and is what the app ships as.

```bash
make web-prod    # codegen, next build, then serve https on :3000
```

One command, and it stays in the foreground serving until interrupted.
The origin is the same one the dev server uses —
`https://<the machine's LAN address>:3000` — so a phone that already
stepped past the certificate warning, and a guest APK built against that
address, both keep working.

`next start` serves plain http only, and
[Next's self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)
puts a reverse proxy in front of it rather than teaching the server TLS.
`web/scripts/prod.mjs` is that proxy, built from `node:https` and
`node:http` alone: it terminates TLS with the mkcert pair
`scripts/stamp-net.sh` stamped into `web/certificates/` — the same pair
`next dev` is handed — and forwards to `next start` bound to the
loopback, so only the TLS front is ever on the LAN. Responses are piped
rather than collected, because the App Router streams them.

There is no stamped pair on a fresh clone, and the script says so and
stops rather than generating one: a self-signed stand-in would name
neither this machine's address nor the CA the guest APK pins. Run
`scripts/stamp-net.sh` first.

Ports come from the environment where the defaults collide: `PORT` is
the https port (3000), `WEB_UPSTREAM_PORT` the loopback port `next start`
takes (3001). The dev path is untouched — `make web-dev` still runs
`next dev --experimental-https` against the same certificates.

---

## Database Tools

### The l1-dev CLI

The slice-0 hand-test driver: it plays the device (key generation, both
signing steps of the admission handshake) and drives the stand-in's
dev-only surfaces (burn credit, epoch close) plus mirror ingestion.

```bash
cargo run -p api --bin l1-dev keygen
cargo run -p api --bin l1-dev burn <address> <micro>
cargo run -p api --bin l1-dev submit <seed-hex> <family> <target> [middle] [p_d] [p_i] [payload]
cargo run -p api --bin l1-dev close     # close the current epoch
cargo run -p api --bin l1-dev ingest    # pull published epochs into the mirror
cargo run -p api --bin l1-dev rebuild   # wipe the mirror and re-ingest everything
cargo run -p api --bin l1-dev balance <address>
cargo run -p api --bin l1-dev status    # mirror cursor + records per epoch
```

### Postgres

Connect with any Postgres client using credentials from `.env`:
```
host:     localhost
port:     5432
user:     gnp
password: gnp_secret
database: gnp_db
```

Or through the container (`gnp` is `COMPOSE_PROJECT`'s default):
```bash
docker exec -it gnp_postgres psql -U gnp -d gnp_db
```

---

## Migrations

Migrations live in `migrations/` and are managed by sqlx-cli.

```bash
# Create a new migration
sqlx migrate add <name>

# Run pending migrations
make migrate

# Revert is not supported by SQLx by default — write down migrations manually
```

Migration files are numbered and named, e.g. `20240101000000_create_users.sql`.

## Compile-time-checked queries

`postgres-store` uses the `sqlx::query!` / `query_as!` / `query_scalar!`
macros: SQL is parsed, columns and types are matched against the Rust side,
and bind counts are verified **at compile time**. A column rename or a
struct/schema mismatch is a build error, not a runtime surprise.

The macros need the schema at compile time, from one of two sources:

- a **live database** (`DATABASE_URL` set, migrations applied), or
- the committed **`.sqlx/` offline cache** at the repo root.

So the build works without a database — CI's lint job and any DB-less
`cargo build` read from `.sqlx/`. The cost is that `.sqlx/` must be kept in
sync with the queries:

```bash
make sqlx-prepare   # after changing any query or migration; commit the result
make sqlx-check     # verify .sqlx/ is current (what CI's test job runs)
```

Two CI jobs enforce this from both directions: the **lint** job builds with
`SQLX_OFFLINE=true` (no database), so a query changed without re-running
`sqlx-prepare` fails with "no cached data for this query"; the **test** job
runs `cargo sqlx prepare --check` against the freshly-migrated live schema,
catching a migration that shifted a column under an unchanged query string.

When iterating with a live DB up (`make up`), the macros check against it
directly, so transient mismatches surface immediately — regenerate `.sqlx/`
before committing.

---

## Running Tests

```bash
# All tests
make test

# Single crate
cargo test -p l1-standin

# Single test
cargo test -p postgres-store test_name

# With output
cargo test -- --nocapture
```

Integration tests that hit the database require Postgres to be running (`make up`).

---

## Code Style

- `cargo fmt` enforced in CI — run `make fmt` before committing
- `clippy -D warnings` enforced in CI — run `make lint` to check
- No `unwrap()` in library code — use `thiserror` / `anyhow` appropriately
- SQL in `postgres-store` only — except the `l1-standin` crate, which
  owns its own `l1_*` tables (it plays the substrate, not CoGra's store;
  the whole set is dropped at the swap)
