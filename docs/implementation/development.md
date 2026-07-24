# Development Guide

## Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| Rust (stable) | Language toolchain | https://rustup.rs |
| Docker + Compose | Local databases | https://docs.docker.com/get-docker |
| sqlx-cli | Running migrations | Auto-installed by `make init`; manual: `cargo install sqlx-cli --no-default-features --features postgres` |

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
| `POSTGRES_USER` | `gnp` | Postgres username (used by Docker and Makefile) |
| `POSTGRES_PASSWORD` | `gnp_secret` | Postgres password |
| `POSTGRES_DB` | `gnp_db` | Postgres database name |
| `POSTGRES_PORT` | `5432` | Exposed host port |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8080` | API bind port |
| `L1_INGEST_INTERVAL_SECS` | `2` | Mirror-ingestion poll interval of the API server |
| `STAGED_WRITE_GC_EPOCHS` | `8` | Epochs before an unlanded staged write is collected ([data-model.md "Staged writes"](data-model.md#staged-writes)) |
| `SESSION_SIGNING_SEED` | *(unset)* | 32-byte hex seed of the Ed25519 session-signing key ([auth.md](auth.md#tokens)); unset in dev, an ephemeral key is generated and sessions die with the process |
| `ADMISSION_BURN_MICRO` | `100000000` | The community-funded admission burn per approved applicant, micro-units — operational until the economics slice wires the subsidy machinery |
| `APPLICANT_REAPER_INTERVAL_SECS` | `600` | Sweep interval for expired, never-approved applications ([auth.md](auth.md#account-lifecycle)) |
| `GENESIS_HANDLE` | `genesis` | The Genesis Moderator's handle (`make bootstrap`) |
| `GENESIS_DISPLAY_NAME` | `Genesis Moderator` | The Genesis Moderator's display name |
| `RUST_LOG` | `debug` | Log level filter (`trace`, `debug`, `info`, `warn`, `error`) |

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
make ci           Full CI pipeline: lint, sqlx-check, test, then docs-link-check
make lint         cargo clippy (offline) + cargo fmt --check (read-only)
make fmt          cargo fmt --all (writes files)
make test         cargo test --all
make schema       Regenerate schema.graphql (the frontend contract)
make vectors      Regenerate client-crypto-vectors.json (the client crypto contract)
make sqlx-prepare Regenerate .sqlx/ offline metadata (needs a live, migrated DB)
make sqlx-check   Verify .sqlx/ matches the queries (needs a live, migrated DB)
make docs-link-check  Check markdown link targets + anchors (needs lychee)
make build        cargo build --all
make logs         Follow docker compose logs (Ctrl+C to stop)
```

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
