# The stance control

CoGra's signature interaction, in full. Source: `design.md` §8 plus
`web/src/lib/stance/*` and `web/src/lib/ui/stance-*.tsx`.

## What is being authored

Every interaction carries two independent values, both continuous floats
in `[−1, +1]`:

| Repo name | On screen | Meaning |
|---|---|---|
| `p_d` | **For or against** | from against to for |
| `p_i` | **How much reaches you** | from keep-it-away to tell-me-everything |

The ends are named wherever the axis appears: `Against` / `For` and
`Less` / `More`, on the pad's field and on the sliders alike.

All four quadrants are legitimate and there is no authoring bar.
A negative second value genuinely means *do not let this reach people
through me*.

**Each gesture authors one edge.** The pad writes a single record
carrying exactly the values picked. It never computes a delta against
your history and never rewrites what is already there — one new edge
against a years-long bundle is a real, visible signal without erasing
the years. A bad week with an old friend should not undo the friendship.

Nothing implicit ever becomes a record: scrolling, dwell, opening, and
sharing are not stances.

## Two numbers, never one

- **The value written** is the pick: one edge, exactly as chosen.
- **The landing** is where the bundle ends up once that edge folds in.

The control must show the second one. The landing is a local fold —
`clip` of **raw sum** plus pick — recomputed live under the drag, so
there is no round trip and no lag. It folds against the *raw* sums, not
the clipped fold: a bundle summing to `(+5, +5)` shows a fold of
`(+1, +1)`, and folding a `(−1, −1)` pick against the fold would read as
severance while the graph lands at `(+4, +4)`.

**Clipped is not hidden — and the total leads.** Every surface that
explains cost states the raw sums, because they are what a walk back to
zero actually walks. State them *first*: "everything you've said adds up
to +1.40 / +0.85, and that is what severing walks back", with the cap as
an aside only when the sum exceeded it. The other order — fold first, sum
second — reads as broken arithmetic ("my stance is +1.00, so why does
walking it back take +1.40?"), which is how an honest number ends up
looking like a bug.

## The gesture

| Input | What happens |
|---|---|
| Tap (first ever) | opens the coach mark and **stages nothing** |
| Tap (after that) | commits `(+0.1, +0.1)` — the low default |
| Press and hold 500ms | the pad blooms at the lower centre of the viewport |
| Drag | moves the knob by **accumulated travel**, not absolute position |
| Release | parks the pick; the pad stays open; **nothing is signed** |
| Set | signs the pick |
| Cancel, outside press, Esc | dismisses and stages nothing |
| `?` | replaces the pad's body with four lines of help, and disables Set while it shows |
| Sever | the explicit route to `(0, 0)` |

The pad opens **at the origin**, untilted — the low default belongs to
the tap, not to the considered gesture.

**The control owns its touches.** No interaction with it — tap, hold,
drag, release, or the open pad itself — may also trigger the surface
underneath. Opening the pad must never also open the post; dismissing it
must never navigate. One gesture, one meaning.

**At rest the target shows the standing:** the face and the folded pair.
A viewer without a bundle sees a muted, translucent 😐 — the same control
at rest, visibly waiting to be given a value, never a bare word.

**The anchor's words are not drawn.** Face + pair is the whole visible
readout; a third encoding of the same value in words was redundant. The
words remain in the accessibility tree on every readout, because an
emoji's own accessible name is "slightly smiling face" and never "Like
this" — see readme §11.7.

## Severance

A bundle netted to `(0, 0)` is severance: deliberate, burn-priced, and
carrying consequences ordinary stances do not — no feed presence, no
attribution earnings, no vouch propagation.

**A single pick can reach it.** Against a short history it is easy: one
`(+1, +1)` edge plus a new `(−1, −1)` nets to exactly zero. The
protection is not arithmetic and cannot be — it is telling people where
they are about to land.

So the control **never prevents a choice.** The whole square is
reachable, corners included; someone dragging to the far corner means
it, and withholding `(−1, −1)` would be the worse failure. What it does
instead is explain, and confirm when it matters:

- always show where the pick lands the bundle;
- if the result is inert on either axis, say the stance will carry
  nothing;
- if the result is `(0, 0)`, name it as severance, say what it costs, and
  ask whether that was the intent.

The cost is legible: each counter-record is its own priced act, so the
dialog states the count — `It takes 3 signed actions, each paid for
separately.`

## The emoji readout

The committed value is the exact continuous pair. The emoji is a lossy
readout of **the edge being authored** — this pick, not the bundle it
joins. Decoupling the readout from the value is what lets the value stay
continuous while the feedback stays legible; anchor count controls
readability only, never precision.

The readout sits **just above the pad**, never under the knob: a thumb on
the control covers exactly the spot where feedback would otherwise
appear.

Twenty anchors; the readout is the nearest by Euclidean distance. Their
labels below are the ACCESSIBLE names, not on-screen text. See
`stance-anchors.html` for the field and the full table, which is
reproduced verbatim in `components/stance/StanceReadout.jsx`. **The table
is the contract: both clients read these values, and a change here
changes both apps.**

System emoji are used rather than drawn faces. They render differently
across Android versions and between the two clients — a known and
accepted cost. Drawn faces are the open upgrade path.

## Alternate and accessible inputs

Settings offer the same value through **paired sliders** and **direct
entry**. Same machinery, different surface. These are also the
accessible path: the pad is a drag gesture, and the alternates give
screen-reader and switch users the full range through ordinary,
well-supported controls rather than a degraded version of the gesture.
Selecting an alternate replaces the pad **everywhere**, not per-screen.
The entry into them is present on every stance control regardless of the
stored preference — as `Choose your stance`, visually hidden until
focused (readme §11.3), so it is one tab away without being printed
beside every stance in a feed. Both surfaces carry the same circled `?`
as the pad, and on the alternates its first line is the one thing two
sliders cannot teach by themselves: *two values, not one*.

## Teaching it

A held gesture is invisible until taught, and a tap that stages a priced
act must not be the teaching moment's casualty. The **first tap ever** on
a stance target teaches before it acts: it opens the coach mark —
anchored to the target, overlapping nothing, staying until dismissed or
until the first successful hold — and stages nothing. Its first line is
`Nothing was signed just now.`, because a reader who thinks their tap was
swallowed taps again, which is the exact spend the teaching moment exists
to prevent.

## Confirmation

**A tap answers immediately.** The resting target updates to the new
standing at once, and a snackbar confirms the signature. A gesture that
stages a priced act must never be silent: silence reads as failure and
invites the same act again.
