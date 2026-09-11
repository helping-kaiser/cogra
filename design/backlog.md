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
readme §13 *Masters, variants, and screens*. The conformance round
(2026-09-04) finished the job: every canonical board renders from
`screens/`, and no hand-written `.dc.html` is left on the canvas.
The canonical artboards hand-copy component markup, so system updates
don't propagate — the entry-session post cards already drifted
(missing elements newer boards carry). Change the authoring model so
prototype screens are built from the design system's actual
components and variants; updating a component then updates every
screen that uses it. Applies to the canonical canvas first; the
ideation canvases stay frozen records.

### 18 · Reference rows + per-act standing display · *system* · **built**
Ruled and built 2026-08-28 (readme §13 *Reference rows and signed
pairs*): the counts open the tags-and-references sheet;
`ReferenceRow` is the one row shape (leading mark · name · signed
pair) with glyph-led kinds (five node-type glyphs exported verbatim
from material-design-icons; a text post wears a T tile, a person
their avatar, a media post its cover); `TopicsLine` is shared by
post and comment cards. Drawn on the "Tags & references · the
sheet" board.

**The tag half is closed** (the tag round, 2026-09-09; the editor
settled by the tag pad round, 2026-09-10 and its review 2026-09-11): a
staged tag chip is a button, it opens the pad — `TagPad` at an edit,
`TagPadCompose` on a composer — and the pair it sets is drawn back on
the chip whenever it deviates from the contract's +0.1 / 1. The field
is the reach a Tag's census gives it, floored just above nothing so no
drag reaches a withdrawal.

**The reference half is closed** (jakob's ruling 2026-09-10, readme §13
*The citation's pair, and the settling row*): a staged reference row is
a button, and what it opens is the pad in a sheet of its own
(`RefPair`) — a citation's two axes are both signed (`ReferenceInput`,
api-spec.md), so unlike a tag's pair it is the pad's own shape. The
poles are the citation's in the slots the contract assigns: relevance
`Barely`/`Entirely` on the horizontal, support `Against`/`For` on the
vertical, which is why `StancePad` now takes its four words as `axes`.
Four composers open it; the sheet is the master on the compose page.

**And the sheet says what is still settling** (jakob's A4 ruling, the
same day): a staged-not-yet-landed tag or citation reads
`Still settling` on its `ReferenceRow`, beside the pair it signs. The
chip on the card says nothing about the order.

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
purpose. **It lands with slice 2.7's search backend** (ruled 2026-09-09):
no surface is built against the exact-match lookup before then.

### 20 · Settings — the whole surface · *design* · **drawn 2026-09-09**
Three shipped "?" texts promised it: "Your default lives in
settings" (the license, and now the filter), and "Swap the input in
settings" (the stance pads). Two boards reached it as a gap
(`Profile/3`, `ProfileApplicant/3`), and 2.5.3 could not ship
without it: the **default-license account setting** was the one
2.5.3 deliverable with neither a contract field nor a screen.

Added 2026-08-28 out of item 19's review; reshaped by the slice-2.5
round; ruled and drawn 2026-09-09. Readme §13, *The settings round*,
records the shape.

Ruled 2026-09-09 (jakob), all carried into the boards: order by use
rather than taxonomy; the default license as one setting among the
others; theme as light / dark / auto, per-device and never in the
contract; the settings backup on a dedicated screen riding the drawn
RecoveryCode board (item 41.1); the recovery-code replace divergence
blessed as platform-appropriate proof; "don't remember this account
on this device" joining the sign-out section as well as the login
form; the snackbar as the only feedback; and the aesthetic bar —
current settings-surface anatomy in this system's own skin.

Ruled again at review the same day: a canonical canvas that stops at
the row leaves implementation to guess the surface behind it, so
every row that opens something now opens a drawn board. The batch's own
review, 2026-09-10, carried the rule one step further: a row whose
screen changes when the key is absent owes that state a board too.

**Drawn**: `Settings` (the whole page, eight groups in the ruled
order), `SettingsBackup`, `YourKey`, and the two key-absent states of
the Key backup rows — `SettingsBackupKeyAbsent` and `YourKeyAbsent`,
riding the drawn key-absent pattern, neither drawing an act the key is
needed for; the six subpages its rows open —
`SettingsLicense` and `SettingsReading` (the license and filter sheets
over the settings page, titled by the row that opened them),
`ChangePassword`, `ChangeHandle`, `ChangeEmail` and
`ChangeEmailConfirm`; `SettingsGroup`/`SettingsRow` and the house
`Switch` as masters, with `FeedFilterSheet` split off `FeedFilter` so
one control serves the feed and the default; `api-spec.md`'s
`UserPreferences.defaultLicense`; the round's copy in
`copy-voice.md`, blessed 2026-09-10.

**Not drawn**: the marked states of the four task screens
(validation is on submit, so the resting form is the one state that
always exists), and the half-confirmed email, which the graph carries
as an outcome of the confirm rather than a board. Both are their own
items when they are wanted.

**What implementation owes** — the boards are ahead of both apps on
every line below:

1. **The page is one scrolling task flow** entered from the gear,
   with no bottom bar, and its card order is the ruled one. Both apps
   ship a different order and web's entry is a text link.
2. **Every setting takes the row anatomy** — group heading, card of
   rows, footnote under. Today both apps draw section cards with body
   paragraphs inside them.
3. **Credentials move off the page.** The apps stack three forms
   inline; the boards draw three rows and, behind them, four task
   screens in `Restore`'s column. Each screen says a consequence the
   apps leave to be discovered: a change from settings keeps THIS
   device signed in where a reset signs out everything, a freed handle
   is immediately claimable and links to the old one die, and an email
   change is proved from both ends.
4. **The email confirmation's shipped line is wrong.** Both apps say
   *Check both inboxes — either message's code confirms the change*,
   which reads as one message being enough. `auth.md` and
   `api-spec.md` are explicit: either side's proof may arrive first,
   but the change applies only once BOTH have landed, and the two
   sides are not the same errand — a code from the current address,
   typed; a link at the new address, clicked.
   `ChangeEmailConfirm` carries the corrected words.
5. **The theme override exists nowhere.** Both apps and
   `tokens/colors.css` carry full dark palettes; what is missing is
   the hook that overrides the system preference, plus the per-device
   store behind it.
6. **The default license needs the contract**: `UserPreferences`
   and `SetPreferencesInput` are specified and `schema.graphql`
   carries no preference field at all. `SettingsLicense` is the
   second caller the sheet was always going to need — the same
   control, writing the account default instead of one post's terms.
7. **The backup card stops showing a code inline** and leads to the
   dedicated screen; the replace proof stays each platform's own.
8. **The drifted lines**: Writing vs Signing, the multi-action hint,
   "(this device)" vs "(this browser)", the verb-shaped row labels —
   `copy-voice.md`'s settings section carries the settled line for
   each.
9. **Feedback is the snackbar** (ruling Q14), and web's five inline
   per-section lines are not it. Nothing on the page draws a
   confirmation of its own: every act — revoked, signed out
   everywhere, changed — answers in the snackbar the shell already
   carries, and the boards draw the page at rest for that reason.
