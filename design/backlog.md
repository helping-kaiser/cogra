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

### 12 · Wallet · *design + system* · **built**
Eight boards (Wallet rows on the canonical canvas: at rest, the
zero state, first-open set-up, the address-publish seal, the
address-change seal, key elsewhere, guest, applicant) and
`components/wallet/` (`WalletBalance`, `LedgerRow`,
`PayoutAddress`) + wallet.card.html. Rulings in readme §13 *The
wallet*; the product-doc decisions they stand on (L0 = L-BTC on
Liquid, the admission fund's caps, the rail key's lazy birth) went
to `docs/` as their own PR. Two new "?" texts (*Your wallet key*;
*What is CGT?* extended with the market-≈ sentence); pending
amounts (deferred from item 11) landed as `LedgerRow pending`.
Balance, where CGT came from, active campaigns, `payoutAddress`.
Round 2 (same day, "make it sexy" — direction A + gradient
blessed): `--surface-hero` (the one brand-wash gradient surface),
the hero with the ghosted coin + delta chip, `EarnedChart`
(settlement bars, honest decoration), identity rows with direction
badges, the campaign's own subpage (*Wallet · your campaign*), the
address in a card with copy, and the round of wording fixes
(path-true zero state, key notice leads, centered guest prompt,
unmissable applicant return). Round 3 (same day): the address
collapses to one line at rest (`PayoutAddressRow`, high on the
page), campaign money became ordinary history (escrow out / top-up
out / return in) behind a campaigns DOOR to the new campaigns page
(*Wallet · campaigns*: start, Yours/You-took-part, open + past),
and the moment screens (first open, guest, applicant) wear the
wash via the extracted `WashCard` master.

### 21 · The media slice · *design + system* · **built**
Inserted 2026-08-31 (jakob), ahead of item 12: the product's media
rebuild needed the five designs its lanes had been inventing, plus
comment media and comment editing. Rulings in readme §13 *The media
slice* and on the canvas's `sec-media` note. Built: `MediaGallery`
became the PAGER (one frame at the post's one crop shape, dots only,
no count pill; ratio vocabulary now `tall`/`square`/`wide`),
`CommentCard` grew `media` (inset, comment-scale cap, never cropped,
max four); boards *Feed · the gallery pager*, *Comments · pictures &
own comment* (Edit + Edited on an own comment), *Pick · show all*
(the per-picture manager: reorder/cover/remove/describe), *Describe
a picture* (+ "?"), *Details · uploading, one failed* (rings, Retry ·
Remove), *Seal · waiting on uploads* (signing gated), *Reply ·
pictures attached*, *Edit comment* (one batch, license locked),
*Profile picture · crop* and *· what you sign* (avatar change is a
signed act; NO profile cover — the ProfileHeader ruling stands).
Upload starts after the crop: only the cropped export ever leaves
the device. Caps: 10 pictures or 1 video per post, 4 per comment.
Round 2 (same day): the details row's Crop/Edit shortcut links are
GONE ("none") — the row opens the Show all sheet, crop is one Back
away — and the slice is fully componentized: `components/compose/`
(`MediaThumb`, `PickedRow`+`DescribeCounter`, `PickedSheet`,
`DescribeSheet`, `UploadStatusLine`+`UploadErrorLine`, `ActsCard`),
all ten boards rendered from the pipeline. Round 3 (implementation
findings, same day): *Pick · the web variant* (no device-gallery API
in browsers — file picker + drop target replace the grid); the
all-or-nothing subline healed into `ActsCard.note` (every multi-act
seal; single-act seals omit it); off-role type values conformed to
the pinned M3 roles (M3 stays the default, no sub-roles). Round 4
(same day, both open threads closed): the em-dash rule STANDS
(copy-voice unchanged), and the wizard's ways out are fixed — arrow
= one stage back, the new X = leave from any stage with the draft
kept, no confirmation; `WizardHeader` is the master and every
composer-flow board (JSX and hand-authored alike) wears the X.
Round 5 (implementation findings, same day): comments have NO pick
stage — "+ Add" opens the platform's own picker (Android photo
picker / browser file dialog), web adds the drop path (*Reply ·
pictures on the web*); ALT TEXT DETACHED FROM THE UPLOAD (product
ruling → api-spec.md + data-model.md: bytes-only upload, the
description rides `AttachmentInput` per placement, cached on the
version's junction row — no race, nothing gates); the describe
counter joins *Edit comment*; the edit's acts footer opens the
acts SHEET (*Edit comment · the acts*, ActsCard in the M3 modal
bottom sheet; ceremony screens keep the inline card); EditActs'
note wording conformed. Plus the canvas reorg (jakob: the split
comment rows confused): one unified Comments section — the
thread row + the reply-composer row, each with its own note; no
board deleted (none were duplicates — distinct states).

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

### 22 · Canvas flows + pages · *process*
The canonical canvas has outgrown one flat plane (77+ boards):
connections live only in heads, and gaps hide. Agreed with jakob
2026-08-31, shaped as data first, pictures generated: (1) a
checked-in `graph.json` — numbered edges `{id, from, via, to}`
grouped by section, every interactive affordance on a board either
carrying an edge or an explicit dead-end marker with a reason; a
button with neither is by definition a missing piece, greppable.
(2) Generated flow-map boards — the build pipeline renders one map
artboard per section (chips + arrows + edge numbers) plus an
overview, never hand-drawn so never lying. (3) Pages: split the
canvas by section (Feed · Compose & media · Ceremonies · Wallet ·
Maps), launch view on the overview. (4) A build-time check
cross-referencing `graph.json` against the screen list (edges to
missing boards; boards nothing reaches). 1+3 are the core; new
boards enter the manifest from the round that lands this item.

**Rounds 1–6 landed 2026-08-31** (jakob: "all agreed, go with entry
first", then "work out all the PRs and merge them on your own" —
four outcome kinds board/pattern/terminal/gap, build-stamped numbers,
8 pages, maps at both levels). The pipeline (`shell.mjs`,
`flow-markers.mjs`, `gen-maps.mjs`, `check-flows.mjs`), the paged
canvas, and EVERY page wired: Entry, Money & Wallet, Feed & Search,
Comments, Compose, Media + Patterns — 573 edges over all 81 boards,
no board unreached, no interactable unedged, check-flows green.
Readme §13 *Canvas pages and flows* records the shape. **The wiring
is done; what remains is design work the 125 gaps name**: the
guest-gate and network-error pattern boards, the reader's post and
comment menus, the topic picker, field/mismatch error states, the
key-absent acting paths, the wallet's owed record views (settlement /
tip / rail), the standalone post detail, the item/chat/offer
surfaces, and two rulings for jakob (topic destination; applicant
acting rights). The profile screen and the Sky stay their own items.
Closing those gaps is item 23.

