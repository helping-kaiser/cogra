# CoGra Design System · `guide:design:design-system`

CoGra (Content Graph) is a social network built on real relationships
between people. What you see is shaped only by the connections you make.
The design carries that as *tone*, never as on-screen vocabulary.

This folder is the design system both CoGra clients read from: colour,
type, shape, motion, components, copy, and the stance control. It is a
recreation for design work — not the production source. Where a value
here differs from the product source, the product source wins.

---

## Scope — what belongs in here

The line is worth stating, because it is easy to cross and expensive to
uncross.

**In the design system:** components, their rules, and the reasoning
behind those rules. Tokens. Copy conventions. Anything a consumer needs
in order to build a screen this system has never seen.

**Not in the design system:** whole screens, and flows between them. A
screen is a *design* — it decides what a particular surface says, in what
order, for one product moment. Put one in the card grid and it starts
behaving like a specification: consumers copy the layout, the layout goes
stale, and the components underneath it get bent to keep the picture
true.

So screens and flows live outside the card grid — in a design session of
their own — and the traffic runs one way: **a design
session invents, and whatever it invents that is genuinely reusable gets
ported back** as a component with its rule written down. A rule
discovered while drawing a screen is worth more than one reasoned in the
abstract; the screen it came from is not.

One case that looks like an exception and is not: a rule *about*
composition, like "nothing in a post's affordance row may take
`primaryContainer`", belongs here even though it is a statement about
screens — it lives on the component rather than in a picture of one.

---

## 1. Sources

Everything in this system was read out of one attached codebase and one
uploaded file. Nothing was invented from memory; nothing was recreated
from a screenshot.

| Source | What it gave |
|---|---|
| `cogra/` (attached local codebase, read-only mount) | the whole system |
| `cogra/docs/implementation/design.md` (928 lines) | the written design system — §2 colour, §3 type, §4 shape/spacing/motion, §5 iconography, §6 components, §7 copy, §8 the stance control, §9 honesty surfaces, §10 accessibility, §11 the mark |
| `cogra/design-tokens.json` | the generated palette contract both clients pin to |
| `cogra/web/src/app/globals.css` | the web token layer — palette, the fifteen type roles, the five radius rungs |
| `cogra/web/src/lib/ui/*.tsx` (23 components) | the component inventory and its exact class strings |
| `cogra/web/src/lib/stance/*.ts` | the stance model, anchor table, pad geometry, parking |
| `cogra/web/src/app/**` | the product screens — feed, post detail, profile, compose, login, join, key, settings |
| `cogra/android/core/designsystem/**/*.kt` (14 files) | the Android twin of the same inventory, for parity checks |
| `cogra/android/app/src/main/res/font/figtree.ttf` | the real Figtree binary, copied into `assets/fonts/` |
| `cogra/docs/assets/cogra-mark.svg`, `cogra/web/src/app/icon.svg` | the mark and the app tile, copied verbatim into `assets/` |
| `uploads/cogra-mark.svg` | the same mark, uploaded separately |

No Figma file, no design deck, and no slide template were provided, so
this system contains no slides.

---

## 2. Product context

CoGra is the graph-architecture exploration for **Peer Network**'s next
evolution: a platform where the social graph and explicit user
interactions drive feed ranking instead of an AI content algorithm. It
runs as a Layer 2 on the PeerNetworks Layer 1 substrate — Layer 1 owns
the public graph and its admission rules, CoGra owns feed, rewards,
display, and community policy.

What that means for design work:

- **The graph is fully public; reading needs no account.** Every read
  surface renders for an anonymous viewer, and the app frame is the same
  for members, applicants, and guests. A slot that needs an account asks
  on tap — it never bounces the reader out of the read.
- **Membership is by invitation.** A new account is an *applicant* until
  its inviter approves it; applicant vs member is expressed as cards in
  the shell, never as different navigation.
- **Writes are signed on the device.** A post, a comment, an edit, and a
  stance are each a signed, priced act. The UI's honesty obligations
  (§9 of `design.md`, §8 below) follow from that.
- **Numbers are in scope.** Ranking is not a black box, so a surface may
  show what something scored — provided every number shown is
  explainable and the detail is layered.

### Surfaces represented here

| Surface | Where |
|---|---|
| Web app (Next.js, Tailwind v4, Apollo) — the primary product | its components and rules are this system; its screens are designs, made in design sessions |
| Android app (Compose, Material 3) | not recreated; its design rules are identical by contract, and the web kit is the faithful surface |
| Marketing site, docs site | none exist in the source |

---

## 3. Content fundamentals

How CoGra writes. Every example below is copy lifted verbatim from the
source.

**Write from the reader's side, in active voice.** A control says what
will happen; the confirmation says what happened.

- Control: `Sign and publish` · `Sign comment` · `Sign the edit` · `Set`
- Confirmation: `Signed — it's in the thread now, still settling.`

**Second person for the reader, first-person plural only for the
system's own acts.** "You" is the reader; "we" appears only where the
service did something on the reader's behalf.

- `Your key isn't on this browser`
- `Current stance 😊 +0.55 / +0.20`
- `We sent you a verification link — open it to prove this email is yours.`

**Sentence case everywhere.** Titles, buttons, labels, dialog headings.
`Sign in or join`, `Keep browsing`, `New post`, `Edit profile`,
`Restore the key`. There is no title case and no all-caps in the UI.

**Implementation vocabulary stays off the screen.** Banned in
user-facing copy: graph, node, edge, vertex, tensor, weight, parameter,
decentralized, protocol, token, crypto — and the repo's own internal
words *valence*, *connection*, `p_d`, `p_i`. The two stance parameters
are labelled **"For or against"** and **"How much reaches you"** on
screen, and nothing else.

The rule is "as little as possible, as much as needed", not a word ban:
where the format *is* the content, name it exactly. A key export says
PEM, PKCS#8, hex, Ed25519, because an export nobody can feed to another
tool is not an export. Plain language frames the block; the precise
label sits on it.

**Calm, never urgent.** No clickbait, no countdowns, no badge farming,
no "Don't miss out". Failures are matter-of-fact and short:

- `That didn't send. Try again.`
- `Can't reach the server. Check your connection and try again.`
- `Can't reach the server — new posts can't load right now.`
- `That email and password don't match.`

**Honest about consequence and about cost.** Anything priced says so
before it is signed, and anything half-finished says who acts next.

- `It takes 3 signed actions, each paid for separately.`
- `Your standing toward this post drops to nothing. It stops reaching your feed, you stop earning from it, and nothing passes on through you.`
- `Signing needs your key, which isn't in this browser — the write waits as pending.`
- `Nothing was signed just now.` (the first line of the coach mark)

**Empty and waiting states are written, not blank.**

