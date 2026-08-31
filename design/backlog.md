# Backlog · `plan:design:backlog`

One ordered queue. A session pulls the top unstarted item, does it, and
ports back whatever it learned — a new component gets its `.d.ts`,
`.prompt.md`, and a `@dsCard`; a rule discovered while drawing goes into
`readme.md`. Then the item is struck here.

**Two kinds of item.** *System* items add or change something in this
folder. *Design* items are sessions that build screens — those live
outside the design system (their own file, not a card), and only the
reusable part comes back. Nothing on this list is a reason to put a
screen in the card grid.

**Standing constraints for every item:** mobile width only, light and
dark both designed with a toggle in the artifact, and no new colour, type
role, or radius rung without a separate decision.

---

### 1 · Core loop — feed → post detail → stance · *design* · **built**
`designs/core-loop/` — a design, not a card. Feed, one post's thread, the
stance gesture end to end, guest and member, light and dark, and the four
feed states. Ported back from it: `PostCard`/`CommentCard` now take
`taught` and `onCommit` (both are the shell's facts, not a card's),
`PageHeader` now owns a 48px band with a 48px back target, and
`StanceControl` re-syncs `taught`. See readme §11, *Small fixes*.
The spine everything else hangs off. Feed listing, one post's thread, the
stance control through its whole gesture (rest → coach mark → bloom →
park → Set), guest vs member framing, empty and loading states.
Still owed by this item, and deliberately deferred: replying (item 6),
the profile route off an author chip (item 5), and the score's screens
(item 13) — the affordances are live, the destinations are not.

### 2 · Screen-transition motion · *system* · **built**
`tokens/transitions.css` plus the Motion card *Screen transitions*.
Forward 300ms in from 12% with a fade; back is that motion reversed at
200ms; a sheet comes up over 400ms and goes back down over 200ms; a
dialog fades in place with an 8px rise. A dismissal exits the edge it
entered from, nothing inside an arriving screen animates, and reduced
motion keeps the swap without the travel. Wired into item 1's design.

### 3 · Bottom sheet · *system* · **built**
`components/core/BottomSheet.jsx` (+ `SheetItem`, `SheetTitle`) and the
*The bottom sheet* card. A drawer the reader opened and can drop: top
corners only at the 28px rung, covers the bottom bar, scrim and Escape
close it, nothing behind it is inert, never open beside the stance pad.
`OverflowMenu` now presents as a sheet by default.

### 4 · The feed's filter · *system* · **built**
`components/navigation/FeedFilter.jsx` with `Chip`/`TopicChip`, on the
card *What your feed shows*; `SegmentedFilter` stays for the narrow case
(two to four mutually exclusive options, equal segments) and now carries
order. Seven kinds of ranked content that combine, forms of post that
combine, one order that does not, and what else the feed admits — a
trigger reading the view back in words plus a sheet, applied live.
This supersedes the first pass, a three-segment Posts / Comments /
Stances row: a stance is not ranked, and the real set combines.

### 5 · Profile header + media avatars · *system* · **built**
`components/people/ProfileHeader.jsx`, plus a photo on `MonogramAvatar`
and `ActorChip`, on the People card. The stance on the person leads the
actions row; the counts read **"Stances on them"** and **"Stances they've
taken"** (the repo's own word for the link is banned on screen, and
"followers" would describe a different product); `own` changes the row,
not the layout; no cover image. The monogram stays the fallback.

### 6 · Compose + signing + pending · *design* · **built**
`designs/canonical/` — the canonical canvas's Compose rows
(2026-08-27), grown well past this item's scope by jakob's direction:
the body-first wizard (pick with tray + photos-app door, crop at
4:5/1:1/1.91:1, video cover, one details screen, the seal as a
place), the seal's sheets and pads, restore-first key absence with
local drafts, landing + the did-not-land notice, the reply flow with
its disclosed parent stance, edit as one batch with a breakdown
sheet, remove with distinct marks, the reference explorer, the post
ladder with the height cap, and the feed's rounded full-width cards.
Three ideation rounds live on the "CoGra compose" canvas. Ported
back: readme §13 rulings, the "?" dialog texts in copy-voice.md,
`Button` true heights + 64px min width, and the product-side flags
(body XOR, sensitive self-mark, default-license setting, edit
batches, Q43 resolved).
Writing, pricing shown before signing, the key-not-on-this-browser path,
and the pending marker arriving in the thread. Exercises `TextField`,
`LicenseChooser`, `RecoveryCode`, `SigningPending`, `PendingMarker` —
the honesty surfaces get their first real test here.

