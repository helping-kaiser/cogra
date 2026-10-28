# The stance control · `guide:design:stance-control`

CoGra's signature interaction, in full. Source: readme §8 and the
stance masters in `components/stance/`.

## What is being authored

Every interaction carries two independent values, both continuous floats
in `[−1, +1]`:

| Repo name | On screen | Meaning |
|---|---|---|
| `p_d` | **For or against** | from against to for |
| `p_i` | **How much reaches you** | from keep-it-away to tell-me-everything |

The ends are named wherever the axis appears: `Against` / `For` and
`Less` / `More`, in gutters outside the pad's field and on the sliders
alike — inside the field the knob can reach every point, so no word sits
there.

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
| Tap | the pad blooms at the lower centre of the viewport, and **stages nothing** |
| Press and hold 500ms | commits `(+0.1, +0.1)` — the low default |
| Drag | moves the knob by **accumulated travel**, not absolute position |
| Release | parks the pick; the pad stays open; **nothing is signed** |
| Set | signs the pick |
| Cancel, outside press, Esc | dismisses and stages nothing — while Set signs, dismisses and leaves the signing to the target's row (*Confirmation*) |
| `?` | replaces the pad's body with four lines of help, and disables Set while it shows — on the seal-scale pads (compose, reply, and the post edit's) it opens their named dialog instead (copy-voice, *The "?" dialogs*) |
| Walk it back | the explicit route to `(0, 0)` |

**The light gesture costs nothing and the held one spends.** A tap is
what a thumb gives by accident, so it opens the surface where a reader
chooses; the shortcut that signs without opening anything takes a held
finger. The price is accepted deliberately: nobody holds a control for
half a second by mistake.

The pad opens **at the default, +0.10 / +0.10** (jakob 2026-10-05) — the
shortcut's own modest positive, so `Set` on a pick never moved signs
exactly what the hold would, and never a `(0, 0)` that asks to walk back
nothing. The one-axis pads on one's own content open at their own
defaults instead — `+0.10` on a new post, `0.00` on an edit (*Your own
content*).

**The control owns its touches.** No interaction with it — tap, hold,
drag, release, or the open pad itself — may also trigger the surface
underneath. Opening the pad must never also open the post; dismissing it
must never navigate. One gesture, one meaning.

**At rest the target shows the opinion:** the face and the folded pair.
A viewer without a bundle sees a muted, translucent 🫥 — the same control
at rest, visibly waiting to be given a value, never a bare word.

**The anchor's words are not drawn.** Face + pair is the whole visible
readout; a third encoding of the same value in words was redundant. The
words remain in the accessibility tree on every readout, because an
emoji's own accessible name is "slightly smiling face" and never "Like
this" — see readme §11, *The stance control*.

## A guest's view

**A guest borrows a viewpoint on the graph** (jakob 2026-10-06): the
genesis moderator's — an invite link in hand changes nothing, since
nothing says who holds the page — and later, one the guest picks. The
feed and every stance shown are the viewpoint's, read-only — as if the
guest were this user right now, but unable to act as them. The stance
anchor is the member anchor at its drawn 48px geometry, wearing the
viewpoint's stance; wherever the viewpoint holds no stance it wears the
hollow face, the muted 🫥. Its accessible name reads
`@genesismod's stance on this post` — the viewpoint's handle, never
`Your opinion` (jakob 2026-10-06). The tap opens `GuestGate`: nothing is
staged and nothing signs.

**Its printed words speak the viewpoint's name too** (the vantage law,
jakob 2026-10-13; readme §13). Where an anchor draws its words — the
wide anchor on a profile and on a tag page, beside the hollow face — a
guest reads `@genesismod's opinion`, never `Your opinion`. The wide
anchor has no overflow law of its own, and on a profile it leaves its
words about 134px, which `@genesismod's opinion` already outgrows (150px
measured); a name that outgrows the anchor ellipsizes, the handle
truncating before its `'s opinion` — `@genesismo…'s opinion` — so the
words always name whose view it is (jakob 2026-10-14). The ellipsis is
print only: the anchor's accessible name keeps the full handle.

