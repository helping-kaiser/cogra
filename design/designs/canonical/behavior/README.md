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
  further up.
- `ReplyEntry.md` — the comments thread (*Comments · the thread*): the
  stage law's hard top, at the thread's own hard top and in thread
  order, in the same words.
- `ComposeDetails.md` — the already-published marker (copy-voice, *The
  already-published marker*), on the Details step's media row.

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
  exists (`feed.card.soundDisc`); plain words stay only for concepts
  with no node — playback, focus, the keyboard, the stage. The node IDs
  land screen by screen, and until a screen's land its lines name its
  elements in plain words; the paths swap in as a rename, never as a
  change of meaning.

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
exit is part of the design gate. Today it checks syntax:

- every non-heading, non-blank line parses as a WHEN or an ALWAYS line
  under the grammar above — prose fails, THEN fails, a GIVEN after the
  arrow fails, an empty trigger, state or outcome fails;
- a WITHIN bound is a duration or a motion token `tokens.json` carries;
- every sidecar opens with its level-one heading and is named for a
  canonical screen;
- no line stands twice in one sidecar.

What activates later: the node check. Once a screen's data-node IDs are
registered, a plain word in its lines where a node exists fails — screen
by screen as the ID sweep lands, the calibration screens (`Feed`,
`PostDetail`, `ComposeDetails`) first.