- `Nothing here yet — write the first post.`
- `Nothing here yet.` (a profile's chronicle)
- `No comments yet.` · `Loading…` · `Checking where you stand…`
- `Working out where this leaves you…`

**Guest copy invites, it does not nag.**

- `You're browsing as a guest — sign in or join to post and vouch.`
- `Join the conversation` / `Posting and profiles need an account.` /
  `Keep browsing`
- `Just looking? Browse the feed →`

**Emoji: yes, in exactly one place.** The twenty-anchor stance readout
(§8) plus 🤷 for a zero standing and 😐 for a control at rest. These are
*system* emoji rendering a value, not decoration. Emoji never appear in
headings, buttons, marketing copy, or empty states. The single arrow in
`Browse the feed →` is the only other glyph used as punctuation.

**Numbers.** A stance pair is always signed and always two decimals:
`+0.40 / +0.20`, `−0.90 / +0.30`. Valence first, matching the pad's
horizontal-then-vertical order. Counts are spelled with their noun:
`1 signed action` / `3 signed actions`.

**Money** is `MoneyFigure`'s and never formatted by hand: two decimals,
thousands grouped (`12,500.00`), the CGT mark trailing where a unit word
would sit. Dust is `< 0.01` — never `0.00`, a shown number that lies —
with the exact value one layer down; zero is `0`, plainly. Amounts are
never negative: a minus is an outflow on a history line, `signed` opts
inflows into `+`, dust never signs, and direction never carries a
colour. The word "CGT" appears on exactly one kind of surface — the
balance headline, mark and word adjacent, beside its "?".

**Punctuation.** Em dashes carry the asides. Ellipsis (…) marks
in-progress states. Sentences end with periods in body copy; labels and
buttons carry none.

---

## 4. Visual foundations

### Colour

Orange-led, seeded from **`#EF6C1A`**, generated with
material-color-utilities (`SchemeContent`, contrast `0.0`) — never
hand-picked. Screens read a **role**, never a hex. Both themes are
designed, not derived by inversion.

- **Ground** is `surface` (`#FFF8F6` light / `#151312` dark) — a warm
  off-white, not white. Raised regions step up through
  `surfaceContainerLow → surfaceContainer → surfaceContainerHigh →
  surfaceContainerHighest`; never an invented intermediate.
- **`primaryContainer` (`#EF6C1A`) is the loudest surface in the app**
  and is spent in one place per screen: the bar's compose action, and a
  committed stance. It is identical in both themes.
- **Secondary text is `onSurfaceVariant`**, never `onSurface` at reduced
  opacity — opacity breaks the token's contrast guarantee.
- `error` (`#A5004A` / `#FF6B95`) is for **failure only**, never for a
  negative stance and never for the honesty surfaces of §9. A negative
  stance is an ordinary opinion; colouring it as an error editorialises
  it.
- `success` (`#006C4F` / `#7CD8B3`) is a CoGra role outside Material's
  set, and it is a **teal, not a green** — harmonising a green into an
  orange palette lands it beside the olive `tertiary`, and red/green is
  the pair colour-blind readers lose.
- Every `on`-pair meets WCAG AA (4.5:1), verified at generation.
- **Material You dynamic colour is off.** The brand hue carries identity
  a wallpaper-derived palette would erase.

### Type

**Figtree** (variable, 300–900, latin + latin-ext), one family for
everything — headers included, with weight doing the work a second face
would. **Material 3's fifteen type roles, unmodified**: only the family
is swapped. There is no italic axis; italics are for emphasis in user
text, never a display device. The platform monospace appears on exactly
one class of content: recovery codes, key ids, seed entry.

Role assignment is fixed (see `tokens/typography.css`). Weight is
400 for display/headline/body, 500 for title-medium/small and all label
roles; 600–700 exist in the variable file for emphasis.

### Spacing and layout

A **4px base grid**. The web client's actual numbers: screen gutter
24px, screen stack gap 16px, card padding 16px, card inner gap 12px,
list gap 12px, content column `max-width: 42rem` centred. Touch targets
never below **48px**, the stance control's resting state included.

Fixed elements: the bottom bar (64px, `surfaceContainer`, hairline top
border, `env(safe-area-inset-bottom)` padding) and the collapsing top
region (sticky, `surface`). The stance pad is `position: fixed` at the
**lower centre of the viewport**, 16px above the bottom bar — 16px off
the bottom edge where no bar exists — the same place every time,
because muscle memory is part of the control (§13).

### Corner radii and cards

Five rungs, and no others: **4 / 8 / 12 / 16 / 28px**, plus the full
pill for every button at every size. Text fields take 4, cards 12, the
pad's field 16, dialogs and the pad 28. A square corner should look like
a mistake.

**A card is Material's *filled* card**: `surfaceContainerHighest` fill,
12px radius, 16px padding, **no border and no shadow**. The step up off
the page ground is what makes it read as a card; an outline on top would
be the *outlined* card, a different component.

### Elevation, shadow, transparency

Elevation is **tonal**, through the surface-container roles. There are
no drop shadows in the product — a snackbar lifts off the page with
`inverseSurface`, not a shadow. Shadows, where a future surface needs
them, stay soft and never manufacture urgency.

Transparency and blur are almost absent by policy: the dialog scrim is
`scrim` at 50%, and the only other translucency is the resting stance
face at 40% opacity + grayscale, which means "no standing yet". Blur is
reserved for the sensitive-content veil of §9 (gentle, tap to reveal) —
not yet built. No frosted glass, no protection gradients: type sits on a
solid role, so it never needs a gradient to survive.

### Borders

One hairline weight, 1px. `outlineVariant` for structural separation
(the bottom bar's top edge, `<hr>`, the pad's inert centre-lines);
`outline` for a control the reader can type into or press (text field,
outlined button). Nothing carries a 2px border.

### Motion

**M3 standard easing and durations. Motion clarifies where something
came from; it never performs.** Reduced-motion preferences are honoured
on both platforms. The two motions that exist in the product:

- the collapsing top's 200ms `translateY(-110%)` exit — it hides only
  once half its own slot has scrolled past, and returns only after about
  a third of a screen of accumulated upward scroll;
- the pad's bloom on a 500ms hold (Android's platform long-press
  timeout).

**Screen transitions are defined here** (`tokens/transitions.css`, and the
Motion card *Screen transitions*), because the product defines none and
every consumer was inventing one. Forward is 300ms, in from 12% of the
screen's width with a fade, emphasized-decelerate; the outgoing screen
leaves half as far, accelerating. **Back is the same motion reversed at
200ms** — returning is retracing, and a shorter move reads as backward
without a second drawing. A sheet comes up over 400ms and goes back down
over 200ms; a dialog fades in place with an 8px rise, never a scale.
**A dismissal exits the edge it entered from**, never sideways.
**Nothing inside an arriving screen animates** — no list entrance, no
stagger — and one transition is on screen at a time. Under
`prefers-reduced-motion` the swap still happens; it just does not travel
or fade.

No bounce, no spring, no parallax, no entrance animation on lists.

### Interaction states

Defined here, and **not** in the source — see §11. The values are Material's
own state-layer opacities, applied as a `currentColor` overlay so one
rule covers all three button variants:

- **Hover** — state layer at **8%**.
- **Press** — state layer at **10%**. Never a scale-down, never a shadow
  change: the direction is calm, and a control that shrinks under the
  thumb performs.
- **Focus** — a 2px `onSurface` ring at 2px offset (`:focus-visible`).
  `onSurface` rather than `primary` because a primary ring vanishes
  against a filled primary button, and this one reads on the page ground
  and on the loud surface alike, in both themes. Nothing removes it.
- **Disabled** — **38%** opacity on the whole control (Material's value,
  and the one place the AA guarantee is waived by convention: a disabled
  control is not an available target).
- **Selected** — colour only: the bottom bar's active slot moves from
  `onSurfaceVariant` to `onSurface` and to the filled icon cut; the
  chronicle filter swaps an outlined button for a filled one. No
  underline, no indicator pill.

Every pressable component carries `class="cg-state cg-focus"`, so
anything a consumer builds gets the same behaviour by adding those two
classes.
### Imagery

**An avatar is the actor's picture where they have one**, and a
**monogram circle** in `secondaryContainer`/`onSecondaryContainer`
where they do not — the *designed* placeholder, not a gap waiting to
be filled, and where a picture fails to load it is what shows.

**Photography now exists as mock material** (`assets/photos/`, ten real
photographs at true ratios — food, people, animals, scenery). It is
there so media layouts can be judged at real ratios, and it sets the
register: the everyday-post register, warm and human per §1 of
`design.md`, not brand stock. No grain filter, no duotone, no
illustration style. **Still never invent imagery** — a tile with no
source reserves its space and says what belongs there.

`MediaAttachment` carries the two rules the product settled on
2026-08-26: **portrait caps at 4:5**, and **video autoplays muted with
one global sticky mute decision**. See §12.

---

## 5. Iconography

**Material Symbols, one weight and one fill style throughout** — mixing
fills is the most common way an icon set starts to look accidental.

- **Android** takes them from the Compose `material-icons-extended`
  artifact via `core:designsystem`.
- **Web** self-hosts them: the shell's glyphs are inlined SVG paths
  copied from Google's `material-design-icons` set (Apache-2.0) in
  `web/src/lib/ui/icons.tsx`. There is **no icon font and no external
  fetch** in the product.

**The complete set the product uses today** — it is small on purpose:

