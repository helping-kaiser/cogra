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

**Desktop is out of design scope until the mobile set is complete.** Both
clients render at phone width and that is what this system draws. A
desktop visitor gets whatever the mobile-derived layout gives — not
optimized, and accepted as such. The desktop variant is a design round of
its own, later.

**The canvas draws the whole app; each release builds its slice.**
Designing feature by feature would move the same surfaces every time a new
one arrived beside them, and every move is frontend work done twice — so
the boards settle the end state once and the apps add the pieces their
slice binds. An affordance whose destination is neither designed nor built
stays out of the apps until one exists: never a dead control, and never a
label that says what the code does not do (the feed's filter reads
*Newest* until the ranker ships, §13 below). A drawn surface a release does
not carry yet is staged, not divergent.

---

## 3. Content fundamentals

How CoGra writes. Every example below is copy lifted verbatim from the
source.

**Write from the reader's side, in active voice.** A control says what
will happen; the confirmation says what happened.

- Control: `Sign and publish` · `Sign comment` · `Sign the edit` · `Set`
- Confirmation: `Signed — it's in the thread now, still settling.`

**A completed action is confirmed by a snackbar, on both platforms.** The
snackbar is the confirmation; a line of the layout turned green is not one.

**Second person for the reader, first-person plural only for the
system's own acts.** "You" is the reader; "we" appears only where the
service did something on the reader's behalf.

- `Your key isn't on this browser`
- `Current opinion 😊 +0.55 / +0.20`
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

- `It signs 3 things, each paid separately.`
- `Your opinion of this post drops to nothing. It stops reaching your feed, you stop earning from it, and nothing passes on through you.`
- `Signing needs your key, which isn't in this browser — the write waits as pending.`
- `Nothing was signed just now.` (the first line of the coach mark)

**Empty and waiting states are written, not blank.**