10. **The preference stores disagree, and web's is wrong.** Android
    keys the stance input and the multi-action confirmation by
    `accountId`; web keeps both in unscoped `localStorage`
    (`cogra.stanceInputMode`, `cogra.confirmMultiActionSubmits`), so
    on a shared browser the next account inherits the last one's
    choices. Web should scope them by account the way Android does —
    and the theme, being genuinely per-device rather than per-account,
    is the one that should not be.

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
comment menus, the tag picker, field/mismatch error states, the
key-absent acting paths, the wallet's owed record views (settlement /
tip / rail), the standalone post detail, the item/chat/offer
surfaces, and two rulings for jakob (tag destination; applicant
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
(tag destination and applicant acting rights are open and block
early gaps — ask first), design the boards, wire them so the gap
count falls, and land with check-flows green.

**Round 2 — the pattern boards (2026-09-02).** Three masters, hand
authored on the Patterns page: *Guest gate · the ask* (the JoinPrompt
over the read, Keep browsing first and text, the affirmative filled),
*Network error · the fault in place* (no scrim; the fault takes the
place of the control that asked, paired with Retry, the seal readable
underneath), and *Key absent · acting* (tertiary notice replacing the
pad's Set, restore first, the one ? on the key). 24 gaps closed —
10 guest-gate, 11 offline, 2 key-absent, plus FeedBare's `chats`,
which gated like Main's and WalletGuest's rather than opening the
chat surface. Census 132 → 108 gaps, 693 → 699 edges, 99 → 102
artboards, 17 → 12 journey-stopping. Guest origins (Main, FeedBare,
WalletGuest) left the `nav · New post` and `stance face` selector
starts, and KeyElsewhere left the stance-face one: a control start
must mean one thing everywhere, and those taps now start a gate.

Still owed on this item: the chat surface,
the settlement/tip/rail record views, the settings and invites screens,
the item / offer surfaces, the Sky (item 16), and item 13's Post Score
drill-down.

**Round 3 — the input-error boards (2026-09-03).** Four boards, one
per surface: `JoinErrors`, `SignInError`, `RestoreError`,
`RecoveryCodeMismatch` — the field-error, wrong-credentials,
wrong-code and code-mismatch gaps, closed. Each
copies its parent screen and changes only the errored parts;
`TextField`/`PasswordField` grew an `error` prop (M3's text-field
error state) the round before this one, and `RecoveryCode` grew an
`error` pass-through this round to reach its own confirm field. 114 →
109 gaps, 867 → 897 edges, 56/51/5 flows unchanged. Readme §13 *The
input-error round* records jakob's six rulings.

Two follow-ups the round surfaces, still open:

- ~~**aria-describedby wiring for field errors**~~ — closed by the
  slice-2.5 round: every field error announces, uniformly. The
  supporting line carries an id the control names in
  `aria-describedby`; in the error state the control adds
  `aria-invalid` and the line takes `role="alert"`. Both masters,
  no pixel moved.
- **Every board on the canvas renders from a JSX source** — the
  conformance round (2026-09-04) converted all 27 boards that had
  only hand-written `.dc.html` behind them: the compose wizard's
  ten, the entry-and-keys family's eight, and the reply and edit
  wizards, the two overlays and the pattern boards — `ReplyCompose`,
  `ReplyPad`, `ReplySeal`, `EditCompose`, `EditActs`,
  `DiscardConfirm`, `HelpDialog`, `NetworkError`, `PadKeyAbsent`.
  119 screens, all of them reachable by the pipeline, none of them
  hand-copying component markup. Every via kept its number and its
  meaning, so `graph.json` took no edge; the conversion's visible
  corrections are the ones a rebuild over the masters makes —
  `ReplySeal` and `ReplyCited` now say one "+ Cite something"
  between them, `ReplyCompose` and `DiscardConfirm` one "+ Add
  pictures or a video", `NetworkError`'s stance row prints the pair
  its own reference row prints, and `PadKeyAbsent`'s feed card grew
  everything `PostCard` grew since it was drawn.
  Two shapes moved into `_shared.jsx` on the way, both by the rule
  that a body on a second board stops being board-local: the reply
  seal's add-rows, and the reply composer itself.

- ~~**One line has no home**~~: "Replying also signs where you stand
  on the post it answers." Closed by the slice-2.5 round — the seal
  earns it, as a `QuietNote` beneath the ruled block, on both states
  of the seal. `FactRow` grew no slot.
- **What the compose-wizard conversion surfaced**, each needing a
  ruling before anyone fills it in:
  - **`PickPrompt` requires an escape.** The draft board's
    fresh-start line is the same caption with nothing to escape to;
    it is spelled at the master's values instead of taking it.
  - **No one-axis stance pad exists.** `ComposePad` draws its own
    and `ReplyPad` will want the same one. Its readout now reads the
    table — 🙂 "Nice", the nearest anchor at +0.30 — so what is left
    is the field itself: a master for the line, or two boards
    drawing one.
  - **A flow badge on a field never paints.** The badge's `::after`
    generates no box on a replaced element, and the composer boards
    stamp the `<input>`/`<textarea>` itself (`ComposeCited`,
    `ComposeDetails`, `ComposeUploading`, `EditComposeVideo`,
    `ComposeSensitive`) — check-flows verifies the attribute, not the
    paint. The badge belongs on the field's wrapper; `ComposeLicense`
    already stamps the row rather than its hidden radio.
  - **The device-gallery grid now lives on three boards** —
    `ComposePick` live, `ComposePickVideo` dead, `ComposeDraft`
    dimmed — each screen-local by the rule that the grid exists on
    one step of one flow. Three is where that rule stops being true.
- **Held rulings from the conformance round (2026-09-04)** — each a
  visible-change question the round parked rather than decided.
  Five are answered in the sources: ChipMini's tone (`Chip` gained
  the borderless `readout` tone and the seal board adopted it), the
  "+ Cite something" three voices (the bare small word on all five
  sites), the tag chip's × (the × is its own button),
  the acts line's target (the whole line is the button), and the
  comments-sheet shell (factored — `_shared.jsx`'s `CommentsSheet`,
  drawn by `ReplyMedia` and the thread sheet).

  Two are still held:
  - **The reply seal's staged reference** — stays a fact in the acts
    card as drawn, or becomes a `StagedReference` row like the
    post's. Drawn as an acts row and blessed as one in
    `copy-voice.md`, but the question itself has no recorded answer.
  - **The Mark action's two drawings** — text-Button pill on the
    comment edits vs bare word on the reply seal. Every board now
    spells `FactRow … action="Mark"`, which reads settled in
    practice and is recorded nowhere as ruled.

- ~~**A `WizardFooter` master needs one more ruling before it can be
  adopted**~~ (slice-2.5 round) — closed 2026-09-09 by jakob's R9:
  the master is scoped to the edge-to-edge anatomy. **Thirteen**
  boards draw a Next. **Four** wrap it in a footer of its own —
  `ComposePick`, `ComposePickVideo`, `ComposePicked`,
  `ComposePickedErrors` — and they are exactly the four whose
  content above runs edge to edge, so the footer is where their
  padding has to come from. Those four now take `WizardFooter`,
  which owns `12px 24px 16px`, and no pixel moved. The other
  **nine** keep their column-owned spacing: their Next sits inside a
  column that already carries the 24px sides, each ending on its own
  bottom value, and a padding-owning master cannot land there — it
  would double the sides to 48px inside the column, or lift the
  button past the column's `overflow: hidden` outside it and reset
  nine different bottom rhythms to one. (`ComposeLicense`'s
  hand-assembled row is a third anatomy again — a sheet's action
  row, hairline · summary · Done — not a wizard footer; its raw
  `0.5px` was in `AxisLabel` and is fixed under §7.)
- **One question the body-XOR pass left open (2026-09-04)**,
  drawing-level: a media post's DETAIL view now shows only its
  description, at body-medium on `text-secondary` where a body-large
  paragraph used to stand — the smallest reading of the ruling, but
  the post page's only words are now set as a caption (`PostDetail`,
  `PostDetailVideo`, `ComposeLanded`, `RemoveConfirm`, `RemoveMenu`).
- **Conformance-round leftovers, no ruling needed, just work**:
  `PendingMarker` and `StanceValue` are unused across the canvas
  since the chronicle fold (prune from the prelude destructure or
  wait for a user); **fourteen more label-small sites still spell
  0.4px** where the token says 0.5px — `ActsCard` ×2, `PickedRow` ×3,
  `CoverRow`, `DescribeSheet`, `PickedSheet`, `PickTray`,
  `UploadNotice`, `EarnedChart`, `PayoutAddress` ×2, `WalletBalance`
  — each a conform item under §7's rule that a component never states
  a raw type value, and each moves pixels, so the sweep wants one eye
  over its boards. **Eight more sites spell the token's own `0.5px`**
  and move nothing when they take it — `ActsCard`, `MediaThumb` ×2,
  `PickTray`, `Chip`, `WalletBalance`, and `ComposePick`'s board ×2 —
  and **three are not tracking at all**: `MediaThumb`'s `12px`/`16px`
  pair and `TopicsLine`'s `30px` leading, which need a rung named
  before they can take one. Board-glue still duplicated in twos and fours (the license lock
  ×4, the seal avatar row ×2, the vouch card head ×2);
  `_ds_manifest.json` frozen at the import commit (only the claude.ai
  app refreshes it); `_adherence.oxlintrc.json` has no wired runner
  and predates the round's new masters.

**Round 4 — the applicant once-each acts (2026-09-03).** The stance
face and New post starts on `ApplicantFeed`, `ApplicantWaiting`,
`WalletApplicant` and `ProfileApplicant` wired per the 2026-09-01
ruling: first tap opens the real surface (`VouchBackPad`, `ComposePick`)
and the act stages; the exhausted kind answers in place with an
info-true snackbar on `ApplicantWaiting`, drawn per the Invites
precedent — no new board. The New-post and stance-face
control-selector flows except these applicant origins alongside the
guest ones, since staged is not landed. 6 gaps closed. Readme
§13 *The applicant once-each round* records the shape.