| Glyph | Where |
|---|---|
| `dynamic_feed` | bottom bar, feed slot (one drawing for both selection states; selection shows in colour) |
| `person` (filled + outlined) | bottom bar, profile slot |
| `add` | bottom bar, the compose action |
| `search` | bottom bar, the explore slot |
| `account_balance_wallet` | bottom bar, the wallet slot |
| `visibility` / `visibility_off` | password field toggle |
| `settings` | profile top bar |
| `arrow_back` | every page header |
| `more_vert` | the post overflow menu |
| `chat_bubble` | the comments affordance on a card |
| `volume_up` / `volume_off` | a video's sound toggle |
| `graph_3` | the Post Score |
| `check` | the checkbox's mark — the system's own addition (§13's entry screens), not yet in the product's set |

**All fifteen are inlined** — path data in `Icon`, reference copies in
`assets/icons/`. All but `graph_3` are the classic **filled** 24px
variant, verbatim from `material-design-icons`, which is the exact set
and variant the product itself inlines, so web and Android match. **The hosted-font
substitution is gone** (2026-08-26): no icon font, no external request,
which is what the product does.

The web client's interim words (`Show`/`Hide`, `Settings`) and its `←`
character were placeholders for icons it had not inlined. The icons
exist now, so the glyph is the answer everywhere — with a label in the
accessibility tree, never a word beside the glyph.

**One derived glyph, recorded:** `graph_3` exists only in the newer
Material *Symbols* set and has no FILL-1 cut, so ours is the official
outlined path with the node counters closed — the hairline rings become
solid dots, at the weight of the filled set. Derived, not redrawn; the
geometry is Google's. It is the single exception to "do not draw icons",
and with it the drawing-language seam is closed: `graph_3` sits in a row
beside other glyphs. Details in `guidelines/iconography.md`.

Rules that hold regardless of source: icons are `currentColor` and
24×24; **an icon never carries meaning alone** — every icon-only control
has a label for assistive technology; emoji are never icons (the stance
readout is a value, not a glyph set); no unicode character stands in for
an icon.

## 6. The mark

CoGra's mark is a **lowercase g**. The bowl is the stance pad and the dot
inside it is a committed pick sitting in the for-it-and-want-it
quadrant — the letterform and the signature interaction are the same
drawing. It is drawn on Figtree's own `g` at weight 700, so it sits in
the wordmark without reading as a lighter letter.

`assets/cogra-mark.svg` is the source of truth, copied verbatim. **Every
other asset is generated from it and never redrawn** — a second drawing
is how a mark starts to drift. Do not redraw it, do not trace it, do not
approximate it.

- **Standing alone:** the letter takes `primary`, the pick takes
  `primaryContainer`. That is `assets/cogra-mark.svg`.
- **As a tile** (app icon, favicon): `primaryContainer` ground,
  `onPrimaryContainer` ink, `surface` pick — `assets/icon.svg`, with
  `assets/apple-icon.png` and `assets/favicon.ico` alongside.
- **Wordmark:** "cogra" set in Figtree, lowercase. The mark may stand in
  for the `g`, taking the real glyph's advance and left sidebearing.

---

## 7. Components

The inventory is the source's, not a generic set. Each family below
exists in `web/src/lib/ui/` (and, unless noted, in Android's
`core:designsystem` too).

| Directory | Components |
|---|---|
| `components/core/` | `Button`, `Card`, `Snackbar`, `JoinPrompt`, `DialogSurface`, `BottomSheet`, `SheetItem`, `SheetTitle`, `Chip`, `TopicChip`, `HelpDot`, `MoneyFigure`, `CgtMark` |
| `components/content/` | `PostCard`, `CommentCard`, `OverflowMenu`, `TopicsLine`, `ReferenceRow` |
| `components/forms/` | `TextField`, `PasswordField`, `Checkbox`, `LicenseChooser`, `LicenseTerms`, `RecoveryCode`, `SearchBar` |
| `components/navigation/` | `PageHeader`, `BottomNav`, `CollapsingTop`, `Icon`, `SegmentedFilter`, `FeedFilter`, `FilterTrigger`, `OrderSection`, `FilterSection`, `BorrowedViewBand`, `CograBand` |
| `components/compose/` | `WizardHeader`, `MediaThumb`, `PickedRow`, `DescribeCounter`, `PickedSheet`, `DescribeSheet`, `UploadStatusLine`, `UploadErrorLine`, `ActsCard` |
| `components/people/` | `MonogramAvatar`, `ActorChip`, `ProfileHeader` |
| `components/states/` | `EmptyState`, `LoadingState` |
| `components/honesty/` | `PendingMarker`, `EditedMarker`, `TransportError`, `SigningPending` |
| `components/stance/` | `StanceControl`, `StancePad`, `StanceReadout`, `StanceStanding`, `StanceLandingLine`, `StanceSlider`, `StanceAlternates`, `StanceCoachMark`, `SeveranceConfirm` |
| `components/proposed/` | `MediaAttachment`, `MediaGallery`, `MediaViewer`, `ExplainableNumber` — **not shipped**, see §7.1 |

Each has a sibling `.d.ts` (props contract) and `.prompt.md` (what &
when, plus a usage example). Each directory has one `@dsCard` HTML
showing its states.

**Buttons are Material's three and no others**: filled for the one
committing action on a surface, outlined for a secondary action, text for
a tertiary one. Both unfilled variants put `primary` on the **label** —
the label carries the emphasis, not the border. What separates a button
from a link is what the control does: performing an action is a button,
going somewhere is a link. A button dressed as an underlined link is
neither.

### 7.1 Proposed — built ahead of the product

A separate **"Proposed"** group in the Design System tab, and a separate
directory, so nothing here is ever mistaken for shipped truth. The test
for building ahead: **the source has already decided the rule and only
the instance is missing.** Where the semantics are still open, the
component is deliberately absent — anything in this system gets trusted,
which is what makes a guess expensive.

| Piece | Decided, so built | Open, so absent |
|---|---|---|
| `MediaAttachment` / `MediaGallery` | reserved aspect ratio before load; authored, never generated alt text; `surfaceContainerHigh` at the 12px rung; one lead tile plus two squares plus `+n`; the 4:5 cap bounding the tile rather than the picture; a height cap budgeted against worst-case card chrome so a whole post fits above the bottom bar; autoplay muted with one global sticky mute | **the sensitive blur treatment** — radius, overlay, reveal stickiness, and how 0–10 maps to blur-or-not |
| `MediaViewer` | media opens full-size from the detail view, never cropped, backed out of rather than navigated away from; real video controls here, sound only in a tile | — |
| `ExplainableNumber` | the shape §7 requires of every figure: a quiet inline value and one tap to its explanation, and nothing more — there is no expand-in-place variant, because the only figure the product has is the Post Score and its explanation is four screens deep | — |
| `SensitiveVeil`, `SensitiveScope`, `RedactedContent` | §9's two content states at opposite granularities: sensitive veiled per field or attachment but revealed per post, content kept mounted so revealing moves nothing; redaction taking the whole record and leaving its skeleton. No `error` colouring in either | whether a reveal survives leaving and returning to the post, and what the veil says when the author gave a reason |

The **five-slot bottom bar** is not in this group: `design.md` §6 already
fixes the slots and their order, so `BottomNav` simply accepts
`slots={ALL_SLOTS}` and every new layout should be checked against it.
A design that has only ever seen three slots is a design that breaks when
the bar grows.

The discovery slot is keyed `search` but **reads "Explore"**. The slot is
the product's way into the connections a reader has, and the obvious word
for that — "graph" — is on §7's banned list; "Explore" says what the
reader is doing rather than how it works. The mark was considered for
this slot's glyph and rejected: the mark is the product's identity, so a
tab wearing it would come to mean one screen; a letterform beside four
geometric glyphs breaks §5's one-icon-language rule; and the mark has no
filled/outlined pair, so the slot could not express selection the way its
neighbours do. It takes Material's `search`.

### Specified in the source but not built here

Called for by `design.md` §6/§9 and absent from the current product
code, so absent here too. They are the honest gaps, not omissions to
paper over:

- **Profile header**, **Topic chip**, **Collective** actor variant.
- **Removed placeholder** and **Sensitive veil** (§9) — specified,
  unimplemented.
- **Search** and **Wallet** surfaces — their bar slots exist in
  `BottomNav` (§7.1), the screens behind them do not.
- **Bottom sheets**, and the connection count on the profile header.

### Intentional additions

- `BottomSheet` (+ `SheetItem`, `SheetTitle`) — `design.md` §6 lists sheets in
  the scaffolding and the product never built one, so the overflow menu, the
  licence terms and every filter were each improvising. A sheet is a drawer
  the reader opened and can drop: it comes from the edge it goes back to,
  covers the bottom bar, traps nothing, and is never open beside the stance
  pad. `OverflowMenu` now presents as a sheet by default — both clients
  render at phone width, and a popover pinned to a 24px glyph is a desktop
  idiom.
- `SegmentedFilter` — the chronicle filter swapped an outlined button for a
  filled one, which works for two options and stops working at three.
  Selection is colour only (`secondaryContainer`), never an indicator pill,
  the segments are equal width, and the control is only for two to four
  **mutually exclusive** options over one list.
- `Chip` and `TopicChip` — the combinable counterpart, and a topic. Same
  pill, told apart by what they do: a chip acts, a topic navigates. 32px
  drawn, 48px tapped, selection colour only with no check glyph (a check
  reflows every label in the row as the reader picks).
- `FeedFilter` (+ `FilterTrigger`, `OrderSection`, `FilterSection`) —
  **what the feed actually needs**, and the reason the
  segmented row was the wrong control. Ten kinds of ranked content that
  combine (posts, comments, chats, messages, profiles, proposals, topics,
  items, campaigns, offers — `FEED_KINDS`, one list shared with search),
  forms of post that combine (photos and video with no text posts is a
  legitimate feed), an order that does not (ranked, the default, or
  newest) with the seen toggle riding in the same section (`OrderSection`,
  identical on the feed and on search), and what else the feed admits
  (sensitive, veiled; removed, as
  its skeleton). None of that fits in a row across the top of a screen, so
  it is one chip-shaped trigger reading the view back in words plus a
  sheet — and the trigger has a budget: the kinds always show, and once
  the exceptions stop fitting they collapse to a count ("Posts, comments ·
  3 changes"), because a pill that overflows has told the reader nothing
  and "far from the default" is the fact that matters there. It applies live — no Apply button asking the reader to guess — and
  switching every kind off is allowed: the feed says what is off rather
  than the chip refusing the tap. No glyph on the trigger: there is no
  filter icon in the inlined set, and an icon could not say "newest".
- `ProfileHeader` — §6 specifies it and the product never built it. Its two
  counts are the design work: **"Stances on them"** and **"Stances they've
  taken"**, because the thing being counted is what the repo calls a
  connection and that word is banned on screen (§3) — and one merged
  "followers" figure would describe a different product. No cover image: the
  largest thing on a person's screen should not be decoration.
- **Media avatars** — `MonogramAvatar` and `ActorChip` take a photo at both
  sizes. The monogram stays the designed fallback rather than a gap waiting
  for one, and a broken image falls back to it silently.
- `EditedMarker` — `design.md` §9 specifies the Edited marker and the
  product renders it inline in `post-view.tsx` rather than as a shared
  component. It is lifted into a component here because it is the twin of
  `PendingMarker` and a designer will reach for both together.
- `PostCard` / `CommentCard` — §6 names both in the inventory, and the
  product composes them inline on three surfaces instead. That is the
  source's own rule broken ("the moment a piece appears on a second
  surface it moves into the shared module — a copy is never the answer"),
  and the copies have already drifted, so they are components here.
- `EmptyState` / `LoadingState` — §6 requires "empty, loading, and error
  states for every list surface. Designed, not blank." The product ships
  bare `<p>Loading…</p>`. These are that requirement, built.
- `StancePad` — the pad's field, knob, and centre-lines are extracted
  from `StanceControl` so a static design can show the bloomed pad
  without driving the whole gesture. Same markup, no behaviour change.
- `Icon` — a wrapper over the four Material glyphs the product inlines in
  `icons.tsx`, so a screen names a glyph instead of pasting path data.
- `DialogSurface` — the dialog shell the product repeats verbatim across
  `join-prompt`, `severance-confirm`, and `stance-alternates`, extracted
  once so the three cannot drift.
- `StanceReadout` — the one-line "face, words, pair" reading the product
  builds with its `reading()` / `standingReading()` helpers, exposed as a
  component because designs need it outside the pad.
- `Checkbox` — the entry screens needed a binary opt-in ("Don't remember
  this account on this device") and neither the system nor the product had
  one styled. 18px box on the extra-small rung with the system's 1px
  hairline (M3's 2px checkbox border loses to §4's one-weight rule),
  `primary` fill with the inlined `check` glyph when checked, and the whole
  row — label included — as the 48px target.
- `BorrowedViewBand` — §13's borrowed vantage point, as a component: names
  whose view a guest or applicant feed is ranked from, carries the one
  sign-in-or-join entry, and subsumes the guest notice on those surfaces.

---

## 8. The stance control

CoGra's signature interaction, and the thing to get right. Full rules in
`guidelines/stance-control.md`; the short version:

Every interaction authors two independent continuous values in `[−1, +1]`
— on screen, **"For or against"** and **"How much reaches you"**. All
four quadrants are legitimate.

- **At rest** the target shows the standing: the face and the exact
  pair. A viewer with no standing sees a **muted, translucent 😐** —
  never a bare word.
- **A plain tap** commits a modest positive `(+0.1, +0.1)`. The **first
  tap ever teaches and stages nothing** — it opens the coach mark, whose
  first line is `Nothing was signed just now.`
- **Press and hold 500ms** and the pad blooms at the lower centre of the
  viewport. The drawn field *is* the value space: its corners are
  `(±1, ±1)` and the knob never leaves it. Horizontal runs Against → For,
  vertical runs Less → More, and those four words are drawn on the field.
- **Releasing the finger never commits.** Release parks the pick, an
  explicit **Set** signs it, **Cancel** or a press outside stages
  nothing.
- The pad shows the **face and the exact pair**, live under the drag,
  with the **landing** ("Resulting stance …") below the field — two
  different numbers, never merged into one line, each labelled above its
  own value.
- **The control never prevents a choice.** A pick that nets a standing to
  `(0, 0)` is *severance*: confirmed with its cost stated, never
  refused.
- The emoji face is a **lossy readout of the pick**, nearest of twenty
  anchors by Euclidean distance — dense in the for-it-and-want-it
  quadrant, sparse at the extremes. `(0, 0)` never speaks through the
  table: it gets 🤷.
- Paired sliders and direct entry are the alternate *and* accessible
  path; choosing one replaces the pad everywhere.

---

## 9. Honesty surfaces

Nothing vanishes silently, and none of these use `error` colouring.

- **Edited** — a soft `label-small` marker on `onSurfaceVariant`.
  Friendly, not forensic.
- **Pending** — `Still settling`, same register. Pending content shows
  **in full to every reader**, never greyed out or held back: the content
  is real, only its place in the order is not.
- **Redacted** — a calm placeholder where the content was, never a
  silent gap. Reads as a statement of fact. **Redaction is
  record-granular:** an `illegal` verdict removes the record's payload,
  and "the binding content commitment forbids partial rewrite, so there
  is no per-field redaction" — so **every authored field goes at once**.
  No title, no body, no description, no media, no licence. There is no
  redacted title beside a surviving body and no redaction inside a
  sentence; anything offering field-level redaction is lying about the
  substrate.

  **What remains is the skeleton, and the skeleton is the point:** the
  structural record, its witness, and everything it does on L1 — author,
  timestamp, thread position, standing, the stance a reader can still
  take, the score, the comments. No record ever leaves the graph and
  every redaction leaves a visible mark, so a reader is never left
  wondering whether something was quietly deleted. **Two reasons, two
  wordings** — removed for cause by proposal, or removed by the author's
  own choice; the docs require these to be distinguishable, since
  collapsing them lets a verdict hide behind an author's decision.
  A redacted node is **not feed material**: it is reached by direct link,
  by structure still pointing at it, or by a reader whose filter admits
  it. — `RedactedContent`, and `PostCard`'s `redacted` prop
- **Sensitive** — a gentle blur with tap to reveal, warm wording.
  **Veiled per field and per attachment.** `FieldModerationStatus` exists
  per field for exactly this: a title, a description, a text body, and
  *each* media attachment can be veiled alone, and per-field granularity
  exists for sensitive **only**. A post is never blanketed — that would
  throw away the one thing the data model went out of its way to keep.
  **Revealed per post**: one tap answers for everything inside, because
  the reader has already made the decision and asking again per item
  turns one decision into five. The content stays mounted under the veil
  and keeps its exact space, so revealing moves nothing on screen — which
  is also why text is blurred in place rather than replaced. No `error`
  colouring, no warning glyph: a neutral wash of the standard scrim and a
  plain `visibility` chip. The backend's 0–10 severity level is **not**
  read — it is for a future where a reader accepts one kind of content
  and not another; today a veil either exists or does not.
  — `SensitiveVeil`, `SensitiveScope`

## 10. Accessibility

Part of the bar from day one. Every `on`-pair meets AA. Colour never
carries meaning alone — stance is always accompanied by words. 48px
minimum targets. Every icon-only control is labelled. **Every drag
gesture has a non-drag equivalent.** Both themes are designed.

---

## 11. Divergences from the source

The system started as a faithful recreation. These are the places it now
leads the product rather than mirroring it — each one is a decision to
port back into `cogra/`, not a transcription error. Nothing here touches
the palette, the type scale, or the shape scale: those are generated or
test-pinned contracts, and changing them is a separate, larger decision.

### Foundations

**Screen transitions now exist** (`tokens/transitions.css`). The source
defines forward navigation, back, and the sheet entrance nowhere at all,
so each surface was inventing its own and two screens at the same level
could slide different ways. Filled with M3's emphasized easings at a
travel of 12% — enough to say where the screen came from, short of a
slide show — and one rule that makes back cheap to draw: **back is the
forward motion reversed at the shorter duration.** See §4, *Motion*.
Found needed while building the core loop, which had no way to say that
the post came from the card the reader tapped.

**Interaction states now exist** (`tokens/states.css`). The source
defines no hover, press, or focus treatment, which left every consumer to
invent one. Filled with Material's own values — 8% / 10% state layer, a
2px `onSurface` focus ring, 38% disabled — which is how the rest of the
system already resolves a silence in `design.md`. Every pressable
component carries `cg-state cg-focus`.

**Icons are inlined, all of them** (2026-08-26). The product had exported
four; the rest arrived as SVG and went straight into `Icon`, so the
hosted-font substitution is gone and this system matches the product's
own no-external-request rule.

### Dialogs

**Emphasis goes to the outcome a distracted reader should land on.** M3's
dialog vocabulary is text buttons only, and the source follows it, which
weights every choice equally. Instead:

- The **guest prompt** fills its affirmative — joining is the one
  committing action on that surface. `Keep browsing` stays a text button
  and stays first, so nobody is nudged into signing by thumb position.
- A **destructive** dialog inverts that: the *safe* action is filled and
  keeps the right-hand slot, `Sever` stays a text button on the left.
  Severance is still one tap away — the control never prevents a choice —
  it just stops being the default-looking one. No new colour: severance
  is a deliberate act, not a failure.

### The stance control

**A stance reads as face + pair, never face + words + pair.** Three
encodings of one value is two too many, and the words are the redundant
one. **They are not deleted, they move to the accessibility tree:** an
emoji's own accessible name is "slightly smiling face", never "Like
this", so every readout pairs an `aria-hidden` visual with a
screen-reader-only `"Like this, For or against +0.55, How much reaches
you +0.20"`. Without that the change would become colour-alone
signalling, which §10 forbids. The snackbar keeps its words outright: a
transient line is read away from the pad, so it *is* the accessible text.

**The axes are renamed and their ends are named.** `How you stand` →
**For or against**, `In your world` → **How much reaches you**, with
`Against`/`For` and `Less`/`More` drawn on the pad's field and under the
sliders. The originals were the repo's own framing rather than words a
reader could act on, and a square with no edge labels taught nothing.

**Three labelled readouts, formatted alike.** `Current stance` ·
`Your pick` · `Resulting stance`, each a label with the face and the
numbers on the line below it. The source ran them together as sentences
("Where you stand now: …", "This leaves you at: …"), which made three
different numbers read as prose.

**Both help affordances exist, and both replace the body they sit in.** A
circled `?` in the corner of the pad and of the alternates dialog. The
pad's four lines cover what the field means, what commits, why the pick
and the resulting stance differ, and what severing costs; the
alternates' first line instead teaches the thing two sliders cannot —
*two values, not one*. Neither grows below its surface: on the pad that
would push `Set` away from the thumb, and in the centred dialog it would
move every button. `Set` is disabled while the pad's help shows.

**The coach mark says less** — two facts (a tap signs `+0.10 / +0.10`; a
hold opens the pad) instead of five at the moment a reader is least
willing to read. `Nothing was signed just now.` stays: it is the line
the mark exists for.

**The non-drag route is not drawn, and it is renamed.** `Choose values`
was a `primary` text button beside every stance, so a feed of twenty
posts carried twenty copies of a control duplicating the one next to it —
and "values" named nothing a reader could place. It is now
`Choose your stance`, visually hidden until focused. §10's "every drag
gesture has a non-drag equivalent" is satisfied by the equivalent
existing and being reachable, not by it being on screen twenty times.

**One alternate control at a time.** The source shows sliders *and* typed
fields together whenever neither is the stored input. Sliders lead;
`Type exact values` swaps. §8.6 asks that both routes exist, not that
both are on screen.

**Severance states the raw total first, the cap second.** §8.3 requires
the raw sums wherever cost is explained, but leading with the clipped
fold makes them read as broken arithmetic — "my stance is +1.00, so why
does walking it back take +1.40?". The total is what the reader built up;
the cap is what routing reads of it. The cap line appears only when the
sum actually exceeded it.

### Content cards

**`PostCard`, `CommentCard`, `EmptyState`, `LoadingState` exist** — see
"Intentional additions" above. All four are §6 requirements the product
has not met yet, not new ideas.

**One affordance row.** The stance control leads, the Post Score follows,
then anything else the post grows — so each surface stops arranging them
itself. Nothing in that row may take `primaryContainer`; the stance knob
already spends the screen's one loud surface.

**The licence moves off the initial view.** It is among the rarest reads
in the product and was competing with the content for the same glance.
It is now a `Licence terms` item in the new `OverflowMenu`, which every
post and comment carries — the row carries what a reader reaches for, the
menu carries the rest.

**The Post Score is a card prop, shown as `graph_3` plus the number.**
Not the word "Score", and never an emoji: the product's only emoji
vocabulary is the stance readout, and a second face on the same card
would make both unreadable. Uncapped, negative allowed, never coloured —
`error` is failure, and a low score is not one.

**Media runs full-bleed** and is the largest thing in the card, with the
title above it and the caption clamped below behind a `More` opener. The
author chip still leads: §1 is not negotiable even where every other
product puts the picture first.

### Small fixes

- `PageHeader` owns its band: 48px tall, its own 12px side padding, and a
  **48px** square back target. It used to grow a 24px glyph to a 44px
  target with `margin: -10px` — under the 48px minimum, and a bet on the
  caller supplying 24px of gutter, so inside a surface with none the
  target bled off the edge and was clipped. Found while building the core
  loop.
- `PostCard` and `CommentCard` take **`taught`** and **`onCommit`** and pass
  both to the stance control. Both cards used to hardcode `taught`, so the
  first-tap teaching could never happen on a real feed and a shell could
  not keep a stance a reader signed. Both are facts the *shell* owns — a
  card in a feed of twenty cannot know whether this is the reader's first
  tap ever — so they default to today's behaviour (`taught: true`) and a
  surface opts in. Found while building the core loop.
- `StanceControl` re-syncs `taught` when the prop turns true, the way it
  already re-synced `bundle`. Without it a shell that flips "taught" after
  the first coach mark taught again on the next card down.
- `Snackbar` carries the whole `body-medium` role, not just its size —
  mounted under a heading it inherited the wrong weight.
- `Snackbar`'s bottom offset is a prop. The source hardcodes 80px to
  clear the bottom bar, which leaves it floating on every task flow that
  has none.
- `RecoveryCode` sets the code in `body-large` mono, not `design.md`'s
  `title-large`: a real code is 26 Crockford characters in 5-5-5-5-6
  groups, which cannot hold one line at 22px inside a card at mobile
  width — and the one-line grouping is the point. The size gives way, the
  wider tracking stays. Found while building the entry section.


---

## 12. Answered by the product — 2026-08-26

One hand-off closed most of the open list. Split into what is now built,
what is design-ready and unbuilt, and what is still open.

### Built from these answers

**Video autoplays, muted, while on screen — and mute is one global,
sticky decision.** Unmute one clip and the next one down is already
unmuted; mute it again and they all go quiet. The reasoning is the
product's: tapping every clip is friction with no upside, and a per-video
mute makes a reader re-decide the same thing on every scroll. This is the
one place "calm" yields — CoGra is meant to feel like a state-of-the-art
social platform whose differences are the graph and the earnings, not a
quieter video. Playback is tied to visibility (half-visible starts,
leaving stops), which is where the calm is kept. A video wears **one**
control, sound; no play/pause, because presence on screen *is* the
policy.

**Portrait caps at 4:5, and the cap bounds the tile rather than the
picture.** A full-height tile eats a phone screen, which is the opposite
of a scrollable feed — so the tile stops at 4:5, and a taller frame is
**fitted whole inside it** with the reserved surface showing at the
sides. The layout never decides the author's crop. The bars stay plain
`surfaceContainerHigh`, never a blurred enlargement of the photo: that
invents image where there is none. The one exception is a gallery's
secondary squares, which crop because they are an index into the set
rather than the media itself.

**Tapping media in the detail view opens it full-size** (`MediaViewer`) —
contain, as large as the screen allows, backed out of with `arrow_back`,
Escape, or the backdrop, and the route never changes. In the feed the
same tap opens the post: a reader scrolling is choosing between posts,
not looking at one picture. A video takes real controls in the viewer,
where the reader is deliberately watching; in a tile it has only sound.

**A tap anywhere meaningless on a post opens its detail view** — title,
media or body, description (still clamped), the affordances, then the
comments. Anything with its own meaning keeps it: the author chip goes to
the profile, the affordances act.

**Comments get their own affordance in the card**, third in the row —
`chat_bubble` plus the count, the same shape as the score beside it. It
opens the *same* detail view, scrolled so the comments lead: the post and
its affordances sit just above the fold, so a short thread still shows
its post.

**Icons: all inlined, hosted font dropped.** See §5.

**Real photography** for mock material. See §4, *Imagery*.

### Design-ready, not yet built

**The score is "Post Score" to readers**, and its drill-down is
**four full screens, not nested containers**: FeedEntry → RankPath →
RankHop → the raw records. The reason for screens is that a container
would get confusing at four levels; the risk is the reader feeling shot
through a portal, so **every level carries a small cover of the post it
came from**. The visual register is **graph, paths, connections — not
statistics**. The score is a signed real, roughly ±4–8 in practice,
never normalised, and negatives are rendered plainly.

**Zero exists only as severance.** A score of zero means no paths, or all
paths at (0,0) — nothing that happens naturally. A severed target never
appears in the feed, so the drill-down never has to explain a zero: the
severed case is a separate machinery (re-discovery of severed nodes) that
will be built later and will say plainly that it is inspecting a severed
node.

**Removed and Sensitive.** Removed: a calm placeholder in place of the
content, never a silent gap — a statement of fact, not a warning; author,
timestamp, and thread structure survive, and redaction is
record-granular. Sensitive: **a gentle blur with tap to reveal**, tuned
by the reader's own `content_filtering_severity_level` (0–10,
backend-stored). **The body blurs as one region** — media, text, and
description together, under a single veil with one reveal. The title
stays outside it, so a reader can tell what they are choosing to
reveal. Picture-by-picture blur inside a gallery is the UI this rule
exists to avoid. Neither state may use `error` colouring. Genuinely
open inside that: the literal copy, the blur radius and overlay, whether
reveal is session-sticky, and how 0–10 maps to blur-or-not.

**Feed, Search, Explore, Wallet, and the marketplace** are product
surfaces whose decisions are recorded in the product docs rather than
here — a feed is a list of ranked nodes rather than a list of posts,
Explore is a 3D view of the graph, Wallet holds balances and earnings,
and the marketplace is entered from both the feed and a profile. None has
produced a component yet; when one does, the component lands here and the
roadmap stays there.

**Both clients follow one design, 1:1.** Neither leads: web (at mobile
width) and Android render the same design, Material-aligned, differing
only in the browser around the web one.

### Still open

- Palette, type, and shape stay as they are until a problem shows up.
- The sensitive blur *treatment*: radius, overlay, whether reveal is
  per-item or session-sticky, and how 0–10 maps to blur-or-not. Its
  granularity is settled (blur only what is marked).
- Nothing on the icon list: the last gap closed with a derived FILL-1
  `graph_3` (§5).

---

## 13. Decided in design sessions

### Guest and applicant feeds borrow a vantage point — 2026-08-27

A feed is ranked from the viewer's own outgoing stances, and a guest
has none — so an anonymous reader would have no order but newest. The
substrate already permits the fix: reading is public, and a frontend
may serve any actor's view of the shared record to any reader. So:

- **An invite link carries its inviter's perspective.** A visitor who
  arrives through one browses the feed as the inviter sees it.
- **A bare arrival borrows the genesis moderator's view** — a human
  account, never a system one.
- **The borrowed view is always named**, in the top region, in place
  of the guest notice (which it subsumes): *"Browsing from @mira's
  view — join to build your own."* The label is what makes the
  ranking honest (§9); it exposes nothing the public record does not
  already carry.
- **The borrowed view persists through the applicant days** and hands
  over to the member's own view the moment their first stance exists —
  the vouch-back — which the inviter seeded anyway, so the feed barely
  moves at the handover.

To port to the product docs as an open-questions resolution.

### The entry flow — 2026-08-27

The landing is the live public feed; every ceremonial step (invite
entry, the vouch screen, the key ceremony, recovery code, sign-in,
restore) is a full-focus task screen with a back arrow, never a
bottom sheet. Canonical screens: `designs/canonical/`. During the
dev phase the collapsing top and the sign-in screen carry an APK
download line.

The recovery-code screen is a trap: no back affordance, and the only
way out is the code typed or pasted back. A think-twice dialog gates
entry to it. Where a bottom bar exists, the stance pad rests 16px
above the bar rather than the screen edge. First-time onboarding is
per-control, never a tour, and on the entry screens only the pad
carries it — what it is for, how it opens, that nothing signs until
Set, and that the input can be swapped in settings.

### The compose flow — 2026-08-27

Canonical screens: the COMPOSE rows of `designs/canonical/`; the
three ideation rounds live on the standalone "CoGra compose" canvas.

**The wizard is body-first** (the Instagram/YouTube spine): pick the
body → crop → (cover, video only) → details → the seal. "Write words
instead" is the text path and skips crop and cover. A post's body is
words OR media (one picture, a set, or one video with a cover),
never both — words beside pictures go in the description. Title and
description are optional. The pick screen splits into a picked tray
(one line, "Show all" on overflow; the first pick is the cover) over
the newest-first device grid, whose first tile opens the device's
own photos app — picks made there land in the tray. **The crop** is
Instagram's model: one shape for the whole post — Tall 4:5, Square
1:1, or Wide 1.91:1 — with drag-to-move and pinch-to-zoom framing
per picture; 4:5 as the tallest shape is what guarantees the feed
card's height cap (below). Wizard screens carry no step numbers
(paths differ in length; the title names the stage, only the seal
says "Last step").

**The seal is a place, not a popup.** "What you sign" lists every
act with its cost, aggregated per kind — one row per kind, its items
as small chips in one line, the sum at the row's end — and the batch
lands whole or not at all (resolves Q43). License collapses to one
line reading the author's default (an account setting; Public domain
until changed) and opens as a bottom sheet — immutable after
signing. Sensitive self-marking is one switch opening a bottom
sheet: it veils the body and the description; the title and topics
stay readable so choosing to look is informed; an optional reason is
shown on the veil. Every stance a write signs is disclosed and
adjustable: the post's own attachment on a one-axis pad (For/Against
only — your own post always reaches you in full), a reply's stance
on its parent on the full two-axis pad. The pad keeps its floating
card form everywhere; only license and sensitive present as sheets.