### 7 · Join / invite / applicant onboarding · *design* · **built**
`designs/canonical/` — the canonical canvas's Entry section (2026-08-27),
grown past this item's scope by jakob's direction: the landing is the
public feed from a borrowed vantage point (readme §13), plus invite
entry, the vouch screen, the key ceremony with its think-twice gate and
recovery-code trap, the applicant cards, the landing moment with the
first vouch on the pad, sign-in, reset, and restore. Ported back:
`Checkbox`, `BorrowedViewBand`, the `check` glyph, `RecoveryCode` at
`body-large`, and the §13 rulings (borrowed vantage point, pad above the
bar, per-control onboarding). The three-direction ideation lives on the
standalone "CoGra entry" canvas.
Applicant vs member expressed as cards in the same shell, never as
different navigation. Invitation, approval waiting, key creation and
restore.

### 8 · Topic / hashtag chip · *system* · **built**
`TopicChip` in `components/core/Chip.jsx`, built alongside the feed
filter's `Chip` — same pill, told apart by what they do. The `#` is part
of the word, not an icon.

### 17 · Prototype screens consume the master components · *system* ·
**first pass built (2026-08-28)**
`_build/render-screens.mjs`: every `designs/canonical/screens/*.jsx`
is a screen definition composed from the REAL components, rendered
against the live `_ds_bundle.js` and written out as its `.dc.html`
artboard — update a component, re-run bundle + render, and every
screen that uses it updates. Sixteen boards are converted (landing,
bare arrival, the applicant days, vouch-back and its pad,
expired/landed, the thread, removal, the post ladder, the
key-elsewhere feed), and the conversion keeps catching real drift:
`RedactedContent` said "graph" on screen; the pad, the detail
headers, and the sensitive card had been rebuilt by hand and rotted.
Ported into components on the way: `PostCard` topics + citation
line, the one-line summary title clamp, the `sensitive` self-mark
variant, the where-you-are comment affordance on detail;
`StanceControl` `defaultOpen`/`defaultPick`/`padInset`/`padNote` so
a static board shows the parked pad from the master. Screens can
keep canvas tweak chips via `PROPS`/`VALS` exports. The rule is
readme §13 *Masters, variants, and screens*. **Remaining:** the
task-flow boards (compose wizard, seals, key/auth ceremony screens)
are still hand-authored `.dc.html` — convert them as their sections
are next touched; `ReplyPad`/`ComposePad` (hand-copied pads) are
first in line.
The canonical artboards hand-copy component markup, so system updates
don't propagate — the entry-session post cards already drifted
(missing elements newer boards carry). Change the authoring model so
prototype screens are built from the design system's actual
components and variants; updating a component then updates every
screen that uses it. Applies to the canonical canvas first; the
ideation canvases stay frozen records.

### 18 · Reference rows + per-act standing display · *system* · **built**
Ruled and built 2026-08-28 (readme §13 *Reference rows and signed
pairs*): the counts open the topics-and-references sheet;
`ReferenceRow` is the one row shape (leading mark · name · signed
pair) with glyph-led kinds (five node-type glyphs exported verbatim
from material-design-icons; a text post wears a T tile, a person
their avatar, a media post its cover); `TopicsLine` is shared by
post and comment cards. Drawn on the "Topics & references · the
sheet" board. **Remaining:** the compose-side pair setting (each
picked chip shows its default pair, tap edits via the reader's
chosen stance input) lands when the compose wizard boards convert
to the screens pipeline (item 17).

### 9 · Search + results · *design* · **built**
`designs/canonical/` — the Explore row (2026-08-28): at rest (the
field, the Sky hero, device-local recents), searching (worded
filter trigger + sheet, ranked rows wearing the graph glyph, the
seam, the aged tail, @/# scope operators with two-line indirect
hits), the filter sheet, and nothing-found. Rulings in readme §13 +
Q46; ideation on the "CoGra search" canvas (hybrid of directions
1 + 2 chosen). Ported back: `SearchBar` (forms/), `CograBand`
(navigation/), `ReferenceRow` `rank`/`sub`/`message`, the `send`
glyph, the Searching "?" text in copy-voice.md.