**The vouch card's empty face is a line face in the card's ink** (jakob
2026-10-14). The 🫥 emoji draws in its own fixed pale greys and cannot
be tinted, so on the vouch card's olive tertiary-container ground it
never reads — muted or at full opacity. The card joins *over media*:
its unset state is the line face, `sentiment_neutral`, here drawn in
the card's own ink (`on-tertiary-container`), and the empty face
carries "no opinion yet" by itself. A set stance still shows its own
emoji face, and the face's accessible name is unchanged; everywhere
else the muted resting face stands.

**Only a nobody borrows stances** (jakob 2026-10-06). An applicant and
a fresh member borrow a *walk*, never the faces: an applicant's feed
grows from their inviter's vantage, and the vouch-back window browses
from the voucher's view (readme §13, *Guest and applicant feeds borrow
a vantage point*), but their anchors are their own — hollow wherever
they hold nothing, which for an applicant is everywhere — because a
borrowed stance on an anchor that is yours to act on could feel like
your own. The guest alone sees the lender's stances, because the guest
is nobody yet.

**The borrowed walk lasts until an opinion is live** (jakob 2026-10-20).
A member walks the borrowed view until they hold one outgoing opinion
with neither number at zero. So a first pick that lands unreachable
warns under its landing, `You'd keep your borrowed view — no feed of
your own yet.`, and never blocks.

**An applicant's anchor answers in place** (PR-103, jakob 2026-10-16:
applicant acting is post-MVP). The anchor wears auth.md's locked look —
the disabled opacity, still tappable (`anchorOpacity`) — and a tap or a
press-and-hold on any stance face an applicant meets, a topic's
included, says `You can give your
opinion once you're in.` (copy-voice, *The applicant-foot family*): the
pad never blooms, and nothing is signed or staged. Stances open at the
landing, where the vouched-in member's first opinion — the vouch-back,
or toward anyone else — is the account's first.

## Your own content

**Backing and opinion are two records** (jakob 2026-10-16, PR-101).
An author reaches their own content by two gestures, each its own
bundle — bundles key by author, target and family, so the two never
net. The words follow the records: **backing** is the authoring
bundle, **opinion** is the face's.

- **Backing — the authoring gesture, one axis.** The record that
  creates or edits the content: a Publish for a post or a proposal
  text, an Owner for an Item listing, a Send for a message. Each
  carries one free parameter, the author's attachment, For or Against;
  the census pins the second at 1 — never a choice, so never drawn as
  one. The seal's and a post edit's `Your backing` row read one number
  (`AttachmentReadout`), and `Adjust` opens the one-axis pad
  (`AttachmentPad`). A new post's starts at `+0.10` (post.md §1).
- **Opinion — the ordinary pad.** The stance anchor on the content
  itself is the pad exactly as on anyone's: an ordinary Opinion, both
  numbers, a second path to the content, priced like any act. Its
  `Current opinion` reads the opinions given through the face alone.

The comment is not authored this way: a reply's pair aims at what it
answers, so the reply pad keeps both numbers, and a comment edit
carries `(0, 0)`, fixed.