**Key absent is restore-first.** Nothing is staged server-side and
nothing is signed; the draft stays on the device, and the state
wears `tertiary` — a waiting state, never `error`. Leaving mid-write
keeps one local draft per target, on-device only; the draft is the
safety, so there is no discard confirm. Signing exits to the post's
own detail view wearing *Still settling*, with the snackbar
"Signed — it's in the thread now, still settling." An act that
expires unlanded gets a calm notice card in the shell: content left
every reader's view, nothing was spent, the draft is saved.

**A comment is text plus optional media** (deliberately asymmetric
to the post's XOR — an answer is words first), entered through the
thread's comment box, which is an entry, not a composer: it opens
the same full-focus flow pre-targeted, parent pinned — words, then a
one-act seal that discloses the stance on the parent. **An edit is
one screen and one batch**: the content edit plus topic and citation
changes ride together, the cost line reads the live total, and
tapping it opens the breakdown sheet. The license row shows
read-only with a lock. **Remove** is the erasure path: own-post
sheet → a think-twice dialog whose safe action is filled → the
visible mark. "Removed by its author" and "Removed under the
platform's rules" must never read alike.

**Citing** gets an explorer (posts by title, people by name/handle,
items by name, proposals by title, chats by name, campaigns by
anchor, offers via their item); comments and chat messages are cited
from themselves — every content's overflow menu carries "Cite in a
new post". Its result rows are the seed of the search design (item
9).

