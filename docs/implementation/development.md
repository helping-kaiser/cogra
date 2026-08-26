# Development Guide

## Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| Rust (stable) | Language toolchain | https://rustup.rs |
| Docker + Compose | Local databases (any compose-compatible runtime works — see `DOCKER_COMPOSE` below) | https://docs.docker.com/get-docker |
| sqlx-cli | Running migrations | Auto-installed by `make init`; manual: `cargo install sqlx-cli --no-default-features --features postgres` |
| mkcert | The dev server's certificate, for phones that reach it by address ([below](#reaching-the-web-dev-server-from-the-phone)) | https://github.com/FiloSottile/mkcert |

Verify everything is in place:
```bash
rustc --version        # >= 1.75
cargo --version
docker --version
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
| `DOCKER_COMPOSE` | `docker compose -f docker/docker-compose.yml` | Compose command the make targets drive (make-only; the binaries never read it) — override to use another compose-compatible runtime, e.g. `wsl.exe -d claude-podman --cd /mnt/c/Users/<name>/dev/cogra -- podman compose -f docker/docker-compose.yml` |
| `POSTGRES_USER` | `gnp` | Postgres username (used by Docker and Makefile) |
| `POSTGRES_PASSWORD` | `gnp_secret` | Postgres password |
| `POSTGRES_DB` | `gnp_db` | Postgres database name |
| `POSTGRES_PORT` | `5432` | Exposed host port |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8080` | API bind port |
| `L1_INGEST_INTERVAL_SECS` | `2` | Mirror-ingestion poll interval of the API server |
| `L1_EPOCH_CLOSE_INTERVAL_SECS` | *(unset)* | Dev epoch clock: the API host closes a stand-in epoch on this interval, so writes land without a manual `l1-dev close`; unset, epochs close only on the act budget or the CLI |
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
| `BREACH_CHECK` | `hibp` | The password breach corpus ([auth.md "Password requirements"](auth.md#password-requirements)): `hibp` (live range API) or `off` (offline dev — no lookup) |
| `CLIENT_IP_SOURCE` | `ConnectInfo` | Client-IP derivation ([auth.md "Rate limiting"](auth.md#rate-limiting)): `ConnectInfo` (socket peer) by default; `RightmostXForwardedFor` only behind a reverse proxy that is the sole ingress |
| `GENESIS_HANDLE` | `genesis` | The Genesis Moderator's handle (`make bootstrap`) |
| `GENESIS_DISPLAY_NAME` | `Genesis Moderator` | The Genesis Moderator's display name |
| `RUST_LOG` | `debug` | Log level filter (`trace`, `debug`, `info`, `warn`, `error`) |

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
  and rendezvous on the host's LAN address. Without mkcert on `PATH` it
  stamps `.env` and says what it skipped.

---

## Make Commands

```
make init         First-time setup: copy .env, check/install dependencies
make run          Full start: init + dev (first-time friendly)
make dev          Start DBs + migrate + start API
make api          Start the API server only
make api-release   Start the API server in release mode (realistic auth/crypto latency)
make up           Start Postgres in background
make down         Stop all services (data persists in volumes)
make reset-db     Wipe all volumes, restart services, re-run migrations
make migrate      Run pending Postgres migrations only
make bootstrap    One-time instance setup: seed genesis, land the L1 genesis records
make ci           Full CI pipeline: lint, lint-corpus, sqlx-check, test, then docs-link-check
make lint         cargo clippy (offline) + cargo fmt --check (read-only)
make lint-corpus  Run the corpus linter over the repository (mirrors the corpus-lint job in ci.yml)
make regenerate   Regenerate every generated register the linter maintains; run before pushing after adding or renaming a test function
make fmt          cargo fmt --all (writes files)
make test         cargo test --all
make schema       Regenerate schema.graphql (the frontend contract)
make vectors      Regenerate client-crypto-vectors.json (the client crypto contract)
make sqlx-prepare Regenerate .sqlx/ offline metadata (needs a live, migrated DB)
make sqlx-check   Verify .sqlx/ matches the queries (needs a live, migrated DB)
make docs-link-check  Check markdown link targets + anchors (needs lychee)
make build        cargo build --all
make logs         Follow docker compose logs (Ctrl+C to stop)
make android-ci   Run the Android CI checks (mirrors the android job in ci.yml; needs JDK 17 + JDK 21 + Android SDK)
make android-test Run Android unit tests; scope to one module with m=feature:home
make android-build  Assemble the debug APK
make android-lint Run Android lint (not a CI gate, convenience only)
make web-dev      Start the web app dev server over https (needs Node from web/.nvmrc)
make web-prod     Build the web app and serve it over https — the hand-test path
make web-apk      Stage the Android debug APK where the web app serves it
make guest-apk    Build that APK against this machine's dev server, and stage it
make web-ci       Run the web CI checks (mirrors the web job in ci.yml)
```

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

Or via Docker:
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
