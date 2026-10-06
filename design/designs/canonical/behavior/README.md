# Behavior · `guide:design:behavior`

The behavioral contract beside the canonical screens: how a screen
flows and feels, written in lines a machine can split. The
implementation session's conformance harness compiles every line into a
test on both clients — Playwright on web, Compose UI tests on android —
so a line here binds the clients the way a board does.

The boundary with the graph: pure navigation stays in each tree's
`graph.json`, which is already machine-read (numbered edges to their
outcomes). A sidecar carries what the graph cannot — timing, ordering,
state, and what must never happen.

## The file convention

One sidecar per canonical screen, named for it: `Feed.md` holds the
lines for `designs/canonical/Feed.dc.html`. A sidecar is a level-one
heading and grammar lines — one rule per line, blank lines between
rules, no prose. Reasons, context and history stay where the rest of
the design keeps them: readme §13, the screen's docblock, copy-voice. A
line says what happens, never why.

Where each sidecar's words come from:

- `Feed.md` — the stage law (readme §13, *The feed-video rulings*),
  including the feed's hard top. Its plain words are the law's own: a
  clip *qualifies* at 70% visibility or more and unveiled, the
  *incumbent* is the playing clip, the *stage* is the one clip a scroll
  surface plays, and the *hard top* is where the surface cannot scroll
  further up. A post's clip is `feed.card.media.frame`, registered on
  `FeedCover`, and a comment card's is `feed.commentCard.media.frame`,
  registered on `FeedCommentShapes`; the law's lines name both, and keep
  *clip* where a line holds for either.
  Its hold lines are the failure pack's (readme §13, *The
  failure pack*): a signed act waits for its signature, the 200ms law
  decides when the row says `Signing…`, and a hold that fails says so
  on the target's row, never on the snackbar — and one the write rule
  refuses says so quietly there, with no Retry (copy-voice, *Faults by
  code*). A failed comfort's revert says so on the same row, and the
  newer-version snackbar speaks once per release on a cold open (readme
  §13, *The curate rulings*). The bar's re-tap ladder at the feed, and
  its two refresh gestures, are the ladder's own words (readme §13, *The
  bottom bar's re-tap ladder*).
- `ComposeSeal.md` — the failure pack's commit in flight: the label
  swap after 200ms, the inert commit, and the fault in the commit's
  place, in the words of readme §13 and copy-voice (*In-flight labels*);
  the two refusals of one staged act, the citation that never
  landed and the bug (copy-voice, *Faults by code*); and the ways out
  locked while it signs, the slow line past 5s and the outcome after a
  kill (readme §13, *The curate rulings*); and an applicant's exit,
  onto their own feed with the staged-act line, or with the turned-down
  shell's own line when no application is live (readme §13, *The
  applicant's life round* and *The applicant fix round*; copy-voice,
  *The staged-act snackbar*).
- `ReplyEntry.md` — the comments thread (*Comments · the thread*): the
  stage law's hard top, at the thread's own hard top and in thread
  order, in the same words; thread order itself (readme §13,
  *Comments live in a sheet*); the removed comment's mark in its own
  place, its replies kept under it (comment.md §5; readme §13, *The
  comment-removal round*); the signed reply's landing, scrolled to its
  new card (readme §13, *The curate rulings*); the foot's gates — the
  join prompt for a guest, and for an applicant the locked foot and
  `Reply` and their line, since applicants do not comment in V1.0 (readme
  §13, *The applicant's life round*, *The applicant fix round* and *The
  applicant residue, ruled*); and the
  landing on a deep-linked comment and the sheet's return from a
  forward navigation, the X of a cite included (readme §4,
  *Navigation*).
- `FeedKinds.md` — the feed cards (readme §13, *The feed cards,
  ruled*): the unified row's order, the law that a reply card may appear
  in any feed while the reply expansion under a card never does, where
  the comment card's door and its comment glyph land in the thread, and
  the tag's staged new post.
- `ComposeDetails.md` — the already-published marker (copy-voice, *The
  already-published marker*), on the Details step's media row.
- `TagPicker.md` — the typed-name row (readme §13, *The typed-name
  row*): the canonicalized typed name as the list's first row, and what
  the keyboard's action key stages; and the pickers' multi-add (readme
  §13, *The review fixes*): a pick stages and the picker stays open,
  and `Done` and the header back both leave with every pick kept; and
  the staged section (readme §13, *The closing batch*): a picked row
  moves above the list, and its × un-stages it; and the edit's re-pick
  (readme §13, *The pads and the edit's withdrawals*): picking a name
  the edit has withdrawn unstages the withdrawal, one staged act per
  name.
- `ReferencePicker.md` — the same multi-add and staged section, at the
  citation picker: the shared anatomy's law, in the same words.
- `KeptPicksReview.md` — the kept picks' review (readme §13, *The kept
  picks' review*): one batch, signed only from its seal; the × that drops
  a pick with no confirm and no undo, and the last drop's exit; leaving
  unsigned keeps every pick. And the kept-picks rulings (readme §13, *The
  kept picks and the pads, ruled*): plain opinions only, the removed-mark
  face, the severance said on its row with Sign as the confirmation, the
  write rule's `Not now` back to the review, the spoken drop, the anchor's
  `Waiting for your review` and the settings row's conditions.
- `RefPairEdit.md` — a standing citation's pair on an edit (readme §13,
  *The kept picks and the pads, ruled*): the pick opens at the origin, and
  `Done` on a pick never moved off it stages nothing, as the scrim does.