**Round 5 — the menus (2026-09-03).** Six boards: `ReaderPostMenu`,
`CommentMenu` and `ProfileMenu` (one master per menu, not one per
surface), `PostLicense` (the terms unfolded on the card),
`ComposeCited` (the post wizard's details stage arrived at with a
reference staged) and `ReplyCited` (the same moment on the reply's
seal). 24 gaps closed — 15 post-menu, 5 profile, 3 comment, 1
license-terms view — and the own profile's ⋮ became the share control
itself. 103 → 82 gaps, 897 → 938 edges, 56/51/5 → 58/53/5 flows.
Readme §13 *The menus round* records jakob's rulings.

The three gaps the round reopened are fresh instances of surfaces
already owed, not new debts: `ComposeCited/5` and `ReplyCited/4` want
the tag picker — both closed in the tag round — and `PostLicense/7`
the score drill-down.

**The cite entry point gets a revisit trigger.** Citing opens the post
wizard because the post is the only untargeted creation — offers point
at items, campaigns at anchors. If the item round finds the item to be
a second untargeted, reference-carrying creation, that ruling reopens
and the cite row needs a way to say which is meant.

Rows the round deliberately did NOT draw — each a menu function whose
slice has not been built, and a menu row for a function nothing
answers is a promise the sheet cannot keep:

- **Report this** — belongs to the moderation surfaces of slices 4 and
  8 ([docs/instances/moderation.md](../docs/instances/moderation.md)).
  Its home when it arrives is the post and comment overflow menu.
- **Hide this** (hideActor) — slice 2.6. Its home is the same overflow
  menu.
- **Bookmark** — slice 2.6. Its home is the same overflow menu, ranked
  against the rows already there before it earns a slot.
- **The narrow-phone share-into-⋮ state is unboarded.** The reel
  round's rule says share is the first act to leave the action row when
  a phone cannot hold four; no board draws that menu with a share row
  in it.
- **The reel's deliberate no-⋮ ruling gets a revisit trigger.** The
  stream's rail carries no overflow on purpose. If the menu ever grows
  a row a reel viewer needs in the moment, that ruling is reopened —
  the trigger is a new row, not a new surface.

**The frontends reference only users, and only by exact handle**
(jakob 2026-09-03): that is wrong. Referencing is a search-backed pick
of anything referenceable, per the `ReferencePicker` search anatomy
this canvas already draws. The feature session inherits this.

**The chat surface arrives owing the action row a decision** (jakob
2026-09-03): sending a post *into a chat* is the next contender for a
slot on it — Instagram's send arrow — and it likely ranks above sharing
out of the network entirely. It is ranked against what is already
reachable there before it earns a slot, per the action-row priority
rule (readme §13, the reel round); it is deliberately undrawn until the
chats round.

### 25 · Media-slice close-out designs · *design*

Filed by the feature loop 2026-09-01 (jakob: designs shipped later,
bundled). Three small pieces the 2.5.1 close needs:

1. **The veil names its source** (Q47) — **built 2026-09-02**. The
   veil's second line reads *The author's warning* or *The platform's
   verdict*, always, with the reason after it: the two marks read back
   as the same veil, so an unnamed source reads as the other.
   `SensitiveVeil` takes `source`, `PostCard` and `CommentCard` carry
   it, and the *Sensitive & removed* card draws both. Until slice 8
   every live veil is an author mark. Open: where a words-only post
   names its source, having no wash to carry the line.
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
4. **A sensitive-marked comment veils compact** — **built
   2026-09-02**. The whole body, words and pictures as one, is
   replaced by a single comment-scale block wearing the veil's wash,
   glyph, words and source line; the author, timestamp, topics and
   stance stay readable. `CommentCard` takes `sensitive`,
   `SensitiveVeil` grew `kind="compact"`, and *Comments · the thread*
   draws it. The reply-wizard lanes can implement ReplySeal 1:1.
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

