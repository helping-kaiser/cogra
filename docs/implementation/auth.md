# Authentication

Server-side credential management for CoGra. **Auth gates the
service, never the graph.** Reading needs nothing — the shared
graph is public, and a frontend can serve any actor's view of it
to any reader. A session lets a person *use CoGra*: stage an
application, prepare and relay their signed records, manage their
account. Whether a record can **land** is decided by L1's write
rule, not by any session fact — registration ≠ write standing, and
a logged-in member below the wall or out of capacity is a normal,
visible account state
([architecture.md "Write eligibility"](architecture.md#write-eligibility-and-account-states)).

This doc specifies what auth does. Concrete library choices and
endpoint shapes belong with the implementation.

---

## Scope

In scope:

- Account lifecycle (applicant staging via invite links, the
  device key ceremony, approval, landing, deletion handoff).
- Credentials (password storage, reset, and change; email change).
- Session tokens (JWT access + Postgres-backed refresh).
- Session listing and revocation.
- Rate limiting on auth endpoints.
- Key-recovery backup — storing client-encrypted signing-key
  blobs the server cannot decrypt (see "Key recovery").
- The custody stores for the documented exceptions: the backend's
  co-signing halves for Collective members
  ([collectives.md §2](../instances/collectives.md#2-custody)) and
  the system actors' keys, which are backend-custodied by design
  ([substrate.md §8](../primitive/substrate.md#8-system-actors)).

Out of scope:

- **Federated identity.** Reconciling identities across instances
  is [open-questions.md Q15](../open-questions.md).
- **OIDC provider role.** CoGra is not an identity provider for
  third-party apps. The token model below is the OAuth2
  resource-server shape, which leaves room to add OIDC client
  support (e.g. "log in with Google") later but does not commit
  to issuing identity tokens for other apps.
- **Miner delegation.** Delegating feed ranking to a miner
  involves no server-side credential: the viewer pushes inputs
  per request and revokes by ceasing to call
  ([miner-api.md](miner-api.md)). Nothing for auth to manage.
- **End-to-end content encryption.** Chat E2EE keys are managed
  client-side per [chats.md](../instances/chats.md); the server
  never holds them.
- **MFA.** Not in v1. See "MFA" below.

---

## Server-stored credentials vs. user-owned keys

The server stores **password hashes** — credentials it can
verify but not reverse — and, for accounts that opt into key
backup, **client-encrypted key blobs** it cannot decrypt (see
"Key recovery"). Neither puts a user-owned secret in CoGra's
hands: the signing key itself is client-held
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission))
and never enters custody.

---

## Key recovery

What recovery recovers splits in two, and the split is the
posture:

- **Email recovery restores the login** — the server-side
  account and its sessions. It never restores the actor: the
  signing key, and with it the actor's L1 standing and funded
  L0 address, is client-held and CoGra cannot reissue it.
- **The recovery code restores the actor.** At key creation the
  app generates a high-entropy recovery code alongside the
  signing key, encrypts the key with the code on the device,
  and uploads only the ciphertext. Recovery on a new device is
  login plus code: fetch the blob, decrypt locally. The same
  flow is how an actor reaches a second device — key mobility
  and loss recovery are one mechanism.

Rules the posture hangs on:

- **Generated codes only, never a user-chosen passphrase.** A
  memorable passphrase over a stored blob is offline-crackable
  the day the ciphertext leaks; a generated ~128-bit code is
  not. Systems that accept passphrases can do so only because
  guess-limiting secure hardware fronts the store —
  infrastructure this posture deliberately avoids depending on.
- **The backup is opt-in, and declining has a stated price.**
  Device loss is then actor loss — the login survives, the
  actor is a husk. The choice and its consequence are surfaced
  when the key is created. Declining is not final: backup can
  be enabled, or the code replaced, from settings at any time —
  a new code re-encrypts and re-uploads, and recovery serves
  the newest blob.
- **Theft needs both factors.** The code alone is useless
  without the blob behind the user's login; the blob is useless
  without the code. Users can therefore keep redundant copies
  of the code — redundancy against loss is safe in a way copies
  of a raw key never are.
- **The blob is a container.** Further client-held secrets — a
  Collective creator's key, a member's co-signing half
  ([collectives.md §2](../instances/collectives.md#2-custody)) —
  ride the same code. A passkey-wrapped second unlock (WebAuthn
  PRF) is a foreseen extension, not a posture change.

### Blob format (v1)

One format across every client — a blob sealed on the phone must
open in the browser. The primitives are the ones every client
platform ships natively (WebCrypto, Android Keystore/Tink):

- **Recovery code.** 16 CSPRNG bytes, shown as 26 Crockford
  base32 characters in dash-separated groups of 5-5-5-5-6.
  Input is normalized before decoding: uppercase, `I`/`L` → `1`,
  `O` → `0`, separators stripped. No check digit — AES-GCM's
  tag is what detects a mistyped code, at unlock.
- **Key derivation.** HKDF-SHA-256 over the 16 code bytes with
  the blob's random 16-byte salt and info `cogra:key-backup:v1`
  yields the 32-byte content key. The code is full-entropy, so
  a memory-hard KDF would add cost without strength.
- **Sealing.** AES-256-GCM under a random 12-byte nonce. The
  blob is `version 0x01 ‖ salt ‖ nonce ‖ ciphertext`; the 29
  header bytes ride as the associated data, so no part of the
  blob is malleable.
- **Contents.** The plaintext is the deterministic-CBOR array
  `[seed bytes, container version 1]` — today the actor key's
  32-byte Ed25519 seed. Future client-held secrets (the
  Collective splits) extend the array — "the blob is a
  container", concretely.
- **Wire form.** The blob crosses the API base64-encoded — into
  `uploadKeyBackup`, out of `User.keyBackup`.

Golden vectors for every step live in
`client-crypto-vectors.json` at the repo root, exported from the
reference implementation in `common` (`make vectors`); each
client's crypto tests consume them.

---

## Account lifecycle

Every member arrives through the staged-applicant flow of
[invitations.md §4](../primitive/invitations.md#4-invite-links-staged-applicants-explicit-approval):
a link stages, the inviter's approval is the priced act, the
joiner's own signature grounds the actor. The genesis member is
the exception: it is seeded around the L1 genesis sequence by the
bootstrap binary
([network.md §2](../primitive/network.md#2-creation)) and never
passes through the flows below.

### Invite-link generation (inviter side)

When an authenticated actor generates an invite link, the server
writes one `auth_invite_links` row
([data-model.md](data-model.md)) carrying the inviter's identity,
their **pre-filled** stance values, and the link's expiry. The
link URL carries only the row id. Nothing binds at this point:
the values are a suggestion the inviter can adjust at approval,
and the approval itself is the priced act. Links are time-gated
and, at the inviter's choice, single-use (one applicant slot) or
multi-use (many applicants until expiry); the inviter can revoke
a link at any time.

### Link URLs

Every emailed or shared link is a web URL on the per-environment
web origin — the web app serves everyone the native apps don't
reach, and one URL opens the app where one is installed
(Android App Links on the same paths):

- Invite: `https://<web-origin>/join/<link-id>`
- Email verification: `https://<web-origin>/verify?token=<token>`
- Password reset: `https://<web-origin>/reset?token=<token>`

Native apps also accept the pasted link or bare token directly —
the universal fallback when link verification is unavailable (and
the dev path: the dev mailer logs the bare token, and composing
full URLs into mail bodies arrives with the web pages that answer
them).

### Application (the staged state)

1. **Link open.** The applicant opens the URL in the app. The
   app validates the capability through the anonymous
   `inviteLinkCheck` query — usability (unexpired, not revoked,
   slot available) plus the inviter's handle, so an unusable link
   refuses before the form and the key ceremony, and the form can
   show who is vouching.
2. **Registration submit.** The applicant chooses handle,
   email, and password. The server creates an `auth_applicants`
   row — off-graph service state only, no account, nothing on
   the graph — sends a verification email, and returns the
   **applicant token**: the hashed-at-rest secret that authorizes
   exactly this applicant's own flow (status, registration
   signing, the first-session claim). The row id is visible to
   the inviter's queue and is deliberately not a capability.
3. **The key ceremony, on the device.** The app generates the
   applicant's signing key and L0 address locally; the public
   key and address join the applicant row. This runs at
   application time because approval funds a burn **to the
   applicant's own address** — the address must exist before
   anyone can fund it. In the same step the app offers the
   key-backup choice: generate the recovery code and seal the
   blob on the device — or decline, with the consequence stated
   ("Key recovery" above). The sealed blob waits on the device
   and uploads on the first session after landing: the backup
   store hangs off the landed account, and before landing there
   is no actor to lose.
4. **Email verification.** The applicant clicks the link,
   proving the login channel. Unverified applications expire
   after 24 hours (reaper below); verification re-bounds the
   application's life to its link's expiry — a verified applicant
   persists exactly while the link lives.

A staged applicant can already **read** — the shared graph is
public — but cannot act. Approval latency is a UX cost, not a
correctness problem.

### Approval and landing

The inviter approves per applicant or in batches, adjusting the
pre-filled stance values if they choose. Approval is the
deliberate, priced act that commits the inviter's vouch; the
backend then runs the admission sequence:

1. **Funding** — the community-funded L0 burn to the applicant's
   address ([economics.md](../primitive/economics.md)). Funding and
   the staging below run inside the approval, guarded by the
   approval mark so a retried or concurrent approval never
   double-funds; a crash between the steps heals on the
   applicant's next status poll.
2. **Registration** — the backend prepares the staged
   Registration; the applicant's device **runs the full signing
   handshake on next app open** — pre-commitment, then approval
   over the host-sealed verified act: one ceremony, two
   signatures (the backend cannot sign for anyone —
   [substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission));
   the backend relays each step and the record lands.
3. **The inviter's Opinion** toward the new Profile — prepared
   for the inviter, signed on their device, relayed.
4. **Landing** — when the Registration confirms in the mirror,
   the actor row and its login credentials are created (moved
   across from the applicant row; the identity association is
   columns on the actor row — [data-model.md](data-model.md)) and
   the applicant row is marked landed; the device then claims the
   first session with its applicant token.

The flow tolerates latency at every step — an approval the
applicant's device hasn't signed yet simply waits; staged records
that never land are garbage-collected per the write path
([architecture.md](architecture.md#the-write-path)).

**Reciprocation is the joiner's own act.** Membership completes
when the joiner points back — their own client-signed Opinion
toward the inviter's Profile, prompted at first login
([invitations.md §2](../primitive/invitations.md#2-the-mutual-pair-relation)).
The prompt's target comes from the viewer-only `User.invitedBy`
field — landing provenance kept on the applicant row. It is a
graph act, not an auth step; auth's involvement ends at landing.

**Reaper.** A periodic background job deletes expired
`auth_applicants` rows (email never verified within 24 h, or the
link's lifetime ended without approval). The reaper is the normal
cleanup path; it does not run as part of any user-facing request.

**Re-registration collision.** A UNIQUE constraint on `email` in
`auth_applicants` prevents two live applications for the same
address. If the existing row is still live, the submit is
rejected and the API surfaces "application in progress — check
your email"; if it is expired but not yet swept, the submit
overwrites it (`ON CONFLICT (email) DO UPDATE ... WHERE
expires_at < NOW()`), so the experience never depends on the
sweep schedule. The constraint and conflict handling live with
the schema in [data-model.md](data-model.md).

**Why nothing exists before approval:** the primitive forbids a
partial member — there is no "pending" actor state on the graph,
and the no-User-before-verification invariant survives as CoGra's
L2 rule ([user.md §2](../primitive/user.md#2-creation)). An
applicant is exactly one off-graph row; abandoning it leaves no
trace beyond itself.

### Self-service deletion (handoff out)

User-initiated deletion is governed by
[erasure.md](../instances/erasure.md). Auth's
contribution:

- The deletion confirmation email goes to the verified address on
  file.
- The user can cancel from any authenticated session during the
  7-day grace window.
- When deletion completes, all of the account's refresh tokens
  are revoked. Any outstanding access tokens age out within their
  normal TTL.

---

## Credentials

### Password storage

Passwords are hashed with **Argon2id** using current
OWASP-recommended parameters (re-evaluated periodically as
recommendations evolve). Plaintext is never persisted, never
logged, and never returned by the API.

### Password requirements

- Minimum 12 characters; no maximum.
- No composition rules (forced uppercase / digit / symbol).
  Composition rules reduce entropy by predictable means without
  improving real strength.
- Checked against a known-breach corpus (haveibeenpwned-style
  hash-prefix lookup) at registration and password change.
  Breached passwords are rejected with a message indicating why.

### Handle and email format

Both are validated and normalized at application submit before
any store write; a failure surfaces as a `BAD_INPUT` userError
pinned to the offending field (`handle` / `email`).

- **Handle.** 3–30 characters, `[a-z0-9_]` (lowercase letters,
  digits, underscore). The handle is **case-folded to lowercase**
  on registration: `actors.handle` is UNIQUE case-sensitively in
  Postgres — one namespace across users, Collectives, and system
  actors, so a mention resolves to exactly one actor — but
  mentions and search resolve handles case-insensitively, so
  folding is what keeps `@alice` a single
  account rather than admitting a distinct `Alice`. The charset
  excludes `-`, which leaves the `redacted-user-{uuid}` redaction
  sentinel ([api-spec.md](api-spec.md)) unreachable by any real
  registration.
- **Email.** Trimmed and **lowercased** to a canonical form used
  for both the stored `user_credentials.email` and the login
  lookup, so the
  case-sensitive UNIQUE constraint behaves case-insensitively. The
  shape check is lenient (one `@`, a non-empty local part, a
  dotted domain, ≤254 chars) — not full RFC 5322; the
  verification email is the authoritative proof the address is
  deliverable.

### Password reset

1. User submits their email at the reset endpoint. The server
   responds success **regardless of whether the email exists** —
   no account enumeration via this endpoint.
2. If an account exists for that email, the server generates a
   single-use, short-lived (default 15 min) reset token and
   emails it as a link.
3. The user clicks the link, submits a new password (subject to
   the requirements above). The server validates the token,
   rotates the password hash, and revokes all existing refresh
   tokens for the account — password change is a security event.

**Email is the sole *login*-recovery channel in v1.** Reset and
email change both route through the verified address, so an
account whose owner has lost email access has no self-service
path back to the login until single-use recovery codes land with
MFA (below). This is the accepted floor — the same trade-off that
keeps MFA out of v1 — not an oversight. The **actor** is a
separate matter with its own channel: the recovery code ("Key
recovery" above), independent of email entirely.

### Password change

A logged-in user changes their password by submitting the current
password alongside the new one. An authenticated session is not enough
on its own — the gesture re-proves the credential: the server
re-verifies the current hash, applies the breach check, rotates the
hash, and revokes the account's *other* refresh tokens. The same
security-event handling as a reset, minus the email round-trip.

### Email change

The email is set at registration and verified once; changing it is a
two-sided proof, since the address is the account's sole
login-recovery channel.

1. The user submits the new address and re-enters the current
   password. The server sends a single-use, short-lived code to the
   **current (original)** address — proving control of the account as
   it stands — and a verification link to the **new** address —
   proving it is reachable.
2. The change applies only once **both** are satisfied: the
   original-address code is submitted and the new address has been
   verified via its link. Until then the account email is unchanged.
3. On success the new address becomes the verified email; reset and
   notifications follow it from that point.

The two-sided proof is deliberate: the original-address code blocks a
hijacker holding only a live session from redirecting recovery, and
the new-address verification blocks a typo from silently stranding the
account on an address no one can reach.

---

## Tokens

Two token types per session: a stateless access token and a
stateful refresh token. The split is the standard 2024-era
pattern; rationale for this project below.

### Access token

- **Format.** JWT, signed by the server's own session-signing key
  (Ed25519 recommended for size and verification cost). This key
  is CoGra service infrastructure — it signs sessions, nothing
  else, and has no relationship to any actor's L1 signing key.
- **Claims.** `sub` (account UUID), `iat`, `exp`, `jti` binding to
  the issuing refresh token. No role claims — authorization that
  depends on `network_role` (per
  [network.md](../primitive/network.md)) reads the live value
  from the role-mark cache at the action site.
- **Lifetime.** 15 minutes (default).
- **Transport.** `Authorization: Bearer <token>` HTTP header on
  every authenticated GraphQL request, validated in Axum
  middleware before reaching resolvers.
- **Revocation.** Not directly revocable within its TTL. Achieved
  through short lifetime + refresh-token revocation: a revoked
  session cannot mint a new access token once the current one
  expires.

### Refresh token

- **Format.** Opaque, cryptographically-random 256-bit value.
  *Not* a JWT.
- **Storage.** Postgres `auth_refresh_tokens` table. The raw
  token is never persisted — only its SHA-256 hash, so a
  database read does not yield usable tokens.
- **Row shape.** `id`, `user_id`, `token_hash`, `created_at`,
  `last_used_at`, `expires_at`, `device_label` (short
  user-readable string for the session list, e.g. derived from
  User-Agent), `revoked_at` (nullable).
- **Lifetime.** 30 days (default), sliding — each successful use
  extends `expires_at` by 30 days from the use time. Inactive
  sessions age out.
- **Rotation.** Every successful refresh consumes the current
  token (sets `revoked_at`) and issues a new one. The client
  must replace its stored refresh token on every refresh. This
  bounds the exposure of a stolen refresh token to a single
  use.
- **Reuse detection.** If a refresh token marked `revoked_at` is
  presented — i.e. someone tried to use a token that was already
  rotated — the server revokes **all** of that user's refresh
  tokens and surfaces a security event on next login. Standard
  refresh-rotation hygiene; signals likely token theft.

### Why split formats

JWT access tokens are stateless and cheap to validate per
request — no database round-trip for read-only authorization.
Opaque refresh tokens are stateful so they can be explicitly
revoked. Refresh requests are infrequent (every ~15 minutes per
active session), so the database round-trip cost is acceptable.

---

## Sessions

A "session" is a row in `auth_refresh_tokens`. The authenticated
user can:

- **List active sessions** — each row's `device_label`,
  `created_at`, `last_used_at`, plus a flag identifying the
  current session.
- **Revoke one session** — sets `revoked_at` on the chosen row.
  The associated access token cannot be invalidated mid-TTL but
  cannot be refreshed past expiry.
- **Revoke all other sessions** — convenience after suspected
  compromise.

Server-initiated revocations:

- Password change → revoke all others (the changing session
  survives; see "Password change").
- Password reset → revoke all.
- Account-deletion completion → revoke all.
- Refresh-token reuse detected → revoke all.

A revoked session says nothing about the actor: the signing key
lives on the device, and no session state can author, block, or
revoke a record.

---

## Rate limiting

Per-IP and per-account limits on auth endpoints to bound
credential stuffing, application spam, and reset abuse. The
spec commits to *which* endpoints are limited; specific
thresholds are an implementation choice.

- Login attempts — limited per IP and per account, with
  exponential backoff on consecutive failures.
- Application submits — limited per IP and per invite link.
- Password-reset requests — limited per IP and per account.
- Verification-email resend — limited per applicant row.

Abuse mitigation lives at the API edge, not in the graph primitives — same
framing as [moderation.md](../instances/moderation.md).

---

## MFA

Not in v1. The single-channel email-recovery model is the
standard floor for a community network and avoids the support
burden of TOTP / WebAuthn / recovery-code mechanics during early
operations.

No schema reservation: `user_credentials` carries no MFA column today.
When MFA lands, a normal column-add migration covers existing rows with
`NULL` (the "not enrolled" state).

When MFA is added, the natural shape is **TOTP as the second factor with a
WebAuthn upgrade path**, plus single-use recovery codes (stored hashed)
issued at enrollment. MFA becomes a User-level setting; sessions issued
post-MFA-success carry an `mfa: true` claim that high-stakes mutations
(e.g. the [erasure.md](../instances/erasure.md)
confirmation, role changes per [network.md](../primitive/network.md)) can
require.

---

## Cross-references

- [substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission) —
  the client-signed, backend-relayed authoring path this doc's key
  story serves.
- [architecture.md](architecture.md) — the write path, staged
  writes, and the write-eligibility account states.
- [invitations.md](../primitive/invitations.md) — the
  staged-applicant admission flow and the mutual-pair relation.
- [collectives.md §2](../instances/collectives.md#2-custody) —
  Collective custody: creator-held key, per-member 2-of-2
  co-signing halves.
- [erasure.md](../instances/erasure.md) —
  consumes session listing and email verification.
- [network.md](../primitive/network.md) — the genesis sequence
  that seeds the operator account; `network_role` read at action
  time.
- [api-spec.md](api-spec.md) — the GraphQL auth & account
  mutations that consume the flows specified here.
- [open-questions.md Q15](../open-questions.md) — federation
  reconciliation.