- The rest of the compose and media pages' sidecars (readme §13, *The
  compose and media behavior pass*) — each board's own docblock, its
  graph edges' cases, and the readme §13 rounds and copy-voice sections
  those cite. `ComposeDetails.md` and `ComposeSeal.md` carry those lines
  beside their own.
- Every other board on the feed and comments pages (readme §13, *The
  feed and comments behavior pass*) — its own docblock, the readme §13
  records it names, its flow edges' outcomes and its copy-voice
  strings, in their words. `FeedCover.md` and `PostDetail.md` name
  their elements by node path.
- The entry, profile, settings, pad and system boards (readme §13, the
  five pass C remainder records of 2026-10-05) — each board's own
  docblock and fixture, readme §4's laws, its graph edges' cases,
  auth.md where the board touches the funnel, and its copy-voice
  strings, in their words. What the sources do not determine is filed
  in the round's backlog items, never written as behavior.

## The grammar

```
WHEN <trigger> [GIVEN <state>] -> <outcome> {AND <outcome>}
ALWAYS <invariant> [GIVEN <state>]
outcome := [NEVER] <observable> [WITHIN <duration | motion token>]
```

- **WHEN** names a trigger, **GIVEN** the state it happens in, and
  everything after `->` is what the reader observes. **AND** chains the
  outcomes of one trigger.
- **ALWAYS** is a standing invariant: the harness asserts it after every
  step of the screen's tests, optionally only while its GIVEN holds.
- **NEVER** marks a prohibited outcome.
- **WITHIN** bounds an outcome in time: a duration (`300ms`, `1.5s`) or
  a motion token from `tokens/motion.css` or `tokens/transitions.css`
  (`--duration-medium-4`), exactly as `tokens.json` names it.
- **There is no THEN.** A sequence is separate WHEN lines, each GIVEN
  carrying the state the line before it left, so every line stays
  testable on its own.
- The keywords are uppercase and reserved; everything between them is
  plain words. A trigger, a state or an outcome is never empty.
- **Elements are named by their full data-node path** wherever a node
  exists (`composeDetails.mediaRow`), written where the plain words
  stood and without their article; plain words stay only for concepts
  with no node — playback, focus, the keyboard, the stage. The node IDs
  land screen by screen in `designs/canonical/nodes.json`, the registry
  the board build writes, and until a screen's land its lines name its
  elements in plain words; the paths swap in as a rename, never as a
  change of meaning. A path names what the screen's board draws: an
  element the board does not draw has no node on it yet, and its line
  keeps the plain words until a registered board draws it.

Three lines, from the two sidecars:

```
WHEN scroll settles at the feed's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in feed order
WHEN scroll settles anywhere below the hard top GIVEN the incumbent still qualifies -> NEVER the stage re-elects upward
ALWAYS the already-published marker never blocks composing or publishing
```

## Writing and refining lines

- **A line lands with its ruling.** Lines transcribe what is ruled —
  readme §13, copy-voice, a drawn board — and never run ahead of it.
  Where jakob's own wording is the ruling, the line carries it verbatim.
- **Appending is the normal change.** A new ruling adds lines; a
  refinement rewrites the line it refines in place and never leaves the
  old one standing beside it. Git holds the history, the file holds the
  current law.
- **A line is a contract both sides compile.** Rewording one is a
  contract change for the implementation session, the same as renaming
  a node; it is made on purpose, in a reviewed PR, never as tidying.

## Review discipline: prohibitions are written

The lint reads syntax. It cannot see a prohibition nobody wrote: a rule
that means "and nothing else happens" but says only what does happen
leaves the prohibition implied by omission, and the harness compiles an
omission into nothing. So **every deliberate prohibition is written
out** — as a NEVER outcome on the WHEN line it belongs to, or, when it
stands for the whole screen, as an ALWAYS invariant that states it in
words. Reviewers read each new line asking what it forbids, and a
prohibition carried only by omission is a review finding.

## What the lint checks

`_build/check-behavior.mjs` is a stage of the design pipeline, and its
exit is part of the design gate. It checks syntax:

- every non-heading, non-blank line parses as a WHEN or an ALWAYS line
  under the grammar above — prose fails, THEN fails, a GIVEN after the
  arrow fails, an empty trigger, state or outcome fails;
- a WITHIN bound is a duration or a motion token `tokens.json` carries;
- every sidecar opens with its level-one heading and is named for a
  canonical screen;
- no line stands twice in one sidecar.

And it checks nodes, against `nodes.json`:

- a node path in any line is a registered one — a line never names an
  element the built boards do not carry;
- on a registered screen (`Feed`, `PostDetail` and `ComposeDetails`, the
  calibration screens, `FeedCover`, the feed's clip, and
  `FeedCommentShapes`, a comment card's clip, so far), plain words that spell one of its nodes
  fail: "the media row" on `ComposeDetails` is written
  `composeDetails.mediaRow`. The check knows a node by the words of a
  compound name — `mediaRow`, `filterTrigger`, `actionRow`. A one-word
  name (`card`, `title`) is also an everyday word, so writing it as a
  plain word is caught in review, not by the lint, the way an unwritten
  prohibition is.

A screen whose IDs are not registered yet keeps its plain words, and the
check holds it to node paths from the change that registers it.