**Copy rule:** captions are one short line; the full explanation
lives behind a small "?" — at most one per screen, top-right of the
header or of the sheet/card it explains (the pads carry their own) —
opening a plain dialog: title, at most two short paragraphs, Close.
The eight dialog texts live in
[guidelines/copy-voice.md](guidelines/copy-voice.md). **Button
rule:** filled and outlined pills render a TRUE 40px tall (border
box) with 24px side padding and a 64px minimum width; header pills
render a compact true 32px; `sm` buttons 32px with 16px padding.

**Feed containers — rounded full-width cards.** A feed post is a
full-width container: the filled card keeps its 12px corners, tone,
and 16px text inset, but spans the screen edge to edge; media runs
the full width; 8px of surface between cards is the seam. Words
never touch the screen edge — only media does. **The height cap:** a
post card's collapsed form never exceeds the screen height minus the
bottom bar and the top safe zone — designed against the app /
downloadable-webapp viewport, not browser chrome. Collapse order:
media and the interaction row never shrink; tags and references
collapse to one line under the description; the title clamps to one
line, the description to two. The expanded detail view may exceed
the screen.

To port to the product docs: the sensitive self-mark field and its
fixed per-field policy, the default-license account setting, and
the edit batch carrying topic/citation acts.

### Comments live in a sheet — 2026-08-28