**Item-23 rulings (jakob 2026-09-01):** (a) *Tag destination* — a tag
chip always leads to the tag page, which is a subpage of search
(reachable from search directly by tapping a tag). Drawn in the tag
round, 2026-09-09. The pair's reveal is the tags-and-references sheet
that already lists a node's tags — there is no expand affordance on a
chip anywhere, and the chip's tap is the page, always. (b) *Applicant
acting rights* — an
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
as wallet-style containers; the comment's target pointer; the tag
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
purpose — the tag page and the paying settlement's view. The round
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
(the standalone post detail) and `add-a-topic` (the tag picker, whose
«+ Add a tag» is offered on nine boards but reaches only that gap from
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

### 29 · design.md is removed in favour of the design directory · *system*

Jakob's direction 2026-09-02: this folder is the design home, and
`docs/implementation/design.md` is a second copy of the same rules that
has to be kept in step by hand — item 26 was one such catch-up, and the
next drift is already accruing. Audit the file section by section,
carry anything load-bearing that `readme.md` does not already say into
it, then delete the file and point `docs/README.md` (its index entry
under implementation) at `design/` as the design home.

The referrers are the work, not the delete. `docs/open-questions.md`
cites it seven times, and roughly a hundred and fifty source files
across `android/`, `web/` and `design/components/` carry `design.md
§8.3`-style citations in their comments — the design system's own
components among them. Decide once what those become (a `design/readme.md`
section reference, or nothing) and sweep them in one pass; a dangling
citation is worse than the duplicate doc it replaces.

### 30 · The app pads lag the boards' pick readout · *implementation*

Both apps still draw the anchor's WORDS beside its face on the open
pad — Android stacks face, words and pair centred
(`StancePad.kt`'s `StanceReadout`); web renders `🙂 Nice` on one line
with the pair beneath (`stance-readout.tsx`'s `StanceStanding`). The
design system dropped the words from the drawing on purpose — face,
words and pair are three encodings of one value, two too many — and
moved them to the screen-reader line, where they still protect the
readers §10 exists for (`StanceReadout.jsx`'s recorded divergence).

The boards spec the block as a labelled readout above the field:
*Your pick* in `label-small`, then the face and the exact pair on one
line, with the standing above it and the landing below — each of the
three labelled above its own value so the eye can compare them without
reading. Neither app draws the label. Catch both up, and keep the
spoken line naming the anchor and both axes.

### 31 · Comment video and the media error states · *design + system* · **built**

Filed by the feature loop 2026-09-02 (jakob: a comment should carry a
video and a cover like a post, and both scales need error states for
too-big files and unknown formats). Extends item 21's territory.
Rulings in readme §13 *Comment video and the media error states*.
Built: a comment's grammar is the post's at comment caps — four
pictures OR one video with its cover, the byte caps recorded as
product constants (picture 10 MiB, video 100 MiB in a post and 50 MiB
in a comment, cover 10 MiB); *Reply · a video and its cover* (the
platform picker's video case, `ComposeCover`'s cover row inlined at
comment scale, the pager's square frame); *Reply · files refused* and
*Pick · files refused* (the refusal drawn where the file was offered,
the cap named only there); `MediaThumb` grew the composer's video
anatomy (play disc, duration — authoring-side only) and
`UploadErrorLine` grew the no-Retry form, since retrying cannot make a
file smaller or a format readable. `publish-a-post` gained a pinning
waypoint: the refusal board's own Next reaches the crop, so the first
leg needed the step it means.

**Round 2 — the six open pieces, all ruled (jakob 2026-09-02):**

1. **A video takes one description; its cover takes none.**
   `DescribeCounter` grew `subject`, so the row reads *Describe the
   video · 0 of 1 described* and opens the same describe sheet. The
   post wizard's details step gained the describe entry the media
   slice already gave it in words — `describe-your-pictures` now
   starts on five boards, which is what the witness reblessed.
2. **A comment's video plays like a post's** — muted autoplay in the
   square pager, the sound control only, no play/pause and no
   duration pill on a reading surface. *Comments · a video, pictures
   & own comment* draws it.
3. **The add label follows the state**: empty *+ Add pictures or a
   video*; with pictures *+ Add pictures · n of 4*; with a video, no
   add control. `CommentEdit`'s *+ Add · 1 of 4* conformed.
4. **Web takes ReplyVideo 1:1** — file dialog plus the drop path, no
   web board, the avatar blessing's form. The web drop hint reads
   *…or drop pictures or a video here.*
5. **Screens write MB, the caps are MiB** — 50 MiB is 52.4 MB, so the
   readable number under-promises and never refuses a file the
   product would take.
6. **`reply-with-a-video` is declared** beside `reply-with-pictures`
   and blessed into the witness.

The format contract the refusal states implement lives in
api-spec.md and is summarized in the readme block: WebP + MP4
(H.264/AAC) sniffed from bytes, GIF converted on the device (so the
picker never refuses one), an animated WebP a still, and a frame
cover extracted on the device and uploaded as the account's own
picture. api-spec.md carries the comment grammar and the 50 MiB
comment cap as of this round.

### 32 · Video compose — what the boards still leave undrawn · *design* · **built**

Filed by the feature loop 2026-09-02, from the web lane's 1:1 audit
against the item-31 boards (post-#596 state). Six small pieces, plus
one contradiction to reconcile:

1. **The web pick path has no refusal route.** `ComposePick` edge 9
   reaches `ComposePickedErrors`; `ComposePickWeb` edges 7/8 (drop
   region, file dialog) reach nothing on refusal. Either declare the
   1:1 (as item 31 round 2 did for ReplyVideo on web) or draw the
   web variant.
2. **No mixed-kind refusal copy.** Nothing anywhere words the
   "pictures or one video, never both" refusal; the web app's line
   is invented. The refusal boards carry only too-big and
   unreadable-format lines.
3. **No video-cap refusal line on the post pick refusal board.**
   `ComposePickedErrors`' size line is picture-worded ("That picture
   is too big — a picture can be up to 10 MB."); the 100 MiB post
   video case has no drawn words.
4. **`ComposeCover`'s back edge is still picture-first** (via 1 →
   ComposeCrop) while both pick boards branch video *around* the
   crop. The apps follow the step list (Cover → Pick); the edge
   should say what the apps do, or rule otherwise.
5. **Frame-sample positions are undrawn.** The cover step offers
   three frames; nothing says where they come from. Web ships
   10% / 50% / 90% (avoiding fade-in black at t=0) — bless or rule.
6. ~~**The cover preview's playing state is undrawn.**~~ Closed by
   the slice-2.5 round: *Cover · the preview playing* draws it with
   the post detail's own transport, minus a fullscreen toggle the
   composer has nowhere to send. Web's native-controls deviation
   retires with it — a conform item for that app.
7. **Contradiction to reconcile:** the readme block above says GIF
   "never refuses" because the device converts — true on Android,
   but the ruled web behavior (jakob 2026-09-02, after #596) is that
   an ANIMATED GIF refuses in the browser with words: no
   animated-WebP encoder exists on the web platform (a still GIF
   converts fine). The readme's format contract needs the web
   exception recorded.

**Additions from the comment-video round (feature loop,
2026-09-02 evening; both platforms' final audits):**

8. **TWO PLATFORM MISMATCHES SHIPPED — these lead the item.**
   (a) *The post card's playback controls.* Item 31 round 2 point 2
   says a comment's video plays "like a post's — the sound control
   only, no play/pause and no duration pill on a reading surface";
   android read that as binding on post cards too and stripped them
   to sound-only, while web kept the full transport controls it
   shipped first (reading the roadmap's "the viewer's real
   controls" as the post-card ruling). One of them is wrong —
   needs the ruling, then a one-line conform on the loser.
   (b) *The back arrow's discard.* The boards route only "X —
   leave" through DiscardConfirm; the back arrow (via 1) is a plain
   cancel that also loses a written comment. Android made BOTH ask
   (announced deviation); web implemented as drawn (back discards
   silently). Rule it, fix the edge or the app.
9. **Candidate refusal copy awaiting blessing** (in the apps now,
   marked invented): post video cap *"That video is too big — a
   video can be up to 100 MB."*; animated GIF *"That GIF moves, and
   CoGra can't take a moving GIF here. A still one is fine."*; post
   mixed-kind *"A post carries pictures or one video, not both."*;
   comment mixed-kind *"A comment carries pictures or one video,
   not both."* (The comment video cap line IS boarded — item 31's
   50 MB line shipped verbatim.)
10. **"A video is the whole body" state** — once a clip is in,
    both composers show no add control and no explanatory line
    (web's post pick region says "A video is the whole post";
    nothing at comment scale). Draw or bless.
11. **Over-cap picture count truncates silently** — an 11th
    picture (post) or 5th (comment) just vanishes; no refusal line
    is drawn for count, only for size/format.
12. **CommentEdit with a clip is undrawn** — and the cover cannot
    change after upload without re-uploading (immutable asset
    row), so the edit surface needs deciding, not just drawing.
13. **The describe sheet still speaks picture to a clip** — the
    master's title and field label aren't blessed for video.
14. ~~**A clip's upload FAILURE on the composer is undrawn**~~ —
    the comment scale is *Reply · the clip didn't upload*, and the
    slice-2.5 round ruled the post scale takes that board 1:1: same
    tile ring, same words, Retry beside Remove. No board of its own.

**The video conform round — all fourteen ruled and built (jakob
2026-09-03).** Rulings in readme §13, *The video conform round*;
the drawn work below.

Ruled: playback stands as drawn (sound only on every reading
surface, both scales); the back arrow gates like the X on a
non-empty comment; the post video cap, the mixed-kind lines and
the moving-GIF line are blessed copy; count overflow becomes a
refusal instead of silent truncation; staged content wins a mixed
selection, and a fresh mixed batch keeps the pictures; the clip is
the whole body and a line says so where the add control was; four
cover frames at 1s / 10% / 50% / 90%, deduped; a frame needs no
crop and a gallery picture does; the cover is changeable at edit
through the gallery alone; a failed upload keeps Retry; the
describe sheet gets the clip's shape and both shapes carry the
reason permanently; the cover is the clip's face wherever the clip
isn't running, and never returns once playback has started.

Built: six boards — *Pick · a video is the whole post*, *Cover · a
picture of your own* (the locked crop, AvatarCrop's construction),
*Describe the video*, *Edit post · a video body*, *Reply · the clip
didn't upload*, *Edit comment · a clip*. Both refusal boards grew
the full vocabulary on a full tray, which is what makes the count
and mixed-kind rows honest. `DescribeSheet` grew its `video` shape
and both it and `DescribeCounter` grew the permanent sub-line.
`ComposeCover`'s back arrow reaches the pick; `ComposePickWeb`'s
drop region and file dialog reach the refusals 1:1, and web takes
the whole-body state 1:1 as well.

Doc write-back: api-spec.md carries the two-contents contract (the
cover is its own asset, named on `AttachmentInput`, its pointer
swapping at edit-sign as a layer on the attachment, never an
alteration of the video) and the corrected GIF words;
data-model.md moves `cover_media_id` to the junction rows and adds
the manifest's cover digest (per-asset map key 3); roadmap.md gains
the fullscreen viewer, the reel view and change histories, and
2.5.2's inline-controls line is corrected.

**Left for the apps** (conform, not design): web strips its in-card
transport controls; web adds the back-arrow gate; both adopt the
blessed refusal wording; both refuse an animated GIF with words;
both give a failed clip upload Retry. The cover-pointer move is a
schema change both apps and the backend follow.

### 33 · Video playback and the rest of the clip's life · *design* · **round B built**

Filed by the feature loop 2026-09-02, from the android lane's 1:1
audit against the item-31 boards. What the video slice built to
rulings-without-boards, and what has no answer at all yet:

1. ~~**Feed/detail playback chrome.**~~ Closed by round B: the
   **control ladder** is drawn — a card's sound disc, the detail
   view's play/pause and timeline, the viewer's full transport, the
   stream's seek line.
2. **When two clips are visible, which plays?** Undrawn; android
   gates autoplay at 70% per-frame visibility. A rule wants stating.
3. **What the author sees when a GIF is picked.** Neither platform
   can encode animated WebP with a documented API (android:
   Bitmap.compress is single-frame, the NDK decoder reads one frame,
   Transformer takes one frame; web: no encoder exists), so the
   readme's "GIF converted on the device" cannot ship as written —
   the author-facing surface for a picked animated GIF needs design
   (the candidate: refuse with words on both platforms, extending
   the ruled web behavior).
4. **Video in the media viewer / fullscreen.** 2.5.2 says "the
   viewer's real controls"; 2.5.3 lists "the media viewer" — the
   slices contradict on ownership. Both apps ship inline controls
   only.
5. **Describing a video.** ~~The video shape of the sheet is
   undrawn.~~ Closed by the video conform round (item 32):
   `DescribeSheet` has the clip's shape and *Describe the video*
   draws it.
6. **EditCompose with a video body** — ~~no board draws editing a
   post whose body is a clip.~~ Closed by the video conform round:
   *Edit post · a video body*.

**What the video conform round settled here (jakob 2026-09-03):**

- **Point 2 is ruled** — one clip plays at a time, at **70%
  per-frame visibility or more**. Android's gate, blessed.
- **Point 3 is ruled** — an **animated GIF is refused with words**
  on both platforms; a still GIF still converts. The readme's
  format contract is corrected; the line is blessed copy.
- **Point 4 is ruled** — the **fullscreen viewer owns the real
  controls**, inline surfaces stay sound-only, and the roadmap now
  says so at 2.5.2 and 2.5.3 rather than contradicting itself.
- **Point 1 stays open, and leads round B.** The chrome question is
  really a shape question: **9:16 reel-style and 16:9 horizontal
  clips both exist, and square is the COMMENT scale's shape only** —
  a post card squaring everything is a bug. How the two ratios sit
  in a feed card is deliberately undrawn and is this item's lead
  question.

**Round B — what it settled (jakob 2026-09-03, all four questions
ruled in session; drawn the same day, readme §13, *The reel round*):**

1. ~~**The in-feed display vocabulary for a clip's own shape.**~~ A
   clip keeps its **native ratio clamped to tall**: 16:9 and 1:1
   display true, anything taller than 4:5 centre-crops to it, the
   cover crops identically, and **letterboxing exists nowhere**.
2. ~~**The cover's display semantics, drawn.**~~ *Feed · the cover at
   rest* draws both frames — the cover before first play, and the
   **suppressed-autoplay card** wearing a play disc where the sound
   disc sits, the one card in the product that draws play. Quoted
   targets and history rows wear the cover as a thumbnail (prose).
3. ~~**The fullscreen viewer's own surfaces.**~~ Three boards —
   *Viewer · a picture*, *· a video*, *· rotated* — with the full
   transport, pinch-zoom, the gallery's swipe, dismissal by X, swipe
   down or backdrop, no acts, and no description shown.
4. ~~**The reel view's surfaces.**~~ *Reel · the stream*: portrait
   clips only, **the default feed mechanically narrowed**, no second
   algorithm and no header saying so — the score on the rail is what
   says it. The rail is author · stance · comments · share · score,
   and the score is the **detail door** that squishes the clip to the
   top of *Post · a video, the clip pinned*.

Round B also drew **the standalone post detail** (both bodies), which
the canvas had owed since it was wired — `search-and-open-a-post` is no
longer blocked, and the chronicle rows and every post's media now land
on a board.

**Review round 1 (jakob, same day)** closed the two questions the round
had left open and fixed what the canvas showed:

- **Share is on the feed card too**, and the action row now has a
  stated order: stance, score, comment, share — the order of
  importance, and the queue by which the row gives way. On a phone too
  narrow for all four, share moves into the ⋮ menu first; a new action
  is ranked against what is already reachable before it earns a slot.
- **Letterboxing exists nowhere, pictures included.** A comment's
  uncropped pictures display-crop to their square frame, centred, the
  way its clip already does; the whole frame is one tap away in the
  viewer. Display only — nothing about the no-crop-at-upload ruling
  changes, and the bytes stay the author's own. **A comment clip's
  cover crops with it** (ruled 2026-09-10), the way a post's does — the
  cover is the clip's own face, so one frame holds both. A conform item
  for the apps.
- **The score element keeps its double meaning** — the drill-down from
  a card, the detail door from the stream's rail — and is not renamed.
- The **viewer boards were broken on the canvas** and are rebuilt: see
  the round's PR for the root cause (a flex-sized stage with a
  percentage max-height that never resolved).

### 34 · The change-history surface · *design*

Filed by the video conform round 2026-09-03, from jakob's ruling
that **everything versioned shows its change history to the user**,
reachable from the thing's own three-dot menu. The roadmap carries
the scope (Staged workstreams, *Change histories on every versioned
thing*); the surfaces are undrawn.

Every versioned kind is in scope — posts, comments, stances,
profiles, chat messages — and the product already keeps the rows: an
edit replaces the whole content and earlier versions stay public
under *Edited* unless removed (the "Editing" dialog,
[guidelines/copy-voice.md](guidelines/copy-voice.md)). What has
never been drawn is where a reader *goes* to see them.

The questions:

1. **One surface or one per kind?** A post's history and a stance's
   history are different shapes — a body that changed against a pair
   of numbers that moved. Whether that is one screen with a row
   vocabulary or a family of screens is the lead question.
2. **What a version row shows.** The date, and what else — a diff, a
   summary, the whole earlier version, the acts that rode the edit?
   The acts sheet (`EditActs` / `CommentEditActs`) already words what
   an edit signs, and a history row is that after the fact.
3. **Where the removed versions sit.** An author may remove earlier
   versions, and a redaction leaves a visible mark rather than
   erasing silently. The history is the surface where that mark is
   most visible, so its removed state is part of the design, not an
   edge case.
4. **The menu entry's words**, and whether a thing with exactly one
   version shows the entry at all.
5. **The stance case.** A stance's history is a record of where
   someone stood over time — the most sensitive of the five to draw,
   and the one most likely to want a shape of its own.

### 35 · Video playback — decisions the transition fix surfaced · *design* · **ruled**

Filed by the feature loop 2026-09-03, from the on-device transition
fix (PR #615), which made the feed↔detail handover clean without
choosing any new look. Ruled 2026-09-08; all three are conform items
for the feature session, not design work still owed:

1. **Media renders full-bleed on the card and on the detail alike.**
   The frame is the screen's width on both, which is what the canvas
   already draws — the app's 996×996 detail and 912×912 card come
   from a 32dp inset and a Card's 16dp padding, and both insets are
   drift. Equal frames also cost the handover its ~9% growth: with
   nothing to grow between, the picture simply stays.
2. **The transition is a shared element on the media frame; the
   chrome fades.** M3's container transform — the one thing the
   reader is following is the picture, so it persists in place while
   the surface around it changes. With the frames equalized by (1)
   the shared element does not resize, which is what makes the
   handover read as one surface opening rather than two screens
   swapping.
3. **A video post's card description says the clip**, never
   "1 picture" — `1 clip · 0:24`, the kind and its duration
   (`guidelines/copy-voice.md`, awaiting blessing). A clip announced
   as a picture is the card saying something untrue to the one reader
   who cannot see the difference.

### 36 · A display name is optional · *design* · **ruled**

Ruled by jakob 2026-09-08, against the input-error round's premise
that a profile must carry a written name. Account creation never asks
for one, a profile with none is presented by its handle alone, and the
handle is the only name the product requires. All three below are
conform items for the feature session, not design work still owed:

1. **`Actor.displayName` is optional — a breaking schema change.**
   Its `ModeratedText.value` is null where the actor never wrote one,
   the shape every optional moderated field already takes, and
   `prepareProfileUpdate` takes the explicit-null clear it used to
   refuse ([api-spec.md](../docs/implementation/api-spec.md)).
   Backend, `schema.graphql` and both generated clients move
   together.
2. **Profile edit validates nothing locally.** The empty-name check
   was the surface's only local rule, so `ProfileEditError` retires
   with it: Save's outcomes are the seal, and the faults the seal
   already owns.
3. **Every surface that prints a name falls back to the handle** —
   the author chip, the profile header, a mention, a search result.
   The handle alone, never a stand-in name.

**A Collective is founded the same way.** `PrepareCollectiveInput`'s
`displayName` is optional, an explicit null clears it exactly as on a
person's profile, and a Collective with none written is presented by its
handle. Point 1's breaking schema change carries the field (ruled
2026-09-10).

### 37 · The edit batch's mechanics are the implementation's call · *implementation*

Ruled by jakob 2026-09-08. A new tag or citation is **not an edit in
the mechanical sense** — the records are separate gestures, and
`PreparePostEditInput` keeps carrying no `tags` or `references`. For
the author, though, the edit screen is the right place to reach them,
and the boards draw that: the content edit and its topic and citation
acts stage together and seal as one.

**The UX invariant is fixed and not the implementation's to move**:
one seal, one act count, all-or-nothing. **How that is assembled is
the implementation session's own decision** — one prepare that grows
the fields, or the client staging the three prepares and sealing the
batch. The boards and the contract are both satisfied by the second,
which is why the contract is not moving to meet the first.

### 38 · The desktop round · *design*

Held open by the scope ruling of 2026-09-09 (readme §2): the mobile set
is what this system draws, and a desktop visitor gets the mobile-derived
layout unoptimized until this round runs. What parked into it:

1. **The card idiom above phone width** — whether the full-bleed card and
   its 8px seam belong to the 42rem column's edge or to the viewport's.
2. **The fullscreen viewer on desktop** — there is no rotate, no pinch
   and no swipe-down; Escape and the arrows already exist in the master
   and ship as they are, so the round decides what stands in for rotate
   and whether the browser's own fullscreen is offered.
3. **The share fallback's desktop dress.** Copy-the-link with a *Link
   copied* snackbar is ruled and ships now, unoptimized like the rest.

Nothing desktop-specific is built before this round.

### 39 · The UI conformance audit's undrawn states · *design* · **the states are drawn**

The 2026-09-08 audit found states both apps reach and no board draws;
where the design was silent both apps invented an answer, and the two
answers disagree. jakob ruled the whole set 2026-09-09. The six that
needed **drawing** are done — readme §13, *The audit states*:

- ~~**16 · Chronicle pagination**~~ — infinite scroll matching the
  feed, and `ProfileMoreFailed` for the page that doesn't arrive.
- ~~**17 · Profile not-found and whole-profile read-failure**~~ —
  `ProfileNotFound` (terminal) and `ProfileUnreachable` (retries).
- ~~**18 · The set-new-password surface**~~ — `ResetNew`, the reset
  link's destination. The **token** finding needs nothing here: the
  boards have always said *link*, and the apps take their lines.
- ~~**19 · Malformed-invite input**~~ — `InviteEntryError`, one line.
- ~~**20 · Android's verification landing**~~ — `VerifiedApp` and
  `VerifyExpired`. Links only; no in-app token paste.
- ~~**25 · The reply-pad help topic**~~ — `ReplyPadHelp`. The copy was
  already blessed; the board and the edge were what was missing.

**jakob blessed the whole set 2026-09-09** and the lines sit in
`copy-voice.md`'s topical sections. What remains is conform work, not
drawing, and belongs to the apps: they take these boards' lines
verbatim, and the word **token** leaves the reset and verify flows when
they do. The desktop questions — the fullscreen viewer and the desktop
card idiom — are parked to item 38 by jakob's scope ruling.

### 40 · The field flow badge is invisible, and the gate likes it that way · *build* · **ruled**

`check-flows` verifies `data-flow` on the `<input>` opening tag itself,
but `::after` generates no box on a replaced element, so every field
badge is invisible-but-valid — six boards before the audit-states round
and its fields since. **The badge moves to the field's wrapper**, where
it paints, and the gate accepts it there (ruled 2026-09-10): a marker
nobody can see verifies its own presence and nothing else.

### 41 · The recovery code's two loose ends · *design* · **ruled**

Filed by the W0 conform lane 2026-09-09 (questions 29 and 30 of the
conformance audit's design-session list). Both sit on the recovery
code; neither blocked the fixes that shipped.

1. **The settings backup card shows a recovery code no board draws
   there.** The ceremony's code lives on a dedicated screen and is
   now the trap the board rules — back swallowed until the typed-back
   confirmation. Settings shows the same code inside a card on the
   settings screen itself: the mismatch line arrived for free through
   the shared component, the trap did not — trapping back there would
   strand the reader in settings. The stakes are the ceremony's (the
   code is shown once and never stored), so the choices are: give the
   settings backup its own screen riding the drawn board, trap the
   settings screen while the code is up, or bless the card as a
   deliberately lighter surface. Implementation's input: the
   dedicated screen — same stakes, same screen; the other two either
   invent a trap no board draws or leave the loss open.

2. **`graph.json` fires the mismatch on a press the master forbids —
   and the platforms split on it.** The RecoveryCode→
   RecoveryCodeMismatch edge triggers on pressing "I've written it
   down" with a wrong code, but the RecoveryCode master draws that
   button `disabled={!matches}` — the press cannot happen. Each W0
   lane resolved the contradiction toward a different source.
   Android follows the master: the button stays disabled until the
   code matches and the line appears in place from the first wrong
   character — which also flags a reader mid-way through typing
   correctly, since a partial never matches the whole. Web follows
   the readme's validation timing ("on submit, then live only where
   already marked") and the edge: the button is live once anything
   is typed, a wrong press puts the line on the field, and from then
   on it re-reads live. The ruling picks the reading — the losing
   platform is a one-line fix — and settles the timing with it. If
   an eager signal is wanted, the honest one is prefix divergence: a
   typed prefix the code doesn't start with can never become right,
   while a correct partial shows nothing.

**Ruled by jakob 2026-09-09**, both ends:

1. **The settings backup gets its own screen**, riding the drawn
   RecoveryCode board — same stakes, same screen. Item 20 carries it:
   the settings round draws it in context.
2. **The earned button stands, and the mismatch is a diverged
   prefix.** "I've written it down" keeps `disabled={!matches}`, so
   the line answers the typing rather than a press that cannot
   happen: it appears the moment the typed text stops being a prefix
   of the code, never on an empty field and never on a correct
   partial, because a partial is still on its way to being right and
   a diverged prefix never can be. `graph.json`'s edge reads the
   divergence, `RecoveryCodeMismatch` holds a real diverged prefix,
   and readme §13 names the recovery gate as the on-submit timing
   rule's one exception — the button never enables on a divergence,
   so a signal held for submit never comes. Both apps conform: web's
   button stops being live before the code matches, and Android's
   line waits for divergence instead of firing on any partial.

### 42 · The sensitive sheet's line is post-shaped · *design* · **ruled**

Filed by the w0-web lane 2026-09-09. Item 25.2's Mark row is now on
the comment editor, and it opens the same ComposeSensitive sheet the
post seal uses — whose one explanatory line, "Veils the pictures and
the description until a reader chooses to look", is written for the
post. On a comment the veil covers the words and pictures as one.
The apps show the drawn line verbatim rather than invent comment
copy. Ruling: one line for both scales, or a comment wording — and
if the latter, its words.

**Ruled by jakob 2026-09-09: one line for both scales.** The sheet
says `Veils the pictures and the words until a reader chooses to
look.` — a comment has no description to name, and a post's
description is words. The "?" behind the sheet caught up with the
settings round (jakob's re-bless, same day): its paragraph now reads
*the words* too, and the mark is explained one way again.

### 43 · What the shell round could not finish · *design* · **ruled**

Filed by the w1-web conform lane 2026-09-09. Three stops, each a
question the boards leave open; none blocked the rest of the shell.

1. **Three entry arrows point nowhere drawable.** The PageHeader
   master rules the arrow is a LINK — "a deep-linked visitor with no
   history still lands somewhere sensible" — and three entry boards
   draw destinations (`Join`→InviteEntry, `Reset`→SignIn,
   `KeyCeremony`→ApplicantFeed), but `InviteEntry`, `SignIn` and
   `Restore` draw `{"kind":"back","to":[{"terminal":"back"}]}` — the
   history the master forbids relying on. Where do those three
   arrows point for a visitor who arrived by URL? The band waits on
   the answer for all six entry screens (adopting three of six would
   split the flow's look); the conformance register carries the
   entry task-screen layout under W7.
2. **`CograBand`'s chats line contradicts the graph.** The master's
   docblock says the chats affordance rides *every* tab root;
   `graph.json` routes a signed-in chats tap to
   `{"gap": "the chat surface (not designed)"}`. Both cannot be
   acted on at once — the apps currently follow the graph (no dead
   button; the band draws the affordance only once a surface exists).
   Bless that reading or redraw the edge.
3. **How much of `BorrowedViewBand` can be true before the ranker.**
   The band names a vantage, and the feed beneath it is chronological
   until slice 3's ranker — so the question is whether naming whose
   view this is says anything the feed does not yet do, and which
   vantages are knowable without a contract field the schema has not
   grown.

**Ruled by jakob 2026-09-09**, all three stops:

1. **The three arrows name boards.** `InviteEntry` and `SignIn` are
   roots of the funnel, and up from a root is the public front door:
   both go to `FeedBare`. `Restore` is reached only from signed-in
   surfaces whose key is absent, so up is that reader's own home —
   `KeyElsewhere`, which is also where the app opens for them. All six
   entry screens now name a board, so the entry band's layout task
   (W7) can take them together.
2. **The canvas draws the whole app; each release builds its slice.**
   Designing feature by feature would move the same surfaces every
   time a new one arrived beside them, and every move is frontend work
   done twice. So the boards settle the end state and the apps add the
   pieces their slice binds: an affordance whose destination is
   neither designed nor built stays out until one exists, and nothing
   ships a dead or lying control. The rule lives in readme §2. It
   settles the chats stop without redrawing anything — `CograBand`'s
   line and the graph's gap were never in conflict, the band carries
   chats because messaging belongs on every tab root, and the apps
   draw it the release a chat surface exists. The edges stay as they
   are; the docblock says which half is end state.
3. **The guest and applicant bands ship now; the rank waits.**
   Naming a vantage needs no ranker, and both of those vantages are
   knowable without a new contract field — genesis for a bare
   arrival, the applicant's own inviter for an applicant — so both
   bands stand from the start over a feed that reads newest. What
   waits for slice 3 is the borrowed *order*, the invite-link vantage
   and the field it needs, and the band's line about ranking. The
   vantage ladder is recorded in readme §13 beside the band's rules.

**`KeyElsewhere` is confirmed** (jakob, same day): `Main` is the
signed-out invite-link feed — every act on it guest-gates — so the
signed-in home the ruling's reason names is `KeyElsewhere`, the
app-open entry for a key-absent reader, and the edge draws it.

**The error twins keep their screens' arrows** (jakob, same day —
stop 1 is about the screen, not the board): `InviteEntryError`,
`SignInError` and `JoinInvalid` resolve to `FeedBare` and
`RestoreError` to `KeyElsewhere`, each wearing its parent's case
verbatim, because a screen and its error state are one control and
one control reads one way.

**Both borrowed-view bands ship now** (jakob's ruling, 2026-09-10 —
this reverses stop 3): the applicant band shows from the moment an
invitation-link account exists, before the email is verified and
before the application lands, and the guest band replaces the guest
notice with the genesis moderator's name. Both feeds stay
newest-first. What stop 3 refused was a label claiming a ranking
that does not exist; the band's sentence claims a *vantage*, and
whose posts a borrowed feed shows is true the moment the vantage is
served — the ranker only changes their order. The borrowed-vantage
field the contract owed lands with them.

**The vouch-back reading ships too** (filed by the f2-bands lane as
unruled, ruled by jakob the same day): §13 hands the borrowed view
over "the moment their first stance exists — the vouch-back", so the
band leaves at the member's first stance, not their landing — the
drawn third line is built on both clients and `borrowedView` answers
the inviter until reciprocation.

### 44 · The sensitive sheet still draws its own switch · *system* · **in progress**

Filed by the settings round 2026-09-09. `ComposeSensitive` drew the
system's only switch inline, correctly — one instance is a control,
not a component. There are now several, so `Switch` is a master
(`components/core/SettingsRow.jsx`), built to the sheet's own
geometry so the swap moves no pixel. The sheet has not taken it yet,
because the round's pixel bar admits only the round's own boards.
Swap it, re-render, and confirm the board is byte-identical; a copy
is never the answer. The small-rulings batch is taking the swap.

### 45 · What the post-card round could not finish · *design*

Filed by the W1/W2 conform lanes 2026-09-09. Three questions; none
blocked the card that shipped.

1. **The removal's `when` has neither a word nor a field.** `Removed`
   draws `when: "today"`, but the contract carries no removal
   timestamp (`updatedAt` documents the fold-winning update's
   promotion, a different fact), and "today" is a vocabulary the apps
   use nowhere else — every drawn age reads `now/35m/2h/3d`. Two
   rulings: the field (backend work rides on it) and the word.
2. **What a card older than three days reads.** No card board draws
   an age past `3d`; the date form (`06.09.2024`) is drawn only on
   `ReferenceRow` for the Explore surface. The apps ship the
   minutes/hours/days ladder unbounded, so a 90-day-old card reads
   `90d` today. Bless that, or draw the rung where the ladder ends.
3. **The collapsing top's "one non-shrinking block" wording vs the
   list's re-clamp.** Android's W1 lane found that collapsing the
   band and the bar as one 96dp block re-clamps the list, and the
   leftover scroll reads back as "at the top" — the region returned
   the instant it left. The shipped reading (the band rides the bar
   the top region already collapses) behaves as the boards intend;
   the master's wording could name it so the next builder doesn't
   re-derive the trap.

**Ruled by jakob 2026-09-09**, all three:

1. **The field is `redactedAt: DateTime`** on the record — null while
   FULL, set when the payload went REDUCED; the mark's own moment,
   distinct from `updatedAt` (in api-spec.md; backend work rides on
   it). **The word is the ladder's**: the mark's `when` speaks the
   same age vocabulary as every timestamp — `Removed` now draws `2h`,
   and "today" exists nowhere.
2. **The ladder ends at 30 days.** Ages read `now/35m/2h/3d` up to
   `30d`; anything older reads the date (`06.09.2024`, the form
   `ReferenceRow` already draws). One vocabulary, recorded in
   copy-voice.md "Ages". The apps' unbounded ladder is a conform gap.
3. **The wording is named** in `CograBand`'s docblock: the band rides
   the bar the top region already collapses — never a second
   collapsing block — with the re-clamp trap spelled out.

### 46 · What the tag round left standing · *design + system*

Filed by the tag round 2026-09-09. Five things it surfaced and did not
settle, each named where it was found rather than folded into the round.

1. ~~**The accessible stance path does not name its target.**~~ Taken by
   the small-rulings batch 2026-09-10: `StanceControl`'s skip-link names
   what it stances, the way the face beside it already does, and the
   boards that draw a stance repin. A page drawing three stance controls
   carried three identically-named buttons — the defect
   `TopicRemovable`'s aria-label ruling fixed for the ×, and the tag
   page's own via retires with it.
2. ~~**A staged reference still has no pair editor**~~ — **settled
   2026-09-10**: the row opens the pad in a sheet of its own
   (`RefPair`), and the tags-and-references sheet gained the settling
   row alongside it. Item 18 is closed; readme §13 *The citation's
   pair, and the settling row* holds the ruling, and *The batch's
   review* the same day gives the sheet the anchor face every
   pair-setting readout now wears.
3. **The picker's refused-name state is undrawn.** What an illegal
   character does at the field is the input-error round's shape and
   belongs to a validation pass. `TagPickerTyping` states the gate and
   previews the canonical name; it does not draw the refusal.
4. ~~**Whether an @-scoped search returns a tag is not settled anywhere.**~~
   Ruled 2026-09-10, and the round's drawing stands: an **@-scope hit is
   indirect**, and its second line says the route out loud ("tagged by
   @sol"). The scope never returns the tag itself as a direct hit — what
   a person's scope holds is their acts, and the tag is what one of them
   points at.
5. **The follow gesture has no surface.** The round drew it as the
   stance anchor on the tag page's header and jakob's review removed
   it: beside the entrance post's context it read as that post's
   stance readout, not a gesture toward the tag. An Affinity toward a
   Type stays real and pad-shaped; slice 3's round — the first that
   may ship a follow at all — owes it a home that cannot be misread.

### 47 · The bottom bar's re-tap ladder · *design* · **ruled + recorded**

Ruled by jakob 2026-09-10 and recorded the same day: readme §13 (*The
bottom bar's re-tap ladder*) carries the ruling, `BottomNav`'s master
and prompt carry it as the component's behaviour contract, and
`graph.json`'s twenty-four active-tab edges say it instead of *already
here*. The design work is done; what is left is conformance.

**Both apps do nothing on an active-tab tap** — Android's `toTab`
navigates with `launchSingleTop` and has no re-tap branch, the web's
slot is a plain `next/link` — so rungs two through four are owed by
both:

1. **Pop to the tab's root** when the tap comes from deep in the
   current tab, keeping the root's scroll.
2. **Scroll to the top**, animated, when the tap comes from the tab's
   root and the reader is scrolled.
3. **Refresh the feed** when the tap comes from the feed's root at the
   top. Explore, Wallet and Profile do nothing there — the rung is a
   no-op by ruling, not by omission, and must not grow a behaviour to
   look consistent.

**Rung one is unevenly built.** Android already restores a tab's stack
and scroll and already pops to the root from a drill-in, so it needs
only the active-tab branch. The web restores the feed alone, through a
module-scope memory; Explore, Wallet and Profile remount fresh, and
giving them the same recall is web-side work with no Android twin.

**The web has no pull gesture**, so the ruling's second refresh path is
unbuilt there. Its feed view states the absence as intent — new posts
come from a reload or from Retry — and that comment is now wrong: the
ruling gives the feed a pull-down at the top. The indicator stays the
platform's own on both sides; nothing is drawn for it.

### 48 · The edit's alterable body · *design + implementation* · **drawn 2026-09-10**

Found by jakob hand-reviewing the small-rulings batch: the body line
blessed that day says an edit "may flip the kind outright", and the edit
board drew a gallery nothing could alter — no add control, no way to
reach a words body, and a picked row whose manager stood over the
composer's pick step rather than over the edit. Ruled and drawn the same
day; readme §13 *The edit body round* holds it.

**Drawn**: `EditPicked` (Show all over the edit) and `EditWords` (the
words body, one board for a words post's edit and for the media post
whose last picture just left), the add control and the blessed body line
on `EditCompose`, the whole-body line on `EditComposeVideo`, and both
removal edges pointed at `EditWords`.

**Two lines await blessing.** `A video is the whole post.` is the
staging line with the wizard's "Its cover comes next" trimmed, because
the cover is on the edit's own screen. `+ Add pictures · 2 of 10` is the
established add grammar carrying the post's cap for the first time; the
comment scale already draws its `· 1 of 4` twin.

**What the implementation owes.** Both apps draw the edit's media as a
readout. The add path, the manager over the edit, and the kind flip are
new client work on top of item 37's invariant — one seal, one act count,
all-or-nothing — which the flip does not move: a body change is part of
the content edit, not an act of its own, so the foot still counts three.

**Left open by the round**: what an edit does with per-picture
descriptions when the pictures it described are replaced, and whether a
words body that flips to media keeps its text anywhere recoverable. The
boards say only that the field goes; neither question is a drawing.

### 49 · The video-cover round · *design* · **built**

Filed from the implementation session's media handoff; jakob ruled all
three questions in the design session the same day (the full record:
dev-state `cogra/tmp_dev/2026-09-10-video-cover-round-rulings.md`).
Runs as its own round after the small-rulings review lands.

1. **`CoverCrop` is wired into the wizard on both platforms.** Every
   gallery-sourced cover passes the locked crop at the clip's ratio
   before upload; frame-sourced covers skip it. Only the cropped export
   leaves the device. The sharing rule stands unrevised.
2. **The 4:5 feed clamp stands, confirmed explicitly** — "taller than
   4:5 is reserved for the reel scroller." The round draws all three
   clip shapes (horizontal, vertical, square) on one feed board so the
   presentation is verifiable; no clamp changes.
3. **No-cover is first-class, and the default is shape-keyed**: a
   vertical clip defaults to NO cover — the cover step collapses to an
   optional "Add a cover" door on details; horizontal and square keep
   the frame picker. Shape alone decides, never length. An autoplaying
   video with a cover looks broken — the cover flashes for an instant
   before playback — and a short-vertical author must not meet a forced
   step. The coverless card's face is the first frame, cropped exactly
   as the clip is; the capture-fails state gets drawn (gallery path
   alone, neutral tile when no frame exists); comment scale inherits.

The edit surface reconciles with ruling 3 in this round: a vertical
clip's edit shows the same optional door, never a cover row presuming
one exists.

**Built 2026-09-10.** Rulings in readme §13, *The video-cover round*.
Three boards: *Feed · the clip's three shapes* (a reference board, tall
by export, with the media cap pinned to a phone's — its own frame is not
a viewport), *Details · a clip, no cover* (the video path's own details
stage, which it had never had, carrying the door), and *Cover · no
frames came back*. Four boards re-dressed: `EditComposeVideo` takes the
door, `ReplyVideoFailed` takes it at comment scale, `ReplyVideo` and
`CommentEditVideo` record which half of the field they draw, and
`FeedCover` records that the still under its play disc is a first frame,
not a cover. `MediaThumb` gained the neutral tile, `CoverRow` an empty
strip, `MediaAttachment` the note that a still may be a first frame.

**Three wizard edges were wrong and are fixed** (found in the round, not
ruled): `ComposeCover`'s back arrow reached `ComposePick` rather than
`ComposePickVideo`; `ComposeCrop`'s Next offered the cover step, a path
no post can walk; and the video path's Next landed on the picture path's
details board.

**Left for the apps** (conform, not design): the web wizard wires
`CoverCrop` into the video path and stops uploading covers uncropped;
both apps key the cover step on the clip's shape and ship the door on
details and at edit; both draw the no-frames state. The five
mis-measured dev rows were backfilled 2026-09-10, before the round.

**Candidate copy awaiting blessing** — the door's label *"Add a
cover"*; the line under it, on all four surfaces that draw the door,
*"It plays the moment it is on screen, so it starts on its own first
frame."*; the no-frames caption *"This clip gave no frames — choose a
picture of your own, or leave it without one."*; and the neutral tile's
*"No frame."*

### 50 · The tag pad · *design + implementation* · **drawn 2026-09-10**

Ruled by jakob 2026-09-10, drawn the same day, and revised by his
review 2026-09-11: a staged tag's pair is set on the pad over a field
whose confidence runs 0 to 1 and whose relevance runs from the floor —
0.01 — up to 1, the readout is one glyph from a thirteen-anchor table of
the tag's own, and untagging is a control in the edit's foot rather than
a value a drag can reach. `TagPad` and `TagPadCompose` carry it; readme
§13 (*The tag pad*, *The tag field's floor, and the untag*) holds the
rulings and the anchors' coordinates. The design work is done; what is
left is below.

**Both apps ship the two sliders.** Slice 2.3 built the tag pair as
relevance and confidence tracks on Android and web alike, and the pad
is now the drawn editor, so both owe the change. `StancePad` already
takes `ranges`, so what the clients need is the same bound — the floor
included, it being the contract's — the tag's four poles, and the
thirteen-anchor lookup, none of which the stance pad can supply, the two
tables being deliberately disjoint. Both owe the two contexts as well:
the composer's pad carries no un-tag control, the edit's does.

**The anchors have not been through `copy-voice.md`.** The table's
thirteen glosses are the words the boards draw and speak, and they are
ruled, but a copy pass has not read them as a set against the guide's
register. `Un-tag`, the edit pad's foot control, goes with them — the
reader's word for the act (api-spec's own noun for the r-0 record),
ruled 2026-09-11; the `Withdrawn:` line and the acts card's "Tags
withdrawn" keep the register's record-speak for the result.

**The contract's default reads oddly through the table.** A tag opens
at relevance +0.1, whose nearest anchor is 🔍 "had to look, but it's in
there" — a fair reading of the number and a strange thing for an author
to say about their own post's tag. Either the low-defaults value is
wrong for a self-declaration or the lowest aboutness band is, and
nothing here settles which.

**The chip's × at an edit is ruled** (jakob 2026-09-11): the × stays,
and it asks for the same staged withdrawal the pad's `Un-tag` does —
two doors, one act, because a reader who just wants the tag gone should
not need the pad roundtrip. A composer's × unstages on the spot as
ever; the graph's edit-board × edges already read "the tag leaves the
edit", which covers both doors honestly.

### 51 · The length caps and pulls the f2 lanes filed · *status: ruled same day*

Filed by the f2-droid lane 2026-09-10 as a pull-to-refresh + pad-inset
prompt, renumbered here because the design side's items 47–49 landed
first — and both asks were ruled the same day: pull-to-refresh exists
on every full-screen scrolling root with the platform's own indicator
(item 47 / readme §13), and the parked pad's one number is 16 (the
ReplyPad board's hand-spelled 24 was the drift). What stands from the
lane's filing: the post veil face's remaining divergences, `HelpDot`'s
geometry drifting from its board while its KDoc claims conformance,
item 30, and four surfaces still using spinners as loading states —
each named in PR #667's body.
### 52 · The length caps have no affordance · *design*

Filed by the caps lane 2026-09-10 (renumbered at integration, finally 52), which enforced the title cap (100
characters, jakob's ruling) end to end and found no drawn way to say so.
Three things the boards do not carry, each named where the lane hit it.

1. **No field states its cap before the field refuses.** `ComposeDetails`
   draws a Title field with an "Optional" note and nothing else, so the
   author learns about the hundredth character at the hundred and first.
   A counter, a remaining count, a meter — which of those CoGra draws is
   undrawn, and it is the same question for the describe sheet's alt
   text (1000) and for whatever the description and the sensitive reason
   are eventually capped at. The lane shipped the refusal alone: the
   message where the words are, and the step's Next disabled.
2. **The 2.0 field atom draws no error state at all.** The web
   `TextField` carries an `error` slot its own note calls "the one place
   the failure role is spent"; `CograTextField` carries nothing of the
   kind, so the two clients say one refusal in two shapes — under the
   label on web, a house `ErrorLine` below the field on Android. One
   drawn field-error state would close that, and would give the alt-text
   cap a home on Android, which this lane left unmirrored rather than
   invent one inside the drawn `DescribeSheet`.
3. **A cap and its refusal are one component's problem, drawn once.**
   Item 46.3 filed the same gap from the tag side — "the picker's
   refused-name state is undrawn" — and this is its other half: the
   topic name, the title and the description are three fields with three
   caps and no shared drawn answer for what a field does when the words
   are too many. Worth one round rather than three.

**2026-09-11.** The caps-2 lane settled every number the affordance
round must design for — jakob's ruling, enforced end to end the same
way the title was. In Unicode scalar values, the unit every one of
these counts in:

- Title — 100
- Alt text — 1000
- Description — 500
- Words-body (a Post's `content`) — 5000
- Comment body — 2000
- Sensitive reason — 140
- Display name — 50
- Bio — 500
- Website URL — 2048
- Device label — 100

Password maximum (128) is implementation-side only — Argon2 cost
bounding, never drawn as a counter or meter — and sits outside this
affordance round's scope.