**An edit's pick is its own record.** Parallel backing records sum then
clip within their one bundle, and the pad works in that arithmetic,
never in targets: the pick is what the edit adds, `0.00` by default —
no change to the backing, a perfectly ordinary edit. The pad reads what
is newly set and what it comes to, *Two numbers, never one*'s rule at
one axis: `Current backing` (the bundle's net now) and `Your pick` above
the strip, `Backing after` below it — `clip` of the raw sum plus the
pick, the raw total and the cap stated when the sum passes ±1. Every
pick on the strip is legal. On a new post nothing stands, so the pick
is the result and `Your pick` reads alone.

**Only the walk-back aims at a result.** The edit's pad carries `Walk it
all back` where the ordinary pad keeps its walk-away. It parks the pick
at the raw sum's opposite, clipped to the strip, so Set lands the
backing at `0.00` — or, past ±1, as far as one record reaches, the rest
another edit's (the fold's conviction inertia). It is greyed while the
backing already nets `0.00` — the net is zero exactly when the raw sum
is, since the clip bites only past ±1. It parks; Set still signs, and
no dialog stands between them.

**Exactly `0.00` thinks.** On the one axis the value that takes no side
wears 🤔, spoken `No side taken` (jakob 2026-10-20) — with the pin it is
a one-zero state, and 🤷 is `(0, 0)`'s alone; every other value reads
its `VALENCE_SIX` band.

**Zero backing takes the content's own path away.** With
the second parameter pinned at 1, a Publish at `0.00` folds to
`(0, 1)`, and a record with either parameter at zero carries `w̃ = 0`
(feed-ranking §3.1). A new post set there is reached only through the
first legs of the tags and citations its author signs with it, and
through the opinions it is given later — the author's own included. The
pad warns and never prevents: Set at `0.00` on the compose pad opens
`Start it unreachable?`, and `Set it anyway` is always there. The
pinned parameter keeps the backing bundle at `(0, 1)`, never `(0, 0)` —
routing-inert all the same.

## Severance

A bundle with either number at zero is **unreachable** (jakob
2026-10-20): its path carries `w̃ = 0` (feed-ranking §3.1), so it has no
feed presence, no attribution earnings and no vouch propagation. The
consequences come from the zero, not from severing. One zero is a state
someone can mean — interested, no side taken — and the opinion stays
held. **Severance** is the named, confirmed, clean-slate version of full
inertness: a bundle netted to exactly `(0, 0)`, deliberate and
burn-priced.

**A single pick can reach it.** Against a short history it is easy: one
`(+1, +1)` edge plus a new `(−1, −1)` nets to exactly zero. The
protection is not arithmetic and cannot be — it is telling people where
they are about to land.

So the control **never prevents a choice.** The whole square is
reachable, corners included; someone dragging to the far corner means
it, and withholding `(−1, −1)` would be the worse failure. What it does
instead is explain, and confirm when it matters:

- always show where the pick lands the bundle;
- if one number lands at zero, read the state under 🤔 —
  `Interested, no side taken` and its siblings — say once that it
  shapes no feed, and let the 🤔 explain the rest in place;
- if the result is `(0, 0)`, name it as severance, say what it costs, and
  ask whether that was the intent;
- if the result is `(0, 0)` while nothing stands — never signed, or
  already walked back — there is nothing to walk back: ask whether an
  empty opinion was meant (`Sign an empty opinion?`, jakob 2026-10-21), a
  priced record that says nothing. Signed, it is an ordinary record: the
  bundle counts it, stays at `(0, 0)` and is not severed. Where the
  opinion vouches someone in, the ask warns that they start out cut off,
  and the vouch-in proceeds.
- a `(0, 0)` landing over the standing an empty sign left is severance's
  again, never a second empty sign (seam 245, ask 20): the empty record
  stands — counted, its `Walk it back` there at a cost of 1 — and
  severance is a `(0, 0)` landing over anything standing, so the
  walk-back asks, and confirmed it signs one record. Whether that
  walk-back then reads as severed or as saying nothing is the docs' open
  Q60; the trigger does not wait on it.

The cost is legible: each counter-record is its own priced act, so the
dialog states the count — `It signs 3 things, each paid separately.`
The count is what the route signs (jakob 2026-10-05): `Walk it back`
stages `severanceCost`, ⌈max(|Σd|, |Σi|)⌉ of the raw sums, and a pick
that nets to `(0, 0)` signs one record, `It signs 1 thing, paid on its
own.` The dialog asks over the parked pad, so `Keep it` returns to the
pick as it was.

## The emoji readout

The committed value is the exact continuous pair. The emoji is a lossy
readout of **the edge being authored** — this pick, not the bundle it
joins. Decoupling the readout from the value is what lets the value stay
continuous while the feedback stays legible; anchor count controls
readability only, never precision.

**One-axis aside.** The continuous law is the square's. The one-axis
attachment pads print the pick as a two-place number, so their pick parks
on hundredths at release (jakob 2026-10-16, round 17).

The readout sits **just above the pad**, never under the knob: a thumb on
the control covers exactly the spot where feedback would otherwise
appear.

Twenty anchors; the readout is the nearest by Euclidean distance, for a
pair with both numbers non-zero. **Faces follow the value** (jakob
2026-10-21): any pair drawn as a face — the pick, the standing opinion,
the resting anchor, a record's row, the snackbar — wears 🤔 when exactly
one number is zero and 🤷 at exactly `(0, 0)`, never a table face; 🫥
stays the control at rest. A tag's pair keeps the same law over its
thirteen objects. The anchors' labels below are the ACCESSIBLE names,
not on-screen text. See
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
stored preference — as `Choose your opinion`, visually hidden until
focused (readme §11, *The stance control*), so it is one tab away without being printed
beside every stance in a feed. Both surfaces carry the same circled `?`
as the pad, and on the alternates its first line is the one thing two
sliders cannot teach by themselves: *two values, not one*.

**A typed value clamps as the field clamps** (seam 245, ask 14): past the
bound, the pick takes the nearest value the bound allows — `1.5` signs
`+1.00` — and `Your pick` reads it before anything is signed, so no
refusal line is drawn. A field that holds no number moves nothing, never
a 0: zero is the one value that means something of its own. Leaving the
field rewrites it to the pick's value.

## Teaching it

A held gesture is invisible until taught — and the pad is the teacher.
The tap that opens it costs nothing, so a reader finds the considered
route on their own; what is left to teach is the shortcut. The
account's **first open ever**, wherever that pad opens, carries two
coaching lines: how the pad opens and that the same face, held, signs
the gentle default outright; then that nothing is signed until Set and
that the input can be swapped in settings. They close with the pad and
never show again.

## Confirmation

**The hold is never silent, and it waits for its signature** (the
failure pack). A gesture that stages a priced act must never be
silent: silence reads as failure and invites the same act again. The
anchor goes inert at the hold, and past 200ms the target's row says
`Signing…` under the face. Once the signature is taken, the resting
target updates to the new opinion and a snackbar confirms it — before
the record lands, which is what `Still settling` is for. A hold that
did not sign leaves the face where it was, and the row says `That
didn't sign.` with `Retry`. The snackbar never carries a failure.
`Set` waits the same way: the pad stays open, `Setting…`, until the
signature is taken, and a failure keeps it open at the pick with the
fault above its commit row.

**Cancel closes the pad, never the act** (seam 245, ask 16). While `Set`
reads `Setting…`, `Cancel` — and the outside press, and Esc — stay live:
the pad is not the act, and the act was sent and cannot be called back.
The pad closes and the signing's wait moves to the target's row, exactly
a hold's: `Signing…` under the face, the anchor refusing a second hold,
then the new face and the snackbar, or `That didn't sign.` with a
`Retry` that asks the same pick again. `PadFailed`'s `moment` chip draws
it. The dialogs raised over the pad keep their own law: their ways out
wait while their act signs.

**The alternates wait the same way** (ask 14): their commit reads
`Signing…`, a fault keeps the dialog at the pick with `Retry` in the
commit's slot, and the write rule's notice takes the landing line's and
the action row's place, with `Not now`. A write rule's no inside the
walk-back or the empty sign is the row's quiet line where the fault line
stands — `You can't sign right now. Nothing was signed or spent.` — the
act dimmed, no Retry (ask 15).
