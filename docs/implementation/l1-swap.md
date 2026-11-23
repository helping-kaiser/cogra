# The Layer 1 Swap · `plan:implementation:l1-swap`

CoGra runs on the L1 stand-in until PeerNetworks Layer 1 exists, and
then replaces the stand-in with it
([roadmap.md "The stand-in and the swap"](roadmap.md#the-stand-in-and-the-swap)).
This document prepares that move without building each specification
release into the stand-in. It says what is already in place, what
changes in which part of CoGra, in what order, and what is still
unknown. Layer 1's side is
[layer1-interface.md](../primitive/layer1-interface.md), whose classes
this document keeps: **closure** binds every epoch, **oracle** binds
only under a case the epoch package declares, **courtesy** binds only
a realization that claims that standard. An item marked *open* is
either an [open-questions.md](../open-questions.md) entry or a
decision the network's deployment has not made. The L1 team answered
CoGra's questions on 2026-11-23; where an answer is the L1 author's
reading rather than the specification's text, this document says so.
§5 lists every open item.

---

## 1 What the swap is

**What is replaced.** The host behind the seam: the `l1-standin`
crate, its `l1_*` tables, the `StandInBoundary` implementation of the
`L1Boundary` trait (`crates/api/src/l1.rs`), and the stand-in-only
surfaces of `l1_standin::DevSubstrate` (§2.2). The real Layer 1 host
seals, orders, closes epochs and publishes; the realization of the
burn primitive beneath it holds the money.

**What is not replaced.** Everything that speaks only to the trait:
prepare, the relay legs, ingestion and the record mirror, carriage,
display content, the overlay folds, the media service and the CGT
rail ([ledger.md](ledger.md) — a chain of CoGra's own, never a Layer 1
surface).

**What moves anyway.** The trait is not the whole of CoGra's Layer 1
assumptions. Three things outside it are the stand-in's realization
choices and are shared by the server and both clients:

- The cryptographic realization in `crates/common/src/l1/`: Ed25519,
  SHA-256 tagged hashes under `cogra-l1:*` domain tags, deterministic
  CBOR (`crypto.rs`, `encoding.rs`, `proposal/mod.rs`), mirrored in
  `web/src/lib/crypto/` and `android/core/crypto/` and pinned by
  `client-crypto-vectors.json`. The module itself calls it "scoped to
  the stand-in" (`crypto.rs:3-5`;
  [open-questions.md Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation)).
- The address an actor has: hex of the first 20 bytes of SHA-256 of
  the public key, "a stand-in convention" (`crypto.rs:129-135`).
- The identifier text form (`act:<author>:<seq>:<family>` and the
  node terms), which every CoGra table keys on verbatim
  (`identifier.rs:12-14`; [data-model.md "The record mirror"](data-model.md#the-record-mirror)).

So the swap is a new implementation of the trait, an answer for each
stand-in-only surface, and a re-pinning of these realization choices
to whatever the network declares.

**What "ready" means.** CoGra is ready to swap when: every open item
in §5 that blocks an area has an answer; the network's declared
editions are known (handshake, encodings, signature scheme, address
format, case declarations, marker policy); and the checklist in §4.1
is done, so that the swap itself is §4.2 alone.

---

## 2 The seam today

### 2.1 The operations of the boundary

The trait in `crates/api/src/l1.rs:71-151` is the whole request-path
seam ([architecture.md §5](architecture.md#5-the-seam-is-one-boundary)).

| Operation | What it does | Behind it on the stand-in | At the swap |
|---|---|---|---|
| `seal(Submission)` | Relay leg 1: body, dependency list and dependency nonce, content pre-digest, pre-commitment and pre-signature, plus the author's public key; never the content pair. Returns the sealed verified act with both host salts. | Formation against the census, dependency bounds, the address check (§3.1), pre-commitment recomputation, salts, seal; stores the row (`seal.rs:94-221`). | The network's admission endpoint in its declared transcript (§3.2). |
| `approve(ApprovalWitness)` | Relay leg 2: the act becomes orderable. | Verifies the witness under the key stored at sealing (`seal.rs:297-349`). | Same, to the network. |
| `epochs_since(after)` | Every published epoch after the cursor, in order — ingestion's only input. | Reads its own `l1_epochs`/`l1_acts` (`close.rs:854`). | The network's published packages, mapped into CoGra's types (§3.3). |
| `balance(address)` | B_i, the residual balance b_i and the action count N_i, in micro-units. | `l1_accounts`, numbers only. | B_i from the realization's settled snapshot, b_i and N_i from the final ledger (§3.6). |
| `host_public_key()` | The key clients verify seals under (served as `Query.hostPublicKey`). | A seed minted on first use in `l1_host`. | The network host's key; how it is published and rotated is the network's (§3.10). |
| `current_theta()` | The θ the next close charges — the prepare pre-check's price. | The wall controller's burn image (`close.rs:592`). | The network's published schedule (§3.6). |
| `max_payload_bytes()` | M_payload, read by prepare and the carriage checks. | `StandInConfig::max_payload_bytes`, 64 KiB by default. | The network's published constant. |
| `request_admission_burn(address, amount, key)` | The admission fund's burn to an address, idempotent by key. | Records the burn, settles after `settlement_delay_epochs`. | A burn on the realization, which is not a Layer 1 write (§3.6). |
| `burn_settlement(ticket)` | Pending, Settled or Failed. | Pending or Settled. | The realization's settlement read. |
| `drop_carriage(act_ids)` | Drops the content salt the host still holds for acts that never reached acceptance. | Nulls `l1_acts.content_salt`. | "It leaves at the swap" (`l1.rs:146`): the real host's retention of its own blinding values is not CoGra's to direct (§3.4). |

The trait's error type keeps contract meanings — formation,
authentication, conflict, unknown act, substrate — which the relay
maps to client codes (`relay.rs:249-260`). A new implementation maps
the network's refusals onto the same five.

### 2.2 What is not the seam

`crates/l1-standin/src/lib.rs:562-597` names what CoGra uses that the
real Layer 1 will not offer:

- **`credit_burn`** — a settled burn credited at once. The genesis
  bootstrap funds its cast with it (`crates/api/src/bootstrap.rs:281`).
  At the swap the cast is funded through `request_admission_burn` and
  waits for settlement like any admission.
- **`close_epoch` and `close_loop`** — the stand-in's epoch clock
  (`L1_EPOCH_CLOSE_INTERVAL_SECS`, spawned in `crates/api/src/main.rs`).
  The bootstrap closes an epoch itself to land the genesis acts
  (`bootstrap.rs:386`). At the swap the network closes; the bootstrap
  waits for the epoch that carries its acts.
- **`sealed_act`** — reads back a sealed act so an interrupted
  bootstrap resumes (`bootstrap.rs:564`). At the swap the bootstrap
  resumes from what the network publishes and what CoGra keeps
  (`genesis_handshake_nonces`), or from a read the network offers.

Further stand-in-only surfaces outside that list:

- **The concrete type.** The GraphQL schema holds `StandInBoundary`
  as its context data, not a type generic over the trait: 28
  references across `schema/mod.rs`, `schema/mutation.rs`,
  `schema/query.rs`, `schema/types.rs`, `bootstrap.rs`, `main.rs` and
  `l1.rs`. The swap replaces each, or the schema is made generic over
  `L1Boundary` first (§4.1).
- **The dev CLI** `crates/api/src/bin/l1-dev.rs` drives the stand-in
  directly (keygen, burn, submit, close, ingest, rebuild).
- **Tests.** 31 test files in `crates/api/tests` and 5 in
  `crates/l1-standin/tests` run against the stand-in. After the swap
  they need a substrate to run against; what that is depends on what
  the network offers for testing (*open*, §5).
- **The migration timeline.** The `l1_*` tables are dropped at the
  swap, but their migrations stay: an applied migration is never
  edited, and `20260820000002_license_float_model.sql` reads `l1_acts`
  to backfill CoGra state, so the swap's own migration drops the
  tables (`close.rs:51-61`).
- **Backups.** On the stand-in the published sequence and the host
  seed live in Postgres, so a dump is the substrate's only copy
  ([deployment.md "Backups"](deployment.md#backups)). Against the
  network, "no backup of the mirror is meaningful" holds.

---

## 3 Area by area

Each area gives what Layer 1 requires, what CoGra does today, what
changes at the swap in the server, web and Android, and what is open.

### 3.1 Identity and who may sign for an Actor

**Layer 1 requires.** The closure checks that each recorded proposal
and approval signature is well-formed under the public key the record
maps to it, over bytes that include the stated author and act
identifier (``itm:graph:act-authentication-requirements-signature-verification``,
[§8.2](../primitive/layer1-interface.md#82-the-write-dependencies-and-the-admission-handshake)).
No closure check relates a key to the Actor: with no author-authority
case bound, an act is eligible whichever keys signed it, and its debit,
standing, title and settlement follow the recorded author
(``post:graph:act-authentication-requirements``, closure). Deciding
which keys may speak for an Actor is the deployment's concern and
imposes no closure condition
(``rem:graph:authentication-realization-out-of-scope``): a host may
refuse to seal a proposal under the deployment's own key rule without
declaring a case, but without a case no recorded act is rejected on
key-authority grounds. A
deployment may instead declare an author-authority case naming a
second party, its rules edition and a projection, with proof objects
per act (``def:deployment:declared-author-authority-case``, oracle,
[§13.3](../primitive/layer1-interface.md#133-the-replay-floor-and-the-declared-cases)).
An Actor's address is the frame binding into the burn map — opaque,
permanent for the life of the graph, and not a signing key
(``def:comparator:frame-binding``, R5,
[§1.1](../primitive/layer1-interface.md#11-the-burn-interface-and-requirements-r1r11)).

**CoGra today.** Address, author atom and signing key coincide: the
address is computed from the Ed25519 key (`crypto.rs:129-135`). The
tie is checked in five places:

- the stand-in refuses to seal a proposal whose key does not give the
  stated author (`seal.rs:147-153`);
- the shared submission check does the same (`proposal/mod.rs:332-337`);
- the stand-in verifies the approval under the key stored at sealing
  (`seal.rs:327-337`), and the relay does so before holding a witness
  (`relay.rs:329-352`);
- the key ceremony refuses an address the key does not give
  (`crates/api/src/onboarding.rs:377-387`);
- `actors.actor_pubkey` and `actors.realization_address` are each
  unique, "key and address are 1:1"
  ([data-model.md](data-model.md), the `actors` table).

The address is also what the admission burn funds (auth.md
"Application" step 3), what key export lets a holder act as "even if
CoGra disappears" ([auth.md "Key export"](auth.md#key-export)), and the
author component of every act identifier CoGra stores.

**At the swap.**

- *Server.* Where the key ↔ address rule lives becomes explicit: kept
  as an admission rule at the relay or the host, which needs no case,
  declared as a case, or dropped (*open*). If the network's address is not a function of the
  Ed25519 key — an address on the realization, for instance — then
  `address_of`, the ceremony's check, the uniqueness pair and every
  identifier carrying an address change together, and the accounts
  and device keys CoGra holds need a migration (*open*).
- *Web and Android.* `addressOf` in `web/src/lib/crypto/hashing.ts:239`
  and `android/core/crypto/.../Hashing.kt:128` derive the address on
  the device for the ceremony; they follow the server's rule. Key
  custody, backup blobs and export carry an Ed25519 seed; another
  scheme changes all three (Q30).

**Open.** Where the key ↔ address rule lives, what the network's
address is, and how existing accounts move: [Q68](../open-questions.md#q68--key-authority-and-the-actor-address-at-the-swap).
The L1 team confirmed (2026-11-23) that the closure alone accepts an
act signed by any well-formed key and that a host may refuse at
sealing without a case ("Layer 1 requires" above). The L1
author reads that a deployment may be its own second party, its
key-derivation rule needing no outside data; any declared case still
pins a proof object for every act
(``post:deployment:pinned-author-authority-proof-objects``). The
network has no deployment of record yet: which case it declares is
undecided, and what an Actor's address is on it is unanswered.
Signature scheme and key
rotation: [Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation).

### 3.2 The handshake the clients speak

**Layer 1 requires.** The closure states the handshake's properties:
a signed pre-commitment, a host-sealed verified act naming each
commitment's formation edition, and an approval witness over that
exact act; only an approved verified act is orderable
([§8.2](../primitive/layer1-interface.md#82-the-write-dependencies-and-the-admission-handshake)).
The concrete transcript is a courtesy standard
(``def:graph:courtesy-handshake``): its body carries an opaque signed
extension with the initial requested publication intent, its tags are
`PN-*`, and an adopter of the intent vocabulary owes receipts, signed
later requests, the one-receipt retry and the sequence origin
(``def:graph:requested-publication-intent``, courtesy).

**CoGra today.** The clients speak a transcript with the courtesy
standard's structure and CoGra's own bytes:

- the body is a nine-element CBOR array closing on a schema version,
  with no extension slot (`crates/common/src/l1/handshake.rs:60-85`);
- the pre-commitment hashes the encoded body and both pre-digests
  under `cogra-l1:pre-commitment:v2`; the content and dependency
  editions are 2 (`proposal/mod.rs:43-60`);
- the seal and the approval cover the eight-element encoded verified
  act (`handshake.rs:185-204`);
- the tags live in `crypto.rs:14-32`, `proposal/mod.rs:32-48`,
  `web/src/lib/crypto/hashing.ts:15-21` and
  `android/core/crypto/.../Hashing.kt:20-26`; "the `PN-*` strings
  arrive with the real substrate" (`crypto.rs:22-23`).

CoGra claims no courtesy handshake edition and encodes no publication
intent. Under a courtesy edition, a body without its vocabulary
establishes no intent until its controller sends an explicit
authenticated intent message, or a vendor adapter interprets it under
an explicit edition-specific interpretation and controller
authorization, without rewriting the historical signature
(``def:graph:requested-publication-intent``).

**At the swap.** A new body edition — an extension slot, other tags,
another encoding or scheme — touches, in one change:

- *Server:* `common::l1` (body, pre-commitment, seal frame, approval
  digest, tags, editions), prepare's proposal assembly, the
  `staged_writes` columns that store the body
  ([data-model.md "Staged writes"](data-model.md#staged-writes)), the
  relay, and the golden vectors (`make vectors`, and
  `intent-vectors.json` where the body shape enters the device intent
  check).
- *Web:* `web/src/lib/crypto/handshake.ts`, `hashing.ts`, `cbor.ts`,
  the intent check, and their vector tests.
- *Android:* `android/core/crypto/.../Handshake.kt`, `Hashing.kt`,
  `Cbor.kt`, the intent check, and their vector tests.

A staged write signed under the old edition cannot be approved under
the new one; writes in flight at the swap are re-prepared (§3.9).

**Open.** Whether CoGra claims the courtesy handshake standard and its
intent vocabulary: [Q70](../open-questions.md#q70--the-courtesy-handshake-standard-and-its-request-intent).
Whether the network's host claims the courtesy standard is undecided
(2026-11-23). A body with no extension is a valid act: the body
includes any opaque signed extension bytes, and absence of a value
asks nothing (``def:graph:proposal-pre-commitment``,
``def:graph:requested-publication-intent``). The text gives no byte
form for absence; the L1 team places it in the courtesy edition's
serialization. Under the standard the initial intent addresses each
party that receives a projection's opening with the proposal: CoGra's
API for the content projection, the host for the dependency
projection (``def:graph:requested-publication-intent``); which value
an author signs for the dependency projection is unanswered. The text
prescribes no form or place for a statement that a realization claims
no handshake edition. Second-device approval and envelope verification may change with the
edition: [Q33](../open-questions.md#q33--cross-device-handshake-continuation),
[Q54](../open-questions.md#q54--semantic-verification-of-the-payload-envelope-on-clients).

### 3.3 The published record and the epoch package

**Layer 1 requires.** The act envelope has exactly: act identifier,
author, family, structural body, public protocol references and
causal parents, both commitments, the admission handshake and approval
witness with the record's map from their signatures to public keys
and the public inputs their checks need, finalization epoch and act
time (``def:graph:act-envelope``,
[§8.4](../primitive/layer1-interface.md#84-the-act-record-and-payload-carriage)).
The replay floor holds, per accepted act, the signed pre-commitment
and its recorded signing key, the seal, the commitments with their
editions and the approval witness with its recorded signing key, so
that signatures and formation verify without any hidden opening
(``def:deployment:published-epoch-replay-floor``, closure,
[§13.3](../primitive/layer1-interface.md#133-the-replay-floor-and-the-declared-cases)).
The package binds the marker policy, the burn snapshot and increment,
the accepted sequence, the preceding state, the debit vintage, and
every verification-case declaration in force — the empty set when
none is; a package that stops binding a declaration binds a successor
or a withdrawal naming it (``post:epoch:final-edge-set``,
[§11.6](../primitive/layer1-interface.md#116-epoch-boundary-the-final-act-sequence-and-the-raw-reading)).
The host publishes the seven parts of ``post:network:host-contract``
([§5](../primitive/layer1-interface.md#5-substrate-guarantees-what-layer-1s-infrastructure-postulates)).

**CoGra today.**

- `PublishedRecord` carries the act identifier, author, family, epoch,
  act time, position, the payload witness and the legs with their
  parameters and τ (`handshake.rs:218-245`). It carries no body
  fields beyond the legs, no pre-commitment, no signature, no key, no
  seal, no dependency commitment and no edition. The stand-in stores
  all of them in `l1_acts` (`seal.rs:172-201`) and publishes none.
  The replay floor asks for them ("Layer 1 requires" above).
- `EpochClosure` carries the closure cause, the boundary triple, the
  dependent-set partition, the final ledger, θ charged, the wall step
  and the marker policy (`handshake.rs:486-501`). It binds no
  case-declaration set, and none of host-contract parts (iii)–(v) and
  (vii), which the stand-in does not compute (§3.7).
- Ingestion checks the order of record (`EpochPackage::check_order_of_record`,
  `handshake.rs:543`) and that the epoch follows the cursor
  (`postgres-store/src/mirror.rs:168-181`), then stores records, legs
  and the epoch instant. It verifies no signature, seal or commitment.
- The mirror computes domain, mask and tier per leg from CoGra's copy
  of the census (`common::l1::census`); prepare runs formation against
  the same copy (`prepare.rs:296-298`).

**At the swap.**

- *Server.* `PublishedRecord` and `EpochPackage` become the mapping of
  what the network publishes: the envelope fields, the case set, and
  whichever closure outputs CoGra reads. What the mirror stores of the
  envelope follows what CoGra's reads and verification need (*open*,
  with ingestion's checks). The census copy is re-pinned to the
  network's census edition, or prepare and the mirror disagree with
  the host about formation and tiers.
- *Web and Android.* No change unless the GraphQL record shape grows
  envelope fields.

**Open.** What ingestion verifies once the host is not CoGra's own:
[Q71](../open-questions.md#q71--what-ingestion-verifies-of-a-host-it-does-not-run)
(the narrower witness check is
[Q64](../open-questions.md#q64--whether-ingestion-checks-that-the-carried-pair-opens-the-witness)).
Whether the record must carry the two pre-digests so the
pre-signature's covered bytes recompute from it:
[Q69](../open-questions.md#q69--what-the-published-record-carries-for-the-proposal-signature).
The envelope's field list does not name them
(``def:graph:act-envelope``). The L1 author reads (2026-11-23) that
the pre-commitment alone is the public input the proposal signature's
check needs, and that the seal and the approval witness carry the
binding the floor asks for. The floor asks that each signature verify
"over bytes that name the stated author and act identifier"
(``def:deployment:published-epoch-replay-floor``); for the proposal
signature a reader cannot check that without the two pre-digests. One
key for both signatures is a valid map: no text requires the two keys
to differ. The four edges of the declaration-end rule, as the L1
author reads them (2026-11-23): a withdrawal appears once; a successor
keeps the case identity and advances the edition, the edge the L1
author holds least firmly; a withdrawal is bound package content under
the package's authentication; and a withdrawal is not itself a
declaration in force (``post:epoch:final-edge-set``).

### 3.4 Content custody and removal

**Layer 1 requires.** Content bytes are never read at Layer 1; the
content commitment stays in the record whatever happens to an opening
([§8.4](../primitive/layer1-interface.md#84-the-act-record-and-payload-carriage)).
The seal does not attest carriage; a host may seal and order an act
while declining its pair ([§8.2](../primitive/layer1-interface.md#82-the-write-dependencies-and-the-admission-handshake),
"Verified act"). Holder, custodian, storage and carriage, the request
vocabulary (peek, store, serve, shelve, forget), payload state, the
payload controller and the rendering default are all courtesy
(``def:graph:holder``, ``def:graph:requested-publication-intent``,
``def:graph:canonical-erasure-default``). The closure reads no
payload state: later availability of an opening changes no value
(``prop:graph:removable-projection-invariance``), and only the
destruction of information no holder retains is irreversible
(``def:graph:act-payload-state``, courtesy).

**CoGra today.** CoGra runs centralized append with decentralized
carriage: its API carries the content pair of every act it relays,
runs the carriage checks before anything reaches the host, and the
host never receives the pair
([data-model.md "Act payload carriage"](data-model.md#act-payload-carriage)).
Ingestion promotes the pair and salt into `act_payloads`. The staged
write GC keeps custody of a sealed, approved write's pair, because
the host can still order it later
([data-model.md "Staged writes"](data-model.md#staged-writes)).
Removal is a request in the author's authenticated session or an
engine's decision (account deletion, moderation), carried out as a
reduction of CoGra's carriage, with an archive unit and a visible mark
([data-model.md "Redacting an act"](data-model.md#redacting-an-act)).
`payload_state` moves toward `reduced` only — CoGra's own carrier
rule.

**At the swap.**

- *Server.* Carriage stays CoGra's; the decentralized-carriage mode is
  what the network's host meets. `drop_carriage` leaves the seam, and
  the redaction's last step with it. Whatever the network host keeps
  of its own blinding values and of the dependency opening is the
  host's holding, not CoGra's.
- *Web and Android.* No change, unless removal becomes a signed forget
  request (Q70), which both clients would sign.

**Open.** Whether removal is expressed in the courtesy vocabulary, and
whether CoGra adopts the courtesy rendering default (absent, authored
emptiness, unavailable, unknown) or documents its own: both under
[Q70](../open-questions.md#q70--the-courtesy-handshake-standard-and-its-request-intent).
Asked of the L1 team (2026-11-23): whether an approval can lapse, so
that content kept for an approved, never-ordered act can end; how long
dependency material may be held; whether a later request must be
checkable by a third party; and whether a removal on a legal order is
a holder ceasing to hold with its own stated reason. A receipt for
carriage: [Q62](../open-questions.md#q62--an-authenticated-carriage-receipt).
An act CoGra does not carry:
[Q63](../open-questions.md#q63--the-payload-mark-of-an-act-cogra-does-not-carry).

### 3.5 Issuance

**Layer 1 requires.** Presenting a rejected set's verdict to the party
it measures is the courtesy issuance standard
(``post:deployment:verdict-issuance``,
[§13.2](../primitive/layer1-interface.md#132-replay-verification-and-verdict-certificates)).
Under the closure a host owes no one the verdict behind a rejection or
a deferral, and no accepted record carries a rejected set's verdict.

**CoGra today.** Prepare refuses an insolvent author before signing
(`WRITE_RULE_FAILED`). At close the stand-in defers an approved act
whose author cannot pay θ or whose dependencies are not in history,
and tells no one (`close.rs:5-13`). The seam has no path from the
host to an author.

**At the swap.** If the network's host issues verdicts, the seam needs
a read for them and the clients a surface; if it does not, a deferral
is visible to CoGra only as an act that does not land, and the
staged-write GC is what ends the wait.

**Open.** [Q66](../open-questions.md#q66--issuing-a-deferrals-verdict-to-its-author);
asked of the L1 team (2026-11-23): whether the network's host claims
the issuance standard and by which channel an author's application
would receive a verdict. Whether a stamp-wall refusal reads apart from
solvency: [Q58](../open-questions.md#q58--the-write-rules-second-gate-on-the-surface).

### 3.6 Money

**Layer 1 requires.** The network reads four interface objects from a
realization, among them the burn snapshot B^(k) and the constants
B_max and c_u, and the realization publishes its audit evidence and
settlement depth (``def:comparator:burn-interface``,
[§1.1](../primitive/layer1-interface.md#11-the-burn-interface-and-requirements-r1r11)).
Every closure component reads one recognized marker under the
deployment's marker policy, at the stability depth δ_pos chosen above
the realization's settlement depth
([§1.2](../primitive/layer1-interface.md#12-marker-bound-burn-settlement),
§11.6). Each accepted act debits θ^(k) from its recorded author's
residual balance, at the writing epoch's price, never recalculated;
W1 reads only the author's own balance (§11.7,
[§7.1](../primitive/layer1-interface.md#71-the-two-gate-write-rule)).

**CoGra today.** The stand-in honors B_i and θ as integer micro-units
with no realization behind them; an admission burn settles after a
configurable number of epochs (`lib.rs:6-10`). θ sits at the reference
50_186 µ — q(1) on the stand-in's micro-unit grid — because the
controller's width input is 1
([roadmap.md](roadmap.md#the-stand-in-and-the-swap)). Prepare decides
W1 on exact integers (`Micro`, `handshake.rs:575-596`). An admission
Registration's approval is held until its funding settles
(`relay.rs:264-312`), and an unchained Registration's pre-check reads
its funding row, not B_i (`prepare.rs:338-354`). The CGT rail is
separate: CoGra deploys against a realization denominated in L-BTC on
Liquid ([ledger.md](ledger.md)).

**At the swap.**

- *Server.* `balance` composes B_i from the realization's settled
  snapshot with b_i and N_i from the network's final ledger;
  `current_theta` reads the network's published threshold schedule.
  `Micro` assumes micro-units: the network's denomination and grid
  replace the stand-in's, and every stored or displayed amount
  follows. `request_admission_burn` and `burn_settlement` are
  realization operations — a burn on Liquid funded by the admission
  fund's conversion ([ledger.md "Conversion"](ledger.md#conversion--the-reserve-line))
  — so the seam spans two parties, the host and the realization. The
  funding row, the held approval and the pending window stay as they
  are; the real settlement depth sets how long the window is.
- *Web and Android.* No change: the surfaces count signed actions and
  render no θ.

**Open.** What the seam exposes of the realization:
[Q56](../open-questions.md#q56--swap-time-seam-exposure-of-the-published-interface-quantities).
Who publishes the marker policy:
[Q61](../open-questions.md#q61--the-deployments-marker-policy-and-finality-breach-response).
Community pools: [Q55](../open-questions.md#q55--community-pool-splitting).

### 3.7 Standing

**Layer 1 requires.** The conserved standing solve, the attempted
rungs with their verdicts and support, final standing, per-act stamps,
the W2a wall per author and the W2b door per epoch, and the package
evidence (host contract parts (iii)–(v) and (vii); §11.3–§11.7,
[§13.2](../primitive/layer1-interface.md#132-replay-verification-and-verdict-certificates)).

**CoGra today.** The stand-in takes every stamp as 1, so W2a and W2b
pass trivially and the derived Self-edge reading carries a constant
coordinate ([roadmap.md](roadmap.md#the-stand-in-and-the-swap)). The
seam has no standing read: the trait carries none, and prepare names
W2a and W2b without reading a stamp (`prepare.rs:307-311`).

**At the swap.** W2a and W2b can refuse. A pre-check of W2a at prepare
needs the author's last published stamp through a new seam read; a
refusal at close surfaces as a deferral (§3.5). Tests that provoke a
stamp-wall refusal become possible.

**Open.** [Q58](../open-questions.md#q58--the-write-rules-second-gate-on-the-surface).

### 3.8 Epochs

**Layer 1 requires.** The host closes an epoch when its write set
fills the target with the minimum duration elapsed, or when the
maximum duration elapses (``post:epoch:final-act-sequence-closure``).
Epochs number from 1, positions within one from 1; the key of record
is (epoch, position); the asserted boundary timestamp is a host
assertion checkable only against the published duration bounds
(§11.6, §8.3, [§5](../primitive/layer1-interface.md#5-substrate-guarantees-what-layer-1s-infrastructure-postulates)).
The epoch history is the recognized marker sequence read past the
settlement depth.

**CoGra today.** The stand-in closes on its own clock, never early,
publishing its boundary triple: the act budget, minimum 0, maximum the
clock (`lib.rs:105-119`). Production sets a three-second clock
([deployment.md](deployment.md)), 28 800 epochs a day
([development.md](development.md)). The marker policy is
`stand-in: the epoch close`, edition 1 (`wall.rs:282-283`). CoGra's numbering,
key-of-record ordering and act-time reading already follow Layer 1's
([data-model.md "The record mirror"](data-model.md#the-record-mirror)).
The staged-write GC counts epochs: 1 200 by default, "about one hour at
the stand-in's 3-second clock" (`crates/api/src/ingest.rs:17-21`).
Ingestion polls every `L1_INGEST_INTERVAL_SECS`.

**At the swap.** The network's cadence replaces the clock. The GC
bound is re-derived from the network's published boundary triple, or
its wall-time window changes with it; so is the ingestion interval.
The epoch instant shown as `Record.landedAt` is the network host's
assertion. The feed's recency counts epoch age, with a governed
half-life measured in epochs
([feed-ranking.md §5.3](../primitive/feed-ranking.md#53-recency)), so
its wall-time meaning moves with the cadence.

**Open.** Whether epoch-counted values — the governed recency
half-life among them — are re-set for the network's cadence:
[Q72](../open-questions.md#q72--what-of-a-stand-in-world-moves-to-the-network).
The marker policy and breach response:
[Q61](../open-questions.md#q61--the-deployments-marker-policy-and-finality-breach-response).

### 3.9 The world

**Layer 1 requires.** The record is immutable and permanent; an
accepted act's author, identifier and frame address never change
([§13](../primitive/layer1-interface.md#13-deployment-invariants-appdeployment));
genesis is the first package of the network.

**CoGra today.** A stand-in world holds:

- **Accounts** (L2): handles, credentials, the actor key and address
  pair, key-backup blobs.
- **The record mirror** — a rebuildable cache of the stand-in's
  published sequence.
- **Display content and carriage** — keyed by act identifiers that
  carry the stand-in address and its text form.
- **Staged writes** — proposals signed under the current edition,
  some sealed by the stand-in host and holding its salts.
- **Genesis acts** — the bootstrap's cast, Charter and role records,
  sealed by the stand-in ([architecture.md "Genesis bootstrap"](architecture.md#genesis-bootstrap)).
- **Admission funding rows** — burns credited as numbers.

**At the swap.** What carries over depends on whether the network
starts empty or takes CoGra's history, and on the address question
(§3.1). Whatever the answer:

- the mirror is rebuilt from the network's sequence, never migrated;
- a staged write sealed by the stand-in cannot be approved by the
  network and is re-prepared or dropped;
- stand-in balances are not money and do not carry over as burns;
- the genesis bootstrap runs against the network, funding its cast
  through the realization;
- identifiers, carriage keys and the naming service's content-addressed
  keys follow the network's identifier form if it differs.

**Open.** What of a stand-in world moves to the network:
[Q72](../open-questions.md#q72--what-of-a-stand-in-world-moves-to-the-network).
Accounts and device keys: [Q68](../open-questions.md#q68--key-authority-and-the-actor-address-at-the-swap).

### 3.10 Operations

**Layer 1 requires.** The deployment publishes, before genesis, its
marker policy with identity and fixed edition, placement rule and
cadence; its structural floor declaration ρ_θ,min ∈ {ρ*, 3/37} once,
beside ν, before the first epoch; its formula editions and canonical
encodings; its calibration declarations; and its case declarations, if
any ([§13](../primitive/layer1-interface.md#13-deployment-invariants-appdeployment),
[§13.1](../primitive/layer1-interface.md#131-operator-duties)).
Transparency of constants: no change without clients being able to
detect it before it applies.

**CoGra today.** The stand-in's `DECLARATION` (`crates/l1-standin/src/wall.rs:267-290`)
declares the floor 3/37, the controller edition, the marker policy and
the payload encoding — the stand-in plays the deployment. Its host
key is a seed in `l1_host`. Configuration is the `L1_*` variables
([development.md](development.md)).

**At the swap.** Who the deployment is decides who publishes each
declaration: CoGra, the network's operator, or both. The host key
clients verify seals under comes from the network, with whatever
rotation it publishes; the clients read it through
`Query.hostPublicKey` today and need no change while that holds. The
`L1_*` variables for the stand-in leave; the network's endpoints and
CoGra's realization credentials arrive, under the secrets rules of
[deployment.md](deployment.md). The in-process epoch clock leaves the
API, which simplifies the scaling seam deployment.md names.

**Open.** Who the deployment is and which marker policy and breach
response it publishes:
[Q61](../open-questions.md#q61--the-deployments-marker-policy-and-finality-breach-response);
whether it declares an author-authority case:
[Q68](../open-questions.md#q68--key-authority-and-the-actor-address-at-the-swap).

### 3.11 Batches

**Layer 1 requires.** Each dependent block of the accepted sequence is
written whole or not at all
([§8.2](../primitive/layer1-interface.md#82-the-write-dependencies-and-the-admission-handshake),
"Dependent act set"); nothing makes a set of independent acts land
together.

**CoGra today.** Every seal that signs more than one act promises
"They land together, or none does", and prepare prices a batch whole
without reserving anything.

**At the swap.** The promise holds only if the network lands CoGra's
batches whole.

**Open.** [Q57](../open-questions.md#q57--batch-atomicity-if-layer-1-cannot-back-it).

---

## 4 Order of work

### 4.1 Before Layer 1 exists

Nothing here builds Layer 1 into the stand-in.

- [ ] Answer the CoGra-side questions: Q68, Q69, Q70, Q71, Q72 and the
      swap-time Q56, Q58, Q61.
- [ ] Collect the L1 team's answers (2026-11-23) and fold them into
      [layer1-interface.md](../primitive/layer1-interface.md) and this
      document.
- [ ] Make the GraphQL schema and the bootstrap generic over
      `L1Boundary`, so the swap replaces one type at the composition
      root (§2.2).
- [ ] Keep every address derivation behind one function per platform
      (`address_of`, `addressOf`) and every tag and edition behind its
      constants, so a re-pinning is a change of values.
- [ ] Write the swap migration: drop the `l1_*` tables without editing
      their migrations (§2.2).

### 4.2 At the swap, in order

1. [ ] Learn the network's declared editions: handshake transcript and
       tags, encodings, signature scheme, address format, identifier
       form, census edition, case declarations, marker policy.
2. [ ] Re-pin `common::l1` to them, regenerate the golden vectors, and
       move web and Android to the same vectors (§3.2).
3. [ ] Implement `L1Boundary` for the network: the two relay legs and
       the epoch read against the host, balance and θ against the
       published ledger and schedule, the admission burn against the
       realization (§2.1, §3.6). Remove `drop_carriage`.
4. [ ] Map the published envelope and package into CoGra's types, and
       ingest under the checks Q71 decides (§3.3).
5. [ ] Re-derive the staged-write GC bound and the ingestion interval
       from the network's cadence (§3.8).
6. [ ] Stop the API's epoch clock and the stand-in's tables; run the
       swap migration.
7. [ ] Move the world as Q72 decides: accounts and keys under Q68,
       staged writes re-prepared or dropped, the mirror rebuilt from
       the network's sequence, the bootstrap run against the network
       (§3.9).
8. [ ] Give the tests their substrate (§2.2) and retire the `l1-dev`
       CLI's stand-in commands.

### 4.3 After the swap

- [ ] W2a's reading on the surface, with its first provoking test
      (Q58).
- [ ] Deferral verdicts, if the network issues them (Q66).
- [ ] The carriage receipt, the witness check and acts CoGra does not
      carry, as a second carrier or writer appears (Q62, Q63, Q64).
- [ ] Re-open the interim-handshake questions the swap may dissolve
      (Q33, Q54).

---

## 5 What is open

| Item | Blocks | Tracked |
|---|---|---|
| Where the key ↔ address rule lives; the network's address; how accounts and device keys move | §3.1, §3.9, §3.10 | [Q68](../open-questions.md#q68--key-authority-and-the-actor-address-at-the-swap); asked of the L1 team (2026-11-23) |
| Signature scheme and key rotation | §3.1 | [Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation) |
| Whether the record carries the two pre-digests; one key for both signatures | §3.3 | [Q69](../open-questions.md#q69--what-the-published-record-carries-for-the-proposal-signature); asked of the L1 team (2026-11-23) |
| Whether CoGra claims the courtesy handshake, its request intent, forget-based removal and the rendering default | §3.2, §3.4 | [Q70](../open-questions.md#q70--the-courtesy-handshake-standard-and-its-request-intent) |
| Whether the network's host claims the courtesy handshake and accepts a body with no extension; absence; addressing; non-adoption | §3.2 | asked of the L1 team (2026-11-23) |
| What ingestion verifies of a host CoGra does not run | §3.3 | [Q71](../open-questions.md#q71--what-ingestion-verifies-of-a-host-it-does-not-run), [Q64](../open-questions.md#q64--whether-ingestion-checks-that-the-carried-pair-opens-the-witness) |
| The declaration-end rule's four edges | §3.3 | asked of the L1 team (2026-11-23) |
| Whether an approval can lapse; how long dependency material may be held; who checks a later request; a removal that is not the author's | §3.4 | asked of the L1 team (2026-11-23) |
| A carriage receipt; an act CoGra does not carry | §3.4 | [Q62](../open-questions.md#q62--an-authenticated-carriage-receipt), [Q63](../open-questions.md#q63--the-payload-mark-of-an-act-cogra-does-not-carry) |
| A deferral's verdict; whether the network's host claims issuance | §3.5 | [Q66](../open-questions.md#q66--issuing-a-deferrals-verdict-to-its-author); asked of the L1 team (2026-11-23) |
| W2a on the surface | §3.5, §3.7 | [Q58](../open-questions.md#q58--the-write-rules-second-gate-on-the-surface) |
| What the seam exposes of the realization | §3.6 | [Q56](../open-questions.md#q56--swap-time-seam-exposure-of-the-published-interface-quantities) |
| Who the deployment is; marker policy; breach response | §3.6, §3.8, §3.10 | [Q61](../open-questions.md#q61--the-deployments-marker-policy-and-finality-breach-response) |
| What of a stand-in world moves to the network | §3.9 | [Q72](../open-questions.md#q72--what-of-a-stand-in-world-moves-to-the-network) |
| What the tests run against after the swap | §2.2 | depends on what the network offers for testing; part of Q72 |
| Batch atomicity | §3.11 | [Q57](../open-questions.md#q57--batch-atomicity-if-layer-1-cannot-back-it) |
| Second-device approval; envelope verification | §3.2 | [Q33](../open-questions.md#q33--cross-device-handshake-continuation), [Q54](../open-questions.md#q54--semantic-verification-of-the-payload-envelope-on-clients) |
