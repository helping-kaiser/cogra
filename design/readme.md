# CoGra Design System · `guide:design:design-system`

CoGra (Content Graph) is a social network built on real relationships
between people. What you see is shaped only by the connections you make.
The design carries that as *tone*, never as on-screen vocabulary.

This folder is the design system both CoGra clients read from: colour,
type, shape, motion, components, copy, and the stance control. It is
the authority the apps conform to: where an app differs from it, the
app changes, and a problem with the design itself is worked out here
first.

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

Everything in this system was read, at the derivation on 2026-08-27, out
of one attached codebase and one uploaded file — the table records what
each gave then. Nothing was invented from memory; nothing was recreated
from a screenshot.

| Source | What it gave |
|---|---|
| `cogra/` (attached local codebase, read-only mount) | the whole system |
| `cogra/docs/implementation/design.md` (928 lines) | the written design system — §2 colour, §3 type, §4 shape/spacing/motion, §5 iconography, §6 components, §7 copy, §8 the stance control, §9 honesty surfaces, §10 accessibility, §11 the mark |
| `cogra/design/tokens/scheme.json` | the generated palette — the generator's committed output |
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
  a member vouches for it — not necessarily the one whose link they came
  through; applicant vs member is expressed as cards in the shell, never
  as different navigation.
- **Writes are signed on the device.** A post, a comment, an edit, and a
  stance are each a signed, priced act. The UI's honesty obligations
  (§§8–9 below) follow from that.
- **Numbers are in scope.** Ranking is not a black box, so a surface may
  show what something scored — provided every number shown is
  explainable and the detail is layered.

**The anti-goals**, named because they are the failure modes this
product is most likely to drift into: nothing that reads as crypto,
fintech, trading, enterprise, or a developer tool. No dense
dashboards, no dark "hacker" aesthetic, and no monospace as UI — the
platform monospace is kept to codes and identifiers read character by
character, a payout address among them (§4, *Type*). Geek mode is not
the developer-tool look: it is opt-in numeric detail, the exact pair
painted beside the glyph it already stood behind, in the same type,
colour and row (*Geek mode*, §13).

### Surfaces represented here

| Surface | Where |
|---|---|
| Web app (Next.js, Tailwind v4, Apollo) — the primary product | its components and rules are this system; its screens are designs, made in design sessions |
| Android app (Compose, Material 3) | not recreated; its design rules are identical by contract, and the web kit is the faithful surface |
| Marketing site, docs site | none exist in the source |

**Desktop is out of design scope until implementation runs smoothly on
its own** (jakob 2026-10-06; backlog item 38). Both
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
not carry yet is staged, not divergent, and `staged-surfaces.md` lists
what that leaves on screen.

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

**The nerdy register stays off the screen** (jakob's ruling
2026-09-17). Not a word list — a voice: copy never sounds
mathematical, technical or clever about its own machinery. That keeps
*node*, *edge*, *vertex*, *tensor*, *weight*, *parameter*, *valence*,
`p_d`, `p_i`, *decentralized*, *protocol*, *token* and *crypto* off
every screen, because each one describes how the thing is built rather
than what the reader is doing. **Graph, network and connection are
ordinary English and are welcome used plainly** — "what you signed
stays on the graph" is a sentence a reader understands, and refusing
it bought nothing. **Followers** is not forbidden either; it is
steered around because it *misdescribes* what CoGra's edges are, which
is an accuracy problem and not a register one. An **opinion's** two
stance parameters are labelled **"For or against"** and **"How much
reaches you"** on screen, and nothing else; another record family
filling the same two slots names them its own — the control owns the
geometry, the record family owns the words.

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
(§8) plus 🤷 for a zero bundle and 🫥 for a control at rest. These are
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
- **`tertiaryContainer` — the olive — is the account-notice register**:
  the system speaking to the reader about their own account and what they
  have to do about it. The key-absent and write-rule panels wear it
  (`NoticePanel`), and so does every feed card that needs the reader's
  action — verify the email, restore or bring the key, the security
  notice, the vouch-back, a closed application's way back in (`TaskCard`'s
  `tone="notice"`; jakob 2026-10-02, the olive split). A card that only
  says how things stand keeps the feed card's ground, so the olive always
  means "yours to do". Its filled button is `inverse`; it is never a
  page's wash and never `error`.
- Every `on`-pair meets WCAG AA (4.5:1), verified at generation.
- **Material You dynamic colour is off.** The brand hue carries identity
  a wallpaper-derived palette would erase.

**Where the palette departs from stock Material, and why** — written
down because each departure is one a future reader would otherwise
"correct". The scheme is `Content`, not the usual `TonalSpot`:
TonalSpot cuts the seed's chroma until the orange turns a muted brown
(`#8D4E2C`) and the brand hue is gone, where `Content` keeps it —
`primaryContainer` is the seed itself. In dark, `Content` takes the
neutrals from the seed at chroma 8.6 (12.6 for `neutralVariant`), which
tints every surface cocoa; they are rebuilt at 1.5 / 2.5, a warm grey
with a trace of the brand. Dark `primary` sits at tone 70, because at
Material's 80 an orange cannot pass chroma 30.8 and reads as peach;
tone 70 measures 8.08:1 against the dark surface, and `surfaceTint`
follows `primary`, so elevation cannot bring the peach back. `error`
moves for the same underlying reason — Material places it for an accent
less saturated and further from red than this one. At Material's hue 25
it sat 19.6° from `primary` (hue 44.6) at the same weight (6.16:1
against 6.19:1 on `surface`) and read as a second brand colour; hue 5
doubles the separation and stays unmistakably a warning. Its tones are
35 / 65, not 40 / 80: tone 80 holds only chroma 32.6 of the palette's
84, a pastel brighter than `primary` on the dark surface, and the deeper
tones make the error heavier than the brand colour in both themes.
`success` is made the way Material Theme Builder makes a custom colour,
`#00897B` harmonised toward the seed, and read at Material's stock error
tones — 40 light, 80 dark — the weight Material gives an alarm. The
generator, `web/src/lib/ui/design-tokens.test.ts`, carries all of this
as code and writes `tokens/scheme.json`.

### Type

**Figtree** (variable, 300–900, latin + latin-ext), one family for
everything — headers included, with weight doing the work a second face
would. **Material 3's fifteen type roles, unmodified**: only the family
is swapped. There is no italic axis; italics are for emphasis in user
text, never a display device. The platform monospace appears on exactly
one class of content, codes and identifiers read character by
character: recovery codes, key ids, seed entry, a payout address.

Role assignment is fixed (see `tokens/typography.css`). Weight is
400 for display/headline/body, 500 for title-medium/small and all label
roles; 600–700 exist in the variable file for emphasis.

**Latin-ext is not optional**: `İ ğ ş` live there, so a latin-only
subset silently breaks Turkish. The whole type budget is the one
variable file — about 30 KB as subset woff2 (20 KB latin, 10 KB
latin-ext), 61 KB as the upstream TTF — smaller than a single static
weight of most alternatives. **Figtree has no Cyrillic or Greek**, and
no upstream plan for them: shipping either script reopens the
typeface, and that is a product-scope decision rather than a
typographic one.

**One tracking value, each platform's own expression of it** (jakob
2026-10-06). The design states a role's tracking once
(`tokens/typography.css`); each platform expresses it in its native
unit and rounds on its own unit grid, so three roles (`display-large`,
`body-medium`, `title-medium`) can land up to 0.05px apart. That is a
capability expression, never a per-client choice, so *One design, both
platforms* (*Spacing and layout*) holds; in jakob's words, "the 100%
design match is the goal and both platforms will need their own way to
get there."

**Text scale is honoured and never capped** (the K13 round; WCAG 1.4.4).
Type is `rem` on the web and `sp` on Android, so it follows the reader's
size, and **the budgets follow it: a budget is measured at the rendered
size**. A width ruled in pixels is its width at 1×, scaling with the
type — the filter trigger's 154px band is the room its words have at
any scale, so the summary collapses where its words stop fitting, never
where they would have stopped at 1×. A clamp counts lines, never
pixels: the text body's 18 lines are 18 lines at 2×. The bottom bar's
labels may wrap to a second line above 1.3×. **The tags line keeps its
count whole** (jakob 2026-10-05): measured at the rendered size, the chips
give way — the last folds into the count, then the first — and the count
is never clipped (`TopicsLine`). **The intro's stages scale
to the column**, and **the entry and settings pages scroll** when their
content outgrows the screen: a board's `overflow: hidden` frame is a
drawing convenience, never the spec. A footer the placement law pins
(*Spacing and layout*) stays pinned while the page scrolls under it; a
task page's action, which follows its last field, scrolls with the
page.

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

**Browse collapses, task pins** (jakob's ruling, backlog item 98). A
surface a reader DWELLS in and scrolls for content gives its top away
to the content: the header collapses on the way down and returns on the
way up. A surface a reader is passing THROUGH to finish something keeps
its top on screen, because the way back and the content's own acts must
never leave mid-task. Per surface:

| Collapses | Pins |
|---|---|
| feed · search results · topic page · profile · saved · notifications · history · invites list · the chats list, both faces | post detail · every compose and edit stage · settings · the ceremonies · a chat's thread · About |

On web, **pinned means `position: sticky`** — the bar rides the page's
edge and never hides — and the collapsing surfaces adopt `CollapsingTop`
there too, so the two platforms answer a scroll the same way.
`CollapsingTop` and `PageHeader` point at this table rather than at any
blanket rule about surfaces that scroll.

**The primary action has two placements, and only two** (jakob,
2026-10-01). A **task page's** primary action follows its last field,
in content flow, aligned with the fields — a settings subpage, a form,
a landing that asks for one act; where a page has no field, the action
follows its words. A **wizard stage or a sheet** pins its footer, so a
growing field never walks the commitment out of reach (the growth law's
`Done`, *The sheets-and-video round*) — every compose, reply and edit
stage, the seals, the picture's crop, the profile edit, and the two
pickers' `Done`. Nothing else: no spacer pushing a task page's action
toward the bottom edge. The one stated exception is `ReportProblem`:
the read-back of what travels stands between its field and `Send by
email`, because the honesty comes before the press (jakob 2026-10-01).

**One design, both platforms, dark mode included** (jakob, 2026-09-17).
Wherever Android and web can do the same thing, they look the same
thing: no divergence in colour, spacing, treatment or dark-mode
rendering is acceptable as a platform habit. Where a platform genuinely
cannot — a capability the other has and this one does not — the
difference is *presented*, deliberately and per case, the way `Back is
the platform's` already is. The test is capability, never convention.

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
face at 40% opacity + grayscale, which means "no opinion yet". Blur is
reserved for the sensitive-content veil of §9 (gentle, tap to reveal).
No frosted glass, no protection gradients: type sits on a
solid role, so it never needs a gradient to survive.

### Borders

One hairline weight, 1px. `outlineVariant` for structural separation
(the bottom bar's top edge, `<hr>`, the pad's inert centre-lines);
`outline` for a control the reader can type into or press (text field,
outlined button). Nothing carries a 2px border.

### Motion

**M3 standard easing and durations. Motion clarifies where something
came from; it never performs.** **Reduced motion is a house quality
bar** (jakob, the key-loss round): WCAG places it at AAA, and the house
holds every surface to it anyway — on both platforms, under the OS's
own preference, every motion either stops travelling and fading or
does not run, save the hold's ring (below).

**Every motion in the product is in this table, and nothing else moves**
(the K13 round; `tokens/motion.css`, `tokens/transitions.css`, the
Motion cards). The product defined none, so every consumer was
inventing one:

| What changes | The motion |
|---|---|
| Forward into a screen — a drill-in, and entering a task flow (a composer, an edit, a ceremony) | 300ms, in from 12% of the screen's width with a fade, emphasized-decelerate; the outgoing screen leaves half as far, accelerating |
| Back | the forward motion reversed at 200ms — returning is retracing, and a shorter move reads as backward without a second drawing. Leaving a task flow from any stage is one back to where the flow began, never a replay of its stages |
| A tab switch, slot to slot on the bottom bar | M3's fade-through at 200ms: the outgoing tab fades out, then the incoming fades in; nothing travels |
| A sheet | up over 400ms, down over 200ms |
| A dialog | a 200ms fade with an 8px rise, in place, never a scale |
| The pad's bloom | the dialog's entrance at the pad's parked spot — 200ms fade and 8px rise — with the wash at the scrim's 200ms; closing is the reverse |
| The scrim | 200ms linear, with the surface it belongs to |
| The media handover, feed to detail and back | a shared element: the media frame persists in place while the chrome fades around it (M3's container transform), 300ms. A post with no media takes the forward motion |
| The reel's squish, through the score's door | the clip, still playing, moves to the top of the screen and the post rises beneath it — a shared element, 300ms, never a new page |
| The collapsing top | a 200ms `translateY(-110%)` exit — it hides only once half its own slot has scrolled past, and returns after about a third of a screen of accumulated upward scroll, or at once when the surface reaches its hard top |
| In place — `More`, `View n replies`, a row leaving and the rows closing up, the veil's reveal, the face after `Set`, the snackbar coming and going | height and opacity at `--duration-short-4`, `--ease-standard`; nothing travels in from elsewhere |
| `Back to top` | the platform's smooth scroll to the top |
| The hold's ring | fills over the 500ms hold, linear — a reading of the time left, not a flourish |

**A dismissal exits the edge it entered from**, never sideways.
**Nothing inside an arriving screen animates** — no list entrance, no
stagger — and one transition is on screen at a time. **The handover and
the squish are the arrival exceptions**, and they are the transition
itself: the one frame the reader is following carries over while the
screen around it arrives whole. Under `prefers-reduced-motion` every row
above still swaps; it just does not travel or fade. **The hold's ring is
the one exception**: it still fills, because it is a reading of the
time left rather than a movement (blessed as drawn, jakob 2026-10-05;
`StanceControl`).

**Android's predictive back follows the finger** (targetSdk 36): the
back gesture drives the back motion by its progress — the same geometry
as the 200ms back — completing past the platform's threshold and
settling back short of it; a sheet, the pad and the viewer follow it
with their own dismissal.

**`VouchedIn` is the one accepted exception** (jakob, the close-out
round), and it stays inside the rules it breaks: every duration and
easing it spends is a token already defined here, its phase offsets are
sums of those durations, and the motion is still deictic — it shows
where the reader's own point came from and which way their edge runs.
Under `prefers-reduced-motion` the phases collapse to nothing and the
board arrives at the state it ends in.

No bounce, no spring, no parallax, no entrance animation on lists.

### Haptics and sound

**Haptics only where the platform documents one, and Android only** (the
K13 round; jakob 2026-10-05). Three moments, one platform pulse each:

- the hold's commit, when the 500ms closes and the default signs —
  `HapticFeedbackConstants.LONG_PRESS`;
- the reorder's lift, when a dragged picture leaves its row —
  `DRAG_START` (`LONG_PRESS` below API 34);
- the pad's knob crossing either zero line, and meeting the field's edge
  where the pick clamps — `SEGMENT_TICK` (`CLOCK_TICK` below API 34).

Nothing else vibrates, and the web gives none. **There are no UI
sounds**: no tap, signature or arrival in the app makes one; the only
sound in the product is the media's own.

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
  control is not an available target). **A submit that cannot go yet is
  visible-but-disabled, with the reason on screen** (jakob, the key-loss
  round): never hidden, and never left live only to refuse on press — the
  reader sees the commitment exists and reads what it is waiting for.
  The reason is one quiet line right above the commit, in the voice for
  what something waits on — `Waiting for both passwords` — and the
  commit's description (`WaitingCommit`; drawn on every credential and
  entry form, jakob 2026-10-05; the reasons blessed the same day).
  **The law gates commits; a handoff that only prefills another app's
  draft is not a commit** (jakob 2026-10-05): `Report a problem`'s `Send
  by email` stays live from an empty field, because what it enforces is
  the spec prefill, and the words can be written — or deleted — in the
  mail it opens.
- **Selected** — colour only: the bottom bar's active slot moves from
  `onSurfaceVariant` to `onSurface` and to the filled icon cut; the
  chronicle filter swaps an outlined button for a filled one. No
  underline, no indicator pill.

Every pressable component carries `class="cg-state cg-focus"`, and
`cg-hit` wherever its ink is under 48px, so anything a consumer builds
gets the same behaviour by adding those classes — the masters hold to it
without exception (the K13 round: the help dot, the edited marker, the
history door, the count lines, `More`, the media discs, the profile's
badge and figures). **A card that is a door lights whole**: its words
and its media carry `cg-door`, and the card takes the pressed layer
across its whole surface while either is pressed (`cg-door-card`); the
controls inside it keep their own layers. The avatar picture is not a
door — the badge is.

### Loading

**M3's ladder, and nothing else** (jakob, the key-loss round). A wait
under **200ms** shows nothing — an indicator that flashes is noise. From
200ms to **5s** the wait is indeterminate: `LoadingState` stands in the
slot the content will take, so nothing moves when it arrives. Past 5s
the wait is determinate — progress that says how far along it is. The
**pull-to-refresh spinner** is the one named exception: it answers the
gesture at once, because the pull itself asked for it. A **signing**
past 5s is the other: it cannot measure its own steps, so the seal's
subline says so in an honest olive line and nothing feigns progress
(`SealSigningSlow`, jakob 2026-10-01).

### Navigation

**A direct link opens as a layer over the app** (jakob 2026-10-01, the
layer law). A shared post, a reel, a profile, a comment — any deep link,
from a chat in another app, a notification or a mail — opens ON TOP of
the state the app was in, and back (the gesture, system Back, the
header's arrow) returns to exactly that state: the stream at the clip
the reader was on, the feed at its scroll, the sheet that was up.
Following a link never costs the reader what they were doing. **With no
prior state** — the app opened cold by the link — back lands on the
owning tab's root: a post, a comment or a profile on Feed, a tag on
Explore.

**The header's arrow is history, and names where it goes.** On every
read drill-in the arrow returns to where the reader came from, and its
label names that place by an origin-noun table built from the screen's
actual arriving edges — the tag page's (*The tag-page smalls*), the post
detail's and the profile's (*The navigation-and-sheets round*), the
score's trace, the stream, the opinions page, Notifications and About's
(*The nav-noun sweep*). A cold
entry wears its root's label: `Back to feed`, `Back to Explore` on a tag
page, and the boards draw that state. **The entry funnel is the
exception**: its screens are reached from outside the app with nothing
beneath them, so their arrows are links that name a board (*The shell
round's stops*). **System Back answers as the arrow does** (jakob
2026-10-05): on a funnel screen it follows the arrow's link; an arrowless
mail landing leaves to wherever the mail was opened from; and the web's
recovery-code screen holds a history entry, so the browser's back answers
as Android's Back does there. The ask link is not the funnel: `VouchAsk` and its two
siblings follow the layer law, so an ask opened from a chat returns there
and a cold open lands on Feed, and their arrows read a plain `Back`.
A funnel arrow carries no origin noun: `Join` reads a plain `Back`, and
About opened from the join form keeps that plain `Back`.

**A sheet that launched a forward navigation comes back.** A chip in the
comments sheet, a holder in an opinions sheet, `All your topics` in the
filter, `Cite in a new post` in a comment's menu: back from wherever it
led returns the screen with its sheet up, at the sheet's offset, its
expanded branches still expanded. The cite's wizard X returns the thread
as it was; publishing lands on the new post, as it does everywhere.
**A process the OS ended in the background restores** by the platform's
convention — Android's saved state, the browser's history entry — the
in-surface state included: the pager's page, a clip's position, an
expanded `More` or branch, a half-typed query or reply. **A restart is a
cold launch only** — the app closed by the reader, or updated — and
that lands on Feed's root, fresh.

**Landing on a comment is one statement for every deep link** (jakob
2026-10-01). A notification, a Saved row, a search result, a Cited by
row or a shared link that opens a thread on a comment opens the comments
sheet with that comment scrolled to the sheet's top, its branch
expanded, and a brief tonal highlight on it — one rung up the surface
ladder, never a hue — that fades within about a second. Under reduced
motion it clears without fading. A notification whose target has moved
on lands on the target as it now stands, with no special notice: a
`ready for your approval` row opens Invites, the application in its
current state or gone.

### Sheets

**A sheet that holds a choice is one of two kinds.** **A staging sheet
carries a commit, and dismissal discards** (jakob 2026-10-01, the sheet
law): nothing applies until the sheet's commit — `Done`, `Save`, the
act its foot names — and the commit applies. The scrim, a swipe down,
system Back and Escape all discard: the sheet closes and everything is
what it was, so a description typed and then dismissed is gone. **An
editing sheet applies live, and every way out just closes it** (jakob
2026-10-02, the editing-sheet exemption): each change applies the
moment it is made, so the scrim, a swipe down, system Back, Escape and
`Done` alike close the sheet and everything already applied stands —
nothing is staged, so nothing discards. The editing sheets are four:
`ComposeTags`, `ComposePicked`, `EditPicked` and `ComposeCitations`.
Every other sheet that holds a choice stages — `ComposeLicense`,
`ComposeSensitive`, `ComposeDescribe`, `ComposeDescribeVideo` and the
filter sheets among them. A sheet with nothing to stage keeps the law
by its shape: a menu's row is an act and its own commit, and a sheet
that only lists or reads has nothing to apply.

The feed's filter is where the law pays, and the reason is jakob's:
today a refetch is the newest twenty posts, but once the ranker ships
every refetch runs the whole personalized ranking with the current
arguments and hands back the reordered list of ids — potentially
thousands or millions, not twenty. Five taps must never mean five
rankings, so the filter's chips stage, `Done` commits, and the feed
re-queries once per visit. It stands until readers show otherwise: if
feedback says people expect collapsing the sheet to submit, the law is
revisited (jakob 2026-10-01).

**A sheet is modal.** It dims and covers what it was opened over, and
assistive tech is told what the eye is: focus moves into the sheet,
stays inside it while it is up, and returns to the control that opened
it (§10). Nothing beneath the scrim takes a tap — the sliver of feed
above the filter sheet is visual only. The opinion pad is modal the same
way. The comments sheet is modal over its scrim at a single detent.

**The drag is the platform's** — M3's modal bottom sheet. The sheet
follows the finger from its handle area, and from a list at its
scroll-top; it dismisses past about **25 %** of its height or on a
downward fling, and otherwise snaps back. No intermediate detents. A
sheet hosting a pad drags only from its handle and title zone: the
pad's field consumes every pointer that starts on it. **The viewer's
gestures are the platform photo viewer's**: a double tap toggles zoom,
capped at about 4×; while zoomed, a pan wins over paging and dismissal;
zoom resets on paging; a swipe down drags the frame with the black
fading, closes past about **20 %** of the screen's height or on a
fling, and otherwise snaps back; under reduced motion the close is
plain. Two thresholds, stated apart: 25 % for a sheet, 20 % for the
viewer.

### Search

**One match rule for every search field** (jakob 2026-10-05, the final
brief): Explore's and History's. A query matches names and titles — a
person's handle and display name, a tag's name, a post's title — and
never a body, a description or a bio. Matching is titles only (jakob
2026-10-06): an untitled post's stand-in (copy-voice, *The feed
cards*) is never matched. `@handle <text>`
scopes the query to one person's work, their comments found through the
titles of what they answer, a reply through its thread's root post, and
the tags they tagged with; `#tag <text>` scopes it to the things that
carry the tag. A bare `@x` or `#x` is a lookup in progress: it proposes
people or tags by prefix and never lists anyone's contents — the text
after it is what makes it a content search (jakob 2026-10-07). A result
becomes seen only by being opened, never by standing in the viewport.
Explore searches the graph, in its ranked tiers (§13, *The search
rulings*) — under Newest, the reader's choice or what the search serves
before the ranker exists, the tiers stay and each runs newest first, with
no seam, every row's age on its edge and a tag row bare (§13, *The five
ordered draws*); History searches the reader's seen-list, newest first by
first seeing. A query that finds nothing says so in the list's place and
offers the way back (`ExploreNone`, `HistoryNone`).

### Orientation

**Portrait everywhere but the viewer** (the K13 round). The product is
one column read and acted on with one thumb, and every surface is drawn,
budgeted and placed for a phone held upright — the pad's parked spot,
the bar, the pinned footers. The viewer is the one surface whose job is
to show a frame whole, and a landscape frame is only whole turned. So
Android holds every screen in portrait and lets the viewer follow the
device; **turning the phone on a detail that holds a landscape clip
opens the viewer**, the clip filling the turned screen. The web locks
nothing — a browser window is the reader's — and the column stays the
column at its 42rem.

### Imagery

**An avatar is the actor's picture where they have one**, and a
**monogram circle** in `secondaryContainer`/`onSecondaryContainer`
where they do not — the *designed* placeholder, not a gap waiting to
be filled, and where a picture fails to load it is what shows.

**Photography exists as mock material** (`assets/photos/`, ten real
photographs at true ratios — food, people, animals, scenery). It is
there so media layouts can be judged at real ratios, and it sets the
register: the everyday-post register, warm and human, not brand
stock. No grain filter, no duotone, no
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

**The set lives in one place**: `guidelines/iconography.md` lists every
glyph `Icon` holds, where each is used, and its call. All of them are
inlined — path data in `Icon`, reference copies in `assets/icons/` — and
all but `graph_3` are the classic **filled** 24px variant, verbatim from
`material-design-icons`, which is the exact set and variant the product
itself inlines, so web and Android match. The glyph is the answer
everywhere — with a label in the accessibility tree, never a word beside
the glyph.

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
| `components/content/` | `PostCard`, `CommentCard`, `GlyphAction`, `OverflowMenu`, `TopicsLine`, `TaggedRow`, `ReferenceRow`, `ShareButton`, `NodeMark` |
| `components/forms/` | `TextField`, `FieldLabel`, `FieldSupport`, `FieldCount`, `PasswordField`, `Checkbox`, `LicenseChooser`, `LicenseSummary`, `LicenseTerms`, `RecoveryCode`, `SearchBar` |
| `components/navigation/` | `PageHeader`, `BottomNav`, `TabBar`, `CollapsingTop`, `BackToTop`, `Icon`, `SegmentedFilter`, `FeedFilter`, `FeedFilterSheet`, `FilterTrigger`, `FilterFoot`, `OrderSection`, `FilterSection`, `BorrowedViewBand`, `DeletionBand`, `CograBand`, `BandIcon` |
| `components/compose/` | `WizardHeader`, `WizardFooter`, `SealFooter`, `ActsFooter`, `ActsCard`, `MediaThumb`, `PickPrompt`, `PickTray`, `PickedRow`, `PickedSheet`, `CitedSheet`, `TagsSheet`, `DescribeCounter`, `DescribeSheet`, `UploadStatusLine`, `UploadErrorLine`, `RefusedFile`, `CoverRow`, `CropViewport`, `CropZoom`, `StagedReference`, `TopicRemovable`, `Caret` |
| `components/wallet/` | `WashCard`, `WalletBalance`, `EarnedChart`, `LedgerRow`, `PayoutAddress`, `PayoutAddressRow` |
| `components/people/` | `MonogramAvatar`, `ActorChip`, `ProfileHeader`, `StanceRow` |
| `components/states/` | `EmptyState`, `LoadingState`, `ComingSoonCard` |
| `components/honesty/` | `PendingMarker`, `EditedMarker`, `TransportError`, `SigningPending`, `NoticePanel`, `NoticeLine`, `RedactedContent`, `SensitiveVeil`, `SensitiveScope` |
| `components/stance/` | `StanceControl`, `StancePad`, `StanceReadout`, `OwnStanceReadout`, `StanceValue`, `StanceStanding`, `StanceLandingLine`, `StanceSlider`, `StanceAlternates`, `HelpLine`, `SeveranceConfirm` |
| `components/media/` | `MediaAttachment`, `MediaGallery`, `MediaDisc`, `PagerDots`, `MediaViewer`, `VideoTransport`, `Timeline`, `SeekLine`, `PinnedClip`, `ReelRail`, `ReelRailItem`, `ReelCaption` |
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
| `ExplainableNumber` | the shape §7 requires of every figure: a quiet inline value and one tap to its explanation, and nothing more — there is no expand-in-place variant, because the product's one figure is the score every ranked card wears (the Feed score, on a post, a comment, a person and a tag alike) and its explanation is four screens deep | — |

The **five-slot bottom bar** is not in this group: the five slots and
their order are fixed law here, so `BottomNav` simply accepts
`slots={ALL_SLOTS}` and every new layout should be checked against it.
A design that has only ever seen three slots is a design that breaks when
the bar grows.

The discovery slot is keyed `search` but **reads "Explore"**. The slot is
the product's way into the connections a reader has, and "Explore" says
what the reader is DOING there — a one-word label naming the mechanism
instead would make five tabs out of which one described itself
differently from the other four. The mark was considered for
this slot's glyph and rejected: the mark is the product's identity, so a
tab wearing it would come to mean one screen; a letterform beside four
geometric glyphs breaks §5's one-icon-language rule; and the mark has no
filled/outlined pair, so the slot could not express selection the way its
neighbours do. It takes Material's `search`.

### Specified in the source but not built here

Called for by the source design system and absent from the current product
code, so absent here too. They are the honest gaps, not omissions to
paper over:

- **Collective** actor variant.
- **Wallet** surface — its bar slot exists in `BottomNav` (§7.1) and
  opens the coming-soon door (`WalletComingSoon`); the wallet itself is
  post-MVP.

### Intentional additions

- `BottomSheet` (+ `SheetItem`, `SheetTitle`) — the source design system
  lists sheets in
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
  segmented row was the wrong control. Kinds of ranked content that
  combine (the four CoGra v1.0.0 serves — posts, comments, profiles, tags, §13's
  scope cut — `FEED_KINDS`, one list shared with search),
  forms of post that combine (photos and video with no text posts is a
  legitimate feed), an order that does not (ranked, the default, or
  newest) with the seen toggle riding in the same section (`OrderSection`,
  identical on the feed and on search), and what else the feed admits
  (sensitive, veiled; removed, as
  its skeleton). None of that fits in a row across the top of a screen, so
  it is one chip-shaped trigger reading the view back in words plus a
  sheet — and the trigger has a budget, in pixels: the head names one
  kind or counts them, and once the exceptions stop fitting the band's
  154px they collapse to a count ("3 kinds · 4 changes"), because a pill
  that overflows has told the reader nothing
  and "far from the default" is the fact that matters there. It stages, and `Done` commits — one re-query per visit (§4, *Sheets*) — and
  switching every kind off is allowed: the feed says what is off rather
  than the chip refusing the tap. No glyph on the trigger: there is no
  filter icon in the inlined set, and an icon could not say "newest".
- `ProfileHeader` — §6 specifies it, the product never built it, and the
  profile round (2026-09-01) made it canonical: the compact avatar-left
  shape with name and figures beside it, and the figures are the design
  work — **Posts**, **"Opinions on them"**, **"Opinions by them"** —
  because the two directions are different facts and the label has to
  say which one it counts; one merged "followers" figure would describe
  a different product, where a link is one-way and carries no opinion.
  The figures are one tap target toward the
  stances page. On another's profile the stance wears the wide anchor with
  Message beside it; one's own avatar wears the change badge (the
  standalone crop-and-seal shortcut). No cover image: the largest thing on
  a person's screen should not be decoration.
- **Media avatars** — `MonogramAvatar` and `ActorChip` take a photo at both
  sizes. The monogram stays the designed fallback rather than a gap waiting
  for one, and a broken image falls back to it silently.
- `EditedMarker` — §9 specifies the Edited marker and the
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
  what lets a page of eleven groups read as a page. A quiet heading above, a
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
— on screen, **"For or against"** and **"How much reaches you"** for an
opinion; another record family filling the same two slots names them its
own (§3). All four quadrants are legitimate.

- **At rest** the target shows the opinion: the face and the exact
  pair. A viewer with no opinion sees a **muted, translucent 🫥** —
  never a bare word.
- **A plain tap** blooms the pad at the lower centre of the viewport and
  stages nothing. The **first open ever teaches**, wherever that pad
  opens — two coaching lines: how the pad opens and its press-and-hold
  shortcut, then that nothing is signed until Set and that the input can
  be swapped in settings. They close with the pad and never show again.
- **Press and hold 500ms** commits a modest positive `(+0.1, +0.1)`
  outright. The light gesture opens, the held one spends: nobody holds a
  control for half a second by mistake.
- The pad's drawn field *is* the value space: its corners are
  `(±1, ±1)` and the knob never leaves it. Horizontal runs Against → For,
  vertical runs Less → More, and those four words sit outside the field,
  in gutters around it, so nothing but dead ground stays inside.
- **Releasing the finger never commits.** Release parks the pick, an
  explicit **Set** signs it, **Cancel** or a press outside stages
  nothing.
- The pad shows the **face and the exact pair**, live under the drag,
  with the **landing** ("Resulting opinion …") below the field — two
  different numbers, never merged into one line, each labelled above its
  own value.
- **The control never prevents a choice.** A pick that nets a bundle to
  `(0, 0)` is *severance*: confirmed with its cost stated, never
  refused.
- The emoji face is a **lossy readout of the pick**, nearest of twenty
  anchors by Euclidean distance — dense in the for-it-and-want-it
  quadrant, sparse at the extremes. `(0, 0)` never speaks through the
  table: it gets 🤷.
- **A pick with only one axis reads through `VALENCE_SIX`**, the
  pure-valence spine of the twenty — six ruled bands over `pDirected`
  alone, for the own-post pad and the seal row that states what it
  picked. A nearest-of-twenty lookup cannot answer for a value that
  names no pair.
- **Where the anchors sit is recorded on the anchor-map card**
  (`components/stance/anchor-map.card.html`) — the twenty on the
  two-axis field and the six pure-valence ones on the strip, each at its
  own coordinate. It is a reference for implementers: the product pad
  draws its four axis words around the field and nothing else, and the
  anchors' words stay accessibility-only.
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
  timestamp, thread position, the opinion a reader can still give, the
  score, the comments. No record ever leaves the graph and
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
  a plain `visibility` chip. **A reveal is the session's**: it survives
  leaving the post and coming back, and every other move inside the app —
  a reader who chose to look once is not asked again on the way back.
  It returns when the app is fully closed, or the media is otherwise
  reset from scratch. The backend's 0–10 severity level is **not** read:
  the setting maps to a single show-sensitive threshold, and the
  gradient — where a reader accepts one kind of content and not
  another — comes after MVP. — `SensitiveVeil`

## 10. Accessibility

Part of the bar from day one. Every `on`-pair meets AA. Colour never
carries meaning alone — stance is always accompanied by words. 48px
minimum targets — the platform bar (48dp, 44pt), which the house holds
over WCAG AA's 24px floor. Every icon-only control is labelled. **Every drag
gesture has a non-drag equivalent.** Both themes are designed.

**A card's header answers at 48dp** (jakob 2026-10-06). The drawn 28dp
header — `ActorChip`, the age and the ⋮ — keeps its geometry; platforms
mount an invisible 48dp touch target centered on it, the back target's
precedent. Where that target overlaps the card's one open-the-post
surface, and the dead padding above the header, the header target wins
inside its strip. The detail's tags line follows the same precedent
(jakob 2026-10-07): drawn at 34dp across the card's content width, it
answers through an invisible 48dp target centered on it.

**Focus has four rules** (WCAG 2.4.3; the WAI-ARIA dialog pattern), for
every sheet, pad and dialog — each modal (§4, *Sheets*):

- **Opening** moves focus to the surface's title, else its first
  control, and holds it inside until the surface closes.
- **Closing** returns focus to the control that opened it — or, if that
  control is gone, to what now stands in its place.
- **A row that removes itself** (hide, unsave, revoke, untag) hands
  focus to the next row, else the previous, else the list's empty state.
- **A forward navigation** lands focus on the new screen's title, and
  back returns it to the control that left; a sheet that comes back — a
  return, a signed reply, a deep link — lands it on the row it opens on.

**The drags' non-drag twins** (the K13 round): the card's and the
detail's pager is a focusable strip paged by ← and →, with the platform's
scroll actions, its dots a visual readout only; the crops carry a
visible zoom slider and pan by arrow keys (`CropZoom`, `CropViewport`);
picture reordering offers `Make it the cover`, `Move up` and `Move
down` (`PickedSheet`); the pad has its sliders and direct entry (§8).
The viewer is named by what it shows (`Picture 2 of 4`), takes focus on
its X and hands it back to the frame that opened it, and pages without
wrapping.

**Names carry what the eye reads** (the K13 round): a control's
accessible name keeps the visible words and the number in them — the
filter pill's reading before its purpose, `8 opinions on this post`,
`Cited by 4`, `Unsave The long way home` — and a search field is named
by its use, never its placeholder.

**What changes without a tap is said once** (the K13 round): the pad's
readouts speak when the pick has rested about 500ms, never at every
step, and a feed's filter, once `Done` applies it, says what the feed
now shows in one polite announcement. Type over media — the reel's
rail, the over-media face, the veil's media face — stays white with its
shadow: the look is ruled, and its contrast was checked against the
lightest fixture photograph (`ReelRail`).

**One rule for credential forms** (the K13 round): a form that signs in,
sets a password or re-proves one names its account by the login email as
`autocomplete="username"` — on its email field, or in a hidden input
where it draws none (`ChangePassword`, `ResetNew`, `ChangeEmail`,
`ApplicantEmail`; jakob 2026-10-05); passwords are
`current-password` or `new-password`; a handle is never `username`
(`PasswordField`, `TextField`'s field-semantics table).

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

**Whether an act asks first is one rule, with three answers** (jakob,
the key-loss round):

- **Undo** for an act that is reversible and private — hiding someone,
  unsaving a post. It happens on the press, and the snackbar carries the
  way back.
- **A think-twice dialog** for an act that is irreversible, or public
  and consequential for someone else — removing a post, discarding a
  draft, walking an opinion all the way back, closing an application,
  declining a backup, changing the handle (a freed handle is claimable
  and its links die), and signing out of a device set to forget the
  account while it holds the only copy of the key.
- **Nothing** for an act the reader undoes by doing it again — a switch
  flipped back, a pick made over.

An act is placed by what it costs, never by how often it happens: a
dialog in front of a cheap, private act teaches the reader to press
through dialogs, and that habit is what the costly ones then meet.

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

**A dialog is inset from the screen, and the gap is what makes it a
dialog** (jakob 2026-09-15: "popups should not be full width (if they
dont need to).. it makes them standout more"). `DialogSurface` centres
every dialog at `--dialog-max-width` (20rem) and keeps it at least
`--dialog-inset` (32px) from either edge. The inset is the load-bearing
number and it is deliberately wider than the 24px screen gutter: a
dialog whose edges line up with the body text behind it reads as part of
that body, which is the one thing a dialog must not read as. The
platform's own floor is 24dp and its narrowest dialog 280dp, so this
sits inside the idiom rather than beside it. **One width, for all of
them** — the shell was extracted so the dialogs could not drift, and a
per-board width is exactly that drift; `width` overrides the max for a
dialog that genuinely cannot live at the house size, and no dialog in
the product does.

**One anatomy, owned by the shell** (jakob 2026-10-01). `DialogSurface`
takes `title`, `body` and `actions` and lays them out by M3's dialog
spec: the title in `headline-small`, the body in `body-medium` on
`onSurfaceVariant` (M3's supporting text), 16px from title to body and
24px from body to actions, and the actions at the default button size,
aligned to the end. A board passes words and buttons, never a layout,
so no two dialogs can drift apart. **The scrim and system Back take the safe
answer** — cancel, keep, stay: the dialog closes and nothing is done —
never the destructive act.

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
`Against`/`For` and `Less`/`More` drawn in gutters outside the pad's
field and under the sliders. The originals were the repo's own framing rather than words a
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

**The first-open teaching says less** — two coaching lines (how the pad
opens and that a hold signs `+0.10 / +0.10`; that nothing is signed
until Set and the input can be swapped) instead of five facts at the
moment a reader is least willing to read.

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

**One affordance row.** The stance control leads, the Feed score follows,
then anything else the post grows — so each surface stops arranging them
itself. Nothing in that row may take `primaryContainer`; the stance knob
already spends the screen's one loud surface.

**The license moves off the initial view.** It is among the rarest reads
in the product and was competing with the content for the same glance.
It is now a `License terms` item in the new `OverflowMenu`, which every
post and comment carries — the row carries what a reader reaches for, the
menu carries the rest.

**The Feed score is a card prop, shown as `graph_3` plus the number.**
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
  the first-open teaching showed again on the next card down.
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
contain, as large as the screen allows, backed out of with the X, a
swipe down, or back but never by a tap, and the route never changes. In
the feed the same tap opens the post: a reader scrolling is choosing
between posts, not looking at one picture. A video takes real controls
in the viewer, where the reader is deliberately watching; in a tile it
has only sound.

**A tap anywhere meaningless on a post opens its detail view** — title,
media or body, description (still clamped), the affordances, then the
comments. Anything with its own meaning keeps it: the author chip goes to
the profile, the affordances act.

**Comments get their own affordance in the card**, third in the row —
`chat_bubble` plus the count, the same shape as the score beside it. It
opens the *same* detail view, scrolled so the comments lead: the post and
its affordances sit just above the fold, so a short thread still shows
its post. (The affordance opens the comments sheet instead — §13,
*Comments live in a sheet*.)

**Icons: all inlined, hosted font dropped.** See §5.

**Real photography** for mock material. See §4, *Imagery*.

### Design-ready, not yet built

Drawn since: the drill-down (§13, *The
score-and-opinions round*), `RedactedContent` and `SensitiveVeil` (§9),
search for Explore (§13, *The search rulings*) and the wallet's masters
in `components/wallet/`.

**The score is "Feed score" to readers**, and its drill-down is
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
record-granular. Sensitive: **a gentle blur with tap to reveal**, shown
or not by the reader's own `content_filtering_severity_level` (0–10,
backend-stored) read as a single threshold. **The body blurs as one
region** — media, text, and
description together, under a single veil with one reveal. The title
stays outside it, so a reader can tell what they are choosing to
reveal. Picture-by-picture blur inside a gallery is the UI this rule
exists to avoid. Neither state may use `error` colouring.

**Feed, Search, Explore, Wallet, and the marketplace** are product
surfaces whose decisions are recorded in the product docs rather than
here — a feed is a list of ranked nodes rather than a list of posts,
Wallet holds balances and earnings, and the marketplace is entered from
both the feed and a profile. A component lands here when one of them
produces it; the roadmap stays there.

**Both clients follow one design, 1:1.** Neither leads: web (at mobile
width) and Android render the same design, Material-aligned, differing
only in the browser around the web one.

### Still open

- Palette, type, and shape stay as they are until a problem shows up.
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
  over to the member's own view with their first signed opinion, on
  anyone: their own graph then exists, so their own feed does. The
  vouch-back is not the gate.
- **The vantage resolves to the most specific actor available**, and
  the band names whichever one it lands on. Anyone who arrived through
  an invite link borrows that link's ISSUER, and an applicant is still
  one of those: the rung is the link, not a vouch. Nobody has vouched
  for an applicant yet — that is what the applicant days are — so the
  issuer is the only actor their arrival carries, and calling that rung
  "their own inviter, who already chose them" claimed a relationship
  that does not exist until the vouch-back fixes it
  ([invitations.md §2](../docs/primitive/invitations.md)). A bare
  visitor borrows genesis, strictly as the fallback when nobody more
  particular is known. The order matters more
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
bottom edge otherwise, the keyboard while one is up; one number
everywhere (ruled 2026-09-10). First-time onboarding is
per-control, never a tour, and on the entry screens only the pad
carries it — two coaching lines on the account's first-ever pad open:
how it opens and its press-and-hold shortcut, then that nothing signs
until Set and that the input can be swapped in settings. Beside those
lines stands **one skippable intro** (ruled 2026-09-14): five
full-screen cards — the feed is your own steps, opinions have a
shape, everything is public, nothing is lost, someone brings you in
— fired on the first authenticated feed entry, from applicant on,
shown once against a server-side seen flag set on the first show, and
re-opened from Settings' About group. Skip stands on every card and
leaves for the feed the intro opened over — or for Settings, when
Settings re-opened it. The buttons are the only movement: no swipe in
v1.0.0, and Android's Back walks the cards back, card 1 leaving as Skip
does (jakob 2026-10-05). It teaches what the product IS rather
than what a control does, so it neither replaces the pad's coaching
lines nor adds any; the per-control teaching is unchanged by it. The last card
carries the applicant's one task — the friend who sent the invite
still has to let them in — and its inviter face is personalized by
the client to the actual link-issuer's avatar, the monogram
standing in where there is no photo. It says **invited**, never
*vouched*: the issuer invites and the vouch is the act that follows,
so the first screen a reader meets must not teach that order
backwards.

**`About` is a FAQ, not an essay** (jakob 2026-09-18). Its topics are
rows a reader expands, because the page gains a section every time
CoGra gains something worth explaining and a page that grows by
scrolling is read less the more it says. Topics answer
independently — opening one leaves the others as they were.

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
them discards, so a non-empty composer, or an edit changed since it
opened, is asked first — one shared dialog (the *DiscardConfirm* board)
reading "Discard this reply?" or, from an edit, "Discard the changes?"
(jakob 2026-10-02), body "Nothing is kept.", a quiet *Discard* beside a
filled *Keep writing* — the safe answer carries the weight, as it does
everywhere else. An empty composer or an unchanged edit leaves at once —
a confirm with nothing to lose is noise. For the same reason
a reply meets the key-absent notice at its door, before a word is
written, and a key lost mid-write leaves its seal only restore or
discard (*The reply pack*, below). Signing exits to
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
**The stopper exception** (jakob, 2026-10-01): a notice that stops the
one act its surface exists for carries its own "?" on the panel,
beside the header's. The header's "?" explains the surface; the
stopper's explains how the stop resolves, and one dialog cannot do
both. `WriteRuleFailed` is the first. The dialog texts live in
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
- **The order** (jakob, 2026-09-30): top-level comments newest first,
  and the replies in a branch oldest first — a branch reads as a
  conversation, so a reply just signed ends its branch. Newest first
  at the top level holds until ranking can order the thread.
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
  seam a row's rank gives way to its age, in copy-voice's one ladder
  (*Ages*).
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
  Feed score screens (item 13).
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
  filter" dialog explains combining, the `Done` that commits, the seen toggle,
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
  n of m — signing waits for the pictures" (`…for the video.` on a
  clip), the sign button held
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
and the same-day product decisions it forced (the admission denomination is
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
  (`back` / `self` / `os` / `document`), or an explicit **gap** — a
  design still owed, greppable, listed by the checker, drawn red on
  the maps.
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
  reports gaps without failing.
- **`_build/check-readouts.mjs` is the gate's second half**: the six
  pads that draw their own readout (`RefPair`, `ComposePad`, `TagPad`,
  `TagPadCompose`, `PadKeyAbsent`, the shared `ReplyPadBody`) spell
  face and pair as literals, because the formatters and the anchor
  lookups stay off the bundle's namespace. The check reads each pad's
  own `value` and asks the masters what it reads as —
  `formatStancePair` / `formatTagPair`, `nearestAnchor` /
  `nearestTagAnchor`, `padPercentOf` — so a moved value, a hyphen
  where §3 rules U+2212, or a spoken reading left behind is a
  failure. A seventh hand-spelled readout anywhere in `screens/` fails
  too: unchecked is not a state a literal gets to be in.
- **`_build/report-summaries.mjs` is the gate's third half** (items 60
  + 64): it enumerates the feed-filter trigger's reachable summary
  strings (`feedFilterSummary`, `FeedFilter.jsx`), measures each with
  the master's own `measureTriggerText`, and **fails on any summary
  past the band's 154px** — the master collapses at that width, so an
  overflow means the collapse never fired. It owns the font the master
  cannot read: `figtree.ttf`'s advances, instanced at the wght 500 the
  trigger renders at, re-derived on every run and checked against the
  master's table so budget and ruler cannot drift apart
  (`--print-metrics` writes that table). The census prints either way
  — how many summaries exceed the trigger's own 198px text room and
  the band's tighter 154px against the total. Full pipeline: `node bundle.mjs &&
  node export-tokens.mjs && node render-screens.mjs && node gen-maps.mjs
  && node gen-canvases.mjs && node check-flows.mjs &&
  node check-readouts.mjs && node check-behavior.mjs &&
  node check-help-notes.mjs && node report-summaries.mjs`.
- **`_build/check-behavior.mjs` holds the behavior sidecars to their
  grammar**: every line of `designs/canonical/behavior/<Screen>.md`
  parses as a WHEN or an ALWAYS line, or the gate fails with its file
  and line — and names only registered node paths, writing a path
  wherever a registered screen has a node for the element. The
  sidecars are the contract the implementation side's conformance
  harness compiles; their README carries the grammar and what the
  check does not see.
- **Registered screens carry data-node paths** (design ⇄ impl seam
  002; the calibration screens `Feed`, `PostDetail`, `ComposeDetails`
  first). A master names its own parts with local segments, and only
  when its placer hands it a `node` name; a screen that exports `NODE`
  supplies the prefix, and `render-screens` (`_build/node-paths.mjs`)
  joins each segment with its annotated ancestors into the full path
  on the built board — `feed.card.actionRow.score`. A repeated
  instance carries `data-node-key`, a content key (the author's
  handle, the tag's name; a position only where content has none),
  and so does every node inside it: the implementation side diffs
  (path, key), never DOM order. A copy a board's tweak chip draws once
  per value is one element in several states: it keeps one path and
  carries the chip's value as its key (`history.searchField` under
  `search` and under `kinds`; jakob 2026-10-06, seam 069). Every
  other board renders the annotations stripped, so a name reaches a built board only once it
  is registered in `designs/canonical/nodes.json`, which the render
  writes. **Registered paths are append-only**: a collision fails the
  render, and so does a registered path that stops rendering — a
  rename is a breaking change for the implementation side, made only
  by deleting the path from `nodes.json` by hand in a reviewed PR.
- **`_build/check-help-notes.mjs` holds the "? contents" notes to
  copy-voice** (item 109): each note section names a dialog of
  copy-voice's *The "?" dialogs* and must carry its blessed text, and
  every dialog there lives in exactly one note — canonical's
  `help-contents` or the post-MVP tree's `wallet-help-contents`. A
  reworded dialog is rebuilt into its note with `--write`.
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
  (item 16), and item 13's Feed score drill-down. Cross-flow reuse
  is wired as edges into the master boards (the describe sheet, the
  gated seal, the license / sensitive sheets, the key-absent seal,
  the stance pad, and the three pattern boards — the guest gate, the
  network error, key-absent acting) rather than duplicated boards.
  (Every one of those gaps is drawn since; the canonical graph holds
  none.)
- **The tag picker's interim entry** (jakob 2026-09-02): until the
  picker board exists, the apps' entry is the existing tag field,
  opened as a sheet from the seal. The gap and the blocked
  `add-a-topic` flow stand — the interim is what the apps ship, not
  the design owed. (`TagPicker` is drawn since 2026-09-09, and the flow
  resolves.)
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
  always `back`, and it discards (§4, *Sheets*); a flow about leaving a
  sheet unchanged declares that scrim edge as its given end rather than
  walking it. (The four editing sheets discard nothing since — their
  scrim exit stays `back` and closes with every change already applied;
  §4, *Sheets*, the editing-sheet exemption.) A sheet's journey ends at its Done: the signing that may follow is the publishing flow's
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
  — that one opens the ceremony, and the ceremony opens the way into the
  member's own feed.
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
  the same reason: its face diverges — a tap and a press-and-hold both
  open the pad carrying the key notice, so nothing signs without the
  key. The applicant gaps stay in the census; their
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
  target); and any context where autoplay is
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
  one the reader's apps already live in. (Revised by the chats
  integration round: once chats exist, the share act opens `Send to a
  chat`, with the platform's sheet inside it.) **No count** — a share tally
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
  wear the cover as a thumbnail.
- **The viewer is reached by the second tap**: media in a card opens
  the post, media in the post opens the frame — or the transport's own
  fullscreen toggle, which is the same door. It is **the whole surface
  on black with nothing behind it**: a viewer you can still read a card
  through is not full screen. Nothing is cut there —
  it is the surface every crop in the product is measured against — a
  picture pinch-zooms and **the gallery's swipe and its dots** carry
  over, dots only, no arrows (the pager ruling holds here too: arrows
  would be a second vocabulary for a gesture the reader already has),
  the count spoken in the row's accessible name rather than drawn.
  **The row is windowed at seven**: past seven pictures it slides
  centred on where the reader is, and the edge dot on the side the set
  keeps going is drawn smaller — a marker with a ceiling, where a row
  that grew with the set would be a ruler to count. And a clip
  whose shape is not the device's keeps its shape and takes the ground
  beside it rather than being cropped to the edges. **No acts** on the
  viewer, and **the description is not shown**: alt text is read aloud
  to people who cannot see the frame, and printed under it it becomes
  a caption its author never wrote. The ways out are the X, a swipe
  down and Android's Back, everywhere; where a backdrop is visible — a
  wide screen — a tap on it closes the viewer too (jakob 2026-10-02).
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
  anything — it answers where it was pressed, "Your post waits with
  your application — it arrives with you." or the stance's equivalent
  (copy-voice, *The staged-act snackbar*). These are **self
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
  what it answers — somebody else's post or comment — so both
  parameters are the author's and the
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
- **The one-axis pad names a face the table has**:
  `nearestValenceAnchor(+0.10)` is 🙂 "Nice".
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
  an opinion on what it answers." stands as a `QuietNote`
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
  stance is toward what it answers, both axes, on the reply's own
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

- **The entry arrows name boards.** In the entry funnel the header's
  arrow is a link and never history, so a visitor arriving from outside
  the app has to land somewhere (§4, *Navigation*): the
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
- **The chats affordance ships before messaging does**, and taps into
  `ChatsComingSoon` (ruled 2026-09-14). The band carries chats because
  messaging belongs on every tab root, and that corner is the same
  corner on every root — pulling the icon until a chat surface exists
  would move the bell on every band and move it back later, costing
  every reader the muscle memory twice to save one screen. So the icon
  stands and the tap lands on a screen that says what is behind the
  door. A guest's band still gates instead: `Main`, `FeedBare` and
  `WalletGuest` send chats to `GuestGate`, because a guest has no chats
  to come back to. The *Message* control on another's profile is a
  different affordance and still owes its own destination. (It opens
  `ChatsComingSoon` too since — §13, *The chats-routing close*.)
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
  order cut off at 844px is an order nobody can review. (Later rounds
  add People, About and Delete account — eleven groups; `SettingsBody`
  draws the current order.)
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
  its content; every filter sheet takes one (§4, *Sheets*).
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
- **The page is a subpage of search** and carries no bottom bar — the
  settings round's rule for a surface a reader arrives at, reads and
  leaves. Its title is the tag with its `#`.
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
  topic feed lands). (Ruled since: topic holding ships whole inside
  v1.0.0 — slice sequencing, never a hidden surface at the release cut;
  jakob 2026-10-06, `staged-surfaces.md`.)
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
  and one opens — `TagPage`'s own Feed score row, which every board
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
- **The borrowed-view band dies after signing, not on approach.** Until
  the member's first opinion is signed they have no stance of their own
  and the view is still borrowed, so the band stands through the whole
  approach to the pad and goes once that opinion is signed.
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
  is drafted and awaits blessing. (Blessed since, with the small-rulings
  batch — copy-voice.)

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
  jump reads as travel over a list the reader still owns. **The feed
  says this rung out loud** (jakob 2026-09-14): deep in the list, a
  `Back to top` pill rides in with the returning collapsing band,
  centred under it, and does exactly what the re-tap does. The two are
  one outcome reached two ways — a rung a reader has to be told about,
  and a control that tells them. The pill is the feed's, because the
  feed is the root with a top the reader is trying to get back to —
  and History's, which is a feed (jakob 2026-10-05); it needs 3
  viewport-heights of depth (jakob 2026-10-02), since shallower the
  returning band has already brought the top within a flick; and it is
  drawn OUTSIDE the collapsing block, because height added to that block
  moves the band's own threshold and re-clamps the list (item 45.3).
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
  chronicle, the opinions page, Invites (jakob 2026-10-05), History
  (jakob 2026-10-05), Saved (jakob 2026-10-07), search results, the
  wallet's history, the tag page — and
  **never inside a bottom sheet**, where pulling down already means
  dismiss and one gesture may not mean two things. The re-tap refresh
  stays the feed's alone; the pull-down is the gesture every root
  answers. **Explore at rest takes no pull-down** (jakob 2026-10-02):
  multi-refresh is habitual behavior CoGra must not invite, because once
  the ranker lives every refresh is a full re-rank.
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
  its scroll, never what was covering them. Back is not a tab switch:
  a sheet that launched a forward navigation comes back with its
  screen (§4, *Navigation*).
- **Every viewer class climbs the same ladder.** Guest, applicant and
  key-absent readers get the identical four rungs, and the gates in
  front of the slots are unchanged — one shell for everyone is the
  bar's standing rule, and the ladder is part of the shell.
- **The state is the session's.** A restart — a cold launch, never a
  process the OS ended in the background (§4, *Navigation*) — lands on
  Feed's root, fresh; nothing is promised across launches.
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
  was hand-spelled on `ComposeWords`; a second board needing it made it
  board-local no longer. `ComposeWords` renders byte-identically after
  the move, which is what a factoring owes.
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
  quoted targets take it as their thumbnail. Nothing on a
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
  already stands in for. The Feed score and the viewer-relative rank
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
  inside the pad, and what it teaches is the shortcut. (The two coaching
  lines replace the mark — §8, 2026-10-06.)
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
  the profile round, where every reader already aims at it. (The band
  law supersedes the placement: the ⋮ moves to the Edit profile ·
  Invites row — §13, *The review-fix round*.)
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
- **History is posts only, ordered by the first time you saw one**
  (jakob). Saving is a deliberate act on anything; being seen is
  something posts do in a feed, and a history that collected every
  profile a thumb passed would be a log. A post read twice keeps the
  place its first reading gave it — `ViewHistoryEdge` carries
  `firstSeenAt`. (The History redesign, 2026-10-05, widens the list to
  every served kind.)
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
  it and `bell={false}` is the only way to be without one. (The band
  law sets the whole cluster since: the screen's own control · chats ·
  bell — §13, *The review-fix round*.)
- **Guests have no bell; applicants do.** Nothing can be addressed to an
  account that does not exist, so `Main`, `FeedBare`, `GuestGate` and
  `WalletGuest` opt out. An applicant is an addressee already — the
  approval and the approver's opinion both land on them — so the
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
  `FeedUnread` inheriting `Feed`'s Feed score and chats gaps. The
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
  is named in `What stays`: the realization address is held by the reader's key
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
  its outlined act. No expiry is claimed: `auth.md` gives the reset link fifteen
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
  alternatives and the reasoning are in `copy-voice.md`. (Ruled
  2026-09-14: forward moments read the ladder forward, `in 6 days` —
  copy-voice, *Ages*.)
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
  clones inheriting `Feed`'s Feed score and chats — `FeedUnread`'s own
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
  would address nobody. What the row's ⋮ holds is the close-out round's
  ruling below.
- **The empty hidden row stays `None`** (jakob, final). Nothing else was
  ever drawn.
- **Notification rows are kept** (`docs/implementation/notifications.md`):
  no age bound, no cap, no pruning job for the test phase, and the bound
  belongs to the era in which a reader owns their own storage — how long
  someone's operational rows live is a question about whose disk they sit
  on. The rows are rebuildable either way, so adopting a bound later is
  maintenance and never a loss.
- **The score reads `Feed score` in prose too** — `PostCard`'s docblock
  and its `.d.ts`, the icons README, the numbers card, the iconography
  guideline. Graph gap names keep the old spelling by ruling.
- **The gate**: 170 → **171 boards**, 1263 → **1287 edges**, gaps 63 →
  **65**, flows hold at **61/58/3**. The 24 new edges are `FeedHidden`'s
  eighteen (the feed's own anatomy, plus Undo), `ProfileDeleted`'s four
  (its counts, its anchor, its tabs, its rows — the page it got back),
  the Saved row's unsave, and Save on the own-post menu. The two new gaps
  are `FeedHidden` inheriting the feed's Feed score and chats. The
  witness moved in origin lists and their start counts only —
  `FeedHidden` joining nine feed-rooted flows, `ProfileDeleted` joining
  the two profile ones its new controls open — plus `RemoveMenu`'s two
  steps renumbering behind the Save row. No step rerouted and no flow
  changed status. No frame grew: `ProfileDeleted` measures 752px of
  content inside the phone's 844, and `FeedHidden`'s 1005 is a list that
  scrolls, the way `FeedNarrowed` (1337) and `FeedGallery` (1102)
  already do.

### The score-and-opinions round — 2026-09-11

Round 4 of the MVP design queue, and the last of the slice-3 remainders:
the Feed score's drill-down (backlog item 13, all four screens) and the
opinions-on-content list (item 55). jakob ruled every input before the
round opened — level one shows the strongest handful with a quiet row
that expands, the all-paths-moved case is a quiet line in the graph
register, and item 55's entry is a bottom sheet from a row on the detail
plus the comment's ⋮.

**The drill-down answers one question, and it is the reader's**: why is
this post in *my* feed. `feed-ranking.md` §6.1 makes that answerable —
the score is the sum of up to `k` internally disjoint paths from the
viewer's own outgoing opinions to the post — so the four levels are that
structure walked down: the **paths**, one **path**, one **step**, and the
signed **records** behind that step. Each level carries a small cover of
the post it came from, so a reader four taps deep never loses what they
are reading about.

- **The register is paths and people, never a chart.** Rows, faces and a
  trace of avatars; no bar, no meter, no percentage and no trend arrow
  anywhere on the four boards. A bar would turn a reader's own
  connections into a statistic about the post, which is the
  growth-dashboard framing `ExplainableNumber` already refuses.
- **The arithmetic closes on the drawn surface.** Four paths at 6.80,
  4.20, 2.60 and 1.10, and the more-paths row carrying the remaining
  0.50: 15.20, the score the reader tapped. That is why the quiet row
  states what the folded paths add rather than only how many there are —
  a row saying "2 more paths" alone would leave a hole in the one place
  the product promises there is none. At the floor the same discipline
  holds: the step's two records, `+0.45 / +0.10` and `+0.10 / +0.10`,
  add to the `+0.55 / +0.20` it carries.
- **No step carries a magnitude, and that is a truth claim.** A path's
  contribution is not the product of the opinions drawn along it — the
  per-step weight is damped and tier-bound (§3.1) and only the terminal
  step decays (§5.3) — so a figure on every row would invite an
  arithmetic that does not hold. Each step says what carries it and when;
  the path says what it adds.
- **The freshness fact is the last step's.** `PathSummary`'s second row
  is the newest opinion on the path, because silence on a relationship is
  not a partial revocation: an old connection with a fresh opinion at its
  end competes at full weight. That is the sentence the row exists to
  make checkable.
- **Level three is the fold, seen.** A step shows one face and the row
  above it said two opinions; this screen is where those two are named,
  counted and dated, and the note says the rest in the reader's own word
  — the same adding up the pad already shows them as their current
  opinion.
- **Level four is the honesty case's floor.** The signed records, their
  identity keys in mono, and the line that is the whole point: *These
  records are public. Anyone can run the same sum and land on the same
  number.* A drill-down that stopped at a summary would have asked to be
  believed.
- **The numbers here are not pairs, so they paint in both readings.** A
  score and a path's contribution have no glyph that could carry their
  magnitude, exactly as the Feed score itself has none (§13, *Geek
  mode*). The pairs on these boards — a step's opinion, a record's own —
  are `StanceValue`s and follow the mode like every other pair.
- **The five parts are glue, not masters.** `ScoreOrigin`, `PathTrace`,
  `PathSummary`, `StepSummary` and `ActionLog` live in `_shared.jsx`: a
  master is a shape reused across PRODUCTS, and `_shared.jsx` is the
  shape reused across BOARDS of one surface (`CommentsSheet`'s rule).
  These five are drawn on five boards of one flow and nowhere else, which
  is the backlog item's own instruction. Nothing in them formats a value
  the system already formats — every pair goes through `StanceValue`,
  where the `cg-exact` span and its screen-reader twin are assigned — and
  every row a master already draws IS that master: the cover is
  `QuotedRow`, the step rows are `ContentRow`, the facts are `FactRow`,
  and the way down is `FactRow`'s own action slot. `PathTrace` is the one
  genuinely new drawing, and it exists because no master's leading slot
  holds a chain.
- **The aged-out state is content, not a tap.** The score opens the same
  board in the state the dust floor leaves a post whose every path's last
  opinion has decayed past it — `TagPageEmpty`'s arrangement exactly. It
  is not `EmptyState`: that master says "nothing here yet" and offers the
  action that fills it, and here something *was* here and nothing is
  owed.

**The opinions list is the profile's own page, mirrored onto content**
and ungated — everyone can check every post and comment, the way
everyone can read a profile's counts. Its rows are `StanceRow`, the
master the profile's opinions page uses, and its order mirrors
`ProfileStances`: strongest first, by the for-or-against value. That
order was read off that board rather than found written down anywhere;
mirroring it is the point, since a second surface sorting the same rows
differently would teach a reader the order means nothing.

- **Two doors, because a comment has no detail surface.** A post's is a
  quiet count line under its tags, in `TopicsLine`'s register — the
  affordance row is closed (opinion · score · comments · share) and
  nothing joins it. A comment's is its ⋮, where the row reads *Opinions
  on this* and sits after the acts and before the license.
- **The line drops away at zero and the menu row does not**, which is
  where the empty state lives. `SettingsHidden`'s rule: a tap that can
  only open an empty list is a tap spent on nothing, so a post nobody has
  answered says so by having nothing to open — while a menu row that came
  and went with a number would make the menu a different menu every time.
- **No face on the card's line.** A face on a post card already means
  "your opinion"; a second one meaning somebody else's would make both
  unreadable. The count is the whole line, and the count IS the list's
  length — `RefsSheet`'s discipline, and this sheet is the only place
  that number can be checked.

**The gate**: 171 → **178 boards**, 1287 → **1327 edges**, gaps 65 →
**43**, flows 61/58/3 → **63/60/3**. The 22 closed gaps are every `Post
Score drill-down (backlog item 13)` outcome in the graph — one per board
that draws a score — retargeted onto `FeedEntry`; it is the largest
single gap closure the canvas has had, and no item-13 gap remains. The
40 new edges are the five drill-down boards' 34 (their back arrows, the
three drill-ins, the more-paths unfold and five nav slots each), the two
sheets' three, and the three doors — `PostDetail`/15,
`PostDetailVideo`/20 and `CommentMenu`/5, appended rather than inserted
so no existing via renumbers. Two flows are newly declared and both
resolve: `trace-a-score-to-its-records` (a control start on the score,
`Reel` excepted — there the score is the detail door by ruling — with a
witness that reads the four levels in order to *arrival at RankRecords*)
and `who-holds-an-opinion-on-this`. **No flow changed status**: none of
the three blocked ones was blocked on item 13. The witness otherwise
moved only in origin lists — the four publish flows' `nav · New post`
start growing 39 → 44 boards as the five drill-down boards join the bar.

### The vouch-back ceremony — 2026-09-11

Item 58, jakob's line: "once you vouche back there should be some
indicator that you are now part of the network… it is the ceremonial
ending of you becomming part of the graph.. we could even think of a
nice animation for this.. you becomming part of the sky or sth". One
board, `VouchedIn`, between the signed vouch-back and the feed.
**Scope: an MVP-window stretch, and the first thing to yield** — the
entry flow is complete and correct without it, so if the window
closes the ceremony is what gets dropped, not a step the product
needs.

- **What the ceremony is ABOUT is the pair completed.** The vouch-back
  opens the way both ways; and a feed is ranked from the viewer's own
  outgoing opinions, so when it is the member's first one it is also
  the moment the borrowed view ends and their own begins. That, not a
  milestone badge, is the thing worth marking, and it lets the copy
  stay concrete while the headline carries the metaphor.
- **The sky is `SkyField`'s vocabulary, not a new drawing.** The
  Explore hero already draws the graph as weighted discs on hairlines
  in token colours ("Your sky — every account a star"). The ceremony
  is that at full bleed with the two things the moment owes: the
  reader's own point, and the one edge they just made. **The ground
  stays `surface`** — no night-black special case, so the board is a
  sky in the light theme too and the dark theme gets the night for
  free.
- **Two rungs of point, and `secondaryContainer` is not one.** Dark
  `secondaryContainer` is #743918, which sinks into the dark ground —
  a mid-weight point drawn in it comes out dimmest exactly where it
  should read brightest. Every sky spends `outline` (far) and
  `primaryContainer` (near, and the same #ef6c1a in both themes),
  plus `primary` for the point that outranks them; `SkyField` and the
  ceremony share the rule, so size and colour climb together on both
  grounds.
- **You are marked as a vantage, not ranked as a star.** The reader's
  point is `primary` with a hairline halo. It is deliberately not the
  biggest point: in the Sky size means "your own paths to it", and
  there is no path from you to yourself.
- **@mira carries her actual face**, the only identified point —
  the act being celebrated is reciprocation to a person. **Your edge
  is the one `primary` stroke, and it leaves your point for hers**:
  only viewer-rooted forward paths shape a feed, so the edge runs
  outward from you. The ranking law, drawn.
- **The field claims nothing about weighting.** Drawn strictly by the
  hero's "sized by your own paths" rule, a day-one sky would be one
  lit point and a dozen grey ones — true, and the wrong note for a
  welcome. So the picture is the network with the reader newly in it,
  and the WORDS claim only what is certainly true. Nothing is
  promised that a later Sky (item 16) would have to honour.
- **No back, no bottom bar, one way out.** The opinion is signed and
  on the record, so the screen it came from no longer exists and a
  back arrow would be a lie; a bottom bar would make a ceremony into
  a tab. `Go to your feed` is the single control, which is why the
  board carries exactly one flow number.
- **The motion is §4's one ACCEPTED EXCEPTION.** "Nothing inside an
  arriving screen animates" and "motion never performs" are the
  standing rules, and this is the single board that breaks them.
  Two things keep it inside the system's spirit: every
  duration and easing is an EXISTING token — no new motion value is
  introduced, and the phase offsets are sums of those same durations
  — and the motion is still deictic, showing where the reader's point
  came from and which way their edge runs.
- **The storyboard.** The sky ARRIVES ALREADY DRAWN: the other
  accounts and the hairlines between them are in the first frame, and
  nothing builds or assembles — the network did not wait for you.
  Only what is new animates. `t=0` the standard forward transition
  (300ms). `t=300` your point fades in and rises 24px
  (`--duration-long-2`, `--ease-emphasized-decelerate`); opacity and
  translate only — no scale, no bounce, no spring. `t=600` the halo
  expands from the disc's radius to twice it and stays
  (`--duration-medium-2`, `--ease-standard-decelerate`) — one move
  that settles, never a pulse. `t=900` your edge draws outward to
  @mira's rim (`--duration-long-2`, `--ease-standard`). `t=1100` the
  headline, subline and button arrive together on an 8px rise and
  fade — `cg-dialog-in`'s own entrance reused
  (`--duration-medium-4`, `--ease-standard-decelerate`), together and
  never staggered. It ends at 1500ms, and **a tap anywhere completes
  every phase at once**, so nobody is held.
- **Reduced motion: the resting state IS the end state**, which is
  what the board draws. The phases collapse to 0ms (the duration
  tokens already do this) and the screen arrives whole — edge drawn,
  halo full, words in place. A reader who asked for stillness loses
  the choreography and none of the content.
- **The copy is blessed** (jakob, the close-out round): *"You're part
  of the sky now."* over *"Your opinion on @mira is signed, and the
  way is open both ways. The feed you see from here is your own."*
  *Sky* is already product-facing, and glossed by the picture the board draws behind
  the words — the one place a metaphor leads, which it can afford to
  because the subline under it carries the content.
- **Wiring.** `VouchBackPad/4`'s vouch-back outcome lands on
  `VouchedIn` instead of `Feed`, and `VouchedIn/1` carries on to the
  feed. `vouch-back-for-your-inviter` gains the pad as a pinned
  waypoint and now ends on the ceremony's own edge, so the journey
  still concludes where it always claimed to. **§13's user-flow
  ruling is amended**: "a stance concludes where it was taken — the
  applicant's vouch-back is the one exception" still holds, and that
  exception now opens the ceremony, which opens the feed.

### The follow-up bundle — 2026-09-11

jakob's go on the review round's standing recommendations, taken in one
pass: one board, one law, and two sweeps.

- **Unsaving gets hiding's treatment.** `SavedUndo` is the Saved list a
  moment after a row's unsave — the row gone, the ones behind it moved
  up, and `Removed from Saved.` with `Undo` over them. It is drawn for
  `FeedHidden`'s reason: the act takes no dialog and leaves no mark, so
  a list one row shorter and one line saying so ARE the whole design.
  The line names the LIST rather than the row — the thing that went is
  the one the reader just pressed, and the list is the fact they may
  want back. Three rows are left and all three drawn kinds are among
  them, so the mixed list goes on reading as one. Nothing marks the
  space the row was in, and nothing happened to the post: it still
  stands in its author's chronicle, still ranks, still opens. The
  `Unsave` control moved into the shared screen helpers on the way —
  it is drawn on two boards now, and a control spelled twice drifts.
- **A hide row cannot say a name that is gone.** On a deleted author's
  post the reader's menu reads `Hide this account`; everywhere else it
  spells the handle. The ROW stays either way —
  hiding is a read-side comfort about an ACTOR, and a redacted actor
  still ranks into the reader's feed — so only the wording gives way.
  `ActorChip` composes it (`HIDE_ACTOR_LABEL`, beside
  `REDACTED_ACTOR_NAME`), because every menu that carries the row
  builds its label from an actor and a fallback spelled per menu is a
  fallback that drifts; `OverflowMenu`'s own rules send every such row
  there. **No board draws it**: the law and the master's fallback are
  the entire mechanism, and a second `ReaderPostMenu` differing in one
  word would be four-fifths of a board already on the canvas.
- **The score reads `Feed score` in prose, wherever prose says it** —
  `readme` in six places, `ExplainableNumber` across its three files,
  `PostCard`'s prompt, `ReelRail`, the score glyph's note in `Icon`,
  the media card, the core-loop prototype's notes, and `shell.mjs`.
  The graph's edge labels read `Feed score` too, and `flows.json` starts
  `trace-a-score-to-its-records` by matching that label, so a rename of
  the word moves the flow's key with it.
  Gap names were the same exception and no longer carry it — item 13's
  gaps closed with the drill-down.
- **The text clamp is founded on the square tile.** Eighteen lines at
  20px is 360px of words against a square crop's 358 at the card's
  content width, so a text post comes to rest at the neutral media
  shape rather than rising into the 4:5 wall a picture may take. The
  value did not move; what it is measured against is now written down.
- **The gate**: 178 → **179 boards**, 1327 → **1336 edges**, gaps hold
  at **43** and flows at **63/60/3**. The nine new edges are
  `SavedUndo`'s own — the back arrow, the rows, its five nav slots, the
  unsave that fires it again, and `Undo` appended last so no via
  renumbers. `Saved`/8 stops being a self-informing detour and becomes
  the advance onto the new board, which is the only edge that moved.
  The witness moved in origin lists alone: `SavedUndo` joins the four
  publish flows that start on the bar, whose `nav · New post` start
  grows 44 → 45 boards. No `.dc.html` but the new one changed — the
  sweeps are comments and prose, and the shared `Unsave` renders the
  markup it rendered inside `Saved`.

### The close-out round — 2026-09-12

jakob's rulings on the canvas he had just checked, taken as one pass:
one board reworked, one formatter conformed, and four laws that are
recorded rather than drawn.

- **A DELETED ACCOUNT'S PROFILE CARRIES A ⋮, AND IT HOLDS THE THREE ROWS
  THAT WORK ON A NAMELESS ACTOR** (jakob): `Save`, `Share this profile`,
  `Hide this account`. Saving keeps a pointer, sharing sends a page, and
  hiding acts on an ACTOR — the actor is still there, still authoring,
  still ranking into the reader's feed — so not one of the three needs a
  name. Mention is the row that does and the only one dropped: it stages
  a Reference at a PERSON and spells their handle in the composer. The
  hide row takes `ActorChip`'s own wording (`HIDE_ACTOR_LABEL`), so this
  page and every card the actor authored say the same thing, and the dot
  stands in the actions row at `placement="row"` — the band law, and the
  room Message vacated is exactly where the page's rare acts belong.
- **The sheet it opens is `ProfileDeletedMenu`.** `ProfileMenu` without
  Mention, its hide row on the redacted wording. Both boards draw one
  husk — `ProfileDeletedBody`, shared the way `ProfileOtherBody` is —
  so the pair differs by the sheet alone and the page cannot drift
  between them.
- **The comment menu carries no hide row, and that is deliberate**
  (jakob: "he clicks the profile of the commenter and hides from
  there"). Hiding is an act on an ACTOR, and a comment is the one
  surface where the actor is a chip rather than the subject — the
  reader's route is the commenter's profile, whose ⋮ is where the row
  lives. The post menu keeps its own: a post IS its author's act, and a
  feed full of them is what a reader is asking to be rid of.
- **The unsave snackbar rides `SavedEmpty` too, when the row that went
  was the last one.** One law, one drawn demonstration: `SavedUndo` is
  the list a row shorter with `Removed from Saved.` and `Undo` over it,
  and the empty board takes the same line over the same seconds. Drawing
  it twice would spend a canvas entry on a reader learning nothing —
  `FeedHidden`'s snackbar already taught the whole grammar.
- **The record key is inert for MVP** (the drill-down's floor,
  `RankRecords`). The keys are drawn in mono because a reader checking a
  claim needs to see them, and the copy control arrives with the
  spot-check tooling that would give a copied key somewhere to go. A
  control that fills a clipboard nothing can yet read is an affordance
  that promises a workflow the product does not have.
- **The negative arm of a pair is U+2212 MINUS** (item 59, §3
  *Numbers*). `formatDimension` swaps the sign through
  `Intl.NumberFormat`'s `formatToParts`, so the substitution touches the
  part the formatter itself names `minusSign` and can never reach a
  digit or a separator. MINUS carries the plus's width and sits on its
  optical axis; U+002D is a narrow word-joining dash, and a pair written
  `x / y` cannot afford one arm shorter than the other. `MoneyFigure`
  already spelled its outflows this way.
- **The ceremony's copy and its motion exception are accepted** (jakob:
  "i really like what you have done"). The headline is *"You're part of
  the sky now."* over *"Your opinion on @mira is signed, and the way is
  open both ways. The feed you see from here is your own."*, with `Go to
  your feed` the one control. §4's *"nothing inside an arriving screen
  animates"* and *"motion never performs"* hold everywhere else; this
  board is their one declared exception, and it stays inside the
  system's spirit by spending only existing duration and easing tokens
  and by staying deictic — the phases show where the reader's point came
  from and which way their edge runs.
- **The gate**: boards hold at **179**, 1337 → **1338 edges**, gaps 43 →
  **44**, flows hold at **63/60/3**. The one new edge is the deleted
  profile's ⋮, appended last so no via on that board renumbers, and it
  is the one new gap. The witness moved by a single line — the gap
  index gaining `ProfileDeleted/11`; no step rerouted, no flow changed
  status, and the three journey-stopping gaps are the three that were
  already there. Two boards re-rendered behind the formatter —
  `ProfileStances` and `PostOpinions`, the only two that draw a negative
  pair — and the profile flow map grew 3653 → **3709** to hold the new
  edge's line.

### The valence-six round — 2026-09-14

jakob's three rulings on the one-axis pad, taken together: the six
faces a pick with no second axis can reach become a real table, the
pad's default moves to the number the rest of the system already
names, and the seal stops showing a value nobody set.

- **THE ONE-AXIS TABLE IS `VALENCE_SIX`** (jakob), promoted out of the
  anchor-map card into `StanceReadout.jsx` beside the twenty: 😠 🙁 😕
  🙂 😊 😍 at ±0.90, ±0.55 and ±0.15, with glyph, word and position
  read from `STANCE_ANCHORS` so the six are six OF the twenty.
  `nearestValenceAnchor(pDirected)` is the lookup, and the card now
  draws its strip from the master rather than from a copy.
- **THE BANDS ARE WRITTEN, AND TWO EDGES ARE RULED.** The six bands
  are half-open intervals whose edges are the midpoints between
  neighbouring anchors, spelled rather than computed — derived at
  runtime the first comes out as −0.7250000000000001, and a band edge
  that depends on the order of a multiply is a face that depends on
  the platform. At a midpoint the MILDER face wins, the one nearer
  zero (±0.35 and ±0.725), and exactly 0.00 reads 🙂. Six monotone
  bands cover the closed axis; every comparison is a `<` or an `===`.
- **THE OWN-POST DEFAULT IS +0.10**, the value the rest of the system
  already names. `ComposePad` re-draws at it through the masters' own
  helpers — `formatDimension(+0.10)`, `nearestValenceAnchor(+0.10)`
  reading 🙂 "Nice", and the knob at `padPercentOf(+0.10)`, 55% of the
  field.
- **AN OPINION ON YOUR OWN POST IS ONE NUMBER** (jakob: "the second
  number isn't yours to set on your own post"). A post always reaches
  its author in full, so the seal's own-opinion row draws
  `OwnStanceReadout` — the same line as `StanceReadout`, a shorter
  number — and the three boards that spell that seal all take it. A
  citation's row keeps its pair: both of its values are picked.
- **THE GATE CHECKS THE ONE-AXIS FACE.** `check-readouts` reported it
  as an unverifiable note while no table answered for a pick that
  names no pair; the note is gone and the face is an assertion like
  the other five sites'.
- **The gate**: boards hold at **190**, the canvas at **199 files**,
  edges at **1342**, gaps at **43**, flows at **63/60/3**. Seven boards
  re-rendered behind the two readouts — `ComposePad` and the six that
  draw a compose seal (`ComposeSeal`, `ComposeSealUploading`,
  `ComposeLicense`, `ComposeSensitive`, `HelpDialog`, `NetworkError`).

### The cited round — 2026-09-14

jakob's rulings on the seal's References row, which drew exactly one
staged citation while the composer let an author stage ten. What a
seal owes is a read-back, and the round is about what a read-back does
when the thing to read back is a collection.

- **ONE CITATION IS READ BACK AS ITSELF**, unchanged: the name, and
  under it the pair signing it. One thing read back is the thing.
- **TWO OR MORE ARE READ BACK AS THEIR COUNT** — `N cited`, one line,
  blessed vocabulary. Three names stacked in an act row push the
  license, the stance and the sensitive rows off the screen at the
  moment the author is deciding whether to sign; ten make the seal a
  scroller. The threshold is two because two is where a name stops
  being the shortest true answer.
- **AND THE COUNTING ROW IS A DOOR.** A count nobody can open is a
  number the reader cannot check, which is the one thing this product's
  numbers may never be. `ActsCard` grew the door row — a FACT row
  (label, value, count) whose whole box is the control, `PickedRow`'s
  rule said for the acts card: no chevron, no trailing word, the
  accessible name (`Manage the 3 citations`) saying what opens — and
  carrying the count, because a name on a door replaces the door's
  contents and a listener would otherwise trade the number for the verb.
- **THE TRAILING COUNT IS THE CITATIONS, BARE** — `3` for three, the
  list's length and nothing else. The signature's own total is the
  card's footer and already says in words what it counts. The
  implementation's two improvisations conform to this: not a first
  citation's name standing in for the rest, and not "N actions" beside
  a label that already named what was counted.
- **THE SHEET IS `PickedSheet`'S SHAPE, NOT `RefsSheet`'S.**
  `RefsSheet` is the reading side, each row a way IN to what was cited;
  this is the authoring side, a staged collection managed in one place.
  `CitedSheet` is the new master — `StagedReference` rows whole, each
  control naming its own citation, `Cited · 3` as the title, `Done` as
  the way out. **It adds nothing**: a post's seal carries no add-rows
  by design, and a door out of it that grew a "+ Cite something" would
  hand the seal a stage's job.
- **THE SAME RULE GOVERNS THE REPLY SEAL.** It is about citations, not
  about which composer staged them, so the comment's seal counts at two
  and its door opens the same sheet — the way its License and Sensitive
  rows already open the compose page's masters. `ReplyCited`'s own
  single reading is untouched, and that board now renders
  `ReplySealBody` at one citation: the reply's seal is one markup in
  three states, byte-identical where it was already drawn.
- **The gate**: boards **191 → 194**, edges **1342 → 1372**, gaps hold
  at **20**, flows at **63/60/3**, the compose canvas at **75/200
  files** (63% headroom). `cite-something` reblessed — the control now
  stands on ten boards. `10 cited` measures 51.7px against a 205.5px
  slot, so the count never truncates and the ellipsis stays the single
  reading's business.

### The chats-routing close — 2026-09-14

Item 68 closed: every Message control routes to the coming-soon board
instead of a gap, and the message-someone flow resolves.

- **The gate**: boards hold at **194**, edges hold at **1372**, gaps
  **20 → 15**, flows **63/60/3 → 63/61/2**, the compose canvas
  unchanged at 75/200 files (63% headroom).

### The keyboard's own mechanism — 2026-09-14

The design system said nothing about the on-screen keyboard (census
2026-09-14). jakob's ruling: a guideline, platform standard, no new
boards.

- **The keyboard never covers the focused field.** Each platform's own
  mechanism does the work — Android's ime insets (the window resizes,
  the focused field scrolls clear), the web's default
  scroll-into-view. No custom panning, no reimplementation.
- **A bottom-anchored surface that holds a field rises with the
  keyboard** — a sheet with an input, the comment composer row. The
  bottom bar does not; the keyboard covering it is the platform's own
  behaviour.
- **The parked pad treats the keyboard as one more parking edge**, 16px
  above it while one is up — the existing parked-pad rule (§13 *The
  entry flow*) extended by one clause, not a new number.
- **A screen that does not scroll keeps the focused field and the
  primary action above the keyboard**; content above them may scroll or
  compress. The recovery-code screen — the deliberate trap with no back
  affordance — is the sharp case: the code and its confirm control stay
  visible.
- **Nothing animates beyond the platform's own keyboard transition.**
  The system adds no keyboard choreography. A pad parked over a sheet
  that holds a field needs no third rule: the sheet rises (rule two)
  and the pad re-parks above the keyboard (rule three), together.

### The MVP smalls round — 2026-09-14

Five of jakob's rulings taken in one sitting, unrelated to each other
and each small enough that a round of its own would have cost more in
ceremony than in drawing. What they share is that every one of them
closes a place where the canvas knew a rule and had never drawn it.

- **THE FEED SAYS ITS WAY BACK UP OUT LOUD.** The re-tap ladder's third
  rung — at a scrolled root, the tab's own slot goes to the top — is a
  gesture nobody is told about. On the feed it gets a control:
  `BackToTop`, a `Back to top` pill that rides in with the returning
  collapsing band, centred under it, doing exactly what the rung does.
  The two are one outcome reached two ways, which is why the graph gives
  them one destination. **The feed's and History's** (History is a
  feed, jakob 2026-10-05), because only a feed has a top the reader is
  trying to get back to, and only past 3 viewport-heights
  of depth, because shallower the returning band has already brought the
  top within a flick.
- **AND IT IS DRAWN OUTSIDE THE COLLAPSING BLOCK.** The region hides
  once half its own slot has scrolled past, so its threshold is a
  function of its own height: a pill placed among the band's children
  would move the band's collapse point on the feed alone, and a taller
  block is precisely what re-clamps the list — the leftover scroll
  reading back as "at the top", the region returning the instant it left
  (item 45.3, found by Android's W1 lane). The pill is positioned
  against the screen, takes no layout space, and sits at `zIndex` 19 to
  the region's 20 so it leaves UNDER the band rather than over it.
- **`FeedScrolled` IS THE TREE'S FIRST MID-SCROLL BOARD.** A feed drawn
  from its first card is a feed at rest whatever else is on it, and the
  pill would have read as furniture the feed always carries. The list is
  pulled up so the top card is entered mid-way and the one under it runs
  off the bottom edge.
- **THE SKY CARD BECOMES AN ANNOUNCEMENT.** `Explore`'s hero is not
  pulled — it stops being a door. The heading reads `The Sky — coming
  soon`, the CTA is gone, and `Explore/2`'s gap went with it: an
  announcement owes no design, so the tab's last undrawn promise stopped
  counting as one. The card stays because pulling it would rebuild
  Explore's first screen twice and lose the one drawing that says the
  Sky is this tab's biggest idea. `ChatsComingSoon`'s precedent as a
  card rather than a screen — chats had an icon whose tap needed
  somewhere to land; this affordance sits inside a card that can answer
  in place.
- **THE PAD'S ONE IRREVERSIBLE GESTURE GETS ITS MOMENT.**
  `SeveranceConfirm` had been a component and a card since the stance
  work and no board ever raised it. It is drawn on the PICK route — an
  ordinary pick that happens to net the bundle to (0, 0), confirmed and
  never refused, which is the rule the dialog exists for — with the
  component card's own arithmetic, because that arithmetic is forced:
  a raw sum past the clip cannot be walked back by one pick when the
  field stops at ±1, so the capped aside belongs to the explicit route.
  It sits on the patterns page beside `PadKeyAbsent`, the other board
  where the pad's overlay is the subject and the shell beneath is
  ground.
- **AND THE PAD THAT RAISES IT IS DRAWN.** `PadStanding` is the pad
  opened on something the reader has already said their piece about, and
  the first board in this tree to carry `Walk it back` — `StanceControl`
  draws the walk-away only once there are records, and the master pad is
  a first vouch with none, so every state past the first was represented
  by a board that could not reach it. The two boards sit side by side in
  flow order and share one fixture, so what the pad says is standing is
  exactly what the dialog offers to walk back. Both routes now leave from
  the pad that has something to sever: the pick case moved off
  `VouchBackPad/4`, which had been standing in for a case a first vouch
  cannot reach.
- **BOTH COMING-SOON SURFACES NAME THE PROMISE THE SAME WAY.** The chats
  screen read `Chats aren't built yet…` while the Sky card read `The Sky
  — coming soon`, and a product with two answers to one question teaches
  a reader nothing by the difference. The chats line becomes `Chats —
  coming soon. Your conversations will be here.` — the thing, an em dash,
  the promise, then one sentence of what will be there. `Coming soon` is
  the whole of what either promises: no date, no release, because both
  sit on the would-like list and the order can change.
- **THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK.** The reel round
  ruled that share is the first act to leave the action row when a phone
  cannot hold four, and no board drew the menu it moves into.
  `ReaderPostMenuNarrow` does, at **320** — the width is the state, the
  way `ViewerLandscape` is drawn rotated, and a 390 board with a row
  missing would be a claim about this phone made on a different one.
  Share LEADS the sheet: every other row there is a menu row by nature,
  share is the one that was a one-tap control a moment ago, and a reader
  who opens this ⋮ to share came for the row that moved. **The
  breakpoint is STRICTLY BELOW 360 of viewport width** — `<360px` on
  web, `<360dp` on android, the same semantics on both (jakob,
  2026-09-22, sharpening his 2026-09-17 ruling): under it the row
  sheds share and this sheet takes it; at 360 and above, the wide
  board is the state. The strict inequality is the ruling's point —
  360dp is a mainstream android width (the Galaxy class), and the
  narrow treatment is for the genuinely small, not the common. The board is drawn at 320 because that is
  the narrowest phone this system draws for, not because 320 is the
  threshold. Small phones are rare but real — everything must WORK on
  them, and masterful is not yet owed, so the answer is one number and
  one row that moves rather than a second design language.
- **THE CITATIONS DOOR SPEAKS ITS COUNT.** An `aria-label` REPLACES
  what it names, so the References row drew a count, hid the digit,
  paired it with "3 citations" — and then `Manage the citations` spoke
  over all of it. The name carries the count instead: `Manage the 3
  citations`, and at one `Manage the 1 citation`. One `citedRow` factory
  writes both seals' row, so the compose seal and the reply seal changed
  together and cannot disagree. Nothing is drawn differently.
- **The gate**: boards **194 → 198**, edges **1372 → 1404**, gaps
  **15 → 14**, flows hold at **63/61/2**. The reblessed flows are all of
  one kind — a start that now stands on one more board and lands where it
  always did.

### The topic round — 2026-09-14

jakob's rulings on what a topic is to a reader, closing the tag round's
last open item (46.5, "the follow gesture has no surface") and the
slice-3 remainders beside it. The round's premise is one sentence:
**there is no follow in this product.**

- **FOLLOWING A TOPIC IS THE STANCE GESTURE.** It is an **Affinity**
  record, Actor → Type, both parameters signed over `[−1, +1]`, bundling
  NET like every other stance — and a walk-back to `(0, 0)` is priced
  severance through the existing ceremony. No toggle, no one-tap follow,
  ever. A gesture that costs nothing on one surface and a signature on
  every other would teach a reader that the price is arbitrary.
- **HELD IS THE PREDICATE**: a topic is held while the viewer's netted
  bundle is not `(0, 0)`. The TOPIC FEED is narrower than that — it
  admits positive association only. A negative Affinity stands as a
  public record and stands on *Your topics*; its topic simply never
  enters a feed. The two rules are deliberately not the same rule, and
  only one surface shows the difference (the filter's own hint).
- **AFFINITY IS ITS OWN KIND** under the applicant once-each rule.
- **THE WORD "FOLLOW" NEVER APPEARS ON SCREEN.** copy-voice's ban
  (written for the notifications round) extends to topics and is now
  unconditional. Docs and dev vocabulary keep the word; boards and
  copy-voice may not. The list is **Your topics**.
- **THE TAG PAGE GAINS A STANCE ROW** — `StanceControl` `wide`, the
  profile's one-primary-action idiom, under the title and above the
  list. That position is the whole fix for item 46.5: the tag round drew
  this gesture on the header's trailing edge and jakob's review removed
  it, because beside the entrance post's context it read as that post's
  readout. A row of its own, above anything belonging to a post, cannot.
  `targetLabel` is the tag itself (item 46.1's mechanism, built for this
  page), and `STANCE_ANCHORS` is reused unchanged — **one gesture, one
  face table**. An Affinity is not a second kind of feeling.
- **BUT THE WORDS ARE THE FAMILY'S**, as a tag's and a citation's
  already are. The slots hold association and attraction
  (`layer1-interface.md` §9.5), so `StanceControl` grew `axes` — the
  field's own prop, passed through to the field AND to the alternates,
  because a slider naming the ends differently from the pad would make
  the accessible route a different question. It carries **six** words,
  ruled 2026-09-15: each axis's question and its two ends. Association
  asks `How much you like it` and runs `Dislike` / `Like`; attraction
  asks `How close you want to be` and runs `Far away` / `Close to me`.
  The field draws the four ends; the two questions reach the sliders,
  the typed fields and every spoken readout, because a route that heard
  one family's question about another family's record is the accessible
  route asking something the drawn one never asked. `TagPageHeldPad`
  draws the pad they belong to.
- **"YOUR TOPICS" IS A SUBPAGE OFF EXPLORE, NOT A SECTION IN IT.** The
  held set has no bound, and an unbounded list inlined in the tab would
  push the recents under the fold and turn Explore into a list page. The
  deciding argument is the filter's: a topic narrowing carries a way to
  the full list, and a door needs somewhere to lead. Explore gets a
  `ContentRow` `door` between the Sky and the recents, its disc marked
  with the `#` every topic already wears — `NodeMark`'s own rule, read
  by a second row master, because no icon set has a topic glyph and §5
  forbids drawing one.
- **THE ROWS ARE `ReferenceRow`, AND THEIR PAIR IS AN AFFINITY'S.** The
  row had decided the pair's family from its `kind`, which is right
  everywhere else: a topic row usually carries a TAG. Here the same kind
  carries a stance, so `pairFamily` names it outright and the kind still
  answers by default. The anchor's WORD comes with it, by the rule's own
  test — a stance anchor's word is true of a stance, and the citation is
  the one family it is withheld from.
- **NO PER-ROW REMOVAL.** The row opens the topic's page, where the one
  control stands; a × at the end of a list row is the affordance of a
  thing that costs nothing, and this costs a signature.
- **THE ORDER IS STRONGEST-ASSOCIATION FIRST** (ruled 2026-09-15): the
  order `ProfileStances` set and `PostOpinions` mirrored. Alphabetical
  is a shelf's order and this is a set of positions.
- **A TOPIC FEED IS JUST ANOTHER FEED SETTING**, so it is a section of
  the feed's own filter sheet and not a surface. One topic at a time —
  every other axis combines because combining is what those axes mean,
  while two topics widen a read rather than narrow it. The section
  offers only what is held FOR, and its hint says where the rest went.
  The door out of it is the full list.
- **THE TOPIC RIDES THE EXTRAS, NEVER THE HEAD.** Two reasons agree: the
  head spells KINDS and a topic is not one (`Tags` is already a kind and
  means the Type as ranked content), and the head is the half the
  collapse cannot take away. A tag name is the reader's, bounded only by
  the contract's 128 ASCII bytes, so a name the pill cannot hold has to
  be able to LEAVE the pill — which only an extra can.
- **INBOUND "CITED BY" MIRRORS THE OPINIONS ROUND** (item 55), and is
  explicitly **not** a `RefsSheet` extension: that count is the
  references list's length, and that law stands untouched. Two lists, by
  different authors, in different orders — folded together, neither
  number would be checkable. The doors are the opinions round's two: a
  count line on the post's detail, absent at zero, and the comment's ⋮,
  which stands at any count and is therefore the only way to the empty
  sheet.
- **AND IT IS NEWEST-FIRST — a ruled, deliberate departure** from
  opinions' strongest-first. An opinions list is a STANDING, a set of
  positions that hold, where the strongest is the one worth reading. This
  is a CHRONICLE of other people's acts: each one happened at a moment,
  no citation outranks another, and what a reader comes for is what has
  just arrived. Two lists that look alike are ordered differently because
  they answer different questions, and this line exists so the next
  reader does not "fix" one of them.
- **THE UNCHANGED-EDIT GUARD IS THE ACTS BATCH, NOT A BYTE
  COMPARISON.** An edit signs when there is something in its batch.
  Comparing bytes would refuse an author who typed a word and took it
  back, accept one whose only change is whitespace no record carries, and
  have to be re-derived on every platform. The batch is what is actually
  signed, and what the footer already counts.
- **SO THE SIGN GOES INERT AND THE FOOT SPEAKS THE ZERO.** The caps
  round's disabled idiom — the control stays, disabled, and the edge says
  it goes nowhere — with `Nothing to sign yet` under it saying why, in
  the one place the author's eye is already going. **At zero the footer
  stops being a button**, the menus round's rule: the acts sheet it opens
  would be empty. `ActsFooter`'s unruled singular closes with it —
  `1 thing`, taken from `ActsCard`'s blessed total rather than decided
  fresh, because the short form and the long form are one sentence at two
  lengths. **THE RULE IS THE FAMILY'S**: `EditCompose`,
  `EditComposeVideo`, `EditWords`, `CommentEdit` and `CommentEditVideo`
  all carry the same foot over the same batch, so all five carry the
  guard; one board draws it. Seal-shaped edits are out of this round —
  a seal's acts card is a different anatomy with its own totals.
- **The clip ruling, for context only** (implementation owns it): a
  detail clip stops at its end with replay; a feed clip loops.
- **The gate**: boards **188 → 194** (`TagPageHeld`, `YourTopics`,
  `FeedTopic`, `CitedBy`, `CommentCitedByEmpty`, `EditComposeUnchanged`),
  edges **1372 → 1429**, gaps hold at **15**, flows hold at **63/61/2**
  with **2** journey-stopping — every new board joins an existing
  control-selector start and none of them reroutes a flow, which is the
  whole of the re-blessing diff. The compose canvas sits at **77/200
  files** (62% headroom), the feed at 55/200. Reachable filter summaries
  **325 → 370** with the topic axis enumerated at three states, **0**
  over the band's 154px, and the widest reading unchanged at
  `Chats · text · + removed`, 153.9px — the new axis costs the pill
  nothing, because a topic that will not fit leaves the summary instead
  of stretching it.

### The viewer-grammar close — 2026-09-15

Two rulings from the census fabric that had no design home until now
(backlog item 83; the clip half surfaced by the implementation loop's
viewer lane).

- **A detail clip stops at its end and offers replay; a feed clip
  loops.** jakob's reasoning, kept whole: "it also seperates once again
  from vertical videos that are to be watched in the reel scroller. (we
  have reels (insta) and videos (yt) in one platform and they are
  different medias so i think the sharp differences are good)". The
  stop belongs to the reel-vs-video split, not to playback plumbing: a
  looping detail clip would blur the one line the two medias keep
  sharp.
- **The pinned clip's chrome tap stays platform-native.** Web opens the
  viewer only while the transport chrome is up — a tap with the chrome
  hidden reveals it first, else the transport would be unreachable
  under auto-hide; Android, which never hides the transport there,
  takes the tap directly. Ruled deliberate when the implementation loop
  queued the asymmetry: each platform keeps its own player's reflex,
  and one grammar forced across both would break the reflex on one of
  them.
- **The drawn edge offsets are the inset-zero case.** Boards draw a
  notchless 390×844, so the viewer's X at the top and the 16px gesture
  zone at the bottom (*the reel round*) sit exactly where a real phone
  spends its system insets. On a device the two offsets STACK ON TOP of
  those insets rather than being measured from the screen's edge — what
  the boards draw is what remains when both insets are zero. A rule and
  not a token: `--safe-area-top` stays retired.

### The tag-page smalls — 2026-09-15

Three items the topic round left standing, all about the tag page and
none of them needing a board. Ruled by jakob the same day.

- **The no-rename rule names the OPINION's parameters.** §3 forbade
  anything but `For or against` and `How much reaches you`, which three
  record families already contradict — a tag's pair editor, a citation's
  field, an Affinity's. The rule was right and its noun was wrong. §3
  and copy-voice now carry the scope: the control owns the geometry, the
  record family owns the words. A tightening pass, not a decision.
- **A guest on the tag page is not special.** Any reader who taps a tag
  reaches the page — a connection to it or none — and sees what is
  tagged. The only thing a guest lacks is an opinion of the topic, so
  the stance face wears the no-opinion 🫥 and the borrowed vantage
  (genesis, for a bare arrival) ranks what they read, feed scores
  included. `TagPage`'s three stance faces take the `GuestGate` outcome
  `Reel` already spells for a shared board; `TagPageHeld` takes none,
  because no guest can hold a topic. No guest board of its own, by the
  stream ruling. An applicant may stage one of each kind here, the
  Affinity among them — a feel of belonging before the vouch — and the
  applicant boards already answer an exhausted kind, so the page needs
  no wiring of its own for it.
- **Back from the tag page is history.** Back to where you came from,
  and the label names it: `Back to Explore`, `Back to Your topics`,
  `Back to feed`. A shared URL with no history behind it falls back to
  `Back to Explore`. This replaces the tag round's link to Explore — a
  second route to the page turned that link into a skip over the place
  the reader actually stood. The whole family takes the `back` terminal;
  the boards keep drawing `Back to Explore`, the cold entry's state
  being the one that stands with no route behind it.
- **And the origin gets a noun, from a table** (jakob, "as
  recommended"). A label that names where the reader stood needs one
  word per place they can have stood, or the rule is only three
  examples and a guess. The table is built from the page's ACTUAL
  arriving edges, so it is closed rather than open-ended — a named
  surface keeps its name, and everything else is named by what it is:

  | Where the reader came from | The label |
  |---|---|
  | Explore, at rest | `Back to Explore` |
  | Explore, mid-query | `Back to the search` |
  | Your topics | `Back to Your topics` |
  | the feed, in any of its states | `Back to feed` |
  | a post, through its tags-and-references sheet | `Back to the post` |
  | a comment's chips, in the thread | `Back to the comments` |
  | a profile's posts | `Back to the profile` |
  | History (jakob 2026-10-05) | `Back to History` |
  | another tag's page | `Back to #<thattag>` |
  | nowhere — a shared URL | `Back to Explore` |

  Three of those want a word about why. **The feed's many states are
  one noun**: `Feed`, `FeedScrolled`, `FeedNarrowed`, the applicant
  shells, `Main`, `KeyElsewhere` and the rest are the same feed with a
  setting or a band on, and a reader who scrolled three screens did not
  stand somewhere else. **A sheet is named by what it is a sheet of**:
  the tags-and-references sheet is the only route from a post detail to
  a tag page, and back returns the post with its sheet — `Back to the
  sheet` would name the layer instead of the place. **And a tag page
  reached from a tag page names the tag**, because `Back to the topic`
  would be true of the page the reader is standing on too.
- **The guest close, ruled the same evening.** Guests reach every
  reading page and it is always the same: the stance face wears the
  unset 🫥 and the scores come from the genesis vantage. So every
  guest-reachable stance face carries the `GuestGate` outcome on the
  face itself — `ReplyEntry`, `FeedGallery`, `PostDetail`,
  `PostDetailVideo` and `ProfileOther` join `TagPage` and `Reel` — and
  the arriving-edge spelling (`Main`/`FeedBare`'s author chips carried
  "acts join-gate" as a note on the way in) is retired: one fact, one
  idiom, on the face that gates. `RefsSheet` draws no stance face and
  carries nothing. `YourTopics`' back arrow takes the tag pages'
  history ruling with them — the feed filter is its second route, and
  the Explore link was the same skip.
- **The gate**: no board added and none redrawn — **194** screens
  render as before, edges hold at **1461**, gaps at **14**, flows at
  **63/61/2**. Eight outcomes join existing rows and
  two destinations become terminals, so `flows.resolved.json` is
  byte-identical and nothing needed re-blessing. Reachable filter
  summaries hold at **370**, **0** over the band's 154px, widest
  unchanged at `Chats · text · + removed`, 153.9px. The maps and the
  feed canvas manifest follow the edges.
### The Affinity pad round — 2026-09-15

The topic round left the Affinity family words nobody could look at and
a pad nobody could open. This round rules the words and draws the pad.

- **THE FAMILY'S SIX WORDS, IN THE PLAINEST READING.** jakob:
  "this is about your stance towards tags right? sooo we have how much
  you like a tag and how close you wanna be (how often / how much you
  want to see contents with this tag) we need to find easy words for
  that" — and then the words themselves, "i think this wording will
  just be easier to grasp". Association asks **How much you like it**
  and runs **Dislike** / **Like**; attraction asks **How close you want
  to be** and runs **Far away** / **Close to me**. Ease of grasp is the
  deciding argument: the pair names two things a reader already knows
  they feel about a topic, and needs no gloss to be answered correctly
  the first time.
- **AN AXIS'S QUESTION TRAVELS WITH ITS POLES** (backlog item 79). The
  poles had moved to the record family and the two axis NAMES had not,
  so a screen reader on a topic's pad heard the opinion's questions —
  `For or against`, `How much reaches you` — about a record that is not
  one. `axes` now carries both: the field draws the four ends, and the
  questions reach the sliders, the typed fields, the severance confirm
  and the three spoken readouts. One object holds a family's words, and
  the drawn route and the accessible one cannot ask different questions.
- **AND THE PAD IS DRAWN** (backlog item 78). `TagPageHeldPad` is
  `VouchBackPad`'s anatomy over the tag page with the topic held —
  `PadStanding`'s four controls, the family's words at the edges — and
  changing all six words had until now moved not one rendered board,
  which is what a canvas review cannot catch. It is also the only board
  where the way out of a held topic is visible: held, the pad carries it,
  and it is the same ceremony every held record has, at this topic's own
  price. The row cannot show it and *Your topics* deliberately offers no
  per-row removal, so without this board the door existed in the code
  and nowhere on the canvas.
- **The gate**: boards **194 → 195** (`TagPageHeldPad`), edges
  **1461 → 1466**, gaps hold at **14**, flows hold at **63/61/2** with
  **2** journey-stopping — the new board joins the topic row's existing
  edge and reroutes nothing. The feed canvas sits at **57/200 files**
  (72% headroom). Reachable filter summaries hold at **370**, **0** over
  the band's 154px, widest unchanged at `Chats · text · + removed`,
  153.9px: a parked pad adds no filter reading.

### The invites round — 2026-09-15

The last gap off a root page. `Profile via 7` had pointed at "the invites
screen (not designed)" since the profile round; seven boards close it,
and closing it forced the mechanic itself to be ruled rather than
inherited. Ruled by jakob the same day.

- **The screen has two halves and they must not look alike.** Staging is
  free and revocable — a link is a thing the reader made, revoked with
  one quiet word, and nothing about it touches the record. Vouching is
  signed and priced. Drawing them in one register would let a reader
  reach the second while thinking they were doing the first, which is
  the only way this mechanic can hurt someone.
- **Approving IS the vouch (jakob), so approving happens on the pad.**
  The row opens `StanceControl`, parked open at the standing default,
  and `Set` signs the approver's Opinion toward the new Profile. A button
  labelled "Approve" would have hidden a signed, priced stance behind a
  word that sounds like moderation. `ApprovePad` is `VouchBackPad`
  mirrored: the handshake has two halves and the tree now draws both,
  with the same master, the same anatomy and the same low defaults.
- **No `Walk it back` on it.** That control exists where there is a
  bundle to undo, and a first vouch has none — nothing has been signed
  toward this person by anyone, because their Profile did not exist
  until this act made it possible.
- **The prefill is gone from the whole mechanic (jakob).** A link used
  to carry suggested stance values for the issuer's eventual Opinion.
  It asked for a number at the moment the reader knows least, about
  somebody who did not exist yet, and the answer was re-asked at
  approval anyway. The opinion is picked once, on the pad, when there is
  a person to have it about. `invitations.md` §4 and `api-spec.md`'s
  `InviteLink` still described the prefill when these boards were drawn
  and are being rewritten to match the ruling; no surface in this tree
  ever drew one.
- **Single use is the default (jakob).** A targeted invite is the
  ordinary one and the safe one — a leaked link stages at most one
  stranger — so the default sits where a reader who changes nothing is
  least exposed. The switch is worded as the RESTRICTION, `Only one
  person can use it`, which is why that row carries no status line: the
  label already says what ON does, and what OFF does is the group's
  footnote.
- **Two decisions on the create sheet and no third.** Who may use it,
  and how long it lives. Expiry is a three-row chooser stacked over the
  sheet — `24 hours · 7 days · 30 days`, no custom date: a calendar here
  would answer a question nobody asks in months, and it would be the
  third decision the sheet was kept clear of.
- **The capability has one shape on screen, and it is the link
  (jakob).** `auth.md`'s *Link URLs* makes the id the capability and
  the product's own `extractInviteId` reads a bare one out of whatever
  is pasted — but that is a TOLERANCE at the door, not a second way to
  invite somebody. `InviteCreated` therefore serves the link alone,
  mono and whole, with `Link copied` as its one snackbar, and the entry
  door still says `Paste your invite link` because the field accepting
  a pasted link is the whole of what a reader has to know. Two
  spellings of one capability made the sender choose at the moment they
  were trying to send, and the choice bought them nothing: the same
  door opens either way. The word **token** never reaches the screen.
- **The card is the wallet's.** An invite link and a payout address are
  the same reading problem — a long string nobody can check by eye, held
  whole — so `PayoutAddress` draws both. Only its copy button's
  accessible name had to open up (`copyLabel`): a button announcing
  "Copy the address" over an invite link lies to the one reader who
  depends on it.
- **Revoking has no dialog and no Undo (jakob).** None could be honest:
  nothing un-revokes a link. The card leaves with a snackbar, and it
  never touches applicants already staged through it — they stay
  approvable, because closing the door is not the same as turning
  someone away at it. Dead links leave the list entirely; what is on
  screen is what can still be used.
- **Closing an application is a dialog, and it deletes nothing.** The
  applicant staged service-side, so there is no act to undo and no mark
  to leave. The person keeps the account they made and keeps reading
  with it. The safe action is filled and holds the right-hand slot
  (§11), there is no `error` colour — `SeveranceConfirm`'s own rule —
  and the way back is named rather than offered: a fresh link puts the
  same person back in this list.
- **The queue is ordered by waiting, never by readiness**, and the
  board draws that: a nine-day application still short of its key
  stands above a three-day one that is ready. The section is
  `Applications` and not "Waiting on you", because only one of those
  rows is; who is waited on is the row's own second line. An applicant
  wears a monogram and never a picture — there is no Profile to carry
  one until the approval lands.
- **A staged applicant now notifies, and it is the eighth kind.** It
  passes the set's own test: somebody else acted — the applicant
  attached their key, the second of the two proofs — and the act
  reached something with an owner. Nothing else can tell an inviter
  this, and a staged applicant nobody approves is the one failure mode
  the mechanic has.
- **The Invites row wears the bell's dot (jakob: the inviter must learn
  someone is waiting).** A dot and not a count, the bell's ruling reused
  rather than a second badge vocabulary invented beside it: the button
  says something is waiting, and the list two taps away is where a
  number means anything. Its accessible name changes with it.
- **The inviter reward appears nowhere on this screen.** It is real and
  it is permanent, and putting it on the surface where a reader decides
  whom to vouch for would price the decision in the one currency it
  must not be priced in.
- **A rejection is one member's refusal, not a verdict (jakob, the same
  day, extending the round).** Closing an application takes it out of
  THAT inviter's queue and tells the applicant; the account persists,
  reads on, and can be vouched in by anybody else. So the dialog names
  both effects — it leaves your list, AND they are told — because a
  reader not told the second is pressing it as though it were private,
  and it names the recovery in the same breath so the first does not
  read as expulsion. Deletion is not mentioned anywhere in the flow,
  because nothing is deleted anywhere in the flow.
- **The ask link is the invite link's mirror, and the mirror is exact
  except where it must not be.** Same card, same copy control, same
  mono block — but an invite link points at a SLOT its issuer opened,
  and an ask link points at a PERSON. So it has no expiry, no slot
  state, and no limit on how many people it goes to: it stands for as
  long as somebody is waiting to be let in, and every member who opens
  it is answering one standing question. `ApplicantRejected` is
  `ApplicantWaiting` with the card flipped and nothing else taken away
  — the shell, the band, the borrowed feed and the bar all stay, which
  is the drawing that says the account survived. Its card cannot be put
  away: the sibling earned its `Got it` by naming something to wait
  for, and this one names the only route forward there is.
- **Answering an ask link is the same act as approving, so it is the
  same pad.** `VouchAsk` reuses `ApprovePad`'s `StanceControl` and its
  note rather than forking either — which is why that note now takes a
  handle. A member answering a link is doing exactly what the inviter
  would have done from their own queue, and drawing it as a second kind
  of act would invent a difference the mechanic does not have. The
  screen names no inviter and no reason: who turned somebody down is
  theirs to tell, and an ask link carries a person, not a case file.
- **Applications are grouped by the link they came through, and the
  group carries a batch close** (jakob: "if someone bots us from the
  start it would be nice to have.. we add batching.. batched by invite
  link?"). A leaked link is the failure mode this queue has, and it
  arrives as a burst that is really one event; flat, the reader closed
  it one row at a time and could not see it was one event at all. The
  batch act sits on the GROUP HEADER and not on the link card, because
  `PayoutAddress` is allowed one inline word and a live link already
  spends it on `Revoke` — and the header is the better home anyway,
  since the count is right beside the gesture that acts on it. Grouping
  does not reorder the queue by what the reader can act on: groups sit
  by their oldest waiting application, rows by age inside them.
  `RejectAllConfirm` is the confirm, and it puts the COUNT in its
  title, because the count is the risk — it names no handles, since a
  dialog that grows with the burst stops being readable exactly when
  the burst is worst. The sweep passes over applications already
  closed, so the number named is the number that changes. One waiting
  gets no batch control: `Close all 1` is the row's own close with a
  longer name.
- **The link lands on the page, not on the pad** (jakob). A reader who
  taps a link has arrived, not asked, and a stance is opened by the
  reader's own gesture everywhere else in the tree; an arrival from
  outside the app is the last place to make the exception. `VouchAsk`
  is the landing with the affordance closed and `VouchAskPad` the state
  past the press. It is a board rather than a wire to `ApprovePad`
  because the queue's pad cancels and signs back to `Invites`, which is
  what sits behind *it* — sending an ask-link reader to the invites list
  to say "not now" would answer a question they never asked.
- **`PayoutAddress` grew `bare`.** The rejected applicant's ask link,
  held inside the card whose words explain what it is for, wants the
  card's anatomy without the card: `SettingsGroup`'s shape, and
  `SettingsGroup`'s reasoning — a container inside a container of the
  same tonal rung is two containers saying one thing.
- **The ninth notification kind is the eighth's twin.** A mechanic that
  notifies a yes and says nothing about a no leaves the applicant
  waiting on something that already stopped happening, which is the one
  cruelty this flow can commit by omission. The two rows together are
  the ruled recovery path drawn as history: `@kel closed your
  application` fourteen days ago, `@mira approved your application`
  twelve — one member declining is one member declining.
- **Two flows, not one.** The round meant to declare a single inviter's
  journey — make a link, share it, approve the person. The graph refused
  it honestly: a sheet's scrim is a `back` edge, the search walks
  `advance` alone, and after handing the link to the platform's share
  sheet the reader genuinely leaves and comes back days later when the
  notification arrives. `send-someone-an-invite` ends on the share,
  `vouch-an-applicant-in` ends on the signature, and the extension's
  `answer-someones-ask-link` ends on the other one. The seam between
  them is time — and, for the ask link, two different people — not a
  missing design.
- **The gate**: 194 → **203 boards**, 1461 → **1511 edges**, gaps 14 →
  **13** and flows 63 → **66 declared · 64 resolved**, the two blocked
  ones unchanged. The gap count falls because `Profile/7` closed and no
  new one opened. The witness moved only where it should: three flows
  added, the new boards joining the index, `Profile` gaining two of
  them, `ApplicantRejected` joining the origin lists every shell board
  with a post card and a bar belongs to — the way `FeedUnread` did —
  and no existing flow rerouted a single step.
### The seal's tags and the pad's words — 2026-09-15

Three defects of the same kind: a drawing that stops being true at the
edge of what it was drawn for.

- **THE SEAL'S TAGS ROW COUNTS WHEN THE CHIPS STOP FITTING.** jakob:
  "i just noticed that our boards dont have a design for the seal with
  more tag chips (so that the row is to full). please have it the same
  as with references i guess?" The row drew chips into a slot that
  clips them, so a well-tagged post read as two and a half pills beside
  a count saying seven. Past what the row holds it now takes the
  References row's own shape — **"7 tags"**, one line, the row a door
  named **`Manage the 7 tags`**, the count folded into the name because
  an `aria-label` replaces everything inside the box it names. The noun
  is the reader's: a `#name` is a tag on screen and a topic in the
  record. `ComposeSealTagged` draws the state; every seal drawing tags
  through the shared body carries the rule. Where the door LEADS is the
  one place the two rows disagree — a citation's opens a sheet over the
  seal, a tag's walks back to the details stage, the composer having no
  staged-tags sheet to open (backlog item 95). That the system now
  folds a tag list two ways — the feed's line keeps what fits and
  counts the rest — is item 96.
- **THE PAD'S POLE WORDS LEAVE THE FIELD.** jakob: "the words 'against'
  and 'for' are on the axis... we either have to make it so the dot is
  clearly visible and looks nice even when below the words or we need
  to move them of the axis." They sat at the four edge midpoints, which
  is exactly where the knob goes when the value reaches that pole, and
  the knob is an opaque disc drawn after them: at the top pole the word
  disappeared under it whole. Making the knob read better cannot fix
  that — the drawn field IS the value space (§8.3), so the knob travels
  every point a word could occupy, and inside the field any word is
  reachable. The words take gutters around the field and nothing but
  dead ground stays inside it. The component sizes the field to what
  the ring leaves, so a caller places one box; the hand-drawn one-axis
  field on `ComposePad` follows the same rule rather than patching
  itself.
- **AND THE PICKED VIDEO CAN BE TAKEN BACK.** jakob: "i can remove
  images but not the video if i want to change my choice." The pick
  step's tray always carried the clip's ×; the DETAILS stage did not,
  by a ruling that a clip is read-only there and the pick step is one
  Back away. A picture leaves the post from that same stage through the
  row that opens its manager, so the asymmetry was real: what an author
  most wants to revise is which clip. The tile now wears the tray's own
  × — one gesture for one item, no Show all sheet, because one clip is
  not a set — and it gives back the step that takes picks.
- **The gate**: boards **195 → 196** (`ComposeSealTagged`), edges
  **1466 → 1476** — nine for the new seal, one for the clip's × — gaps
  hold at **14**, flows hold at **63/61/2** with **2** journey-stopping.
  The compose canvas moves **78 → 79/200 files** (61% headroom).
  Reachable filter summaries hold at **370**, **0** over the band's
  154px, widest unchanged at `Chats · text · + removed`, 153.9px. Ten
  pad boards re-render on the field's new anatomy and no seal but the
  new one moves a byte.

### The re-review — 2026-09-15

Six rulings off jakob's pass over the round above, and one of them
overturns a ruling from the same day. Nothing here is a new surface
except the board the last one needed.

- **A system card is marked on its edge, not washed through its ground
  (jakob, re-reviewing the first attempt: "wash of the box is not what i
  meant.. this just looks bad.. i was thinking about some gradient or
  sth.. making it obvious that this card (and potentially all system
  cards) are cogra cards you should act on and not a normal part of the
  feed").** A tint over the whole card lands on the half a reader is
  trying to read through, and a 7% brand wash on a warm neutral ground
  is indistinguishable from a card somebody emphasised. So `TaskCard`
  takes the feed card's own ground back and wears `--ring-task`, a 2px
  gradient edge at the brand wash's own 140° angle running the brand's
  three warm fills — `primary`, the seed, `secondary-container`. It is
  the story ring's grammar, which is the one decoration a reader
  already reads as "the system put this here", and it is a mark no post
  card in the column can wear. The corner mark stays beside it: a ring
  says a card is marked, only the mark says by whom. The recipe takes
  roles rather than hex, so one definition serves both themes.
- **A tag is born of a connection, so the empty page is the page after
  one (jakob).** "a tag is born by its connection to sth.. it does not
  exist before its first connection.. so there is no page of tags that
  dont have posts yet.. i guess if someone unbind the post we have an
  empty page.. (its history would not be empty tho) but then we should
  add the stance here. no reason for it to not be there."
  `TagPageEmpty`'s premise is rewritten to that: the list is empty and
  the topic's history is not. And the page gains the topic stance row,
  which **overrules item 81's clause that the empty page wires no face
  at all** — an Affinity toward a Type needs no Tag records to exist
  first, and a reader standing at a name with nothing under it is not a
  reader with nothing to say about it. The row is `TopicStanceRow`, one
  anatomy lifted out of `TagPageBody` so the two states cannot drift
  apart, and the wiring is the populated page's, `GuestGate` included.
  The line keeps the present tense — `Nothing carries this tag right
  now` — because `hashtag(name)` still resolves a name nothing has used,
  and a sentence about what was unbound would lie to that one arrival.
- **`Back to feed`, everywhere (jakob).** The drawn spelling wins over
  the written rule, which is the right way round: the boards are where a
  reader meets the words. The feed is a named surface — Explore,
  settings — and not a common noun like the post or the wallet, so it
  takes no article and the rest of the origin table is untouched. The
  Reel's accessible name changes with it and copy-voice states it once.
  The sweep found no third spelling: `DetailHeader`, `Removed` and both
  shipped apps were already drawing it this way.
- **A surface names the approver, never the role "inviter" (jakob):**
  "yeah sweep — the other version where you can choose your inviter is a
  super corner case that will probabely never happen." `invitations.md`
  §2 fixes the inviter at the JOINER's own back-edge, so an applicant
  has no inviter yet — only a member whose approval is waited on. The
  prose says whose: `All set — waiting on @mira` over `Their approval
  brings you in`, `Waiting on @mira` on the profile card, the approver's
  act in copy-voice and on `ApprovePad`, whose reader may have issued no
  link at all — which is what `VouchAsk` proves. The rule is about the
  WORDS: where one member issues the link and approves through it, which
  is the ordinary case, the fixtures rightly show one person. §2's
  freedom to reciprocate anyone stands, and stays off the screen — no
  surface offers a choice of inviter, because no reader is asked to make
  one.
- **A person is walked back; a topic is disconnected from (jakob).**
  Three tidier variants of the same register were refused in one
  breath — "nah thats all to complicated for users.. instead of walk
  back we could just call it 'disconnect' or sth like this. and then we
  can say 'no opinion towards #saltmaps' or sth similar.. we want human
  wording not this nerdy stuff!" — and that last clause is the direction
  the ruling leaves behind, not just its justification. `Walk it back`
  is a sentence about a PERSON: you walk back something you said to
  somebody, and a reader who liked a topic made it no promise. So the
  two families part at the way out exactly as they already parted at the
  axis words: the topic pad's control is `Disconnect`, its dialog asks
  `Disconnect from #saltmaps?`, and what it leaves reads `No opinion
  towards #saltmaps`. Persons keep their family untouched — jakob
  objected to the topic's wording and only to it.
- **The mechanism is the poles' own, one layer further down.** A family
  already names its axes through one object; it now names its severance
  through the same object, and where it names none the control's own
  words stand. The lines that carry a name or a figure take them as
  arguments, so a family's object holds no target — one constant serves
  every topic page there will be. The sweep reaches the four places the
  words surface: the pad's standing control, the confirm dialog's title,
  sentences and button, the spoken and drawn readouts of a bundle at
  nothing, and the help panel's fourth line, which teaches the way out
  and would otherwise have taught a topic reader the other family's word.
- **The draft's shape is web's everywhere, and the blocked roll answers
  (jakob).** "yes web everywhere... maybe we should make the draft more
  prominent.. right now it is easy to just wonder why you cant act.. i
  guess clicking the images should also start the discard process (open
  the popup).. else people might just click the images and wonder why
  nothing happens." `ComposeDraft` already drew the state — this ruling
  changes it rather than creating it. Three things follow. The SHAPE is
  web's: the pick region under an unanswered draft is dimmed AND out of
  reach, pointer, keyboard and assistive tech together, where Android
  dims it and leaves it tappable. The DRAFT is prominent the way every
  other card the product speaks through is — it wears `--ring-task`,
  the same brand edge a `TaskCard` wears, because it is the same fact:
  this card is the product addressing the reader and the one thing on
  the screen that can be acted on. The dim beneath it stays at its
  blessed 0.55; the ruling asked for a louder draft, not a fainter roll.
  And the ROLL ANSWERS: a shield — one transparent control over the
  whole region, so the keyboard and a screen reader reach what the thumb
  reaches — raises `ComposeDraftDiscard`, the new board. Reaching past
  the draft is asking to discard it, so that is what the dialog asks,
  in `DiscardConfirm`'s family: the safe answer filled, no `error`
  colour, and both words carrying their object, because a bare
  `Discard` already stands inert behind the wash. The scrim is the third
  answer nobody has to spell. Android's divergence is implementation's
  to close (backlog 97).
- **The gate**: one board added — `ComposeDraftDiscard`, the only
  surface any of the six needed — and edges **1522 → 1527**: two wiring
  the emptied tag page's new stance row, three the draft's shield and
  its dialog. Gaps hold at **13** and flows at **66 declared · 64
  resolved · 2 blocked**, `flows.resolved.json` byte-identical, so
  nothing needed re-blessing: no journey was rerouted, only answered in
  more places. Reachable filter summaries hold at **370**, **0** over
  the band's 154px, widest unchanged at `Chats · text · + removed`,
  153.9px. The compose canvas takes the new board at **79/200 files**
  (61% headroom). Every board in the tree re-rendered, because two of
  the six moved a token and a component the whole tree reads.

### The detail-fold and reply-return rulings — 2026-09-15

Two rulings from the same evening that changed no drawing, recorded so
the next round can find them.

- **The detail keeps its fold, deliberately.** The measured state — the
  action row 103.5px below the visible column on the gallery detail,
  73.5px on the video detail — was put to jakob with the ordering and
  ceiling alternatives, and he ruled it as drawn: "detail view is about
  the details afterall, if the user wouldve wanted to go to comments
  directly he wouldve clicked it, and breaking the order (keeping all
  the posts contents as one entity) is bad. so nothing changes and we
  record this as a minor inconvenience." The true-shape round's trade
  extends to the detail knowingly; `PostCard`'s clamps-nothing rule
  stands; the card keeps its one order on every surface.
- **A signed reply returns the reader exactly where they were.** The
  `reply-to-a-post` flow's promised end — "the thread, the comment
  settling" — is the ruled behaviour, precisely: the sheet reopens at
  the same scroll offset, the new reply drawn on its PARENT comment in
  `CommentCard`'s reserved `children` slot wearing `PendingMarker`'s
  "Still settling", and a parent whose replies were collapsed behind a
  count EXPANDS on arrival — jakob: "show the content you just wrote".
  The same rule covers a comment EDIT ("editing sth and then not
  seeing the corrected version gives the user uncertainty if it even
  happened") and reads identically for a sheet raised from the feed:
  the return is a property of the sheet, never of the page beneath it.
  The navigation result carries two values — the scroll offset and the
  parent comment id. `ReplySettled` draws that landing: the sheet cut at
  its top edge by the kept offset, the parent's count expanded, the
  signed words in the slot the composer stood in.

### The sheets-and-video round — 2026-09-22

The sheet ladder gains its top rung and the fields in sheets gain a
size. jakob took the round's questions together and ruled them all as
recommended.

- **The tallest sheet is a class, and the class is a ceiling.** A
  sheet's top edge never rises above a **72px sliver measured from the
  top of the safe area** — on Android below the status bar and the
  display cutout, on the web from the viewport top. The rounded top
  corners keep a strip of the surface behind visible and no sheet ever
  touches the safe area: a drawer that reached the top edge would read
  as a destination, and a reader who cannot see what they left cannot
  tell one from the other. The comments sheet IS this class, asked for
  by name — `BottomSheet`'s `tallest`.
- **The ceiling caps the other classes rather than replacing them.**
  The 62% default and the raised 88% class both stand, each held under
  the ceiling: a percentage that would reach past the sliver on a short
  screen is clamped to it. At the 390×844 frame the ceiling stands at
  **772px** and the 88% class reaches **743**, so the cap binds on no
  board drawn today — it is the rule that keeps a class honest on a
  screen the boards do not draw.
- **A multi-line field in a sheet grows, and the sheet grows with it.**
  The field takes a line at a time as the writing needs one; the sheet,
  content-sized already, grows until it meets the ceiling; from there
  the field scrolls inside itself and the **Done row never leaves
  reach**. The design states no line count — the field's maximum is
  viewport minus chrome, derived by the implementation — and both
  platforms behave identically, because a writer who learns a field on
  one and meets a shorter one on the other learns the product is two
  products.
- **`rows` is a field's minimum, not its size.** A field given `rows`
  opens at that many lines and grows from there, which makes `rows={1}`
  the way to spell a field that starts as one line and does not stay
  one: the comment composer and the sensitive sheet's reason are both
  written that way. The three fields the law governs: the description
  sheet keeps its two-line opening, the sensitive sheet's **Why?**
  becomes a growing one-line field, and the thread's **Add a comment**
  becomes one too.
- **A sheet already at the ceiling takes the room from its list.** The
  comments sheet cannot grow — it is pinned at the ceiling — so the
  composer's growth comes out of the thread above it, which is what
  every chat app the reader already uses does: the words being written
  push the thread up rather than walking off the bottom of the screen.
- **Boards draw the minimum.** A board is one state and the state worth
  drawing is the field as the writer meets it, so every field is drawn
  at its `rows` — including the fields whose fixture is longer than the
  box, which keep drawing the length they claim and stating it in the
  late counter (`ComposeDetailsCaps`, `WordsBody`'s tail). Growth is
  behaviour, and behaviour that cannot be drawn is stated where the
  drawing is.
- **The gate**: **217 screens** and **1568 edges** both hold — the round
  changes what a sheet may do, not where the app goes. **38 boards**
  re-rendered: every sheet in the tree takes the clamped height, and the
  two fields that became growing ones are drawn on eight of them.

### The cover's tile, and the one duration — 2026-09-22

The same round's video half. The cover's mark had been built and drawn
without ever being written down, which is how a treatment becomes a
board's private habit; jakob ruled it as recommended.

- **A cover rides the clip's own tile.** The chosen frame is inset in
  the tile's **bottom-left corner** — a third of the tile's short side,
  never under a **28px** floor, behind a hairline ring, carrying its own
  framing rather than a miniature of the tile beneath it. **One
  attachment is one tile**: a cover standing beside the clip would read
  as a second thing the author picked, and they picked one thing. The
  corner is the one the "Cover" badge already owns on a picture, so a
  tray says *cover* in a single place whatever kind of body is in it.
- **Each surface carries the cover its own way.** The **pick tray**
  shows the inset, which is how a walk that can be walked backwards
  tells the author what the step behind them settled. The **edit
  stage** carries a *Cover* field section under *Video*, in both its
  states: the door *Add a cover* where none is chosen, the face and
  *Change the cover* where one is. The **compose details stage**
  carries only the door, and only for a clip whose shape skipped the
  frame picker; a clip that walked the cover step shows no cover
  section at all — its face rides the tile's inset, and the step is
  one Back away. A
  **reading surface** shows the cover as the card's still, and branches
  on nothing: whether that still was chosen or taken was settled while
  the post was written.
- **The duration badge is the composer's, and the detail has one
  reading.** `MediaThumb` draws the pill on an authoring tile of 80px
  or more, where an author is identifying a file among files. A reading
  surface draws no pill at either scale — presence on screen is the
  policy — and the one place a reader meets a clip's length is the
  detail's **transport**, where the total stands beside the elapsed the
  way the platform player writes it.

### The veil's scope — 2026-09-22

The two questions backlog item 10 had carried since the veil was drawn,
answered in the same round. The standing rules live in §9; this is where
they were settled.

- **A reveal is session-scoped.** It survives every move inside the app —
  jakob's own example: a post unveiled in the feed, a walk to a profile,
  and back to the feed, still unveiled — and returns on a full app close
  or another hard reset of the media. The decision belongs to the reader
  who made it rather than to the screen they made it on, and a session is
  the unit a reader can tell they are still inside of. Nothing about a
  reveal is stored, so none of it outlives the session or follows them to
  another device.
- **The reader's gradient is post-MVP.** The 0–10 severity setting is
  read as a single show-sensitive threshold — a veil either exists or it
  does not — and the range across which a reader accepts one kind of
  content and refuses another is built after MVP, not designed around
  now.

### The edit's return — 2026-09-22

- **A signed edit lands where a signed reply lands.** `CommentEdit/12`
  and `CommentEditVideo/12` reach `ReplySettled` — the thread reopened
  at the offset the reader left it, the corrected comment on its own
  card. The anatomy is the reply's and differs only in which card
  carries the marker, which is why the edit is owed no second board;
  what it was owed was the edge, and the two edges had still been
  landing on the thread as though nothing had been written. Backlog item
  85 closes with them.
- **The gate**: **1568 edges** hold — a repoint moves a destination, it
  does not add a journey — and the witness is re-blessed for one line:
  `edit-your-comment` now ends on `ReplySettled`, which joins the flow's
  boards and its endpoints. Flows hold at **66 declared · 64 resolved**,
  gaps at **13**.

### The post-MVP separation — 2026-09-22

The MVP board is done, and the next rounds are not MVP. Rather than let
the baseline absorb boards whose slice is nowhere near current, post-MVP
work is drawn apart — ruled by jakob the day the push round opened.

- **A post-MVP round is drawn in a tree of its own.**
  `designs/postmvp/` is a sibling of `designs/canonical/`, with its own
  `screens/`, its own `canvas.json`, its own `graph.json` and its own
  `_shared.jsx`. `designs/canonical/` and the four canvases stay exactly
  what they were: the MVP baseline, and the boards implementation reads
  from. A reader who opens canonical is looking at what is being built.
- **It is the fifth canvas** — `CoGra · Post-MVP rounds`, its own
  review surface, seeded by the same `gen-canvases.mjs` from the same
  kind of `canvases.json`. Five canvases now, four of them the MVP's.
- **The migration rule: boards move across as reviewed rounds**, when
  their slice becomes the work — not by being copied early and not one
  board at a time. And whatever implementation needs lands in canonical,
  always: a board the clients are expected to build is by definition
  current, so its home is the baseline. Nothing implementation needs is
  ever only in postmvp.
- **The pipeline takes the tree as a parameter**, which is the whole of
  the plumbing. `_build/trees.mjs` names the generated trees and nothing
  else does; `render-screens`, `gen-maps`, `gen-canvases` and
  `check-flows` loop over that list, each tree checked against its own
  canvas and its own graph. The ideation canvases stay off the list on
  purpose — they render only when named by hand, which is what keeps a
  frozen board frozen. Both trees share `components/` unchanged: one
  design system, drawn twice as far.
- **A board name is unique across every tree.** `flow-markers.mjs` is
  keyed by board name alone, so two trees with a `Settings` would stamp
  one tree's flow numbers onto the other's markup. The post-MVP boards
  carry their round in their names.
- **The gate**: canonical's output is **byte-identical** across the
  split — **217 screens · 1568 edges · 13 gaps · flows 66/64/2** all
  hold, and every board, map and manifest in the tree hashes the same
  before and after. A separation that moved the baseline would not be a
  separation.

### The push round — 2026-09-22

The first post-MVP round, and the first boards in the new tree.
`docs/implementation/notifications.md` names push and does not build it:
it is the **delivery of a row the list already holds, never a source of
one**, which is the fact every ruling below hangs off. Nine kinds, the
doc's own taxonomy. Backlog item 102.

- **A `Notifications` group, after Reading, with per-kind toggling
  (jakob).** Reading is where a reader says what the product shows them;
  push is that one step further out. The granularity is the strategy
  rather than a refinement of it: a channel a reader can only kill
  outright is a channel they kill, so the way to keep push alive is to
  make turning one kind off easy.
- **One row on the page, nine on a subpage (jakob).** The settings page
  carries a disclosure row reading its state back — the `Default
  license` grammar — and `PushKinds` carries the master switch and the
  nine kinds unclustered. A settings page is scanned; nine switches
  inside a group turn one line of the scan into a screen of it. And a
  clustering would be a second taxonomy to keep in step with the doc's.
- **The OS ask fires only from an explicit act, never at launch
  (jakob).** It has one home: the master switch on the push settings
  page. The one-time dismissible offer row at the top of the list is
  the door to that page — the tap lands where the choice is made, the
  way every notification row lands on its subject (jakob) — so on
  native, where a denial is **sticky**, the ask is never spent on a
  reader who did not reach for it, and on web the reader arrives at the
  browser's own dialog through their own deliberate taps. Dismissed is
  dismissed for good — an offer that came back would be the launch
  prompt with extra steps.
- **Push content is the drawn row, and nothing invented (jakob).** The
  title is the row's sentence (`@ada commented on your post`); the body
  is the row's second line where the row has one, and absent where it
  has none; the tap lands exactly where opening the row lands. The whole
  copy register applies out there too — sentence case, no exclamation,
  no counts, no emoji. A notification that said more than its row would
  make the tray a second product with its own voice.
- **Tray and badge are the platform's own, and no more (jakob).**
  Platform-default collapse, never a custom *N new* summary; **no
  numeric app-icon badge, ever** — the launcher's dot is the bell's dot
  at launcher scale, the same honesty the boolean
  `hasUnreadNotifications` already carries, and a number would be the
  errand the bell refuses to set. A foregrounded app suppresses the
  banner: the surface is already open. Prose law, not drawn.
- **The defaults, ruled kind by kind (jakob).** On: **comment on your
  post**, **application approvable**, **application approved**,
  **application rejected**. Off: **reply**, **mention**, **citation**,
  **opinion on your profile**, **invite landed**. What is on is what a
  reader is answerable for — their own post's comments, and the four
  moments an application turns; what is off is what the list holds
  perfectly well until they look.
- **Forward note: chat-message-received joins the on-set when chats
  ship.** A message addressed to one person and waiting is the clearest
  case the on-set has. It is recorded rather than drawn because the kind
  does not exist yet — the taxonomy's own rule covers it when it does
  (`notifications.md`, *The kinds later slices add*).

### The foot ruling — 2026-09-22

The implementation session, building the sheet ceiling, found two
rulings colliding on one control: the sheets-and-video round names the
thread's **Add a comment** a growing `rows={1}` field, but the
comments-sheet round (2026-08-28) draws that foot as a field-shaped
**door** into the full-focus composer — and a field whose tap navigates
away is never typed in, so it cannot grow. jakob ruled the collision:

- **The foot stays a door.** Composing a comment keeps its one home —
  the full-focus composer, where draft, media, and the signing ceremony
  live. A live inline foot would need that whole ceremony in a one-line
  row, or would create a second, lighter class of comment; neither is
  drawn. The graph's `Add a comment → ReplyCompose` edge was already
  the door and stands unchanged.
- **The growth law loses one of its three fields.** It governs the
  fields a writer actually writes in — the description sheet and the
  sensitive **Why?** — not the foot. The sheets-and-video round's text
  naming the foot a growing field is superseded on that one point; its
  ceiling, growth, and rows-as-minimum rules stand untouched.
- **A live foot is the chats round's question.** A chat is an inline
  signed send; if that round designs one, the comment foot inherits it
  then — never as a sheet bite now.
- **No pixels move.** Boards draw every field at its `rows`, and the
  foot was drawn at one line under either reading, so the ruling
  changes the record and the docblock (`CommentComposerFoot`), not a
  board.

### The change-histories round — 2026-09-22

Would-like #2, and the second round in the post-MVP tree. Thirteen
boards: a chronicle for every versioned kind of content, a timeline for
the stance — which turns out to be a history already — and the doors
onto both. Backlog item 34.

- **One list of whole versions, newest first, the current one marked,
  and never a diff (jakob).** The store keeps complete states and L1
  signs a full new record for every edit, so a difference between two
  versions is something a reader works out by reading. Computing one
  would also be a claim about which change mattered, which is the
  author's business rather than the product's. From a row a reader opens
  that version's own detail surface where the kind has one.
- **A version is the content state only; tag and reference changes are
  not edits (jakob, canvas review 2026-09-23).** "Only adding or removing
  a tag or reference are not edits of the post. They are standalone edges
  pointing to it — they are just baked into the edit screen in UI." A
  version row carries exactly what `post_versions` keeps — title,
  description, body, media and the sensitive mark — and nothing else. So
  no version can differ from another by a tag, a tag change never mints
  a version, and every version card wears the same tags line: the post's
  current tags, a fact about the post rather than about any one of its
  versions. Implementation reads this as contract.
- **Any kind of post, one chronicle (jakob).** A body is words xor media
  per version, so a post can change kind between two versions and the
  chronicle draws both side by side, each by the same master at the same
  variant. A picture version opens `PostVersionDetailMedia` — canonical's
  media detail anatomy, nothing added and nothing moved — and a words
  version opens `PostVersionDetail`.
- **The historic banner is a panel of its own (jakob, canvas review).**
  The first drawing butted onto the card and read as its header. It is
  now the key-absent notice's anatomy — `tertiary-container` with its
  `on-` pair, the card's rung, padding and gap — at the card's own width,
  one column gap above it, the line in `body-medium` and the way back as
  an `inverse` button on its own line. Both detail boards wear it
  unchanged.
- **A tombstoned version always keeps its row (jakob).** Removal takes
  the payload and never the record (`erasure.md` §1), so the mark stands
  in the content's place at the version's own date — whether one version
  went or the whole thing did. A row that vanished would be the silent
  erasure every honesty surface in this product exists to prevent.
- **Per-version removal is drawn, and the whole-post removal leads the
  author's register (jakob).** The head never falls through: removing the
  current version's payload leaves the head selected and rendering
  absent, so an author working version by version ends with a post that
  still stands wearing a mark. The act that does what they mean is
  therefore the first thing on the page, and the confirm words the
  consequence before it is pressed. `Remove this version` rides EVERY
  version with a payload, the current one included — removing the head
  leaves the older versions standing and the post rendering removed. A
  tombstoned version's slot never goes empty: it carries the quiet word
  `Already removed`, `PickedSheet`'s "Described" idiom, not pressable.
- **Comments and profiles get the same register (jakob, canvas review).**
  "Removing the contents of your profile is not deleting your account —
  you need to be able to do so." `CommentHistoryOwn` leads with `Remove
  the whole comment`, `ProfileHistoryOwn` with `Remove every version`,
  whose footnote draws the account's edge: the account, the handle and
  everything published stay. Both carry `Remove this version` on every
  version with a payload and `Already removed` in a tombstone's slot, and
  both open `VersionRemoveConfirm` — the post board is the confirm's
  master at every scale, and no comment or profile confirm is drawn. The
  reader's chronicles gained the matching tombstone rows, which is why
  `CommentCard` now takes `PostCard`'s optional `redacted` skeleton.
- **Two doors, both appearing only once a second version exists
  (jakob).** An `Edit history` row in the ⋮ — beside `Edit`, because
  `History` is taken twice over (your own profile's ⋮, the wallet's
  section) — and the `Edited` marker's own tap, which wires the
  `onInspect` slot `PendingMarker.jsx` has carried unused since the
  honesty markers were drawn. A door onto a list of one would teach a
  reader that the feature does nothing.
- **A stance IS a history, so the timeline reads the record mirror and
  adds no table (jakob).** The bundle is the fold of every record ever
  cast from one node to another; the timeline is that list, newest
  first. Severance shows as what it is — a counter-record at its own
  date, wearing the system's own word.
- **The header says the sum in plain words, because the fold clips
  (jakob).** A raw sum of +27.40 reads +1.00 past the cap, so a standing
  cannot tell one gentle pick from twenty-seven years of them — and that
  accumulated conviction is the thing a reader wants. The sentence
  carries it; the exact pair rides `cg-exact` and paints in geek mode
  only, both markups always drawn. The sentence has rules for any count
  and any span (`copy-voice.md`, jakob, canvas review): numerals for the
  count, `in` days or weeks under a month and `over` months or years from
  one, the weight clause only when the raw sum passes the dial, and
  `One pick, {date}.` for a single record.
- **Both timelines carry the one "?" (jakob, canvas review).** `How
  opinions build` rides the sheet title's row and opens `TimelineHelp` —
  `HelpDialog`'s shape over the real sheet: an opinion is the sum of
  every signed pick, the sum keeps counting past the dial, and walking
  back is one more record, never a deletion.
- **The door rule: authoring doors are faces and fields, history doors
  are readouts (jakob).** The stance face is fully spent — tap opens the
  pad, hold signs a gentle positive — so it never opens a history. On a
  list the row splits: the person area opens the person (the 2026-09-01
  ruling), the value readout opens that pair's timeline. On the pad the
  `Current opinion` label gains the tappable marker's underline and a
  tail, two rows clear of the field so no drag can end on it.
- **Timelines are public to everyone, signed out included (jakob).**
  Every record in one is a public act already, and the gates in this
  product are on acting. There is nothing here to act on.
- **The framing is additive everywhere (jakob).** On L1 an edit signs a
  full new record with its own hash, salt and witness, pointing at
  unchanged media — editing only ever adds, and "more" can be a version
  with one picture fewer. `copy-voice.md`'s *Editing* line carries that
  framing, and every chronicle closes on it in the reader's words.

### The sheet's short-viewport clause — 2026-09-23

The implementation session measured the sensitive sheet on web: its
fixed furniture totals 286px, and on a small phone with the keyboard
up the dvh-capped ceiling leaves the growing Why field no room — on
the most extreme heights the furniture alone overflows. jakob ruled
the gap in the growth law's cap clause:

- **Pinned ends, scrolling middle.** A sheet that cannot fit its
  furniture pins its grab area and its Done row and scrolls what
  stands between them; nothing is shed, and the growing field's
  floor is the last thing to leave view. The explainer line is
  simply the first thing to slide away. One anatomy at every
  height — no threshold variant, no keyboard-avoidance change —
  for every sheet with a growing field, both platforms.

### The feed-video rulings — 2026-09-23

Two gaps from the implementation session's feed-video audit, both
ruled before the chats work opened. The first completes the video
conform round's one-at-a-time law: 70% said who *may* play, but not
who *does* when two qualify at once — the audit measured the
claim-order accident costing 4 of 39 clips the stage before they
painted a frame.

- **The stage law: incumbency, instant succession, topmost when
  empty — continuously evaluated.** Each scroll surface has **one
  stage**, and a post's clip and a comment's clip compete for the
  same one. The playing clip **keeps the stage as long as it stays
  past the 70% gate** — nothing takes the stage from a clip that
  still qualifies, so a second clip scrolling into view changes
  nothing, and scrolling back up past a playing clip never ricochets
  playback to the one above. The instant the incumbent falls below
  the gate the stage re-evaluates — **mid-scroll, finger down, never
  waiting for the scroll to settle** — and the topmost qualifying
  clip takes it in the same moment: the seamless swap, the old clip
  freezing on its frame per the cover ruling, the new one starting
  milliseconds behind. When nothing qualifies, nothing plays until
  something does. jakob's reason for rejecting the library-standard
  settle-deferral (Toro and its descendants start playback only at
  scroll idle): *"users are not used to even stop scrolling
  anymore"* — Instagram hands the stage over without a lifted
  finger, and so does CoGra. A hard fling needs no clause of its
  own: incumbents succeed each other faster than playback can
  start, so a clip that leaves before painting simply never leaves
  its still face. **The hard top re-elects** (jakob 2026-09-30,
  found in his hand test): when the feed's scroll settles at its hard
  top — where the surface cannot scroll further up, an overscroll
  bounce settling back included — the first qualifying clip in feed
  order takes the stage, even from an incumbent that still qualifies.
  Two short clips can sit whole in the viewport at once near the top,
  and without this the lower one, once it held the stage, would keep
  it for good. The comments thread's stage re-elects the same way at
  the thread's own hard top, in thread order (jakob 2026-09-30): the
  topmost comment clip could otherwise never regain the stage once it
  had left it. Everywhere below a hard top the no-ricochet rule holds
  as ruled: a settle one pixel below it re-elects nothing. The lines
  stand in `designs/canonical/behavior/Feed.md` and `ReplyEntry.md`.
  **A sheet over a surface
  suspends that surface's stage** (jakob 2026-09-24, ruled with the
  implementation session): a clip behind a sheet is not on screen in the law's
  sense — the covered surface's incumbent stops rather than
  playing on under the scrim, and a clip drawn on the sheet
  competes for the stage by the same law, never by claim
  accident. The sheet's dismissal lifts the suspension and the
  stage re-evaluates as if scrolled. **The sensitive veil covers
  its clip the same way** (jakob 2026-09-24, backlog item 103): a
  veiled clip sits fully out of the stage rotation — no playback,
  no sound-disc presence — because the veil is the reader's
  declared not-yet, and a clip playing behind a blur the reader
  chose contradicts it. **The unveil is an eligibility change,
  not a suspension lift** (jakob 2026-09-24, sharpened when the
  first build read it as the sheet's from-empty re-election): a
  sheet suspends the whole surface's stage, so its dismissal
  decides from empty — but the veil never stopped the surface's
  incumbent, so the unveiled clip joins the rotation exactly as a
  clip scrolling into view does: it changes nothing while an
  incumbent still qualifies, and takes the stage by the ordinary
  law when the stage is empty or next re-evaluates. Anything else
  could move playback between two *other* clips on an unveil,
  which no reader asked for. Preloading stays on: it is
  invisible, leaks nothing the veil hides, and makes the unveil
  instant.
- **The first frame is stored, not derived.** *"The coverless
  clip's face is its first frame"* was already the rule; what made
  it a 1–3s empty box in practice was that no still existed and
  the face could only paint once video data arrived. Now the
  authoring fact is literal: on the vertical path, where the cover
  step is skipped, the device **silently extracts frame 1 and
  uploads it as the clip's still** — the frame-picker's own
  extraction machinery, run without the step. **Frame 1 means the
  clip's frame 0, strictly** (jakob 2026-09-24, ruled when the
  platforms diverged): a still taken from ~1s into the clip is a
  cover *in* the video rather than the start of it, so playback
  visibly jumps off it — the exact flash this ruling exists to
  kill. A black or blurry opening frame is the clip's honest face,
  and an author who wants a prettier one chooses a cover. **The
  preview face is the stored face** (jakob 2026-09-24, backlog
  item 106): the compose tiles' claim to wear the clip's first
  frame holds to the same frame 0 — a tray face that differs from
  what every reader will see is a lie in the one place the author
  is deciding whether they need a cover. Reading surfaces are
  always handed a stored still, coverless or not, and a loading
  clip loads exactly as a loading picture does. This cannot
  reintroduce the flash the no-cover ruling guards against: the
  flash came from a chosen cover differing from frame 1, and a
  frame-1 still *is* the frame playback starts on — the drawn
  QuietNote's "it starts on its own first frame" becomes seamless
  rather than approximate. When silent extraction fails, the post
  ships without a still and *Cover · no frames came back*'s neutral
  tile already says what stands there. The stored still is what
  READING surfaces are handed — the chosen cover where one was
  chosen, the taken frame 1 where none was; the COMPOSE WIZARD's
  own tiles are a different rule and always wear the clip's first
  frame, the chosen cover riding as the ringed inset only (the
  video-cover round). **The rule holds at both scales** (jakob
  2026-09-24, when the platforms' reply tiles diverged): the
  reply composer's clip tile is an authoring tile like the
  tray's — frame 0 as its face, the chosen frame as the ringed
  inset — because a divergence between the two composers would
  be invisible until it confused, and the inline cover row
  already shows the chosen frame at full prominence right below
  it. No new boards; both rulings
  land as contracts to the implementation session.

### The compose last-picture ruling — 2026-09-23

The picture path's manager had no edge for removing the last
picture, and the fallout was an empty Details walking to the seal.
jakob ruled it as the video path's rule applied to pictures:

- **The last × gives the pick step back.** Removing the last
  picture closes the manager and returns the pick step, tray
  empty; the stage never stands on a body that is gone, so no
  empty post reaches the seal. It does NOT become the words path —
  that fork was the author's explicit early choice, and edit's
  body-becomes-words rule exists only because the edit wizard has
  no pick step to give back. The removal is never refused, and the
  staged title, description, tags and references wait in the
  draft. Drawn on canonical (`ComposePicked`'s remove edge,
  docblocks there and on `ComposeDetails`), merged as its own PR.

### The chats base round — 2026-09-23

Would-like #3, the third round in the post-MVP tree: the four base
boards, `ChatsHome`, `ChatsExplore`, `ChatThread` and `ChatCreate`, on a
page of their own. The masters (`ChatRow`, `ChatExploreRow`,
`ChatBubble`, `ChatSealedNotice`, `ChatFoot`) live in the tree's
prelude until the round migrates.

- **Messenger clothes over the proposal primitive (jakob).** A chat's
  backbone is the proposal machinery, and nothing on these surfaces may
  look like a proposal. This is the one place CoGra adopts messenger
  convention wholesale: a list of your chats, bubbles, your own on the
  right.
- **The send arrow is the seal (jakob).** The signing ceremony
  compresses into the send act: a tap signs the message and sends it;
  press and hold opens the what-you-sign sheet; a one-time quiet line
  under the foot on the first send says so. The field is live — the
  question the foot ruling left to this round — and the comment foot's
  inheritance is not taken here.
- **The lock toggle (jakob).** Per-message encryption beside the field,
  sticky per chat, plaintext by default for a fresh chat, the state
  shown by the lock's fill (`lock_outline` / `lock`). Every encrypted
  message wears a quiet lock by its time, readable or not; one the
  reader holds no key for shows a friendly notice with the raw text
  one tap under it.
- **Bubbles carry content, time and the lock, nothing else (jakob).**
  Opinions, citing, saving and commenting live behind a long-press.
  Messages never edit.
- **Two faces, one page (jakob).** `Your chats` and `All chats` swap
  both ways; the explorer is the ordinary rank narrowed to chats, with
  no second algorithm and no header claiming one. A guest reads the
  explorer; the swap to their own chats is where the join prompt meets
  them.
- **The founding is minimal (jakob).** Name, picture and description,
  all optional; who can join as three choice rows — open, on request,
  invite only — never a segmented pill. The governance map ships its
  default silently. A 1:1 and a group both start from the list's `New
  chat`.

### The chats round, completed — 2026-09-23

jakob reviewed the base boards on the canvas the same day and ruled the
revisions and the rest of the round: eleven more boards, fifteen in all
on the Chats page. The masters grew in the tree's prelude —
`NewChatFab`, `NoKeyPreview`, `HideJoinedSwitch`, `DayDivider`,
`ChatThreadHeader`, `ChatJoinFoot` — and `ChatBubble` took media.

- **The product's first FAB (jakob).** `New chat` floats bottom-right
  over the list on both faces and stays while the list scrolls — the
  messenger's grammar, and the one place the "no FAB" rule the
  `Invites` entry point records gives way. It is glyph-only
  (`add_comment`, so it never reads as a second New post) and tonal
  (`secondary-container`): the bar's compose action keeps the one loud
  surface, and opening a picker commits nothing.
- **The list collapses; the thread pins (jakob).** The chats list is a
  surface a reader dwells in, so it moves to §4's Collapses column and
  takes `CollapsingTop`; a chat's thread keeps its pin.
- **Previews decrypt wherever the reader holds the key (jakob).** Push
  already shows the words, so hiding them on the list is annoyance
  without honesty. `An encrypted message`, with the lock, appears only
  where the key is genuinely absent — rare on your own list (a message
  from before you joined), common in the explorer (a non-member holds
  no key).
- **Two clocks (jakob).** Rows keep the ages ladder — a row answers
  freshness. The thread prints exact clock times on every bubble and a
  day divider wherever it crosses a day — it is a coordination surface,
  the one place CoGra needs when-exactly. The divider speaks the
  dateline's date and never `Today`.
- **The thread's header is the door (jakob).** The chat's picture and
  name open its detail surface — members, description, mute, leave,
  the history of its metadata. That surface is a later sub-round and
  the one gap this round leaves on purpose.
- **The explorer's filter is a quiet switch, on (jakob):** `Hide chats
  you're in` — the face exists to discover.
- **Contrast (jakob's review, conformance).** Text on the reader's own
  bubble and the no-key notice take `text-body`: the fill's formal
  `on-` pair measures 4.58:1, AA at the floor.
- **`Invite only` is the preselected policy (jakob)** — what people
  already know, and what a chat founded by picking people is.
- **Long-press is the chats' second gesture (jakob).** On a row it
  opens the chat's options (`Mute`, `Chat details`); on a bubble, the
  message's acts — the comment's menu pointed at a message, with `Give
  your opinion` and `Reply` added and no Edit row, ever.
- **One door for both kinds (jakob).** The FAB opens a people picker
  with `New group chat` at its head: a person opens the 1:1, the group
  row turns the list into a multi-pick that ends in the founding. Tapping
  someone you already share a 1:1 with asks — carry on, or start a
  separate chat — because several 1:1s with one person are legal
  (`chats.md` §9).
- **The seals.** Holding the send arrow opens what one message signs,
  in the compose seal's vocabulary; the founding's `Next` reaches its
  own seal — the chat and one invitation per picked person, signed
  together — on the profile Save's precedent.
- **The non-member's face** is the thread itself with the join, worded
  by the chat's policy, where the foot would be; a guest gets the same
  face.
- **Stickers are parked (jakob).**

### The chat details round — 2026-09-23

Round B1 of the chats work: the detail surface the chats round left as
its one deliberate gap, and its satellites — eight boards on the Chats
page (`ChatDetails`, `ChatDetailsReader`, `ChatEdit`, `ChatEditSeal`,
`ChatHistory`, `ChatSearchIn`, `ChatMediaGallery`, `ChatLeaveConfirm`).
The five gap edges that pointed at it — the four thread headers and the
row menu's `Chat details` — now land on it. The masters (`ChatIdentity`,
`ChatDisc`, `MemberRows`, `OpenDecisionsEmpty`, `ChatVersionCard`,
`ChatEventRow`) live in the tree's prelude.

- **Multi-voice acts wear messenger clothes (jakob).** An act is instant
  where the actor's own voice suffices under the chat's governance map;
  otherwise it waits as a quiet pending card in the thread and a row
  under an `Open decisions` section on the details, beside media. This
  round draws the section and its empty state (`Nothing is being
  decided.`); the pending card and the filled section are round B2's,
  an intended gap on the edit seal's act.
- **No presence, ever (jakob).** No online, last-seen or typing signal
  on a member row or anywhere else.
- **The chat's opinion control sits on the details (jakob)** — the
  profile header's stance-anchor precedent: the wide anchor leads the
  actions row, and the row's second act (`Edit chat` for an eligible
  member, the join for a reader outside) takes its word's width.
- **Founding creates the chat whole; an invitee who has not pointed
  back is pending (jakob).** The member list marks them `Invited —
  hasn't joined yet`, with no role. The thread's quiet line for the same
  fact is a state of the drawn thread, not a board.
- **The founder holds admin; roles show on member rows (jakob)** —
  `Admin`, `Moderator`, `Member`, the default map's three roles. A
  member can be a Collective, drawn as the person row it looks like
  (`ActorChip`'s rule) with `a collective` on its second line.
- **Metadata grows like posts and profiles (jakob).** Layered full-state
  versions, the L1 mechanism being succession. The chronicle is the
  change-histories pattern verbatim — whole versions newest first, the
  current one marked, never a diff — with membership events (joined,
  left, invited) as quiet rows between the versions, never part of one.
- **Mute lives on the row menu and on the details (jakob)**, one
  per-chat setting, and it silences the device push only — messages
  write no bell rows.
- **Leave is unilateral and unconditional (jakob)**, and the Leave
  record's optional parting reason is a field in its confirm and a
  quoted line under `left` in the chronicle.
- **Chats are public (jakob)**, so the details are readable by
  non-members and guests: the member's acts are absent, and the join,
  worded by the chat's policy, stands where `Edit chat` stands.
- **Deferred (jakob):** message disavowal and everything
  moderation-flavoured — the moderation slice's.
- **The lane's calls, flagged for review:** the anatomy's order
  (WhatsApp's group info filtered: identity, actions row, media, open
  decisions, members, mute and history, leave); `Edit chat` on the
  actions row rather than in the header; the leave confirm not offering
  the opinion door; the clip tile wearing the sound disc and no duration
  (the one-duration ruling); the leave dialog keeping its heading and
  answers pinned while a grown reason scrolls (the sheet's
  short-viewport clause, read for a dialog).

jakob reviewed the round on the canvas the same day and ruled five
corrections:

- **Search rides the thread's header (jakob).** `Search in this chat`
  left the details for a glyph at the pinned header's trailing edge,
  beside the details door, on every thread — the reader's outside the
  chat included, since plaintext is a public read and the truth note
  says the same to both. `ChatSearchIn`'s way back is the thread.
- **Role readouts are doors (jakob).** On a member's details, tapping
  `Admin`, `Moderator` or `Member` opens the role-change flow —
  `decision:change_role`'s multi-voice face, round B2's. The row splits
  the stance row's way (the person area opens the person, the value its
  own surface), and the word wears the `Edited` marker's tappable
  underline. A reader outside keeps plain readouts; the pending invitee
  has neither word nor door.
- **A chat's versions are removable by decision (jakob).** His case: a
  picture changed to one a member never wanted public. `Remove this
  version` rides every version with a payload, opening
  `decision:redact_version`'s multi-voice face (B2's; the decision joins
  chats.md §5, gated as `disavow_message`: > 50% cast, ≥ 20% quorum). A
  chat has no author — its creator is only its creator — so the door
  shows for every member, where a post's shows for its author alone. A
  removed version tombstones by the change-histories grammar.
- **The edit's seal says three (jakob).** The default map's
  `set:metadata` gate (> 50% weighted cast, 10% quorum) makes even a
  solo admin's change a proposal passing on its proposer's own ballot,
  so the reader signs the anchor, its reference to the chat and their
  +1 ballot — `3 things, signed together`, the founding seal's exact
  precedent, worded `Change`, `Chat` and `Your opinion` · `For the
  change`. The system actor signs the succession on its own and never
  joins the reader's count.
- **The `Why?` field stays (jakob).** `layer1-interface.md`'s act
  payload schema gives Leave a "parting reason" — "if the interface
  says so then the L1 author intended it to exist" — and the leave
  confirm's docblock cites it.
- **The gate**: canonical holds byte-identical — **217 screens · 1568
  edges · 13 gaps · flows 66/64/2**; the post-MVP tree stands at 44
  screens and 167 edges. The chats round's five gaps are resolved, and
  five stand in their place: the four intended B2 faces
  (Add people, the role change, a version's removal, the change that
  waits for more voices) and a Collective member's own page, owed since
  the Collective actor variant (§7).

### The chats governance round — 2026-09-23

Round B2 of the chats work: the multi-voice faces the details round left
as intended gaps, and jakob's fix pass on the canvas the next day —
fourteen boards on the Chats page (`ChatThreadDecisions`,
`ChatDetailsDecisions`, `ChatDecisionDetail`, `ChatAgreeSheet`,
`ChatInvitePicker`, `ChatInviteSeal`, `ChatThreadInvited`,
`ChatJoinSeal`, `ChatThreadRequested`, `ChatThreadApproved`,
`ChatRequestApprove`, `ChatRoleSheet`, `ChatVersionRemoveConfirm`,
`ChatHistoryRemoved`). The masters (`PendingCard`, `DecisionOutcome`,
`OpenDecisions`, `VoteActs`, `ApproveAct`, `VoteSheet`, `VoteRows`,
`ChatVersionTombstone`) live in the tree's prelude with the bodies the
boards share; `ChatJoinFoot` gained the invited, requested and approved
states, and `RedactedContent` a fourth mark.

- **Nothing may look like a proposal (jakob).** A chat's backbone is the
  proposal machinery. An act whose actor's own say clears its gate is
  instant: a proposal that passes on its proposer's first ballot, sealed
  as `3 things, signed together` (the change, its link to the subject,
  the proposer's own opinion for it — `ChatEditSeal`'s precedent). An act
  that needs more voices is a quiet card in the thread at the moment it
  was proposed: a plain sentence (`Mira Voss wants to remove Kel Moreau
  from the chat`), `Disagree` and `Agree`, and a count of the people who
  agree (`2 of 5 so far`). The same open decisions stand as rows under
  `Open decisions` on the details. Proposals never expire, so no card
  carries a clock.
- **A vote both ways is a real vote (jakob 2026-09-24).** A ballot's
  direction is its sign — positive agrees, negative disagrees, zero
  withdraws (governance.md §3) — and every chat threshold reads the cast
  (`> 50% of the cast`, `≥ 2/3 of the cast`, beside a quorum of the
  eligible weight that has cast), so a disagreement counts toward the
  quorum and against the share. Chat tallies are bidirectional with
  mirror failure (governance.md §2.4): a decision fails, terminally, once
  its negative side meets the same threshold shape over the weight
  against; while neither side crosses it stays open and members may vote
  again. The positive-only petition tally is Network-scope only and never
  a chat's. So an outcome line has two faces — passed (`Tobias Lindqvist
  is now a moderator`) and failed (`The chat kept its name`) — and a
  failed decision is final; asking again is a new decision.
- **No vote signs on a bare tap (jakob 2026-09-24).** `Agree`, `Disagree`
  and `Approve` open the vote's own small seal — `ChatSignSheet`'s
  vocabulary compressed to one sentence saying what the vote is, a quiet
  line that it is public and can be changed, and the seal's button (`Sign
  and agree`). One master, drawn once as `ChatAgreeSheet`; the nouns swap
  per vote.
- **A decision opens whole (jakob 2026-09-24).** A card's words, and a
  row's, open `ChatDecisionDetail`: what would change, in full — for a
  change to the chat, the proposed version beside the current one, its
  picture on the card at the details' 80px and a tap away from the
  fullscreen viewer; every vote cast, who and which way, as the public and
  auditable records they are (api-spec.md, `Proposal.ballots`); and the
  reader's own vote with `Disagree instead` (`Agree instead` over a
  disagreement) and `Take back your vote`. Changing a vote signs a newer
  ballot, since the tally reads each person's newest. Taking it back signs
  the zero-direction ballot, as governance.md specifies; api-spec.md's
  ballot input does not accept ZERO yet, which is the implementation's to
  close.
- **The decision page is where a vote is revised (jakob 2026-09-24).** A
  card the reader has voted on — their own proposal always — shows a
  readout, `You agreed` or `You disagreed`, where the two words stood, and
  the whole card opens the decision page; the details row mirrors it.
  Cards stay calm.
- **The count convention — the brief's recommendation, awaiting jakob's
  canvas review.** A card counts the people who agree and never shows
  weight. The tally underneath is weighted (admin 5, moderator 3, member
  1), so a card can settle early, or stand level while its count reads
  well — the drawn change is at 3 of 6 agreeing and exactly half each way
  by role, because Mira's disagreement weighs 3. The card carries no
  arithmetic; the decision page shows both directions, and geek mode
  paints the weighted sums there — a widening of the geek round's "the
  pairs, and only the pairs" to a governance tally.
- **An invitation is the inviter's own act (jakob).** It is a public,
  priced vouch and never a chat decision: a picker over the people not in
  the chat, then a seal counting one invitation per person, and no card.
  Withdrawing your own invitation (a De-invite) is a later surface.
- **Joining is always the joiner's own record (jakob, confirmed
  2026-09-24).** One seal, a sheet over the thread at `1 thing, signed`,
  serves the three routes: an open chat's `Join`, an accepted invitation
  and an approved request. Only the fact row saying how the reader comes
  to be joining swaps its nouns. An approval never joins anyone:
  membership comes only from the joiner's own signed Participant (chats.md
  §4; layer1-interface.md §9.8). An invitee reads the chat from outside
  with `{name} invited you.` and `Join` at the foot, and no Decline,
  because ignoring an invitation needs no record. A requester's thread
  carries their own card, `You asked to join`, over a foot that says the
  request is sent; once approved, the card becomes `Your request was
  approved` and `Join` returns.
- **A join request meets its approver as a card.** Under the default map
  one approval settles it, so the card carries no count and `Approve`
  stands alone — a request has no against; ignoring it is the no.
- **Roles and removals go through the same seal.** A role word opens a
  sheet of the three roles with the current one marked. A version's
  removal opens `VersionRemoveConfirm`'s dialog with the nouns swapped
  and a paragraph saying the chat decides it. Both proposals go through
  `ChatEditSeal`'s seal, not drawn again. A removed version keeps its
  row and date under the chat's own mark, `Removed by the chat's
  decision`, because a chat has no author and the members' choice is no
  platform verdict.
- **The lane's calls, flagged for review:** the decisions fixture moved to
  Salt-crust rubbings, where the reader is a plain member (in Coast
  walkers the admin reader's own say clears the metadata gate); outcome
  lines settle in place at the proposal's moment; the card is an outlined
  card on the page ground, neither bubble fill; `Agree` is the filled small
  button and `Disagree` the text one beside it, the dialog's pair, since
  the house button has no tonal variant; on a details row the two words
  take a line under the sentence; the card carries no geek arithmetic;
  the decision page is one tall board; the proposed picture takes the
  details' 80px disc, the largest the chat's picture is drawn, rather than
  the post chronicle's full-width picture, because a chat's picture is a
  disc; the readout stands at the count line's end where the buttons
  stood, and a voted card is one button whole; the requester's two moments are two
  boards; an approval shows both as a card and as a row; the role sheet's
  rows carry no lines; the invite picker leaves out people already
  invited; names are spelled whole (`Mira Voss`, not `Mira`).
- **Owed, and named:** the composers for a join request's message and an
  invitation's message are round B3's (jakob), as are the invitation and
  approval notification rows — the graph enters `ChatThreadInvited` and
  `ChatThreadApproved` there — and the explorer row's word for an invited
  reader; starting a kick and message disavowal stay with the moderation
  slice. chats.md §8 speaks of redacting a superseded version while the
  details round's ruling covers the current one too.
- **The gate**: canonical holds byte-identical — **217 screens · 1568
  edges · 13 gaps · flows 66/64/2**; the post-MVP tree stands at 58
  screens and 240 edges. The four intended B2 gaps are resolved; the one
  gap left is a Collective member's own page (§7).

### The chats integration round — 2026-09-24

Round B3 of the chats work, and the round that closes it: what a chat owes
the rest of the product, and what the rest of the product owes a chat.
Twenty boards on the Chats page (`ChatThreadReactions`,
`ChatMessageOpinions`, `ChatMessagePad`, `ChatThreadReply`,
`ChatMessageMenuOwn`, `ChatMessageRemoveConfirm`, `ChatThreadRemoved`,
`ChatThreadRecording`, `ChatThreadRecordingPaused`, `ChatThreadVoice`,
`ChatThreadSealedMedia`, `ChatThreadPending`, `ChatThreadSentPost`,
`ChatSendSheet`, `ChatAskSheet`, `ChatJoinSealPad`, `ChatNotifications`,
`ChatFeedCards`, `ChatSearchResults`, `ChatSaved`), and revisions to boards
already drawn (`PushKinds`, `ChatsExplore`, `ChatInviteSeal`,
`ChatThreadInvited`, `ChatThreadRequested`, `ChatMessageMenu`,
`ChatJoinSeal`, `ChatCreateSeal`, `ChatSignSheet`, and every thread through
its masters). The prelude's masters for it are `ReactionTrace`,
`BubbleQuote`, `ReplyQuoteStrip`, `RemovedBubble`, `VoiceNote`, `NoKeyMedia`,
`MicSeal`, `ChatFootRecording`, `DidntLand`, `BubbleCitation`,
`ChatFeedCard`, `MessageFeedCard`, `SealStance` and `ChatSealSubject`;
`ChatBubble` gained `quote`, `trace`, `pending`, `removed`, `fill`, `voice`,
`avatar`, `onCard` and the timestamp tuck, `ChatFoot` the quote strip and the
mic, `ChatJoinFoot` the invitation's message. The design system gained, all
additively and with every canonical board rendering byte-identically: the
`mic` and `delete` glyphs (§5), `Timeline`'s `surface` tone,
`StanceControl`'s `firstConnection` mode and `PostCard`'s `lead` and `main`
slots.

- **Reactions are the opinions already cast on a message (jakob).** No new
  record kind and no emoji system: every Opinion → Message already carries
  a pair, and the twenty faces already read it. WhatsApp's shape — a quiet
  pill hanging from the bubble, the faces aggregated (each person's opinion
  read as its nearest face, the most-worn first, three at most) and the
  count of people beside them. It is a readout, never a picker; a tap opens
  `Opinions on this message`, the opinions sheet's grammar at message scale.
  Geek mode paints each person's pair after the count, the first three then
  `+N more` — never an average, which would be a number nobody signed.
- **The message's two opinion destinations are drawn (jakob, the fix
  pass).** `Give your opinion` opens `StanceControl`'s own pad over the
  thread — its anchor held out of view, because a bubble wears no face — and
  `Opinions on this` opens the sheet of `StanceRow`s, each split to its
  timeline.
- **Voice notes are a chat-scale media kind only (jakob).** Post audio stays
  parked. The mic stands where the send arrow stands while the field is
  empty. **Tap to record, one state (jakob, the final micro-fix):** the tap
  turns the foot into the recording's controls — the running length and
  `Describe`, then delete, the lock toggle visible and flippable until send
  (jakob: the sticky lock governs a voice message like any message), pause
  and the explicit send arrow. There is no hold, no slide and no release that
  sends: hidden gestures fight the product's visible-controls honesty, and a
  release that signed would sign by accident, against the sign-step ruling —
  the arrow is the only way a note is signed. **Pause flips to play**, `Keep
  recording`, which extends the same note (`ChatThreadRecordingPaused`). The
  bubble is compact — play, the transport's own `Timeline`, the length and
  the clock in one 40px band; a note is described like all media, the
  author's words where given and `Voice message, 0:42` where not.
- **The timestamp tucks (jakob, the fix pass; a `ChatBubble` rule, so every
  thread re-renders).** When a message's last line is short, the clock tucks
  into it at the lower right, marginally lower than the words; only a long
  last line pushes it to its own line. Built the standard way — an invisible
  copy of the clock ends the text as a spacer, the visible one lies over the
  reserved room.
- **An encrypted message encrypts its attachments (jakob; chats.md §7).** A
  keyed reader sees the media with the quiet lock; a no-key reader gets the
  reserved tile with the lock and one friendly sentence, and no expand to
  bytes — cipher text is at least characters, cipher pixels are nothing. The
  tile claims no shape, since the ratio rides the sealed payload. And the
  implementation's consequence: **client-side processing is the only quality
  enforcement for encrypted chat blobs** — the server holds no key, so no
  transcode, resize or thumbnail path exists for them, and the stored still
  of an encrypted clip is taken on the device before encryption or not at
  all.
- **The chat and the message are feed cards, on the real card (jakob: both
  declared opt-in kinds; rebuilt in the fix pass).** Both are `PostCard`,
  mounted, with its header, its ⋮ and the normal action row — the opinion
  face, the score, the comments, the share — and the card itself is the
  door: a chat's to its thread, a message's to its thread at the message; the
  join lives inside. Redrawn for jakob to judge on the canvas (the final
  micro-fix; the direction blessed conditionally): through `PostCard`'s
  additive `lead` and `main` slots, the message card's author line is the
  sender's `ActorChip` and `· in {chat}`, and its body is the message as the
  thread's own `ChatBubble` — tail and tucked clock, the face dropped because
  the author line names the sender, the fill lifted a tonal step so it shows
  on the card; the chat card's author line is its disc, its name with the
  `forum` kind mark and the policy line under them, and its body is its last
  message as a `ContentRow` preview row. Nothing but a chat looks like a
  bubble, and a row-body breaks the text-post look. The ⋮ had gone missing because the first
  drawing hand-built both cards on `Card`, and handed the real `PostCard`
  below them a fixture with no `license` and no `menuItems`, for which the
  card draws no dot.
- **A chat result opens the chat's read surface, for anyone (ruled).** A
  message is the fourth saveable kind, its Saved row the comment's shape
  with `in {chat}` on its second line. Canonical's `RefsSheet` gap — the
  referenced node's own surface — re-wires at migration: its chat and
  message rows land on the read surface and on the thread at the message.
- **The foot takes a reply's quote (round A's docblock, drawn).** `QuotedRow`
  above the field with a × that lets the reply go; landed, the quote rides
  the bubble's head and scrolls to the message it answers.
- **The share act always opens `Send to a chat` (backlog item 23, ruled in;
  unified by jakob in the fix pass).** This revises the reel round's "one tap
  to the platform's own sheet": every share glyph, on every card, detail and
  reel, opens the send sheet, and the platform's share lives inside it as
  `Share outside CoGra`. One symbol — the share glyph everywhere; the send
  arrow stays the seal's alone. The system's node glyphs give the message
  kind `send` (`NODE_GLYPHS`, on reference and search rows and on Saved); it
  stays as it is (jakob: the contexts disambiguate), closed. The sheet: the
  reader's chats as choice rows,
  and the chat's own foot, whose arrow signs one message citing the post. The
  sent post reads back as its `ReferenceRow` at chat scale. A Reference is
  never encrypted, so the lock seals the words beside a sent post and never
  which post it was.
- **The seals' opinion is the real stance element (jakob, the fix pass: "you
  should be able to express your actual opinion when accepting an invite or
  creating a request").** The join's seal, the request's sheet and the
  founding's seal hold `StanceControl` itself in their `Your opinion` row — the
  pressable face, its pair in geek mode — and a tap opens the ordinary pad
  over the seal (`ChatJoinSealPad`); what it sets is what the seal signs. On
  these seals the control runs in its first-connection mode (jakob, the final
  micro-fix): a first connection has nothing to walk back, so the pad omits
  the walk-away; the message's pad keeps the full control, an opinion on a
  message being a real, revisitable stance. The message's own seal keeps the
  compose seal's one-axis grammar, `OwnStanceReadout` with `Adjust`.
- **Pending and didn't-land (design.md §9).** A message still settling shows
  whole with `Still settling ·` before its clock; one that expires leaves
  every reader's view and its author gets a calm notice where it stood —
  `Nothing was spent.`, `Dismiss` and `Try again`.
- **Removed messages (round A's docblock, drawn).** The author's own `Remove`
  sits among the acts on their own bubble's menu, behind the post's confirm
  with the nouns swapped; the removed message is `RedactedContent` where the
  bubble stood. `Removed by its author` and `Removed under the platform's
  rules` never read alike. Message disavowal stays with moderation.
- **Three notification kinds (jakob).** An invitation (`@mira invited you to
  Night fishing crew` → `ChatThreadInvited`), a request awaiting your approval
  (→ `ChatRequestApprove`, written only for those the map lets approve), and
  your request approved (→ `ChatThreadApproved`). No bell row for an
  ordinary message, ever: unread lives on the chats icon's dot. Push gains the
  three kinds and a `Chats` group whose `New messages` is on — the push
  round's forward note, drawn — the one push kind with no bell row, delivering
  what the thread holds; per-chat mute is its footnote. Whether messages split
  into 1:1 and group buckets stays undecided.
- **The two small composers (jakob).** `Ask to join` opens the request's own
  small sheet — the join seal's shape, with an optional `Message` — instead of
  sending on the tap; the invitation's optional `Message` stands on the invite
  seal, one message riding every invitation in the batch. The invitee reads it
  quoted at the foot, the approver reads the request's on the card.
- **The explorer's invited word.** An invited reader's row says `You're
  invited`, in the join's register, and lands on the join's seal.
- **The lane's calls, flagged for review:** the mic replaces the arrow while
  the field is empty, rather than standing beside it; the recording's live
  mark is a `primary` mic, not a red dot; the recording foot adds `Describe`
  to WhatsApp's anatomy; the paused state is a board of its own, since its
  middle control has its own edge; the trace hangs outside the bubble, which
  bends round A's "nothing on the bubble" only that far; geek mode's trace
  lists pairs rather than any summary; the no-key tile stands at the wide
  rung (a band for voice), not the payload's shape; the message card's bubble
  takes `surface-container-high` on the card; `PostCard`'s two new slots are
  the micro-fix's second design-system touch; only plaintext messages are
  message-card candidates; the send sheet sends to one chat at a time and
  reads the sent post back without its pair; the founding's seal gains the
  opinion row too; the approval row names the chat as its actor; the chat rows speak handles, the
  list's grammar; the three new push kinds default on, by analogy; the
  invitation's message field sits on the seal; the explorer's word is
  `You're invited`; `Try again` returns the words without signing.
- **The componentization law (jakob, the fix pass: "we want actual
  components. ALWAYS!").** A board mounts the real master wherever one
  exists; hand-drawn look-alikes stand only in explicit show-me-options
  testing. The chats boards were audited, A through B3, and rebuilt where a
  master existed: the thread header is `PageHeader` (the door in its title
  slot, search in its action slot), the feed cards `PostCard`, the reply
  quote `QuotedRow`, the sent post `ReferenceRow`, the no-key tile
  `MediaAttachment`'s reserved region, the voice line `Timeline`, the seals'
  opinion `StanceControl`, the message's opinions `StanceRow`, and the
  hand-drawn discs on the founding and its seal `ChatDisc`. What remains
  prelude-drawn has no master to mount — the chat's disc with its `forum`
  glyph, the bubble, the pending card, the member row's role split, the
  event row, the FAB, the foot's icon controls, the trace, the didn't-land
  notice — and each is a candidate to promote into `components/` when the
  round migrates.
- **The canvas grammar, kept.** Rows stand 120px apart below the tallest
  board of the row above, so the first B3 row clears the decision page's
  960px board and its name strip.
- **Two contradictions, flagged.** design.md shows pending content in full to
  every reader, where the brief said "to its author" — the board follows the
  doc. And canonical's `ExploreSearch` draws a chat-message result and a
  comment result, both of which api-spec.md rules out of the global index;
  `ChatSearchResults` follows the contract, and canonical's board is the
  backlog's to reconcile.
- **The gate**: canonical holds byte-identical — **217 screens · 1568
  edges · 13 gaps · flows 66/64/2**; the post-MVP tree stands at 78 screens
  and 385 edges, with the one gap it had: a Collective member's own page
  (§7). Every destination this round cannot name — canonical's feed,
  search, Saved, notifications, the share glyph, the score, the viewer — is
  the `canonical` terminal, re-wired at migration.

**The chats work, closed.** Four rounds now cover chats end to end: the list
with its two faces, the thread and its foot that seals, founding and the
people picker (the base round and its completion); the details surface, its
edit and chronicle, search in the chat, media and leaving (B1); every
multi-voice decision in messenger clothes, the invitation, the three routes
into a chat and the request's two sides (B2); and what the chat and the rest
of the product owe each other — reactions and a message's opinions, replies,
voice, encrypted media, pending and removal, the share act's one door, the
opinion set on every seal, feed, search, Saved, notifications and push (B3),
all of it on real masters. Deferred, and named: the moderation slice's items — message
disavowal, starting a kick, withdrawing one's own invitation (De-invite) and
everything verdict-flavoured; a Collective member's own page, owed since the
Collective actor variant (§7); stickers, parked; general post audio, parked;
and backlog item 34's container note — its chat chronicle is drawn (B1's
`ChatHistory`), and its comment-redaction half stays owed where it was.

### The indirect kinds are scope-served — 2026-09-24

Backlog item 105's resolution (jakob, the fix session): the search
rulings' three indirect kinds — messages, comments and offers — and
api-spec's index were read against each other, and both survive
because the 2026-08-28 ruling's own mechanics never asked for body
search:

- **Scope-served.** A message, comment or offer result exists only in
  a **scoped** query (`@handle <text>`, `#tag <text>`): the remainder
  matches name-class fields and titles — the scoped author's content
  and the names of their acts' targets — joined through authorship.
  **No body is ever indexed** for the global surface; the sheer mass
  of body words would clog any default result mix, and a keyword
  alone still surfaces nobody's conversation. In-chat body search
  stays `chatSearch`'s, over plaintext only — encrypted bodies are
  never searchable anywhere, since the backend holds ciphertext.
- **All chats, never just the viewer's.** A scoped message result
  reaches any plaintext chat — chats are public reads, so the scope
  is the author, not the viewer's membership.
- **The default mix carries the direct kinds** — in v1.0.0 posts,
  profiles and tags, with comments indirect (§13, *The v1.0.0 scope
  cut*). Selecting an indirect kind without a scope shows a quiet line
  pointing at the scope operator instead of results (its string is
  copy-voice's, blessed 2026-10-06).
- `ExploreSearch` already draws exactly this — its rows are an
  @-scoped query's indirect hits — so no board moves; api-spec gains
  the scoped-join paragraph.

### The pinned clip's veil face — 2026-09-24

The implementation session's veil build found the gap: the video
detail pins its clip *above* the card, outside the card's veil, so
a sensitive video post's detail autoplayed unblurred with full
transport. jakob's ruling, drawn as `PostDetailVideoSensitive`:

- **The pinned clip veils in place.** The body veils as one and
  revealing moves nothing, so the veil sits where the clip always
  sits — the veil state never demotes the clip back into the card.
- **The transport goes with it.** Nothing plays beneath a veil
  (backlog item 103), so the face is the whole surface and its only
  affordance is the reveal.
- **One scope, one tap.** The pinned clip and the card share one
  `SensitiveScope`; the reveal is per post, so either veil face
  reveals both and the screen becomes `PostDetailVideo`. A nested
  `SensitiveScope` now defers to the ambient one — the fix that
  makes the per-post law hold when a surface wraps the card from
  outside.
- The board is a **declared entry** in the graph's own idiom —
  the same detail any non-portrait clip tap opens, in the state
  the record brings, not a different tap.

### The v1.0.0 scope cut — 2026-09-25

The verdict round of the v1.0.0 audit (the full trail, findings and
candidates list live in the dev-state audit directory,
`2026-09-24-mvp-audit/`): every affordance canonical drew beyond what
the first release serves got a ruling, and the two precedents that used
to compete got their chooser. (What the cut leaves on screen is one
list since — `staged-surfaces.md`, the release cut's checklist.)

- **A door belongs to a slot, never to a list** (jakob 2026-09-25). The
  staging rule (§2) and the coming-soon door (`ChatsComingSoon`, the Sky
  card) were two answers with no rule picking between them. Now there is
  one: a **slot or icon whose absence would deform the shell keeps its
  place and opens a coming-soon door** — the bottom bar carries all five
  icons because a thinner bar reads wrong and re-adding one later costs
  every reader the muscle memory twice — while a **kind list or row set
  follows the staging rule** and shows only served kinds, never a dead
  chip. Hints of coming features are deliberate and few; the app is not
  crowded with placeholders.
- **The coming-soon door is a drawn anatomy, not bare words** (jakob
  2026-09-25): a card on the cogra wash — headline and one line — so the
  door reads intentional rather than broken. One master; both the chats
  door and the wallet door wear it, and it serves every reader state
  with one face.
- **The wallet slot opens the door in v1.0.0** (jakob 2026-09-24/25). The
  eleven wallet boards move to the post-MVP domain; the slot stays.
- **The feed and search filters show four kinds: Posts, Comments,
  Profiles, Tags** — the kinds CoGra v1.0.0 serves. The six chips beyond them
  (chats, messages, proposals, items, campaigns, offers) leave both
  filters. The comment-in-feed, profile-in-feed and tag-in-feed cards
  are v1.0.0 surfaces, drawn in *The three feed cards*.
- **Search returns no item, offer or message rows in v1.0.0**; those rows
  leave `ExploreSearch` with their kinds.
- **A v1.0.0 reference points at a person, a post or a comment** — the
  contract's union, read as the ruling. `RefsSheet` and
  `ReferencePicker` carry those three kinds only, each row wired to its
  own board; the picker's footnote drops `#tag` and messages.
- **CoGra v1.0.0 passes no history door** (jakob 2026-09-25): the `Edited`
  marker is a plain marker, the stance readout carries no built-tail,
  and a `StanceRow` value opens nothing — a control that answers
  nothing reads buggy. The masters' door anatomies leave canonical with
  the change-histories round and return when it ships.
- **Money words are payer-neutral** (jakob 2026-09-25): copy may say a
  signed thing is paid for, and no v1.0.0 copy names who pays — neither
  the member nor a pool — until a pool that pays and members who pay
  past it exist. The signing help's pool sentence gets its payer-neutral
  rewording in the copy round.
- **The deletion page names what exists**: no "cover" (the profile has
  none), no "messages" (chats are not in v1.0.0).
- **The editing help promises no version removal**: v1.0.0 removal
  targets the whole post, and the removal clause returns with the
  histories round.
- **Removing your own comment is v1.0.0** (jakob 2026-09-25): the comment
  menu carries Remove, the confirm speaks at comment scale, and a
  thread draws the removed comment's mark — the erasure half of the
  roadmap's slice 8, mandated at launch. Drawn in *The comment-removal
  round*.
- **`Still settling` joins the filter's "Also show", default on** — the
  landed-only control the slice-3 rework promises.
- **Topic follow ships whole** — the tag page's row, `YourTopics` and
  Explore's door are slice-3 sequencing inside v1.0.0, not scope.
- **The applicant's once-each staging stands** (jakob 2026-09-25). The
  drawn mechanism — a post, an opinion, a topic staged before approval,
  waiting with the application — is the product's ruling; About,
  auth.md and the contract get corrected to describe it. **The
  mechanism's three rulings** (jakob 2026-09-25, as recommended): a
  staged act is visible only to its author, in their own chronicle —
  nothing is public before it is signed; it **signs at approval,
  automatically**, in the same batch the vouch-in lands with — "it
  arrives with you" is the promise, and a new member re-confirming
  would break it; on **rejection or expiry the staged acts stay on the
  device as the account's own drafts**, never sent — the account
  persists, so a re-application finds them waiting, nothing silently
  deleted and nothing landing unsigned.

### The key-loss round — 2026-09-30

The v1.0.0 audit's K2 cluster (key loss and the key's lifecycle), ruled
by jakob in one sitting: eleven entries adopted as recommended, and four
rulings. The drawn boards assumed a recovery code always exists and
never said when a key is made; together the findings showed several
ways a reader could end up with no working code, or no copy of their
key, with nothing on screen saying so.

- **The key exists only once its ceremony ends.** The seed and the code
  are made when the code is shown; the key is attached, kept, and its
  backup uploaded at the typed-back confirmation — or attached alone at
  `I accept the risk`. Every other exit, a closed tab or a killed app
  included, leaves nothing. A re-key uploads the new backup only after
  its code is typed back, so **the old code keeps working until the new
  one is confirmed**, and an abandoned code screen costs nothing.
- **The recovery code is read the way auth.md reads it** — case, dashes
  and spaces never matter, and `I`, `L`, `O` fold to `1`, `1`, `0` — in
  the master's `readRecoveryCode`, for the typed-back gate and its
  divergence alike.
- **A declined backup can be made late** (`SettingsBackupNone`): the row
  reads `Not made yet`, and the screen takes KeyDecline's consequence
  and the ceremony's own code screen. No field, because nothing is
  replaced.
- **A key that cannot come is not offered a restore.** With no backup,
  every key-absent notice drops `Restore the key` and says how the key
  can come instead (`KeyElsewhereNoBackup`); an applicant whose key was
  made elsewhere may restore it or make a new one, which the unapproved
  application allows (`ApplicantKeyElsewhere`).
- **Forget-and-sign-out asks, when it would take the only key** — the
  undo-vs-confirm rule's instance (§11, *Dialogs*). `SignOutConfirm`
  leads with `Make a recovery code` and names everything the opt-in
  would clear — the key, the draft, the picks kept pending; signing out
  leaves them on the device, sealed; erasing them stays one press away, because the
  don't-remember opt-in exists for shared devices and a shared device
  needs a clean exit. The handle change is the rule's other named
  instance; its dialog is drawn with the handle's own round.
- **A session ended from elsewhere never destroys the only key** (jakob,
  confirmed by the implementation side's security check). On an account
  set to forget this device, `Sign out everywhere else`, a password
  changed or reset elsewhere, or a reused token caught keeps an unbacked
  key and any picks kept pending on the device, sealed — unusable until
  this device signs in again, online, with the account's current
  credentials. This bends only the don't-remember opt-in: for every
  other account nothing was ever purged. An invalidation ends the
  session; it is not a remote wipe.
- **The recovery-code screen stays screenshot-able** (jakob, overruling
  the audit). The key export keeps `FLAG_SECURE`; the code screen does
  not, because readers new to keys keep their code as a screenshot, and
  a black one would punish exactly them. The docblock states the
  asymmetry so no later pass closes it.
- **Every exit of the key's screens answers.** The ceremony's two
  dialogs take the safe answer on scrim and Back, and declining says
  what it made; Android's Back on the code screen names the way out;
  a copy says `Code copied`; a code made from settings returns there
  with a snackbar. The replace screen draws its refused code
  (`SettingsBackupError`), tells a browser that lost its code where to
  go, and Android's lockless phone is warned first (`NoScreenLock`).
  The export gets its browser gate (`YourKeyGate`), its copies are
  flagged sensitive, and restore names a wrong length
  (`RestoreLength`), goes offline to `NetworkError`, and says where the
  key is now.
- **A browser that cannot hold a key is told so** before anything is
  minted (`KeyCeremonyUnsupported`), in the key-absent notice's
  tertiary, never error.
- **A kept pick has exits and a life.** A hold on the key-elsewhere
  feed opens `PadKeyAbsent` like a tap, so nothing signs without the
  key; outside press and Back drop the pick, and only the text button
  keeps it. A kept pick wears its face on the post's anchor with
  `Waiting for your key` under it (the `PadPending` plate), lives on the
  device, and signs with the others in one batch the reader reviews
  once the key is restored — the review is this round's one gap.
- **One key-absent "?"** serves the seal, the pad and both settings
  twins, and `YourKeyAbsent` stops saying the key lives in the browser
  it is absent from.
- **The gate**: 208 → **218 screens**, 1510 → **1536 edges**, 0 → **1
  gap** (the kept picks' review), **flows 62 → 63**, every one
  resolved. The witness was re-blessed three times, each deliberately:
  the new `make-a-recovery-code-later` flow, the `Restore the key`
  control's census growing from five boards to six, and the triage
  meeting its gap. Outside the round's new boards, five moved a line
  or a badge — `SettingsBackup`, `YourKeyAbsent`, and the scrim badge on
  `KeyConfirm`, `KeyDecline` and `PadKeyAbsent` — plus the four maps
  that follow the edges.

### The three feed cards — 2026-09-30

jakob's ruling from the fifteen-first round, executed: **the four served
kinds — Posts, Comments, Profiles, Tags — everywhere, feed and search
alike**, and later kinds join with their features. The filter already
offered the four; this round draws the three cards a reader meets once
they turn a kind on, on one new board, `FeedKinds`.

- **A board of its own, not new cards on `Feed`.** The everyday feed is
  drawn at the filter's default, `Posts` alone, so the kinds arrive the way
  the post-MVP chat and message cards did (`ChatFeedCards`): the kinds
  turned on, the trigger reading `4 kinds`, the new cards leading and a post
  below them. The filter sheet's way out lands on it. (At the full set
  the trigger reads `All kinds` since — §13, *The pill's full set*.)
- **Each kind keeps the idiom it already wears** (`_shared.jsx`, the v1.0.0
  feed kinds). The comment is `CommentCard` in its out-of-thread shape — the
  target pointer leading, as on `ProfileComments` and `TagPage` — with
  `Reply` and its replies line. The profile and the tag ride `PostCard`'s
  `lead` and `main`, the chat cards' mounting: a person's lead is their
  picture, name and handle over their bio, their menu the profile's own less
  the share the row carries; a tag's lead is the `#` tile and its name over
  the newest thing tagged with it, as a preview row, its opinion the
  topic's Affinity, its share the one the tag page's own row ends with, and
  no ⋮, because a Type has no license and is never cited or saved. Every
  tap lands on a board that exists: the comment's thread, the person's
  profile, the tag's page.
- **`PostCard` gained `menuLabel` and `stanceAxes`**, both additive, so the
  ⋮ can say whose menu it is and a tag's pad can speak its own four ends;
  every other board renders unchanged.
- **The lane's calls, flagged for review:** the separate board rather than
  `Feed`; the comment's `Reply` and replies line kept (`ProfileComments`'
  shape, not `TagPage`'s doorway); the two-line lead for the person and the
  tag, so neither reads as a text post; the tag card's body as its newest
  claim, with that claim's age as the card's timestamp; the face at the
  feed row's anchor size on both, rather than a profile's wide one; no
  figures and no `Message` on the profile card; `FeedFar`, which
  turns comments and profiles on, still draws only posts, because whether
  its `photos` form admits a text comment or a person is unruled;
  `FeedKinds` is not a registered screen, so `nodes.json` does not change.
- **The gate**: 218 → **219 screens**, 1536 → **1561 edges**, **1 gap**,
  flows **63**, every one resolved. The witness was re-blessed once,
  deliberately: nine control-selector censuses each grew by the one board.
### The typed-name row — 2026-09-30

The v1.0.0 audit's K14.1 (E22), a blocker: the tag picker had no
creation row by ruling, its rows came only from slice 2.7's index, and
nothing staged what was typed — so before the index, and for any name
nobody had used, no tag could be added. jakob's ruling: **"yes — the
canonicalized typed name is always the list's first row, the action key
stages it."**

- **The first row is the typed name, canonicalized, always** — whether
  or not rows match below it. It is the `ReferenceRow` every row is,
  with the `Signs as #saltmaps` preview as its second line: the preview
  made tappable, a row and never a `Create` button, because it names a
  Type that already exists. A name in use that is the typed name is
  that row, never listed twice; the index's rows sit under it.
- **The name field's keyboard action key stages the first row** — the
  same pick as a tap on it, landing in the composer's tags. On a
  refused name there is no first row, so the key stages nothing and the
  refusal holds.
- **Drawn**: `TagPicker` gains the `salt` row above the four matches;
  `TagPickerTyping`'s preview moves from under the field onto its row;
  `TagPickerRefused`'s drawing stands, and it says why the row goes. The
  graph's name-field edges carry the action key, and
  `behavior/TagPicker.md` holds the ordering and the key's two outcomes.
- **The gate**: 218 screens and 1536 edges unchanged, flows 63/63; the
  compose map and the two drawn boards moved.

### The veiled reel — 2026-09-30

The v1.0.0 audit's K7.1: the stream drew no sensitive state, so a
veiled clip's shape there was undesigned. jakob's amended ruling:
**"the veiled reel is FULL SCREEN, looking exactly like any other
reel in the scroller, blurred and not playing, with the standard
veil anatomy exactly as everywhere else (chip + reason on the blur,
tap-to-reveal session-scoped, then it plays). One board:
ReelSensitive."**

- **One board, `ReelSensitive`** — the stream full screen, the clip
  blurred and not playing, the standard veil face centred on the
  blur; back arrow, rail, caption and bottom bar exactly as on
  `Reel`. The caption's words veil with `Show`, per `SensitiveVeil`'s
  law: the title stays readable, the description veils.
- **No sound disc and no seek line** — they are playback's rung of
  the control ladder, and a veiled clip has no playback (item 103's
  rule); everything that isn't playback stays, and the rail's acts
  stay live over the veil.
- **The reveal**: a tap on either veil face reveals — session-scoped,
  as everywhere — and the screen is `Reel`, playing; a swipe passes
  to the next clip. The score leads to `PostDetailVideoSensitive`,
  the sensitive detail. `ReelSensitive` is a declared entry, the
  state the record brings, wired as `PostDetailVideoSensitive` is.
- **Drawn**: the one new board; `SensitiveVeil` gained a `faceGutter`
  prop so the face clears the rail (default unchanged); the sensitive
  video detail board moved aside on the canvas, content untouched.

### The reply pack — 2026-09-30

Three rulings from the v1.0.0 audit's K5 and K6 clusters (jakob, the
fifteen-first round). The reply surfaces were worded and wired for a
post; a reply answers a post or a comment.

- **A reply's surfaces name their target, and say nothing else about
  it.** The composer and the seal are one surface each; only the lines
  that name what is answered differ. A post is quoted by its title and
  its author's handle, a comment — which has no title — by its author's
  handle over its first words (`QuotedRow`); the seal reads back
  `Reply to @tobias` and the act `Reply to @tobias's comment`
  (`ReplyComposeComment`, `ReplySealComment`). Everything else is
  target-neutral: the pad reads `Toward what you answer`, one pad for
  both, keeping its default start. The composer pre-fills nothing — a
  typed handle is text, never a record.
- **The word is "opinion", never "your opinion".** `Replying also signs
  an opinion on what it answers.` under the seal, and the pad's "?" in
  the same words: the reply's own opinion starts at the default and
  rides the reply, and "your opinion" reads as overwriting the one the
  reader already gave.
- **The key's absence is met at the reply's door.** A reply keeps no
  draft, so Reply and Add a comment raise the key notice over the
  thread before a word is written (`ReplyKeyAbsent`) — `PadKeyAbsent`'s
  card without the pad, `Not now` its way out, nothing kept. A key lost
  mid-write reaches the seal's fallback (`ReplySealKeyAbsent`): every row
  unchanged, the notice where the footer stood, restore or discard. The
  seal's key-absent outcome points there, not at the post's seal.
- **The thread's order** is written where the thread's rules live
  (*Comments live in a sheet*), and the drawn fixtures read by it.
  `ReplySettled` keeps its landed reply above the older ones for now: by
  the rule it ends its branch, and where the landing then scrolls is
  still to be ruled.
- **The gate**: 218 → **222 screens**, 1536 → **1558 edges**, 1 gap,
  **flows 63**, every one resolved. The witness was re-blessed once,
  deliberately: `reply-to-a-comment` now walks the comment-targeted
  composer and seal, and the `Restore the key` and `+ Cite something`
  censuses grew by the new boards.

### The failure pack — 2026-09-30

The v1.0.0 audit's first three K4 entries (failure, in-flight and the
refusal map), ruled by jakob in the fifteen-first round. The network
fault was drawn only for the seals and the entry forms. Everywhere
else a write had no failure outcome, no commit button had an
in-flight state, and the only fault the seal knew was "offline".

- **Read-side comforts answer at once; signed acts wait** (jakob, as
  recommended). Save, unsave, hide, undo and unhide change only what
  this reader sees, so they show their result at the tap. Every signed
  act waits for its answer. The pad stays open on `Set`, a dialog stays
  up on its commitment, the seal stays on its commit, and a hold moves
  the face only once the signature is taken. The account's other
  consequential writes wait the same way: remove, revoke, close, create
  an invite, and the handle, password and email changes. A comfort that
  fails reverts.
- **A failed signed act re-raises its own surface, with `Retry`.**
  Nothing the reader chose is lost. The pad is still open at the pick,
  the dialog still up, the seal still readable. The fault takes the
  place of the commit, which is `NetworkError`'s grammar:
  `TransportError`'s line, then an outlined `Retry` where the commit
  stood (`PadFailed`). A dialog keeps its pair and its commitment reads
  `Retry`.
- **A hold has no surface to re-raise, so the target's row carries it**
  (jakob: vehicle (b), the Snackbar charter untouched). While the hold
  signs, the row under the face reads `Signing…` in the pending
  marker's quiet register. If it fails, the row carries
  `SigningPending`'s line with `Retry` beside it, and the face never
  moved. On success the face moves and the snackbar confirms, as
  before (`RowSigning`). A comfort that fails reverts and says so in
  the same place.
- **In flight, the label says what is happening** (jakob). The commit's
  label swaps to its present participle: the verb takes `-ing`, the
  rest of the label stays, and `…` closes it. `Sign and publish` reads
  `Signing and publishing…`, and `Set` reads `Setting…`. The control goes
  inert without dimming, and no spinner is added. The loading law
  governs (§4, *Loading*). The control is inert from the press, which is
  the double-submit guard. The label swaps only once the wait passes
  200ms, so a quick answer never flashes a word. `Button`'s `busy`,
  `SealFooter`'s `busy`, `SeveranceConfirm`'s `busy` and
  `StanceControl`'s `signing` carry it (`SealSigning`).
- **The seal's faults speak `NetworkError`'s grammar** (jakob). A fault
  about the whole signing takes the commit's place, as drawn. A cited
  post that never landed is said on its citation's row, in the
  refused-file line's shape: the fact, then `Remove it`
  (`SealFaultRow`). Nothing was staged, so the commit stays. Any other
  refusal of one staged act is a bug (*The failure fixes and the
  support stack*). Each code's vehicle and words live in copy-voice,
  *Faults by code*.
- **The write rule's refusal is a restoration surface, not a fault**
  (jakob; `WriteRuleFailed`, the v1.0.0 home of the pool-exhaustion
  fact). A refused pre-check stages nothing and spends nothing, so the
  state is a notice rather than a failure. It is drawn the way the
  missing key is (`ComposeKeyAbsent`): a tertiary panel in place of the
  commit, then the way out that keeps the draft. It offers no `Retry`,
  because an immediate retry meets the same answer, and a control that
  fails the same way twice is not a way out (`RefusedFile`'s rule). Its
  words follow the payer-neutral rule (*The v1.0.0 scope cut*): signing
  is paid for, and there is only so much to go around at a time. The
  panel is `NoticePanel`, the first master of the tertiary notice that
  the key-absent boards still draw by hand.
- **Every write the law names has its outcome.** Five pads' `Set` reach
  `PadFailed`. Thirty-six hold edges name the `RowSigning` row, and
  `Walk it back` keeps its dialog with `Retry`. Nineteen consequential
  writes reach `NetworkError`: remove, close, create and revoke, the
  credential changes, the deletion link and its cancel, the resends,
  sign out everywhere else, and the key's attach. Sixteen comfort
  controls revert on the row. Thirteen seal commits reach
  `WriteRuleFailed`, and so does `NetworkError`'s own `Retry`. The ten
  seals that can stage a citation reach `SealFaultRow`.
- **The gate**: 218 → **223 screens**, 1536 → **1557 edges**, 1 gap
  (the kept picks' review, unchanged), **flows 63**, every one resolved.
  The witness was not re-blessed. Two flows now pin their success
  outcome where a failure outcome joined the edge they walk:
  `send-someone-an-invite` at `InviteNew`, and `remove-your-post` at its
  end. `NetworkError` stands on `ComposeSealBody` and renders
  byte-identical. The maps follow the edges. `Feed.md` gains the hold's
  lines, and `ComposeSeal.md` opens with the commit in flight.

### The comment-removal round — 2026-10-01

Removing your own comment is v1.0.0 (jakob 2026-10-01, the audit's R-1,
option (a); *The v1.0.0 scope cut*). It is the erasure half at comment
scale, drawn in the post's idiom, three boards in a row on the comments
page.

- **Your own comment's menu carries `Remove`** (`CommentMenuOwn`,
  `OWN_COMMENT_MENU`). The row stands as the last of the acts: after
  Save and Cite, before the two readings, with the license closing the
  menu. That is the own-post menu's place for it, and the place
  `ChatMessageMenuOwn` takes at message scale. The menu has no Edit
  row, because the card carries Edit. It has no sensitive row, because
  a comment's mark rides its edit. Every comment ⋮ edge gains the
  own-comment case.
- **The confirm is the post's dialog with the nouns swapped**
  (`CommentRemoveConfirm`). `RemoveConfirm`'s body moved to `_shared` as
  `RemoveDialog`, one anatomy keyed by kind, and the post's board renders
  byte-identical. The comment's dialog uses copy-voice's whole-comment
  body: the mark keeps *the comment's spot in its thread*. Over the
  thread it is lifted by `ReplyKeyAbsent`'s layer glue.
- **The removed comment keeps its place** (`CommentRemoved`, the
  sheet's `removed`). Comment nodes are never deleted (comment.md §5).
  The card keeps its author, its time and its place in the order, and
  `Removed by its author` stands where its words were. The mark's
  second line names the comment. The two replies under it stay in place
  and readable. The reader's position holds across the three boards at
  one offset (`REMOVED_COMMENT_SCROLL`, `ReplySettled`'s `scrolledBy`),
  so their own comment and its branch are in view.
- **A removed comment keeps what a removed post keeps.** Its ⋮ goes
  with the payload, the `Removed` rule. Its author chip, its opinion and
  its Reply stay, the comment-scale twin of the removed post's open
  thread.
- **The comment register points at the drawn confirm.** In post-MVP,
  `CommentHistoryOwn`'s `Remove the whole comment` hands off to
  canonical's `CommentRemoveConfirm`, as the post's register always
  handed off to `RemoveConfirm`.
- **The gate**: 229 → **232 screens**, 1618 → **1636 edges**, 1 gap,
  **flows 64**, every one resolved. The witness was re-blessed once,
  deliberately: `remove-your-comment` joins `remove-your-post`, and
  `cite-a-post`'s census grew by the own-comment menu. `ReplyEntry.md`
  gains the mark's line and the kept-replies invariant.

### The morning fixes — 2026-10-01

Small rulings jakob made in one sitting.

- **Both pickers end in `Done`** (jakob: "'Done' is my word of choice
  there as you are 'done' adding hashtags"). `TagPicker`, its two
  states and `ReferencePicker` carry the full-width foot every wizard
  stage wears. `Done` and the header back are one leave: both return to
  the composer with every staged pick kept, and `Done` is the
  affirmative twin, because a back arrow reads as an abort. On the
  refused name it still leaves, adding nothing.
- **The reply composer's words are a field.** `ReplyDraft` and the
  reply's five media states draw `WordsBody`, the growing body box, at
  a three-line minimum (`CommentEdit`'s own) under the growth law, with
  a comment's 2,000-character cap.
- **The post detail lives on Feed, the avatar pair on Profile.** The
  detail view, the reader's menu at both widths, the license and
  opinions sheets and `CitedBy` move to the Feed & Search page, and the
  profile picture's crop and seal to Profile. Media keeps the video and
  picture boards.
- **`Still settling` joins "Also show", on by default** (the scope
  cut's chip, drawn). Off, the feed keeps to what has landed and the
  trigger reads `settled only`. Every drawn feed is unchanged.
- **A clip's poster reaches the canvas.** The canvas editor resolves a
  board's pictures only through `src` and `url()`, so a clip's
  `poster` drew an empty plate there. The shell now lays the poster
  under each clip as a picture (`posterLayer`), and the clip still
  paints over it wherever it renders.
- **The gate**: 229 screens, 1618 → **1622 edges** (the four `Done`s),
  1 gap, **flows 63**, every one resolved, the witness not re-blessed.
  The maps and the canvas manifests follow the moved boards.

### The failure fixes and the support stack — 2026-10-01

jakob's rulings, in session, on the failure pack's drawn premise and
backlog item 117, and his confirmation of the support stack's shape.

- **A picked target never stops answering, except one that never
  landed.** No record is removed: a removed post is a reduced node, a
  deleted account is a husk, and tags are not citable. The one real
  case is a post picked while still settling — the reader's own or
  anyone else's, with `Still settling` on in the filter (jakob: "it is
  not only stuff i have created") — whose staged act then expires
  unlanded. `SealFaultRow` draws it: the citation's row says the post
  didn't land, with `Remove it`, and the commit stays.
- **Every other refusal at that stage is a bug, and says so**
  (`SealFaultBug`). The picker should have blocked it, so the seal
  owns it in the notice register, not the failure voice: the tertiary
  panel in the commit's place, `This shouldn't have happened`, nothing
  signed or spent. Its three ways out are jakob's: `Try again` — a bug
  can be transient, so asking again is a real way out here —
  `Report a problem`, and `Discard the post`, which asks first
  (`SealDiscardConfirm`). No row is marked.
- **The stopper exception to one "?" per screen** (*The compose flow*'s
  copy rule). A notice that stops the one act its surface exists for
  carries its own "?" beside the header's: jakob, "the '?' at the top
  right is the general one for the seal and not for this specific
  problem". `WriteRuleFailed`'s panel opens `Why signing waits` — the
  write rule in payer-neutral words, nothing lost, the draft kept, try a
  little later — and `PadWriteRule`'s opens the same dialog.
- **The support stack joins Settings' About group** (jakob, as
  recommended): `What's new`, valued with the running version, opens
  the release chronicle (`WhatsNew`) — the chronicle idiom applied to
  the product, whole versions newest first, the running one marked,
  each release with its door onto GitHub. `Report a problem` opens
  `ReportProblem`: one field in the reader's own words, and everything
  that travels with them read back before sending — the address, the
  version, what it runs on and the time, nothing else — sent through
  the reader's own mail. `Contact` is a plain mail door, apart from the
  report. Both addresses are placeholders until CoGra is on a server
  (jakob), on the repo's `.local` domain. One string per line for app
  and web.
- **The write rule at the pad's and the hold's scale** (backlog item
  117's two vehicles). The pad keeps the pick in view and the notice
  stands where the landing line and Set were — `PadKeyAbsent`'s shape,
  drawn by `StanceControl`'s `signing="writeRule"` — with `Not now`,
  and no pick is kept. The hold's row says `You can't sign right now.`
  in the pending marker's register, never the failure voice, with no
  Retry (`RowWriteRule`, `SigningPending`'s `quiet`). Every pad `Set`
  that reaches `PadFailed`, and `PadFailed`'s `Retry`, now also reach
  `PadWriteRule`; the thirty-six hold edges name the new plate beside
  `RowSigning`.
- **The lane's calls, flagged for review:** two seal boards rather than
  one board of two states, because a seal is a whole screen; no row
  marked in the bug state; a drawn post-scale discard ask rather than
  pointing at `ComposeDraftDiscard`, whose words are about the roll; the
  stack's order — About CoGra, What's new, Report a problem, Contact,
  then the legal pair; the board fixture at `0.1.2` over the repo's
  stated `0.1.0`; `.local` addresses; a full task page for the report
  rather than a sheet, since the bug seal opens it too; `Not now` on the
  pad, and the walk-away gone with the commit row, as on
  `PadKeyAbsent`; the dialog's title worded without an apostrophe, which
  the help-note check cannot parse.
- **The gate**: 229 → **235 screens**, 1618 → **1642 edges**, 1 gap,
  **flows 63**, every one resolved; the witness was not re-blessed.
  `Settings`' frame grew to 2613 for its three new rows, and the
  profile canvas's rows below it moved down 188. The settings sheets
  re-render because the page under them grew; every pad and feed board
  renders byte-identical. `ComposeSeal.md` gains the two refusals and
  `Feed.md` the write rule's hold.

### The feed cards, ruled — 2026-10-01

jakob's review of the three feed cards — they "need to be more unique.. the
profile card just looks like a text post that only has a body", and the tag
card "needs to tell a better story" — then his picks from three option
boards, each with its own rulings. `FeedKinds` is redrawn in the picked
anatomies.

- **`Feed score` everywhere** (jakob: "we will have up to 10 rankable
  objects and it should be the same for all of them"). The figure is one
  figure on every ranked card and has one name — spoken, read at the top of
  the trace, in every docblock and in prose, and in the graph's labels.
  Every ranked card wears it, `graph_3` and the number, second in the row,
  and it opens the one trace, `FeedEntry`: the score is about the paths
  leading to a thing, never the kind of thing it is.
- **The unified row.** Every feed card's actions read **opinion · score ·
  the kind's own act · share**. A post's own act is its comments — the
  post card already drew this order. A comment's is its reply, a tag's
  `Tag a new post with it`; a person's slot waits for chats, when the chat
  glyph takes it. A kind's act is `GlyphAction` — the share button's
  anatomy, the act in its accessible name — carried on `PostCard` by `act`.
- **The comment is a slice of its thread.** The post it answers stands as a
  head row — its mark, its title, its author; a comment's author over its
  first words when it answers a comment — and the comment hangs under it
  on a connector rule (`CommentCard`'s `targetShape="thread"`). **The
  double door**: the head row opens the post's detail, and the rest of the
  card opens the post's comment section scrolled to this comment. The
  reply is the comment glyph, opening that same place with the composer
  already aimed at the comment, and share closes the row.
- **The reply expansion never appears in a feed** (jakob). A reply is a
  comment targeting a comment, and as standalone content its card may
  appear in any feed; what lives only in the thread is the expansion
  under a card — the card carries no `View n replies` line, because in a
  feed the comment is the content and the card itself is the door to its
  branch. `behavior/FeedKinds.md` holds it, with where the card's door
  and its reply land.
- **The person is the top of their profile**: a 56px picture, the name in
  a title's weight, the handle under it, the bio in the quiet colour,
  folded at two lines. The opinion is the row's standard face, the control
  every card wears; the row is opinion · score · share.
- **The tag tells why, and what is behind it.** Under its name, the people
  it reaches the reader through (`Reaches you through @ada and @tobias`,
  blessed); the body is a glimpse — the marks of the newest things tagged
  side by side, the newest named, `@tobias · and 2 more` under it
  (blessed). Its act is the compose glyph, opening the composer at its
  first stage with the tag staged.
- **A tile on a card takes the darker tone** (jakob, the tag's `#`).
  `NodeMark`'s `onCard` gives the tile `surface-container-high`, the tone
  `ContentRow`'s disc already wears there, because the card's own tone is
  the tile's default and the `#` vanished into it. Every mark standing on a
  card or a quote takes it: the tag's `#` and glimpse, the comment's head
  row, the trace's tag block.
- **The tag page shares.** Its one wide control is the stance on the topic
  — the profile's situation — so its row takes the profile actions row's
  geometry, and the page's other act closes it. That act is share alone: a
  ⋮ would open a sheet of one row, since a Type has nothing else a menu
  could hold, so it stands as the `ShareButton` glyph, one tap to the
  platform's own sheet. It rides all four tag-page boards.
- **The trace's top block names every kind** (`ScoreOrigin`, drawn side by
  side on `FeedEntryKinds`): a post by its title and author, a comment by
  its author's handle over its first words, a person by their name over
  their handle, a tag by its name beside its `#` (`QuotedRow` gained
  `mark`). The four levels below it do not change with the kind.
- **Each card's shapes**, the `FeedShapes` pattern — reference boards,
  wired nowhere: `FeedCommentShapes` (its own pictures, answering a
  comment, veiled), `FeedProfileShapes` (a long bio, no bio, no picture,
  an opinion held, a negative score), `FeedTagShapes` (one thing behind
  it, one person it reaches through, the newest a picture, the topic held,
  a negative score).
- **The gate**: 1665 → **1666 edges** (the tag's compose act; the
  comment's `View replies` number now carries its card door), four
  reference boards, 1 gap, **flows 64**, every one resolved. The witness
  was re-blessed once, deliberately: `reel-to-detail` and
  `trace-a-score-to-its-records` start on the renamed `Feed score` label,
  their routes and their 28-board census unchanged. `FeedKinds`' stance
  edges gained the hold's two failure outcomes every other feed board's
  carry.

### The review fixes — 2026-10-01

jakob's rulings from his review of the day's rounds.

- **Your own comments say so in the thread** (jakob: "'own' should be
  added to the existing boards so it is clear that you can interact
  differently with your own comments"). @sol's 3h comment and the landed
  reply wear `CommentCard`'s `own`: `Edit` beside `Reply`, the anatomy
  `ReplyMedia` drew first, wired to `CommentEdit` on `ReplyEntry` and
  `ReplySettled`. Their ⋮ holds the own menu's acts. The removed comment
  keeps `own` and loses `Edit` with its payload.
- **A pick stages and the picker stays open** (both pickers, the shared
  anatomy's law). A row tap stages at once, and so does the tag
  picker's action key on the typed name; the reader goes on picking.
  The staged row shows it: `ReferenceRow`'s `staged` turns the add mark
  into `check` in `--on-surface`, the house *Selected* move, and its
  spoken name ends `Added`. A tap on a row already added changes
  nothing — un-staging is the composer's chip ×. `Done` and the header
  back both leave with every pick kept; back is navigation, never an
  undo. `TagPicker` draws two rows added and `ReferencePicker` one. The
  row edges now stay on the picker, and `behavior/TagPicker.md` and the
  new `behavior/ReferencePicker.md` hold the law.
- **The write rule's "?" is reworded** (jakob rejected the old dialog as
  "too mystical"): `Why signing waits` — a limit on how many signed
  actions go through in a short time, keeping the network safe from
  flooding, hit for now; nothing signed or spent, the draft kept, try
  again in a little while. One dialog, its draft clause true per
  surface: the pad, which jakob ruled keeps its "?", drops it, and a
  reply's seal says the reply is still here.
- **The write rule at reply scale** (jakob: conditional). Reached from
  a reply's seal, `WriteRuleFailed`'s fact ends `your reply is still
  here`. Its way out stays owed (backlog item 117).
- **The report's two edges** (jakob ruled the defaults). Empty,
  `Send by email` is visible and disabled with `Nothing to send yet`
  above it (`ReportProblemEmpty`, the disabled-submit law); leaving with
  Back keeps the words. The page moved into `_shared` as
  `ReportProblemBody`. (Send is live from an empty field since — §13,
  *The settings and pads rulings executed*.)
- **Blessed** (jakob): the failure pack's in-flight labels and faults by
  code, the write rule's lines, the failure fixes' lines and the support
  stack's, `settled only`, and the comment-removal strings. The reply
  pack's comment-target seal lines and its two key-absent notices join
  copy-voice as blessed.
- **The lane's calls, flagged for review:** the added mark's glyph and
  ink, and its spoken `Added`; the query kept after a pick, and the
  typed name kept in the field after the action key; the pad's dialog
  dropping only the draft clause; `your reply is still here` at reply
  scale; `Nothing to send yet`, its place above the commit, and the
  empty report as its own board; the composer's cap of ten references
  noted but its at-cap list undrawn.
- **The gate**: 238 → **239 screens**, 1664 → **1669 edges**, 1 gap,
  **flows 64**, every one resolved. The witness was re-blessed once,
  deliberately: `cite-something` now ends on the stage, which keeps the
  picker open. Backlog item 119 files the post-MVP dateline sweep for
  the histories' migration.

### The closing batch — 2026-10-01

jakob's rulings closing the day's rounds, executed in one lane.

- **The shapes boards gain the ruled variants.** On `FeedCommentShapes`:
  a comment answering an untitled post, its head row naming the post by
  its first words in the title's place; a comment whose post was
  removed, the head row wearing `Removed by its author` in the system's
  voice over the author, its mark an empty tile (`NodeMark`'s
  `redacted`), the comment readable; your own comment, whose ⋮ opens your
  own menu; and a long comment, folded at two lines under `More`, the
  caption's precedent (`CommentCard`'s `clampLines`). On
  `FeedProfileShapes`: a deleted account, which still ranks — the empty
  disc and `Deleted account`, no handle, no bio. On `FeedTagShapes`: the
  why-line past two people, `Reaches you through @ada and 3 others`; a
  handle too long for the line; and an empty tag, its glimpse given way
  to `Nothing carries this tag right now.` A guest meets every one of
  these cards as every card, the face opening `GuestGate`; no guest
  board draws one, so the masters' docblocks say it.
- **The why-line compresses, then ellipsizes.** Where the full line
  would not fit, it reads `Through @ada`, the strongest path's person;
  a handle that still does not fit ellipsizes, `ActorChip`'s law.
- **The comment card's ⋮ is the comment's menu** (`CommentMenu`, or
  `CommentMenuOwn` on your own), never the post card's.
- **The score hangs on the thing it scores.** At the top of the trace
  the figure is a flag on the held thing's top-left, attached the way the
  tag page attaches its claim to a row (`QuotedRow`'s `attach`), drawn as
  the `graph` glyph and the signed figure, `+15.20`, with no label word;
  `Feed score` stays its spoken name. The sign appears only there — the
  cards keep their plain figures (jakob: "we dont need noise"). No other
  surface drew the labeled form.
- **The trace names no kind but the thing's own mark.** `PathTrace` ends
  on the reached thing's `NodeMark` — cover, comment glyph, circle, `#` —
  and speaks `then what reached you`; level one's back reads `Back to
  feed`. `FeedEntryKinds` draws each kind's block with its strongest path.
- **A picked row moves above the results** (jakob, overruling the
  in-list check). Both pickers stage into a section between the field
  and the list, a `StagedReference` with its × — the post-MVP chat
  pickers' idiom, without a heading — and the × un-stages on the spot;
  the composer keeps its own removal. `ReferenceRow`'s `staged` and the
  spoken `Added` retire, and a staged row's mark takes the card tone,
  since its row stands on the tile's own.
- **The write rule at reply scale says `Not now`** — the pad's and the
  reply door's word — and returns to the reply's seal with the words
  still in its composer; backlog item 117's last way-out bullet closes.
- **The reply seal's key notice keeps the header's "?"** beside its own,
  by the stopper exception, as `WriteRuleFailed` does.
- **The primary action has two placements** (§4, *Spacing and layout*).
  Five boards dropped a spacer that pushed a task page's action toward
  the bottom edge: `Join`, `JoinErrors`, `KeyCeremony`,
  `DeleteAccountMail` and `VerifyExpired`. Every other task page already
  followed its fields; the wizard stages and sheets keep their pinned
  feet.
- **Blessed** (jakob): the review fixes' strings — the pad's and the
  reply seal's "?" clauses, `your reply is still here`, and `Nothing to
  send yet` — and the variants' lines. Item 119's note on the
  already-published marker now reads with item 112's ruling.
- **The lane's calls, flagged for review** (backlog item 120): the
  comment's two-line fold; the removed post's empty tile and its
  secondary ink; no sign on a zero; the 46-character estimate behind the
  why-line's compression; `ProfileEdit` kept as a wizard stage; the
  report left as drawn; the staged rows' card-tone mark.
- **The gate**: **243 screens**, 1671 → **1673 edges** (the two pickers'
  ×), 1 gap, **flows 64**, every one resolved. The witness was re-blessed
  once, deliberately: `cite-something` ends on the pick moving into the
  staged section. The three shapes boards grew taller on the canvas, the
  staged citations' boards re-render for the card-tone mark, and the maps
  follow the edges.

### The kept picks' review — 2026-10-01

jakob's rulings B1-B3 (the night round), closing backlog item 113 and the
canonical tree's one gap, `Restore/4`. Kept picks sign together, in one
batch the reader reviews first (jakob, 2026-09-30).

- **Review, then the standard seal.** `Restore the key` with picks kept
  opens `KeptPicksReview` — from `Restore`, `RestoreError` and
  `RestoreLength` alike. One row per kept pick, the staged section's
  `StagedReference` with its ×: the target's face, its kind, the pair in
  readout form, spoken as the readout speaks it (`stance`). `Sign them`
  leads to `KeptPicksSeal`, the standard seal with the picks as its acts,
  one `Opinion` row each, all or nothing; signed, the batch returns where
  the review was opened from with `Signed 3 things, still settling.` The
  seal idiom is untouched and nothing on it is removable.
- **The × drops at once** — no confirm, no undo; nothing was signed, and
  the pick is made again from its pad. The last drop closes the review
  with `Nothing left to sign.`
- **Leaving unsigned keeps them.** The arrow, the system's Back and the
  seal's X keep every pick, and the Key backup group carries a quiet row,
  `3 kept picks waiting`, that reopens the review — there only while that
  is true.
- **The lane's calls, flagged for review:** every new string (copy-voice,
  *The key's lifecycle*); the restore's snackbar riding in over the review;
  the review's pinned foot (ruling A2's wizard reading); one acts-card row
  per pick rather than one per kind; the row's place, last in the group;
  `WriteRuleFailed` as the seal's write-rule master. Backlog item 113 holds
  the questions the drawing left.
- **The gate**: 243 → **245 screens**, 1673 → **1682 edges**, 1 → **0
  gaps**, **flows 64**, every one resolved. The witness was re-blessed
  once, deliberately: the gap leaves the triage, and no flow moved.
  `Settings` grew a row taller; the maps follow the edges.
### The compose and media behavior pass — 2026-10-01

Pass C of the behavior home (jakob's F1: transcription only, unruled
behavior filed, never invented), the compose and media pages.

- **Every non-reference board on both pages has its sidecar.** Each line
  transcribes a board's docblock, its graph edges' cases, and the rounds
  above and copy-voice sections they cite: the wizard's two ways out and
  its kept draft, the caps' late counter and refusals, the seal's
  read-back and its faults, the growth law, the cover and frame-0 rules,
  the veil and the control ladder. `ComposeDetails.md` and
  `ComposeSeal.md` gain the lines their merged rulings bind. Reference
  boards (the ladders, the shapes, the maps) owe none.
- **What no ruling answers stays out of the sidecars** and waits for
  jakob as filed questions: the cover step's Next before a face is
  picked, the counting sheets at the fold's edge, the body fork's switch,
  the words stage's empty Next, an edit's × on a pick made in the same
  edit, and the viewer's third way out — all ruled in *Pass C's
  rulings*, below.
### The feed and comments behavior pass — 2026-10-01

Pass C's first two pages (jakob, the night ruling round's F1): every
board on the feed and comments pages carries a sidecar in
`designs/canonical/behavior/`, transcribed from its docblock, the
records here, its flow edges and copy-voice. Nothing was ruled in the
pass; behavior no ruling covers was filed for jakob's review rather
than written.

- **`FeedCover` is registered under `feed`** (backlog 114), named as
  `Feed` names its parts; a card's discs carry `soundDisc` and
  `playDisc`. The stage law spans a post's clip and a comment card's,
  and only the post's is drawn, so `Feed.md` anchors the post's clip as
  `feed.card.media.frame` and keeps *clip* for both.
- **Three behaviors wait for the night's other rounds**: the feed
  filter's commit (the sheet law), the settled reply's landing scroll,
  and the reply's uploading seal. Their sidecars hold everything else.
- **The gate**: screens and edges unchanged; `nodes.json` gains
  `FeedCover` and two paths; 72 sidecars, every one green.
### The pads and the edit's withdrawals — 2026-10-01

jakob's night rulings D1–D3 (audit K10.1, K5.3, K6.2), executed in one
lane. D1 and D3 as recommended; D2 as recommended with his sharpening.

- **The tag and citation sheets have a non-drag route** (K10.1; jakob:
  "the pads should be pads"). Nothing visible changes. `TagPad`,
  `TagPadCompose` and `RefPair` open on a first control hidden until
  focused — `Set exact values for #saltmaps`, the stance control's
  skip-link idiom — that swaps the field, in place, for the two tracks
  with the family's names, poles and bound, `Type exact values` a tap
  away; the readout and `Done` stay, and no dialog stacks over the
  sheet. The readout is `aria-live`, and focus on open lands on that
  first control, the dialog pattern's default (WAI-ARIA APG). The swap
  is a state and is not drawn a second time (*The tag pad*).
- **`StanceAlternates` travels with the record family.** It takes
  `ranges`, `title` and `commitLabel`, draws the walk-away only when it
  is handed one, and at `host="sheet"` renders in a sheet's field
  instead of as a dialog. The stance readouts take a family's
  `current` and `resulting` labels and `anchorWord: false`; every
  stance board renders unchanged.
- **A standing citation opens `RefPairEdit` on an edit** (K5.3). A
  citation's records net, so the pick is one additive record, read back
  as the stance pad reads one: `Current`, `Your pick`, and `Resulting`
  under the field. The pick opens at the origin.
- **Withdrawing costs records, said inline; Sign is the confirmation**
  (jakob's pick — no second dialog). `Remove citation` takes the
  walk-away's slot, and the line over the foot says its cost in the
  walk-back's words, `Removing it signs 1 thing, paid on its own.`
  (`… N things, each paid separately.`). The count is
  `ReferenceClaim.withdrawalCost`: jakob, verbatim, a bundled
  connection with a magnitude over 1 on any dimension needs multiple
  counter-acts, so the seal's count is the real counter-record count,
  never one per removal. An un-tag is one record: a tag is
  newest-wins.
- **The edit reads its withdrawals back with an `Undo` each.** A tag or
  citation withdrawn leaves a `Withdrawn:` line under its block, one
  per item; `Undo` unstages it, and re-picking the same name in either
  picker does the same — one staged act per name
  (`behavior/TagPicker.md`, `behavior/ReferencePicker.md`). A citation
  this app cannot type stands as a row with no × (api-spec excludes it
  from editing). `EditComposeUnchanged` no longer draws a withdrawn
  line its empty batch could not hold.
- **`EditActs` counts the complete kind set in records**: `Edit`,
  `Tags added`, `Tags withdrawn`, `Tags revised`, `Citations added`,
  `Citations revised`, `Citations withdrawn`, `Cover changed`, a row
  per kind in the batch. The drawn edit withdraws a citation revised
  past 1, so its row reads `2` and the foot `You're signing 5 things`.
- **The reply has its own gated seal** (K6.2). `ReplySealUploading` is
  `ReplySealBody` at `uploading` — the reply's header, add-rows, facts
  and no-draft X — with `UploadStatusLine` over a disabled `Sign
  comment`; `ReplySealUploadFailed` is the gate's fault reading, `One
  picture didn't upload. Signing waits for it.` and Retry. The four
  reply edges that reached the post's `ComposeSealUploading` repoint to
  it, and `ReplyVideoFailed`'s `Next` is inert while the clip is
  failed. No board at reply scale says a draft is kept.
- **The lane's calls, flagged for review** (backlog item 121): every new
  string (copy-voice, *The pads and the edit's withdrawals*); the pick
  opening at the origin; the removal cost as a sentence over the foot;
  `2` heard as `2 things` on a records row; the failed gate as its own
  board; the Retry-only gate line.
- **The gate**: 243 → **246 screens**, 1673 → **1686 edges**, 1 gap,
  **flows 64**, every one resolved. The witness was re-blessed once,
  deliberately: `reply-while-the-pictures-upload` now runs through
  `ReplySealUploading`.
### The entry funnel round — 2026-10-01

jakob's night rulings on the audit's K3 blockers (Block C items C1–C7,
C19–C21, every one "as recommended"), executed in one lane.

- **A mistyped address has a way out.** The verify card prints the
  address it sent to, with `Wrong address?`, and an unverified applicant
  changes it with the new address alone (`ApplicantEmail`; auth.md,
  *Email change*, the unverified carve-out): the old address has proved
  nothing, and a mistyped one never receives a code.
- **The reap is said once, as a consequence.** The verify card carries
  one line saying an account left unverified for seven days is removed;
  no figure ticks, no other surface repeats it, and `VerifyExpired`
  promises the fresh link only to an account still waiting on it.
- **A held link is never pasted twice.** The landing stays feed-first;
  for a visitor holding a live invite link the band's `Sign in or join`,
  every guest gate's affirmative and SignIn's `New here?` open `Join`
  with the link, and a dead link opens `JoinInvalid` from the same
  places.
- **Sign-in lands wherever app-open lands for the account** — one rule
  for every state the shells draw. The login backoff answers in place
  (`SignInLimited`), and a reused sign-in's notice rides the landing as a
  task card (`FeedSecurityNotice`), delivered once.
- **Every reader of an ask link is answered.** `VouchAskUnusable` in
  `JoinInvalid`'s idiom for an applicant already in or waiting on
  someone else; a guest meets the ask and its affordance raises the
  guest gate, sign-in coming back to it; an applicant and the asker land
  on their own landing, and a member who already has them queued on
  `Invites`, each with a snackbar.
- **The verify landings work signed out.** `VerifyExpired` serves the
  app and the browser; signed out its way on reads `Sign in` and
  `Resend the link` asks for the address in place; `Verified`'s way on
  opens `SignIn`.
- **The email change is visible end to end.** The new address's link
  lands on `ChangeEmailLinked` (`Verified`'s idiom, first side or last)
  or, signed out, `ChangeEmailLinkedSignedOut`; `ChangeEmailConfirm`
  gains `Resend` and `Cancel the change`; the settings row reads `Change
  pending` (`SettingsEmailPending`).
- **The deletion's link has a landing, and the grace a screen.**
  `DeleteAccountConfirmed` states the deadline and offers the content
  sweep again when the request left it off; during the grace the row
  reads `Deletion in 6 days` (`SettingsDeleting`) and opens
  `DeleteAccountPending`, whose `Cancel` ends it.
- **The lane's calls, flagged for review** (backlog item 122): the dead
  link's feed-first arrival, the password kept on the carve-out, the
  deletion landing's column and its unticked commit, the grace screen
  without its band, and every new string (copy-voice, *The entry
  funnel's round*).
- **The gate**: 243 → **255 screens**, 1673 → **1711 edges**, **flows
  65**, every one resolved. The witness was re-blessed once,
  deliberately: `guest-turns-applicant` now starts only where no link is
  held, and `join-with-the-link-in-hand` is the held link's journey.
### The curate rulings — 2026-10-01

jakob's night round on backlog items 116, 117, 118 and 120, the three
spoken strings and the audit's K8.1, every one as recommended except the
newer-version message, which he widened.

- **The report keeps its read-back before the press**, the
  two-placement law's one stated exception (§4). `ProfileEdit` and
  post-MVP's `ChatEdit` read as wizard stages and keep their pinned
  `Save`.
- **The post seal's key notice keeps the header's "?"** beside its own,
  by the stopper exception, as its reply-scale twin does.
- **A signed reply lands by scrolling the thread to its card** (K6.6's
  direction): the return anchors to the new card at its branch's end.
  `ReplySettled` keeps its drawn offset.
- **While a seal signs, it holds the reader.** For the label swap's
  duration the back arrow, Back and the X are inert with the commit; the
  fact rows stay readable; an app killed mid-sign says the outcome on
  the next open with the ordinary settled or failure notice. Past 5s
  the acts card's subline swaps to `Still signing — the network is slow
  right now.` in olive `--tertiary` and nothing feigns progress
  (`SealSigningSlow`, `ActsCard`'s `noteTone`) — §4's *Loading* names it
  the law's second exception.
- **The write rule's words are the solvency reading** until the
  contract can tell its two gates apart; the split waits on the design ⇄
  impl seam.
- **The copy-only vehicles have boards.** `SignInExpired` is `SignIn`
  with the signed-out sentence where the welcome line stood.
  `PostNotFound` and `CommentNotFound` are `ProfileNotFound`'s
  construction, back by the layer law and drawn cold. `RowSigning`'s
  third card draws a failed comfort's revert on the row
  (`StanceControl`'s `comfortFailed`). The dead ask link is the entry
  funnel's `VouchAskUnusable`.
- **Every key-absent panel is `NoticePanel`**: the five boards, the
  reply's `KeyAbsentNotice` and post-MVP's `WalletKeyAbsent` — one corner
  rule, the title's letter-spacing restored.
- **A stale install hears about the newer version twice, quietly**
  (jakob: "one message might be helpfull"). `WhatsNewBehind` carries `A
  newer version exists.` atop the chronicle with its release door; once
  per release, on a cold app open, one snackbar on the feed's arrival
  says `A newer version of CoGra is out.`, its action opening What's new,
  a device-local seen flag per release (`FeedNewerVersion`) — the
  Snackbar charter's one stated exception. A more obvious vehicle is
  backlog item 123.
- **The words path composes no description** (K8.1): `ComposeCited`
  drops the field, and the media-to-words flip drops a standing
  description with the last picture (`EditPicked`, `EditWords`).
- **Blessed** (jakob): `Added — in the staged list.`, `Removed from the
  staged list.` and `You, then several steps, then what reached you`.
- **Flagged for blessing**: the slow line, the newer-version line and
  snackbar, and the snackbar's action word `What's new`.
- **The lane's calls, flagged for review:** the slow line standing in
  the subline's place on a single-act seal too; its polite `status`
  role; the signed-out sentence in the welcome line's secondary ink;
  the not-found boards without a header title; the comfort's revert
  drawn as an unsave on Sol's post; the newer release's notes left
  behind its door.
- **The gate**: 243 → **249 screens**, 1673 → **1697 edges**, 1 gap,
  **flows 64**, every one resolved. The two not-found boards' bottom
  bars grow the census of the four publish flows' first step, 49 → 51
  boards, so the witness wants a deliberate re-bless. `RowSigning` grew
  to 1600 and `RowWriteRule` moved beside it on the patterns page.
### The applicant's life round — 2026-10-01

jakob's night rulings on the applicant's days, from staging to the
vouch-back (the audit's K3.9–K3.19, as recommended unless named).

- **An applicant's seal stages, and says so.** The seal is the member's;
  `Sign and publish` closes the wizard onto the applicant's own feed
  with the staged-act line, never `Signed — it's in the thread now`.
  From the turned-down shell New post still opens the wizard: the post
  waits on the device as the account's own draft, and a fresh
  application finds it (the mechanism's drafts-on-close ruling).
- **A topic has its own staged-act line**: `Your topic waits with your
  application — it arrives with you.`, on the tag page's topic face.
- **Applicants do not comment in v1.0.0** (jakob's ruling). A comment
  cannot wait as pending, so it is not a kind that stages: the sheet's
  foot and `Reply` stay drawn and answer an applicant in place with
  `You can comment once you're in.`
- **Every account-needing slot asks on tap.** A guest meets `GuestGate`
  from the reader's post menu (Save, Cite, Hide), the profile menus
  (every row but Share), `Message`, the comment menu's Save and Cite,
  and the comment foot. License terms and Share stay open. An
  applicant's Cite and Mention take the once-each case; Save and Hide
  are open to them.
- **About**: the key topic names no platform; back to Join keeps every
  field as it was left. Its once-each text already stood (item 108).
- **Approved, landing** (`ApplicantLanding`): the waiting shell with the
  card flipped to `Approved — your registration is landing`, no
  control, flipping live to `VouchBack` when the record lands; the
  `keyAt` chip draws the key-absent variant, which says the landing
  comes from the device holding the key.
- **The vouch-back stays reachable.** A first opinion on the member who
  vouched you in is the vouch-back wherever it is signed and opens
  `VouchedIn`. On `VouchedIn` Android's Back is `Go to your feed`; a
  vouch-back that never lands is an ordinary expired act.
- **The ask link rides the waiting card** (jakob's pick, (b)), its
  caption true for a live application: it stages nobody new until the
  answer comes.
- **The waiting and turned-down feeds wear the filter**, as every feed
  view does.
- **Settings is one page for applicants too**; its docblock names each
  row's applicant state, and before any key both key rows read `Not
  made yet` and open the ceremony.
- **Flagged for blessing**: the topic line; About's `…signed by a key
  only you hold.`; the landing card's
  title and both bodies; the waiting card's `Your ask link` and its
  caption.
- **The gate**: 243 → **244 screens**, 1673 → **1694 edges**, 1 gap,
  **flows 64**, every one resolved. The witness was re-blessed twice,
  deliberately: every applicant shell (the turned-down and landing ones
  included) is excepted from the staging flows, the guest and applicant
  shells from `reply-to-a-post`, and `cite-a-post`, `mention-someone`
  and `message-someone` name their non-gate outcome.
### The navigation-and-sheets round — 2026-10-01

jakob's night rulings on the K11 cluster: two laws in his own words, and
the rest as recommended. Both laws stand in §4.

- **THE LAYER LAW** (§4, *Navigation*). A direct link — a shared post, a
  reel, any deep link — opens as a layer over the app's current state,
  and back returns to exactly that state (jakob: "a back gesture from
  that shared content does send you back to your before state of the
  app"). With no prior state, back lands on the owning tab's root: a
  post, a comment or a profile on Feed, a tag on Explore. The entry
  funnel keeps its links.
  `PageHeader` scopes "a link, never history" to the funnel.
- **THE SHEET LAW** (§4, *Sheets*). Every sheet carries a commit; the
  commit applies; the scrim, a swipe down and Back discard — no
  live-apply sheets (jakob: "all of them having a done/save/finish button
  is better than all of them submitting on colapse.. as then there is no
  aboard"). The reason is his ranker's: every refetch will one day run
  the whole personalized ranking, so five taps must never mean five
  rankings — one re-query per visit. Revisited only if readers turn out
  to expect collapse-to-submit. (Four editing sheets apply live since,
  and every way out just closes them — §4, *Sheets*, the editing-sheet
  exemption, 2026-10-02.)
- **The post detail's way back names its origin**, by a table built
  from its arriving edges, as the tag page's is (the detail, the clip
  detail, its veiled twin and `Removed`):

  | Where the reader came from | The label |
  |---|---|
  | the feed, in any of its states | `Back to feed` |
  | Explore, mid-query | `Back to the search` |
  | Saved | `Back to Saved` |
  | History | `Back to History` |
  | Notifications | `Back to Notifications` |
  | your own profile | `Back to your profile` |
  | another's profile | `Back to the profile` |
  | a tag's page | `Back to #<thattag>` |
  | another post, through its references or Cited by sheet | `Back to the post` |
  | the stream, by its score's door | `Back to the stream` |
  | nowhere — a link | `Back to feed` |

- **So does a profile's** (the profile, its held, posts and comments
  views, the deleted husk, not-found and unreachable), which drew a bare
  `Back` and now draws the cold label:

  | Where the reader came from | The label |
  |---|---|
  | the feed, in any of its states | `Back to feed` |
  | a post — its author chip, opinions or references | `Back to the post` |
  | the comments sheet | `Back to the comments` |
  | the stream | `Back to the stream` |
  | Notifications | `Back to Notifications` |
  | Saved | `Back to Saved` |
  | History (jakob 2026-10-05) | `Back to History` |
  | a profile's opinions list | `Back to the opinions` |
  | Explore, mid-query (jakob 2026-10-07) | `Back to the search` |
  | a tag's page | `Back to #<thattag>` |
  | nowhere — a link | `Back to feed` |

- **What comes back.** A sheet that launched a forward navigation comes
  back at its offset with its branches expanded; the cite's wizard X
  returns the thread as it was; a process the OS ended restores by the
  platform's convention; a restart is a cold launch only. The re-tap
  ladder's *transient* and *session* bullets say so.
- **Sheets and the pad are modal** for assistive tech — focus in,
  contained, returned (`BottomSheet`, the pad's `aria-modal`) — under
  §10's four focus rules. The comments sheet is modal at one detent; the
  sliver above the filter is visual only.
- **The law's consequences.** The feed's, search's and settings'
  filters stage their chips and commit on `Done` (`FilterFoot`, the
  staged reading); the `?` text says `Nothing changes until you press
  Done`. `ComposeLicense` commits on Done and the seal's row reads the
  pair by one joining rule (`licenseSummary`), `your default` gone.
  `ComposeSensitive` opens switched on, its reason disabling (and
  dropped at signing) with the switch off; at edit, a post the platform
  veiled reads `Also veiled by the platform's verdict` under the row.
  The pad sheets drag only from the handle and title zone, and every
  dismissal discards as the scrim does.
- **The grammars, stated once** (§4, *Sheets*): M3's modal-sheet drag
  (handle or a list at scroll-top, ~25 % or a fling, snap-back, no
  detents) and the platform photo viewer's (double-tap to ~4×, pan wins
  zoomed, reset on paging, ~20 % or a fling to close, plain close under
  reduced motion).
- **One dialog anatomy** (§11, *Dialogs*): `DialogSurface` takes
  `title`, `body` and `actions` by M3's spec — the body on
  `onSurfaceVariant`, the default button size, end-aligned — and every
  question dialog on both trees moved onto it; the key dialogs lose
  their small, split buttons. Scrim, Escape and Back take the safe
  answer, now wired on `GuestGate`, `DiscardConfirm`,
  `ComposeDraftDiscard` and `SealDiscardConfirm`, and named on every
  dialog's scrim edge.
- **Landing on a comment** is one statement for every deep link (§4):
  scrolled to the sheet's top, its branch expanded, a brief tonal
  highlight that fades (jakob: "yes that sound great"); a stale
  approval row lands on Invites with no notice. The `ReplyEntry` sidecar
  carries it, with the sheet's return.
- **Flagged for blessing** (copy-voice): `Back to Saved`, `Back to
  History`, `Back to Notifications`, `Back to the stream`, `Back to the
  opinions`; `Nothing changes until you press Done`; the license joining
  rule and its eight non-zero readings; `Also veiled by the platform's
  verdict`. The lane's calls are backlog item 124.
- **The gate**: **243 screens**, 1673 → **1680 edges** (three filter
  `Done`s, four dialog scrims), 1 gap, **flows 64**, every one resolved.
  The witness was re-blessed twice, deliberately: the filter flows end on
  `Done`, and the search's comment row lands on the comment.
### The applicant fix round — 2026-10-02

jakob's morning review of the applicant pages and the vouch pair (C13
revised by N2 (b), F4, F6, F7, the five applicant items), as recommended
unless named.

- **Any first opinion ends the borrowed view.** Their own graph exists,
  so their own feed does: the member's first signed opinion, on anyone,
  hands the feed over, and the vouch-back is not the gate. The band asks
  for nothing — `Browsing from @mira's view — your first opinion starts
  your own.` — and the vouch card's way out puts it away for good,
  silently. Vouching back stays possible forever from @mira's profile:
  any opinion on her is the vouch-back and opens `VouchedIn`.
- **The vouch card wears the olive register** (`VouchBackCard`): the
  account-notice ground and ink, the committing button in `inverse`, the
  way out in the panel's ink.
- **The landed ask opens the person** (`VouchAskUnusable`): `See @noor's
  profile`; the waiting case keeps the back arrow alone.
- **The applicant-foot family**, jakob's words, blessed: `You can comment
  once you're in.` on the comment foot and `Reply`, `You can invite once
  you're in.` on `Invites`. The foot wears auth.md's locked look —
  inactive, still tappable — drawn by `ReplyEntry`'s reader chip.
- **The landing card's key-elsewhere variant offers `Restore the key`**:
  restoring here lets the registration land here.
- **The ask link's permanent home is `ProfileApplicant`**; Settings
  carries none.
- **An applicant's account deletion is immediate** — no 7-day grace,
  since nothing has landed (`Settings`' applicant table, `DeleteAccount`).
- **The turned-down shell's seal exit**: `Your post waits — it arrives
  when someone vouches you in.` The rejected card's one way forward is
  the ask link.
- **Flagged for blessing**: the band's landed line, `See @noor's
  profile`, the seal exit's line. The lane's calls are backlog item
  128.
- **The gate**: 267 screens, 1785 → **1786 edges**, 0 gaps, **flows
  65**, every one resolved. The witness was re-blessed twice,
  deliberately: the vouch-back flow's description, and the landing
  card's restore door joining `restore-your-key`'s start.

### The kept picks and the pads, ruled — 2026-10-02

jakob's morning review ruled the kept picks' seven questions (backlog item
113) and the pads round's residue (item 121), every one as recommended,
with kept picks 2 dissolved by the never-delete law.

- **The anchor follows the key.** With the key back and the review left
  unsigned, a kept pick's line reads `Waiting for your review` and its tap
  opens `KeptPicksReview` (`StanceControl`'s `pendingReview`); with the key
  gone again, `Waiting for your key` and the key notice return.
- **The review lists plain opinions only.** A kept vouch-back or approval
  never joins the batch; a kept vouch-back surfaces as its own card,
  keeping its ceremony (`VouchedIn`).
- **Rows stay honest.** Nothing vanishes and signing stays valid; a
  target removed or redacted while its pick waited wears the removed-mark
  face on its row (`StagedReference`'s `removed`). A pick that would sever
  its bundle says so inline in the family's landing words
  (`consequence`), the `Remove citation` idiom; Sign is the confirmation
  and the batch raises no `SeveranceConfirm`.
- **The write rule mirrors the reply's**: reached from `KeptPicksSeal`,
  the fact ends `your picks are still kept.` and `Not now` returns to the
  review. A drop is spoken `Removed — 2 picks left.`, focus to the next
  row. The settings row shows only while the key is here and unsigned
  picks wait.
- **The pads.** The comment edit's mirror of the withdrawal package is
  ruled ("same semantics at comment scale") and filed as its own bite
  (backlog 126). The untypeable citation's note reads `Comes
  along as it is.` The upload gate names its content, `…signing waits for
  the video.` on a clip (`UploadStatusLine`'s `media`). `Done` on an
  untouched `RefPairEdit` pick stages nothing, as the scrim: an untouched
  pad never makes an act. On a gated seal signing proceeds when the
  uploads land — the reader already pressed Sign; the gate waits only for
  bytes. A tag withdrawal is one record — one fresh 0,0 layer,
  newest-wins; the drawing counts 1 act.
- **Flagged for blessing** (copy-voice, *The key's lifecycle*, *Faults by
  code*, *The pads and the edit's withdrawals*): `Waiting for your
  review`, `Removed — 2 picks left.`, the removed row's × name, the
  landing words reused as the severance line, `Nothing was signed or
  spent — your picks are still kept.`, `…signing waits for the video.`,
  `Comes along as it is.` What the drawings still owe is in items 113 and
  121.
- **The gate**: **267 screens**, **1785 edges** (two gain an outcome:
  `Not now` back to the review, the untouched `Done`), 0 gaps, **flows
  65**, every one resolved; the witness did not move. New sidecar:
  `RefPairEdit.md`.

### The nav-noun sweep — 2026-10-02

The drill-ins the navigation-and-sheets round's tables did not reach
(backlog 124; jakob: "Nav rest: yes") name their origin the same way,
every noun already ruled. Each board draws the state its table marks
as the board's own; the back edge in `graph.json` carries the table.

- **The score's trace** (`FeedEntry`, `FeedEntryMoved`): `Back to feed` from the feed in any of its states (drawn),
  `Back to the post` from a post's detail, clip detail, veiled twin or
  `Removed`, `Back to #<thattag>` from a tag's page, `Back to the
  profile` from another's posts, `Back to your profile` from the
  reader's own, `Back to History` from History (jakob 2026-10-05).
- **The stream** (`Reel`, `ReelSensitive`): `Back to feed` from the feed
  it narrowed (drawn), `Back to the post` from a post's pinned clip,
  `Back to the profile` from another's posts, `Back to your profile`
  from the reader's own, `Back to History` from History (jakob
  2026-10-05).
- **The opinions page** (`ProfileStances`): `Back to the profile`
  (drawn; another's profile) or `Back to your profile` (the reader's
  own). It drew a bare `Back`.
- **Notifications** (both boards): `Back to feed` (drawn), `Back to
  Explore`, `Back to Wallet` or `Back to your profile`, by the root the
  bell was tapped on. It drew a bare `Back`.
- **About**: `Back to settings` (drawn; settings opens it). From the
  join form it reads a plain `Back` — the funnel exception (§4). It drew
  a bare `Back`.
- The two off-slot dialogs (`StanceAlternates`, `ReplyKeyAbsent`) are
  fine as they stand, different anatomies.
- **The gate**: 268 canonical screens, 1785 edges, 0 gaps, **flows 65**,
  every one resolved; the witness did not move, no rebless. No new
  string: every label is already blessed.

### The no-expiry correction — 2026-10-02

jakob's morning review (the fix round's entry lane): an application has
no timer, and an invite link does not care who is signed in.

- **The one expiry is the verification reap, at seven days** (jakob: a
  day is short enough for a mail outage on our side to cost accounts).
  The window runs from registration and an address change does not
  restart it; the verify card says the consequence once, in the seven
  days' words. A verified applicant waits on a vouch with no timer, and
  an invite link's expiry bounds only the registration made through it
  (auth.md, *Expiry*).
- **A waiting or turned-down applicant's way in is a vouch** — the member
  whose approval is in play, or anyone through the ask link. No board
  draws a lapsed application or a second invite for an account that
  exists.
- **Invite links ignore sign-in.** One person may hold several accounts,
  so a live link opened while signed in opens `Join` as a layer holding
  the link; `Create account` switches this device to the new account,
  the other's sessions staying valid, and back closes the layer onto the
  signed-in state (§4, the layer law).
- **The entry funnel's residue, ruled** (backlog item 122): a dead
  invite link's arrival says `This invite link has expired.` once, over
  the unchanged landing; `DeleteAccountConfirmed` committed unticked
  stands confirmed account-only; the member who already has the asker
  queued lands on `Invites`; `JoinInvalid` promises nothing about an
  earlier account; an ask link that resolves to nobody opens
  `VouchAskInvalid`, in `JoinInvalid`'s idiom, its arrow its one exit.
- **Flagged for blessing** (copy-voice, *The fix round's entry lines*):
  the verify card's seven-day line, `JoinInvalid`'s paragraph and
  `VouchAskInvalid`'s paragraph. The lane's calls are backlog item
  127.
- **The gate**: 267 → **266 screens**, 1785 → **1781 edges**, **flows
  66**, every one resolved. The witness was re-blessed once,
  deliberately, for the new board's flow.

### The filter-and-olive round — 2026-10-02

jakob's morning review: the filter's foot, the newer-version doors, the
curate residue and the olive split.

- **Every filter sheet's foot is `Reset` and `Done`** (`FilterFoot`) —
  the feed's, search's and the settings sheet's. No read-back of the
  staged filter (jakob: it cannot scale past a few changes), and no
  Reset row in the body. The topic section closes the feed sheet's
  body: it is the one that grows, so it never pushes a fixed section
  below the fold.
- **The default is the reader's** (pass C 10). It is the app's until
  the reader sets their own in Settings, theirs after; a feed's `Reset`
  stages it and the trigger speaks deviations from it. CoGra's own
  default comes back only in Settings, whose sheet's `Reset` stages it.
  Search's `Reset` stages search's own resting state (`Everything`).
- **`Update now` leads to the download, never to the code.** The
  newer-version snackbar's action and `WhatsNewBehind`'s door open
  CoGra's Play Store listing — a placeholder id until published, like
  the `.local` addresses — and on the web reload into the new version.
  What's new is the notes page and sends nowhere else: no release
  carries a door, and the footnote reads `Newest first.`
- **The dateline names what a version is to this device** (curate 1):
  the running one `installed`, a release past it `newest`, which
  heads the behind state's list.
- **The words path has its own details board** (curate 2,
  `ComposeDetailsWords`): the picture stage minus the media row, the
  describe row and the Description. `ComposeWords`' Next lands on it.
- **A signing seal's locked ways out keep their face** (curate 3): inert
  for seconds, never dimmed.
- **The olive split** (§4, *Colour*). Every feed card that needs the
  reader's action wears the account-notice register — `TaskCard`'s
  `tone="notice"`, `inverse` fill, the card's inks scoped to the
  register's on-pair for contrast: verify the email, create, restore or
  bring the key, the security notice, a closed application's way back
  in, and the vouch-back. Waiting, approved-and-landing and a post that
  didn't land stay on the feed card's ground.
- **Flagged for blessing** (copy-voice): `Update now`, `Update to version
  0.1.3`, `installed`, `newest`, the footnote `Newest first.`, and the
  foot's `Reset` at its new seat.
- **The gate**: 267 → **268 screens**, 1785 → **1795 edges**, 0 gaps,
  **flows 65**, every one resolved. The witness was re-blessed once,
  deliberately, for the new board: `publish-words` walks
  `ComposeDetailsWords`, and `+ Cite something` starts on 13 boards.

### Pass C's rulings — 2026-10-02

jakob's morning review ruled the behaviors pass C had filed, as
recommended unless named. Each lands in its board's sidecar; the laws
below have their home here or where named.

- **Compose.** The cover step's Next before a pick proceeds coverless,
  frame 0 the face. The counting sheets at the fold's edge switch the
  seal's row to its single reading live beneath the sheet, and removing
  the last closes the sheet. The body fork's switch asks first when the
  body holds something and switches silently when empty. The words
  stage's Next on an empty body is inert. An edit's × on a pick made in
  the same edit unstages it.
- **The viewer's ways out** are the X, a swipe down and Android's Back,
  everywhere, and a backdrop tap where one is visible — the reel
  round's record, `MediaViewer` and the viewer boards now read alike.
- **The stage.** A play-disc tap makes its clip the incumbent. A comment
  card's clip is drawn and registered (`FeedCommentShapes`, node
  `feed.commentCard`), so the stage law names both clip paths.
- **The feed.** `Feed.md` carries the re-tap ladder's rungs. `Back to
  top` waits for 3 viewport-heights. The bell's dot lights on a root's
  next load, never live. Hiding from the post detail keeps the reader
  there under the same snackbar. Explore at rest takes no pull-down
  (*The bottom bar's re-tap ladder* holds jakob's reason).
- **Comments.** Square is the comment scale's shape in every docblock.
  The comment edit asks only when it changed since it opened,
  `Discard the changes?`; a bug notice at comment scale offers `Discard
  the reply` or `Discard the edit`. Your topics' strongest-first order
  is blessed. Screens write MB; the caps stay enforced in MiB.
- **Search.** `ExploreUnscoped` draws item 105's line for Comments with
  no scope.
- **Flagged for blessing** (copy-voice): `Discard the edit`. The open
  residue is backlog item 130.
- **The gate**: **268 screens** (267 + `ExploreUnscoped`), 1785 →
  **1793 edges**, 0 gaps, flows 65, every one resolved; `nodes.json`
  gains `FeedCommentShapes`, 145 → 149 paths. The witness was re-blessed
  once, deliberately: the four compose flows' `New post` start counts 51
  boards.

### The applicant residue, ruled — 2026-10-02

jakob's afternoon answer to the fix round's brief (items 1–9, 24, 25;
backlog 125, 127, 128), as recommended, his wordings blessed.

- **The nouns.** Notifications' table gains `Back to Wallet` — Wallet is
  not in the MVP and is still a place to go back to. From the join form
  About's arrow stays a plain `Back`, the funnel exception, as `Join`'s
  own does (§4, *Navigation*).
- **Dead links.** One word for every dead invite link — expired, used up,
  revoked or resolving to nothing: `This invite link has expired.` Opened
  signed in, a dead link moves nothing: the reader stays where they were
  and hears the same snackbar. Nothing drawn (`Main`'s docblock).
- **`Join` signed in** keeps `Already have an account? Sign in` — the
  account-switch door.
- **The vouch card's way out reads `Got it`**: the dismissal is for good,
  and the way back to vouching is @mira's profile, forever.
- **The applicant's locked controls.** A comment's `Reply` and the
  profile's `Invites` wear the comment foot's locked look — visibly
  inactive, still tappable, the tap answering with the family line
  (`CommentCard`'s `replyOpacity`, `ProfileHeader`'s `invitesOpacity`;
  `ReplyEntry`'s reader chip locks the thread's Reply buttons too). An
  applicant who opens an ask link hears `You can vouch once you're in.`
- **An applicant's deletion with an unverified address** is confirmed in
  the app; no emailed link gates it (`DeleteAccount`, `Settings`).
- **About's applicant topic** closes on `If your application is closed,
  your account stays — anyone can still vouch you in.`
- **Invite-link expiry and the seven-day verification window are
  independent** (auth.md, *Expiry*): the presets carry no floor, and an
  account made through a link that expires in an hour keeps its seven
  days.
- **Blessed** (copy-voice): `Back to Wallet`, `Got it`, `You can vouch
  once you're in.`, About's line.
- **The gate**: 268 screens, 1800 edges, 0 gaps, **flows 66**, every
  one resolved; the witness did not move, no rebless.

### The what's-new restore and the filter residue — 2026-10-02

jakob's afternoon review of the fix round, rulings 0 and 10–19.

- **The release cards keep their doors** (ruling 0: "this is the actual
  list of patch notes and the only door to the deeper level"). Every
  card on `WhatsNew` and `WhatsNewBehind`, the newest included, ends in
  `See it on GitHub`, named for its release, onto `RELEASES_URL` +
  `/tag/v<version>`. `Update now` leads to the download only; the
  footnote stays `Newest first.`
- **One default object everywhere** (10–12). The trigger speaks
  deviations from the reader's default, a deviation back toward the
  app's included, and the summary keys on that default. The reader's
  Settings default reaches search's order and seen toggle; search's
  kinds stay its own. The filter's "?" says `Reset brings back your
  defaults, to change them go to settings.` — jakob's words.
- **The olive lane calls stand** (13), as drawn.
- **The body fork asks** (14), `ComposeBodyDiscard`: `Discard the
  words?` or `Discard the pictures?` over `The rest of the draft
  stays.`, a quiet `Discard` and a filled `Keep them` — the master
  dialog for both directions, drawn over the words stage.
- **Pass C's residue** (15–19). A rotated phone's side ground is a
  backdrop the tap closes on. A clip the reader started by hand is never
  stolen: the hard top re-elects autoplay-eligible stages only, on the
  feed and in the thread. The comment-scale bug notice's discard acts at
  once. A mixed unscoped search keeps its results with the scope line
  under them. Only a fresh root load lights the bell's dot.
- **Blessed** (copy-voice): `See it on GitHub` and its spoken names, the
  Reset sentence, and the fork ask's words. The open residue is backlog
  item 131.
- **The gate**: 268 → **269 screens** (`ComposeBodyDiscard`), 1800 →
  **1805 edges**, 0 gaps, flows 66, every one resolved. The witness was
  re-blessed once, deliberately: `publish-words`, `cite-a-post` and
  `mention-someone` walk `Write words instead`'s empty case.

### The kept picks drawn — 2026-10-02

jakob's afternoon review ruled the fix round's open drawings (the fix-fix
round's 20–23), every one as recommended, every wording blessed.

- **The gated commit stays enabled.** While the uploads run, `Sign and
  publish` and `Sign comment` are drawn as at rest. Pressed, each swaps
  in place to its in-flight word, the failure pack's idiom with the ways
  out locked, and signing proceeds the moment the bytes land, with no
  second press. `disabled` is now only the failed upload's
  (`ReplySealUploadFailed`). New sidecar: `ReplySealUploading.md`.
- **The review's rows draw all three states.** `KeptPicksReview` shows
  a plain pick, a severing pick saying `This takes you back to zero.`
  under its kind, and a pick whose post its author removed, which wears
  the removed-mark face with its × in its seat. `KeptPicksSeal` reads
  that target by its mark too.
- **The post-restore anchor** is `PadPendingReview`, `PadPending`'s twin
  plate: the everyday feed, the kept pick on the face and `Waiting for
  your review` under it. The feed's stance-face edge carries the tap to
  the review.
- **A kept approval is the kept vouch-back's twin.** It gets its own card
  on Invites, where approving lives, keeps its ceremony through
  `ApprovePad`, and never joins the batch. It is written in the
  docblocks and on both pads' key-elsewhere cases, with nothing new
  drawn.
- **The untypeable citation's row** stands on `EditCompose` with the
  target's standard summary line in its name slot and `Comes along as
  it is.` under it. It has no ×, opens nothing, and goes uncounted
  (`StagedReference`'s `untyped`). The edit's fields now scroll under its
  pinned foot.
- **The gate**: 268 → **269 screens** (`PadPendingReview` at the foot of
  the patterns page's `PadPending` column), **1800 edges** (the feed's
  stance face gains one outcome), 0 gaps, flows 66, every one resolved, 132 sidecars. The
  witness did not move. The open residue is backlog item
  132.

### The residue round — 2026-10-02

jakob's third ruling round, on the fix-fix round's residue.

- **No citation is untypeable in the MVP.** Only CoGra writes the graph,
  so every citation's target is one this app can type. `EditCompose`
  draws no such row, and `StagedReference` carries no `untyped` or
  `note`. The edit's fields keep scrolling under its pinned foot. The
  row, the withdrawal's addressing by L1 identifier and the target's
  face beyond this app wait for L1 (backlog 133).
- **The comment-scale bug notice's discard asks first**, one grammar
  with the post scale: `Discard the reply` and `Discard the edit` open
  `DiscardConfirm`'s ask.
- **The filter pill speaks each axis's state, never the direction.** A
  state reads the same whichever default it departs from; the drafted
  words for the back-deviations wait for blessing (copy-voice, *The
  filter pill's state words*). The filter's "?" keeps only jakob's
  Reset sentence.
- **A clip's fork ask** reads `Discard the video?` / `Keep it`.
- **The gated press.** A held Sign press drops when an upload fails;
  `Retry` re-gates and the reader presses again. The slow line counts
  from the press.
- **`VouchAskInvalid` keeps back as its only exit.**
- **The gate**: **270 screens**, **1805 edges**, 0 gaps, flows 66, every
  one resolved, 133 sidecars. The witness did not move. Backlog 127 and
  132 close; 131 holds only the flagged state words.

### The pill's full set — 2026-10-02

jakob's last two words of the day (backlog 131, closed): the five
state words are **blessed** (`all forms`, `hiding seen`, `+ still
settling`, `hiding sensitive`, `hiding removed`), and the kinds head
at the full set reads **`All kinds`**, never the count —
`feedFilterSummary` says it, `FeedKinds` draws it, and its witnessed
edge label follows (`filter chip (All kinds)`), re-blessed
deliberately, that one line the whole diff.

### The comment edit's withdrawals — 2026-10-02

jakob's ruling (backlog 126, closed): the comment edit takes the post
edit's withdrawal package unchanged at comment scale, drawn as its own
bite.

- **`CommentEdit` draws the package.** Its body is `CommentEditBody`, the
  comment's anatomy carrying `EditComposeBody`'s blocks. A standing
  citation is a row that opens `RefPairEdit`, with the × that withdraws
  it. `#coastroad` and `Tide tables and the third headland — @juno` stand
  withdrawn, each on its `Withdrawn:` line with its `Undo`, and the
  fields scroll under the pinned foot.
- **`RefPairEdit` is the master at both scales**, as `TagPad` already
  was: the comment's rows open the same sheet, `Remove citation` and its
  inline cost included, and Sign is the confirmation.
- **`CommentEditActs` counts the complete kind set in records.** It
  stands on `CommentEditBody` and reads `5 things, signed together`:
  `Edit`, `Tags added`, `Tags withdrawn` at one record, and `Citations
  withdrawn` at the citation's two counter-records.
- **The sidecars say the same at both scales.** A citation's withdrawal
  counts its counter-records, the `Undo` line unstages it, and each acts
  row counts the records its kind signs, on `EditCompose` and `EditActs`
  as on the comment's. The acts-footer edges read the footer's own
  `You're signing N things`.
- **No new string.** Every word is the post package's blessed wording.
  What the drawing leaves open is backlog `134`.
- **The gate**: **270 screens**, 1805 → **1809 edges**, 0 gaps, flows
  66, every one resolved, 133 sidecars. The witness did not move.

### The applicant remainder, ruled — 2026-10-02

jakob's evening answer to backlog item 128's six open bullets ("1-6 all
as recommended, the wordings are blessed").

- **The vouch card and pad claim no order** — a member may opine on
  others first while the card stands. The body reads `Vouch back to open
  the way from your side — your opinion toward @mira, and your feed grows
  from it.`; the pad, its "?" and its first coaching line open on `Your
  vouch back`. The band's line keeps *first opinion*: the borrowed view
  ends on the first opinion, whoever it's toward.
- **A for-good dismissal is account state** (auth.md); the contract half
  rides the seam.
- **The landing card's key-elsewhere body admits both doors**: `Your key
  was made on another device — open CoGra there, or restore the key to
  land here.`
- **The turned-down shell's opinion and topic** wait for a vouch, in the
  seal exit's grammar: `Your opinion waits — it arrives when someone
  vouches you in.` and `Your topic waits — it arrives when someone
  vouches you in.`
- **An applicant's deletion is `DeleteAccount`'s applicant case**: `Nothing
  has landed yet — deleting removes your application and your account
  right away.`, one commitment that deletes at once and lands the reader
  signed out on the bare view; the mail, the grace boards and
  `DeleteAccountConfirmed` stay the member's (`DeleteAccount`'s sidecar).
- **`ReplyEntry`'s applicant reading holds only others' comments**: the
  foot's face is @juno's, and @sol's comment carries no `Edit`.
- **Flagged for blessing**: the vouch pad's "?" first paragraph and
  `Delete my account`. The lane's calls are backlog item 135.
- **The gate**: 270 screens, 1805 → **1806 edges**, 0 gaps, flows 66,
  every one resolved, 133 → **134 sidecars**. The witness did not move.

### The 134 and 135 residue — 2026-10-05

jakob's answer to backlog items 134 and 135 ("0. correct · 1. as
recommended · 2. fine · 3. both as recommended · 4. as recommended · 5.
yep · 6. yes"). Every quoted wording is blessed unless marked.

- **The 128 round's two flagged strings are blessed**: the vouch pad's
  "?" first paragraph and `Delete my account`.
- **The pads name their opener.** `TagPad` and `RefPairEdit` read
  `Signed with the comment, as its own action.` when the comment edit
  opens them and keep the post's line otherwise; an `opener` chip draws
  both.
- **The comment's standing citation stays** `Sunday at the tide market —
  @mira`.
- **A standing citation whose target was removed wears the removed-mark
  face** at both scales, `KeptPicksReview`'s face and words: the tile
  empty, `Removed by its author` where the name stood, the pair and both
  controls kept. A `target` chip draws it on `EditCompose` and
  `CommentEdit`, and its controls are named by the mark (flagged).
- **An edit that took new pictures gates its Sign on the upload**, in
  the seal's grammar: `UploadStatusLine` over the foot, `Sign the edit`
  enabled, `Signing the edit…` once pressed, the held press dropped by a
  failed upload, the slow line counted from the press. Recomputed from
  the graph, the edit's Sign meets fresh media on four boards — the two
  video twins (a new cover) and `EditCompose` and `CommentEdit` (new
  pictures); `EditWords` turns into a picture or video edit when media
  arrives, and `EditComposeUnchanged`'s Sign is the empty batch's. An
  `upload` chip draws the gate on all four; a cover reads `…signing waits
  for the cover.` (flagged).
- **The turned-down shell's post answers with the vouch line** — the
  menus' `Cite in a new post` and `Mention in a new post`, and
  `ApplicantRejected`'s `New post`: `Your post waits — it arrives when
  someone vouches you in.` A first post there waits until someone
  vouches the reader in.
- **Settings' deletion footnote has an applicant case**, `Nothing is
  deleted here. The next screen says what goes and what stays.`, drawn
  by a reader chip.
- **The bare view answers an applicant's deletion** with one snackbar on
  arrival, `Your account is deleted.`
- **The gate**: 270 screens, 1810 edges, 0 gaps, flows 66, every one
  resolved, 134 sidecars. The witness did not move. What the round left
  open is backlog `136`.

### Pass C's applicant and vouch sidecars — 2026-10-05

jakob's pass C remainder plan (ruled as recommended), the applicant, vouch,
intro and arrival lane: prose only, no board touched.

- **Nineteen sidecars**: the six applicant boards (`ApplicantFeed`,
  `ApplicantEmail`, `ApplicantKeyElsewhere`, `ApplicantWaiting`,
  `ApplicantLanding`, `ApplicantRejected`), `FeedBare`, the five intro
  cards, the ask link's four boards (`VouchAsk`, `VouchAskPad`,
  `VouchAskUnusable`, `VouchAskInvalid`), `VouchBack`, `VouchBackPad` and
  `VouchedIn`.
- **Their words** are each board's docblock and its graph edges, the
  applicant and vouch records above (*The applicant's life round* through
  *The 134 and 135 residue*, *The vouch-back ceremony*, *The invites
  round*, *The entry funnel round*), copy-voice's staged-act, entry-funnel,
  ceremony and Invites sections, and auth.md's application and landing.
- **`VouchBackPad` is the master pad**, so its sidecar carries the
  vouch-back and the plain opening apart; both vouch pads name
  `PadFailed`, `PadWriteRule` and `PadKeyAbsent` for the states they share.
- **No new string.** `Changing email…` is the in-flight construction.
- **The gate**: 270 screens, 1810 edges, 0 gaps, flows 66, every one
  resolved, 134 → **153 sidecars**; the boards came back byte-clean. The
  witness did not move. The filed questions are backlog
  `13X-passc-entry-b`.
### The settings behavior pass — 2026-10-05

Pass C's remainder (jakob 2026-10-05, the plan as recommended), the
settings domain: transcription only, and behavior no source settles is
filed for jakob's review rather than written.

- **Twenty-seven sidecars**: `Settings` with its three sheets and its two
  in-flight states, the key backup's four screens, the six credential
  boards, the deletion tail's three, the sign-out ask, About, What's new
  and its behind state, the report and its empty state, the wallet door
  and the "?" dialog. Each line comes from its board's docblock, its
  graph edges' cases, the records here and copy-voice, in their words;
  the in-flight labels are copy-voice's construction (*In-flight labels*)
  and add no string.
- **No board moved and nothing was ruled.** The open questions — among
  them the handle change's think-twice ask, the words of the settings
  snackbars, an unverified applicant's Email row and About's opening
  state — wait in the lane's filed list for jakob's one ruling brief.
- **The gate**: 270 screens, 1810 edges, 0 gaps, flows 66, every one
  resolved, 134 → **161 sidecars**. The witness did not move.
### The entry behavior pass — 2026-10-05

Pass C's remainder (jakob 2026-10-05, the plan as recommended), the
entry lane: the invite door and the join form, sign-in, the reset, the
verification landings, the key ceremony, restore and the key export.

- **All 31 boards have their sidecars**, transcribed from each board's
  docblock, its graph edges' cases, the records above (*The entry flow*,
  *The input-error round*, *The audit states*, *The key-loss round*,
  *The entry funnel round*, *The applicant's life round*, *The
  no-expiry correction*), copy-voice and auth.md. Nothing was ruled in
  the pass, and no board moved.
- **The commits' in-flight labels follow the failure pack's
  construction** (copy-voice, *In-flight labels*); back from About keeps
  the join form as it was left.
- **What no source settles waits for jakob** as the lane's filed
  questions (backlog `13X-passc-entry-a`): a form's offline words and
  slot, the wait past 5s off a seal, the two commits the construction
  cannot form, the funnel's system Back, the dead reset link, and the
  contradictions found on the way.
- **The gate**: 270 screens, 1810 edges, 0 gaps, flows 66, every one
  resolved; 31 sidecars added. The witness did not move.
### The pads, seals and system behavior pass — 2026-10-05

Pass C's remainder, its pads, seals and system lane (jakob 2026-10-05, the
plan as recommended: transcription only, unruled behavior filed, never
invented).

- **Twenty-six boards carry their sidecars**: the pad standing, failed,
  refused by the write rule and without its key, and the approval pad; the
  kept pick's two anchor plates; the walk-back and the invites' two close
  dialogs; the hold's two row plates; the seal signing, slow, faulted on a
  row or by a bug, its discard ask, its write rule, the kept picks' seal and
  the reply's failed gate; `NetworkError`, the guest landing, the two
  not-found pages, the newer-version snackbar and the security notice.
- **The seal grammar is stated once**, in `SealSigning.md` and
  `SealSigningSlow.md`: nothing under 200ms, the label swap from 200ms, the
  slow line past 5s, each counted from the press; the ways out locked
  without dimming; the gated commit enabled, its held press dropped by a
  failed upload. The two honest faults, the fault readings by code and the
  discard that asks first at both scales stand in `SealFaultRow.md`,
  `SealFaultBug.md`, `NetworkError.md` and `SealDiscardConfirm.md`.
- **What no ruling answers stays out of the sidecars** and waits for jakob
  as filed questions (backlog `13X-passc-pads-system`).
- **The gate**: 270 screens, 1810 edges, 0 gaps, flows 66, every one
  resolved; 26 new sidecars. No board moved.
### The profile behavior pass — 2026-10-05

Pass C's remainder, the profile domain (jakob 2026-10-05, the plan as
recommended): every board on the profile page, and the four post-ladder
reference boards, carries a sidecar in `designs/canonical/behavior/`,
transcribed from its docblock, its graph edges, the records above and
copy-voice. Nothing was ruled in the pass.

- **33 sidecars**: the own, applicant, other, held and deleted profiles
  with their tabs, menus and fault states; the opinions page; the edit,
  the picture's crop and both seals; Saved, History and Notifications
  with their empty and undo states; the invites pages; and the ladders,
  whose lines are shape invariants in `FeedShapes`' manner.
- **What no ruling answers stays out of the sidecars** and waits for
  jakob as filed questions (backlog `13X-passc-profile`). The audit's
  parked items on these surfaces stay parked where they are.
- **The gate**: screens, edges, flows and boards unchanged; 33 new
  sidecars, every one green.
### The 136 round — 2026-10-05

jakob's answer to backlog item 136 ("1-5 all as recommended"). Every
quoted wording is blessed unless marked.

- **The residue round's three flagged strings are blessed**: the gate's
  cover noun and the removed-target citation's two spoken names.
- **An edit's slow line stands under its acts footer.** `ActsFooter`
  takes an optional subline, the seals' `Still signing — the network is
  slow right now.`, once an edit's signing runs past 5s from the press,
  in the slow olive and spoken once as a status, outside the footer's
  button; it goes when the signing answers. It holds for all five edit
  boards, gated or not; `EditCompose`'s `signing` chip draws it once,
  with `Sign the edit` reading `Signing the edit…`.
- **A failed upload on an edit marks its tile too.** The edit's media
  row fails the compose way — the tile badged, `One picture didn't
  upload.` under the row with `Retry · Remove it` — and the gate line
  takes its fault reading with `Sign the edit` disabled. `Remove it` on
  the failed new picture un-gates Sign. The video twins fail on the
  cover. `EditCompose`'s `upload` chip draws it as `failed`.
- **A removed target is marked on its pair sheet, never named.**
  `RefPairEdit`'s title reads `Post, Removed by its author`, and its
  non-drag route `Set exact values for Post, Removed by its author`; a
  `target` chip draws it over the row's own removed face.
- **The pads' comment opening is the chip and the sidecars.** No sheet
  is drawn over the comment edit; opened there, `TagPad` and
  `RefPairEdit` differ only in the foot line's noun.
- **The fixtures stand as drawn.** `EditCompose`'s two pictures were both
  added in the edit, so `Uploading 1 of 2` is true; `CommentEdit`'s gate
  noun counts, `Uploading 0 of 1 — signing waits for the picture.`
  (flagged); `EditComposeVideo` keeps its cover and its counts.
- **The gate**: 270 screens, 1810 → **1812 edges** (`EditCompose`'s
  `Retry` and `Remove it`), 0 gaps, flows 66, every one resolved, 134
  sidecars. The witness did not move.

### The K13 round — 2026-10-05

jakob's rulings on the audit's nineteen accessibility and rubric
systemics (K13.1–K13.19), as recommended — haptics corrected the same
day: the tick is kept, and there are no UI sounds.

- **Motion is one table** (§4): forward, back, tab fade-through, sheet,
  dialog, the pad's bloom as the dialog's entrance, the scrim, the media
  handover and the reel's squish as shared elements and arrival
  exceptions, the collapsing top, in-place changes, `Back to top` and the
  hold's ring; predictive back follows the finger. `motion.css` and the
  Motion card rewrite the stale long-press row.
- **Haptics only where the platform documents one, Android only** — the
  hold's commit, the reorder's lift, the knob's tick at the zero lines
  and the clamp — **and no UI sounds** (§4). jakob's phone has no
  vibration, so the hand test cannot cover them; review and any device
  at hand do.
- **Fields know their keyboard** (`TextField`'s kind table: keyboard,
  caps, correction, autofill, return key; `mono` is the one-time-code
  kind), each composer states its arrival focus, and **credential forms
  name their account by the login email** (`PasswordField`; hidden
  usernames on `ChangePassword` and `ResetNew`; a handle is `nickname`).
- **Targets and states conform** (§4): `cg-hit` and the state layer on
  every master named; a door card lights whole (`cg-door-card`);
  `Button`'s disabled is 0.38. **The hold shows its ring** filling over
  500ms — `RowSigning`'s `hold` chip (`holding`) — and **the knob its
  pressed layer** — `PadStanding`'s `knob` chip (`held`).
- **Text scale**: budgets measure at rendered size; intro stages scale
  to the column; entry, settings and intro pages scroll (their sidecars
  say so). **The profile's figures move under the avatar** below their
  fit, measured: another's 243px row overflowed 232px at 360 and 192px
  at 320, so it moves there; at 390 every profile board is pixel-identical.
  `Feed` was rendered at 1.5× as the proof (a verification artifact, not
  a board).
- **The drags' twins**: the crops' visible zoom slider (`CropZoom`, 1× to
  about 4×, three new edges) and arrow-key pan; the pager's focusable
  strip and arrows; the reorder's three per-row actions, ruled, their
  placement filed.
- **Orientation**: portrait everywhere but the viewer, reason written;
  turning a landscape clip's detail opens the viewer (§4).
- **Names and announcements** (§10, copy-voice): the filter pill's name
  leads with its reading, counts keep their number, an unsave names its
  thing, a "?" its dialog, a search field its use; the comment foot is a
  button in the field's shape; the viewer is named by content, holds
  focus and stops at its ends; the pad's readouts speak after 500ms of
  rest; the filter's `Done` is said once. The over-media look stands,
  measured against the lightest fixture (`ReelRail`).
- **Flagged for blessing** (copy-voice, *Names that carry what the eye
  reads*): the filter pill's name and announcement, `Back to the
  comment`, `Picture` and `Video`, `Move the picture` and `Zoom`.
- **A harness fix**: `check-flows` no longer loops on a field with no
  tagged ancestor.
- **The gate**: 270 screens, 1812 → **1815 edges** (the three zoom
  sliders), 0 gaps, flows 66, every one resolved, 270 sidecars. The
  witness did not move. What the round left open is backlog `13X-k13`.

### The History redesign — 2026-10-05

jakob's direction on the collected brief's D10 and its clarification:
History is "a fully normal feed" of everything the reader has seen,
searchable and filterable, in v1.0.0.

- **History is the seen-list.** The list slice-3 ranking filters the
  feed by, so that seeing a thing twice is a deliberate choice; a
  content is seen when it was fully in the viewport. The page surfaces
  exactly that list and defines nothing of its own.
- **Every served kind, as its own feed card**, unchanged and fully live
  — posts, comments, profiles and tags, and every kind the feed serves
  later. Newest first by first seeing, one card per thing; a re-seen
  thing never moves, and the scores do not order it. The row form, its disc and its trailing
  age are gone.
- **Search and a kinds filter ride the top** (a lane call, flagged for
  the canvas pass): the search bar, `Search your history`, and under it
  the feed's worded trigger in search's kind semantics — nothing
  narrowed reads `Everything`. Its sheet, `HistoryFilter`, holds Kinds
  alone and the shared foot. `HistoryEmpty` draws neither control, and
  its words name no kind (flagged).
- **The cards' doors are the feed's.** History's edges follow
  `FeedKinds`' grammar; the post detail's arrow reads `Back to
  History`, as its table already says.
- **What no ruling answers stays undrawn** (backlog `13X-history`):
  clearing the list or one thing in it, what the search matches, the
  no-match state, and the other destinations' origin nouns.
- **The gate**: 270 → **271 screens** (`HistoryFilter`), 1815 →
  **1839 edges**, 0 → **2 gaps** (the no-match state, owed), flows 66,
  every one resolved, 271 sidecars; the witness re-blessed for
  History's feed-card starts. `History`'s slot grows 844 → **1620**; `HistoryFilter` takes
  the row's next slot.

### The entry and vouch rulings executed — 2026-10-05

jakob's collected rulings (the digest `2026-10-05-collected-rulings.md`)
on the entry funnel, the applicant shells, the ask link, the vouch-back
and the profile. Every quoted wording is blessed unless marked flagged.

- **`Join` says `Mira invited you`** — no vouch exists before the
  approval. The form keeps handle and email for the session after a
  sign-in detour or the arrow, never the password, never past a cold
  launch.
- **The ask link follows the layer law.** `VouchAsk`'s arrow and `Not
  now` return to what the link opened over, or to Feed when it opened the
  app cold, as its two siblings' do (§4); the arrow reads `Back`. `Set`
  answers with the signed-opinion snackbar, with `VouchAskUnusable` when
  the link died meanwhile, and with a kept approval — its own card on
  Invites, signed through the approval pad, never in the kept picks — when
  the key is elsewhere. An applicant's or the asker's own case outranks the
  link's state.
- **A new board, `ResetExpired`**: a spent or expired reset link, in
  `VerifyExpired`'s construction, its way back `Reset your password` and
  its way on `Sign in` (paragraph flagged).
- **Sessions.** `SignIn` opened from the signed-in join layer closes back
  to it and switches this device like `Create account`; a verify link
  under another account verifies its own and switches nothing;
  `VerifiedApp` signed out reads `Sign in`; `SignInExpired` lands at
  app-open.
- **Forms.** A line the server answered stands until the next press, a
  local format line re-checks live; offline, `That didn't send. Try
  again.` stands above the submit, which is the retry (`NetworkError`'s
  docblock says so); sign-in keeps its drawn backoff line and every other
  `RATE_LIMITED` the generic one; the 26-characters line reaches the key
  gate and the backup sheet; `A password is at most 128 characters.`; a
  slow non-signing commit adds nothing, and only `Create account`,
  `Restore the key` and the handle dialog's `Change it` lock the ways out
  (the third jakob 2026-10-05); `Reset`'s status line stands only
  after the press, and `VerifyExpired`'s resend answers in its
  construction (flagged).
- **Platform nouns.** The ceremony, its two dialogs, `YourKey` and
  `YourKeyAbsent` take the `wording` chip (app renderings flagged), and
  so does `ApplicantFeed`'s key card; the ceremony's confirm answers `Key
  made and backed up.`; the ceremony is reached from settings both ways.
- **Applicant days.** The intro moves by its buttons alone (swipe
  revisited post-MVP), Back walks the cards, the seen flag sets on the
  first show, and re-opened from Settings it lands back there; its last
  card's applicant line shows only with a live application.
  `ProfileApplicant`'s `application` chip draws the closed application
  in the turned-down card's words and olive, with `These wait — they
  arrive when someone vouches you in.`; `ApplicantKeyElsewhere`'s
  `backup` chip draws the no-backup card (body flagged). The resend, the
  first staging and an ask-link take-up each answer; auth.md's waiting
  post waits until a member vouches the account in.
- **The vouch-back.** Its line rides every vouch-back open, the two
  coaching lines only the account's first-ever pad; the borrowed view
  returns with the did-not-land notice; the "?" edge reads `Your vouch
  back`.
- **Profile.** `Back to your profile` from the reader's own posts tab's
  trace and stream; the profile and picture seals' write rule keeps no
  draft; the author's removal mark carries both blessed sentences
  (`RedactedContent`); the opinions page and Invites take the pull-down;
  a held opinion's tap opens `PadStanding`; `By them`; `This account is
  hidden — its posts stay out of your feed.`; `Back to the search` waits
  for the person row (K14.11).
- **The gate**: 271 → **272 screens** (`ResetExpired`), 1839 → **1841
  edges** (its two), the History round's 2 gaps, flows 66, every one
  resolved, 272 sidecars. The witness re-blessed for the ceremony's and
  the ask's new snackbars and the held tap's new pad. What stays open is
  backlog item `13X-exec-entry-vouch`.

### The settings and pads rulings executed — 2026-10-05

jakob's collected rulings (the digest `2026-10-05-collected-rulings.md`)
on settings, the pads and seals, the edits and the 136 residue. Every
quoted wording is blessed unless marked flagged.

- **The handle change asks first** — a new board, `ChangeHandleConfirm`:
  `Change your handle to @solferreira?` over the cost, links to `@sol`
  dying and the handle free for anyone, with `Keep it` filled and `Change
  it` quiet (flagged). The page beneath is `ChangeHandleBody`.
- **The disabled-until-filled law gates commits**, and a handoff that only
  prefills another app's draft is not one (§4, *Interaction states*):
  `Report a problem`'s `Send by email` is live from an empty field, `Time`
  is the press, and the words outlast the handoff.
- **Settings answers in words.** `Signed out of Pixel 8.`, `Signed out
  everywhere else.`, `Password changed — other devices are signed out.`,
  `Your handle is now @<new>.`, `@juno is unhidden — their posts can
  reach your feed again.` with `Undo`, `Email changed to <new>.`; a wrong
  current password reads `That password isn't right.`; the sign-out line
  names kept picks and its dialog's answers are plural; About opens with
  every topic closed. An unverified applicant's Email row opens
  `ApplicantEmail`; a change that ran out reopens the request; the last
  unhidden account closes the sheet onto a `None` row; the wallet door's
  guest takes the bare band and bar; the settings forms answer offline in
  their own slot. The wrong-account email link's landing is flagged.
- **The pad opens at +0.10 / +0.10**, its "?" replaces its body in place
  (the vouching pads with `How vouching works`, flagged, the vouch-back
  with its own text), only a drag moves the pick, and the walk-back asks
  over the parked pad: `Walk it back` costs `severanceCost`, a pick that
  nets to nothing costs one thing (`StanceControl`, `stance-control.md`).
  The approval pad's drawn `Vouching is the act.` stands, copy-voice
  following (flagged).
- **The kept picks.** The review and its seal carry `An approval waits on
  Invites — it signs on its own there.` with `Open Invites` when a kept
  approval also waits (the `approval` chip, flagged — reworded since to
  `An approval waits in your invites — go there to sign it.`, blessed,
  copy-voice); the seal's bug
  notice leaves by `Not now`, back to the review. The post edit's bug way
  out is `Discard the edit`, the profile and picture seals' `Not now`
  (both flagged); the comment edit's write rule ends `…your edit is still
  here.` with `Not now`.
- **The seal grammar.** While a seal signs, its fact rows and system Back
  refuse and its "?" stays live; no timeout and no retry of its own;
  `Retry` re-runs under the commit's own word; a refusal reading goes when
  the reader steps back; an unlanded citation at a count stands under the
  References row; the security notice stands until `Got it`; row lines
  stand until Retry, another act or a fresh load; a hold on a kept pick
  opens the review; the not-found pages name their origin.
- **The edits and replies.** `ReplyPictures`' `upload` chip draws a
  picture that didn't upload; `EditCompose`'s second tile wears the ring
  at `uploading`; a clip's gate fault reads `The video didn't upload.
  Signing waits for it.`; a removed failed cover restores the cover row;
  the edits' in-flight word fires for every press; `Uploading 0 of 1 —
  signing waits for the picture.` is blessed.
- **The canvas.** A hidden non-drag route no longer paints a dot under
  `RefPairEdit`'s title in dark (the flow badge's positioning beat its
  `cg-sr-focusable`), and the badges keep their corner on pressable
  controls.
- **The gate**: 272 → **273 screens** (`ChangeHandleConfirm`), 1841 →
  **1848 edges**, the History round's 2 gaps, flows 66, every one
  resolved, 273 sidecars. The witness re-blessed for `New post`'s start
  narrowed to the wizard. What stays open is backlog
  `13X-exec-settings-pads`.

### The final brief executed — 2026-10-05

jakob's ruling on the day's last brief (the audit README, *The final
brief's ruling · 2026-10-05 (night)*): five eye items, two corrections,
the rest as recommended, every listed string blessed.

- **History counts the first seeing only.** It orders by first seeing,
  newest first; a re-seen thing never moves, and seeing never reaches the
  graph — only the reader's own gestures become records. feed-ranking.md
  §9.4, `OrderSection` and `ExploreFilter` say the same: fully in the
  viewport, the first time. No clear and no per-item remove — decided.
  Quiet day dividers name the day (`HistoryDayDivider`; `History`'s slot
  1620 → **1720**); the pull-down, `Back to top` and a frozen order per
  open are History's too; a removed thing keeps its place with its mark,
  a hidden account stays out, a veil stays. `Back to History` joins the
  profile's, the tag page's, the trace's and the stream's tables.
- **One search rule** (§4, *Search*): names and titles, an untitled post
  by its first words, `@handle` and `#tag` scopes — Explore's and
  History's. **`HistoryNone`** (new) draws a narrowing that finds
  nothing, its `cause` chip `search` or `kinds`, with `Show everything`.
- **The kept approval's line** is jakob's own: `An approval waits in your
  invites — go there to sign it.` **Invites draws the row it sends to**:
  `Invites`' `kept` chip (`waiting`) puts `KeptApprovalRow` at the head of
  Applications, `Waiting for your key`, `Ready for your approval` once
  the key is back.
- **Commits that wait** (§4, *Interaction states*): every credential and
  entry form draws its commit disabled with one reason line above it
  (`WaitingCommit`). `ChangeEmail`'s `fault` chip draws the field-error
  idiom once — `password`, `malformed` — and `ApplicantEmail` inherits it;
  an address in use stays unanswered at the request (auth.md). Both carry
  a hidden username. The email change's code is 6 digits, single-use
  (auth.md; the `digits` field kind). A malformed handle is answered by
  its field and never reaches `ChangeHandleConfirm`, whose `Change it`
  carries the wait.
- **The reorder's three moves** stand on `PickedSheet`'s rows, each row
  only the moves it can make; the handle takes the arrow keys.
- **Smaller laws**: system Back follows a funnel arrow's link, leaves an
  arrowless mail landing to the OS, and the web's recovery code holds a
  history entry (§4, *Navigation*); the compose and reply pads keep their
  help dialogs beside the stance pad's in-place help (copy-voice); the
  count lines' overlap is accepted (`PostCard`); the tags line keeps its
  count whole at any size (`TopicsLine`); the rail's shadow is 75 % at
  6px, re-measured (`ReelRail`); `Sending the confirmation link…` is the
  construction's; the entry canvas reads `Join · @mira invited you`.
- **A canvas fix**: a disabled control's flow badge shows again (the
  state layer's disabled rule had hidden it).
- **Flagged for blessing**: the day dividers, `HistoryNone`'s words, the
  waiting commits' reasons, the reorder handle's names. Everything else
  the brief listed is blessed (jakob 2026-10-05).
- **The gate**: 273 → **274 screens** (`HistoryNone`), 1848 → **1864
  edges**, 2 → **0 gaps**, flows 66, every one resolved, 274 sidecars.
  The witness re-blessed for `New post`'s start on `HistoryNone`. What
  stays open is backlog `13X-final`.

### The close bite — 2026-10-05

jakob's last ruling of the fabric (the audit README, *The fabric's last
ruling · 2026-10-05 (night)*): every string the closing round flagged is
blessed, every `13X-final` recommendation adopted.

- **Blessed**: History's day dividers — the second named *Ages*
  exception — `HistoryNone`'s two sentences and `Show everything`, the
  eleven waiting commits' reasons, `Reorder the cover` and `Reorder
  picture 2` (now in copy-voice, *Accessible names*), `Discard the edit`
  as the post edit's bug way out, and `Not now` on the profile and
  picture seals. The docblocks, graph cases and §4's line drop their
  flags.
- **The error boards hold what was pressed**: `SignInError`,
  `SignInLimited`, `JoinErrors`, `RestoreError` and `SettingsBackupError`
  fill their fields (`SettingsBackupBody` takes `value`), so no pressed
  form stands empty under a live commit. `RecoveryCodeMismatch` already
  held its typed-back prefix.
- **The handle dialog's `Change it` is B2's third lock** on the ways out.
- **The profile and picture seals' key notice** goes `Not now`, back to
  the seal with nothing kept; `Keep the draft, restore later` stays the
  composer's.
- **The crops' keys**: an arrow moves the picture 1 %, 10 % with Shift;
  a device with no touch to pinch reads the how-to line's pointer
  variant (copy-voice, *The crops' how-to line*).
- **Recorded as drawn**: the kept approval's row opens the key notice
  while the key is away, and its close rides `RejectConfirm`, dropping
  the kept vouch with nothing signed; an applicant's fresh link answers a
  taken address in `ChangeEmailLinked`'s construction; the handle stays
  `nickname` and a display name `off`; the composers' arrival focus is
  K14.33's answer. The rail's edge contrast stands with its numbers.
- **Flagged for blessing**: the crops' pointer variant, `Drag or use the
  arrow keys to move, the slider to zoom.` — the one flag copy-voice
  holds.
- **The gate**: 274 screens, 1864 edges, 0 gaps, flows 66, every one
  resolved, 274 sidecars; five boards re-render. What stays open is
  backlog `13X-close-bite`.

### The check wave — 2026-10-06

The fabric's check round: four audit lanes read the merged tree against
itself — code against sidecars, prose against prose, rulings against
strings, and the MVP's coverage — and jakob ruled the brief whole (the
digest `2026-10-06-check-round-rulings.md`: families A–J and fifteen
questions, no vetoes). Seven lanes executed it (PRs #82–#88); a
blessings bite closed it (#89).

- **Every non-reference board walks a flow.** The witness round
  declared the journeys the boards carry — sign-in, join and the
  applicant; the key, the intro, settings and deletion; the compose
  branches and the seal's faults; comments and edits; the feed, the
  profile, the stance and invites — so all 260 sit on a resolved flow
  and implementation never guesses a screen order.
- **copy-voice is the complete registry** of drawn user-facing strings:
  one transcription recorded every drawn line it lacked, the older ones
  marked *carried over — blessed by use*, and the round's new lines
  blessed.
- **The editing-sheet exemption is law** (§4, *Sheets*), and every sheet
  sidecar transcribes its kind.
- **The offline convention is drawn** (the round's Q9). A form's submit
  that gets no answer says `That didn't send. Try again.` in its own
  error slot above the submit, keeps what was typed, and the submit is
  the retry — the answer the graph's case strings label **E5**, after
  the entry lane's fifth filed question (backlog `13X-passc-entry-a`,
  *Forms*; ruled 2026-10-05), on 25 form-submit edges. Every other write
  that gets no answer lands on `NetworkError` (copy-voice, *No answer at
  all*).
- **Two boards**: `ComposeDetailsReused` (the already-published marker,
  backlog 110) and `FeedWordsSensitive` (the words-only veil's source
  line, backlog 25). Invites' arrow returns to its origin,
  `StanceCoachMark` retires for the pad's two coaching lines, History
  stays append-only in first-seen order, and `ChatsComingSoon` conforms
  to `WalletComingSoon` whole.
- **The gate**: 274 → **276 screens**, 1864 → **1901 edges**, 0 gaps,
  flows 66 → **222**, every one resolved, 276 sidecars; the corpus lint
  reads 3063 sources, none failing.

### The contract recon executed — 2026-10-06

jakob's rulings on the implementation side's contract-recon gaps (seam
065), every quoted wording blessed.

- **A vouch on an asker not fully registered yet is kept.** Set or the
  hold stages the application and keeps the pick as a kept approval,
  nothing signed or spent; its row reads `Not fully registered yet`,
  then `Ready for your approval`, and signs only through the approval
  pad.
- **The email change answers its mail faults.** `Resend` mails only the
  side still owed and names that inbox; a code disabled after too many
  tries says so on the field, pointing at `Resend`; a spent mail budget
  answers with `RATE_LIMITED`'s line in place.
- **A change link that outlived its change** lands on `ChangeEmailLinked`
  under `This link doesn't work anymore`: canceled, or opened again
  after the change applied (the chip's `canceled` and `applied`). A
  verification link an address change replaced lands on `VerifyExpired`.
- **An edit whose count changed before signing** drops its press and
  asks again under the new count.
- **Only an opinion ends the borrowed view**, toward any target; an
  Affinity never does. An opinion carried from the application lands
  with the registration, so the band never stands.
- **An approved applicant cannot delete during the landing**: the row
  wears the locked look and answers `You can delete your account once
  you're in.`
- **The release is named CoGra v1.0.0** across the design prose.

### The night rulings executed — 2026-10-06

jakob's late rulings on the calibration questions (seam 067) and the
untitled post, written as law; no board redrawn.

- **An untitled post** is represented by its first line if it is a words
  post, and by kind and author if it is a media post (`Pictures by @ada`,
  `A video by @ada`); a description is never a name. Matching is titles
  only (§4, *Search*; copy-voice, *The feed cards*), and a Saved row's
  key slugs the same stand-in.
- **A guest borrows a viewpoint**, and the feed and every stance shown
  are the viewpoint's, read-only: the anchor at the member's geometry
  wears the viewpoint's stance, the hollow face where it holds none, and
  its tap opens `GuestGate` (stance-control, *A guest's view*). This
  replaces the guest close's always-unset face (*The tag-page smalls*);
  the guest boards already draw the hollow face, the borrowed view
  holding no stance on their posts.
- **The originating root stays lit on a drill-in**; an arrival with no
  origin lights the content's home root (`BottomNav`).
- **A card's header answers at 48dp** through an invisible target
  centered on the drawn header (§10).
- **Mute and unmute reach assistive technology** as a custom action on
  the playing clip's frame (`FeedCover`).
- **The stream resumes after the pad**, and **the viewer's play state
  carries on close** (`Reel`, `PostDetailVideo`).
- **The pre-release fixture pass is jakob's own** (backlog item 137).

### The docs adoption — 2026-10-06

jakob's rulings on the adoption audit (seam 073): each passage
`docs/implementation/design.md` still kept under its own section number
either comes into this readme or dies from the pointer.

- **Came over.** The anti-goals (§2), the monospace clause deferring to
  *Type*'s identifier class, a payout address in it, and geek mode told
  apart from the developer-tool look; the palette's departures from
  stock Material with the error and success derivations (§4,
  *Colour*); Latin-ext, the font budget, and the missing Cyrillic and
  Greek (§4, *Type*). The token headers cite this readme, not the
  pointer that leads back to it, and `typography.css`'s recovery-code
  row now reads `body-large`, as §11 already ruled.
- **Died, in the pointer.** The palette recipe and its pipeline — the
  generator is the recipe; the collapsing top's platform mechanics —
  `CollapsingTop` and *Spacing and layout* hold the behaviour; the
  `success` usage rule, which the snackbar ruling contradicts (the
  orphaned role is backlog item 138); and the per-family slot table,
  whose words stance-control and the rounds here already hold and whose
  paired sliders `RefPair` contradicts.
- **Tracking is one value** (§4, *Type*): each platform expresses it
  in its native unit and rounds on its own grid — a capability
  expression, never a per-client choice.

### The packet-wave rulings executed — 2026-10-07

jakob's rulings on the packet wave's gaps (seams 077–095), written as
lines; quoted wordings are his.

- **The custom mute action is android's** (`FeedCover`); on the web the
  sound disc is a native focusable button whose label names the sound's
  state, nothing on the frame hidden from assistive technology.
- **The detail's tags line answers at 48dp** through an invisible target
  over its drawn 34dp (§10).
- **Reaching the hard top always reveals the collapsing band**
  (`FeedScrolled`; §4, *Motion*).
- **History is everything seen, never only what was opened.** Seen is
  the top-layer content in full viewport: the post itself, never its
  author's avatar or handle, its citations or its tags; reading comments
  adds no commenter's profile; opening a profile adds the profile, its
  posts only once scrolled into. A card taller than the viewport is seen
  once both its edges have been on screen, not necessarily at once. The
  empty state and the menu's door say seen; the originless tag card
  shows no why-line; a hidden account's own profile card stays.
- **The deletion's loose ends.** A spent deletion-mail budget says B7's
  line above the commitment and sends nothing; content swept with the
  account wears `Removed by its author`; while a confirmed deletion's
  grace runs, the deletion band wins over the borrowed band; the count
  rounds to the nearest whole day while 24 hours or more remain, then
  counts hours; the member's device at the deadline lands signed out on
  the bare view with `Your account is deleted.`, never on
  `SignInExpired`; a sentence naming a deleted actor says `a deleted
  account`; the applicant's commit reads `Deleting my account…` in
  flight; and the deleted account reaches the wire as nulls with
  REDACTED status beside `User.removal`.
- **Search, settled** (§4, *Search*). The scope operators reach what
  carries the tag and what the person made or tagged with; a bare scope
  only proposes; results are seen only when opened. Searching is a state
  of Explore's root — a trailing ×, Back to rest first, the query and
  scroll kept on return. Recents keep ten, newest first, deduplicated
  case-insensitively, per account and cleared at sign-out, with no
  per-row ×; the action key only dismisses the keyboard. Stale rows stay
  readable until the 200ms ladder; a failed refine keeps them under
  `Couldn't load more`. A guest searches with the bare band, no Your
  topics, Newest with ages and no seen toggle; an applicant as a member.
  A sensitive result wears the text tile; a full match is equality; a
  still-settling result shows nothing extra; the mixed unscoped state
  says the search-scope line after the last row.
- **Settings' loose ends.** `ApplicantEmail` opened from Settings returns
  there, on back and on success with the same snackbar; an unverified
  applicant's pending change keeps the row's `Change pending` and the
  tap opens their own address change. Once the code's side is
  confirmed, `ChangeEmailConfirm` drops its field and commitment. The
  address-taken landing goes `Back to settings` for a member and takes
  `VerifyExpired`'s way on for an applicant, whose body never promises
  that confirming again applies it. `ChangePassword`'s re-auth budget
  says B7's line above its commitment. The app's three settings lines
  say `this app`.
- **The vouch-back's edges.** The pad's Cancel closes back where it
  bloomed, the profile included. A kept vouch-back leaves the card as it
  is and `Vouch back` reopens the pad holding the pick; one kept from the
  profile brings a put-away card back on the keeping device only, and
  `Got it` drops a kept pick as Cancel does. A failed `Got it` brings the
  card back with `That didn't go through.` and `Retry`. The feed's head
  reads the security notice, the key card, then the vouch card.
- **Saved's edges.** A failed unsave or Undo leaves the row standing
  with `That didn't go through.` and `Retry` in its second line, the
  Unsave glyph kept; on a profile the line takes the actions row.
  `Unsave` on any menu closes the sheet with `Removed from Saved.` and
  `Undo`; a comment's `Save` answers `Saved.`. Rows outlive what
  happened to their things: a removed one reads `Removed by its author`,
  a deleted account `Deleted account` on the reserved disc, a sensitive
  one gives its second line to the reason, and a hidden account's things
  stay. A titleless row takes its first line, or B11's media form; a
  reply's `on` names the thread's post; the aside drops where the title
  already names the handle. Slugs stay unique by fixture discipline, no
  suffix rule.
- **Hidden accounts' edges.** A failed Undo or unhide brings back the
  row the gesture was made from, carrying the line until Retry or the
  next fresh load — in place in the sheet, or on the settings row if the
  sheet closed; inside a `ContentRow` the line takes the second line and
  `Retry` the trailing slot. A deleted account's row is `ContentRow`'s
  new `redacted`: the reserved disc and `Deleted account`, no aside; its
  unhide says `This account is unhidden — its posts can reach your feed
  again.`
- **The release registry's edges.** A running version missing from the
  registry is not behind: no `installed`, no newer-version line, no
  snackbar. The newer-version snackbar speaks to members, applicants and
  guests, and a version read that answers after the feed has arrived on
  a cold open announces when it arrives.
- **No unlit bar remains.** Every drill-in board lights its originating
  root, as `BottomNav` rules: History and Saved light Profile; the other
  person's profile, its tabs and states, Notifications, the score's
  drill-down and the chats pages light Feed, where the canvas opens them.
- **The blessing bundle, written.** The borrowed band leaves at once on
  the first signed opinion and the feed reads the own view from its next
  refresh; the band stands on the Feed root only. Saved takes the
  pull-down, a reverted unsave clears its snackbar, the reader's own
  unsaves elsewhere apply in place on return, and a failed next page
  says `Couldn't load more` with `Retry`. The People footnote carries
  feed-ranking §8.2's hint. `Unhide` keeps its visible name, described
  by its row.

- **Any member who holds the ask can let an applicant in, and the first
  vouch lands it.** The waiting card's caption reads `It does not
  expire.`; the profile's adds `Anyone who holds their ask can let them
  in — the first vouch lands it.`; the intro's applicant line reads `A
  friend who's already in has to let you in. Ask around once you have
  verified your email.` `VouchAskUnusable` keeps its landed case alone.
- **The account lands** when its registration and the approving vouch
  have both confirmed; the landing card's flip is that moment.

### The five ordered draws — 2026-10-07

jakob's packet-wave rulings ordered five states drawn rather than
backlogged (the day's digest, items 23, 24, 38, 60 and 65). Each is drawn
in an existing board's construction; the words they mint are drafted and
wait for jakob's review (copy-voice marks each).

- **The dead change link, signed out** (item 38; the settings packet's
  G9). `ChangeEmailLinkedSignedOut` gains the `landing` chip: `pending` is
  the live link, `dead` the one landing for every link whose change ran
  out, was canceled or already applied, and for a link the app does not
  know — `This link doesn't work anymore`, a body naming no address, and
  `Sign in` holding no link.
- **Search under Newest** (item 24; the search packet's SG-5).
  `ExploreSearch` gains the `order` chip: `ranked` is the board as it
  stood, `newest` the same four results by time — no seam, full matches
  still first, each row's age on its value edge in the one ladder, the tag
  row bare. Newest is also the order before the ranker exists, so the
  interim reads exactly this; when the split ships is the implementation's
  sequencing.
- **The Profiles row** (item 23; SG-4). `ExplorePerson`: an unscoped
  query, `salt`, reaching `Sal Torres` through the handle — the picker's
  own person row (`ReferencePicker`), avatar, display name over `@handle`,
  the rank on its edge. It is a board of its own because a scoped query
  never returns a person (jakob 2026-10-07), so `ExploreSearch`'s `@sol
  salt` cannot hold one. Another person's row opens their profile under
  `Back to the search`, now in the profile's noun table; the reader's own
  opens their own.
- **The hide's three other landings** (item 65; the hidden-actors
  packet's registration ask). `FeedHidden`'s shape — the surface the tap
  was made on, unchanged, with the snackbar over it — drawn where the
  feed's board could not stand in: `PostDetailHidden` (the post being
  read, `ReaderPostMenu`'s detail case), `ProfileOtherHidden` (the
  person's profile, `ProfileMenu`'s; a deleted account's page answers in
  the same shape with its nameless line) and `SettingsUnhidden` (the
  Hidden accounts sheet a moment after `Unhide`, the row gone and the
  rows behind it moved up, the snackbar raised above the sheet at the
  screen's foot). Their snackbars register under each surface's own
  prefix.
- **The approval that fell through** (item 60; seam 090.4).
  `ApplicantFellThrough`: `ApplicantWaiting`'s shell with the card flipped
  once more, the way `ApplicantLanding` and `ApplicantRejected` are — the
  landing card goes back to waiting when its approval lapses before the
  reader is in and no other is live. It wears the waiting card's dress and
  `Got it`, names no member (which open application the account shows next
  is not the card's to say), and carries `ApplicantRejected`'s ask-link
  block, since anyone already in can now vouch. It registers with the
  applicant boards' own round.

### The fabric-2 draws — 2026-10-09

jakob's fabric-2 rulings (the day's digest, items 75–98) ordered this
round's draws and lines. Each draw lands in an existing construction; the
words it mints are drafted and wait for jakob's review (copy-voice marks
each).

- **The Report row** (item 75). `Report` joins the sheet tail of every
  other-person menu — the reader's post menu on both widths, the
  comment's, another's profile's and the deleted account's — and no own
  menu. It opens one confirm sheet, `ReportConfirm`, drawn over the post
  detail and a master for every other host: the heading names the thing,
  one body line says what happens without naming the mechanism (the MVP
  commit sends a mail; report machinery waits for proposals/moderation),
  `Report`/`Cancel`, the snackbar `Reported.` It never connects to
  Report-a-problem. Registered under each hosting menu's own prefix, the
  sheet as `postDetail.reportSheet`.

---

## 14. The canvases

The canonical tree draws one app and is graded as one thing. The editor
it is reviewed in holds 200 files per canvas and publishes 16MB, and at
191 boards the tree stood on both ceilings — so the *review* splits into
four canvases while the tree itself stays whole. `designs/postmvp/` is
the second tree and brings the fifth canvas with it (§13, *The post-MVP
separation*); the four below are the MVP's, and they are what
implementation reads.

**A tree is the master.** The board files and its own `canvas.json` are
the graded truth: coordinates, page assignment, annotations, and the
flow graph beside them. The canvases are review surfaces — claude.ai
artifacts seeded from that master, each carrying the boards of the pages
it serves. Nothing is decided on a canvas that is not written back into
the tree; a canvas is re-seeded from the tree, never the other way
round.

**Which canvas serves which pages:**

| Canvas | `id` | Pages | Opens on |
|---|---|---|---|
| [CoGra · Feed and comments](https://claude.ai/code/artifact/012e4ee6-edd1-4cbe-98ab-b45c58aa4c34) | `feed` | Feed & Search · Comments | Feed & Search |
| [CoGra · Profile and settings](https://claude.ai/code/artifact/1102bec0-50a9-41b2-84da-a6215afd2d2a) | `profile` | Profile | Profile |
| [CoGra · Compose and media](https://claude.ai/code/artifact/675688a0-1365-48e0-b56a-511104712f53) | `compose` | Compose · Media | Compose |
| [CoGra · Entry, money and maps](https://claude.ai/code/artifact/ee0719b1-c7c0-4df9-ae56-74c46a6328c5) | `entry` | Overview · Entry · Money & Wallet · Patterns & reference | Overview |

The fifth is the post-MVP tree's own —
[CoGra · Post-MVP rounds](https://claude.ai/artifact/LpuftdCAvgkhJaoTXRhAE2),
id `postmvp`, serving the Push notifications, Change histories, Chats
and Money & Wallet pages and opening on the first. It lives in the
successor canvas tooling (the Design Artifact type): the same seed
manifests, published as the
artifact's own board files rather than through the old seeded editor.
Its predecessor artifact stands frozen with the pre-migration
versions in its picker.

A canvas title never carries `< > & "` or a backslash — the editor
refuses them at seed time, which is why the titles say "and". The old
single-canvas artifact stands as a signpost to all five — the MVP four
and the post-MVP canvas beneath them; its version picker keeps the
pre-split monolith.

That map is data, not a habit: each tree's own `canvases.json` holds
it, hand-maintained — each entry carries its canvas's published `url`,
the links in the table above — and `_build/gen-canvases.mjs` writes one seed
manifest per canvas under `<tree>/canvases/<id>/` — the
artboards and annotations of its pages with coordinates verbatim, the
page bar in the order above, plus an `images.json` naming the
photographs its boards actually reference, so seeding a canvas reads
one directory and scans nothing. The manifests are generated and
committed the way the maps are; the stage fails on a page no canvas
claims or two canvases claim, a canvas over its file or byte budget,
and on a committed manifest that regeneration no longer reproduces.

**A board joins a canvas by its page.** Nothing on a board names a
canvas — membership is read from the `page` every artboard already
carries, so a new board lands on the canvas that serves its page the
moment the manifests regenerate. Moving a page to another canvas is an
edit to `canvases.json` and nothing else.

**The budgets are per-canvas.** A photograph counts against the canvas
that carries it rather than one global pool, and an image two canvases
need is seeded into both — which is what ends the squeeze that made
every new picture a trade against an old one. The stage prints each
canvas's boards, images, file count, bytes and headroom, and holds the
file count at 180, under the 200 so the margin is visible before it is
a wall.

**Implementation cites board files, never canvas URLs.** A canvas URL
names a review surface that gets re-seeded and re-published; the board
file is what holds still and what CI grades. Briefs, hand-test notes
and PR bodies name `ProfileEdit.dc.html`, not the artifact it happens
to be visible in today.

**Cross-canvas edges are ordinary; cross-tree edges do not exist.** One
flow graph spans a tree's canvases — `graph.json` knows boards and
pages, not canvases — so an edge from a compose board to a feed board is
normal wiring, drawn with the same `⤴ page` marker the maps already use
for a cross-page jump. Reachability, entries and gaps are checked over
that whole graph; no canvas is ever checked alone. A tree's graph stops
at the tree, though: a post-MVP board cannot point at a canonical one,
because the round it belongs to has not landed in the app the canonical
graph describes. It gets its edges when it migrates.

---

## 15. Index

**Root**
- `styles.css` — the entry point consumers link. `@import` lines only.
- `readme.md` — this file.
- `backlog.md` — the ordered queue sessions pull from.
- `staged-surfaces.md` — every surface the release ships staged: the
  release cut's checklist, append-only.
- `SKILL.md` — the Agent Skills wrapper.
- `thumbnail.html` — the homepage tile.
- `_build/bundle.mjs` — regenerates `_ds_bundle.js` (which the `@dsCard`
  HTMLs load) from the component sources after any `.jsx` edit:
  `npm install` once in `_build/`, then `node _build/bundle.mjs`.
  `_ds_manifest.json` is the claude.ai Design app's own metadata and is
  refreshed only by that app, on an explicit sync-back.
- `_build/export-tokens.mjs` — the pipeline's second stage: exports
  every custom property in `tokens/*.css`, raw and resolved, per theme
  context, as `tokens.json` — the token contract implementation lints
  both platform themes against. Token names are append-only.
- `_build/trees.mjs` — the generated trees, named once (§13, *The
  post-MVP separation*). The stages below read this list; the ideation
  canvases are deliberately not on it.
- `_build/render-screens.mjs`, `shell.mjs`, `flow-markers.mjs`,
  `node-paths.mjs`, `gen-maps.mjs`, `gen-canvases.mjs`, `check-flows.mjs`,
  `check-readouts.mjs`, `check-behavior.mjs`, `check-help-notes.mjs`,
  `report-summaries.mjs` — the board pipeline (§13, *Canvas pages and
  flows*): render the screens, join the registered screens' data-node
  paths into `nodes.json`, stamp the flow numbers, generate the
  maps, seed the per-canvas manifests (§14), gate the result —
  `check-behavior` holds the behavior sidecars to their grammar and the
  registry, `check-help-notes` the "? contents" notes to copy-voice. Run
  all of them after any screen, component, graph.json, sidecar or "?"
  copy edit. A screen whose state is not a
  portrait phone exports `FRAME` and the shell builds that artboard
  instead — so far only the rotated viewer; a calibration screen
  exports `NODE`, its data-node prefix. `_build/flow-engine.mjs` is
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

**`designs/canonical/`** — the drawn app itself: the rendered
`.dc.html` boards, `canvas.json` (the master layout: coordinates,
pages, annotations), `graph.json` and the flow layer beside it (§13),
`canvases.json` + `canvases/<id>/` (the canvas map and per-canvas seed
manifests, §14), `behavior/` (the per-screen behavior sidecars, the
contract the implementation side's conformance harness compiles — its
README carries the grammar), and `img/` (the photographs the boards
carry).

**`designs/postmvp/`** — the same shape, one tree over: rounds drawn
before their slice is the work, reviewed on the fifth canvas, and moved
into canonical when they become current (§13, *The post-MVP
separation*). Its own `screens/`, `_shared.jsx`, `canvas.json`,
`graph.json`, `canvases.json` and `img/`; the same `components/`. Its
photographs are its own copies — the budgets are per-canvas (§14), and
a tree that reached into another's `img/` would seed a canvas from two
places.
