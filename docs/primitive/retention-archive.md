# Retention archive

Some redactions destroy the original; others must preserve it for
legal purposes. The retention archive is the platform's universal
disposition for "redact from public view but retain for statutory
obligations" cases.

All current authorization paths use it:

- **Illegal-content cascades** ([moderation](../instances/moderation.md))
  may need to retain the original as evidence for prosecution, or
  may be required to destroy it (e.g., content illegal to possess
  at all). The hold value is set per case at redaction time.
- **Self-service erasure** ([erasure](../instances/erasure.md) —
  per-content removal and account deletion) retains the removed
  originals. The hold value follows the data class and the
  applicable statutory retention period in the jurisdiction the
  instance operates under — examples: ~10 years for content tied
  to financial transactions in many tax regimes (e.g., § 147 AO
  in Germany, IRS record-retention requirements in the US,
  similar provisions elsewhere); often shorter for ordinary PII
  under data-protection storage-minimization rules (GDPR/DSGVO
  in the EU, comparable laws elsewhere). The specific retention
  period is jurisdiction-dependent, not pinned to any one
  country. For removed content the hold is **never zero at the
  requester's option**: erasure hides content from public
  surfaces, and the archive is what keeps a self-service removal
  from doubling as evidence destruction.

The archive's hard-delete-on-hold-expiry is the **only point in
the system where content is genuinely removed** — the named
Postgres carve-outs
([layers.md §4](layers.md#4-layers-on-postgres-side-display-content))
delete operational state, never content. The redaction
itself is the mechanism (see
[layers.md §5](layers.md#5-deletion-policy)); the archive
entry's eventual hard-delete is its statutory end state. The
"no silent deletion" rule still holds: the redaction's public
mark does not change at hard-delete time, and the archive
entry's existence and destruction are both private.

## 1. Polymorphic shape

One Postgres table, one row per redacted entity (a removed
payload envelope with its private value, a profile snapshot, a
post body, a media attachment, etc.):

- `original_id` + `original_type` identify what was redacted.
- `original_data` holds the original content — the removed
  payload bytes and private value for graph-side redactions, the
  prior row contents for Postgres-side ones — schema-on-read, so
  the archive does not migrate when source formats evolve.
- `redaction_reason` records the trigger
  (`'illegal-content-cascade'`, `'user-content-removal'`,
  `'user-account-deletion'`, `'court-order'`, etc.).
- `redacted_by` identifies the initiator — the requesting User
  for self-service, the authorizing Proposal for moderation
  cascades.
- `redacted_at` is the timestamp.
- `legal_hold_until` is the per-row deadline.

An archived payload stays **verifiable against the public
record**: the redacted record's structural part and witness are
permanent on the shared graph, and the archived payload and
private value reproduce that commitment — so an archive row can
be proven to hold exactly the content that was removed, and
nothing can be substituted into it after the fact.

Concrete column types, indexes, and migration mechanics belong in
[data-model.md](../implementation/data-model.md). This doc fixes
the shape: one polymorphic table; per-row hold; hard-delete on
expiry; access-controlled.

## 2. Per-row legal hold

Different content types and authorization paths set different
`legal_hold_until` values:

- **Illegal content.** All redacted originals from
  illegal-classification cascades land in the archive
  automatically at threshold-cross — the cascade does not block
  on a hold decision. `legal_admin` (see §4 — a member of the
  host's operations team, not a graph role) reviews each case
  asynchronously and sets `legal_hold_until` per the relevant
  law: some content is retained for prosecution (terror financing
  evidence, fraud records); other content is illegal to retain
  at all (e.g., CSAM) — `legal_admin` schedules immediate
  hard-delete (`legal_hold_until = now()`) and reports to
  authorities. Until reviewed, the row sits with a placeholder
  hold awaiting `legal_admin` action.
- **Self-service erasure** (per-content removal and account
  deletion). The hold follows the data class
  ([erasure.md §4](../instances/erasure.md#4-retention-archive)):
  removed **content records** are always retained under a hold —
  statutory retention where the content is tied to economic
  settlement (often ~10 years for financial records, varies by
  jurisdiction), a bounded evidence-retention window otherwise —
  and the requester cannot shorten it. **Ordinary identity PII**
  gets data-protection storage minimization (often a short or
  zero hold, expirable on user request — GDPR/DSGVO and
  equivalents elsewhere).
- **Court orders.** As ordered by the court.

The archive table holds the original; whether and when it is
destroyed depends on the per-row deadline.

## 3. Statutory hard-delete

A scheduled job hard-deletes rows where
`legal_hold_until < now()` and no other statute extends the hold.
This is the explicit, statutorily required exception to
[layers.md §5](layers.md#5-deletion-policy)'s "No silent
deletion." invariant.

The exception is honest because:

- The redaction leaves a public mark (the immutable structural
  record with its reduced-only payload state, the Postgres
  tombstone version row) that does not change at hard-delete
  time.
- The archive entry's existence is private — its destruction
  erases no public-facing history.
- DSGVO Art. 5(1)(e) (storage minimization) and similar
  provisions actively *require* destruction once the obligation
  expires; keeping retained PII indefinitely would itself be a
  violation.

The graph and public Postgres surfaces never see the deletion —
they have shown the redaction mark since the redaction.

## 4. Access path

The archive is **not** a graph-visible surface. It plays no role
in feed ranking, traversal, or any normal API path.

`legal_admin` is a **person on the host's operations team** —
not a graph role, not a `network_role`, not appointed by
governance. The name is shorthand for the human(s) whose job is
to act on cases the moderation flow has already removed: case
review, setting per-row hold values per the relevant law,
reporting illegal content to authorities, surfacing archive
contents under compulsion (court order, prosecutor request,
tax-audit subpoena), and scheduling statutory hard-delete.

The work is **post-redaction**. By the time `legal_admin`
touches a case, the cascade has already removed the content from
carriage and the public Postgres surfaces; `legal_admin` has no
path back in and no role in deciding what gets redacted.

The invariants are deliberately narrow:

- **No graph reach.** Cannot author Proposals, classify content,
  or otherwise act on the shared graph or the overlay.
- **No moderation authority.** Illegal-content classification
  runs through the [moderation](../instances/moderation.md) flow
  before `legal_admin` ever sees the case; the "no admin
  override" rule holds.
- **No write access to the archive itself.** Rows are inserted
  by the redaction cascade; `legal_admin` only reads them (and
  triggers per-row hard-delete on hold expiry).
- **No arbitrary hold values.** Per-row holds are determined by
  the relevant law per case, not by `legal_admin` preference.

Widening this access would turn a compliance store into a
surveillance surface. Concrete access-control mechanics,
audit-logging, and authentication shape belong in
[data-model.md](../implementation/data-model.md); whatever form
that takes (Postgres role, off-instance tooling, dedicated admin
app), the graph and public Postgres surfaces never see it.

## What this doc is not

- **Not the redaction mechanism.** [layers.md §5](layers.md#5-deletion-policy)
  defines payload removal and Postgres tombstone semantics. The
  archive is what happens to the original *after* redaction.
- **Not the authorization paths.** Who decides to redact — and
  what hold value to set — runs through the relevant instance
  docs ([moderation](../instances/moderation.md),
  [erasure](../instances/erasure.md)). Each
  maintains its own scope and hold-rule conventions.
- **Not the retention schedule.** "How long should X be held"
  comes from law, not from this doc; per-row hold values are
  determined at redaction time per case.