**The user-flow layer landed 2026-09-01** (jakob's rulings): the
manifest is `graph.json` — it holds the screen graph, not flows —
and every one of its 689 edges declares a `kind` (`advance` /
`cancel` / `back` / `nav` / `detour`, no default, the gate fails
without one). Over it sit `flows.json`, the hand-authored intent,
and `flows.resolved.json`, the generated and committed witness,
both resolved by `_build/flow-engine.mjs` inside `check-flows.mjs`:
the search walks `advance` arcs alone, an ambiguous leg is a hard
failure asking for a pin, a gap-ending flow is reported rather than
failed, and drift from the blessed witness fails until `--rebless`.
Readme §13 *The user-flow layer* records the shape. Seven seed flows
are declared; authoring the full set is item 28.

### 23 · Close the gaps — in roadmap order · *design*

Jakob's directive (2026-09-01): knock out all 125 flow gaps and the
missing screens **in the order the development needs them**, keyed to
[docs/implementation/roadmap.md](../docs/implementation/roadmap.md).
Development currently sits in slice 2.5 — so FIRST every gap whose
surface belongs to a slice at or before 2.5, THEN forward strictly
in roadmap order (the Sky last, item 16 as ever). **Each round opens
by mapping its gaps to slices against the roadmap's own text** —
never from memory: read the slice descriptions and what each closed
slice already shipped (graph.json's gap list is the inventory:
grep `"gap"`). Surfaces the closed slices already SHIPPED without a
canonical design are the most overdue of all — the profile screen
leads that list. Rounds take the rulings they need before drawing
(topic destination and applicant acting rights are open and block
early gaps — ask first), design the boards, wire them so the gap
count falls, and land with check-flows green.

### 25 · Media-slice close-out designs · *design*

Filed by the feature loop 2026-09-01 (jakob: designs shipped later,
bundled). Three small pieces the 2.5.1 close needs:

1. **The veil names its source** (Q47, ruled 2026-09-01): a reader
   should see whether the *author* warned them or the platform did —
   design the veil's wording/treatment for both marks (today the
   author's optional reason is the only, weak, signal). Until slice 8
   every live veil is an author mark. Touches the veil face settled in
   item 10.
2. **The sensitive mark rides on both edit surfaces** — ruled and
   drawn 2026-09-02 (readme §13 *The compose flow*): EditCompose and
   CommentEdit each carry the seal's Sensitive row, opening the same
   `ComposeSensitive` sheet, so an author can change or clear a mark
   after publishing (the edit contract is complete-state — an edit
   that omits the mark unmarks). The license row keeps its lock
   beside it: the license is fixed by contract at signing, while the
   mark is the author's ongoing judgment.
3. **The web avatar flow** — **blessed 2026-09-02**: web takes
   AvatarCrop/AvatarSeal 1:1, the file dialog playing the system
   picker's part. Crop and seal don't differ by platform, so no web
   board is drawn.
4. **A sensitive-marked comment has no veiled state** (added
   2026-09-01): ReplySeal's Mark row lets a comment author self-mark
   and the contract carries it, but no board draws a veiled comment
   inside the comments sheet — the post veil's face doesn't obviously
   fit a comment-scale card. Blocks the reply-wizard lanes from
   implementing ReplySeal 1:1 (the Mark row without the veiled
   result), so this part leads the bundle.
5. **The leave is guarded only when something would be lost** —
   ruled and drawn 2026-09-02 (readme §13 *The compose flow*):
   comments keep no drafts, so leaving the reply wizard or a comment
   edit discards. A non-empty composer — words typed, pictures
   picked, a changed edit — meets the `DiscardConfirm` board; an
   empty one leaves at once, a confirm with nothing to lose being
   noise. The five X-leave edges (ReplyCompose, ReplyPictures(-Web),
   ReplySeal, CommentEdit) each carry both outcomes, and every X's
   label names the cost. Android and web ship the silent
   leave-discards until they catch up.

### 27 · The resting face an unauthored stance target wears (Q42) · *design* · **built**

Filed by the feature loop 2026-09-01 (jakob: to the design session).
The one open piece of the stance control: the face a target wears
when the viewer has authored no stance on it — a shared contract
exactly as §8.4's anchor table is. **Ruled 2026-09-02: 🫥**, the
dotted-line face that says "nothing here yet". It stays outside the
anchor table so an empty control can't read as a standing already
held, stays apart from 🤷 (severed or netted to zero), and keeps the
muted, translucent treatment. Q42 closed; carried into design.md
§8.3/§8.4, this folder's prose, and `StanceReadout`. Both apps
follow.

### 26 · design.md lags the media slice · *system* · **built**

Filed by the feature loop 2026-09-01. `docs/implementation/design.md`
(the design-system doc in the product docs) has absorbed none of the
media-slice rules recorded in readme §13 *The media slice*: the
gallery pager shape, comment-picture rules (single shows whole at its
own ratio, multiples share the square pager, comment pictures never
crop, max four), the describe rules (per picture, optional, never
invented, never on crop), the full-bleed crop + bottom-forward-action
wizard rulings (item 24), the sensitive veil's settled face, and the
covers-are-for-videos / gallery-cover vocabulary. Port the rules;
board-level detail stays in readme §13.

**Ported 2026-09-02** into §6's inventory and §9: the gallery pager
and the caps, crop-then-upload with only the cropped export leaving
the device, the seal's gate, the describe rules, comment media and
its one-level nesting, the profile's one image and its own seal, the
acts sheet, the wizard's ways-out header with the forward action at
the bottom, and the veil as one state rather than a reader-tuned
scale.

### 24 · Wizard ergonomics catch-up in the apps · *implementation*

Jakob's hand test (2026-09-01) found two wizard faults, ruled and
fixed on the canonical boards the same day: the crop viewport was
too small to crop in (now full-bleed — 390 wide on ComposeCrop and
AvatarCrop), and Next lived top-right on early stages then moved to
the bottom while the X inherited the corner — an accidental-leave
trap. Ruling A: **the forward action always lives at the bottom;
the header carries only the ways out** (`← Title … X`), recorded in
`WizardHeader.jsx`. Android (and web compose surfaces) must catch
up to the updated boards.

**Item-23 rulings (jakob 2026-09-01):** (a) *Topic destination* — a
topic chip always leads to the topic page; the page shipped in 2.3
but is itself undesigned, and is conceived as a subpage of search
(reachable from search directly by tapping a tag). The values'
reveal (relevance/confidence) is its own gesture — an expand
affordance — never the chip tap. (b) *Applicant acting rights* — an
applicant may stage each kind of action **once** (one post, one
stance, one comment, …): not browse-only, and never unlimited
staging while approval waits. **Process:** after each slice's
design round lands, the session compacts before the next round.

**Item-23 round 1 — the profile screen — landed 2026-09-01.** Eight
boards on the new Profile page (your own, someone else's, applicant
days, the stances page, the posts and comments views, the edit flow
and its seal), all wired: the 35 profile gaps flipped onto real
boards, 689 edges · 132 gaps · 0 pending. Rulings the round produced,
recorded in readme §13: the compact avatar-left header with the
tappable figures row (Posts + both stance counts — never merged);
the stances page shows each record's own value read-only
(`StanceValue`); the wide stance anchor pairs with Message; chats
ride the band on every tab root (edged to the chat-surface gap);
the avatar's two flows (standalone badge → its own seal; via the
edit screen → the edit's ONE seal covers everything); the chronicle
as wallet-style containers; the comment's target pointer; the topic
and applicant gaps renamed to carry their rulings. New overdue
surfaces the round exposed as gaps: the settings screen, the invites
screen, the profile menus. Next: round 2, the pattern boards
(guest-gate, network-error, key-absent).

### 28 · Author the full user-flow set · *design* · **round closed**

Item 22's engine is seeded with seven flows chosen to exercise every
mechanism — the control-selector start and its convergence check, the
two-case AvatarCrop pair, a via-pinned wizard leg, a gap-blocked
ending. What it lacks is coverage. A round declares the journeys the
product actually owes, surface by surface — entry and the key
ceremonies, compose in each of its shapes, comments, wallet and rail,
search, the profile edit paths — reviewing each with jakob, since a
flow is a claim about intent and the graph cannot check that half.
Two lists come out of it worth having on their own: the flows that
resolve, frozen as witnesses and thereafter defended against silent
rerouting, and the gaps that sit on one — which sharpens item 23's
ordering by naming the journeys each gap actually stops.

**Batch 1 landed 2026-09-02 — entry and money.** Twelve flows join
the seeds: `sign-in-with-the-key-elsewhere`, `join-with-an-invite`,
`guest-turns-applicant`, `verify-the-email`,
`verify-the-email-as-a-member`, `make-your-key`,
`vouch-back-for-your-inviter` and `restore-your-key` on entry;
`publish-your-payout-address`, `change-your-payout-address`,
`trace-a-payout-to-what-paid-it` and `see-a-campaigns-money` on
money. Nineteen declared, seventeen resolved, two blocked on
purpose — the topic page and the paying settlement's view. The round
also restructured the master stance pad on jakob's ruling: the pad
is reached from posts, comments and profiles, so `VouchBackPad/4`
now signs to the `back` terminal and leaves you where you were,
while the applicant's vouch-back keeps its own case into `Feed`.

**Batch 2 landed 2026-09-02 — feed, search and comments.** Eleven
flows join: `take-a-stance-on-a-post`, `close-the-filter-unchanged`,
`filter-the-feed-to-nothing`, `filter-the-feed-far-from-the-default`,
`undo-the-narrowing`, `search-into-a-thread` and `narrow-a-search` on
feed and search; `reply-to-a-comment`, `reply-with-pictures`,
`reply-while-the-pictures-upload` and `edit-your-comment` on
comments. Thirty declared, twenty-eight resolved, the same two
blocked. `reply-to-a-post` was promoted to a control start —
«comment count» is repeated on fourteen boards and means one thing on
every one of them — and `take-a-stance-on-a-post` starts the same way
from «stance face», whose four guest and applicant origins reach only
gaps and are reported as the census waiting to grow. All four
outcomes of `FeedSheet/6` are now frozen by one flow each. Coverage
moved with them: 73 of 132 gaps now sit on a declared journey's
boards, up from 59. The reply-wizard leave edges were re-annotated to
the discard in the same round (the media-slice close-out item's part
5; its accidental-leave guard is still an open ruling).

**Batch 3 landed 2026-09-02 — compose and media.** Ten flows join:
`publish-words`, `publish-a-video`, `cite-something`,
`set-your-own-stance-on-your-post`, `pick-a-kept-draft-back-up`,
`edit-your-post` and `remove-your-post` on compose;
`set-the-cover-and-order`, `describe-your-pictures` and
`publish-while-the-uploads-run` on media. Forty declared, thirty-eight
resolved, the same two blocked. The three body shapes now each have
their own flow, and `ComposeDetails/10` is frozen both ways — pinned
to `ComposeSeal` by the three publishing flows and to
`ComposeUploading` by the one that publishes against the gated seal.
Two more control starts join the census: «+ Cite something» over four
composers and «Describe the pictures» over four picture surfaces, both
converging with no origin left undesigned and neither needing an
`except` — `ComposePicked/2` reads «Describe», a different label, so
it stays out. `pick-a-kept-draft-back-up` gives the edge the publish
seed sets aside its own home: `ComposeExpired/15` is the one place the
nav's New post meets a kept draft first. Four journeys conclude on the
`back` terminal, which only a declared end may do. Coverage moved
again: 82 of 132 gaps now sit on a declared journey's boards, up from
73; the journey-stopping census held at thirteen, since the new
New-post flows repeat the seed's seven undesigned origins rather than
adding any.

**Batch 4 landed 2026-09-02 — profile, the web wizards, the reader
sweeps. The round's authoring is complete.** Ten flows join:
`see-who-stands-with-someone`, `find-the-thread-a-comment-answers`,
`edit-your-profile`, `take-a-stance-on-a-person` and `message-someone`
on profile; `publish-from-the-browser` and `reply-from-the-browser` as
the web parallels; `visit-an-author`, `open-a-posts-pictures` and
`follow-a-citation` completing the five repeated reader controls.
Fifty declared, forty-six resolved, four blocked — the two standing
ones joined by the chat surface and the cited node's own surface.
Three read journeys conclude on arrival, and the schema has no shape
for an end that *is* the arrival: a flow must name an end edge, so
each ends on the reading act its arrival board offers in place — «On
them» on the stance lists, the chronicle tab already showing, the
gallery pager. «Message» could not become a control start at all —
all three of its origins reach only the chat-surface gap, and a
control start whose every edge is undesigned fails outright rather
than blocking, so `message-someone` starts from the board and
declares the gap edge as its end, which is what makes it an honest
blocked claim instead of a failure. Five control starts join the
census — «the figures row» over five profiles, «the stance anchor»
over three, «author chip» over thirteen post surfaces, «post media»
over eleven and «reference count» over eleven — all converging, none
needing an `except`. Both web boards are declared entries, so both
flows start from the board; `ComposePickWeb` rejoins the native
wizard at the crop, not at details, and needed a pin the native
publish flow does not: from the web pick the search also runs out
through «Write words instead» into `ComposePick` and back to the
crop, a detour the native flow's own start board blocks as already
seen. Coverage: 94 of 132 gaps now sit on a declared journey's
boards, up from 82; the journey-stopping census moves from thirteen
to fifteen, the two new blocked ends.

**Close-out landed 2026-09-02 — the round is closed.** Jakob ruled the
round's findings through as recommended, and four of them changed the
engine. A flow may now omit `end` and conclude on ARRIVAL at the board
its last point lands on, so the three read journeys stop borrowing a
reading act to end on — `see-who-stands-with-someone`, `visit-an-author`
and `open-a-posts-pictures` each drop a self-terminal end, one of which
was a `detour` edge doing duty as a conclusion. A control start's origin
boards now count among the flow's boards, which is what the shared-board
index and the gap triage were missing: coverage jumps from 94 of 132
gaps on a declared journey's boards to 130, leaving just two off every
flow, and the shared-board index grows from 28 boards to 49. The
journey-stopping census now ignores a control origin whose every outcome
is a terminal — it stops no journey, the act completing in place — which
changes no count today, all eleven such origins carrying gaps. The
`$doc` also stopped overpromising: a gap on an END resolves blocked, an
honest claim on design owed, but a gap on a START fails, since a journey
that can begin from no existing screen is an authoring error. Two flows
came off the bench, both blocked on purpose: `search-and-open-a-post`
(the standalone post detail) and `add-a-topic` (the topic picker, whose
«Add a topic» is offered on four boards but reaches only that gap from
every one of them, so a control start would fail rather than block).
Fifty-two declared, forty-six resolved, six blocked, the census at
seventeen.

An optional tail remains, worth authoring only if a later round wants
the bench exhausted: `retry-an-unusable-invite`,
`recover-a-forgotten-password`, `make-a-key-without-a-backup`,
`search-finds-nothing-then-something`,
`change-the-license-before-signing`, `mark-your-post-sensitive`, and
`check-what-the-edit-signs`, which first needs a ruling on whether a
detour may start a flow.