- `Nothing here yet — write the first post.`
- `Nothing here yet.` (a profile's chronicle)
- `No comments yet.` · `Loading…` · `Checking your current opinion…`
- `Adding it up…`

**Guest copy invites, it does not nag.**

- `You're browsing as a guest — sign in or join to post and vouch.`
- `Join the conversation` / `Posting and profiles need an account.` /
  `Keep browsing`
- `Just looking? Browse the feed →`

**Emoji: yes, in exactly one place.** The twenty-anchor stance readout
(§8) plus 🤷 for a zero standing and 🫥 for a control at rest. These are
*system* emoji rendering a value, not decoration. Emoji never appear in
headings, buttons, marketing copy, or empty states. The single arrow in
`Browse the feed →` is the only other glyph used as punctuation.

**Numbers.** A stance pair is always signed and always two decimals:
`+0.40 / +0.20`, `−0.90 / +0.30`. Valence first, matching the pad's
horizontal-then-vertical order. What one signature commits is counted in
things: `1 thing, signed` / `3 things, signed together`, and the rows
that make up the total carry bare counts — the row's own label already
says what was counted.

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
- the pad's bloom when the stance face is tapped.

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
- **Focus** — the platform's own indicator: on the web a 2px `onSurface`
  ring at 2px offset (`:focus-visible`), on Android Compose's M3 focus
  treatment. `onSurface` rather than `primary` because a primary ring
  vanishes against a filled primary button, and this one reads on the page
  ground and on the loud surface alike, in both themes. Nothing removes it.
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
| `more_vert` | every overflow menu — a post's, a comment's, and either profile's actions row |
| `chat_bubble` | the comments affordance on a card |
| `volume_up` / `volume_off` | a video's sound toggle |
| `graph_3` | the Post score |
| `bookmark` | the unsave control on a Saved row — the system's own addition (the review-fix round), not yet in the product's set |
| `check` | the checkbox's mark — the system's own addition (§13's entry screens), not yet in the product's set |
| `photo_camera` | the avatar's change badge on one's own profile — the system's own addition (profile round), not yet in the product's set |
| `history` | the chronicle's Everything tab — the system's own addition (profile round), not yet in the product's set |

**All of them are inlined** — path data in `Icon`, reference copies in
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

The inventory is the source's, not a generic set. Most families below
exist in `web/src/lib/ui/` (and, unless noted, in Android's
`core:designsystem` too). Where a family is **decided but not yet
built** in either app — the media family's viewer, transport and rail;
`ShareButton` — the master is still the design's answer and the apps
conform to it; §7.1 is for pieces whose semantics are still open, which
is a different thing from a piece the apps have not reached yet.

| Directory | Components |
|---|---|
| `components/core/` | `Button`, `InlineAction`, `Card`, `ContentRow`, `FactRow`, `SettingsGroup`, `SettingsRow`, `Switch`, `SectionLabel`, `QuietNote`, `QuotedRow`, `Snackbar`, `JoinPrompt`, `DialogSurface`, `BottomSheet`, `SheetItem`, `SheetTitle`, `Chip`, `TopicChip`, `HelpDot`, `MoneyFigure`, `CgtMark` |
| `components/content/` | `PostCard`, `CommentCard`, `OverflowMenu`, `TopicsLine`, `ReferenceRow`, `ShareButton`, `NodeMark` |
| `components/forms/` | `TextField`, `FieldLabel`, `FieldSupport`, `FieldCount`, `PasswordField`, `Checkbox`, `LicenseChooser`, `LicenseTerms`, `RecoveryCode`, `SearchBar` |
| `components/navigation/` | `PageHeader`, `BottomNav`, `TabBar`, `CollapsingTop`, `Icon`, `SegmentedFilter`, `FeedFilter`, `FilterTrigger`, `OrderSection`, `FilterSection`, `BorrowedViewBand`, `DeletionBand`, `CograBand`, `BandIcon` |
| `components/compose/` | `WizardHeader`, `WizardFooter`, `SealFooter`, `ActsFooter`, `ActsCard`, `MediaThumb`, `PickPrompt`, `PickTray`, `PickedRow`, `PickedSheet`, `DescribeCounter`, `DescribeSheet`, `UploadStatusLine`, `UploadErrorLine`, `RefusedFile`, `CoverRow`, `CropViewport`, `StagedReference`, `TopicRemovable`, `Caret` |
| `components/wallet/` | `WashCard`, `WalletBalance`, `EarnedChart`, `LedgerRow`, `PayoutAddress`, `PayoutAddressRow` |
| `components/people/` | `MonogramAvatar`, `ActorChip`, `ProfileHeader`, `StanceRow` |
| `components/states/` | `EmptyState`, `LoadingState` |
| `components/honesty/` | `PendingMarker`, `EditedMarker`, `TransportError`, `SigningPending`, `RedactedContent`, `SensitiveVeil`, `SensitiveScope` |
| `components/stance/` | `StanceControl`, `StancePad`, `StanceReadout`, `StanceValue`, `StanceStanding`, `StanceLandingLine`, `StanceSlider`, `StanceAlternates`, `StanceCoachMark`, `SeveranceConfirm` |
| `components/media/` | `MediaAttachment`, `MediaGallery`, `MediaDisc`, `MediaViewer`, `VideoTransport`, `Timeline`, `SeekLine`, `PinnedClip`, `ReelRail`, `ReelRailItem`, `ReelCaption` |
| `components/proposed/` | `ExplainableNumber` — **not shipped**, see §7.1 |

The pair a component is documented by is its **module file's**: every
`.jsx` has a sibling `.d.ts` (props contract) and `.prompt.md` (what &
when, plus a usage example), and a module that draws a family covers the
whole family in that one pair — `MediaAttachment.jsx` also holds
`MediaGallery` and `MediaDisc`, `VideoControls.jsx` the transport, the
timeline and the seek line. Each directory has one `@dsCard` HTML
showing its states.

**Buttons are Material's three and no others**: filled for the one
committing action on a surface, outlined for a secondary action, text for
a tertiary one. Both unfilled variants put `primary` on the **label** —
the label carries the emphasis, not the border. What separates a button
from a link is what the control does: performing an action is a button,
going somewhere is a link. A button dressed as an underlined link is
neither.

**A component never states a raw type value.** Type arrives as a role,
and a role is four tokens together — size, line-height, weight and
tracking. A component that spells `letterSpacing: "0.4px"` beside
`var(--text-label-small)` has left the ramp for a number nothing
maintains: the token says `0.03125rem`, and the two drift the moment
the ramp is retuned. Take all four or take none; if a role needs a
value the ramp does not carry, the ramp is what changes.

### 7.1 Proposed — built ahead of the product

A separate **"Proposed"** group in the Design System tab, and a separate
directory, so nothing here is ever mistaken for shipped truth. The test
for building ahead: **the source has already decided the rule and only
the instance is missing.** Where the semantics are still open, the
component is deliberately absent — anything in this system gets trusted,
which is what makes a guess expensive.

| Piece | Decided, so built | Open, so absent |
|---|---|---|
| `ExplainableNumber` | the shape §7 requires of every figure: a quiet inline value and one tap to its explanation, and nothing more — there is no expand-in-place variant, because the only figure the product has is the Post Score and its explanation is four screens deep | — |
| `SensitiveVeil`, `RedactedContent` | §9's two content states: sensitive veiling the whole body (media, text and description) as one, title and tags outside, naming whose mark it is, one tap revealing everything, content kept mounted so revealing moves nothing — a comment's body replaced by one compact block instead; redaction taking the whole record and leaving its skeleton. No `error` colouring in either | whether a reveal survives leaving and returning to the post; where a words-only post names its source, having no wash to carry the line |

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

- **Topic chip**, **Collective** actor variant.
- **Removed placeholder** and **Sensitive veil** (§9) — specified,
  unimplemented.
- **Search** and **Wallet** surfaces — their bar slots exist in
  `BottomNav` (§7.1), the screens behind them do not.
- **Bottom sheets**.

### Intentional additions

- `BottomSheet` (+ `SheetItem`, `SheetTitle`) — `design.md` §6 lists sheets in
  the scaffolding and the product never built one, so the overflow menu, the
  license terms and every filter were each improvising. A sheet is a drawer
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
  pill, told apart by what they do: a chip acts, a tag navigates. 32px
  drawn, 48px tapped, selection colour only with no check glyph (a check
  reflows every label in the row as the reader picks).
- `FeedFilter` (+ `FilterTrigger`, `OrderSection`, `FilterSection`) —
  **what the feed actually needs**, and the reason the
  segmented row was the wrong control. Ten kinds of ranked content that
  combine (posts, comments, chats, messages, profiles, proposals, tags,
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
- `ProfileHeader` — §6 specifies it, the product never built it, and the
  profile round (2026-09-01) made it canonical: the compact avatar-left
  shape with name and figures beside it, and the figures are the design
  work — **Posts**, **"Opinions on them"**, **"Opinions by them"** —
  because the thing being counted is what the repo calls a connection and
  that word is banned on screen (§3); one merged "followers" figure would
  describe a different product. The figures are one tap target toward the
  stances page. On another's profile the stance wears the wide anchor with
  Message beside it; one's own avatar wears the change badge (the
  standalone crop-and-seal shortcut). No cover image: the largest thing on
  a person's screen should not be decoration.
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
- `SettingsGroup` / `SettingsRow` / `Switch` — the settings anatomy, and the
  house switch with it. Both apps ship a settings screen whose sections each
  invented a layout, and the design had drawn none of it; one row shape is
  what lets a page of eight groups read as a page. A quiet heading above, a
  filled card of rows, a footnote under — the footnote being what keeps a row
  to one line of status. The trailing edge is the variant (a switch, a value
  and a chevron, a chevron, or a control of the row's own), and the chevron
  means one thing only: this opens another surface. The switch was drawn once
  on the sensitive sheet and stayed a control while there was one of it; a
  second surface is what makes it a component.
- `BorrowedViewBand` — §13's borrowed vantage point, as a component: names
  whose view a guest or applicant feed shows, carries the one
  sign-in-or-join entry, and subsumes the guest notice on those surfaces.

---

## 8. The stance control

CoGra's signature interaction, and the thing to get right. Full rules in
`guidelines/stance-control.md`; the short version:

Every interaction authors two independent continuous values in `[−1, +1]`
— on screen, **"For or against"** and **"How much reaches you"**. All
four quadrants are legitimate.

- **At rest** the target shows the opinion: the face and the exact
  pair. A viewer with no opinion sees a **muted, translucent 🫥** —
  never a bare word.
- **A plain tap** blooms the pad at the lower centre of the viewport and
  stages nothing. The **first open ever teaches** — the coach mark rides
  inside the pad and names the shortcut.
- **Press and hold 500ms** commits a modest positive `(+0.1, +0.1)`
  outright. The light gesture opens, the held one spends: nobody holds a
  control for half a second by mistake.
- The pad's drawn field *is* the value space: its corners are
  `(±1, ±1)` and the knob never leaves it. Horizontal runs Against → For,
  vertical runs Less → More, and those four words are drawn on the field.
- **Releasing the finger never commits.** Release parks the pick, an
  explicit **Set** signs it, **Cancel** or a press outside stages
  nothing.
- The pad shows the **face and the exact pair**, live under the drag,
  with the **landing** ("Resulting opinion …") below the field — two
  different numbers, never merged into one line, each labelled above its
  own value.
- **The control never prevents a choice.** A pick that nets a standing to
  `(0, 0)` is *severance*: confirmed with its cost stated, never
  refused.
- The emoji face is a **lossy readout of the pick**, nearest of twenty
  anchors by Euclidean distance — dense in the for-it-and-want-it
  quadrant, sparse at the extremes. `(0, 0)` never speaks through the
  table: it gets 🤷.
- **Where the anchors sit is recorded on the anchor-map card**
  (`components/stance/anchor-map.card.html`) — the twenty on the
  two-axis field and the six pure-valence ones on the strip, each at its
  own coordinate. It is a reference for implementers: the product field
  draws its four axis words and nothing else, and the anchors' words
  stay accessibility-only.
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
  No title, no body, no description, no media, no license. There is no
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
  **The whole body veils as one**: media, text and description under a
  single veil, the title and tags outside it and readable, so a
  reader can decide from the frame without touching the content. One
  tap reveals everything — the reader decided once, and asking again
  per item turns one decision into five. **The veil names its source** —
  the author's warning or the platform's verdict — with the reason, where
  there is one, after it. The content stays mounted under the veil and keeps
  its exact space, so revealing moves nothing on screen — which is also
  why text is blurred in place rather than replaced. No `error`
  colouring, no warning glyph: a neutral wash of the standard scrim and
  a plain `visibility` chip. The backend's 0–10 severity level is
  **not** read — it is for a future where a reader accepts one kind of
  content and not another; today a veil either exists or does not.
  — `SensitiveVeil`

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
  keeps the right-hand slot, `Walk it back` stays a text button on the left.
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

**Three labelled readouts, formatted alike.** `Current opinion` ·
`Your pick` · `Resulting opinion`, each a label with the face and the
numbers on the line below it. The source ran them together as sentences
("Where you stand now: …", "This leaves you at: …"), which made three
different numbers read as prose.

**Both help affordances exist, and both replace the body they sit in.** A
circled `?` in the corner of the pad and of the alternates dialog. The
pad's four lines cover what the field means, what commits, why the two
faces can differ, and what walking it back costs; the
alternates' first line instead teaches the thing two sliders cannot —
*two values, not one*. Neither grows below its surface: on the pad that
would push `Set` away from the thumb, and in the centred dialog it would
move every button. `Set` is disabled while the pad's help shows.

**The coach mark says less** — two facts (a tap opens the pad; a hold
signs `+0.10 / +0.10`) instead of five at the moment a reader is least
willing to read. `Nothing was signed just now.` stays: it is the line
the mark exists for.

**The non-drag route is not drawn, and it is renamed.** `Choose values`
was a `primary` text button beside every stance, so a feed of twenty
posts carried twenty copies of a control duplicating the one next to it —
and "values" named nothing a reader could place. It is now
`Choose your opinion`, visually hidden until focused. §10's "every drag
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

**The license moves off the initial view.** It is among the rarest reads
in the product and was competing with the content for the same glance.
It is now a `License terms` item in the new `OverflowMenu`, which every
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
invents image where there is none.

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

**The score is "Post score" to readers**, and its drill-down is
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
- **The vantage resolves to the most specific actor available**, and
  the band names whichever one it lands on. An invite-link visitor
  borrows the inviter. An applicant borrows their own inviter — the
  person who already chose them, and whose stances their first
  vouch-back will echo. A bare visitor borrows genesis, strictly as the
  fallback when nobody more particular is known. The order matters more
  than any single rung: a reader should be shown the nearest real
  perspective the arrival carries, and genesis is what is left when the
  arrival carries none.

To port to the product docs as an open-questions resolution.

### The entry flow — 2026-08-27

The landing is the live public feed; every ceremonial step (invite
entry, the vouch screen, the key ceremony, recovery code, sign-in,
restore) is a full-focus task screen with a back arrow, never a
bottom sheet. Canonical screens: `designs/canonical/`. During the
dev phase the collapsing top and the sign-in screen carry an APK
download line. **It is the web's alone** — the line offers a browser
visitor the app they are not in, and the app itself never carries it.

The recovery-code screen is a trap: no back affordance, and the only
way out is the code typed or pasted back. A think-twice dialog gates
entry to it. The parked stance pad rests 16px above
whatever it parks over — the bottom bar where one exists, a sheet's
bottom edge otherwise; one number everywhere (ruled 2026-09-10). First-time onboarding is
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
sheet: it veils the body and the description; the title and tags
stay readable so choosing to look is informed; an optional reason is
shown on the veil. Every stance a write signs is disclosed and
adjustable: the post's own attachment on a one-axis pad (For/Against
only — your own post always reaches you in full), a reply's stance
on its parent on the full two-axis pad. The pad keeps its floating
card form everywhere; only license and sensitive present as sheets.

**Key absent is restore-first.** Nothing is staged server-side and
nothing is signed; the draft stays on the device, and the state
wears `tertiary` — a waiting state, never `error`. Leaving mid-write
keeps one local draft per target, on-device only, on the surfaces
that keep drafts — the post wizard, the post edit, the profile
picture; there the draft is the safety, so nothing asks on the way
out. The reply wizard and the comment edit keep no draft: leaving
them discards, so a non-empty composer is asked first — one shared
dialog (the *DiscardConfirm* board) reading "Discard this reply?"
or, from an edit, "Discard this edit?", body "Nothing is kept.", a
quiet *Discard* beside a filled *Keep writing* — the safe answer
carries the weight, as it does everywhere else. An empty composer leaves
at once — a confirm with nothing to lose is noise. Signing exits to
the post's own detail view wearing *Still settling*, with the
snackbar "Signed — it's in the thread now, still settling." An act
that expires unlanded gets a calm notice card in the shell: content
left every reader's view, nothing was spent, the draft is saved.

**A comment is text plus optional media** (deliberately asymmetric
to the post's XOR — an answer is words first), entered through the
thread's comment box, which is an entry, not a composer: it opens
the same full-focus flow pre-targeted, parent pinned — words, then a
one-act seal that discloses the stance on the parent. **An edit is
one screen and one batch**: the content edit plus topic and citation
changes ride together, the cost line reads the live total, and
tapping it opens the breakdown sheet. The license row shows
read-only with a lock; the Sensitive row beside it does not. The
license is fixed by contract the moment it is signed, while the mark
is the author's ongoing judgment about their own words — so both
edit surfaces, the post's and the comment's, carry the seal's
Sensitive row and open the same sensitive sheet. **Remove** is the
erasure path: own-post sheet → a think-twice dialog whose safe
action is filled → the visible mark. "Removed by its author" and
"Removed under the platform's rules" must never read alike.

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

To port to the product docs: the default-license account setting,
and the edit batch carrying topic/citation acts.

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

A card never lists its references inline, and its tags line is
**one line on every variant: at most two chips, then the counts in
words** — `#coastroad #saltmarsh · 23 tags · 3 references`. A
clipped parade of half-chips says nothing; the counts are the
readable fact and the way in. They open the
**tags-and-references sheet** (on a detail surface the whole line
is the opener; in a feed the chips still navigate). The sheet is
the full set's home: every signed act gets one row — **leading
mark · name · the signed pair** — one row shape across every node
kind (`ReferenceRow`), reused by search's results (item 9).

- **The leading mark says the kind, without a word beside it.** A
  person keeps their avatar; a media post its cover; a text post the
  letter T as a tile; a tag its #; the rest carry node-type glyphs
  — proposal `how_to_vote`, item `inventory_2`, campaign `campaign`,
  offer `sell`, chat `forum`, comment `chat_bubble`. Item and offer
  deliberately do not share a silhouette (box vs price tag).
- **The pair is public record**: set at compose on each picked tag and
  reference, and displayed on the row for any reader. The changeable
  defaults differ because the census does — a reference is +0.10 /
  +0.10 with both axes signed, a tag is **+0.1 / 1**, its confidence
  bounded to [0, 1] and starting full. Both are edited on the pad, each
  over the reach its own census gives it.
- A signed reference is a compose-time act; an @handle typed in text
  is only coloured text, never a record. They must not look identical
  — the typed handle is colour, the reference is a row in the sheet.
- Comments wear the same tags-and-citations line as posts
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
- **Scope operators**: `@handle <text>` and `#tag <text>` scope
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
  proposals, tags, items, campaigns, offers — and the word is
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
  state names what is off ("Your feed is showing nothing — everything
  is switched off.") and offers the way back.

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
  (with its cover); a comment at most **four pictures, or one video**
  (with its cover). The caps are authoring-side; the components render
  what they are given. Byte caps and the refusal states are below,
  *Comment video and the media error states*.
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
  item. **Web takes the crop and its seal 1:1** (jakob 2026-09-02),
  the file dialog playing the system picker's part — no web board.
- **Sensitive veils the whole gallery**, never one picture of it —
  the open question in `MediaAttachment` closed.

**The comment-media round** (the implementation session's second
set of findings; jakob's rulings 2026-08-31):

- **Comments have no pick stage.** "+ Add" opens the platform's
  own picker — Android's photo-picker sheet, the browser's file
  dialog on web — never the post wizard's grid: reusing the stage
  would drag cover/crop/video machinery into a flow that has none
  of it. The one web addition is the drop path: files dropped
  anywhere on the composer are accepted, and a quiet hint beside
  Add says so (*Reply · pictures on the web*).
- **Alt text is detached from the upload** — a product ruling,
  recorded in api-spec.md and data-model.md: the upload moves
  bytes only; a description is witnessed in the act's manifest
  and rides the prepare input per placement (`AttachmentInput`),
  cached on the version's junction row like gallery order. So
  comment pictures upload at pick, descriptions land at sign,
  nothing gates on the other — the alt-text-vs-upload race the
  implementation session feared cannot exist. The describe entry
  is the same counter line everywhere a composer shows picked
  pictures; the reply composer already wore it, *Edit comment*
  now does too.
- **The edit's acts footer opens a sheet.** "You're signing n
  things" opens an M3 modal bottom sheet — the EditActs
  pattern, now rendered with `ActsCard` (*Edit comment · the
  acts*): the sheet title carries the count, the card the rows
  and the all-or-nothing note. The sheet is the
  peek-from-a-composer pattern; ceremony screens keep the inline
  `ActsCard` — two patterns, one component. EditActs'
  pre-component note wording is conformed to the card's standard.
- **The canvas gained one unified Comments section** (same day —
  the comment boards had split across rows far apart and read as
  duplicates; none were: each draws a distinct state). Two
  adjacent rows now hold all nine: **the thread** (*Comments ·
  the thread* — renamed from "the sheet" — · *pictures & own
  comment* · *Edit comment* · *its acts*) and **the reply
  composer** (*write* · *pictures attached* · *pictures on the
  web* · *the pad* · *what you sign*), each row with its own
  section note; post edit & remove keeps its own row below,
  retitled "Edit & remove the post".

### The wallet — 2026-08-31

Item 12, jakob's rulings — grounded first in a verbatim doc audit
and the same-day product decisions it forced (L0's reserve asset is
L-BTC on Liquid; the community admission fund covers invites within
its governed caps; the rail key is distinct from the actor key and
born lazily — recorded in the product docs, PR #537). The boards:
*Wallet* rows on the canonical canvas; masters in
`components/wallet/`.

- **The balance headline** (`WalletBalance`) is the one surface that
  spells CGT, as ruled in item 11 — and now carries the **≈ L-BTC
  value line**: jakob overruled the CGT-only lean ("knowing how much
  value it currently might have is super cool"). The estimate reads
  the public CGT–L-BTC market — the protocol's own ladder, live from
  genesis — moves with it, is never a promise, and hides at zero.
  Never fiat: the product's own market quotes L-BTC.
- **No free-form send, no cash-out.** Tipping IS the user-to-user
  send; moving CGT anywhere else is any Liquid tool's business — the
  wallet says where the money lives, not where to sell it.
- **History is one stream, newest first** (`LedgerRow`): payouts,
  tips in and out, campaign money — every line opens what paid it
  (the traceability promise), direction by sign and words, and an
  unlanded payout wears *Still settling* — the pending look item 11
  deferred lands here. Search over history is deliberately later.
- **Campaigns are a money view only**: deposit, escrow, window,
  settles-as-one-public-record. The card clicks through to a
  details page the moment one exists; no advertiser console here.
- **The rail key is born at first wallet open** — the set-up card
  (*Set up your wallet*, "?" *Your wallet key*): its own key, no new
  recovery code (the seed joins the one container under the one
  code), and the ceremony's single signed act is publishing the
  payout address. An applicant's wallet says plainly that it opens
  with membership — nothing locked, nothing yet to show.
- **The payout address renders whole** (`PayoutAddress`) — mono,
  wrapped, never truncated: checking it against a wallet is the
  point of showing it. Changing it is a seal (parallel Registration,
  newest wins); the line under it says the address is public and so
  is every change.
- **Key-absent is read-only, honestly**: balance and history stay
  readable — the address and the chain are public — and only signing
  needs the key; the restore-first notice says exactly that.

**Round 2 — the trophy pass** (jakob, same day: the first cut read
"sad — text and numbers"; direction A blessed *with* the gradient,
explicitly as a first move against the product reading "basic"
next to brands like Instagram):

- **The brand wash** — `--surface-hero` in tokens/colors.css, the
  system's ONE decorative gradient surface (both stops existing
  palette values; the recipe is the only new thing). It dresses the
  few places a figure IS the page — the wallet's hero first — and is
  never a default card fill. The hero adds the **ghosted oversized
  brand coin** cropped by the card's edge (texture, not a second
  logo, aria-hidden) and the **delta chip** ("+14.40 this week" —
  real recent earnings, omitted when nothing is new).
- **`EarnedChart`** — the progress strip: earnings per settlement as
  bars, every bar a real public settlement and tappable into it —
  the traceability promise is what makes a chart admissible. Latest
  bar wears `primary` (recency, never direction); zero settlements
  are visible stubs.
- **History rows are identity rows** — the disc leads (the tipper's
  face, the paying campaign's cover, a glyph), wearing a small
  direction badge (`arrow_outward`, rotated for in); the amount is
  never coloured. `MonogramAvatar` accepts a numeric size for the
  40px list-avatar rung.
- **The campaign has its own subpage** (*Wallet · your campaign*) —
  committing a deposit is a big deal: the money facts (deposit,
  escrow, window, one-public-record settlement, unspent-returns) and
  its rail history; the main page keeps one entry row.
- **The address lives in a card** — label, **copy**, Change, the
  address whole and mono; compact at rest, captioned on the zero
  state and the seals.
- Wording fixes: the zero state is **path-true** (campaigns pay when
  the paths between an advertiser's crowd and their target run
  through you; posting is how paths start, not a guarantee); the
  key notice **leads** the key-absent board, inset like every card;
  the guest prompt is centered; the applicant is told plainly to
  come back after approval — earnings can't land until the address
  exists.

**Round 3** (jakob, same day):

- **At rest the address is one line, high on the page**
  (`PayoutAddressRow`) — an entry point out of scrolling's way, and
  the ONE place the address may shorten (head…tail): it is not a
  checking surface. The full card (copy, Change, the public-record
  caption) is one tap away, and sits high on the zero state where a
  new member's first move is checking it.
- **Campaign money is ordinary history.** Three row kinds: **escrow
  out** at creation, **top-up out** (a created campaign can be topped
  up), **return in** when the payout wasn't full (the target missed,
  or the crowd refused). No campaign section on the main page — the
  wallet keeps only the **campaigns door**.
- **The campaigns page** (*Wallet · campaigns*): Start a campaign,
  the `Yours / You took part` segments, Open (with amounts in
  escrow), Past (with outcomes — returned or fully paid out). "You
  took part" lists the campaigns that paid you, with what each paid.
  A listed campaign opens the money subpage (*Wallet · your
  campaign*); the full campaign console stays a future item.
- **The moment screens wear the wash** — `WashCard` extracts the
  brand wash + ghost coin as one master (at most one per screen):
  first open, guest, and applicant are a person's first look at the
  money side and must not read as settings.
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
  multi-act seal** — "They land together, or none does." — and omits it
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
  **the X leaves the whole flow from any stage**. Where a draft is
  kept — the post wizard, the post edit, the profile picture — the
  leave keeps it and nothing asks, the draft prompt being the return
  surface; the reply wizard and the comment edit keep no draft, so a
  non-empty leave is guarded by the discard confirm and an empty one
  leaves at once. Each X's label says which of the two it does. The
  seal's own Back pill is the same one-stage step, labeled.
  `WizardHeader` is the master — every composer-flow stage wears it
  (post wizard, reply, edits, the profile picture). The em-dash rule
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

### Canvas pages and flows — 2026-08-31

Item 22, jakob's brief: the flat canvas had outgrown human and
machine reading — every screen must have an entry point, every
interactable must lead somewhere, and completeness must be checked,
not trusted. All five shape questions answered "all agreed, go with
entry first". What stands:

- **The canvas is paged** (`canvas.json` `pages`): Overview · Entry ·
  Compose · Comments · Feed & Search · Money & Wallet · Media ·
  Patterns & reference. Every board and note names its page; each
  page's rows restart at y 0; the canvas opens on the Overview.
- **`graph.json` is the screen graph** (`designs/canonical/graph.json`).
  Every interactive element on a board of a **wired** page carries
  `data-flow="n"` (1..n per board, drawn as a small orange badge by
  the shell); each number has exactly one edge `{from, via, kind,
  label, to}`, and `to` lists every outcome as one of four shapes: a
  **board**, a shared **pattern board**, a declared **terminal**
  (`back` / `self` / `os`), or an explicit **gap** — a design still
  owed, greppable, listed by the checker, drawn red on the maps.
  `entries` records the non-tap ways onto a screen (app open, a mail
  link, time passing); a screen on a wired page must be an entry or
  an edge target. `boardKinds` marks reference boards (anatomy plates,
  the maps themselves) that are vocabulary, not destinations;
  `scanExempt` names boards whose semantic elements are inactive in
  the drawn state (the pad board under its scrim). **A pattern
  exemplar is exempt for the second reason**: it is drawn on a real
  surface to show one behaviour, and only that behaviour is its
  own — the surface's other controls belong to the board that owns
  them and are wired there, so wiring them twice would give one
  control two edges. `NetworkError` is the exemplar: the retry the
  failure offers is the board's whole subject, and its `scanExempt`
  line names `ComposeSeal` as the home of the rest. The next pattern
  board says the same and cites this rule.
- **Every edge declares its `kind`** — what the control *does*, not
  where it lands. Five, and never a default: **`advance`** is
  forward progress toward a journey's conclusion (Next, Sign, Save,
  a compose step, drilling into the target you came to act on);
  **`cancel`** abandons staged work (a wizard's X, Cancel, Discard,
  and a back arrow that leaves the flow rather than stepping one
  stage up inside it); **`back`** returns without abandoning
  anything (that back arrow one stage up, a sheet's dismiss, closing
  a read drill-in); **`nav`** is a lateral hop between top-level
  surfaces (the five nav slots, the band's chats); **`detour`**
  opens a side surface that leaves the journey untouched (help
  dialogs, read-only menus, the signed-actions list, a caption
  unfolding, a gallery pager). The flow engine path-searches over
  `advance` edges alone, which is why a seal's cancel-X can never be
  one: a flow satisfied through an abandonment is a lie.
  `check-flows.mjs` fails on any edge carrying no kind or an unknown
  one, and prints the census beside the summary.
- **Numbers are stamped by the build, never by components.** JSX
  screens get them from `_build/flow-markers.mjs` — markup anchors
  applied after render, throwing on drift — so the design system
  never carries canvas metadata. Repeated per-post controls wear the
  same number on every instance: one edge covers them. **The badge sits inside the
  element's corner**, not hanging past it: outside, anything that
  clips its overflow eats it, and 470 of 1091 badges were drawing
  cut or invisible — the gate verifies the attribute, not the paint.
- **The maps are generated** (`_build/gen-maps.mjs`): one flow-map
  board per page (cards mirroring the page grid, every edge as a
  numbered line, arrows for same-page jumps, `⤴ page` for cross-page
  ones) plus the Overview map (wired state, edge and gap counts,
  cross-page totals). Never hand-drawn, so never lying; the script
  also maintains the maps' own canvas entries.
- **`_build/check-flows.mjs` is the gate**: it fails on structural
  lies — an edge to a missing board or undeclared terminal, a
  number without an edge, an edge without its number, an untagged
  semantic element on a wired page, a screen nothing reaches — and
  reports gaps without failing. Full pipeline:
  `node bundle.mjs && node render-screens.mjs && node gen-maps.mjs
  && node check-flows.mjs`.
- **Every page is wired** (rounds 1–6, 2026-08-31: Entry, then Money
  & Wallet, Feed & Search, Comments, Compose, Media + Patterns; the
  Profile page joined 2026-09-01 — 699 edges over all 93 boards, no
  board unreached, no interactable unedged). The 108 gaps are the
  visible to-do: the reader's post / comment / profile menus, the
  tag page (ruled — a search subpage) and the tag picker,
  field/mismatch error states, the applicant's once-each
  acting boards (ruled), the settlement/tip/rail record views the
  wallet's traceability promise owes,
  the settings and invites screens, the chat surface (its band entry
  now on every tab root), the item / offer surfaces, the Sky
  (item 16), and item 13's Post Score drill-down. Cross-flow reuse
  is wired as edges into the master boards (the describe sheet, the
  gated seal, the license / sensitive sheets, the key-absent seal,
  the stance pad, and the three pattern boards — the guest gate, the
  network error, key-absent acting) rather than duplicated boards.
- **The tag picker's interim entry** (jakob 2026-09-02): until the
  picker board exists, the apps' entry is the existing tag field,
  opened as a sheet from the seal. The gap and the blocked
  `add-a-topic` flow stand — the interim is what the apps ship, not
  the design owed.
- **The profile round (2026-09-01, item 23 round 1)** drew the
  surface slice 2.1 shipped undesigned — eight boards: your own,
  someone else's, applicant days, the stances page, the posts and
  comments views, the edit flow and its seal. Its rulings: the
  compact avatar-left header with the tappable figures row; the
  stances page shows each record's own value (`StanceValue`,
  read-only — acting means opening the profile); the wide stance
  anchor pairs with Message; chats ride the band on every tab root;
  the avatar changes two ways (the badge's standalone crop-and-seal,
  or through the edit screen where ONE seal covers picture and
  fields); the chronicle is wallet-style containers with act discs;
  a comment out of its thread leads with its target pointer; an
  applicant stages each kind of act once, and non-actionable taps
  answer with a snackbar, never a gate screen.

### The user-flow layer — 2026-09-01

Reachability is semantics-blind: a sign-and-submit board reaches the
profile through its own cancel-X, and no avatar-edit flow may be
satisfied that way. Three layers make the answer honest.

- **Kinds prune.** The search walks `advance` arcs alone — `cancel`,
  `back`, `nav` and `detour` edges are not paths, so an abandonment
  can never stand in for a conclusion. The **arc**, not the edge, is
  the unit of travel: a multi-outcome advance edge contributes one arc
  per board outcome, which is how one `Next` carries two flows apart —
  AvatarCrop's standalone seal and its return to the edit screen.
- **Pins kill the residue.** A leg that resolves two ways is a hard
  failure printing both routes; the engine never guesses which was
  meant. The fix is a waypoint, or a `via` pin (narrowed by `case` or
  `to`) naming the edge the flow leaves that board by.
- **Witnesses freeze the meaning.** Every resolution is written to
  `flows.resolved.json` and committed — reviewing that file *is* the
  blessing. A resolution that drifts from it fails the gate, naming the
  step that moved, until `node check-flows.mjs --rebless` re-blesses it
  deliberately.

The rulings the layer rests on:

- **A sheet's `Done` advances; its scrim does not.** The explicit Done
  is how a sheet's journey concludes, not a way back. A scrim exit is
  always `back` — the filter sheets, which apply live and carry no Done
  of their own, are concluded by a flow declaring that scrim edge as
  its given end rather than by walking it. A sheet's journey ends
  there: the signing that may follow is the publishing flow's
  conclusion, never the sheet's.
- **An `advance` must reach something.** A control whose every outcome
  merely informs — the applicant's locked rows answering with a
  snackbar, a chip that lands where you already are — leaves the
  journey where it was. Those outcomes carry `"info": true` and their
  edge is a `detour`; an all-informing `advance` fails the gate.
- **A read journey concludes on arrival.** Not every flow signs
  something; reaching what was sought is an ending in itself. Such a
  flow declares no `end` at all and concludes on the board its last
  point lands on — the start's landing when it names no waypoints, the
  last waypoint's board when it does — and its witness reads
  `end · arrival at <Board>`.
- **A stance concludes where it was taken.** The pad is reached from
  posts, comments and profiles alike, so its signed outcome returns
  wherever it bloomed. The applicant's vouch-back is the one exception
  — that one opens the way into the member's own feed.
- **The start is the click, not a screen.** A flow starts from a board,
  from a given edge, or from a **control**: `{"control": "nav · New
  post"}` expands to every edge wearing that label, and they must all
  land on the same first board — divergence fails, and `except` drops
  the boards where the control means something else. Start and end
  edges are given
  rather than searched, so their kind does not matter; that is why the
  bottom nav stays `nav`. A control the reader meets on board after
  board — the comment count, the stance face — is declared that way
  rather than pinned to one of them, so the flow claims every place it
  is offered and the census grows as boards are drawn. Where the
  control's outcome depends on **what it was pressed on** — a post's
  media, which opens a picture's post or a portrait clip's stream —
  `case` or `to` narrows the start to the journey meant, the same
  narrowing a given start edge already takes. It is still one control
  everywhere; without a narrowing, divergence is still a failure.
- **Web wizards get their own flows.** Where a browser draws its own
  board for a stage, the journey is declared twice, native and web, so
  a divergence between the two stays visible instead of hiding inside
  one flow that walks whichever board the search reached.
- **A blocked flow is a claim on design still owed.** A journey whose
  end lands on a gap is declared anyway and reported as blocked, never
  quietly dropped: it names both the design the product owes and the
  journey waiting on it. A gap on the *start* side is the opposite —
  a hard failure, because a journey that can begin from no existing
  screen is an authoring error, not a claim. A control start survives
  origins that reach only gaps, listing them as `startsUndesigned`,
  but not all of them reaching only gaps.
- **Three files, three jobs.** `graph.json` is the mechanism (what
  every control does); `flows.json` is the intent (which journeys the
  product owes — hand-authored, one flow per block, never rewritten by
  a script); `flows.resolved.json` is the witness (generated,
  committed, reviewed). `check-flows.mjs` also prints the reverse
  index — which flows transit a board and which begin or end there,
  the answer to "how many continuations does this shared screen owe" —
  and triages the gaps into those a declared journey walks past and
  those off every flow.

### The veil's source, and the veiled comment — 2026-09-02

- **The veil names its source** (Q47). The author's own warning and the
  platform's verdict are two independent states that read back as the
  same veil, so the face says which one — always, since an unnamed
  source reads as the other. The second, smaller line carries it —
  *The author's warning* or *The platform's verdict* — and the reason,
  where there is one, follows after an em dash. A reason alone cannot
  do this work: a verdict may carry one too, and an author may leave
  theirs empty. Until slice 8 every live veil is an author mark. A
  words-only post has no wash to carry the line — that piece is open.
- **A comment veils COMPACT.** Its whole body — the words and the
  pictures with them, as one — is *replaced* by a single comment-scale
  block wearing the veil's own wash, glyph, words and source line. A
  comment is two lines tall with its pictures inset beneath them, so
  covering it in place would wash the words and the pictures
  separately. What stays readable is the frame: the author, the
  timestamp, the topics and the stance still open — the comment's
  answer to a post's title staying outside the veil, so choosing to
  look is informed. The block's type is the theme's rather than the
  media face's fixed white, which is legible only because that wash
  lies over a picture.

### Comment video and the media error states — 2026-09-02

Filed by the implementation loop (jakob's words): a comment should be
able to carry a video and its cover, and both scales need states for a
file that is too big or in a format nothing here reads.

- **A comment's media grammar is the post's at comment caps**: up to
  four pictures, **or** one video with its cover — never both kinds,
  the same XOR a post's body carries. The caps are product constants
  the implementations copy, authoring-side like every other cap:
  **a picture 10 MiB** (10 per post, 4 per comment), **a video
  100 MiB in a post and 50 MiB in a comment**, **a cover 10 MiB**.
  **The caps are enforced in MiB and written MB on screen** — 50 MiB
  is 52.4 MB, so the number a reader sees under-promises and can never
  refuse a file the product would have taken. Writing MiB would be
  exact and unreadable.
- **Entry is unchanged; its label follows the state.** The picker is
  still the platform's own, and picking a video puts the composer in
  its video state (*Reply · a video and its cover*). The control says
  what it will take: an empty composer reads **"+ Add pictures or a
  video"**, one holding pictures reads **"+ Add pictures · n of 4"**
  (the video is out — the grammar is exclusive), and one holding a
  video carries **no add control at all**, the cover row standing
  alone. There is still no pick stage and no crop, so the video
  uploads at pick like a comment's pictures do.
- **The cover is the post's, inlined.** `ComposeCover`'s row — the
  frame strip, the tile that takes a picture of your own, *A frame, or
  a picture of your own.* — sits under the video at comment scale
  rather than in a stage of its own: the comment composer is one
  screen, and a wizard stage is exactly what comments do not have. The
  video itself shows in the comment pager's fixed square frame, whole
  inside it, so a comment never turns into a post.
- **A refused file is refused where it was offered** — a line in the
  composer's media row, never a dialog and never a snackbar (a
  snackbar confirms what happened; errors sit on the surface they
  happened on). Two boards draw it, *Reply · files refused* and *Pick ·
  files refused*. The error names the cap it broke, and that is the
  ONLY place a cap is named: nothing announces the limits in advance.
- **The ways out follow the failure.** An upload that lost the network
  offers Retry · Remove it. A refused file offers only *Remove it* —
  retrying cannot make a file smaller or a format readable, and
  `UploadErrorLine` drops the link rather than dangling one that would
  fail identically twice. `MediaThumb` grew the composer's video
  anatomy with it: the play disc and the duration, authoring-side only
  — a reading surface still never draws play.

- **A video takes ONE description, its cover none.** A clip is one
  thing to describe, so the counter reads *Describe the video · 0 of 1
  described* and opens the same describe sheet a picture opens; the
  cover is the video's face, not a second picture, and asking for a
  description of it would ask twice about one thing. The row rides
  wherever media is staged — the reply composer's video state, and the
  post wizard's details step, which now carries the describe entry its
  own ruling always gave it.
- **A comment's video plays like a post's.** Muted autoplay while it
  is on screen, in the comment pager's square frame, wearing the one
  control a video ever wears: sound, on the sticky global decision
  every video shares. No play/pause and no duration pill on a reading
  surface — presence on screen is the policy, at both scales. *Comments
  · a video, pictures & own comment* draws it.
- **Web takes the video state 1:1** — the file dialog and the
  composer's drop-anywhere path play the picker's part, and nothing
  else differs, so no web board is drawn (the web avatar flow's
  blessing again). The web board's drop hint grows to *…or drop
  pictures or a video here.*

**What the implementations must match** (from
[api-spec.md](../docs/implementation/api-spec.md), so no lane
re-invents the refusal states): the stored formats are **WebP and
MP4** (H.264 video, AAC audio), both **sniffed from the bytes**, never
trusted from a declared type. **A still GIF converts on the device; an
animated one is refused with words**, on both platforms — neither has
a documented way to encode animated WebP, and a silent conversion to
one frame would drop the thing the author picked. An **animated WebP
is a still**. The unknown-format refusal fires for a file that is
neither a decodable image nor an H.264/AAC MP4 *after* any device-side
conversion. A frame chosen as a cover is **extracted on the device and
uploaded as the account's own picture** — the cover is always an asset
the author holds.

The four refusal lines, and the video sentence added to the
*Describing pictures* dialog, are new copy — listed in
[guidelines/copy-voice.md](guidelines/copy-voice.md).

### The pattern boards — 2026-09-02

Three surfaces the whole product kept pointing at, drawn once and
wired as masters (item 23 round 2). Each closes a family of gaps
that no single page owned.

- **The guest gate asks, it never bounces.** A guest's tap on an act
  answers with the JoinPrompt dialog over the read they were in the
  middle of — nothing behind it is destroyed, and the read is still
  there when the dialog goes. The affirmative is filled because
  joining is the one committing action on that surface; `Keep
  browsing` stays a text button and stays first, so nobody is nudged
  into signing by thumb position. Every guest-gate gap on Main,
  FeedBare and WalletGuest resolves here. FeedBare's `chats` joins
  them: a guest has no chats, so it gates like Main's and
  WalletGuest's rather than opening the chat surface.
- **The network fault sits where the fetch was requested.** No scrim,
  no dialog — the seal stays readable underneath and the fault takes
  the place of the control that asked, always paired with `Retry`.
  The seal is the exemplar; all eleven offline outcomes across entry,
  wallet, compose, comments and profile resolve to this one board.
  With `SigningPending` it is one of the only two surfaces in the
  product where error colour appears beside body copy.
- **Key-absent acting wears tertiary, never error.** Nothing is
  staged server-side and nothing is signed, so the state is a notice,
  not a failure. The notice card replaces the `Set` affordance the
  way it replaces the seal's commit control, and restore comes first.
  The one `?` on the surface belongs to the key notice, not the pad.
- **Guest origins are excepted from the act-starting flows.** A
  control-selector start must mean one thing everywhere, and a
  guest's tap on `New post` or the stance face now starts the gate
  rather than the journey — so Main, FeedBare and WalletGuest leave
  those selectors. KeyElsewhere leaves the stance-face selector for
  the same reason: its face diverges, the pad on press-and-hold and
  the key gate on a tap. The applicant gaps stay in the census; their
  boards are still owed.

### The video conform round — 2026-09-03

Everything the video slice built to a ruling without a board, plus the
two mismatches the apps shipped against each other (backlog item 32,
and the parts of item 33 that could be settled without drawing a feed).

- **A feed card wears the sound control and nothing else** — no
  play/pause, no duration pill, at both scales. Presence on screen is
  the policy, and a card is a place you are passing through. What a
  clip carries on every other surface is the control ladder, below.
- **The back arrow gates like the X.** Any leave of a non-empty
  comment asks through DiscardConfirm; an empty one leaves at once.
  Two ways out of one screen that lose the same writing cannot behave
  differently — the arrow being "one stage back" is a fact about
  navigation, not a license to discard silently. Post composers keep
  their plain leave: a post draft is kept, so nothing is at stake
  there.
- **A file is judged on its own before it is judged against the
  body.** Size and format answer first, the grammar second. So a clip
  over the post cap is refused by its cap, and a clip the product
  would have taken is refused by the mixed-kind line — one file, one
  line, the nearest reason. The order is what lets every refusal the
  step can utter stand honestly on one board.
- **The refusal vocabulary is complete at both scales.** The post's
  video cap joins the comment's; **mixed kinds** get words at last
  ("A post carries pictures or one video, not both.", and the comment
  twin); **count overflow stops truncating in silence** — an eleventh
  picture in a post, a fifth in a comment, refuses like anything else.
  Both refusal boards now stage a **full tray**, because a full tray
  is what makes the count and mixed-kind rows true beside the others.
- **Staged content wins a mixed selection.** With something already in
  the body, the newcomer of the other kind is the one refused. From a
  fresh mixed batch with nothing staged, **the pictures are kept** and
  the video refuses: pictures are the plural case and the kind a batch
  usually means, and keeping the several over the one loses less.
- **A video is the whole body, and the surface says so.** Once a clip
  is staged the add control is gone — the grid stops taking picks at
  post scale, the "+ Add" disappears at comment scale — and a quiet
  line takes its place: *A video is the whole post. Its cover comes
  next.* / *A video is the whole comment. Give it a cover below.* An
  absent control explains nothing on its own. Web takes the post
  state 1:1 (the drop region and the file dialog play the grid's
  part), which is the same blessing that puts web's refusals on
  `ComposePickedErrors` rather than a web board of their own.
- **Four cover frames: 1s, 10%, 50%, 90%**, deduped on a clip short
  enough that two land on the same frame — offering one picture twice
  is a choice that isn't one. 1s clears the fade-in black that t=0 so
  often is.
- **A frame needs no crop; a gallery picture does.** An extracted
  frame already carries the clip's shape. A picture of your own can
  disagree with it, so it goes through a crop **locked to the video's
  display shape** at the scale it will be seen — the clip's own ratio
  in a post, the comment pager's square in a comment — and comes back
  to the row that asked. There are no shape chips: choosing a shape
  there would let the cover disagree with the thing it is the face
  of. `ComposeCover`'s back arrow reaches the pick, not the crop; the
  video path never crosses it.
- **The cover changes at edit; the clip never does.** A new cover is a
  new picture the author uploads and the attachment points at from the
  edit's own signing — a layer on the attachment, never an alteration
  of the video ([api-spec.md](../docs/implementation/api-spec.md)).
  **Frames are not re-offered**, because extraction needs a source
  file the device may no longer hold, so the gallery is the one way
  in. The clip's only move is to leave whole: swapping it would make
  the edit a different post wearing the old one's history.
- **A failed upload is not a refused file.** A refusal is an answer
  and retrying cannot change it; a failed upload is a fault and gets
  **Retry beside Remove**, like every other transport fault in the
  product. Both apps ship the refusal's no-Retry form for a clip that
  didn't send, which tells the author the file was wrong when it
  wasn't.
- **The describe sheet has two shapes.** *Describe the video* takes
  one entry for the whole clip and never offers the cover a field of
  its own. Both shapes — and the describe row that opens them — carry
  the reason permanently under the title: *Read aloud to people who
  can't see it.* Someone deciding whether to write a description needs
  to know who is listening at the moment of deciding, not behind a "?"
  they will not open.
- **The cover is the clip's face wherever the clip isn't running.**
  First paint before autoplay; every still representation (a quoted
  target, a history row); and any context where autoplay is
  suppressed — reduced motion, data saver. In the feed the cover holds
  until playback first starts and **never returns**: a clip that stops
  being the playing one freezes on the frame it reached, because
  snapping back to the cover would erase what the reader just watched.
  **One clip plays at a time, at 70% visibility or more** — android's
  gate, blessed.

### The reel round — 2026-09-03

How a clip sits in a card, where its tap goes, and the surfaces that
answer: the stream, the post detail, and the fullscreen viewer (backlog
item 33, jakob's rulings the same day).

- **A clip keeps its own shape, clamped to tall.** A clip's ratio is
  not a crop an author chose, so the crop vocabulary does not govern
  it: **16:9 and 1:1 display true, and anything taller than 4:5
  centre-crops to 4:5** in a card. The cover shares the clip's ratio
  and crops identically — it is the same clip's face, and a face that
  disagreed with it would be a lie. **Letterboxing exists nowhere in
  the product**: a clip fills the frame it is given, and the full 9:16
  frame lives on the stream and in the viewer. The
  post-fits-the-screen cap still bounds the tile as it bounds every
  tile, and under it the tile is **filled, never fitted**. **Square is
  the comment scale's shape**, and a comment's pictures and clips alike
  fill it: an uncropped picture display-crops to its frame, centred,
  because bars beside a picture spend a card's scarcest resource on
  nothing and the whole frame is one tap away in the viewer. The crop
  is display-only — a comment's picture still travels uncropped, and
  what the author uploaded is what the record holds.
- **The control ladder** — a deliberate revision of the conform
  round's sound-only-on-every-reading-surface rule. A **feed card**
  carries the sound disc alone. A **detail view** carries play/pause
  and a real timeline, a tap anywhere on it or a drag along it, and
  the chrome auto-hides with a tap on the video revealing it. The
  **fullscreen viewer** carries the same full transport, and
  rotate-to-landscape. The **stream** carries sound and a thin
  drag-to-seek line, never the full transport. The ladder is **uniform
  for every clip**: no length threshold decides whether a reader gets
  controls, because a reader who learns a control on one clip has to
  find it on the next.
- **The transport's anatomy is the platform player's** — a big centred
  play/pause flanked by the skips, and a bar along the bottom carrying
  elapsed, the timeline, total, sound and the fullscreen toggle. A
  transport is the one place in this product where inventing a layout
  costs the reader something, so it is Android's, not ours.
  **Nothing sits on the bottom edge**: the system gesture zone lives
  in that strip, so a control there is not a control but a swipe that
  closes the app. The bar is inset from it, and the stream's seek line
  rides above the bottom bar rather than under it.
- **The stream carries portrait clips only** — clips taller than they
  are wide. Square and landscape clips keep the ordinary grammar, a
  tap to their post. **It is the default feed narrowed to them**: the
  same graph, the same ranking, a mechanical filter, and **no second
  algorithm**. Nothing labels it, because a header saying "your feed"
  is the reassurance only a product that ranks two ways needs. What
  says it instead is the **score on the rail** — the reader's own
  reach into this post, the same number the card wore.
- **A portrait clip's tap opens the stream; any other media's tap
  opens the post.** From the pinned-clip detail, tapping the clip
  expands back into the stream with the reader's place held.
- **The detail door on a reel is the score element** — the exact
  element a feed card wears, so the way in is a thing the reader has
  already met. Tapping it **squishes the clip to the top of the
  screen**, still playing, and the post rises beneath it: a state
  change, never a page portal. On a card the same element opens the
  score drill-down (item 13) — one element, two surfaces, two
  destinations.
- **The rail, top to bottom: author · stance · comments · share ·
  the score.** People lead, the way they lead on a card; then the acts
  in the card's own order, with share arriving after them; the door
  out last, so a thumb reaching for the stance never passes over the
  exit. The stance opens **the same pad** over the paused clip, seal
  and all, and the count opens **the same comments sheet**. Topics,
  the reference count and the reader's ⋮ are not on the rail — they
  belong to the detail view the score opens. Sound obeys the global
  sticky decision; the caption sits along the bottom. The rail is
  **white and shadowed at 28px**, and the unset stance is a **line
  face** in that same weight — `sentiment_neutral`, no disc and no
  ring, because a plate around one control in a column of five reads
  as chrome. Over photography a token colour is not a quiet control
  but an invisible one, so the state that the card says with
  translucency the stream says with the empty face instead. A stance
  already taken still shows its own face, at the same size.
- **The bottom bar stays on the stream.** It is a way of reading the
  feed, not a place outside the app, so the way to every other tab
  stays where it always is — as Instagram, TikTok and YouTube all keep
  theirs. The seek line sits directly above it.
- **Guest and key-absent gate on the stream exactly as they do in the
  feed** — the join prompt over the paused clip, the key notice per
  the pattern boards. The same edges into the same masters; the stream
  has no guest board of its own.
- **Share is new, and it is one tap to the platform's own sheet.**
  Drawn on the rail, on the detail view **and on the feed card**; no
  menu of ours, because a share menu here would be a worse copy of the
  one the reader's apps already live in. **No count** — a share tally
  would be a public number the graph does not record.
- **The action row's order is its order of importance**: stance,
  score, comment, then share. That order is also the *queue*: on a
  phone too narrow to hold all four, **share is the first to move into
  the ⋮ menu**, and the row gives way from its end. An action added
  later is ranked against the ones already directly reachable before it
  earns a slot — never appended by default, because a row that grows by
  arrival order stops meaning anything.
- **The score element means two things, and that is allowed.** On a
  card it opens the score's drill-down; on the stream's rail it is the
  detail door, and the drill-down is reached from the detail view it
  opens. One element, one glyph, one number — what it opens is a fact
  about the surface, not about the element, and renaming it on one
  surface would cost more than the overload does.
- **The cover at rest, and the card that never starts.** The cover
  holds until playback first starts and never returns. Where the
  device suppresses autoplay — reduced motion, data saver — the card
  wears a **play disc in the sound disc's place**, the one card in the
  product that draws play, because autoplay is absent by the device's
  own word and a cover with no way to play it is a picture pretending
  to be a clip; the tap plays it there, in the feed. Quoted targets
  and history rows wear the cover as a thumbnail.
- **The viewer is reached by the second tap**: media in a card opens
  the post, media in the post opens the frame — or the transport's own
  fullscreen toggle, which is the same door. It is **the whole surface
  on black with nothing behind it**: a viewer you can still read a card
  through is not full screen. Nothing is cut there —
  it is the surface every crop in the product is measured against — a
  picture pinch-zooms and **the gallery's swipe and its dots** carry
  over, dots only, no arrows and no "n of m" (the pager ruling holds
  here too: arrows would be a second vocabulary for a gesture the
  reader already has). And a clip
  whose shape is not the device's keeps its shape and takes the ground
  beside it rather than being cropped to the edges. **No acts** on the
  viewer, and **the description is not shown**: alt text is read aloud
  to people who cannot see the frame, and printed under it it becomes
  a caption its author never wrote. Three ways out — the X, a swipe
  down, and the backdrop.
- **The round is masters, not markup.** Everything it drew that a second
  surface could want is in the system: the media family moved into
  **`components/media/`** and gained `PinnedClip` (the clip above the
  card, and what the squish morph leaves behind), `ReelRail` /
  `ReelRailItem` and `ReelCaption` (the stream's chrome), beside
  `MediaViewer`, `VideoTransport` / `SeekLine`, `MediaDisc` and the
  shape and ladder rules inside `MediaAttachment`; `ShareButton` rides
  `PostCard`'s action row. The stream's boards keep only their fixtures
  — the mock clip and the post it belongs to — and the two over-media
  dresses (`StanceControl overMedia`, `ExplainableNumber overMedia`)
  are props on the real controls, so the stream acts through the same
  pad and the same score element the feed does.
- **The post detail exists at last, both bodies** — the gallery post's,
  and the video post's with the clip pinned above the card, which is
  why the author chip leads the card there rather than the screen. The
  comments sheet's board is the first of these with the sheet raised:
  one anatomy, drawn once. The standalone detail the search results,
  the chronicle rows and every post's media had been opening into a gap
  now lands on a board.

### The applicant once-each round — 2026-09-03

Closes the six gaps the pattern-boards round deliberately left open
(item 23): the applicant's stance face and New post starts, wired per
the ruling that an applicant stages each kind of act once (2026-09-01).

- **The first tap opens the real surface, and the act stages.** A
  tap on the stance face still opens the pad, a press-and-hold on it
  still blooms the master board, and New post still opens the wizard —
  the once-each rule governs the *second* tap, not the first, so
  nothing about reaching the real surfaces changed.
- **An exhausted kind answers in place.** Once an applicant has staged
  a post or a stance, the same control's next tap no longer opens
  anything — it answers where it was pressed, "Your post is staged —
  it lands with you." or the stance's equivalent. These are **self
  outcomes marked info-true**, per the user-flow layer's rule that an
  all-informing `advance` fails the gate: here it does not, because
  the *first*-tap outcomes still advance to a real board, and only the
  once-staged branch merely informs.
- **The snackbar is drawn once, on the existing board.** Per the
  Invites precedent on `ProfileApplicant.jsx`, the answer is a
  `Snackbar` on `ApplicantWaiting` — no new board for an outcome that
  is a sentence, not a surface. It is informational, not an error, so
  the Snackbar charter's never-for-errors rule is untouched: nothing
  went wrong, the act is simply already staged.
- **Applicant origins join the guest except lists.** The New-post and
  stance-face control-selector flows already excepted the guest
  origins (`Main`, `FeedBare`, `WalletGuest`, `KeyElsewhere`) because a
  control start must mean one thing everywhere; the applicant boards
  now join them, because staged is not landed — a flow that expects
  New post to end in a signed post cannot walk through a tap that only
  restages what is already staged.
- **The gate**: 114 → 108 gaps, 867 edges unchanged (the six rows were
  already numbered; only their `to` arrays filled in), 56 declared · 51
  resolved · 5 blocked by a gap unchanged.

### The input-error round — 2026-09-03

Item 23's field-error, wrong-credentials, wrong-code and code-mismatch
gaps, closed onto boards (jakob's rulings the same day).

- **A field error wears M3's own text-field error state**: the
  outline and label switch to `--error`, and a body-small supporting
  line in `--error` renders below the field carrying the message
  verbatim. That line replaces whatever board-level helper the field
  drew — Material's supporting slot shows one line, never two — so an
  errored field's helper text disappears and an unerrored field keeps
  its own.
- **The error colour is blessed for field states.** It had carried two
  surfaces before this round — `NetworkError`'s fault line,
  `SigningPending`'s failure — and now grows a third category
  deliberately: form and field errors join fault lines and signing
  failures as the three things `--error` is allowed to mean.
- **Wrong credentials accuse no field.** Sign-in failure is a
  form-level line above the submit button, in the fault-line's own
  voice and styling — neither the email nor the password is
  individually marked, because the system genuinely doesn't know
  which one is wrong.
- **Each surface words its own error.** Unlike the offline board, one
  network-error master answering for every surface, an input error is
  worded per field and per surface — "That handle is taken." is not
  interchangeable with "That code doesn't check out." — so each
  errored board carries its own copy, not a shared component's default
  text.
- **Componentize before you alter.** Hand-coded boards get rebuilt
  from real masters before an error state is drawn onto them, and this
  is now a general principle, not a one-round fix: Join, SignIn,
  Restore and RecoveryCode went first this round; NetworkError,
  ComposeSeal and ReplySeal still owe it their own rounds.
- **Validation timing: on submit, then live only where already
  marked.** A field only re-validates as the reader types once it
  already carries an error — an unmarked field stays quiet until the
  next submit, so typing never produces a field that turns red out of
  nowhere. **The recovery gate is the rule's one named exception**:
  its confirm button never enables on a diverged prefix, so there is
  no submit to wait for and a signal held for one would never come.
  The mismatch line answers the typing itself, the moment the typed
  text stops being a prefix of the code.

Four boards drawn: `JoinErrors` (Handle taken, Password too short —
Email untouched), `SignInError` (the form-level fault line),
`RestoreError` (the recovery-code field), and `RecoveryCodeMismatch`
(the confirm field — `RecoveryCode` grew an `error` pass-through to
reach it, since the confirm field belongs to the master and a surface
has no other way through to `TextField`'s error state). Each board's
submit control keeps its parent's other outcomes and replaces only
the gap with a `self` case — the line updates in place rather than
sending the reader anywhere. Census 114
→ 109 gaps, 867 → 897 edges; the 56/51/5 flow census is unchanged,
since no declared flow walks an error path.

### The menus round — 2026-09-03

The ⋮ every card and every profile has worn since the canvas was
wired, answered at last: twenty-four gap edges pointing at three
menus nobody had drawn (item 23, jakob's rulings the same day).

- **Masters, not per-surface.** Fifteen surfaces open the reader's
  post menu, three the comment's, five a profile's — and a menu is
  the same menu wherever its dot sits, so each is drawn ONCE and
  every surface's edge lands on it. `ReaderPostMenu`, `CommentMenu`
  and `ProfileMenu` join the sheet boards that were already mastered
  this way (the filter, the references sheet, the own-post menu).
- **The license comes up in a sheet.** The row closes the menu and
  raises the terms over the surface the reader asked from — a drawer
  they drop by the scrim, the swipe, or Escape, which is the way back
  a block unfolded inside the post never had. The terms are never a
  state of the card, so no card carries them and no row ever reads
  *Hide license*. `PostLicense` draws the sheet over the post detail
  and `CommentLicense` over the thread: **two boards, because the
  surface beneath is half of what the sheet says** — pointing the
  comment's row at the post's board would answer a question about a
  comment with a post's terms, on a screen the reader is two sheets
  above. They carry the two readings besides, Ada's credit-on-every-use
  against the comment's public domain. Both are `scanExempt` and wire
  one number, the wash: the terms are a block to read, not controls.
- **A sheet over a sheet dims what it covers and takes the next
  rung.** `BottomSheet`'s `stacked` lifts the upper sheet a layer, so
  the wash it already draws falls between the two instead of under
  both, and its surface moves to `surfaceContainerHighest` — elevation
  is tonal, and two surfaces at one rung claim one elevation. The
  sheet below keeps its top edge, its handle and its title in view,
  dimmed: depth you can see beats depth you infer. `CommentMenu` and
  `CommentLicense` are the two boards that stack, both over the
  comments thread.
- **The terms are drawn, not printed.** A quiet inset at the medium
  rung: a caption naming the words the reader tapped, then one row per
  axis with the two readings aligned so the pair reads as a pair. It
  takes **no fill** — the sheet it sits in is a raised container
  already, and a filled inset over it would invert between the
  themes — and no colour, the terms being neither warning nor
  promotion. Public domain is the pair readers already have a word
  for, so the word rides the caption while the rows still spell what
  it means. The sheet takes **no `SheetTitle`**: the inset heads
  itself, and a heading above it would say License terms twice, a few
  pixels apart, in two sizes — the sheet's name lives on its
  `aria-label`. The read side got its
  **own readings**: the chooser's hints address the author declaring
  the terms, and on a read surface "Every use credits you" tells a
  reuser they are owed the credit they in fact owe.
- **Citing and mentioning are one fact.** Both stage a **Reference
  edge**; the word only records what sits at the far end — citing for
  a passive node, mentioning for a person. So both rows open the same
  composer and the same staged row, and only the label knows the
  difference. A typed @handle is not the other half of this: it is
  coloured text and nothing more, while the mention that binds is the
  structured reference.
- **An outbound cite can only open the post wizard, at its start.**
  Every other creatable thing is **pointed by construction** — a
  comment exists on its parent, a chat message goes into its chat, a
  proposal targets the node it would change — so none of them can be
  born from a cite row on some unrelated object. The post is the only
  untargeted creation, which leaves exactly one destination and no
  choice worth offering. So the row opens the wizard's ordinary first
  stage, the reference riding along unseen, and the details stage
  arrives with it staged. `ComposeCited` is that arrival: nothing
  written, the citation already in the references block, which is the
  honest picture of the moment — the reference is the given, the words
  are what is missing.
- **Reached through the wizard, so it wears the wizard's header.** The
  arrow steps one stage back to the words and the X leaves with the
  draft kept, exactly as the ordinary details stage does. A board
  nothing teleports to needs no exit of its own.
- **Citations are declared at creation**, structured inputs only, so
  there is no attaching one to a post that landed — the row starts a
  new post pointing at the old one.
- **Referencing from any other kind lives inside that kind's own
  wizard.** The reply seal already carries + Add a tag and Cite
  something side by side: with only two stages, the seal *is* where a
  comment's tags and references are named. `ReplyCited` draws that
  surface once a citation is staged — the reference joining the acts
  card rather than sitting beside it, because a staged reference is an
  act and the total has to count it. Staged tags and references are
  unstageable everywhere: the reply's staged rows carry the same
  remove the post's details rows do, and ReplySeal's componentize pass
  inherits it. It is a declared **entry**: the picker hands its pick
  back to the composer it was opened from, so no tap reaches this
  state.
- **Only what exists gets a row.** Report is **not** drawn: it belongs
  to a slice the product has not built, and a row for a function nothing
  answers is a promise the sheet cannot keep. It waits in the backlog
  against its slice. Copy link stays out for a different reason — the
  platform's share sheet already carries it. **The slice order bends
  where design does not**: functions closely connected in design and
  flow may be built ahead of their slice when they surface together,
  rather than splitting one surface across two rounds.
- **License, not licence.** One spelling across the masters, the
  fixtures and the prose, and the menu row's words became an **atom**
  in `LicenseChooser` — assigned once, spelled by the cards that mount
  their own menu and by the detail headers that carry it for them.
- **Two flows**: `cite-a-post` and `mention-someone`, each starting at
  its menu row's control and walking the wizard — pick, words, then
  arrival at the details stage with the reference staged. The words
  path's `Next` carries the second outcome that says so, which is what
  lets the search reach that board honestly instead of teleporting to
  it. There is no check-a-license flow — a detour into a sheet and
  back out of it is not a journey.
- **`ComposeDetails` componentized.** The picture path's details stage
  is now JSX over the masters like its twin `ComposeCited`, and the
  conversion closed the drift that prompted it — the hand board's
  staged reference wore an avatar and a stance face and carried no
  remove, where `StagedReference` gives it the post's own cover, the
  pair alone, and the ×.
- **The gate**: 103 → 82 gaps and 897 → 938 edges. The twenty-four
  closed, and three reopened as fresh instances of surfaces already
  owed — the tag picker on the new composer board and again on the
  reply's cited seal, the score drill-down on the new detail state.

### The conformance round — 2026-09-04

Before any new surface, the canvas and the library were brought to
the law they already claimed: whatever is drawn by hand is drawn by
a master, and every master is one component with variants as props
(jakob's mandate and rulings, same day).

- **The library owed itself the most.** The bare primary word — a
  text action with no pill and no minimum width — was re-implemented
  five times inside `components/` and more on boards. It is now
  **`InlineAction`**, Button's sibling so button vocabulary has one
  home, in two rungs: label-large from the seal rows' documented
  deviation, label-small from the describe/upload family. The rule
  between them: a Button when the action owns its line, an
  InlineAction when it rides at the end of somebody else's.
- **Field labels come from the field.** `TextField`'s own `label` +
  `corner` slots are the one label anatomy, and **`FieldLabel`** is
  TextField's named export for captions over things that are not
  fields — a `label` element when it has a control to point at, a
  `span` when it does not. The composer's Title and Description
  gained their accessible names by this ruling.
- **One identity row under four lists** — **`ContentRow`**: ledger,
  campaign, door, chronicle. The chronicle is two lines like every
  other row — the act as its title line, the snippet cut to one line
  with an ellipsis; no chronicle content needs a third line, and a
  cut-off excerpt continues where the card opens. The door's glyph
  rides the system's 20px; the chronicle's inner gaps are the row's
  own.
- **One hairline fact row in two emphases** — **`FactRow`**: seal
  (label strong, value quiet, rules enclosing) and ledger (label
  quiet, value strong, rules separating).
- **One tab row** — **`TabBar`**, cell-driven: a cell with an icon
  takes its accessible name from its label, a text cell's name is
  its own words. The data decides, so the two can never contradict.
- **Drawn controls are real controls.** "Show all" in the pick tray
  is a button, not a span — resting look unchanged, the keyboard
  path and the 48px target restored.
- **The inverse Button is a variant, not an override** — the filled
  button on a tonal panel, documented where Button lives.
- **Masters gained**: `QuotedRow`, `CropViewport`, `CoverRow` (the
  raw HTML frame strip became JSX), `PickTray`, `PickPrompt`,
  `QuietNote`, `ActsFooter`, `SealFooter`, `WizardHeader`'s
  `stageLabel` + `help`, `Caret`; **graduated from the prelude**:
  `TopicRemovable`, `StagedReference`, `RefusedFile`, `StanceRow`,
  `SectionLabel`.
- **Contracts tell the truth.** Every `.d.ts` describes its `.jsx`,
  in both directions — declared-but-absent props removed, present-
  but-undeclared exports added.
- **The bar the lanes ran under**: pixel-identity outside the named
  rulings, every render hunk attributed or the lane stops. Three
  seal boards, both crops and the final batch came out
  byte-identical; the visible deltas are exactly the ruled ones.
- **A post's body is words XOR media, and the card says so.** The
  fixtures had been drawing an impossible post — a picture with a
  body paragraph AND a description under it. `PostCard` now encodes
  the law: a media post carries no `content` (handed both, it draws
  the media and drops the words), and both kinds order **title ·
  body · description**, the caption last, with the 4px seam between
  the two fields. The description clamps to **two lines** in the
  feed; a text body clamps at **18** — floor(376px ÷ 20px), the
  height a picture takes once `--media-max-height` has capped it, so
  a feed of both kinds keeps one rhythm. The detail view clamps
  nothing. Every fixture with a picture now carries its words as the
  description, the stream's caption takes the description too, and
  the caption paragraph took its own role's leading — unclassed text
  had been inheriting body-large's.
- **The compose wizard's ten legacy boards converted** (jakob's
  ruling: all of them). `ComposeWords`, `ComposePick`, `ComposeCrop`,
  `ComposeCover`, `ComposeDraft`, `ComposeLicense`, `ComposeSensitive`,
  `ComposePad`, `ComposeKeyAbsent` and `ComposeSeal` were hand
  `.dc.html` with no source behind them; each now renders from
  `screens/` over the masters, and the last inert "Show all" on the
  canvas became `PickTray`'s button. What moved and why: the seal is
  `ComposeSealUploading`'s anatomy without the upload gate, and its
  stance row now reads the **pair** `StanceReadout` spells — it had
  printed one number while the reference row two lines above printed
  two. The cover strip is `CoverRow`, so its "A picture" caption goes
  (the master says a dashed square with the picture glyph is not a
  photograph, and two other boards already draw it that way). The
  license rows and the sensitive switch became real controls the way
  `Checkbox` makes a row one. The grids' local tile palette — four
  colours with no token behind them — reads off the surface-container
  rungs, as `ComposePickVideo`'s dead grid already did.
- **The last nine legacy boards converted**, and with them the
  canvas: `ReplyCompose`, `ReplyPad`, `ReplySeal`, `EditCompose`,
  `EditActs`, `DiscardConfirm`, `HelpDialog`, `NetworkError` and
  `PadKeyAbsent`. Every board now renders from `screens/`; nothing
  on the canvas hand-copies component markup. What moved and why:
  the reply's seal reconciles with `ReplyCited`, its staged twin —
  one add-row pair, drawn once in the prelude, and one "+ Cite
  something" between them where the bare board had spelled the kinds
  out. `ReplyPad` **takes** `StancePad`: a reply's stance is toward
  somebody else's post, so both parameters are the author's and the
  square is the right value space — the refusal above is about one's
  own post, not about pads. `NetworkError` is `ComposeSeal` unsent,
  so its stance row took the same pair correction the seal's did.
  `DiscardConfirm` draws the reply composer from the prelude rather
  than a copy, which is where the two boards' "+ Add" words stopped
  disagreeing. `PadKeyAbsent`'s feed card, drawn before the body-XOR
  round, arrived carrying everything `PostCard` grew since — its
  topics, its citation line, its share, and the resting face the pad
  above it says it has.
- **Three masters were refused, each for the same reason**: the
  component and the board are not the same thing. `CropViewport`
  locks a shape and masks around it, which is right for a profile
  picture and a video cover and wrong for the post crop, where the
  author is choosing the shape. `LicenseChooser` draws the two axes
  as wrapped native radios; the sheet gives each reading its own row
  and reads the master's tiers for the words, so the layout diverges
  and the terms cannot. `StancePad` is the square where both parameters are the
  author's, and on one's own post the second is not — your own post
  always reaches you in full, so that board draws **one axis**, and
  the system owns no one-axis pad to draw it with.
- **Held for rulings** (each parked in the backlog with its
  question): ChipMini's tone, the reply seal's staged-reference
  placement, the Mark drawings, the wizard footer's shape, the
  comments-sheet shell, the "+ Cite something" voices, the topic
  chip's ×, and the acts line's target.
- **The gate**: 939 edges · 82 gaps · flows 58/53/5, unchanged end
  to end — which is the round's whole claim: the canvas redrawn
  from masters without the graph moving.

### The parked rulings — 2026-09-08

The questions the conformance round held, answered by jakob and
applied in one pass. Every visible pixel on the canvas moves for one
of these and nothing else.

- **An overlay sits over the REAL surface.** A sheet, a dialog or a
  wash covers the surface the reader came from, so the board draws
  that surface whole rather than a shortened stand-in of it — the
  round's largest visible change, on six boards. The post's seal, the
  reply's seal and the post edit are each written once in
  `_shared.jsx` and drawn by the board that owns them and by every
  overlay over them, by the same rule that moved `ReplyDraft` there:
  a body on a second board stops being board-local. The under-layers
  stay inert, which is what their `scanExempt` lines already say, so
  the graph does not move.
- **The text body's clamp is derived against the picture the reader
  sees.** `--media-max-height` caps a 4:5 crop before its uncapped
  447.5px — 376px on the 390×844 board — so the ceiling is
  floor(376 ÷ 20) = **18** lines, and a text post again stands as
  tall as the media post beside it rather than ~64px taller.
- **`SheetTitle` owns the heading's row.** `trailing` takes what the
  line carries besides the name — the screen's one "?", the switch a
  sheet exists for — and the license and sensitive sheets stop
  assembling that row by hand. Their names take the master's
  `title-medium`.
- **`HelpDot` has an `inverse`**, `Button`'s word for the same
  situation: on a tonal panel the ring and the glyph take the panel's
  own `currentColor` instead of spending `--border-hairline` and
  `--primary` inside a block that has a colour family already. The
  two key-absent boards adopt it and render byte-identical.
- **An acts row that offers an act is the button.** `ActsCard`'s
  second row kind has no value slot to clip, so the seal's add-rows
  keep the 48px target their word promises instead of having it cut
  back to the ink. Truncation stays where a long value needs it.
- **A pattern exemplar wires only the behaviour it exemplifies** —
  the `scanExempt` convention's stated rule now (§13, canvas pages),
  with `NetworkError` as its exemplar: the surface's other controls
  belong to the board that owns them, and wiring them twice would
  give one control two edges.
- **The discard dialog gives its filled button to the safe answer**,
  `RemoveConfirm`'s weighting. A think-twice dialog exists to make
  the costly answer deliberate; the destructive word stays quiet.
- **The license sheet reads the master's tiers.** `ATTRIBUTION_TIERS`
  and `PROVENANCE_TIERS` carry the readings and their hints, so the
  sheet keeps its own layout — one axis per section, one reading per
  row — and cannot say a shorter version of what a license promises.
- **The one-axis pad names a face the table has**: at +0.30 the
  nearest `STANCE_ANCHORS` row is the first, 🙂 "Nice".
- **A component never states a raw type value** (§7). The quiet note
  and the acts footer take `--text-label-small--letter-spacing`, and
  the label-small line gains 0.1px of tracking on 32 boards.
- **The composer's "+ Add" speaks in one voice** — the bare small
  word on all five sites. An action riding the end of somebody else's
  line is an `InlineAction`; the pill is for an action that owns its
  line.
- **The edit's staged reference shows the whole staged fact**, as
  `ComposeDetails` draws it: the kind under the name, and the pair
  the citation signs.
- **Item 35 ruled** (video playback): media is full-bleed on card and
  detail alike, the handover is a shared element on the media frame
  with the chrome fading, and a video post's card description says
  `1 clip · 0:24` rather than "1 picture". All three are conform
  items for the apps.
- **A display name is optional.** Account creation never asks for
  one, so nothing may require it later: an explicit null clears the
  field, and a profile with no name written is presented by its
  handle (api-spec's profile-update clause; the breaking schema
  change is backlog item 36).
  With the requirement gone, "A display name can't be empty." became
  a false sentence and `ProfileEditError` retired with it — profile
  edit has no true local failure left to exemplify, so Save's edge
  carries the seal alone and no gap opens.
- **The gate**: 921 edges · 81 gaps · flows 58/53/5 at the round's
  close. The rulings themselves moved nothing — the under-layers
  grew real controls only on boards the scan already exempts — and
  the six edges that left were `ProfileEditError`'s, gone with the
  board.

### The slice-2.5 rulings — 2026-09-08

The readiness census for slice 2.5 found the media path itself
gap-free and the blocks elsewhere: three stale contracts, one
missing destination, and a handful of drawing questions only jakob
could close. These are the answers, and what each one moved.

- **A tap on a gallery card's picture opens the post.** Every
  single-media card's region is «post media» and opens the post;
  the two gallery boards drew a pager and no way in, so a reader
  on a gallery card could not reach the post through its picture.
  The pager keeps the swipe and gains the tap — one region, two
  gestures, declared the way the stance face already declares its
  tap and its press-and-hold: one via, two outcomes. The edge
  count does not move, because a second outcome is not a second
  edge.
- **A portrait clip's tap opens the post detail until the stream
  ships.** The stream is slice 3's surface and the canvas draws it
  as the end state; 2.5.2 needs the tap to land somewhere real in
  the meantime, and the post detail is where every other media tap
  already goes. A roadmap sentence, no rewiring — slice 3 takes
  the tap back when it arrives.
- **A post-scale clip upload failure takes `ReplyVideoFailed`
  1:1.** The comment scale is drawn, the fault is the same fault,
  and the blessing is the precedent the web avatar flow and web
  `ReplyVideo` already ride. No board.
- **The cover preview's playing state is its own board.** The
  video conform round ruled that the cover "is the clip's face
  wherever the clip isn't running, and never returns once playback
  has started" — so a play disc and a pause button cannot share a
  frame, and rest and playing cannot share a board. *Cover · the
  preview playing* draws the post detail's own transport over the
  running clip, which retires web's native-controls deviation. It
  carries **no fullscreen toggle**: the clip is not published yet,
  there is no viewer to open, and a drawn control the graph cannot
  wire would have to invent a gap to point at. `MediaAttachment`
  passes `fullscreen` through for it and every other board renders
  byte-identical.
- **The reply seal earns the orphaned line.** "Replying also signs
  your opinion on the post it answers." stands as a `QuietNote`
  beneath the ruled block — `FactRow` grows no note slot, because
  the line is a fact about replying rather than about any one row.
  It lands on both states of the seal: they are one surface, and a
  note on one of them only is a disagreement.
- **`Chip`'s borderless `readout` tone** is the seal board's 26px
  chip, and `ChipMini` is retired — answered in the sources
  already, and recorded here because the backlog was still calling
  it held.
- **Every field error announces and names its field.** The
  supporting line carries an id the control names in
  `aria-describedby`; in the error state the control adds
  `aria-invalid` and the line takes `role="alert"` — the W3C forms
  tutorial's own wiring, applied uniformly rather than field by
  field, because a rule about which errors are worth announcing is
  a rule nobody can predict. Markup only: no pixel moved, proved
  by the renders, whose every changed byte is one of those four
  attributes.
- **The wizard footer came back with its premise corrected, and
  was ruled the day after.** Thirteen boards draw a Next, not
  twelve; four hand-draw the padded footer, not three, and they
  are exactly the four whose content runs edge to edge. The other
  nine sit in a column that already owns the padding, each ending
  on its own bottom value, so a master owning `12px 24px 16px`
  either doubles their sides to 48px or lifts the button out of
  the column and flattens nine rhythms into one. Ruled 2026-09-09:
  `WizardFooter` is scoped to the edge-to-edge anatomy. The four
  take it and no pixel moves; the nine keep their column-owned
  spacing. The padding is what separates the three feet — this one
  owns its sides because nothing above it does, `SealFooter` owns
  none because it sits in a padded column, and a sheet's Done row
  is a third shape again.
- **The docs say what is true now.** The sensitive self-mark's
  contract field ships and 2.5.3 stops claiming it does not; the
  stream is slice 3's, not 2.7's, which is Search; share is on the
  feed card with the row's stated order. `comment.md` gains the
  comment's media grammar — four pictures or one video with its
  poster, the clip at half a post's budget — and says the no-cover
  rule of the gallery so it cannot be read as denying the clip its
  face. `api-spec.md`'s post edit takes the nullable body the
  shipped schema already has, and its tag-and-citation line states
  the mechanics without denying that the edit surface stages them:
  the records are separate gestures, the seal is one.
- **The gate**: 119 → **120 screens**, 921 → **930 edges**, **81
  gaps** and **flows 58/53/5** unchanged. Every unit of that
  movement is the cover preview's board and the nine edges it
  brought. Nothing else on the canvas moved a pixel except the
  reply seal's three boards, which gained the line, and the
  license sheet's two axis labels, which swapped a raw `0.5px` for
  the tracking token that is the same half-pixel.

### The audit answers — 2026-09-09

The implementation session's UI-conformance audit closed with a queue:
eight places where the boards or the docs contradicted themselves, and a
row of questions the apps could not build past. These are the answers.

**The scope ruling comes first, because it reframes several of them.**
*Desktop is out of design scope until the mobile set is complete* — jakob:
"we currently dont design and build for desktop.. if someone uses desktop
they will see whatever there is, not optimized". The statement lives in
§2. The desktop card idiom and the desktop fullscreen viewer park into a
desktop round of their own.

- **The board was right and the prose was stale, three times over.**
  `DiscardConfirm` fills *Keep writing*, the safe answer, and the entry
  record says so; `ReaderPostMenu`'s docblock still carried the in-place
  license reveal the menus round replaced with a sheet; §7's component
  inventory had fallen behind its own directories, and the documentation
  pair belongs to the module file, not to each component it exports.
- **`ReplyMediaErrors` takes its siblings' foot line.** Pictures are in
  its tray uploading, so "…and they upload while you write" is true
  there; no rule ever suppressed the upload half on a refusal.
- **One add control, one voice.** `CommentEditActs` drew "+ Add · 1 of 4"
  as a text button where `CommentEdit` drew the ruled InlineAction. The
  ruled line wins on both.
- **The display-name field says `Optional`** — item 36 ruled the name
  optional, and Bio and Website already say it.
- **Page titles are `title-large`**: every board's band title, and M3's
  top-app-bar spec. `headline-small`'s home is a dialog heading, and the
  type table names both.
- **0.38 is the one disabled opacity**, Material's own. `--opacity-disabled`
  had no reader left and is retired; `--opacity-resting-face` carries the
  same number for a different purpose and stays.
- **`--surface-field` is retired.** It named a fill `TextField` reversed
  away from, and its only readers were the stance pad's field, which take
  `surfaceContainerHighest` direct.
- **§7's two named breakers take tokens.** `InlineAction`'s `sm` rung
  reads `--text-label-small--letter-spacing`, the same half-pixel it spelled;
  the over-media stance face takes `--size-face-over-media`, because the
  emoji is a mark sized to the line face that stands in for it rather than
  a rung of the type ramp.
- **The details stage's Next is full-width**, like every other stage.
  `ComposeDetails` and `ComposeCited` leaned on the column's stretch
  instead of saying so, which is how the two apps came to differ.
- **The waiting card can be put away.** It is the one task card naming
  nothing to do, so it gains `Got it` in `TaskCard`'s secondary dress, and
  **the dismissal is remembered on the device**: putting it away twice
  would say the first tap did nothing.
- **The APK line is the web's alone.** It offers a browser visitor the app
  they are not in, and the app never carries it.
- **Where `navigator.share` is absent the control copies the link**, and a
  snackbar says *Link copied*. One action, never a menu of ours.
- **Android's autoplay-suppressed signal is named**: *Remove animations*
  (an animator duration scale of 0), or Data Saver restricting background
  data. Those two are what the play-disc card reads.
- **Focus is a platform split** — Compose's M3 focus treatment on Android,
  the 2px `:focus-visible` ring on the web (§4).
- **A completed action is confirmed by a snackbar on both platforms** (§3).
  Web's coloured success line is the deviation and conforms in its catch-up.
- **Explore and search land with slice 2.7's backend** — no surface built
  against the exact-match lookup before it.
- **The feed's filter honestly reads Newest until slice 3's ranker
  ships**; the label and the behaviour never silently diverge.
- **Which affordance folds into the ⋮ first was already answered** by the
  share record above: the action row's order is also its queue, and share
  is the first to move.
- **The draft board's fresh-start line ends on its dash** — *"Or start
  fresh —"*. The ruling is jakob's of 2026-08-31, recorded here now: the
  grid below the offer is the rest of the sentence, and a clause spelling
  out how a new post starts would repeat the fresh composer's caption.
  Android has drawn it since that day; `ComposeDraft` takes it with this
  round, and the web conforms in its catch-up.
- **The gate**: 930 → **931 edges**, with **120 screens**, **81 gaps** and
  **flows 58/53/5** unchanged. The one edge is the waiting card's `Got
  it`. The fresh-start line is the one other drawn change; beyond those,
  nothing moved a pixel — the type table and the retired tokens are
  comments and declarations, the tracking token is the half-pixel the
  literal was, and no board draws the over-media face.
### The audit states — 2026-09-09

Six of the conformance audit's open questions, ruled by jakob the same
day and closed onto boards. Every one of them was a state the product
genuinely reaches and the design had never drawn, so both apps invented
an answer — and where two apps invent, they disagree.

- **The chronicle scrolls like the feed.** No Show more, no page
  numbers: infinite scroll, which leaves nothing to draw at rest and
  exactly one thing to draw when it fails. `ProfileMoreFailed` is that
  row — `Couldn't load more` with a `Retry` beside it, standing where
  the next page would have been. It is **quiet, not `--error`**, and
  that is the ruling's own word carried into the drawing: rows are
  already on screen, so the page that didn't come means stale, not
  gone. `EmptyState` refuses the colour for the same reason, and the
  three things `--error` is allowed to mean — fault lines, signing
  failures, field errors — do not include a list that stopped growing.
  The in-flight state needs no board: it is `LoadingState`'s `Loading…`
  in the same slot.
- **An absence and a fault are opposite states.** `ProfileNotFound` is
  terminal — the answer arrived and it was no, so it draws `EmptyState`
  and offers no way on, because nothing about trying again makes a
  profile exist. `ProfileUnreachable` is `NetworkError`'s family — no
  answer arrived, so it keeps the failure voice and a Retry. What the
  exemplar keeps and this one cannot is the point of the pair: the
  seal's fault leaves a whole signed post standing beneath it because
  the send is what failed, and here the read is what failed, so there
  is nothing beneath it to keep.
- **The reset link's destination exists at last.** `ResetNew` is one
  password field and one commitment, with no field to paste the link's
  own secret into — which is what made both apps put **token** on
  screen, the word §3 bans. The boards never carried it: `Reset` has
  said `Send reset link` all along, and the finding is the apps
  diverging from the board, not the board needing a fix. What the
  design owed was the destination, and the word leaves the apps when
  they take the drawn lines. It draws no back arrow, for `Verified`'s
  reason — a mail link has no previous screen of ours behind it.
- **A malformed invite gets one line.** `That doesn't look like an
  invite link.`, in the shape the register already uses for a local
  format failure, on `InviteEntryError`. `JoinInvalid` answers a link
  the product read and refused; this answers something it could not
  read as a link at all — two facts, two boards.
- **Android's verification landing is links-only.** `VerifiedApp` and
  `VerifyExpired` are what App Links open when the URL reaches the app
  instead of a browser. The browser landing tells the reader the app
  already knows and sends them back to it, which is addressed to
  somebody who is not there once the app is what opened. **No in-app
  token paste** — the link is the proof, and the field Android ships
  today existed only because this board did not.
- **The reply pad's "?" opens its own topic.** The copy was never
  missing: **Toward what you answer** has been in `copy-voice.md` since
  the compose-session rulings, and it says the true thing — a reply's
  stance is toward the post it answers, both axes, on the reply's own
  signature. What was missing was a board drawing it and an edge
  pointing there; `ReplyPad`'s "?" led to the seal's Signed-actions
  dialog. Android left the dot out rather than open the post pad's
  topic, which says "only for-or-against is yours to set" and is the
  opposite of what is true here — the right call about the wrong
  problem. `ReplyPadHelp` draws it over `ReplyPadBody`, the pad's real
  surface lifted into `_shared.jsx` so the board underneath a modal is
  never a stand-in.
- **The gate**: 120 → **128 screens**, 930 → **957 edges**, **81 gaps**
  and **flows 58/53/5** unchanged — no journey gained a blocker, and no
  gap was closed or opened, because every board this round drew was a
  state nothing had ever pointed at. The witness was re-blessed once,
  for the growth the flow layer documents: `nav · New post` is declared
  as a control, so its origin census grew from 25 boards to 27 when the
  two full-chrome profile states joined it. No board outside the round's
  own moved a pixel — `ReplyPad` included, whose drawing was lifted to a
  helper and re-rendered byte-identical.

The two rounds landed together, and the canvas at their close:
**128 screens · 958 edges · 81 gaps · flows 58/53/5**.

### The recovery and sensitive rulings — 2026-09-09

Two loose ends the W0 conform lanes filed, ruled by jakob the same day
(backlog items 41 and 42). Both are places where a board and a
component said different things and each app picked a different one.

- **The earned button stands, and the mismatch is a diverged prefix.**
  "I've written it down" keeps `disabled={!matches}` — the code is
  shown once, so leaving the screen is earned by typing it back, not
  by pressing past it. That makes the press no trigger for anything,
  so the mismatch line answers the typing instead: it appears the
  moment the typed text stops being a prefix of the code, and never
  before. An empty field says nothing, and a correct partial says
  nothing — it is still on its way to being right, while a prefix that
  has diverged never can be. The two halves are owned apart: the
  surface words the line, the master decides the moment. The entry
  map's edge reads the divergence, and `RecoveryCodeMismatch` now
  holds a real diverged prefix — the line answers typing, so a board
  drawing it over an empty field drew a state the surface cannot
  reach.
- **The recovery gate is the timing rule's one named exception.** *On
  submit, then live only where already marked* is the rule, and it is
  written for a form with a submit to wait for. This gate has none:
  the confirm button never enables while the prefix is diverged, so a
  signal held for submit is a signal that never comes.
- **The sensitive sheet says the words, not the description.** *Veils
  the pictures and the words until a reader chooses to look.* One line
  for both scales, because the comment editor's Mark row opens the
  same sheet: a comment has no description to name, and a post's
  description is words. The "?" behind the sheet is separately blessed
  copy and still says *the description* — item 42 carries it.
- **The gate**: **128 screens**, **958 edges**, **81 gaps** and **flows
  58/53/5**, every one unchanged — nothing was drawn or pointed at that
  was not there before. Three boards moved a pixel and no more:
  `ComposeSensitive` for its line, `RecoveryCodeMismatch` for the
  prefix in its field, and `MapEntry`, which is 13px taller because the
  reworded edge wraps.

### The shell round's stops — 2026-09-09

Three stops the w1-web conform lane filed against the shell (backlog
item 43), ruled by jakob the same day. The middle one is a rule for the
whole canvas rather than a fix to one board.

- **The entry arrows name boards.** The header's arrow is a link and
  never history, so a deep-linked visitor has to land somewhere: the
  three entry screens that pointed at `back` now name a destination.
  `InviteEntry` and `SignIn` are roots of the funnel and up from a root
  is the public front door, `FeedBare`. `Restore` is reached only from
  signed-in surfaces whose key is absent, so up is that reader's own
  home — `KeyElsewhere`, which is also where the app opens for them, and
  which re-offers the restore they walked away from. All six entry
  screens name a board now, so the entry band's layout task can take
  them together instead of splitting the flow's look.
- **The canvas draws the whole app; each release builds its slice.**
  Designing feature by feature would move the same surfaces every time a
  new one arrived beside them, and every move is frontend work done
  twice — so the boards settle the end state and the apps add the pieces
  their slice binds. An affordance whose destination is neither designed
  nor built stays out until one exists: never a dead control, never a
  label saying what the code does not do. The statement lives in §2, and
  the Newest ruling above is the same principle read from the label's
  end.
- **The chats affordance is end-state truth.** `CograBand`'s line and
  the graph's gap were never in conflict. The band carries chats because
  messaging belongs on every tab root; the apps draw it the release a
  chat surface exists to receive the tap. Nothing is redrawn — the edges
  stay as they are, and the docblock says which half is the end state.
- **The guest and applicant bands ship now; the rank waits.** A band
  that names whose view this is tells the truth the moment it is drawn,
  and the vantage it names — the genesis moderator for a bare arrival,
  the inviter for an applicant — is knowable without a ranker. So both
  bands stand from the start, reading newest like every other feed until
  slice 3. What waits for the ranker is the borrowed *order*, the
  invite-link vantage and the contract field it needs, and the band's
  line about ranking. Naming a vantage a feed does not yet rank from is
  the staging rule, not the label-versus-behaviour divergence the Newest
  ruling refuses — that one is about what a shipped control claims.
- **The gate**: **128 screens**, **958 edges**, **81 gaps** and **flows
  58/53/5**, every one unchanged — three edges were reworded in place,
  and nothing was drawn or pointed at that was not there before.
  `MapEntry` is the only board that moved: three readouts take their new
  destinations, three connectors appear where a terminal drew none, and
  two inbound counts rise with them.
### The settings round — 2026-09-09

The surface three shipped "?" texts had been promising and no board had
ever drawn. Both apps have shipped a full settings screen since slice 1;
the design owed it a shape, and 2.5.3's default-license preference owed
it a home. Ruled by jakob the same day (backlog item 20).

- **One scrolling page, ordered by use.** Theme, taking a stance,
  writing, reading, key backup, sessions, credentials, sign out — a
  frequency ranking, not a taxonomy, which is why credentials sit near
  the bottom where a taxonomist would have led with them. It is a task
  the reader leaves rather than a place they live in, so it carries no
  bottom bar and the back arrow goes where the gear was. The board draws
  the whole scroll: the ruling this round records is an order, and an
  order cut off at 844px is an order nobody can review.
- **`SettingsGroup` and `SettingsRow` are the anatomy**, minted here
  because eight groups improvising eight layouts is the page the ruling
  asked us to leave behind. A quiet heading above, a filled card of
  rows, a footnote under it — and the footnote is what keeps a row
  short: the fact a group owes the reader is said once, beneath it,
  instead of inside every row. The trailing edge is the variant, and
  the chevron means one thing only: this opens another surface. The
  **house switch** joins them: drawn once on the sensitive sheet, and a
  component the moment a second surface wanted one.
- **No leading icons, and that is §5 rather than taste.** The page
  would want brightness, palette, key, devices, logout, and the
  system has none of them; icons here are exported from Material's set,
  never drawn. Grouping and headings do the scanning work an inset
  grouped list asks of them anyway.
- **Theme is drawn on the page, not behind a picker.** It is the one
  setting whose effect is the surface the reader is standing on, so a
  chooser covering the page would hide the very thing it changes. Three
  one-word readings need no explaining and take the segmented control,
  which sheds the group's card: a bordered pill inside a filled card is
  two containers saying the same thing a few pixels apart. The stance
  input's three readings each need a line, so they stay rows.
- **Credentials become rows.** Both apps stack three whole forms — six
  fields, three commitments — on the settings page itself. Each is now
  a row showing where it stands, and the three screens behind them are
  gaps, honestly named. That is the round's one deliberate subtraction
  from what ships.
- **The default license is the contract's first account preference.**
  It joins `UserPreferences`, the cross-device type `api-spec.md`
  already carried, and its row opens the sheet the seal opens — one
  license surface, never a second. Theme and the stance input stay
  device-local and out of the contract.
- **The backup ceremony splits in two.** The settings card stops
  showing a code inline (item 41.1): `SettingsBackup` states the
  consequence and takes the proof, and the drawn `RecoveryCode` board
  is what the commitment leads to, trap and all. It is `Restore`'s
  shape on purpose — the two screens ask for the same secret in the
  same words for opposite reasons. **The proof step is the platform's**:
  a screen-lock gate where the OS offers one, the current code where it
  cannot.
- **`YourKey` draws the revealed state**, because what no other surface
  shows is what an export looks like: two encodings of one secret, each
  named exactly — PEM, PKCS#8, hex, Ed25519, §3's stated exception. The
  gate in front of it is the platform's, like the backup's.
- **The gate**: 128 → **131 screens**, 958 → **979 edges**, 81 → **82
  gaps**, and **flows 58/53/5** unchanged. The three new boards carry 21
  edges; two gaps closed where the profile's gear had pointed at
  nothing, and three opened where the credential rows now point at
  screens the round did not draw. No board outside the round's own moved
  a pixel — only the generated maps, which grew with the edges.

Reviewed the same day, and finished on the review's own ruling. The
page had five rows pointing at nothing of its own: two borrowed a board
from another screen, three ended in an honest gap.
jakob's reading was that a canonical canvas which stops at the row is
a canvas implementation finishes by guessing, and guessing is where a
settings page starts looking improvised. Six boards close it, and none
of them invents a control.

- **A borrowed sheet is not a drawn board.** Pointing the license row
  at `ComposeLicense` and the reading row at `FeedSheet` was true about
  the control and silent about the surface: those boards draw the seal
  and the feed beneath their sheets, and neither is what a reader is
  standing on when they open the row. `SettingsLicense` and
  `SettingsReading` draw the same sheets over the settings page, which
  is what the product actually shows.
- **The page beneath is the page, not a few of its rows.** Both boards
  render `SettingsBody` — the same body `Settings` draws — because the
  ruling this round records is an ORDER, and a hand-made handful of
  rows under a wash would be a second order nobody ratified. `Settings`
  frames the whole scroll; these two keep the phone's 844 and let the
  page run past it, the way a scrolling page under a sheet does.
- **A settings sheet is titled by the row that opened it.** The seal's
  sheet needs no heading — the composer is still visible around it —
  but a sheet that covers the surface it came from has to say what it
  is. The title is the row's own words, so the two cannot drift, and
  the "?" moves onto the heading's row, which is `SheetTitle`'s own
  rule. Neither sheet gained a control; one gained a heading.
- **The license sheet's settings reading is the one line it owed.**
  *Terms for anyone who reuses this* is written for the post being
  signed and stays there. The account default says what it actually
  does: where every new post starts, binding nothing already
  published — `api-spec.md`'s own wording, said to a reader. It keeps
  `Done`: over settings nothing reacts behind a sheet to be watched,
  and both of the page's sheets commit.
- **The filter's two ends now meet.** The help text has always said
  *your default lives in settings*; this is settings, and it is the
  same sheet — `FeedFilterSheet`, the half of `FeedFilter` that is not
  the pill. Search took the trigger alone because it owns its sheet;
  settings takes the sheet alone because its row is the trigger. The
  order section keeps §13's standing obligation: the drawn default is
  `Ranked`, and until slice 3's ranker ships the shipped one reads
  Newest, here as in the feed.
- **Three credential screens, one family.** `ChangePassword`,
  `ChangeHandle` and `ChangeEmail` take `Restore`'s column, which
  `SettingsBackup` already took: heading, the consequence, the fields,
  one commitment, the thing to know last. Each carries a fact the apps
  leave to be discovered — the password change keeps THIS device signed
  in where a reset does not, a freed handle is claimable and its links
  die, and an email change is proved from both ends.
- **The email change is two boards, and the line both apps ship is
  wrong.** *Check both inboxes — either message's code confirms the
  change* tells a reader one message finishes the job. `auth.md` and
  `api-spec.md` agree it does not: the mutation takes either side's
  proof in either order, but the change applies only once BOTH have
  landed — and the two errands differ, a code to type from the current
  address and a link to click at the new one. The code field does not
  exist until the messages have gone, so the request and the
  confirmation are two states and two boards.
- **What is drawn is the resting state.** Validation is on submit
  (§13's timing rule), so an untouched form has nothing marked. The
  marked states of all four task screens are undrawn, and so is the
  half-confirmed email — the graph carries that one as an outcome of
  the confirm rather than a board.
- **The gate**: 131 → **137 screens**, 979 → **1006 edges**, 82 → **79
  gaps**, and **flows 58/53/5** unchanged. The six boards carry 27
  edges and close exactly the three credential gaps, opening none. No
  hand-drawn board moved a pixel — not even `Settings`, whose body
  moved to `_shared.jsx` byte for byte; only the five generated maps,
  which follow the edges.

Reviewed on the boards themselves, and three findings came back. Each
is a thing the drawing said that the surface would not hold.

- **A reading squeezed to a stub is not a reading.** `LicenseAxis` gave
  the tier's name flex-basis zero, so `Credit commercially` and
  `Record commercially` broke over two lines while their consequence
  wrapped ragged beside them — and the axis stopped reading as a
  column, which is the one thing an axis of three has to do. The name
  now takes the width its words need and the consequence takes what is
  left, ragged to the LEFT so every row ends where the one-line rows
  end. The dot and the consequence centre on the name's first line, so
  a longer consequence grows the row downward and nothing above moves.
  **The defect was the seal's too** — `ComposeLicense` had shipped it
  since the conformance round, and one master carries both sheets, so
  the compose board is the fix's second attributed hunk.
- **A sheet that covers its own trigger has to commit somewhere the
  reader can reach.** Titled, the filter sheet runs past its 88% and
  `Reset` became the last scrolled item, at the screen's bottom lip
  with nothing under it. `FeedFilterSheet` gains a `foot`: given one it
  owns its height, the sections scroll inside it, and the Done row —
  the license sheets' third anatomy — is pinned beneath them, clear of
  the safe area the sheet already pads for. Given none it is sized by
  its content, so the feed's own sheet is unchanged; the feed's filter
  is the one that applies live, and the one with no `Done`.
- **A confirmation that draws one half reads as the whole.**
  `ChangeEmailConfirm` showed the field for the code and nothing for
  the link waiting at the new address, and `Confirm email change` said
  the press finished the job. `auth.md` is explicit that it does not.
  Both sides are drawn as a pair now, each naming its address and
  saying it is still outstanding, and the commitment is `Confirm the
  code` — what pressing it actually does.
- **The gate**: **137 screens**, **1006 edges**, **79 gaps**, **flows
  58/53/5** — every count unchanged, because none of the three is a
  route. Four boards moved: the three reviewed, plus `ComposeLicense`
  through the shared axis. `FeedSheet`'s only diff is a generated
  `useId` value, which followed the master's new branch and no pixel.

### The tag round — 2026-09-09

Every `#chip` in the system pointed at a gap, and there were
twenty-four of them — the most any one undrawn surface had ever
carried. Slice 2.3 shipped the topic page, the picker and the pair
sliders in both apps in August; the canvas had drawn none of them, so
what the apps ship had never been ruled. Ruled by jakob the same day.

- **"Tag" is the word on screen; "topic" is the word in the record.**
  Tags is what people already call these, and *topic* came in from the
  L1 author — so it stays where it belongs, in the contract, the docs
  and the graph, and never reaches a label, a count, a placeholder, an
  accessible name or a "?" text. The sweep took `FieldLabel`,
  `FEED_KINDS`' label, `TopicsLine`'s worded counts, the sheet's title
  and accessible name, Explore's placeholder, four blessed "?" strings,
  the graph's own edge labels and case texts, and both flow
  descriptions. **The law stops at the code's names**: `TopicChip`,
  `TopicsLine`, `TopicRemovable`, the `topics` prop, `kind="topic"`,
  the `NODE_GLYPHS` keys and the `open-a-topic` / `add-a-topic` flow
  names all stay, because they name the record and nobody using the
  product reads them. `FEED_KINDS` is the law in one line — value
  `topics`, label `Tags`. One word keeps its ordinary sense: a help
  dialog's *topic* is its subject, which is why `ReplyPad`'s case text
  was left alone.
- **One spelling, and it is the bare word.** `+ Add a tag`, drawn as
  `InlineAction` on all nine composers that offer it, retiring the
  outline button seven of them wore. The tag block now takes the
  References block's exact anatomy — label, the staged set, the bare
  word under it — because staging a tag and staging a citation are the
  same errand and two shapes for it was an accident of when each was
  drawn. The nine also collapse the marker table's two pins into one.
- **The page is a subpage of search**, so its arrow is a link to
  Explore and it carries no bottom bar — the settings round's rule for
  a surface a reader arrives at, reads and leaves. Its title is the tag
  with its `#`.
- **No order control, and the contract is the reason.** `taggedContent`
  is limit-bounded and returns a plain list, newest claim first; the
  schema says a Relay connection "would promise a pagination the read
  cannot honour", and a Ranked/Newest swap would promise an ordering it
  cannot serve either. So there is no order section, no pagination and
  no load-more. In the end state the ranker orders this list — a
  staging note, never a control.
- **Following is a stance, and its surface waits for slice 3.**
  hashtag.md §3 makes a follow an **Affinity** record toward the Type,
  parameters signed over [-1, +1], so the stance control is its input —
  but a stance anchor on the page header's trailing edge read as a
  stance readout for the post the reader arrived from, and jakob's
  review removed it. The tag page carries no follow control; the
  gesture gets its surface in slice 3's round, which is also when the
  roadmap first lets it ship (topic follow is client-hidden until the
  topic feed lands).
- **Every row carries its claim, plainly.** A signed act is public
  record, so `TaggedRow` simply shows it: the nearest of the thirteen
  `TAG_ANCHORS` leads the flag and the exact pair sits with it. There
  is no reveal gesture on a content surface — a chip's tap goes to the
  tag's page, on every surface, always, and what a node's own tags are
  worth is read in the tags-and-references sheet.
- **The empty page is contractual, not an error.** Every well-formed
  name already denotes a Type, so `hashtag(name)` resolves without a
  registry row; the board says the tag exists and the list does not
  yet, and never "not found".
- **The picker has no creation gesture, and cannot.** A Type anchors
  vacuously and is a commons — a never-used name is unused, not
  missing — so there is no `Create #foo` anywhere, and the footnote
  carries the mechanic instead. Its candidate list is the end state:
  Hashtag `name` is indexed, but only from 2.7, and
  `referenceCandidates` explicitly refuses to offer topics today, so
  the apps ship type-only until then. The legality gate is stated under
  the field and canonicalization is previewed live, because a reader is
  choosing a permanent public endpoint.
- **The pair editor is the pad** (`TagPad`), over the reach the census
  gives a Tag rather than over a stance's square — see *The tag pad*
  below. Defaults are `TagInput`'s, **+0.1 and 1**. The staged chip
  became a button for the first time: the conformance round left the
  pill inert because removal was the only thing a tag was for, and now
  it is not.
- **A tag's pair is written unlike a stance's, deliberately.**
  Relevance keeps its sign because the sign is the content; confidence
  drops it, because a `+` on a value with no negative half advertises a
  pole that does not exist. `+0.40 / 0.90`, assigned once in
  `formatTagPair`. The compose default for a tag is **+0.1 / 1**;
  references keep +0.10 / +0.10, both axes being signed there.
- **A tag is a search result kind**, wearing the `#` tile and a rank on
  its right edge — never a use count, which would be nobody's view in
  particular and unexplainable.
- **The looks bar.** Mastodon's hashtag page gives the shape: the tag
  as the title, a chronological column of whole posts (its header
  follow was taken first and removed at review — above). Refused: its
  "N people talking"
  figure (a global popularity count is the badge farming §3 rules out);
  Instagram's media grid (this list is not all media) though not its
  absent order switcher, which we reach by the opposite route — it
  curates algorithmically and we cannot; X's Top / Latest / People tabs
  (a segmented row of tiers the contract cannot serve, on a page that
  would then be search again); Tumblr's "post this tag" button (a
  compose entrance nothing has ruled). The no-creation rule is where
  this product parts from all four, and the contract forces it.
- **The gate**: 137 → **142 screens**, 1006 → **1039 edges** (1043
  drawn, then jakob's review removed the follow anchors and the
  comment's reply affordances), 79 →
  **56 gaps**, and flows 58/53/5 → **58/55/3**. The twenty-four close
  and one opens — `TagPage`'s own Post Score row, which every board
  drawing a post card carries. `open-a-topic` and `add-a-topic` resolve
  for the first time, which is the round's headline: both had been
  blocked since the flow set was authored. No hand-drawn board moved a
  pixel it was not sent to move — the nine composers took the spelling,
  the six that stage a tag took a via stamp, and the maps followed the
  edges.

### The small-rulings batch — 2026-09-10

Twelve questions the audit and conform lanes had left standing, none of
them large enough to have earned a round of its own. Ruled by jakob in
one sitting.

- **A comment clip's cover crops exactly as the clip does.** The post
  scale's rule reaches the comment scale unchanged — the cover is the
  same clip's face, so one frame holds both — and letterboxing exists
  nowhere, pictures included.
- **A staged citation's pair is set on the pad.** Both of a citation's
  axes are signed, so the square is its own shape corner to corner.
  Item 18's remaining half, closed.
- **A tag that would need cutting is not drawn as a chip.** `TopicsLine`
  folds it into the worded counts instead, so a reader gets either a
  whole name or a number saying how many are left. The ellipsis retires:
  a truncated name is one the reader can neither read nor tap.
- **Settling shows in the sheet, never on the chip.** A chip is a
  destination, and a destination wearing a state says the state belongs
  to the place rather than to the act. The tags-and-references sheet is
  where the act is, so that is where it says it is still settling.
- **The borrowed-view band dies after signing, not on approach.** While
  the vouch-back is unsigned the reader has no stance of their own and
  the view is still borrowed, so the band stands through the whole
  approach to the pad and goes when the signature lands.
- **The Collective founding-name force is removed.**
  `PrepareCollectiveInput`'s `displayName` is optional, an explicit null
  clears it exactly as on a person's profile, and a Collective with none
  written is presented by its handle. The handle is the only name the
  product requires, of anyone.
- **Each "?" names its own dialog.** The three opinion pads read `Your
  opinion on your post`, `Toward what you answer` and `Your first
  opinion` — their own dialogs' titles, the way every other "?" in
  the system already takes its subject. One name across three surfaces says only
  that a dialog exists; `How opinions work` stays where the control
  itself is the subject.
- **An @-scope hit on a tag is indirect, and the drawing stands.** The
  row's second line says the route out loud ("tagged by @sol"). A
  person's scope holds their acts, and the tag is what one of those acts
  points at — never a direct hit of its own.
- **A field's flow badge moves to the field's wrapper.** `::after`
  generates no box on a replaced element, so a badge pinned to the
  `<input>` was valid and invisible at once. It moves where it paints
  and the gate accepts it there: a marker nobody can see verifies its
  own presence and nothing else.
- **Three closures.** The license sheets take the 88% height class, like
  every sheet not deliberately taller. A settings section label binds to
  the group it heads by sitting nearer to it than to the group above,
  rather than floating equidistant between them. And `--surface-pad` is
  not minted — one padding token across every surface would name a
  resemblance the surfaces do not have.
- **The settings round's copy is blessed** and sits in the register's
  topical sections, the page's own words and the six subpages alike.
- **The media edit's body line is blessed**: "A post's body is words or
  media, never both." It states the body's rule, never a lock on the
  post in front of the reader — an edit carries complete state and may
  flip the kind outright, every picture replaced by words or the words
  by a gallery. Web's profile save answers with nothing; a snackbar line
  is drafted and awaits blessing.

### The citation's pair, and the settling row — 2026-09-10

Two rulings the tag round left standing, both about a pair the author
sets and a reader reads. Ruled by jakob the same day.

- **A staged citation's pair editor is the pad, in a sheet
  (`RefPair`).** The instrument follows the census, not the surface.
  `ReferenceInput` (api-spec.md) gives a citation relevance `[-1, 1]`
  and support `[-1, 1]` — both signed — so the pad's square over two
  signed axes fits it exactly.
- **The poles are the citation's, in the slots the contract assigns.**
  Relevance occupies `pDirected`, the pad's horizontal, and asks how
  much this post leans on what it cites — `Barely` to `Entirely`, the
  words `TagPad` uses for the same slot. Support occupies
  `pInterest`, the vertical, and is endorsing against refuting, so
  `Against` and `For` ride there. Those two words sit on the horizontal
  when the pad carries a stance: the rotation is the contract's doing,
  and the pad names its poles on the field so that no reader has to
  carry the mapping in their head. `StancePad` therefore takes its four
  words as `axes`, defaulting to `STANCE_AXES` — the control owns the
  geometry, the record family owns the words.
- **The face rides the pair.** The readout carries the nearest anchor's
  face beside the exact numbers, and the lookup is `STANCE_ANCHORS`
  unchanged, because the citation's two axes fill the two slots the
  contract assigns. The anchor's WORD stays behind: it names a feeling
  about a stance, and a citation is not one, so the spoken reading names
  the two axes and their values instead. The readout sits above the
  field, where a thumb cannot cover it.
- **The row opens it, the × still removes.** `StagedReference` takes
  `onEdit` on `TopicRemovable`'s terms: pressable only where there is
  something else a citation is for, two separately named controls
  ("Remove &lt;name&gt;", "&lt;name&gt; — set how it relates"), and inert
  without it. One phrase for opening a pair editor, whichever family
  the pair belongs to. Four composers wear it — the details stage, the
  cited details stage, the post edit, and the reply's seal with a
  citation staged, which borrows the sheet as it borrows the license
  and sensitive sheets.
- **The chip says nothing about the order; the sheet does.** A staged
  tag or citation that is signed but not yet ordered on L1 reads
  `Still settling` in the tags-and-references sheet — `PendingMarker`'s
  own words, its own two tokens, no colour and no type role of its own.
  It rides the pair at the row's edge rather than the name, because
  what has not landed is the act, not the node it points at: the
  attachment `TaggedRow` already makes.
- **The gate**: 142 → **143 screens**, 1039 → **1046 edges**, gaps hold
  at **56** and flows at **58/55/3** — the round adds a destination, not
  a journey. `ComposeDetails` is factored to `_shared.jsx` so the sheet
  stands on the real stage rather than a stand-in of it, the overlay
  rule from 2026-09-08.

### The bottom bar's re-tap ladder — 2026-09-10

The bar's slots each had a destination and no behaviour: a tap on the
tab the reader was already standing on did nothing — in the graph,
where twenty-four edges read *already here*, and in both apps, which
navigate and let the framework find nothing to do. Ruled by jakob the
same day (backlog item 47). The slots are stateful re-entry points, and
a single tap — everywhere, with no second gesture to learn — climbs a
four-rung ladder.

- **Another tab returns in the state it was left**, its whole stack and
  its scroll, not its root. A tab never opened arrives at its root,
  fresh. That is the rung that makes the other three matter: if a tab
  reset on every visit there would be no state to re-enter.
- **The tab you are on pops to its own root** from anywhere deep in it,
  and the root's scroll is wherever it was left — a pop is not a
  reload.
- **At the root, scrolled, the tap goes to the top**, animated, so the
  jump reads as travel over a list the reader still owns.
- **At the top, only the feed answers.** It refreshes and loads what is
  new; Explore, Wallet and Profile do nothing, having nothing the
  reader is waiting on.

- **Refresh has exactly two gestures, both deliberate** — the re-tap at
  the top, and the pull-down while all the way at the top. A restored
  feed shows the list as it was left; nothing reloads merely because a
  reader came back, because a feed that moves under a returning reader
  loses the place they were keeping. **The indicator is the platform's
  own**, so the system draws none.
- **The pull-down lives on every full-screen scrolling root** (ruled
  2026-09-10): the feed in all its views, the profile pages and the
  chronicle, search results, the wallet's history, the tag page — and
  **never inside a bottom sheet**, where pulling down already means
  dismiss and one gesture may not mean two things. The re-tap refresh
  stays the feed's alone; the pull-down is the gesture every root
  answers.
- **A stack is where a screen was opened FROM, never what it is
  about.** A post detail, an actor's profile and a tag page reached
  from the feed are Feed's stack, and one screen may sit in two tabs at
  two positions at once. The Profile TAB is your own profile; your own
  profile reached from a chip in the feed is still Feed's. The reel
  stream is Feed's too, which is what its edge has said since the reel
  round.
- **The compose slot has no ladder** — it is an action, not a
  destination, the deviation the master already declares, and the
  kept-draft rules govern what a second tap meets.
- **A transient is not state.** A sheet or dialog that was up when the
  reader left is gone when they return; a tab restores its screen and
  its scroll, never what was covering them.
- **Every viewer class climbs the same ladder.** Guest, applicant and
  key-absent readers get the identical four rungs, and the gates in
  front of the slots are unchanged — one shell for everyone is the
  bar's standing rule, and the ladder is part of the shell.
- **The state is the session's.** A restart lands on Feed's root,
  fresh; nothing is promised across launches.
- **Back is the platform's.** Android's system back pops within the
  current stack, then from another tab's root to Feed's root, then
  leaves — never a tab switch mid-stack. On the web the tabs are
  routes: the browser's back and forward own the history, the ladder
  governs clicks on the nav, and scroll is restored per route entry.

- **The graph had already drawn the pop, and only the pop.** A deep
  board's active-tab edge has always named the tab's root as a board —
  `PostDetail`'s Feed slot lands on `Feed`, `ProfileOther`'s Profile
  slot on `Profile` — so rung two was drawn before it was ruled, and no
  edge changed shape to record this. What said nothing was the root
  boards' own edge, and those twenty-four self-terminals now carry the
  scroll and, on the feed's roots alone, the refresh as a second
  outcome. The cross-tab edges keep naming each tab's ROOT: a restored
  stack has no single board to point at, and the root is the honest
  representative of one.
- **It is ahead of both apps, unevenly.** Neither does anything on an
  active-tab tap, so rungs two through four are a conform item for the
  implementation session. The rest is further along than the drawing
  suggested: Android already restores a tab's stack and scroll, already
  pops to the root from a drill-in, and already carries a
  pull-to-refresh; the web restores the feed alone and has no pull
  gesture at all, its feed view stating the absence as intent — new
  posts from a reload or from Retry — which this ruling overrides.
- **The gate**: screens, edges, gaps and flows all unchanged by this
  round — twenty-four cases were reworded in
  place, and nothing was drawn or pointed at that was not there before.
  No hand-drawn board moved a pixel; six map boards grew where the
  longer case wraps.

### The batch's review — 2026-09-10

jakob's review of the small-rulings batch, ruled in one sitting. The
edit body's editability and the single-long-tag state are ruled in the
same review and recorded with the boards that draw them.

- **Wherever a pair is being set, the readout shows the nearest anchor's
  face.** Emojis: a face is the fastest rough read of where a knob
  currently sits, and the exact pair beside it carries the fact for
  anyone who wants it. `RefPair` takes it — the lookup is
  `STANCE_ANCHORS` unchanged, the two slots being the ones the contract
  assigns. What does not travel with the face is the anchor's word: it
  names a feeling about a stance, so a citation keeps the face and
  speaks its own two axes instead.
- **A reference count counts every kind.** The number on a card is the
  length of the list the sheet draws, whatever kind of node each row
  points at, a cited chat message included. A count that quietly dropped
  a kind would say the sheet holds less than it does, and the sheet is
  the only place the number can be checked.
- **The key-absent settings rows open drawn boards.** Item 20's review
  rule reaches its last two: `SettingsBackupKeyAbsent` and
  `YourKeyAbsent` draw what the Recovery code and Your key rows open
  when the key is elsewhere. Both ride the drawn pattern —
  a `tertiary-container` notice leading the page, restore first, the one
  "?" on the key — and both stop short of the act, because making a new
  code needs the key and the key page's whole body is the key. Neither
  carries an escape hatch: nothing is staged, so the back arrow is the
  way out, which is `WalletKeyAbsent`'s shape.
- **The license sheets keep the 88% cap.** They stay content-sized; the
  raised cap binds only when terms run long enough to reach it.
- **The gate**: 143 → **145 screens**, 1046 → **1052 edges**, gaps hold
  at **56** and flows at **58/55/3**. The two new boards join the
  restore flow, whose control-start now reads six boards rather than
  four, and the witness is re-blessed for that.

### The edit body round — 2026-09-10

One ruling, from jakob's hand review of the small-rulings batch: post
editing must alter the BODY as well — remove and add pictures, remove a
video, change the words — and a complete swap from a media post to a
text post or back is allowed. The body line blessed that same day said
as much in copy; the edit board still drew a body nobody could touch.

- **The gallery is not a readout.** The picked row keeps its one
  affordance, and beside it stands the add control the composer and
  the comment edit already spell — "+ Add pictures · 2 of 10", what is
  held against the cap. Nothing else on the edit changes: an edit was
  always a post being composed with its answers filled in, and this is
  the answer that had been left read-only.
- **The blessed line is finally drawn.** "A post's body is words or
  media, never both." was blessed for this surface and appeared on no
  board. It sits under the gallery, where copy-voice puts it — saying
  why no words field stands there, and by saying it as the body's rule
  rather than this post's, saying that the field can come back.
- **Show all over the edit is its own board (`EditPicked`).** The
  overlay rule of 2026-09-08 decides this: a sheet covers the surface
  the reader came from, and `ComposePicked` draws the PICK STEP —
  a tray, a prompt offering "Write words instead", a wizard foot — which
  an author editing a published post was never on. `EditCompose`'s row
  now opens the sheet over `EditComposeBody`, and `ComposePicked`'s Done
  stops claiming an origin it no longer has.
- **The flip has a destination, and it is one board.** `EditWords` is
  the edit with `WordsBody` where the row stands. A words post opened
  for editing arrives there as an entry, the way `EditComposeVideo` is
  one for a clip; so does a media post whose last picture was just
  removed, with the field empty. They are the same surface, so drawing
  the second separately would be drawing the first twice — the arriving
  edge carries the difference in its case, which is what a case is for.
- **The removals now land somewhere.** `EditPicked`'s last × and
  `EditComposeVideo`'s × both point at `EditWords`. The video edge's
  words — "the post is its words" — were already written and pointed at
  `self`; a sentence that names a destination should reach one.
- **A clip's share of the flip is the × alone.** No add control joins
  the video edit: a body one clip fills has nothing to add to, and a
  clip is never swapped for another. The quiet line stands where the
  control would, from the staging copy — its second half, "Its cover
  comes next", is the wizard's and is dropped where the cover is already
  on screen.
- **The words edit carries no description.** A description is how words
  stand beside pictures (the compose flow, above); with the body already
  words it has no job, and a second prose field would only ask the
  author which one the post is. The title stays — it names a post of
  either kind.
- **The growing body field moved to `_shared.jsx` (`WordsBody`).** It
  was hand-spelled on `ComposeWords` because no `TextField` grows; a
  second board needing it made it board-local no longer. `ComposeWords`
  renders byte-identically after the move, which is what a factoring
  owes.
- **The gate**: 143 → **145 screens**, 1046 → **1064 edges**, gaps hold
  at **56** and flows at **58/55/3** — the round adds destinations, not
  journeys. The witness was re-blessed for one line: `ComposePicked`'s
  Done case, reworded because the edit no longer opens it. `EditActs`
  and `TagPad` redrew where the shared edit body grew its two rows.

### The tag pad — 2026-09-10

What a staged tag chip opens, and what the pair it sets reads as.
Ruled by jakob the same day.

- **The pair editor is the pad (`TagPad`).** Aboutness and certainty
  are one place rather than two tracks, and a place is picked in one
  gesture. The contract's slots are untouched — relevance in
  `pDirected`, confidence in `pInterest` (`TagInput`, api-spec.md) — so
  what the reader drags is what the record carries.
- **The field is drawn over the reach the census gives.** Confidence
  is census-bounded to `c ∈ [0, 1]` (hashtag.md §4), and the composer
  authors only the positive half of relevance: an author saying what
  their own post is about says how much, never how much it is not. So
  the square is the reachable square corner to corner, with no half
  hanging dead, and the poles on the field are `Barely` to `Entirely`
  across, `Guessing` up to `Certain`. `StancePad` takes the bound as
  `ranges` the way it already takes the poles as `axes` — the control
  owns the geometry, the census owns how far each slot reaches — and
  every pad already drawn renders byte-identically under it.
- **The dead-ground lines belong to a signed axis only.** They mark
  where an axis's zero falls, and both of this pad's axes start at
  zero, so it draws none: a hairline along the field's own edge reads
  as a border, not as a meaning.
- **The face is the tag's own, and the table is disjoint from the
  stance faces.** Thirteen anchors, not one glyph shared with
  `STANCE_ANCHORS` — a face that means "Like this" about a post must
  never also mean "locked on" about a topic, or the one lossy readout
  the system has starts lying about which family a reader is looking
  at. A tag is a claim about what a post is about and has no mood to
  wear, so its table is objects rather than faces.
- **The table is four aboutness bands by three certainty bands, plus a
  floating thirteenth.** Certain, from `Barely`: 🔍 "had to look, but
  it's in there" · 🔗 "definitely linked" · 🔒 "locked on" · 🎯
  "exactly this". Fairly sure: 💧 "a drop of it, I think" · 🧩 "a piece
  of the picture" · 🧲 "pulled toward it" · 🗝️ "likely the key to it".
  Guessing: ❔ "faint maybe" · 🎲 "could go either way" · 🎣 "fishing
  for it" · 🔮 "big claim, divined". And 💯 "all of it, full stop",
  which floats just left of 🎯 and higher, so the very top of the field
  is reachable without taking the Entirely corner from the row that
  owns it. The twelve sit at band centres — aboutness 0.15, 0.45, 0.72,
  0.95, certainty 0.15, 0.55, 0.90 — and 💯 at 0.86 / 0.95. Like
  `STANCE_ANCHORS`, these values are the contract: both clients read
  them.
- **The readout is one glyph beside the exact pair**, in the labelled
  block every pair-setting readout wears, above the field where a thumb
  cannot cover it. The numbers are `formatTagPair`'s — relevance
  signed, confidence unsigned. The anchor's word does come with it
  here, unlike a citation's: these words were written for this table
  and say what the pair claims, so the spoken reading carries the word
  and both axes.
- **The non-drag equivalent is the two labelled tracks.** The pad is a
  drag gesture, so §10's standing demand reaches it as it reaches the
  stance pad: `StanceSlider` carries the tag's own bound and poles, and
  typed entry takes that bound rather than the stance's. It has to
  exist and be reachable, not be drawn a second time.
- **The gate**: 147 → **148 screens**, 1070 → **1073 edges**, gaps hold
  at **56** and flows at **58/55/3** — the round adds a state, not a
  journey. The witness did not move: no declared flow crosses this
  sheet.

### The tag field's floor, and the untag — 2026-09-11

jakob's review of the tag pad round. The field let a drag reach
relevance 0, which is not the faintest claim a tag can make but the
withdrawal; this round takes that value off the field and gives the act
a control of its own.

- **The field starts just above nothing.** Relevance runs from
  `TAG_RELEVANCE_FLOOR` — 0.01 — up to 1, so no drag can land on a
  withdrawal and there is no edge left to warn about. Withdrawing is a
  different act from weakening a claim, not the far end of one, and an
  axis carrying both put the heaviest act exactly where the lightest
  drag lands. The floor makes the left pole true as well: `Barely` is a
  fair reading of 0.01 and never was one of 0. The value is the
  contract's, like the anchors — both clients read it. (Supersedes the
  tag pad round's informing withdrawal state, which is deleted.)
- **The readout needs no special case.** `formatTagPair`'s two decimals
  render the floor as `+0.01`, which is the truth of it, so the system
  keeps its one number format.
- **Untagging is its own gesture, drawn only at an edit** (`TagPad`). A
  tag on a post that already carries it stands, so taking it off is a
  record — the body's `Withdrawn:` line names it and the acts card
  counts it — and an act of that weight is asked for by a control that
  says what it does. `Un-tag` — the reader's word, api-spec's own noun
  for the r-0 record — takes `Sever`'s place in the foot and `Sever`'s
  restraint with it: the walk-away pushed left of the decisions, a text
  button, no colour of its own. The chip's × at an edit asks for the
  same staged withdrawal without the pad roundtrip (jakob 2026-09-11) —
  two doors, one act.
- **It stages, and the seal signs.** The sheet closes, the chip leaves
  the row for the withdrawn line already drawn beneath it, and the acts
  card counts one more action, which the edit seals together with
  everything else (item 37). Nothing asks twice: the seal is the
  willing act, and a second layer over a staged, reversible change
  guards nothing.
- **A composer's pad carries no un-tag control** (`TagPadCompose`). Nothing
  on that path is signed yet, so there is no tag to withdraw — the
  chip's × unstages on the spot, and the same control here would name
  an act that does not exist. Two boards because two contexts reach the
  sheet holding different controls; everything else about them is one
  drawing.
- **The gate**: **148 screens** hold — the withdrawal state out, the
  composer's pad into its freed slot — 1073 → **1074 edges**, gaps hold
  at **56** and flows at **58/55/3**. The witness did not move: no
  declared flow crosses either sheet.

### The video-cover round — 2026-09-10

Three rulings about the still a clip wears, and the wizard they rewrite
(backlog item 49, jakob's rulings the same day).

- **`CoverCrop` is wired into the wizard on both platforms.** Every
  **gallery**-sourced cover passes the locked crop at the clip's ratio
  before upload; a **frame** needs none, because it was cut from the clip
  and already carries its shape. Only the cropped export ever leaves the
  device — the original frame can hold what the author never meant to
  share. **Web takes the cover step and its crop 1:1**, the file dialog
  playing the picker's part, which is the avatar flow's blessing again and
  why there is no web board. The cover shares the clip's ratio and crops
  identically; that rule stands unrevised.
- **The 4:5 feed clamp stands, confirmed explicitly** — jakob's reason, in
  his words: *"taller than 4:5 is reserved for the reel scroller."* The
  three shapes now stand on one board (*Feed · the clip's three shapes*)
  so the presentation can be checked rather than recited: 16:9 and 1:1
  display true, anything taller than 4:5 centre-crops to it, and nothing
  is ever letterboxed. **What the board also shows is the height cap.**
  A post fits the screen, so `--media-max-height` bounds every tile, and
  at a phone's 390×844 it lands at 376px: the 16:9 clip is 219px and never
  reaches it, while the square and the vertical clip both stand at 376,
  filled. The crop vocabulary is not what reshapes them — it never governs
  a clip — the cap is. The board pins that cap to a phone's value, because
  its own frame is taller than a phone and `--media-max-height` is measured
  against the viewport.
- **No-cover is first-class, and the default is shape-keyed.** A
  **vertical** clip defaults to **no cover**: the cover step is skipped and
  what it would have been is one optional **"Add a cover"** door on
  details. Horizontal and square clips keep the frame picker. **Shape
  alone decides, never length.** jakob's reasons, recorded: an autoplaying
  video that has a cover **looks broken** — the cover flashes for an
  instant before playback takes it away — and a short-vertical author must
  not be marched through a step they were always going to skip. *"Videos
  are always moving, never at rest."*
- **The coverless clip's face is its first frame**, cropped exactly as the
  clip is. The suppressed-autoplay card wears it under the play disc;
  quoted targets and history rows take it as their thumbnail. Nothing on a
  reading surface branches on it — `MediaAttachment` is handed a still and
  shows it, and whether that still was chosen or taken was settled while
  the post was written.
- **The door is a field's empty state, not a second entrance.** The
  picture path refuses a second way into the crop, and this does not break
  that rule: for a vertical clip the door is the *only* entrance, because
  the step it opens was never walked. A clip that came through the cover
  step therefore shows no door — its face is chosen and the step is one
  Back away. At **edit** the door opens the gallery directly, since frames
  are not re-offered there.
- **When extraction fails, the step shrinks rather than lying** (*Cover ·
  no frames came back*): `CoverRow` given no frames keeps only its way out
  to the gallery, under a line saying why, over the **neutral tile** — a
  clip that yields no still reserves its space and says what belongs
  there, because the rule against inventing imagery is not suspended by an
  error. The duration stays; the play disc does not. Next stays live: a
  post can always go without a cover.
- **Comment scale inherits at its scale.** There is no step to skip in a
  one-screen composer, so the cover **row** is what gives way: a vertical
  clip's reply opens with the door (*Reply · the clip didn't upload*), and
  the row is what the door opens (*Reply · a video and its cover*) — one
  drawing, because there is one row; what differs is whether anyone had to
  ask for it. The two edit surfaces hold the field's two states, one each:
  `EditComposeVideo` the door, `CommentEditVideo` the face and its
  Change.
- **Three wizard edges were wrong and are fixed.** `ComposeCover`'s back
  arrow reached `ComposePick` when the stage behind it is
  `ComposePickVideo`; `ComposeCrop`'s Next still offered the cover step,
  a path no post can walk, since a body is pictures or one clip; and the
  video path landed on the picture path's details board. The last of those
  is why the round drew `ComposeDetailsVideo` at all.
- **The gate**: 147 → **150 screens**, 1070 → **1082 edges**, gaps hold at
  **56**, flows 58/55/3 → **60/57/3**. The witness was re-blessed for the
  path's new middle: `publish-a-video` ends through `ComposeDetailsVideo`,
  and `publish-a-vertical-video` and `give-a-vertical-clip-a-cover` are
  newly declared. `CLIP_CANOE` moved into `_shared.jsx` — a third screen
  wanted it — and every board that already drew it renders byte-identically.

### Geek mode — 2026-09-11

A friend's proposal, adopted scoped by jakob: the exact values of the
signal numbers are geekery, and the glyph is what a reader is owed.
Ruled the same day, drawn as its own round because it rewrites every
stance master.

`ProfileOtherHeld` draws the one held state where the mode meets
layout — a profile the viewer already has an opinion on. Nothing
moves: the anchor and Message split the row at `flex: 1` each, the
pair paints inside the anchor's own half beside the face, and the
row's geometry is identical in both modes.

- **The pairs, and only the pairs.** Stance pairs, tag pairs and
  citation pairs — the two-parameter readings a face or a tag object
  already stands in for. The Post score and the viewer-relative rank
  keep their digits in both modes: neither has a glyph that could carry
  its magnitude, and a `graph` mark alone would say only that a score
  exists, which is the black box §7 refuses. Money, ages, comment and
  fold counts, media mechanics, field constraints and codes are shown
  whatever the setting says. The profile's figures — Posts, Opinions
  on, Opinions by — are bare integers and stay out.
- **Glyph-first is the default.** A card shows the stance face alone, a
  tag row the nearest of the thirteen `TAG_ANCHORS`, a citation row and
  a staged reference the nearest of the twenty faces. The numbers
  arrive only when a reader asks for them. Every glyph was already the
  lossy readout of its pair; the mode makes it the primary one.
- **Tag rows wear a glyph.** `TaggedRow` and a topic `ReferenceRow`
  read `nearestTagAnchor` and lead with it. The tag table is what makes
  this possible — before it there was no lossy readout a tag's pair
  could take, and the rows said nothing at all to a reader who does not
  read numbers.
- **A sentence follows the mode too.** Every help, coach and snackbar
  line that speaks a pair is emoji-first: the face reads, the digits
  ride a trailing `cg-exact` span, and a screen-reader twin says the
  whole fact in both modes. The fold explanation speaks faces rather
  than numbers — "your pick adds to what you've said before, that's
  why the two faces can differ" — because it has to hold for a reader
  who has never turned the digits on.
- **One markup, two paintings.** Every master draws the glyph AND the
  number; the number sits in a `cg-exact` span, and one base rule —
  `.screen:not([data-geek="on"]) .cg-exact { display: none }` — decides
  which is painted. No board forks and no state is conditionally
  rendered, so a flow pin anchors on markup that does not move with the
  reading. The rule is scoped to the not-on case rather than written as
  a show/hide pair, because the marked spans carry their own display
  and a rule that had to restore one would restore the wrong one.
- **Nothing spoken depends on the mode.** Every hidden number keeps a
  screen-reader twin, so a button's accessible name is the same in both
  modes. The mode draws; it does not redact.
- **The severance confirm is the one exemption.** Its raw sum and its
  fold paint in both modes: the sheet exists to show the difference
  between them, and two lossy faces would wear the same glyph — the
  whole content of the sheet erased. A reader about to walk back
  everything they have said is owed the arithmetic.
- **One client-local setting.** *Show exact values*, a switch in
  Settings' Reading group, drawn off — like the theme, never an L2
  preference. The canvas carries the same switch as a `geek` data-props
  chip beside the theme chip, landing as `data-geek` on the screen root
  with its own `cograGeek` broadcast, so one board's chip syncs the
  canvas and the two toggles stay independent.
- **The gesture inverts: a tap opens, a hold signs.** The light gesture
  — the one a thumb gives by accident — blooms the pad and stages
  nothing; the shortcut that spends a signature on the gentle
  `(+0.1, +0.1)` takes a held finger. The price is accepted
  deliberately, because nobody holds a control for half a second by
  mistake. The one-time coach mark moves to the pad's first open,
  inside the pad, and what it teaches is the shortcut.
- **The affordance rows spread.** `PostCard`'s and `CommentCard`'s
  controls sit at even intervals across the card's full width — the
  social pattern a thumb already has a habit for — and every control in
  them answers to the 48px target through `cg-hit`, so wider spacing
  never becomes smaller aim.
- **The reader's word is "opinion".** On screen and aloud a reader
  gives an *opinion*; the record, the components, the contract and the
  file names keep *stance*, exactly as the tag/topic law keeps *topic*
  (`copy-voice.md`, *Naming*). "Standing" leaves the screen entirely —
  *Current opinion* and *Resulting opinion* carry it — and `Sever`
  becomes *Walk it back*, `signed actions` become *things*.
- **The gate**: **151 screens** unchanged, edges hold at **1087**, gaps
  at **56** and flows at **60/57/3**. Nothing rewired: the round
  rewrites what the boards say and how their numbers paint, and the
  witness did not move. `Settings`' canvas slot grows 1774 → **1845**
  to match the artboard it holds; every other slot audits clean.

### The private-viewer-state round — 2026-09-11

Slice 2.6, and the first round of the MVP design queue: the three
lists a reader keeps for themselves — saved, seen, hidden — which the
contract has carried since slice 2 and no board had ever shown.
Ruled by jakob the same day.

- **Your own profile's ⋮ is the door to what only you can see.** Saved
  and History are lists no other reader ever sees, so they belong on
  the one page that is yours; and a page whose single wide control is
  the person has no row to hang them off. The band's dot opens a sheet
  — `ProfileOwnMenu`, holding Saved, History and Share your profile,
  which is a row there rather than a glyph on the band.
  The dot keeps the slot left of the gear: Material's app bar would put
  an overflow last, and the gear has been the band's right edge since
  the profile round, where every reader already aims at it.
- **Saved is ONE MIXED LIST** (jakob). Posts, comments and people in
  one column, newest first by when they were saved, because a reader
  looking for the thing they kept on Tuesday is looking for a moment
  and not a category — three tabs would ask them to remember the kind
  before they may look. `ContentRow`'s own disc precedence carries the
  difference: a person brings their picture, a post and a comment bring
  the glyph for their kind. **A post's cover is never the disc** — a
  picture in that circle reads as a person, which is the one thing a
  round disc means here. The chat message is the fourth saveable kind
  and waits for the chat round: it joins this list rather than starting
  a second one.
- **History is posts only, ordered by the LATEST time you saw one**
  (jakob). Saving is a deliberate act on anything; being seen is
  something posts do in a feed, and a history that collected every
  profile a thumb passed would be a log. A post read twice sits where
  the second reading put it, so the list the apps read is ordered by
  the most recent seen event — `ViewHistoryEdge` carries `firstSeenAt`
  alone today, and the contract follows the drawing.
- **Both lists are drawn empty too**, and each empty state says why it
  is empty rather than that it is. Saving leaves no mark on a card —
  jakob's ruling that nothing outside the ⋮ shows a saved state — so
  `SavedEmpty` is the one place the product may name the gesture;
  `HistoryEmpty` says the opposite, that this list fills without being
  asked.
- **The menu rows say what the next tap does.** `Save` while a thing is
  not kept, `Unsave` while it is: the row carries the state
  because nothing else does, and §3 asks a control to say what will
  happen rather than to report a status. The license row moves to the
  END of both content menus with it — the rarest read in the product
  had been leading them only because the card prepended it, and the
  author's own menu has always closed with it.
- **Hiding names its person and asks nothing.** `Hide @ada` on the
  reader's post menu and on another's profile menu; no confirm, the
  rows go, and a snackbar offers Undo. The post being read and the
  profile being looked at both stay: hiding is a read-side comfort that
  clears the viewer's own feed, never a thing done to the record or to
  the person.
- **Hidden accounts live in Settings, in a group of their own.**
  `SettingsHidden` is the sheet the row opens — one row per person with
  `Unhide` on its trailing edge, the sessions group's own shape. The
  group is **People**, placed beside Reading because hiding is a
  reading comfort, and kept out of Reading because that group's
  footnote promises both its choices stay on this device, which a
  hidden account does not. With nobody hidden the row goes inert and
  reads `None`: a tap that can only open an empty sheet is the tap the
  menus round already refused to spend.
- **One drawing of your own profile.** `ProfileOwnBody` moves to
  `_shared.jsx` the moment a sheet covers the page, and the chronicle's
  page-failure board takes it too — three boards, one page, no chance
  of disagreeing about what your own profile holds.
- **The gate**: 146 → **152 boards**, 1099 → **1137 edges**, gaps hold
  at **57** and flows at **60/57/3**. The six new boards carry 38
  edges and open no gap; the four list boards join the publish flows'
  origin set, which is the whole of the witness diff. `Settings`' frame
  and its canvas slot grow 1845 → **2027** for the People group,
  measured rather than guessed.

### The caps-affordance round — 2026-09-11

Ten ruled length caps and no drawn way to say so (backlog 52), and the
tag picker's refused name (46.3) — one round, because a cap and its
refusal are one component's problem. Ruled by jakob the same day.

- **A capped field is silent until the writer is near the cap.** The
  affordance is a LATE COUNTER: nothing under the field while there is
  room, then a quiet remaining count at the end of the supporting row,
  `--error` only once it is past. Never the persistent Material counter
  and never a meter — a number that sits under an empty field turns
  writing into a budget, and a bar turns a sentence into progress. What
  a writer needs is a warning in time to finish the thought; everything
  before that is pressure, not information.
- **The threshold is the last tenth, never fewer than the last 20.** The
  count appears at `remaining <= max(20, round(cap / 10))`. The tenth
  keeps the warning proportional — the description warns at 450, the
  body at 4,500 — and the floor keeps a short cap from warning too late
  to act on, since a tenth of the 50-character display name is five,
  which arrives after the word that will be cut is already written. Both
  halves are drawn: title and display name are floor-driven, description
  and body tenth-driven.
- **The unit is the Unicode scalar value,** which is what every ruled cap
  counts in and what `[...string]` iterates. `.length` counts UTF-16 code
  units and would tell a writer of emoji they had spent twice what they
  had. Nothing on screen says *scalar value*: the reader's word is
  characters, as it already is in `A password is at least 12
  characters.`
- **The count is a third element in the supporting row, not a third
  state of the supporting slot.** M3's own text field puts supporting
  text at the start of that row and the character count at its end; the
  slot keeps its two states (hint, error) untouched and the count sits
  beside whichever is live. `FieldSupport` is that row, assigned once —
  `FieldLabel`'s counterpart under the field — so the composer's growing
  body box, which is not a `TextField`, renders the same geometry
  instead of drawing its own.
- **The field atom's one error state now reaches every field.** The
  outline and label in `--error`, the message below, replacing the hint
  — the input-error round's shape, extended to the caps and to the tag
  name, which closes the web/Android divergence the caps lane hit: one
  drawn refusal, both clients.
- **The atom colours the count; the surface words the message.** A field
  error is worded per field and per surface, so `A title is at most 100
  characters.` belongs to the board and the arithmetic belongs to the
  component. An atom that wrote the sentence would flatten nine fields
  into one house line.
- **The tag picker's refusal is the same state in the search bar's
  idiom.** `TagPickerRefused`: the pill takes an inset `--error` ring,
  the naming rule under it turns into the refusal, and the `Signs as`
  preview goes — it is a promise about the record the tap will make, and
  a string that can be no name has no such record. The candidate list is
  simply empty; a second voice saying what the field has already said
  would be noise.
- **The sweep is the cap reaching the field, not the counter reaching
  the board.** All nine drawable caps are on their fields — title 100,
  alt 1,000, description 500, words 5,000, comment 2,000, reason 140,
  display name 50, bio 500, website 2,048 — and no resting board moved,
  because no fixture is near its cap. What is drawn is the resting
  state; the affordance is demonstrated where a state demonstrates it.
  The password maximum is never drawn, and the device label has no
  field.
- **Three state boards, one per field shape.** `ComposeDetailsCaps`
  carries the input near its cap and the textarea past it on one screen
  (`ComposePickedErrors`' reason: a step drawn with enough in it to show
  its whole vocabulary), `ComposeWordsCaps` carries the growing body box
  past 5,000, and `TagPickerRefused` the name. Each fixture is the
  length it claims — `6 left` off 94 of 100, `7 over` off 507 of 500 —
  computed from the text drawn, never spelled onto the board.
- **A field over its cap disables the step.** `Next` goes inert on both
  compose boards, which is what the title cap already does in the
  product; the badge stays on the control and its edge says it goes
  nowhere, the disabled Sign's own pair.
- **The gate**: 152 → **155 boards**, 1137 → **1158 edges**, gaps hold at
  **57** and flows at **60/57/3**. The witness moved by exactly two
  lines: `ComposeDetailsCaps` joins `cite-something` and
  `describe-your-pictures` as a ninth and seventh origin, because the
  stage it draws carries those controls.

### The notifications round — 2026-09-11

Slice 3.1's design half. Notifications had no doc anywhere, so the round
opened by writing one — `docs/implementation/notifications.md` — and
drew against it. Ruled by jakob the same day.

- **Seven acts notify, and they are the ones addressed to you.** A
  comment on your post, a reply to your comment, a mention, a citation
  of your content, an opinion on your PROFILE, someone landing through
  your invite, your application approved. What makes the set a set is
  that somebody else acted and the act reached something with an owner
  — so nothing you did yourself ever notifies you.
- **Opinions on your CONTENT are out (jakob).** A post collects those
  continuously, and a row each would turn the list into a counter of
  ambient sentiment rather than a list of things that happened. The
  curiosity is real and gets its own answer: the opinions-on-content
  list (backlog 55), ungated, on the post itself.
- **The bell is the band's right edge on every root.** Right-most,
  outboard of the screen's own control — the feed's filter trigger, the
  profile's gear — because one corner everywhere is what makes it
  findable, and a different corner per tab is four things to learn. It
  rides `CograBand` built in, the way chats does, so no board hand-builds
  it and `bell={false}` is the only way to be without one.
- **Guests have no bell; applicants do.** Nothing can be addressed to an
  account that does not exist, so `Main`, `FeedBare`, `GuestGate` and
  `WalletGuest` opt out. An applicant is an addressee already — the
  approval and the inviter's opinion both land on them — so the
  applicant boards carry it.
- **A dot, never a count (jakob).** `--primary` at 8px, ringed in the
  surface, pinned to the glyph's top-right in `ContentRow`'s own badge
  geometry. What the shell honestly knows is that something arrived; a
  number turns that into an errand. The bell's accessible name changes
  with it — `Notifications — something new` — because a marker a
  listener cannot hear is not a marker.
- **`BandIcon` is the band's one icon-control.** `CograBand`'s chats
  button and the profile's ⋮/gear were the same style object written
  twice; they are one master now, and the dot is a prop on it rather
  than a drawing on a board.
- **Read state is two levels, and there is no mark-all (jakob).**
  Opening the list clears the bell's dot — the bell asks *is there
  anything new*, and the honest answer stops being yes once the reader
  has looked. Each row keeps its own quiet mark until it is opened,
  because the row asks a different question. A broom for the whole list
  is a control for a list that asks too much; the fix for that is
  per-kind muting, filed post-MVP.
- **The row's unread mark is the bell's dot at row scale**, on the
  trailing edge under the age — `ContentRow`'s new `unread`. A weight
  change would make eight unread rows eight headlines.
- **One flat list, newest first, no grouping (jakob).** Grouping trades
  away the two things a row is for, the actor and the moment, and needs
  a second read model for what makes a group unread. It is named in the
  doc's later section and designed when it is reached.
- **The opinion row wears the face, the chronicle's row exactly** — the
  disc's own precedence puts a stance face where a picture would go, and
  no digits ride along in either reading. That is the chronicle's
  standing shape, inherited rather than re-decided.
- **The list lives on the Profile page** with `Saved`, `History`,
  `Hidden accounts` and `Settings` — the per-viewer surfaces reached
  from the shell rather than from a feed. Its back arrow is the `back`
  terminal, because the bell is on four roots and the way out is
  wherever the reader came from.
- **The gate**: 162 → **165 boards**, 1158 → **1214 edges**, gaps 57 →
  **59** and flows hold at **60/57/3**. The edge jump is honest and
  expected: 19 roots × the bell, `FeedUnread`'s clone of `Feed`'s
  eighteen, and the two new boards' own. The two new gaps are
  `FeedUnread` inheriting `Feed`'s Post Score and chats gaps. The
  witness moved only in origin lists — the three new boards join every
  flow that starts on a bottom-nav tap, and `FeedUnread` joins the ones
  that start on a post card; no step rerouted.

### The account-deletion round — 2026-09-11

Slice 8's erasure half, and the product's most destructive gesture. The
mechanics were already specified — `docs/instances/erasure.md` §2 and §5
— and nothing had ever been drawn. Ruled by jakob the same day.

- **The entry is the last row of Settings, in its own group, quiet at
  rest (jakob).** `Delete account` on a plain navigating row: no `error`
  colour, no `action` emphasis, a chevron. The weight of this act belongs
  to the flow it opens, not to a page a reader came to for the theme — a
  red row among eight neighbours makes the whole page feel dangerous, and
  a reader who has decided does not need arguing with. The group's
  footnote carries the one fact the row cannot: *Nothing is deleted
  here.* The label is a verb phrase where `SettingsRow`'s note asks for a
  noun, because the row names a task rather than a setting; the chevron
  is what keeps the promise the verb might break.
- **The request screen draws what stays, not only what goes.** Deleting
  an account here does not unmake a record: the husk keeps authoring
  everything it authored (`erasure.md` §3), and a screen listing only the
  disappearances would let a reader commit believing their comments would
  leave other people's threads. Two insets, `ChangeEmailConfirm`'s shape,
  for its reason — two readings a reader has to hold at once. The wallet
  is named in `What stays`: the L0 address is held by the reader's key
  and no part of the platform can touch it.
- **The content sweep is a checkbox, and the emailed link is the whole
  friction.** `erasure.md` makes identity-level the default and
  content-level the opt-in; the system's own distinction settles the
  control, since a switch takes effect when pressed and nothing here
  takes effect until the link is opened. And the link is the only
  ceremony: it proves the account's own address, which is the check
  against a compromised session that a typed handle cannot be. No
  password, no typing the handle back, no *are you sure* — theatre here
  reads as the product trying to talk the reader out of it.
- **`DeleteAccountMail` exists because the confirmation leaves the app.**
  The seven days start at the CONFIRMATION, not the request, so the one
  thing this board owes is that nothing is scheduled yet. `Reset` says
  the same thing in a status line because its form is still on screen;
  here the form is spent, so it is a board — `VerifyExpired`'s column and
  its foot. No expiry is claimed: `auth.md` gives the reset link fifteen
  minutes and `erasure.md` gives this one no window, so drawing one would
  be inventing a mechanic.
- **The grace state is a band on every logged-in surface (jakob), and
  `DeletionBand` is the mechanism.** A reader may have confirmed from a
  mail client on another device; a state only a settings page confesses
  is a state most readers would meet at the deadline. It is a SIBLING of
  `BorrowedViewBand`, not the same band — they share the slot under the
  surface's header (`CograBand`'s children on a root, under `PageHeader`
  on an inner surface) and nothing else. This one is filled and its line
  is `on-surface` where that one is transparent and secondary: the two
  dials the system has for presence, turned once, without reaching for a
  colour.
- **It is not `--error`, and that is §4 rather than restraint.** `error`
  is for failure, and this is a thing the reader asked for proceeding
  exactly as asked. Colouring a chosen act like a fault would be the
  surface arguing with the decision — the same reason Sign out takes no
  error colour and `EmptyState` refuses it for an absence. The band wears
  `surface-bar`, the shell's own chrome fill, because shell is what it is.
- **`FeedDeleting` draws the band once, on the most-seen root**, the way
  `FeedUnread` draws the bell's lit state. The feed beneath it is
  untouched, and that is the ruling drawn: during the grace period
  nothing is redacted and nothing is withdrawn, so a feed that started
  hiding the reader's own posts would be redacting early.
- **AWAITING A RULING: how the count says a FUTURE moment.** The ages
  ladder is a vocabulary for how long ago something happened; this counts
  forward and no ruling covers that (backlog 54.1). Drawn: `Your account
  is deleted in 6 days.` — spelled out, because the ladder's compression
  buys room in lists where many ages compete for it and buys nothing in a
  band, while `6d` means *ago* everywhere else in the product. The two
  alternatives and the reasoning are in `copy-voice.md`.
- **The cancel is a snackbar, and it has no Undo.** The band is on every
  surface, so the cancel is pressed anywhere; a confirmation screen would
  move a reader who tapped two words mid-scroll. The settings round
  already settled that shape for acts that finish where they are pressed.
  The band's absence is the lasting confirmation — which is why no band
  is drawn in some cancelled state. And an Undo here would re-arm an
  irreversible countdown from a control that disappears in four seconds.
- **A deleted profile wears a removal mark, not an empty state (jakob:
  "we never pretend sth that once was there never existed").**
  `RedactedContent` gains a third reason, `account`: identity-level
  redaction empties the Registration bundle exactly as a removal empties
  a post's, so a deleted profile wears the mark a post wears, on the
  reserved surface that says a space was kept rather than lost.
  `ProfileNotFound` keeps its own case — a freed handle resolving to
  nothing — and `ProfileDeleted` is reached by structure that still
  points at the actor, an author chip on a post they wrote. The handle is
  printed nowhere on it: the handle is the thing that was removed, and
  printing it back would undo the redaction on the one surface that
  exists to report it. Where the mark sits, and what stands around it, is
  the review-fix round's ruling below.
- **The gate**: 165 → **170 boards**, 1214 → **1263 edges**, gaps 59 →
  **63**, flows 60/57/3 → **61/58/3**. The edge count is honest: the two
  feed boards clone `Feed`'s eighteen each, `ProfileDeleted` takes
  `ProfileNotFound`'s six, and the request flow's own six close the
  settings row's gap without opening one. The four new gaps are the two
  clones inheriting `Feed`'s Post Score and chats — `FeedUnread`'s own
  inheritance, twice. The new flow is `request-account-deletion`, which
  ends where the flow leaves the app; the witness moved only in origin
  lists and the six start counts they feed, and no step rerouted.
  `Settings`' frame and its canvas slot grow 2027 → **2163** for the
  delete group, measured rather than guessed — the harness reproduced the
  recorded 2027 on the pre-change board before it was trusted for 2163.

### The media true-shape round — 2026-09-11

jakob's implementation-session ruling, confirmed here after a pixel check
found the boards drawing a capped tile where the product draws a true
one. The height cap is gone; what bounds a card tile is its shape.

- **`--media-max-height` retires entirely**, and `--post-chrome-height`
  and `--safe-area-top` with it — both existed only to feed its formula,
  and a token nothing reads is a number pretending to be a decision.
  `MediaAttachment` keeps no default for `maxHeight`. A card tile stands
  at its TRUE ratio at full width: on a 390px phone a `wide` tile is 219,
  a `square` one 390, a `tall` one 487. The crop vocabulary's 4:5 is the
  only bound left, and it is a SHAPE rather than a ceiling. The prop
  itself stays, because one surface still holds media below its shape's
  own scale on purpose — a comment's inset pictures at 220px, so the
  media joins the words instead of turning the comment into a post.
- **Which scopes "a post fits the screen" to wide and square.** A card at
  those shapes sits inside the phone whole, affordance row included. A
  vertical post runs past the fold and the reader scrolls to reach its
  affordances: jakob built the biggest post the system can make, saw it
  barely miss, and took it — *"insta also does this."* The alternative
  spends the picture's height on every reader forever to save one scroll.
  `MediaAttachment`'s header had still been claiming the opposite — that
  a capped tile is *fitted* inside whatever height is left — which the
  2026-09-03 no-letterboxing rule had already overtaken.
- **Five boards changed height; thirty-one changed only markup.** The
  rendered diff is the census, and every byte of it is one declaration
  leaving 36 boards. Where the tile was `wide` (204px at the card's
  content width), `square` (390), or a comment's (220/240), the cap was
  never binding and nothing moved. The five that grew are the ones
  carrying a 4:5 frame — capped at 376 on a phone, 487.5 now:
  `FeedCover`, `FeedGallery`, `LadderMax`, `PostDetail`,
  `PostDetailVideo`. All five are 390×844
  phone boards that clip at the fold by design — three of them already
  overflowed before the round — so no frame moved for them. Four boards
  in the canvas carry a frame of their own; one of those grew.
- **`FeedShapes` redraws, and its frame and canvas slot grow 1934 →
  2059**, measured rather than guessed — the harness reproduced the
  recorded 1934 on the pre-change board before it was trusted for 2059.
  The board had pinned the cap's own formula with a phone's height
  written in where `100dvh` stood, so its three clips stood 219 · 376 ·
  376 and the prose called two shapes at one height the honest
  presentation. They stand 219 · 390 · 487 now, which is what the board
  exists to show: three shapes, three heights, at one width.
- **The wizard's cover preview is the clip's output format**, never a
  square specimen: what `ComposeCover` shows is the shape the post will
  stand at. The clip on that path is square — `ComposeCoverPlaying` plays
  the same one through `MediaAttachment` at `ratio="square"` — so the
  preview is 342 × 342, unchanged in pixels and derived now rather than
  pinned. A 16:9 clip's would be 342 × 192; a vertical clip never reaches
  the step at all, because its default is no cover.
- **The card's text clamps were already conform** — title one line,
  description two, and `More` under a media post's caption always. What
  was stale was the `media` card's own inventory, which had the
  description clamping to one. The text body's ceiling stays at 18 lines;
  its derivation had been floor(376 ÷ 20) against the capped tile, and
  with the cap gone there is no one tile height to derive it from.
- **The gate did not move**: 169 screens, 1263 edges, 63 gaps, flows
  61/58/3. No flow pin anchors on a tile's `max-height` — the media pins
  find `aspect-ratio`, which no tile lost.

### The review-fix round — 2026-09-11

jakob's second pass over the canvas, and the round where three standing
rulings were replaced rather than extended. Everything below is his,
from the rulings sheet; what the round decided for itself is named as
such.

- **THE BAND LAW (supersedes the 2026-09-01 corner ruling AND the
  notifications round's order).** No band carries a ⋮ any more, and the
  trailing cluster on every root is **[the screen's own control] · chats
  · bell** — the feed's is filter · chats · bell. The two the shell owns
  keep the same two corners on every tab, so a thumb aiming at chats or
  at the bell aims at one place whatever screen it is on; the control
  that changes per screen is the one that moves inboard. The old order
  put chats first and the screen's own control between the two the shell
  owns, which made the middle slot mean something different per tab.
- **Band icons draw at 40px and answer at 48** (`cg-hit`, the trade
  `Button`'s small rung and `Chip` already make). 48px of DRAWN box was
  what crowded the band: three of them beside the mark and the wordmark
  left the one control whose width carries WORDS too little room, and
  the feed's filter trigger ellipsised on the boards that narrow the
  feed. Measured: at 48px boxes `FeedNarrowed`'s trigger had 160px of
  room for 170px of words; at 40px it has 170 and the ellipsis is gone,
  with `FeedNothing` (172/172) and `FeedFar` (144/144) clear as well.
- **Your own profile's ⋮ joins the Edit profile · Invites row**, and the
  band keeps gear · chats · bell. **Another's joins its actions row**,
  where **Message gives up the half of the row it never needed** (jakob:
  "the message button already is so wide.. with quite a lot of
  padding"): Message is sized by its own word now and the anchor takes
  the remainder. That makes `ProfileOtherHeld`'s mode-invariance rule
  stronger rather than weaker — a width derived from one word cannot
  depend on what the anchor says — so the row is identical in both
  reading modes (measured: anchor 196px, Message 106px at x=220, the dot
  40px at x=334, the same in geek mode, and the exact pair paints inside
  the anchor's own space). `OverflowMenu` gains `placement="row"` for
  it: the header placement's -12px pull is right on a 24px line and
  wrong in a row of controls, which has no gutter to pull into.
  `ProfilePosts` and `ProfileComments` follow the page — and their ⋮ now
  holds the whole profile menu rather than two of its four rows, because
  a tab of a page is not a smaller page.
- **The Saved row carries its own unsave**, icon-only: the filled
  bookmark, `Unsave` in the accessibility tree, no word on screen
  (jakob: with the icon "we dont even need any word there"). It takes
  the CHEVRON's slot and never the trailing edge's — the age there is
  when YOU saved the thing, which is the list's whole order and what a
  reader is retracing — so `ContentRow` gains `action`, splits into a
  pressable part and the control beside it, and nests no button in a
  button. `SettingsRow` had already assigned that slot the same way.
- **The saved state is one word, `Unsave`**, replacing
  `Remove from saved` on every menu and in copy-voice. **Save joins your
  own post's menu too**, and LEADS it — saving is private, so whose post
  it is has nothing to do with whether a reader may keep it, and one
  position for the row on every menu that has it is worth more than
  ordering each menu by its own use. The license still closes.
  (`RemoveMenu` also stopped hand-writing its four rows and draws
  `OWN_POST_MENU`, which is what makes the Save row appear in the sheet
  and in the header's menu at once.)
- **Hiding gets its board**: `FeedHidden` — the feed with @ada's card
  gone, the ranker's next posts moved up, and
  `@ada is hidden — their posts stay out of your feed.` with `Undo`.
  Nothing marks the space her card was in: a "hidden post" rail would
  keep her on the screen the reader just asked to be rid of her on.
  `Snackbar` gains its one Material action for it — a WORD, never a
  pill, in the new `--action-on-snackbar`, `primary` being the one
  colour that stops being legible on the inverse ground.
- **Settings prose ages join the ladder**: `Changed 21d`, `Last used 2d`,
  `Last created 12.08.2026`. copy-voice's own examples were the source of
  the contradiction — a guideline spelling `Changed 3 weeks ago` a few
  sections under the rule that forbids weeks — so they conform too.
- **THE REDACTED-ACTOR LAW (supersedes the account-deletion round's
  `ProfileDeleted`).** The shells never go. A deleted account's profile
  keeps its exact structure — header, real counts, tabs, chronicle, the
  acts with their real words — and ONLY the personal data is
  placeholdered: the avatar becomes the reserved disc (no monogram,
  there being no name to take a letter from; no glyph, that being
  imagery with no source), the name slot reads `Deleted account` in
  `text-secondary`, and the handle is dropped rather than replaced. The
  removal mark moves into the BIO's place, which is a profile's one
  authored, personal region and exactly the payload that went; as a band
  under the header it would have read as a fault with the page. A page
  stripped to a notice is the erasure ethic's other failure mode — it
  hides a record still on the graph, still credited, still ranked.
- **The treatment follows the actor, so it lives on the masters.**
  `MonogramAvatar` and `ActorChip` take `redacted`, and `ProfileHeader`
  is that same chip at page scale — one drawing for the header, for the
  author chip on a post they wrote, and for every row that names them.
  `REDACTED_ACTOR_NAME` is the word, assigned once.
- **The actions row keeps the opinion and loses the message** (the
  round's own call, read off `erasure.md` §3). An opinion targets the
  ACTOR and the actor is there — its content still ranks in other
  people's feeds, so a reader who wants it out of theirs needs the
  control that does that, severance included. A message targets a
  PERSON, and the identity association is deleted, so a composer there
  would address nobody. The ⋮ goes with Message: every row it holds
  names the person, and there is no name to put in them.
- **The empty hidden row stays `None`** (jakob, final). Nothing else was
  ever drawn.
- **Notification rows are kept** (`docs/implementation/notifications.md`):
  no age bound, no cap, no pruning job for the test phase, and the bound
  belongs to the era in which a reader owns their own storage — how long
  someone's operational rows live is a question about whose disk they sit
  on. The rows are rebuildable either way, so adopting a bound later is
  maintenance and never a loss.
- **The score reads `Post score` in prose too** — `PostCard`'s docblock
  and its `.d.ts`, the icons README, the numbers card, the iconography
  guideline. Graph gap names keep the old spelling by ruling.
- **The gate**: 170 → **171 boards**, 1263 → **1287 edges**, gaps 63 →
  **65**, flows hold at **61/58/3**. The 24 new edges are `FeedHidden`'s
  eighteen (the feed's own anatomy, plus Undo), `ProfileDeleted`'s four
  (its counts, its anchor, its tabs, its rows — the page it got back),
  the Saved row's unsave, and Save on the own-post menu. The two new gaps
  are `FeedHidden` inheriting the feed's Post Score and chats. The
  witness moved in origin lists and their start counts only —
  `FeedHidden` joining nine feed-rooted flows, `ProfileDeleted` joining
  the two profile ones its new controls open — plus `RemoveMenu`'s two
  steps renumbering behind the Save row. No step rerouted and no flow
  changed status. No frame grew: `ProfileDeleted` measures 752px of
  content inside the phone's 844, and `FeedHidden`'s 1005 is a list that
  scrolls, the way `FeedNarrowed` (1337) and `FeedGallery` (1102)
  already do.

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
- `_build/render-screens.mjs`, `shell.mjs`, `flow-markers.mjs`,
  `gen-maps.mjs`, `check-flows.mjs` — the canonical-canvas pipeline
  (§13, *Canvas pages and flows*): render the screens, stamp the flow
  numbers, generate the maps, gate the result. Run all four after any
  screen, component, or graph.json edit. A screen whose state is not a
  portrait phone exports `FRAME` and the shell builds that artboard
  instead — so far only the rotated viewer. `_build/flow-engine.mjs` is
  the gate's user-flow half (§13, *The user-flow layer*): it resolves
  `flows.json` and blesses `flows.resolved.json`.

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
`compose/`, `media/`, `wallet/`, `people/`, `states/`, `honesty/`,
`stance/`, `proposed/`.
