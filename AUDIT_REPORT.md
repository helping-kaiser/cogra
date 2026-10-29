# CoGra code audit — 2026-10-29 · `rep:repo:code-audit`

Read-only audit of the whole repository at `e00c120` (main after
PR #355): the Rust backend (`crates/`), the web app (`web/`), the
Android app (`android/`), migrations, deployment and CI. No
production code was changed; this file is the only artifact.

Priorities, as commissioned: security, then correctness, then
robustness, then (briefly) maintainability. Every finding carries a
file and line reference, a severity, the impact, and a concrete fix.
Line numbers are against the audited commit.

---

## Executive summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 5 |
| Medium | 27 |
| Low | 47 |

No committed secrets, no SQL injection, no command injection, no
missing-authorization resolver, and no broken cryptography were found.
The store layer has no dynamic SQL at all, every per-user query binds
the viewer, every single-use token is consumed by one conditional
statement, GraphQL depth/complexity budgets and batching refusal are
in place, and the Android and web custody code matches the Rust
reference vectors. The findings below are therefore mostly
availability (process-aborting inputs, unbounded memory), a stale
dependency set with real TLS advisories, missing browser hardening,
and a handful of crash-recovery races in the staged-write pipeline.

**The five most important items:**

1. **H1 — Any member can abort the API process with a ~160 KB MP4.**
   `crates/api/src/media/video.rs:246` and `:334` recurse into nested
   container boxes with no depth bound; a file of `moov` nested
   ~20 000 deep overflows the 2 MiB blocking-thread stack, and a stack
   overflow aborts the whole process (not just the task), dropping
   every in-flight request. Reachable through `uploadMedia` and
   `completeMediaUpload`.
2. **H2 — Unauthenticated memory exhaustion on `/graphql`.**
   `crates/api/src/lib.rs:469-477` sets the body ceiling to ~208 MiB
   for every content type, and a JSON body is read whole into memory
   before parsing. A few dozen concurrent anonymous POSTs exhaust the
   API container's memory limit.
3. **H3 — Transcoded renditions are unbounded and read whole into
   memory.** `crates/api/src/media/ingest_queue.rs:341` reads the
   ffmpeg output into a `Vec` before any size check; ffmpeg gets no
   output cap, so a long low-bitrate clip within the 100 MiB upload cap
   yields a multi-GB rendition on disk and then an OOM-killed API,
   three attempts in a row.
4. **H4 — 17 RUSTSEC advisories in `Cargo.lock`, none gated.** rustls
   0.23.37, rustls-webpki 0.103.10 and webpki-roots 1.0.6 carry
   certificate-validation, downgrade and pre-authentication-allocation
   advisories and sit under every outbound TLS client (HIBP, SMTP, S3,
   Postgres TLS). All are patch-level updates; CI runs no `cargo audit`
   or `npm audit`.
5. **H5 — The web app ships with no browser security headers.** Neither
   `web/next.config.ts` nor the production Caddyfile sets CSP,
   `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, HSTS or
   `nosniff` on app pages (only the `/media` route has a CSP). Every
   page, including the ones that reveal the recovery code and the
   exported private key, is frameable and an XSS would have an
   unconstrained blast radius.

---

## Checks run

All checks were run on this commit in a clean container (Rust 1.98.0
pinned by `rust-toolchain.toml`, Node 22.22.0 — the repo pins 24.18.0,
see note).

| Check | Result |
|---|---|
| `cargo fmt --all -- --check` | pass |
| `cargo clippy --workspace --all-targets -- -D warnings` | pass, 0 warnings |
| `cargo test --workspace` (local Postgres 16, `SQLX_OFFLINE=true` for the macros; `CARGO_PROFILE_DEV_DEBUG=0` to fit the disk) | **3264 passed, 0 failed, 0 ignored** across 146 test binaries. The first run had one failure, `cogra-linter corpus_acceptance::the_advisory_remainder_is_empty`, caused by this report itself (an unminted title); the title now carries a mint and the linter suite passes (968 tests). |
| `cargo run -p cogra-linter -- check` (corpus lint, with this file in the tree) | pass: 4327 sources, 0 failing, 0 advisory |
| `cargo audit` (advisory DB 2026-10-28) | **17 vulnerabilities in 7 crates, 3 unsound warnings, 2 yanked** — see H4 and Appendix A |
| `npm run codegen` / `npm run lint` / `tsc --noEmit` (web) | pass / pass (0 warnings) / pass |
| `npx vitest run` (web) | **5053 passed, 2 failed** of 5055 (314 files, 462 s). `profile-comments.test.tsx > a_tab_switch_lets_the_held_view_go` passes when rerun in isolation (load-sensitive `findByTestId`). `profile-posts.test.tsx:401 > the_way_back_returns_to_the_posts_view_in_the_state_it_was_left` fails deterministically here (`reads` has length 2, expected 1: the remounted profile issues a second profile read). CI run 40846949748 on this same commit is green, so this is most likely a Node 22 vs pinned Node 24 environment difference — but it is reproducible and worth a look (see L-WEB-12). |
| `npm audit` (web) | **1 critical, 5 high**, all in transitive devDependencies, none shipped — see L-DEP-2 and Appendix B |
| `npm ci` (web) | fails under npm 10.9.4 (Node 22) with "Missing: typescript@5.9.3 from lock file"; **passes under npm 11 and npm 12.2.1** (verified in an isolated copy). The lockfile is consistent with the pinned Node 24 toolchain; the failure is an older-npm peer-resolution difference, not a repo defect (L-CI-5). |
| Android (`gradle`) | not run — no Android SDK in this container; the Kotlin audit is by reading |

---

## Architecture map (for context)

**Entry points.** One Axum process (`crates/api/src/main.rs`) serves
`POST /graphql`, `PUT /media/uploads/{session}/parts/{n}`,
`GET /health`, and `GET /playground` in debug builds only
(`crates/api/src/lib.rs:464-497`). The GraphQL schema
(`crates/api/src/schema/`) is built with `limit_depth(15)`,
`limit_complexity(70 000)` and introspection off in release
(`schema/mod.rs:175-178`). Request bodies are parsed by hand in
`graphql_handler` so multipart file size and count can be capped
(`lib.rs:126-160`).

**Auth.** `Authorization: Bearer <JWT>` is verified with
`Validation::new(Algorithm::EdDSA)` against the Ed25519 session key
(`crates/api/src/auth.rs:118-130`); a `Viewer { user_id, session_id }`
rides the GraphQL context and resolvers gate through `viewer()`,
`member_viewer()` (live account-state read) or `acting_viewer()`
(`schema/mutation.rs:76, 341, 369`). Refresh tokens are opaque 256-bit
values stored as SHA-256, rotated in one transaction with reuse
detection. Passwords are Argon2id with a timing-equalised dummy hash on
unknown emails. Rate limits are Postgres-backed windows keyed by client
IP (`axum-client-ip`, `CLIENT_IP_SOURCE`) or account
(`crates/api/src/ratelimit.rs`).

**Data.** Postgres only, through `crates/postgres-store` (`sqlx::query!`
macros exclusively, offline metadata in `.sqlx/`). The L1 stand-in
(`crates/l1-standin`) owns its own `l1_*` tables and plays the Layer-1
substrate: seal, approve, epoch close under an exclusive table lock,
θ-ledger in integer micro-units. Staged writes
(`postgres-store/src/staged.rs`) move prepare → pre-signed → sealing →
awaiting_approval → relaying → landed, promoted by the mirror ingest
loop (`crates/api/src/ingest.rs`).

**Media.** Uploads go to S3-compatible stores through `object_store`
(live bucket anonymous-read, carried and held buckets private). The
pipeline is sniff → cap → strip metadata → probe → digest
(`crates/api/src/media/mod.rs:501`), WebP via `image` with 4096 px and
96 MiB decode limits, MP4 via the `mp4` and `h264-reader` crates. Videos
outside the served target are re-encoded by an ffmpeg child from a
`FOR UPDATE SKIP LOCKED` lease queue (`media/ingest_queue.rs`).

**Outbound.** HIBP range API (2 s timeout, fail-open), SMTP via lettre
(30 s timeout) or a dev mailer that logs bodies, the ranker pod via
reqwest (semaphore + 10 s timeout), S3.

**Clients.** `web/` is a Next.js 16 App Router app: access token in
memory, refresh token in `localStorage`, Ed25519 key non-extractable in
IndexedDB, same-origin `/graphql` and `/media` rewrites, no cookies (so
no CSRF surface). `android/` is Hilt + Compose + Apollo Kotlin: all
secrets in one DataStore sealed by a Keystore-wrapped Tink keyset, only
`MainActivity` exported, no WebView.

**Deploy.** One host, rootful podman Quadlet units on an internal
(no-egress) network plus an edge network; Caddy is the only published
port; secrets are podman secrets; nightly restic backups. CI pins every
action to a SHA with least-privilege permissions.

---

## Findings

### Critical

None.

### High

#### H1 — Unbounded recursion in the MP4 metadata strip aborts the API process
**Where:** `crates/api/src/media/video.rs:246-258` (`metadata_ranges`),
`:334-370` (`rewrite`), container list at `:171`.
**Impact:** Both walks recurse into every box whose fourcc is in
`CONTAINERS` with no depth bound and no parent/child grammar check. A
file of `ftyp` followed by `moov` nested inside `moov` inside `moov`
costs 8 bytes per level; roughly 20 000 levels (about 160 KB) exceed
the 2 MiB stack of a `spawn_blocking` thread. A stack overflow is not a
catchable panic in Rust: the process aborts, taking every in-flight
request with it. `process()` runs the strip before the probe, so any
member reaches it through `uploadMedia` or `completeMediaUpload`
(bounded only by the 60-per-hour upload window per account).
**Fix:** Thread a `depth` parameter through both functions and refuse
past a small bound (ISO BMFF nesting never exceeds about 8:
`moov/trak/mdia/minf/stbl`), or make the walk iterative with an
explicit stack. Additionally refuse a container inside a box that
cannot hold it (`moov` under `moov`). Add a deeply nested fixture test
to `crates/api/tests/media_ingest_e2e.rs`.

#### H2 — ~208 MiB JSON bodies are buffered in memory on `/graphql`, unauthenticated
**Where:** `crates/api/src/lib.rs:469-477` (`graphql_limit`),
`crates/api/src/media/mod.rs:386-390` (`transport_limit_bytes`).
**Impact:** The `/graphql` body ceiling is `2 × max(upload caps) + part
size` = 208 MiB with defaults, applied to every content type. Multipart
files spool to disk, but an `application/json` body is read to end
into a `Vec` by async-graphql before parsing, before any rate limiter
runs (limiters live inside resolvers). There is no concurrency or
request-timeout layer on the route. N anonymous connections × 200 MiB
exhausts the API's container memory limit.
**Fix:** Apply the large limit only when the content type is
`multipart/form-data`; wrap every other body in
`http_body_util::Limited` at about 1 MiB inside `graphql_handler`.
Consider `tower::limit::ConcurrencyLimitLayer` and a `TimeoutLayer` on
the route, and a body-read timeout at the proxy.

#### H3 — Rendition size is unbounded before it is read whole into memory
**Where:** `crates/api/src/media/ingest_queue.rs:341` (`tokio::fs::read(&output)`),
`crates/api/src/media/transcode.rs:355` (`args()`: no `-fs`/`-t`),
`ingest_queue.rs:380-381` (`plan()` picks a bitrate from the declared
duration but never checks `duration × rate` against the cap).
**Impact:** A 100 MiB upload holding many hours of near-static video at
~20 kbps is within target on rate; forcing a re-encode is trivial
(short side 1081 px, or non-AAC audio — even `VideoPlan::Copy`
re-encodes audio at 128 kbps for the whole duration). The result is a
multi-GB `rendition.mp4` in the container's scratch space, then a
multi-GB `Vec`, then an OOM kill of the API, repeated on each of three
attempts. The declared `mvhd` duration is attacker-controlled, so an
upfront duration check alone is insufficient.
**Fix:** Pass `-fs <caps.video_bytes>` so ffmpeg stops at the cap; check
`tokio::fs::metadata(&output).len()` against the cap and refuse with
`REASON_TOO_LONG` before reading; keep a cheap upfront
`duration × rate > cap` check as the friendly early refusal; bound the
scratch filesystem in the Quadlet unit (`Tmpfs=` with a size).

#### H4 — 17 RUSTSEC advisories in `Cargo.lock`, no audit gate in CI
**Where:** `Cargo.lock`; `.github/workflows/ci.yml` (no audit step).
Verified with `cargo audit` 0.22.2 against the 2026-10-28 advisory
database (full table in Appendix A).
**Impact:** rustls 0.23.37 (RUSTSEC-2026-0285 handshake messages
accepted across encryption levels, -0349 unauthenticated ServerHello
downgrade, -0348 1 GiB brotli certificate allocation before
authentication, -0346 `Debug` impls leak secrets), rustls-webpki
0.103.10 (-0382 distrusted intermediates accepted, -0098/-0099 name
constraints wrongly accepted, -0104 reachable panic in CRL parsing) and
webpki-roots 1.0.6 (-0381 distrusted emSign intermediates) sit under
every outbound TLS connection the API makes: the HIBP range API, SMTP
submission, S3 (when remote), and Postgres TLS if enabled. `rsa` 0.9.10
(RUSTSEC-2023-0071 Marvin timing attack, no fix) and `crypto-bigint`
0.5.5 (-0387) are linked through jsonwebtoken's `rust_crypto` feature
but no RSA/ECDSA algorithm is configured (`crates/api/src/auth.rs:126`
pins `Algorithm::EdDSA`), so they are inert. `quinn-proto` 0.11.16 (5
advisories) and `webpki-root-certs` 1.0.9 are in the lock but not
compiled on Linux. All fixable ones are semver-compatible patch bumps.
Nothing in CI would ever have flagged this.
**Fix:** `cargo update -p rustls -p rustls-webpki -p webpki-roots -p webpki-root-certs -p quinn-proto`.
Add a SHA-pinned `rustsec/audit-check` (or `cargo deny check advisories`)
to the ungated `corpus-lint` lane with a documented
`--ignore RUSTSEC-2023-0071`, and `npm audit --audit-level=high` to the
web job.

#### H5 — No browser security headers on the app origin
**Where:** `web/next.config.ts` (no `headers()` export;
`poweredByHeader` left at its default), `web/scripts/prod.mjs:259`
(relays upstream headers verbatim), `deploy/proxy/Caddyfile:72-85`
(catch-all site block sets only `Cache-Control`; CSP + `nosniff` exist
only on the `/media` route at `:51-55`).
**Impact:** Every page is frameable (clickjacking of the stance pad,
Sign, "Erase everything", sign-out, backup rekey, key-export reveal).
Any XSS has a CSP-free blast radius: beyond the documented "a session",
an injected script can read the revealed PEM/hex on `/settings/key`,
the recovery code on `/key` and `/settings/backup`, and sign with the
non-extractable key. Caddy sends no HSTS by default, so a first HTTP
visit is downgradeable. `Referrer-Policy` is the browser default; token
pages have no external links today, so Referer leakage of
`/reset?token=` and `/join/<id>` is not currently reachable but nothing
enforces that.
**Fix:** In `next.config.ts` add `async headers()` with
`Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; img-src 'self' blob: data: <media origin>; media-src 'self' blob: <media origin>; connect-src 'self'; script-src 'self' 'sha256-<hash of THEME_BOOT_SCRIPT>'`
(the only inline script is the compile-time constant at
`web/src/app/layout.tsx:57`), `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` (or `no-referrer` on
`/reset`, `/verify`, `/email-change`, `/delete-account`),
`Permissions-Policy`, `X-Content-Type-Options: nosniff`, and set
`poweredByHeader: false`. Add
`Strict-Transport-Security "max-age=31536000; includeSubDomains"` in
the Caddyfile's main site block. `next/font` self-hosts and images are
`unoptimized`, so a strict CSP is feasible; add `'wasm-unsafe-eval'`
when the on-device ranker lands.

### Medium

#### Backend — API and request handling

**M-API-1 — Raw storage errors reach clients as GraphQL messages.**
`crates/api/src/schema/mutation.rs:2191, 2262, 2289, 2319, 2370-2371, 2425-2426, 2742, 3139, 3208`,
`schema/query.rs:282, 306, 341, 347, 356, 369, 394, 415, 431, 509, 773`,
and 55 explicit `.map_err(|e| async_graphql::Error::new(e.to_string()))`
sites across `schema/*.rs`; `User` resolvers throughout
`schema/types.rs`. Every `?` on a `sqlx::Error`, `MirrorError` or
`StagedError` goes through async-graphql's blanket `From<T: Display>`,
which puts `e.to_string()` in `errors[].message` with no
`extensions.code` and no server-side log. `docs/implementation/api-spec.md`
promises internal detail never reaches the client. A Postgres fault
surfaces verbatim (constraint and table names, pool timeouts, the
database host:port on connection refusal). `tests/error_codes_e2e.rs`
covers only the explicit `internal()` path. *Fix:* add a schema
`Extension` in `schema/mod.rs::build_with` that logs and collapses any
error lacking `extensions.code` to `INTERNAL` / "internal error" (or a
`StorageError` newtype implementing `ErrorExtensions`), then delete
the ad-hoc conversions.

**M-API-2 — Unbounded input lists on relay mutations.**
`approveApplicants` (`mutation.rs:2019-2074`, 3-4 DB reads per entry in
`validate_approval` before pricing), `submitProposals`
(`:4255-4336`, per entry `staged::load`, media gate, L1 `seal`, reload)
and `approveActs` (`:4341-4394`) accept lists of any length; complexity
budgets price output only and the body limit (H2) admits millions of
entries. `markSeen`, `nodes`, `feed` and `ownPublishedPlacement` already
cap at 100. A duplicated application id in one `approveApplicants`
batch is validated and charged twice in `price_batch`
(`crates/api/src/onboarding.rs:736-769`) before the second
`approve_one` fails. *Fix:* refuse lists above a stated cap (100, or 21
for relay legs, the most writes one prepare yields) with `BAD_INPUT`;
dedupe application ids; document the cap in api-spec.md.

**M-API-3 — Missing `SESSION_SIGNING_SEED` silently falls back to an ephemeral key in release.**
`crates/api/src/main.rs:26-44`. The fallback logs a warning with no
`cfg!(debug_assertions)` gate. `deployment.md` lists the seed as a
required secret; a misnamed secret means every restart signs everyone
out and tokens from a previous process are rejected, with nothing
louder than a log line. *Fix:* make an absent seed a boot error in
release builds, as the playground route is already gated.

**M-API-4 — Zero-valued interval env vars silently kill background loops.**
`tokio::time::interval(Duration::ZERO)` panics. `MediaConfig::from_env`
(`crates/api/src/media/mod.rs:329-369`) validates only part size and
lease; `main.rs:111, 132, 144, 174` parse the other intervals as bare
`u64`. The panic happens inside `tokio::spawn`/`draining.spawn`
(`main.rs:212`) and is swallowed into a dropped `JoinHandle` (stderr
only, no tracing). The server keeps serving with no mirror ingestion,
no orphan sweep or no ingest workers. Also unvalidated:
`MEDIA_INGEST_WORKERS=0` (videos needing re-encode stay `processing`
until the sweep deletes them a day later), `MEDIA_TRANSCODE_TIMEOUT_SECS=0`,
negative or NaN `MEDIA_ORPHAN_MAX_AGE_SECS` /
`MEDIA_UPLOAD_SESSION_TTL_SECS`, `RANKER_API_TIMEOUT_MS=0` on the pod.
*Fix:* `anyhow::ensure!(x > 0)` and finiteness checks in `from_env` and
`main.rs`; spawn background loops through the `TaskTracker` or a
wrapper that logs `JoinError::is_panic()` at error.

**M-API-5 — No global bound on concurrent upload-processing memory.**
Each `uploadMedia` holds the spooled file as a `Vec` (up to 200 MiB at
the ceiling), the strip always makes a second copy (`strip_metadata`
→ `to_vec()`), the WebP probe may allocate up to 96 MiB, and
`completeMediaUpload` reads the whole staging object
(`crates/api/src/media/resumable.rs:405`); `receive_part` copies each
part (`lib.rs:387`). All of this runs on tokio's blocking pool (default
512 threads) with no semaphore; only the per-account hourly window
limits it, so a handful of accounts can push the API past its memory
limit. *Fix:* a process-wide `Semaphore` (4-8 permits) around
`process()` acquired before the body is read; pass `Bytes` through
instead of copying parts.

**M-API-6 — `mp4` crate divides by `timescale`; the ingest worker probes on the async runtime.**
`crates/api/src/media/video.rs:572` calls `mp4.duration()`, which in
`mp4` 0.14.0 is `duration * 1000 / timescale` with no zero check (and an
overflowing multiply for a version-1 `mvhd`). On the upload path the
panic is contained by `spawn_blocking` and surfaces as an opaque
`INTERNAL`. In the ingest worker, `run_job`
(`crates/api/src/media/ingest_queue.rs:315`) calls `video::probe` inline
on the async runtime, so a panic there kills the worker task for the
process lifetime, and parsing up to 100 MiB blocks a runtime thread.
*Fix:* refuse `timescale == 0` (and an overflowing duration) as
`MediaError::Malformed` before calling `duration()`; move the worker's
probe into `spawn_blocking`; consider `catch_unwind` around third-party
container parsing.

**M-API-7 — Staging and pre-transcode objects live in the world-readable live bucket.**
`resumable::staging_key` (`crates/api/src/media/resumable.rs:140`)
assembles `uploads/<session>` in `areas.live`: that object is the
*unstripped* upload (EXIF/GPS, `udta`) until `complete` deletes it, up
to a day if `complete` is never called. `ingest_key`
(`media/mod.rs:1418`) stores the stripped original under
`ingest/<media_id>.mp4` in the same bucket until the rendition lands.
Keys are UUID-unguessable and production Caddy happens to route
`/media/uploads/*` to the API, but `/media/ingest/<id>.mp4` *is* served
by the proxy, and the dev MinIO `download` policy grants `ListBucket`,
so both prefixes are enumerable in dev. The posture rests on routing
accidents rather than bucket policy. *Fix:* stage multipart uploads and
`ingest/` originals in the private carried bucket (or a dedicated
staging bucket); otherwise add Caddy `respond 404` for `/media/ingest/*`
and `/media/uploads/*` and scope the anonymous policy to root-level
`*.webp`/`*.mp4`.

**M-API-8 — ffmpeg inherits the API's full environment, including every secret.**
`crates/api/src/media/transcode.rs:254` and `:456` spawn ffmpeg with
`tokio::process::Command` without `env_clear()`; the API container
environment carries the Postgres password, `SESSION_SIGNING_SEED`,
`SMTP_URL` and both stores' keys
(`deploy/quadlet/cogra-api.container:19-25`). ffmpeg decodes
attacker-supplied video; a decoder RCE yields a process holding every
secret in its own environment (and, as the same uid, able to read
`/proc/<api>/environ`). Argument injection was checked and is not
possible: argv is constants plus tempdir paths, `-nostdin`,
`kill_on_drop(true)`, and a tokio timeout. *Fix:* `.env_clear().env("PATH", …)`
first; then isolate the transcode (a separate `cogra-transcode`
container pulling jobs from the ingest queue, which the queue design
already supports, or at least a different uid, seccomp, `ReadOnly=true`
+ `Tmpfs=/tmp` on the API unit). Also pass `-protocol_whitelist file`
(the mov demuxer can follow external `dref` references by default) and
a `-threads` bound.

#### Backend — staged writes, L1 stand-in, ingestion

**M-L1-1 — A seal retry after a lost response is treated as equivocation and expires the write.**
`crates/l1-standin/src/seal.rs:171-209` inserts `l1_acts` with
`ON CONFLICT DO NOTHING` and maps zero rows to `StandInError::Conflict`
with no idempotent path for the *same* proposal (same act id, same
pre-commitment). `crates/api/src/relay.rs:174-177` answers `Conflict`
with `staged::expire_one`. `record_pre_signed`
(`crates/postgres-store/src/staged.rs:587-615`) explicitly accepts a
retry from `sealing`, but a relay that died *after* the stand-in
committed the seal and *before* `record_sealed` gets `Conflict` on
retry: the write's pending display rows are deleted, the staged row is
terminal, the sealed act sits in `l1_acts` forever and the author's
`(author, seq)` is burned. A benign crash or timeout permanently loses
a signed act. *Fix:* in `seal()`, on conflict re-read the row and
return the stored `VerifiedAct` when its `pre_commitment` equals the
recomputed one (true idempotency; `Conflict` only when it differs), or
have the relay call `sealed_act` on `Conflict` before expiring.

**M-L1-2 — Epoch ingestion and staged-write promotion are separate transactions with no repair pass.**
`crates/api/src/ingest.rs:98-99`: `mirror::ingest_epoch` commits the
cursor in its own transaction, then `staged::promote_landed(pool, epoch)`
(`postgres-store/src/staged.rs:805-828`) runs afterwards and matches
only `mirror_records WHERE epoch = $1`. If the process dies, or
`promote_landed` returns a transient `sqlx::Error`, the next pass
resumes from the advanced cursor and that epoch is never promoted.
Eight epochs later `expire_due` (`staged.rs:864`) expires every write
not in `landed`/`expired`/`carried` without consulting the mirror, and
`discard_pending_content` removes display rows for content whose
record *is* on L1 and in the mirror. Recovery today needs a manual
`l1-dev rebuild`. Found independently by two reviewers. *Fix:* make
`promote_landed` epoch-agnostic (`act_id IN (SELECT record_id FROM mirror_records)`
for any non-landed write — indexed and cheap) and run it every pass, or
promote inside `ingest_epoch`'s transaction; make `expire_due` exclude
writes whose `act_id` is in `mirror_records`.

**M-L1-3 — `record_pre_signed` overwrites the pre-commitment leg on a retry from `sealing`.**
`crates/postgres-store/src/staged.rs:587-615` replaces `author_pubkey`,
`nonce` and `pre_signature` unconditionally for a row already in
`sealing`. If relay A is mid-`seal` and a retry B records a different
nonce/signature, A's `record_sealed` then moves the row to
`awaiting_approval` with salts and commitments bound to A's nonce while
the row carries B's. `lock_copy` then archives the wrong nonce and
`verified_act()` hands the device a `VerifiedAct` whose approval cannot
verify. *Fix:* `AND (nonce IS NULL OR (nonce = $3 AND pre_signature = $4))`
in the `WHERE`, or hold the row `FOR UPDATE` for the span of the seal.

**M-L1-4 — Ingest-lease operations do not check lease ownership.**
`crates/postgres-store/src/media.rs:461` (`renew_ingest_lease`), `:482`
(`release_ingest`), `:496` (`hand_back_ingest`), `:609` (`fail_ingest`)
are all `WHERE id = $1 AND state = 'processing'`. If worker A's lease
lapses (database unreachable longer than `MEDIA_INGEST_LEASE_SECS`) and
B claims the row, A's renew still returns `true`, A's `fail()` can mark
the row `FAILED` with a stale reason while B is about to settle a good
rendition (B then gets `Abandoned`), A's `release_ingest` can cut B's
lease to 30 s, and A's `hand_back` refunds an attempt B consumed.
`finish_ingest` is state-guarded, so no row ever points at missing
bytes; the damage is wrong outcomes, wrong attempt accounting and
double ffmpeg work. The e2e suite covers lapse-and-reclaim but not two
live workers on one row. *Fix:* add a `lease_token uuid` set on claim
and require `AND lease_token = $tok` in renew/release/hand-back/fail/
finish/merge; treat zero rows as `JobError::Gone`.

#### Web app

**M-WEB-1 — Resumable uploads never refresh an expired access token mid-upload (web and Android).**
Web: `web/src/lib/api/part-uploader.ts:116-139` re-reads the access
token per attempt and treats 401 as transient, but nothing in `sendAll`
triggers a refresh; `media-api.ts:197-202` wires only
`tokenStore.accessToken()`. Android: `core/network/.../repo/ChunkedUpload.kt:138-146, 180-186`
has the same shape (`tokens.current()`, 401 → `Transient`). Access
tokens live 15 minutes and `web/next.config.ts:32-35` sizes the proxy
timeout for a 14-minute upload, so a token minted a minute before a
slow upload expires mid-stream: six 401s over 15-31 s, then a
"could not reach the server" transport error and an aborted session
(`media-api.ts:260`); the author re-sends everything.
`part-uploader.test.ts:148` and `MediaUploadTest.kt:292-305` pin the
wrong assumption (only the no-token case). *Fix:* give the part
uploader a `refresh` dependency (web: the refresher/guard; Android:
inject `SessionGate` and call `SessionRefresher.refresh` on 401) and
invoke it on 401 before the next attempt; keep the retry budget for
transport faults; distinct message for a 401 that persists; add tests
with a 401 followed by a rotated token.

**M-WEB-2 — The token store touches `localStorage` at module load with no `try/catch`.**
`web/src/lib/session/token-store.ts:38-53, 67-83` and the module-level
`createTokenStore()` at `:92`. Safari "Block all cookies", Firefox
blocked site data and some webviews throw `SecurityError` on access.
Every other reader guards the access (`recents.ts:40-47`,
`committed-filter.ts:54`, `held-link.ts`, …) except this module,
`settings/device-preference.ts:33,39` and `stance/input-mode.ts:36,48`.
The token store is imported by `apollo-wrapper.tsx`,
`identity/store.ts` and `draft-store.ts`, so this is an unrecoverable
exception on every route including public reads. *Fix:* `try/catch`,
degrade to signed-out/memory-only; guard the other two modules; a
shared `safeStorage()` helper would end the drift.

**M-WEB-3 — No React error boundaries.** No `error.tsx` or
`global-error.tsx` under `web/src/app/`. Any uncaught render/effect
error (M-WEB-2, an escaping `CustodyBlockedError`, a malformed payload)
blanks the tree to Next's generic error page, including on `/key` and
`/settings/backup` while a one-time recovery code is on screen. *Fix:*
add `src/app/error.tsx` and `global-error.tsx` with the shared
`TransportError`-style surface and `reset()`; consider boundaries
around the compose wizard and the key surfaces.

**M-WEB-4 — State-changing actions fire on a plain GET of a mailed link.**
`web/src/app/.../delete-account-confirmed-view.tsx:109-119` calls
`confirmAccountDeletion` in a mount effect ("opening it is the
confirmation"); `verify-view.tsx:73-92` spends the verification token on
load. Mail-link scanners and prefetchers that follow URLs start the
deletion grace period or verify without a click. Bounded (grace period;
the user requested it) and a documented design decision, so this is
flagged for the design backlog rather than as a defect. *Suggested:*
one click ("Confirm deletion") before the mutation on `/delete-account`;
verification can stay one-shot.

#### Android app

**M-AND-1 — Recovery-code screens are not `FLAG_SECURE`.**
`feature/onboarding/.../OnboardingScreens.kt:338-370`,
`feature/settings/.../BackupScreen.kt:169-175`, rendering
`core/designsystem/.../RecoveryCodeConfirm.kt:73-77`. The recovery code
opens the uploaded backup blob and is therefore key-equivalent, yet
only `KeyExportScreen.kt:186-191` sets `FLAG_SECURE`; the code appears
in screenshots, the recents thumbnail, screen recordings and overlay/
accessibility capture. `android.md` only requires the flag for export,
so this is a doc gap as well. *Fix:* move `SecureWindow()` into
`core:designsystem` and apply it while `recoveryCode != null` (and on
`RestoreScreen` while a code is typed).

**M-AND-2 — The typed-back recovery code lands in saved instance state and an ordinary IME field.**
`RecoveryCodeConfirm.kt:70` (`rememberSaveable`), `:146-170`
(`OutlinedTextField` with no `keyboardOptions`), `RestoreScreen.kt:75-83`.
`rememberSaveable` persists the partially typed code to the saved-state
Bundle on disk across process death; the default keyboard may learn and
suggest it. *Fix:* plain `remember` (or clear on confirm) and
`KeyboardOptions(keyboardType = Password, autoCorrectEnabled = false)`
on both fields.

**M-AND-3 — Key export copies the private key as an unflagged clip.**
`feature/settings/.../KeyExportScreen.kt:175-183`: the PEM and hex are
in a `SelectionContainer`, so the only copy path is the system
selection toolbar, which creates a normal clip (no `EXTRA_IS_SENSITIVE`).
On Android 13+ the key renders in the clipboard preview bubble, and
clipboard sync/IME suggestions can read it; the clip outlives the
`FLAG_SECURE` window. *Fix:* an explicit copy button reusing the
`sensitiveClip` helper from `RecoveryCodeConfirm.kt:195-201` (make it
shared), and `clearPrimaryClip()` on dispose.

**M-AND-4 — `SessionGate` sends an expired token when the proactive refresh fails, yielding a guest view.**
`core/network/.../auth/Auth.kt:94-103` (`usable()`): when `refresh()`
returns `false` for a transport fault, a 5xx or any refusal other than
`REFRESH_TOKEN_INVALID`, the gate re-reads the store, finds the same
expired token and sends it. The API resolves the viewer as `Option`
(see L-API-7), so the expired token is served as a guest view, "a
working app showing somebody else's view", the exact hazard the gate's
docstring names. `AuthGuard` replays only on `UNAUTHENTICATED`, which a
successful guest read never produces. `SessionGateTest` has no
failed-refresh case. *Fix:* after a failed refresh, if the access token
is still expired, throw a dedicated `SessionRefreshFailedException`
handled like `SessionUnreadableException` → `Outcome.Failed`.

**M-AND-5 — The application coroutine scope has no `CoroutineExceptionHandler`; a DataStore `IOException` crashes the process.**
`app/.../di/AppModule.kt:60-64` provides
`CoroutineScope(SupervisorJob() + Dispatchers.Default)`. Root `launch`es
on it (`core/domain/.../history/SeenRecord.kt:106-112, 224` → `persist()`
→ `DataStore.edit`, documented to throw `IOException`; also
`SeenTracker.kt:136`, `SavedWrites.kt:90,161`, `HiddenSet.kt:82,194`,
`RegistrationFlow.kt:60,85`) propagate to the thread's default handler
and kill the app; `SupervisorJob` only isolates siblings.
`DeviceLockKeeperViewModel.kt:43-49` already wraps the same store calls
in `catch (_: IOException)`. `SeenRecord`'s `dirty.consumeEach { persist() }`
loop also ends for good after one throw. *Fix:* add a
`CoroutineExceptionHandler` to the provided scope that logs via
`CograLog` and marks storage lost on `IOException`; wrap `persist()`
per iteration so the consumer loop survives.

#### Deployment and CI

**M-DEP-1 — MinIO store containers run as root with default capabilities.**
`deploy/quadlet/cogra-media.container`, `cogra-media-held.container`,
`cogra-media-init.container`, `cogra-media-held-init.container`: no
`User=`, no `DropCapability=`. API, web and ranker drop all caps and run
non-root; the proxy keeps only `CAP_NET_BIND_SERVICE`. The stores are
the one service besides the API with an Internet path (`GET /media/*`).
*Fix:* `User=10002:10002` on both store units (chown the volumes once),
`DropCapability=ALL`, `ReadOnly=true` with the data volume the only
writable mount; Postgres `DropCapability=ALL` plus the few it needs
(`CHOWN DAC_OVERRIDE FOWNER SETGID SETUID`).

**M-DEP-2 — Dev compose publishes Postgres and MinIO (API and console) on all interfaces with committed default credentials.**
`docker/docker-compose.yml:29-30` (5432), `:66-68` (9000 and the 9001
console); credentials `gnp/gnp_secret` and
`cogra_media/cogra_media_secret` (`.env.example:20-24, 53-54`). The
documented hotspot/guest-APK workflow (`scripts/stamp-net.sh`,
`make guest-apk`) puts other devices on the same LAN; `.env.example:35`
and `stamp-net.sh:60-63` rely on "the host firewall keeps the port
closed", which nothing in the repo configures or checks. *Fix:* bind
loopback by default (`"${BIND_ADDR:-127.0.0.1}:${POSTGRES_PORT:-5432}:5432"`,
same for 9000; drop or loopback-only 9001), let the cross-WSL case opt
into the LAN address, or have `stamp-net.sh` warn when it stamps a LAN
address while these ports are on `0.0.0.0`.

**M-DEP-3 — `deploy.sh` leaves the site down if anything fails between stop and start.**
`deploy/scripts/deploy.sh:68` stops web, ranker and API; the backup
(`:71`), retag (`:83-85`), API start (`:88`) and migration-count check
(`:91`) run under `set -e` with no trap. A failed pre-deploy backup, a
count mismatch, or an API that never turns healthy ends in `die` with
nothing restarted (`systemctl stop` is sticky; `Restart=always` does not
undo it). *Fix:* an `ERR`/`EXIT` trap that retags the previous hash
(captured at `:46`) back to `:deployed`, starts the three units and
alerts; stop web/ranker only after the backup succeeds; when the image
carries no new migration, back up before stopping anything.

**M-DEP-4 — The media store pins an archived MinIO upstream (known, open question D-4).**
`docker/docker-compose.yml:7` and all four media Quadlets pin
`minio:RELEASE.2025-09-07T16-13-09Z`; `docs/implementation/deployment.md:248-253`
records the upstream as archived with D-4 (keep / Garage / provider)
undecided. The component holding all user media and exposed read-only
through the proxy receives no security fixes. *Fix:* decide D-4 (Garage
keeps the S3 `BlobStore` seam).

**M-CI-1 — `cargo install sqlx-cli` is unpinned in CI.**
`.github/workflows/ci.yml:230` floats to the newest sqlx-cli while sqlx
is 0.8.6 and Dependabot holds sqlx below 0.9
(`.github/dependabot.yml:111-112`) precisely because "CI's sqlx-cli must
move with it". The day sqlx-cli 0.9 ships,
`cargo sqlx prepare --workspace --check` (`:238`) with a mismatched major
can red every PR or accept metadata the 0.8 macros will not. *Fix:*
`cargo install sqlx-cli --version 0.8.6 --locked …` plus a grep that the
pin equals sqlx in `Cargo.lock`, like the toolchain check at `:157-158`.

**M-CI-2 — CI never builds with `--locked` and never builds the container images.**
`ci.yml` runs clippy and tests without `--locked`; the only `--locked`
builds are `deploy/Containerfile.api:34` and
`crates/ranker-server/Containerfile:14`. A PR that leaves `Cargo.lock`
stale passes CI and fails at image build on the release machine; a
broken `apt-get`, a vanished base tag or a `.containerignore` mistake
is found at deploy time. *Fix:* `--locked` on CI cargo invocations; an
`images` job gated on `deploy/**`, `Cargo.lock` and `web/**` that builds
the three Containerfiles without pushing and probes the API image's
health script.

### Low

#### Backend — API

- **L-API-1 — `CLIENT_IP_SOURCE` accepts spoofable variants.**
  `crates/api/src/main.rs:158-160` parses any
  `axum_client_ip::ClientIpSource` (leftmost `XForwardedFor`, `XRealIp`,
  `CfConnectingIp`, …) while `auth.md` and `development.md` sanction only
  `ConnectInfo` and `RightmostXForwardedFor`. Behind the proxy a header
  source lets callers pick their own limiter key. *Fix:* allowlist the
  two sanctioned values at boot.
- **L-API-2 — Expensive work before the cheap check.**
  `crates/api/src/onboarding.rs:205-227`: HIBP lookup and Argon2 hash
  run before `invite_link_usable` (`:222`); `mutation.rs:2346-2357`:
  HIBP lookup runs before `consume_password_reset`. Unauthenticated
  callers with garbage capabilities still cost an outbound request plus
  a hash per call (bounded 5/h and 30/15 min per IP). *Fix:* validate
  the link / peek the token first; consume after the password passes so
  a weak password does not burn a good token.
- **L-API-3 — Applicant self-deletion and the reaper hand a single-use invite slot back.**
  `crates/postgres-store/src/auth.rs:3029-3030` (comment acknowledges
  it), `invite_link_usable` (`:292-313`), via `deleteApplicantAccount`
  (`mutation.rs:3529-3543`, `viewer()` only, no limiter). `auth.md`
  says a single-use link is used up by the registered account.
  *Fix:* add `auth_invite_links.used_at` stamped in `register_account`,
  or amend auth.md.
- **L-API-4 — `issueDeviceLock` spends the budget before the live-cap check.**
  `mutation.rs:3242-3263`: `spend_device_lock_issue` charges, then
  `AtCap` is answered `RATE_LIMITED` without refund, contradicting
  `ratelimit.rs`'s "a refused issue spends nothing". *Fix:* cap check
  first, or charge inside the store transaction after the count.
- **L-API-5 — Password reset leaves other live reset tokens and a pending email change standing.**
  `mutation.rs:2337-2376` / `:2305-2333`; `create_password_reset`
  (`postgres-store/src/auth.rs:2199`) never retires earlier rows, so up
  to three tokens per hour can be live for 15 minutes each and
  consuming one leaves the rest valid. *Fix:* void the account's other
  unused rows in `consume_password_reset`; consider cancelling a pending
  email change on reset.
- **L-API-6 — Reset and login serve unverified / dead-but-unreaped accounts.**
  `mutation.rs:2316` (`credentials_by_email` has no `email_verified_at`
  filter, unlike `unverified_account_by_email` at store `:806`) and
  `:2191`. Anyone can register with a victim's address and the victim
  then receives reset mails on demand (3/h) for up to 7 days; `auth.md`
  says reset mail goes to the *verified* address. Never-verified
  accounts past the 7-day bound still log in until the reaper's next
  tick. *Fix:* require `email_verified_at IS NOT NULL` for reset
  (silently); exclude dead accounts at login.
- **L-API-7 — An invalid or expired bearer token is treated as anonymous.**
  `lib.rs:136-141` and `:300-307` fold a failed `verify_access_token`
  into `viewer = None`; `me` answers null and private fields read as a
  stranger's until a mutation returns `UNAUTHENTICATED`. This is what
  turns M-AND-4 into a silent guest view. `strip_prefix("Bearer ")` is
  also case-sensitive (RFC 7235 schemes are case-insensitive). *Fix:*
  answer a present-but-invalid header with transport `UNAUTHENTICATED`,
  as the PUT route already does; compare the scheme case-insensitively.
- **L-API-8 — `confirmEmailChange` counts a carve-out verification link as a wrong code.**
  `mutation.rs:2565-2579`: the `if change.requires_code` guard fails
  for a carve-out change and the hash falls into
  `submit_email_change_code`. *Fix:* match `!change.requires_code`
  explicitly and point at `verifyEmail`.
- **L-API-9 — Design items worth re-confirming (spec-conform today).**
  `deleteApplicantAccount` destroys an account with a bare 15-minute
  access token (no password re-proof, no limiter) while every other
  destructive verb re-proves; `requestEmailChange` to a taken address
  mails a stranger's inbox (5/h per account); access tokens outlive
  session revocation by up to 15 minutes (`member_viewer` re-reads
  account state but not session liveness, and `Viewer.session_id` is
  already in context if a tighter blast radius is wanted).
- **L-API-10 — The dev mailer is the default and logs every token.**
  `crates/api/src/mailer.rs:95`: `MAILER=dev` is the default and
  `DEV_MAILER_LOG` appends bodies to a file. `deploy/env/api.env.example`
  sets `MAILER=smtp`, but a production deploy that forgets `MAILER`
  silently writes every verification and reset token to the journal and
  sends nothing. *Fix:* require an explicit `MAILER` in release builds,
  or log at error when the dev mailer is chosen outside debug.
- **L-API-11 — `RankerClient` has no connect timeout and reads unbounded responses.**
  `crates/api/src/ranker_pod.rs:186`: overall bounded by
  `tokio::time::timeout`, but `response.bytes()` has no size cap.
  *Fix:* `.connect_timeout`/`.timeout` on the builder and a response cap.
- **L-API-12 — The ranker pod is unauthenticated and unbounded.**
  `crates/ranker-server/src/lib.rs:70-77`: no auth, no body limit
  (`async-graphql-axum`'s extractor consumes `req.into_body()` directly,
  so axum's default limit does not apply), no concurrency or depth/
  complexity limit; `rank_search(candidates)` and `RankParams.settling`
  (`schema.rs:181, 506`) are unbounded; each rank pages the viewer's
  whole slice from the API (`api.rs:200+`, unbounded page count). It
  publishes no port and the internal network has no egress, so the
  surface is in-cluster only; `feedSlice`/`networkParameters` on the API
  are anonymous by design (`query.rs:794`). *Fix:* `RequestBodyLimitLayer`
  and a small concurrency limit on `/graphql`; cap list lengths and page
  count; consider a shared-secret header between API and pod.
- **L-API-13 — Objects without rows are never collected.** `store_asset`
  (`media/mod.rs:1440`) writes object-then-row; an insert failure or a
  crash between leaves an object `sweep_orphans` never sees (it deletes
  rows, then keys). `resumable::begin` has the mirror gap (multipart
  opened before the session row). `development.md` says compose sets
  MinIO's stale-upload expiry, but the production media units and
  `provision.sh` set neither that nor a lifecycle rule. *Fix:*
  `MINIO_API_STALE_UPLOADS_EXPIRY` in the production media unit (or an
  ILM rule) and a "keys with no row older than N days" reconciler.
- **L-API-14 — Orphan sweep versus in-flight attach surfaces as `INTERNAL`.**
  `postgres-store/src/media.rs:1491` deletes an unreferenced asset
  older than 24 h in one statement while `plan_gallery` reads the asset
  and inserts the junction later; the FK prevents a dangling reference
  but the author's prepare fails with a constraint error. The sweep
  also deletes `processing` rows a worker currently leases. *Fix:*
  exclude `lease_until > now()` from the sweep; map the FK violation to
  `BAD_INPUT` on `attachments[i].mediaId`.
- **L-API-15 — `TempDir` drop runs blocking I/O on the async thread and the whole source is held in memory.**
  `media/ingest_queue.rs:307`: created on the blocking pool but dropped
  wherever `run_job`'s future is dropped, including the deadline/`Gone`
  select branches; `tokio::fs::write(&input, source)` holds the full
  source. *Fix:* close the scratch dir via `spawn_blocking`; stream the
  source to disk.
- **L-API-16 — `l1-dev submit <seed-hex>` takes the actor seed on argv**
  (`crates/api/src/bin/l1-dev.rs:135`), visible in `ps` and shell
  history. Dev tool; prefer env or file input.
- **L-API-17 — `dotenv::read` walks parent directories**
  (`crates/api/src/dotenv.rs:33`): the first `.env` in any ancestor of
  the working directory is loaded, including in production containers.
  Consider CWD-only in release.
- **L-API-18 — `graphql_handler` duplicates `bearer_viewer`**
  (`lib.rs:136-141` vs `:300-307`). Call the helper.

#### Backend — store, L1 stand-in, common

- **L-ST-1 — Device-lock cap counts released locks.**
  `postgres-store/src/auth.rs:3204-3212` counts all rows with no
  `released_at IS NULL` filter; `auth.md` says locks are never spent, and
  lost devices never `discardDeviceLock`, so an account that signs in
  `cap` times is `AtCap` forever with no operator reset. Decide what the
  cap counts and align doc and query.
- **L-ST-2 — Actor nonce length is not checked at seal.**
  `crates/l1-standin/src/seal.rs:127-139` enforces its own salt lengths
  but accepts any `pre.nonce`, including empty; the nonce is what keeps
  the pre-digest from confirming a guessed payload after the host nulls
  it at acceptance. *Fix:* refuse `pre.nonce.len() < SALT_LEN` as
  `Formation`.
- **L-ST-3 — Recursive CBOR decode of envelope extension values has no depth bound (latent).**
  `crates/common/src/envelope/pce.rs:88-118` (`Value::decode`; also
  `encode` and the derived `Drop`). Each nesting level costs one byte,
  the payload bound is 64 KiB, so ~65 000 nested arrays overflow a
  worker stack and abort the process. *Not reachable today*: payloads
  are built server-side from typed inputs and the stand-in replays only
  what CoGra sealed. But `Envelope::decode_for_read` is the documented
  reader for third-party acts after the L1 swap, and `media/areas.rs:247`
  decodes stored carriage. This becomes a High the day the swap lands.
  *Fix:* a depth counter (refuse past 32), or reuse
  `cogra_interchange`'s iterative decoder, which already solves exactly
  this class.
- **L-ST-4 — Email-change code hash is reversible by a database reader.**
  `crates/api/src/auth.rs:157-158` → `postgres-store/src/auth.rs:2508`:
  6 decimal digits stored as unsalted SHA-256 (10^6 hashes invert it
  offline) and compared with `==`. Online guessing is capped under
  `FOR UPDATE`, and a DB reader can do worse anyway, so this is
  defence in depth: HMAC with a server pepper or Argon2.
- **L-ST-5 — The pool has no acquire-timeout override, statement timeout or idle-in-transaction timeout.**
  `crates/postgres-store/src/lib.rs:44-49`: `max_connections(10)`,
  default 30 s acquire. `close_epoch` holds an `EXCLUSIVE` table lock
  while loading all accepted act times and the whole `l1_node_state`
  table; a slow close or a pathological scoped search can pin
  connections with no circuit breaker. *Fix:* `.acquire_timeout(..)` and
  `.after_connect` setting `statement_timeout` and
  `idle_in_transaction_session_timeout` from config.
- **L-ST-6 — Unbounded result sets.** `postgres-store/src/settling.rs:56`
  (`candidates` returns every pending post/comment system-wide per
  ranking request), `l1-standin/src/close.rs` `epochs_since(-1)` (whole
  history in memory on a mirror rebuild), `staged::list_for_actor`
  (acknowledged N+1). Bounded today by epoch cadence and slice-1 scale.
- **L-ST-7 — Unapproved sealed acts are never collected and seal checks no solvency**
  (`seal.rs` module doc acknowledges "unbounded"): any key-holder can
  seal unlimited 64 KiB payloads into `l1_acts` without paying θ; the
  API's prepare gate is the only guard. Acceptable for a throwaway
  substrate; note for the swap.
- **L-ST-8 — `allocate_seq` catch-up regex excludes 19-digit sequences**
  (`staged.rs:204`, `^[0-9]{1,18}$` while BIGINT reaches 19 digits).
  Unreachable in practice; use `{1,19}` with an explicit upper-bound
  guard.
- **L-ST-9 — `discard_pending_thread` deletes pending child comments whose own staged writes are still live**
  (`postgres-store/src/content.rs:614-645`); if such a child's record
  lands later, `land_promoted` re-inserts it as an orphan
  (`content.rs:314`). Consistent with the documented orphan rule, but
  worth a test.
- **L-ST-10 — `balance()` returns micro-units as `f64`**
  (`l1-standin/src/lib.rs:385`, `common::l1::handshake::AccountBalance`):
  exact only below 2^53 µ; `prepare.rs` compares in floating point. The
  seam type should carry integers before the swap.
- **L-ST-11 — Key-backup challenge consume and blob upload are separate statements**
  (`postgres-store/src/auth.rs:3081-3096, 3135-3150`); a crash between
  spends the challenge without storing the blob (benign: the client
  re-challenges). The store has no size bound on `blob` (the API
  enforces 4 KiB); a `CHECK (octet_length(blob) <= 4096)` would make the
  documented bound a schema fact.
- **L-ST-12 — Mixed clocks for expiry.** Rust `Utc::now()` writes
  `expires_at` (sessions, challenges) while reads compare against
  Postgres `now()` (`sessions_for`, `sweep_spent_secrets`). Correct when
  app and DB clocks agree; skew silently lengthens or shortens token
  lifetimes. Pick one clock per table (prefer DB `now()`).
- **L-ST-13 — Stale fuzz-target comment.**
  `crates/cogra-interchange/fuzz/fuzz_targets/cddl_parse.rs:6-9` still
  records an exponential-backtracking parse hang that
  `cddl/parse.rs:1440-1475` tests as fixed. Update the comment or deepen
  the test.
- **L-ST-14 — `approve()` short-circuits before verifying for non-`sealed` rows**
  (`seal.rs:317`): returns `Ok(())` for already-approved acts regardless
  of the witness and `UnknownAct` for a missing one — a status probe
  without a key. Acts are public, so informational.

#### Web app

- **L-WEB-1 — `/media/:path*` rewrites and the Caddy `/media` route do not normalise dot segments.**
  `web/next.config.ts:116-119` builds `${MEDIA_ORIGIN}/:path*` with the
  bucket in the origin; Next encodes `:path*` with `encodeURIComponent`,
  which leaves `.` alone, so `/media/%2e%2e/other-bucket/key` reaches
  MinIO as `/cogra-media/../other-bucket/key`. `deploy/proxy/Caddyfile:44-48`
  has the same shape (`path_regexp` matches the decoded path as-is).
  MinIO rejects `..` object-name components, so no working bypass was
  found; the guard is MinIO's, not ours. *Fix:* gate the Next rewrite on
  `NODE_ENV !== "production"`; add `not path_regexp \.\.(/|$)` to
  `@media_read` in Caddy; restrict the dev bucket policy.
- **L-WEB-2 — Vouch-ask id from the URL path is stored unvalidated and used to build the post-sign-in redirect.**
  `web/src/app/vouch/[id]/vouch-ask-view.tsx:134` (`holdAskLink(id)`),
  `held-link.ts:74-78` (`/vouch/${ask}`), `login-form.tsx:91`
  (`router.replace(afterSignIn())`). The `/vouch/` prefix prevents an
  off-origin redirect, but a crafted id containing `..`, `?` or `#`
  steers the fresh sign-in to an arbitrary same-origin route with
  attacker-chosen query (settings notices, `?compose=`). Contrast
  `extractInviteId` (UUID-validated). *Fix:* validate the ask id as a
  UUID before holding and before building the href.
- **L-WEB-3 — `scripts/prod.mjs` trusts the client `Host` and forwards hop-by-hop headers.**
  `:96-104` sets `host`/`x-forwarded-host` from `req.headers.host` and
  spreads all client headers (`connection`, `keep-alive`,
  `transfer-encoding`, `upgrade`, `forwarded`, `x-real-ip` pass through);
  `PORT=abc` → `listen(NaN)` throws (`:318, :361`). *Fix:* delete
  hop-by-hop and `forwarded`/`x-real-ip` headers, validate `PORT`,
  forward normalised `pathname + search`.
- **L-WEB-4 — 15-minute proxy timeouts** (`next.config.ts:42`,
  `prod.mjs:64`) on a LAN-exposed front are a connection-holding DoS
  vector; production must scope the long timeout to `/media/uploads`.
- **L-WEB-5 — Server-supplied `href` rendered without a scheme check.**
  `whats-new-view.tsx:158-161` renders `release.patchNotesUrl` as a link;
  reuse `websiteHref`'s http(s) filter (`profile-header.tsx:165-169`).
- **L-WEB-6 — Swallowed errors hide custody and draft faults.**
  `wizard-view.tsx:470` `.catch(() => {})` on `seals.settle(...)`,
  `:812` `drafts.save(state).catch(() => {})` after a failed seal (the
  author may end with neither seal nor draft and no message),
  `device-lock-keeper.tsx:36, 44` `.catch(() => undefined)` on
  `recover()`/`ensureHeld()`. *Fix:* route through a shared custody-fault
  snackbar, or at least `console.warn` with the cause.
- **L-WEB-7 — SSR metadata queries have no timeout.**
  `web/src/lib/apollo-client.ts:16` (`HttpLink` with Node fetch
  defaults); `generateMetadata` in `join/[linkId]/page.tsx:22-34`,
  `u/[handle]/page.tsx`, `topics/[name]/page.tsx` catches errors but a
  hanging API delays SSR for minutes. *Fix:*
  `fetchOptions: { signal: AbortSignal.timeout(3000) }`.
- **L-WEB-8 — `erase-everything.ts:47-60`** evaluates both storages as
  default params and iterates without `try/catch`; a browser throwing
  on `sessionStorage` alone skips the whole clear and leaves the refresh
  token behind. Guard each storage independently.
- **L-WEB-9 — `docs/implementation/web.md` "Media" contradicts `next.config.ts:71-73`**
  (`images.unoptimized` is app-wide, no `remotePatterns`). Update the doc.
- **L-WEB-10 — Unconditional `console.info/warn` in production paths**
  (`compress-video.ts:129-130, 163, 237`, `seen-queue.ts:180`). Nothing
  sensitive; gate on env.
- **L-WEB-11 — `committed-filter.ts:40`** parses `localStorage` JSON and
  reads `.topic`; confirm the parse is inside the same `try` as the read
  at `:54`.

#### Android app

- **L-AND-1 — One-shot capability tokens persist in navigation saved state.**
  `app/.../navigation/Routes.kt:201, 223` (`ChangeEmailLinked(token)`,
  `DeleteAccountConfirmed(token)`), `ShellScope.kt:143-146`
  (`heldEmailLink` via `rememberSaveable`). Single-use and requires
  device compromise, hence low. *Fix:* consume on landing into the
  ViewModel's `SavedStateHandle` and clear.
- **L-AND-2 — Exported `MainActivity` accepts crafted explicit intents.**
  `CograNavGraph.kt:253-268` handles `ACTION_MANAGE_SPACE` and any `VIEW`
  intent on the four link paths; host check holds (verified), impact is
  UI steering only. Optionally gate `ACTION_MANAGE_SPACE` on the caller.
- **L-AND-3 — `allowBackup="false"` without `dataExtractionRules`**
  (`app/src/main/AndroidManifest.xml:36-45`). Android 12 docs: some OEMs
  still run device-to-device transfer; ciphertext is Keystore-bound so
  unreadable, but it would trip the storage-loss dialog on the new
  phone. *Fix:* `res/xml/data_extraction_rules.xml` excluding
  `sharedpref`, `file` and `database`.
- **L-AND-4 — Tink's documented cleartext-keyset fallback if Keystore fails on first run (verify).**
  `core/network/.../store/EncryptedStore.kt:36-45`. *Fix:* after
  `build()`, verify the keyset is wrapped
  (`AndroidKeystoreKmsClient().hasKey(...)`) and refuse to seal secrets
  otherwise.
- **L-AND-5 — Loopback cleartext allowance and the `http://10.0.2.2` default reach release config**
  (`app/src/main/res/xml/network_security_config.xml:5-8`,
  `app/build.gradle.kts:30`). Move the cleartext `domain-config` to a
  debug source set (the `devCa` pattern exists) and fail a release build
  whose `graphqlUrl` is not `https://`.
- **L-AND-6 — OkHttp is only transitive and not in the version catalog**
  (`gradle/libs.versions.toml`), so a security bump cannot be expressed
  and Dependabot does not see it. Add it as a `constraints {}` entry.
- **L-AND-7 — Release build is unminified** (`app/build.gradle.kts:86-92`).
  Enable R8 with keep rules before a public release.
- **L-AND-8 — `runCatching` around suspend calls swallows `CancellationException`**
  (`core/network/.../repo/Media.kt:233-237`, `ChunkedUpload.kt:140`,
  `core/media/.../AndroidVideoProcessor.kt:80-85`,
  `MediaStoreMediaSource.kt:38-39`): cancelling the composer
  mid-transcode is logged as a failure and returns `null` instead of
  propagating cancellation. Rethrow `CancellationException`.
- **L-AND-9 — Full-size bitmap decode before downscale**
  (`AndroidMediaProcessor.kt:34-47, 61-66`): a 50 MP photo decodes to
  ~200 MB ARGB before the 1080 px downscale, and `aspectRatio()` reads
  the whole file for the header. Decode bounds first and use
  `inSampleSize`.
- **L-AND-10 — Refresh response's `user.id` is trusted over the stored account id**
  (`Auth.kt:220-227`); only reachable through a server contract break,
  but it would silently switch the custody slot. Treat a mismatch as a
  fault.
- **L-AND-11 — `InstantAdapter.kt:15` `nextString()!!`**; throw a
  readable `JsonDataException` instead.
- **L-AND-12 — Host public key cached for the process lifetime**
  (`RepositoryImpls.kt:248-256`); drop the cache on an invalid host seal
  and refetch once.
- **L-AND-13 — Apollo HTTP timeouts are implicit** (`NetworkModule.kt:119-124`,
  60 s defaults). Pass a `DefaultHttpEngine(timeoutMillis = …)` so the
  number is a stated, test-pinned decision.
- **L-AND-14 — Transcoded `upload-*.mp4` files are never deleted after a successful upload**
  (`AndroidVideoProcessor.kt:78` writes to `cacheDir`; deletion exists
  only on failure paths). Delete in the composer's discard/finally path
  or sweep at start.

#### Dependencies, deployment, CI

- **L-DEP-1 — Two TLS crypto providers and several duplicate majors are linked despite the Cargo.toml rationale.**
  `Cargo.toml:139-147` says the `object_store` `aws` feature was chosen
  so `ring` is not added beside `aws-lc-rs`; `Cargo.lock` has both
  (`ring` via sqlx `tls-rustls` and reqwest 0.12 `rustls-tls`;
  `aws-lc-rs` via object_store/reqwest 0.13 and lettre). Also two reqwest
  majors (0.12 direct, 0.13 via object_store), tower-http 0.6/0.7,
  digest 0.10/0.11 (the `dependabot.yml:85-87` comment that digest lines
  are unmixed is already untrue). *Fix:* sqlx `tls-rustls-aws-lc-rs`,
  reqwest `rustls-tls-webpki-roots-no-provider`, or move the workspace
  to reqwest 0.13.
- **L-DEP-2 — npm: 6 advisories (1 critical) in web devDependencies, none shipped.**
  `shell-quote` 1.10.0 (critical, GHSA-pqg4-j6r4-53mv) is used only by
  `@graphql-codegen/cli` lifecycle hooks, which `codegen.ts` does not
  define; `brace-expansion`, `js-yaml`, `source-map-js`, `vite`
  (dev-server advisories; Next uses Turbopack) and `zod` are build/test
  tooling over the repo's own inputs. None is in `dependencies` (only
  `@apollo/client`, `apollo-upload-client`, `graphql`, `mediabunny`,
  `next`, `react`, `react-dom`, `react-easy-crop`). All have fixes.
  *Fix:* `npm audit fix` or a few `overrides`; add an audit step (H4).
- **L-DEP-3 — Makefile echoes `DATABASE_URL` (with password) into terminals and CI logs**
  (`Makefile:75, 146, 149` pass `--database-url $(DATABASE_URL)` on the
  command line). `@`-prefix those recipes and let sqlx read the env.
- **L-DEP-4 — Build context admits `.env.*` variants**
  (`.containerignore:11` excludes `.env` only; `deploy/Containerfile.api:30`
  `COPY . .`). Use `.env*` as `deploy/web.containerignore:19` already does.
- **L-DEP-5 — Alerts go to a public ntfy topic** (`deploy/scripts/alert.sh:29-30`);
  documented; a self-hosted ntfy or an access token closes it.
- **L-DEP-6 — Containers: no `ReadOnly`, no CPU limits, no explicit log driver**
  (all `deploy/quadlet/*.container`). `LogDriver=journald` explicitly
  (the log alert depends on it), `ReadOnly=true` + `Tmpfs=/tmp` on
  api/web/ranker/proxy, `--cpus` on the API.
- **L-DEP-7 — `restore.sh` restores into the live database with `--clean`**
  (`deploy/scripts/restore.sh:58-60`): after a rollback across a
  migration, objects the dump does not know survive while
  `_sqlx_migrations` is reset, and the next forward deploy fails on
  `CREATE`. Terminate connections and `DROP`/`CREATE DATABASE`.
- **L-DEP-8 — The proxy unit has no `HealthCmd`**; a Caddy that fails to
  obtain a certificate still counts as started. Add a health route on
  the `:8081` site.
- **L-DEP-9 — `disk-watch.sh:23` runs `du -sb` over the whole live media volume every 15 min**;
  use `df` on the volume filesystem or run hourly.
- **L-CI-1 — No shell lint for the operator scripts** despite shellcheck
  directives in `lib.sh`; scripts are careful (`set -euo pipefail`,
  quoted variables). Add a SHA-pinned shellcheck step gated on
  `deploy/**` and `scripts/**`.
- **L-CI-2 — Dependabot coverage gaps:** no `docker` ecosystem for the
  Containerfile base images, no npm entry for `design/_build`, Quadlet
  image pins outside any ecosystem (can drift from compose).
- **L-CI-3 — The Rust image tag can drift from the toolchain pin**
  (`ci.yml:157-158` checks `rust-toolchain.toml` but
  `deploy/Containerfile.api:25` and `crates/ranker-server/Containerfile:11`
  repeat `rust:1.98.0-bookworm` by hand). Extend the grep.
- **L-CI-4 — Corpus linter: raw `str` byte slicing** (`scan.rs:685, 755, 959, 211, 217`)
  would surface a char-boundary panic on hostile Markdown as exit 101
  instead of the documented 2; the fuzz lane covers it but is manual.
  Run a short fuzz budget on a schedule or `catch_unwind` in `main`.
- **L-CI-5 — `npm ci` for web is npm-version dependent.** npm 10.9.4
  fails ("Missing: typescript@5.9.3 from lock file": `tsconfck`'s
  typescript `^5` peer under `vite-tsconfig-paths`, which npm 10
  resolves as a nested copy the lock does not record); npm 11 and
  npm 12.2.1 pass. CI and `Containerfile.web` use Node 24.18.0's bundled
  npm, so CI is reproducible, but a developer on Node 22 cannot
  reproduce it. *Fix:* `packageManager`/`engines` with
  `engine-strict=true` in `web/.npmrc`.
- **L-WEB-12 — `profile-posts.test.tsx:401` fails deterministically under Node 22.**
  `the_way_back_returns_to_the_posts_view_in_the_state_it_was_left`
  records two profile reads where one is expected when the profile is
  remounted from a held stream; the same commit is green in CI on
  Node 24. Either the test depends on a scheduling detail that differs
  between runtimes, or the second read is real and masked in CI. Worth a
  run on both runtimes before the next change to that view.

---

## Maintainability (brief)

- **Error conversion drift in the API.** 55 hand-written
  `map_err(|e| Error::new(e.to_string()))` sites plus bare `?` on store
  errors (M-API-1): one schema extension replaces all of them.
- **Three near-duplicate IndexedDB helpers in web** (`identity/store.ts`,
  `compose/draft-store.ts` + `draft-custody.ts`, `history/seen-record.ts`)
  with different commit semantics: `draft-store.ts`'s `run` resolves on
  `request.onsuccess`, not `transaction.oncomplete`, so a draft save can
  be reported written before it commits — the hazard
  `identity/store.ts:214-226` documents. A single `lib/idb.ts` fixes the
  inconsistency. Likewise ~10 guarded and 3 unguarded `localStorage`
  readers (M-WEB-2).
- **Android custody name constants are duplicated** between
  `IdentityStoreImpl` (`StoreImpls.kt:299-310`) and
  `LockCustodyStoreImpl` (`:217-233`); drift would silently split the
  custody set. One `internal object CustodyNames`. Also: a dead
  pre-API-26 branch in `MediaStoreMediaSource`, `VideoTrace.kt:92` gated
  on a library's own `BuildConfig.DEBUG` (the gate `CograApp` rejects
  for `CograLog`), the unbound debug `StanceStandInRepository`.
- **Two reviewers' comments assert behaviour the code lacks:**
  `web.md` "Media" (L-WEB-9), `part-uploader.test.ts:148` and
  `MediaUploadTest.kt:292-305` (M-WEB-1), `Cargo.toml:139-147` and
  `dependabot.yml:85-87` (L-DEP-1), the `cddl_parse` fuzz comment
  (L-ST-13).
- **Duplicate dependency majors** (L-DEP-1) add two TLS stacks, two
  reqwest and two tower-http lines to every build and audit surface.
- **`common::l1::encoding` predates `cogra-interchange`** and keeps its
  own recursive CBOR reader (L-ST-3); one decoder would remove the
  latent class entirely.

---

## Verified sound (so nobody re-derives it)

- **No committed secrets.** Keyword grep over the tree, `git log --all --diff-filter=A`
  for `.env`, `.pem`, `.key`, keystores: none ever added. `.gitignore`
  covers `.env`, `*.local`, `tmp_*`, the Android dev CA raw dir,
  `web/certificates`, `web/public/downloads`. The root vector JSON files
  are synthetic test material. `.env.example` values are documented dev
  defaults mirrored in compose and CI.
- **No dynamic SQL.** Every statement in `postgres-store` and
  `l1-standin` is a `sqlx::query!`/`query_as!` macro; search's
  `like_body` and `title_query` are escaped/quoted in
  `crates/api/src/search.rs:269-297` before reaching `to_tsquery`.
- **Authorization.** Every mutation the spec requires a viewer for uses
  `viewer()`/`member_viewer()`/`acting_viewer()`; every per-row verb binds
  the viewer in SQL (sessions, device locks, invite links, bookmarks,
  hidden actors, notifications, upload sessions, staged writes); relay
  legs check `w.actor_id == v.user_id`; edits, removals and attachments
  check authorship; `User` private fields are gated by `is_viewer`.
- **Tokens and crypto.** JWT algorithm pinned to EdDSA with `exp`
  required; refresh rotation in one transaction with a sealed-successor
  grace and reuse detection; login timing equalised with a dummy PHC
  string matching the live Argon2 parameters; all single-use tokens
  stored hashed and consumed by one conditional statement; Ed25519 via
  `verify_strict`; every hash length-framed and domain-tagged; key
  backup and device lock use random salt and nonce with the header as
  AAD; the web and Android implementations match the Rust golden
  vectors; web keys are non-extractable `CryptoKey`s.
- **Request hardening.** Batching refused, depth 15 / complexity 70 000,
  introspection and playground off in release (smoke-tested by
  `deploy.sh`), compression only on query responses (BREACH), `nodes`/
  `feed`/`markSeen` capped at 100, pagination cursors unique and
  validated.
- **Media pipeline.** No command or argument injection into ffmpeg;
  object keys and temp paths are UUID-derived; WebP decode limited to
  4096 px / 96 MiB with an allow-listed chunk walk; `mp4` checks table
  entry counts against box sizes; resumable part arithmetic exact and
  completion idempotent; two workers cannot both finish one job; the
  production media route sets `nosniff` and a `sandbox` CSP and serves
  GET/HEAD only.
- **Races checked and handled.** Registration (`FOR UPDATE` on the
  invite row), account-lock serialisation of approvals/staging/deletion,
  idempotent admission funding, double epoch close (exclusive table
  lock), two ingesters (cursor `FOR UPDATE` + `OutOfOrder`), token
  consume, reuse detection, ingest claim (`SKIP LOCKED` + lease), budget
  charges locked in sorted order.
- **Interchange and linter.** `cogra-interchange`'s decoder is iterative
  with capacity caps and refuses non-canonical input; CDDL parser and
  evaluator are depth- and budget-bounded; the corpus linter follows no
  symlinks (except configured roots, cycle-guarded), uses no regex, and
  maps every error to exit 2.
- **Deploy and CI.** Every GitHub Action SHA-pinned with least-privilege
  permissions and timeouts, no `pull_request_target`, no tolerated
  failures; podman secrets as env, env files 0600; single-instance
  migrations under sqlx's advisory lock; shutdown grace (20 s + 5 s)
  inside the unit's 30 s stop timeout; restic backup pairing and drill;
  `stamp-net.sh` fails safe. Android: dev CA confined to the debug
  variant via `<debug-overrides>`, only `MainActivity` exported, no
  WebView, `allowBackup=false`, no logging of secrets.

---

## Appendix A — `cargo audit` (advisory DB 2026-10-28)

| Crate (locked) | Advisory | Title | Fixed in | Reached by |
|---|---|---|---|---|
| rustls 0.23.37 | RUSTSEC-2026-0285 | TLS 1.3 handshake messages accepted across encryption-level boundaries | ≥0.23.45 | sqlx, reqwest ×2, lettre, tokio-rustls |
| rustls 0.23.37 | RUSTSEC-2026-0348 | Brotli certificate decompression can allocate up to 1 GiB before authentication | ≥0.23.46 | same |
| rustls 0.23.37 | RUSTSEC-2026-0346 | `Debug` impls for client session values expose TLS secrets | ≥0.23.46 | same |
| rustls 0.23.37 | RUSTSEC-2026-0349 | Unauthenticated ServerHello can downgrade later connections to classical key exchange | ≥0.23.46 | same |
| rustls-webpki 0.103.10 | RUSTSEC-2026-0382 | Certificate verification may accept distrusted intermediates | ≥0.103.16 | rustls |
| rustls-webpki 0.103.10 | RUSTSEC-2026-0098 / -0099 | Name constraints incorrectly accepted (URI names; wildcard names) | ≥0.103.12 | rustls |
| rustls-webpki 0.103.10 | RUSTSEC-2026-0104 | Reachable panic in CRL parsing | ≥0.103.13 | rustls |
| webpki-roots 1.0.6 | RUSTSEC-2026-0381 | Bundled roots allow trust in distrusted emSign intermediates | ≥1.0.10 | hyper-rustls, reqwest, sqlx |
| webpki-root-certs 1.0.9 | RUSTSEC-2026-0383 | same | ≥1.0.10 | lock only, not compiled |
| rsa 0.9.10 | RUSTSEC-2023-0071 | Marvin attack (timing side channel) | none | jsonwebtoken `rust_crypto`; RSA never configured |
| crypto-bigint 0.5.5 | RUSTSEC-2026-0387 | Timing variability in constant-time operations | ≥0.7.6 | jsonwebtoken → p256/p384; unused |
| quinn-proto 0.11.16 | RUSTSEC-2026-0338/-0339/-0340/-0341/-0342 | Remote panics and memory-exhaustion bypasses | ≥0.11.18 | lock only, not compiled on Linux |

Warnings: unsound `event-listener` 5.4.1 (RUSTSEC-2026-0221, via sqlx),
`lru` 0.16.4 (RUSTSEC-2026-0253, via async-graphql), `rand` 0.9.2
(RUSTSEC-2026-0097); yanked `chacha20` 0.10.1, `spin` 0.9.8.

## Appendix B — `npm audit` (web)

| Package | Severity | Advisory | Path | Shipped |
|---|---|---|---|---|
| shell-quote 1.10.0 | critical | GHSA-pqg4-j6r4-53mv command injection | `@graphql-codegen/cli` hooks | no |
| brace-expansion 1.1.18 / 5.0.9 / 5.0.12 | high | GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p (CPU DoS) | eslint, typescript-eslint, graphql-config via minimatch | no |
| js-yaml 4.3.1 | high | GHSA-2883-xcg3-v3hh | cosmiconfig, @eslint/eslintrc | no |
| source-map-js 1.2.1 | high | GHSA-68fv-2mgg-jv7q | postcss (build), jsdom | build-time only |
| vite 8.2.1 | high | GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg, launch-editor ×3 | vitest, @vitejs/plugin-react, msw | no |
| zod 4.4.3 | high | GHSA-mrhx-c7xc-m3w5 | eslint-plugin-react-hooks → zod-validation-error | no |

All six have `fixAvailable: true`.