The thread moves out of the detail view into a bottom sheet, opened
by the comment affordance from the feed and the detail view alike —
the detail view is just about the post.

- **The sheet may fill the screen** up to a sliver below the top:
  the rounded corners keep a strip of the surface behind visible.
  The entry row (avatar + "Add a comment") is pinned at its foot.
- **Replies arrive collapsed** behind a "View n replies" line.
- **The thread is two levels deep on screen**: a comment and its
  replies, indented once. A reply to a reply flattens into the same
  level and opens with the @handle it answers — the mention is the
  structure. Mentions render in `primary`.
- The comment affordance is uniform everywhere: glyph plus count,
  muted, opens the sheet. (Supersedes the one-day-old where-you-are
  detail state — there is no "already among the comments" anymore.)

### Reference rows and signed pairs — 2026-08-28

A card never lists its references inline, and its topics line is
**one line on every variant: at most two chips, then the counts in
words** — `#coastroad #saltmarsh · 23 topics · 3 references`. A
clipped parade of half-chips says nothing; the counts are the
readable fact and the way in. They open the
**topics-and-references sheet** (on a detail surface the whole line
is the opener; in a feed the chips still navigate). The sheet is
the full set's home: every signed act gets one row — **leading
mark · name · the signed pair** — one row shape across every node
kind (`ReferenceRow`), reused by search's results (item 9).