### 19 · The feed's filter + ordering on the canonical screens · *design* · **built**
`designs/canonical/` — the Feed row (2026-08-28): signed in at rest,
the filter sheet open, narrowed ("Posts · photos · newest"), and
everything-off with the empty state. The trigger sits on the
`CograBand`'s right edge (`trailing` — the band never spends its
full width on identity alone) and every feed view wears it, guests
included. Ported back: `OrderSection` + `FilterSection` (the shared
ordering section and sheet-section chrome, consumed by the feed's
sheet and search's alike), `FilterTrigger` (the worded pill alone),
`FEED_KINDS` grown to the shared ten ("Profiles" everywhere),
deviations-only trigger reading on both surfaces ("Everything" at
rest on search), `FeedFilter defaultOpen`, and the readme §13 block
*The feed's filter on screen*.
Item 4 built `FeedFilter` (kinds, forms, Ranked/Newest order, the
trigger reading the view in words) — and no canonical feed board
ever drew the trigger; it slipped while compose had the focus.

### 10 · Sensitive veil treatment · *system*, has open questions
Granularity is settled (blur only what is marked, reveal per post),
and the compose session (item 6) settled more: the author's self-mark
veils body + description with the title readable, and the veil's face
is the pattern every large product uses — the visibility glyph,
`Sensitive — tap to view`, and the author's reason, centred in white
on the wash, no surface of their own. Drawn on the post-ladder row. Still open in this item: whether a reveal survives
leaving and returning to the post, and how the reader's 0–10 severity
setting maps to blur-or-not. No `error` colouring, no warning glyph.

### 11 · Money & CGT figures · *system* · **built**
`components/core/MoneyFigure.jsx` (`MoneyFigure`, `CgtMark`,
`formatCgt`), the *Money* card, and the canonical canvas's
*Money · the CGT figure* spec board (2026-08-31; rulings in readme §3
*Money* + §13 *Money figures*). Two decimals, thousands grouped, dust
as `< 0.01`, zero as `0`; a minus is an outflow, dust never signs,
direction never a colour. The unit is the mark — the primary coin
carrying the brand mark, knocked out monochrome — trailing the
figure; the word "CGT" appears
once, on the wallet's balance headline beside its "?" (*What is
CGT?*, copy-voice.md). Pending amounts deliberately wait for item 12.
Balances, earnings, campaign amounts: how a figure is formatted, when it
carries a unit, and what it does at zero and negative. `payoutAddress`
moves off the profile in item 12, so settle the figure first.

### 12 · Wallet · *design*
Balance, where CGT came from, active campaigns, `payoutAddress`.

### 13 · Post Score drill-down · *design*
Four screens — FeedEntry → RankPath → RankHop → raw records — each
carrying a small cover of the post it came from. The register is graph,
paths, connections; never statistics, never a chart. Its five parts
(`ScoreOrigin`, `PathTrace`, `PathSummary`, `StepSummary`, `ActionLog`)
were removed from the system on purpose: they serve one flow, so they
belong to the design. Rebuild them there. Still open: whether level one
pages past a handful of paths, and the empty state for a post whose paths
all moved long ago.

### 14 · Marketplace · *design*
Two entrances — your items on a profile, and the marketplace from the
feed or the wallet. Search by item name, ranked results, offers. The
profile is also a gate into it, so item 5 should be done first.

### 15 · Collective actor variant · *system*
Specified in the source, unimplemented, and a fair amount of work: an
actor that is a group changes the actor chip, the profile header, and
attribution on every card. Deliberately late.

### 16 · Explore · *design*
The graph as a navigable universe: a 3D view from your position, other
profiles as spheres varying in size, colour and brightness by their
weight. Mostly its own thing and mostly outside this system — last on
purpose.

### 20 · Settings — the defaults surface · *design*
Three shipped "?" texts already promise it: "Your default lives in
settings" (the license, and now the filter), and "Swap the input in
settings" (the stance pads). Design the settings surface that keeps
those promises — the default license, the reader's stance input, the
default feed filter — and the pattern the rest of settings will
follow. Added 2026-08-28 out of item 19's review.