- **The leading mark says the kind, without a word beside it.** A
  person keeps their avatar; a media post its cover; a text post the
  letter T as a tile; a topic its #; the rest carry node-type glyphs
  — proposal `how_to_vote`, item `inventory_2`, campaign `campaign`,
  offer `sell`, chat `forum`, comment `chat_bubble`. Item and offer
  deliberately do not share a silhouette (box vs price tag).
- **The pair is public record**: set at compose on each picked topic
  and reference (a changeable default of +0.10 / +0.10), edited
  through the reader's chosen stance input (the pad, or whatever
  their settings swap in), and displayed on the row for any reader.
- A signed reference is a compose-time act; an @handle typed in text
  is only a mention. They must not look identical — the mention is
  coloured text, the reference is a row in the sheet.
- Comments wear the same topics-and-citations line as posts
  (`TopicsLine`, shared) and the same overflow menu.

### The search rulings — 2026-08-28

Decided ahead of the search section's drawing (product side mirrored
as Q46 in docs/open-questions.md):

- **Order**: full match, then partial match, each tier ordered by
  the viewer's ranker — never newest by default. What the ranker
  cannot score falls to newest behind a **visible seam**; past the
  seam a row's rank gives way to its age (relative to one year, an
  absolute date after).
- **Controls**: an order swap (Ranked / Newest) and a "show already
  seen" toggle — default off since the feed-filter session
  (2026-08-28, flipping this session's first call): what you've
  seen stays out until you ask for it back. Seen = the card's
  impression entered the viewport; device-local, never a record,
  shared transiently with the viewer's chosen ranker. **The feed
  carries this same ordering section** (backlog item 19 — the
  canonical feed screens never drew the filter at all).
- **Scope operators**: `@handle <text>` and `#topic <text>` scope
  the query; the remainder matches the scoped author's own content
  AND the names of their acts' targets — a comment through its
  post's title, an offer through its item's name, a message through
  its chat's name. Comments, messages, and offers are thereby
  searchable and citable. Indirect hits are `ReferenceRow`'s
  two-line variant: the second line names the target ("on *Salt
  maps of the coast road*").
- **Ranks on every kind**, quiet viewer-relative numbers on the
  row's right edge; explained by the "?", drill-down waits for the
  Post Score screens (item 13).
- **The Explore tab at rest**: recent searches (device-local) plus
  a PROMINENT entry into THE SKY — the 3D graph view (item 16) — never a
  small side thing. Typing drops the Sky entry off the bottom
  edge; the screen becomes kinds filter, order controls, results.
- **Chats are public reads**: a chat result opens the chat's read
  surface for anyone; E2E chats show ciphertext but they show.
- **Built as the hybrid** (2026-08-28, after ideation): direction 1's
  rest (the Sky hero card) with direction 2's searching (the band
  gives way to the field; ONE worded trigger + sheet for kinds,
  order, and the seen toggle). A rank on a row wears the score's
  graph glyph, so the number is recognized before it is read. A chat
  message's mark is `send`; the chat that holds it stays `forum`.

### The feed's filter on screen — 2026-08-28

Item 19: item 4 built the filter and no canonical board ever drew it.
The rulings that put it on screen:

- **The trigger lives on the `CograBand`'s right edge.** A full-width
  band spent on identity alone is wasted space; the band's right side
  holds the tab's one working control. The whole band scrolls away
  with the top region and returns with it — the trigger rides along,
  never pinned.
- **Every feed view wears it, guests and applicants included.**
  Filtering is a read control; the seen list is device-local. The
  borrowed-view landing filters like the member's feed does.
- **The trigger speaks deviations only, on the feed and on search
  alike.** The default state is silence: "Posts" at rest, "newest"
  and "showing seen" only when flipped, and past the pill's budget
  the extras collapse to a count ("3 kinds · 4 changes" — drawn on
  the far-from-default board). Search's trigger at rest reads
  "Everything".
- **One kind list.** `FEED_KINDS` grows to search's ten and both
  surfaces share it — posts, comments, chats, messages, profiles,
  proposals, topics, items, campaigns, offers — and the word is
  **"Profiles"** everywhere, never "People".
- **One ordering section.** `OrderSection` — the Ranked/Newest swap
  with "Show what you've already seen" (default off — what you've
  seen stays out until you ask for it back) under it, one
  section because both answer "how is this list arranged" — is a
  master consumed by the feed's sheet and the search sheet alike, and
  `FilterSection` is the one sheet-section chrome every filter sheet
  uses. The filter sheet opens taller than the sheet default (88%)
  so the whole control is present.
- **The sheet carries its own "?"** (the pads' precedent): "The
  filter" dialog explains combining, live-apply, the seen toggle,
  and that the default lives in settings — the settings entry is
  its own design (backlog item 20). `SegmentedFilter` drops to the
  chips' 32px drawn rung: it lives among 32px chips in these
  sheets, and a taller pill beside them read as swollen.
- **Everything off is answered by the feed**, not the chip: the empty
  state names what is off ("Your feed admits nothing right now —
  every kind is switched off.") and offers the way back.

### Masters, variants, and screens — 2026-08-28

The Figma discipline, applied here: a component's ONE
implementation is its **master** (`components/**/*.jsx`); its
**variants** are the states its props reach, drawn side by side on
that directory's `@dsCard`; and every prototype screen **consumes
the master in the right variant** — never a copy of its markup.
Changing a master changes every screen that uses it; a copy would
drift, always. Concretely:

- Prototype boards are **generated** from `designs/canonical/
  screens/*.jsx` by `_build/render-screens.mjs` — a screen is JSX
  over the real components; never edit a generated `.dc.html`.
- A state a screen needs but no prop reaches is a MISSING VARIANT:
  add the prop to the master (as `StanceControl` gained
  `defaultOpen` and `PostCard` gained `sensitive`), never rebuild
  the state by hand in the screen.
- `Raw` markup in a screen is for the genuinely screen-local —
  content that exists nowhere else. The moment it appears on a
  second screen it becomes a component or a `_shared.jsx` helper.

**Below the masters sit the ATOMS** (2026-08-28) — the smallest
units, each assigned in exactly one place so swapping one updates
every surface that draws its meaning:

- **Colour, type, spacing, radius, motion** are already atoms: the
  CSS tokens (`tokens/*.css`). A component never states a raw value.
- **Glyphs** are atoms in `Icon.jsx` — path data assigned per name —
  and MEANINGS are assigned their glyph once in `NODE_GLYPHS` (a
  chat is `forum`, a chat message is `send`, …). A surface asks the
  map; it never picks a glyph for a node kind on its own. Kinds
  whose mark is not a glyph (avatar, cover, the T tile, the #) live
  once in `NodeMark` (`content/ReferenceRow.jsx`).
- The stance **anchor table** (`StanceReadout.jsx`) and the decided
  **copy strings** (`guidelines/copy-voice.md`) are atoms of the
  same kind: one assignment, many surfaces.

### Money figures — 2026-08-31

Item 11, settled ahead of the wallet (item 12) so its surfaces have a
figure to draw. The rules live in §3 (*Money*) and in
`components/core/MoneyFigure.jsx`; the spec board is the canonical
canvas's *Money · the CGT figure*.

- **One shape for every CGT amount** — balance, earning, tip, campaign
  amount, price: two decimals, thousands grouped, dust as `< 0.01`
  (exact value one layer down — every number stays explainable, and
  money is explainable by construction: a payout is a recomputable
  settlement leaf, a tip carries its transaction pointer), zero as `0`
  (a new member's true state, not a failure).
- **The unit is the mark, never the word** (jakob 2026-08-31 —
  spelling "CGT" on every figure doesn't look nice): `CgtMark`, the
  primary disc carrying the brand mark (cogra-mark.svg verbatim,
  knocked out monochrome — a lone C in a disc is any game's coin),
  1em, baseline-aligned, trailing the figure where the unit word
  would sit. Theme-correct through the primary pair; never a new
  colour rung. Decided over CG letters, a CG interlock, and c+dot
  (round 2, same day) — two letters smudge at 1em, and the logo is
  the one form no other product's coin can wear.
- **The word appears once** — the wallet's balance headline sets
  `unit`, mark and word adjacent so the reader learns the equivalence,
  and the headline's "?" (*What is CGT?*, text in copy-voice.md) says
  both are CoGra's own money.
- **Direction, never colour.** Amounts are never negative — balances
  are balances and payout shares floor at zero — so a minus is an
  outflow on a history line and `signed` opts inflows into `+`; dust
  never signs (its line's words carry direction); no green exists, and
  `error`-colouring an outflow would call spending a failure.
- **Pending amounts wait for the wallet session** (jakob 2026-08-31),
  where the surfaces that need them are drawn.
- The CGT Registry **precision is unpinned in the docs** (ledger.md
  names the registry entry, no value); the display rule is
  deliberately precision-independent — dust collapses to `< 0.01`
  whatever the chain's smallest unit turns out to be.

### The media slice — 2026-08-31

Drawn for the product's media rebuild (jakob's rulings, same day):
the five gaps its implementation lanes had been inventing —
alt-text entry, upload states, the multi-picture gallery, the
picked tray's Show all, profile-picture change — plus comment
media and comment editing.

- **The gallery is a pager.** Every picture in a post shares the
  post's one crop shape, so the feed card shows one frame at that
  shape, swiped, each picture whole exactly as the author shaped
  it — dots below, **dots only, never a "1/n" count pill**. The
  earlier lead-tile-plus-squares layout is rejected: its squares
  re-cropped deliberately shaped frames. `MediaGallery` renders it;
  the ratio vocabulary across media components is the crop ruling's
  (`tall` 4:5 · `square` 1:1 · `wide` 1.91:1 — 16:9 is gone).
- **Caps.** A post carries at most **ten pictures, or one video**
  (with its cover); a comment at most **four pictures**. The caps
  are authoring-side; the components render what they are given.
- **Upload starts after the crop.** The crop happens on the device
  and **only the cropped export is ever uploaded** — the original
  frame can hold what the author never meant to share. Comment
  pictures never crop, so they upload at pick. Progress rides the
  thumbnails as rings; a failed picture is marked on its tile with
  `Retry · Remove it` beside the row; **the seal gates** — "Uploading
  n of m — signing waits for the pictures", the sign button held
  until the content it signs exists.
- **Descriptions (alt text) are authored, optional, never
  invented** — the component rule made enterable: per picture from
  the details step (`Describe the pictures · 1 of 3 described`) and
  from the picked tray's **Show all** sheet, which is the
  per-picture manager: drag to reorder (first = cover), remove,
  describe. The describe sheet's "?" (*Describing pictures*, text
  in copy-voice.md) says what it is and that nothing is guessed.
- **Comment media is words-first**: pictures sit below the words,
  inset at the card's medium rung (an attachment, not the body),
  **capped at comment scale** so a comment never turns into a post,
  never cropped — a single picture at its own ratio, multiples in
  the same pager on a fixed square frame. **Comment editing**
  mirrors the post's one-screen-one-batch (words, pictures, topics,
  citations; license locked), entered from `Edit` on an own
  comment; the Edited marker is the same one posts wear.
- **The profile has ONE image — the avatar.** No cover, per the
  ProfileHeader ruling (a "cover" in older product notes was a
  misreading of it). Minimal flow for the slice: pick → circular
  1:1 crop → **its own seal**, because every profile change is a
  signed act ("Sign the change"; "?" *Changing your picture* in
  copy-voice.md). The full profile screen stays its own backlog
  item.
- **Sensitive veils the whole gallery**, never one picture of it —
  the open question in `MediaAttachment` closed.
- **The picked row carries no "Crop" or "Edit" links** (jakob, same
  day: "none") — the whole row is the affordance and opens the Show
  all sheet; re-cropping is the crop step's job, one Back away in the
  linear wizard. A second entrance to the same step is the two-menus
  pattern the system refuses. The shortcut links the details and edit
  boards had carried since the compose section are deleted.
- **Web picks through the browser** (round 3, from the implementation
  session's findings): browsers have no device-gallery API, so the web
  pick step replaces the newest-images grid with one calm region — the
  file picker button and a drop target ("Choose from your files" /
  "…or drop them here") — the caption, the picked tray, and the text
  path identical to the app's (*Pick · the web variant*).
- **The seal's total row carries the all-or-nothing subline on every
  multi-act seal** — "they land together, or none does" — and omits it
  on a single-act seal. It had drifted across the hand boards (on the
  key-absent and sheet states, missing from the seal itself); it now
  lives once, as `ActsCard`'s `note`. On the key-absent seal the one
  "?" belongs to the key notice (the *Your key* dialog), not the
  header — one "?" per screen, and the key story outranks the seal
  story there. Every "?" opens the house plain dialog (the pattern the
  *HelpDialog* board draws); the texts are copy-voice's.
- **The pinned M3 roles stay the default — no sub-roles.** The stray
  values the implementation session caught are conformed instead: the
  Cover badge to `label-small`, the full-focus writing bodies to
  16/24, the draft prompt's buttons to true button padding.
- **The wizard has two ways out, fixed** (jakob, round 4): **the
  header arrow steps ONE STAGE BACK**, never out of the flow — Details
  reaches crop with it, the platform back gesture does the same — and
  **the X leaves the whole flow from any stage, draft kept, with no
  confirmation** (nothing is lost: every leave keeps the draft, and
  the draft prompt is the return surface). The seal's own Back pill is
  the same one-stage step, labeled. `WizardHeader` is the master —
  every composer-flow stage wears it (post wizard, reply, edits, the
  profile picture); the X sits between the title and the stage's
  trailing controls so Next keeps the right edge. The em-dash rule
  stands unchanged (jakob, same round): em dashes carry asides,
  everywhere copy-voice says so.
- **The slice ships componentized** (`components/compose/`):
  `MediaThumb` (the authoring tile and its upload states), `PickedRow`
  + `DescribeCounter`, `PickedSheet` (Show all), `DescribeSheet`,
  `UploadStatusLine` (the seal's gate) + `UploadErrorLine`, and
  `ActsCard` (the seal's acts card, extracted when the profile seal
  became the third). All ten media-slice boards render from the
  pipeline; `TextField` grew the `corner` hint ("Optional") and `Icon`
  the `close`/`drag_indicator`/`lock`/`expand_more` glyphs.

## 14. Index

**Root**
- `styles.css` — the entry point consumers link. `@import` lines only.
- `readme.md` — this file.
- `backlog.md` — the ordered queue sessions pull from.
- `SKILL.md` — the Agent Skills wrapper.
- `thumbnail.html` — the homepage tile.
- `_build/bundle.mjs` — regenerates `_ds_bundle.js` (which the `@dsCard`
  HTMLs load) from the component sources after any `.jsx` edit:
  `npm install` once in `_build/`, then `node _build/bundle.mjs`.
  `_ds_manifest.json` is the claude.ai Design app's own metadata and is
  refreshed only by that app, on an explicit sync-back.

**`tokens/`** — `fonts.css`, `colors.css`, `typography.css`,
`shape.css`, `spacing.css`, `motion.css`, `transitions.css`,
`semantic.css`, `states.css`, `base.css`.

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing,
Shape, Motion, Brand, Stance) plus `stance-control.md`, `copy-voice.md`,
and `iconography.md` for the deeper dives.

**`assets/`** — `cogra-mark.svg` (source of truth), `icon.svg`,
`apple-icon.png`, `favicon.ico`, `fonts/figtree.ttf`,
`fonts/figtree-ofl.txt`, `icons/*.svg` (every exported glyph),
`photos/*.jpg` (ten real photographs at true ratios, mock material — see
§4, *Imagery*).

**`components/`** — see §7: `core/`, `content/`, `forms/`, `navigation/`,
`people/`, `states/`, `honesty/`, `stance/`, `proposed/`.
