# Design

The visual and interaction system both clients implement:
colour, type, shape, motion, components, copy, and the stance
control. Android and web read the same rules from here so the
two apps stay one product; [android.md](android.md) and
[web.md](web.md) carry only what is genuinely
platform-specific.

**Every frontend change reads this file before writing code.**

---

## 1. Direction

CoGra is a social network built on real relationships between
people. What you see is shaped only by the connections you
make. The design carries that as *tone*, never as on-screen
vocabulary.

- **Warm, social, human.** Rounded, inviting, generous. A
  place to spend time with people.
- **People first.** Faces, names, and the person behind
  content lead; the content stream never buries them.
- **Calm, not attention-seeking.** No clickbait density, no
  manipulative urgency, no badge-farming.
- **Honest.** Nothing vanishes silently. Edits and removals
  are visible and unalarming (§9).

Anti-goals, stated because they are the failure modes this
product is most likely to drift into: nothing that reads as
crypto, fintech, trading, enterprise, or a developer tool. No
dense dashboards, no monospace UI, no dark "hacker" aesthetic.

---

## 2. Colour

### 2.1 The decision

The palette is **orange-led**, seeded from `#EF6C1A`.

It is generated with Google's
[material-color-utilities](https://github.com/material-foundation/material-color-utilities),
the same algorithm behind Material Theme Builder, so the tonal
ramps match what Compose produces rather than being picked by
hand. Two deliberate departures from the stock output, both
recorded here because they are deviations a future reader
would otherwise "correct":

**Scheme variant is `Content`, not the usual `TonalSpot`.**
TonalSpot reduces the seed's chroma hard enough to turn a
saturated orange into a muted brown (`#8D4E2C`), which loses
the brand hue entirely. `Content` keeps it: `primaryContainer`
is the seed colour itself.

**Dark mode overrides the neutral palettes and the primary
tone.** Two separate fixes:

- `Content` derives the *neutral* palette from the seed at
  chroma 8.6 (12.6 for `neutralVariant`), which tints every
  dark surface brown. The neutral palettes are rebuilt at
  chroma **1.5 / 2.5** — a warm grey that keeps a trace of the
  brand without reading as cocoa. Accent palettes are
  untouched.
- Material places dark `primary` at tone 80, where orange
  cannot exceed chroma 30.8 and reads as peach. Dark `primary`
  is taken from tone **70** instead. This measures **8.08:1**
  against the dark surface, well past the 4.5:1 AA threshold —
  Material's default is more conservative than this palette
  needs.

The error palette departs in hue and tone for the same underlying
reason — Material's placement assumes an accent less saturated and
further from red than this one. That departure is recorded with the
Error table in §2.3, where its numbers belong.

Every `on`-colour pair in both themes is verified against WCAG
AA (4.5:1) at generation time. A palette change that fails
that check does not ship.

### 2.2 Reproducing the palette

Fifteen lines against `@material/material-color-utilities`:
build `SchemeContent(Hct.fromInt(0xFFEF6C1A), isDark, 0.0)`,
read every role off `MaterialDynamicColors`. For dark, pass
the base scheme's accent palettes into a `DynamicScheme` with
`neutralPalette`/`neutralVariantPalette` rebuilt via
`TonalPalette.fromHueAndChroma(hue, 1.5)` and `(hue, 2.5)`,
then override `primary` with `primaryPalette.tone(70)` and
`onPrimary` with `tone(10)`.

Contrast level is `0.0` throughout. Raising it is a real dial
if the palette ever needs more separation, but it changes
every token, so it is a decision, not a tweak.

The generator lives in `web/src/lib/ui/design-tokens.test.ts` and
writes **`design-tokens.json`** at the repo root — the contract both
clients pin their themes to, the same arrangement the client crypto
has with `client-crypto-vectors.json`. `make tokens` regenerates it;
every other run asserts it is not stale, and the AA check of §2.1
runs there, so a palette that fails cannot be generated. Neither
client transcribes a value: Android's `ColorSchemeTest` and web's
`palette.test.ts` read the file.

### 2.3 Tokens

These are the Material 3 roles. **Screens never name a colour
— they read a role.** A literal hex or a Tailwind palette
class in a component is a bug; it is what makes a future
palette change a rewrite instead of a token edit.

**Primary**

| Role | Light | Dark |
|---|---|---|
| `primary` | `#9F4100` | `#FF8D50` |
| `onPrimary` | `#FFFFFF` | `#341100` |
| `primaryContainer` | `#EF6C1A` | `#EF6C1A` |
| `onPrimaryContainer` | `#4F1D00` | `#4F1D00` |

**Secondary**

| Role | Light | Dark |
|---|---|---|
| `secondary` | `#8E4D2B` | `#FFB692` |
| `onSecondary` | `#FFFFFF` | `#542103` |
| `secondaryContainer` | `#FEAA81` | `#743918` |
| `onSecondaryContainer` | `#783C1C` | `#F8A57B` |

**Tertiary**

| Role | Light | Dark |
|---|---|---|
| `tertiary` | `#666000` | `#D3CB42` |
| `onTertiary` | `#FFFFFF` | `#343200` |
| `tertiaryContainer` | `#B7AF26` | `#B7AF26` |
| `onTertiaryContainer` | `#454100` | `#454100` |

**Error**

| Role | Light | Dark |
|---|---|---|
| `error` | `#A5004A` | `#FF6B95` |
| `onError` | `#FFFFFF` | `#66002B` |
| `errorContainer` | `#FFD9DF` | `#8F003F` |
| `onErrorContainer` | `#8F003F` | `#FFD9DF` |

The error palette departs from Material's stock output twice, in **hue**
and in **tone**, because an orange-led palette collides with a stock
error in both.

**Hue 5, not Material's fixed 25.** Material's error hue is far from a
typical blue or purple primary, but this palette's `primary` sits at
hue 44.6. At hue 25 the two landed 19.6° apart at the same tone,
measuring 6.16:1 and 6.19:1 against `surface` — identical weight and a
neighbouring hue, so the error read as another brand colour rather than
as an alarm. Hue 5 doubles the separation while staying unmistakably a
warning colour. Chroma is Material's own.

**Tones 35 and 65, not Material's 40 and 80.** Tone 80 holds only
chroma 32.6 of the palette's 84, so the dark error came out pastel
whatever its hue — and *brighter* against the dark surface than
`primary` is, which reads as gentle where it should read as urgent.
Tone 65 more than doubles the saturation to chroma 67.6, and taking
light to tone 35 does the same job there. In both themes the error is
now heavier than the brand colour rather than level with it or lighter.
This is the same trade §2.1 already makes for dark `primary`: Material's
tone placement is tuned for a palette whose accent is not this
saturated.

**Success** — a CoGra role, outside Material's set

| Role | Light | Dark |
|---|---|---|
| `success` | `#006C4F` | `#7CD8B3` |
| `onSuccess` | `#FFFFFF` | `#003828` |
| `successContainer` | `#98F5CE` | `#00513B` |
| `onSuccessContainer` | `#002116` | `#98F5CE` |

Material has no success role, so this one is generated the way
Material Theme Builder generates a custom colour: `Blend.harmonize`
the design colour `#00897B` toward the seed, then read the resulting
palette at Material's own error tones — light 40/100/90/10, dark
80/20/30/90 — so success carries exactly the weight error does.

It is a teal rather than a true green for two reasons. Harmonizing a
green into an orange-led palette lands it within 23° of `tertiary`,
which is already an olive; and red/green is the pair colour-blind
readers lose, where teal keeps a blue component that survives. `error`
and `success` must stay distinguishable by more than their label, even
though §10 requires the label too.

`ColorScheme` has no slot for these, so on Android they ride the
CompositionLocal pattern Android documents for extending Material
(`CograTheme.colors.success`) rather than a `ColorScheme` extension
property, which would read `isSystemInDarkTheme()` at the call site and
disagree with any caller passing `darkTheme` explicitly — as previews
and Robolectric tests do.

**Surface**

| Role | Light | Dark |
|---|---|---|
| `surface` | `#FFF8F6` | `#151312` |
| `onSurface` | `#251913` | `#E8E1DF` |
| `surfaceVariant` | `#FDDCCD` | `#4B4644` |
| `onSurfaceVariant` | `#584237` | `#CDC5C2` |
| `surfaceDim` | `#EDD5CB` | `#151312` |
| `surfaceBright` | `#FFF8F6` | `#3C3837` |

**Surface containers**

| Role | Light | Dark |
|---|---|---|
| `surfaceContainerLowest` | `#FFFFFF` | `#100E0D` |
| `surfaceContainerLow` | `#FFF1EB` | `#1E1B1A` |
| `surfaceContainer` | `#FFEAE1` | `#221F1E` |
| `surfaceContainerHigh` | `#FBE3D9` | `#2C2928` |
| `surfaceContainerHighest` | `#F5DED4` | `#373433` |

**Outline**

| Role | Light | Dark |
|---|---|---|
| `outline` | `#8C7165` | `#968F8D` |
| `outlineVariant` | `#E0C0B2` | `#4B4644` |

**Inverse**

| Role | Light | Dark |
|---|---|---|
| `inverseSurface` | `#3B2D27` | `#E8E1DF` |
| `inverseOnSurface` | `#FFEDE6` | `#33302F` |
| `inversePrimary` | `#FFB692` | `#9F4100` |

`scrim` and `shadow` are `#000000` in both themes. `background` and
`onBackground` mirror `surface` and `onSurface` exactly — Material
carries both pairs, and the generator gives them the same values.
`surfaceTint` follows `primary`, so dark tonal elevation cannot
reintroduce the tone-80 orange §2.1 rejects.

### 2.4 Applying the roles

- Page and screen ground is `surface`. Cards and raised
  regions step up through `surfaceContainerLow` →
  `surfaceContainer` → `surfaceContainerHigh` →
  `surfaceContainerHighest`; never invent an intermediate. A card
  is Material's **filled** card at `surfaceContainerHighest` and
  carries no outline: the fill is what makes it read as a card,
  and an outline on the page colour is the *outlined* card, a
  different component. Dialogs sit on `surfaceContainerHigh`.
- `primaryContainer` is the loudest surface in the app. It
  belongs to the bar's compose action and to a committed
  stance — not to every button. Spend it in one place per
  screen.
- Secondary text is `onSurfaceVariant`, never `onSurface` at
  reduced opacity: opacity breaks the contrast guarantee the
  token carries.
- `error` is for failure, never for negative stance. A
  negative stance is an ordinary, legitimate opinion (§8) and
  colouring it as an error editorialises it.
- `success` marks a completed action — a signed write landing, a
  saved edit. It never carries the meaning alone: the words say what
  happened and the colour agrees with them (§10). It is not a stance
  colour either; a positive stance is an opinion, not an outcome.

### 2.5 Dynamic colour

Material You dynamic colour is **off**. The brand hue carries
identity that a wallpaper-derived palette would erase, and
with two clients the wallpaper source exists on only one of
them. Revisit as a user-facing preference, never as the
default.

---

## 3. Type

**Figtree** ([Google Fonts](https://fonts.google.com/specimen/Figtree),
SIL OFL 1.1), variable, weight axis 300–900, subset to
**latin + latin-ext**.

Latin-ext is not optional: `İ ğ ş` live there, so a
`latin`-only subset silently breaks Turkish. Figtree has no
Cyrillic or Greek and no upstream plan for them; if CoGra ever
ships either script this choice must be revisited, and that is
a product-scope decision rather than a typographic one.

One family for everything — headers included, with weight
doing the work a second face would. Figtree's variable file is
~30 KB as subset woff2 (20 KB latin, 10 KB latin-ext) and
~61 KB as the upstream TTF, so the whole type budget is smaller
than a single static weight of most alternatives.

Codes and identifiers — recovery codes, key ids, seed entry —
are the one exception, set in the platform's own monospace
(`FontFamily.Monospace`, `ui-monospace`). That is a legibility
device for strings read character by character, where `0/O` and
`l/1` have to separate and a mistyped recovery code is
unrecoverable. It is never UI chrome (§1), and it ships no
bytes.

There is no italic axis: roman and italic are two files on
both platforms. Figtree's italic is a slant with a redrawn
single-storey `a`, not a full cursive redraw — fine for
emphasis in user text, not a display device.

**The type scale is Material 3's fifteen roles, unmodified.**
Sizes, line heights, and tracking come from the M3 scale; only
the family is swapped. Deviating from the scale is a decision
to raise, not a per-screen liberty.

On Android, a variable font must live in `app/res/font/`
(lowercase filename), needs API 26+, and cannot be delivered
through downloadable fonts. Driving all fifteen roles from one
variable file means declaring several `Font(...)` entries
against the same resource with different
`FontVariation.Settings` — a pattern Google's own docs never
show but which is the only way to avoid shipping static cuts.
Four entries carry it: 400 and 500 are what the scale itself
asks for, 600 and 700 carry emphasis, and declaring them keeps
the platform from synthesising a fake bold. `variationSettings`
is opt-in API in current Compose, and the opt-in is Android's
own documented route to the axis.

The TTF ships unmodified — Figtree carries only latin and
latin-ext, so the subset is the whole font. The OFL requires
the licence travel with the font it covers, so
`app/src/main/assets/figtree-ofl.txt` rides in the APK; it
belongs on an open-source-licences screen once one exists.

On web, `next/font/google` downloads and self-hosts at build
time, so no request reaches Google from the browser. Pass
`subsets: ['latin', 'latin-ext']` explicitly.

The fifteen roles are Tailwind font-size utilities: `--text-title-medium`
with its `--line-height`, `--letter-spacing`, and `--font-weight`
companions, so a screen writes `text-title-medium` once and gets the
whole role. The values are `@material/web`'s generated typescale
tokens — the web counterpart of the Compose tokens Android reads —
and `type.test.ts` pins the stylesheet to that package, so a
hand-edited number cannot survive. The same test fails on a
`text-sm`, `font-medium`, or `tracking-*` left in a screen: an
ad-hoc size is what makes the next scale change a rewrite instead
of a token edit, exactly as §2.3 says of a literal hex. Unclassed
text lands on `body-large`.

Which role a surface takes: page titles are `headline-small`,
card and section headings `title-medium`, form labels and buttons
`label-large`, body and status copy `body-medium`, captions and
bylines `body-small`, reading content `body-large`. A displayed
recovery code takes `title-large` in the platform monospace with
wider tracking — it is transcribed by hand, so it is the largest
thing on its surface.

The two token sets round three trackings differently —
`display-large`, `body-medium`, and `title-medium`, by at most
0.05px at their own size. Each client takes its own platform's
value; the difference is under a pixel and does not earn a shared
contract file the way the palette does.

---

## 4. Shape, spacing, motion

These follow Material 3 as documented. Where this doc is
silent, M3 is the answer, and the M3 default is the decision —
not a placeholder awaiting taste.

- **Shape.** The M3 shape scale — 4 / 8 / 12 / 16 / 28dp, plus
  the full pill. Text fields take the 4dp rung, cards and inline
  containers 12dp, dialogs 28dp; buttons take the pill at every
  size, which is Material's button shape rather than a rung.
  Cards and sheets sit at the generous end of the scale; the
  direction is rounded and soft, and a square corner should look
  like a mistake. On web the five rungs are the only radius names
  that exist — Tailwind's own are cleared, and `shape.test.ts`
  fails on an off-scale corner. One radius on every surface is
  how the two clients drift apart without anyone deciding to.
- **Spacing.** A 4dp/4px base grid. Screen gutters and list
  spacing follow M3 defaults.
- **Elevation.** Tonal elevation through the surface-container
  roles. Shadows stay soft and are never used to manufacture
  urgency.
- **Motion.** M3 motion, standard easing and durations.
  Motion clarifies where something came from; it never
  performs. Honour reduced-motion preferences on both
  platforms.
- **Touch targets.** 48dp minimum, including the stance
  control's resting state.

---

## 5. Iconography

Material Symbols, one weight and one fill style throughout —
mixing fills is the most common way an icon set starts to look
accidental. On Android these come from the Compose
`material-icons-extended` artifact exposed by
`core:designsystem`. Icons never carry meaning alone: every
icon-only control has a label for assistive technology.

---

## 6. Components

Shared components live in `core:designsystem` on Android and
`web/src/lib/ui/` on web. **The moment a piece appears on a
second surface it moves into the shared module** — a copy is
never the answer.

**Buttons are Material's three**, and no others: filled
(`primary` on `onPrimary`) for the one committing action on a
surface, outlined for a secondary action, text for a tertiary
one. Both unfilled variants put `primary` on the *label* — the
label carries the emphasis, not the border, and a body-coloured
label on an outlined button reads as disabled. What separates a
button from a link is what the control does: performing an
action is a button, going somewhere is a link. A button dressed
as an underlined link is neither, and it is the form a
destructive action is most likely to arrive in.

The inventory both platforms implement, with equivalent
behaviour and matching names:

- **Post card** — author (avatar, display name, handle,
  timestamp), optional title, optional description, body,
  media gallery, stance control. Variants: text-only,
  single-image, gallery, with and without title.
- **Comment** — author, body, timestamp, media, nested
  replies, stance control. Variants: top-level, nested.
- **Profile header** — avatar, name, handle, bio, link,
  connection count, and a primary action.
- **Actor chip / row** — compact person-or-group reference. A
  Collective looks like a person but reads as a shared
  identity.
- **Topic chip** — a tappable tag.
- **Media attachment** — aspect-ratio-reserved tile with
  optional alt text; gallery layout for multiples. Space is
  reserved before load so content never jumps.
- **Empty, loading, and error states** for every list surface.
  Designed, not blank.
- **Scaffolding** — top app bars, bottom navigation, bottom
  sheets, snackbars.

The bottom bar is the app's frame. Five slots, left to right:
**feed, search, create post, wallet, profile** — each slot
arrives with the slice that builds its surface, so the bar grows
toward five. The center slot is the compose *action*, not a
destination — a deliberate deviation from M3's destinations-only
navigation-bar guidance, accepted for the reach of the one
gesture the product lives on; it wears `primaryContainer`
(§2.4). Every viewer gets the same shell: the bar shows for
signed-in, applicant, and anonymous viewers alike, and a slot
that needs an account (the compose action, the profile tab)
asks on an anonymous tap — a dialog offering sign-in or
keep-browsing — never yanking the read away. Login is the
signed-out entry; the invite entry and the public feed hang
off it. The bars are compact: the 64dp short
navigation bar rather than the taller classic one, under the
stock small top app bar with its inset applied exactly once; the
web mirrors them (≈61px bar, ≈48px header band), its slots
wearing the same Material glyphs as the app's. Settings hangs off
the profile screen's top-bar gear; invite management is a
standalone entry on one's own profile. The application and
reciprocation cards are shell-scoped banners — they ride above
whichever tab is active until resolved.

The screen top collapses: scrolling down hides the top app bar,
and any upward scroll brings it back — M3 `enterAlways` on
Android; the web mirrors the motion with a sticky region that
hides once half of its own flow slot has scrolled past (early
enough to feel prompt, late enough that the exit motion covers
the vacated slot) and pins back on any upward scroll. A must-act
card — the key-restore banner, shown whenever the account's
actor key is attached but absent on this device, member and
applicant alike — rides the collapsing region on the feed and
profile, following the reader away and back by scroll direction
instead of living only at the top of the list; the banner stack
never repeats it.

Confirmation of a completed action is a snackbar on both
platforms, fired once per event.

---

## 7. Copy

**Numbers are in scope.** CoGra's ranking is not a black box,
and the UI must not behave as though it were. A post can show
what it scored and why it sits where it does, opening into the
actual paths behind it. Showing the number is the honest move;
withholding it would be the opacity this product exists to
refuse.

Two rules keep that from becoming noise. **Every number shown
is explainable** — traceable, on demand, to what produced it;
a figure with no path behind it is exactly the black box again,
just smaller. And **detail is layered**: a calm surface by
default, the arithmetic a tap away, with the density partly
the reader's own choice to opt into or out of.

What stays out of user-facing copy is the *implementation
vocabulary* — words describing how the thing is built rather
than what the reader is doing: graph, node, edge, vertex,
tensor, weight, parameter, decentralized, protocol, token,
crypto.

The rule is "as little as possible, as much as needed", not a
word ban: where the format *is* the content, name it exactly. A
key export that won't say PEM, PKCS#8, hex, or Ed25519 is an
export nobody can feed to another tool
([auth.md "Key export"](auth.md#key-export)), and codes, keys,
and recovery are the reader's own vocabulary on those surfaces.
Plain language frames the block; the precise label sits on it.

This is greppable and should be enforced as a check over
Android's `strings.xml` files and the web copy rather than
left to review.

The docs' internal vocabulary — *valence*, *connection*,
`p_d`, `p_i` — is for this repo, not the screen.
[edges.md §1](../primitive/edges.md) explicitly leaves
frontend labels free: "CoGra's frontend labels surface
whichever aspect fits the gesture."

Write from the reader's side. Active voice. A control says
what will happen; the confirmation says what happened.

---

## 8. The stance control

CoGra's signature interaction.

### 8.1 What is being authored

Every interaction carries two independent values, both
continuous floats in `[−1, +1]`
([edges.md §1](../primitive/edges.md)):

- **`p_d` — valence.** How you stand on it, from against to
  for.
- **`p_i` — connection.** How much you want it in your world,
  from keep-it-away to tell-me-everything.

All four quadrants are legitimate and there is no authoring
bar. Negative `p_i` genuinely means "do not let this reach
people through me", and that is the intended semantic, not a
mistake to design around. Note that
[invitations.md §5](../primitive/invitations.md) treats
negative connection as a trap *in the invitation flow
specifically*, where a modest positive pair is the better
expression; that guidance is scoped to invitations and does
not generalise to everyday stance.

What the UI needs to send is only the target, the two floats,
and an optional acting identity. Domain, mask, and tier are
family-fixed by the census and are never UI choices
([edges.md §1](../primitive/edges.md)); the family follows
from the target.

**Each gesture authors one edge.** The pad writes a single
record carrying exactly the values picked, both in `[−1, +1]`.
It never computes a delta against your history and never
rewrites what is already there. One new edge against a
years-long bundle is a real, visible signal without erasing
the years — a bad week with an old friend should not undo the
friendship, and their weight in your world should come out
roughly where it was, a little lower, not negative.

Everything about the bundle is **read-side**: your current
standing toward someone, what a pick will add to it, and what
reaching severance would take. The picker surfaces that
information; it never folds it into the value it writes.
Current standing ships with the control; richer neighbourhood
context arrives with feed ranking.

Nothing implicit ever becomes a record: scrolling, dwell,
opening, and sharing are not stances ([graph-model.md
§Stances, not events](../primitive/graph-model.md)).

### 8.2 What a pick lands you at

The value written is one edge; what matters is where the
bundle lands once that edge folds in. Those are two different
numbers, and the control has to show the second one.

A bundle whose folded parameter is zero is routing-inert — it
carries nothing ([feed-ranking.md](../primitive/feed-ranking.md)).
A bundle netting to `(0, 0)` is severance: deliberate,
burn-priced, and carrying consequences ordinary stances do not
— no feed presence, no attribution earnings, no vouch
propagation.

**A single pick can reach severance.** Against a short history
it is easy: one `(+1, +1)` edge plus a new `(−1, −1)` nets to
exactly zero. The protection is not arithmetic and cannot be —
it is telling people where they are about to land.

So the control **never prevents a choice**. The whole square is
reachable, corners included; someone dragging to the far
corner means it, and withholding `(−1, −1)` would be the worse
failure. What it does instead is explain, and confirm when it
matters:

- Always show where the pick lands the bundle, not only the
  value being written. This costs nothing to fetch: the bundle
  is already loaded by the read that rendered the thing being
  rated.
- If the result is inert on either axis, say the stance will
  carry nothing.
- If the result is `(0, 0)`, name it as severance, say what it
  costs, and ask whether that was the intent (§8.5).

### 8.3 The gesture

A single tap target at rest. A plain tap commits a modest
positive — **`(+0.1, +0.1)`**, per the repo-wide low-defaults
policy: defaults sit low so stronger stances stay expressible
([invitations.md §3](../primitive/invitations.md)).

Press and hold, and a soft circular pad blooms under the
thumb. Drift to position; release to commit. Horizontal is
valence, vertical is connection. **The pad opens at the
origin**, untilted toward either direction — the low default
belongs to the tap, not to the considered gesture.

By default the pad shows words and a face — no numbers, axes,
or gridlines. Exact values stay available to anyone who wants
them (§8.6); they are simply not the default reading. The
inert centre-lines are drawn as visibly dead ground rather
than hidden, so the model reads as legible rather than
mysterious.

### 8.4 The emoji readout

The committed value is the exact continuous pair. The emoji is
a **lossy readout of the edge being authored** — this pick,
not the bundle it joins. Where the bundle ends up is shown
separately (§8.2); conflating the two would make the face
mean something different depending on history, which is
exactly what a readout must not do.

Decoupling the readout from the value is what lets the value
stay continuous while the feedback stays legible. Emoji count
controls readability only, never precision.

**The readout sits just above the pad**, never under the knob:
a thumb on the control covers exactly the spot where feedback
would otherwise appear, so it has to live clear of the finger
to be worth anything.

Twenty anchors are placed in the field; the readout is the
**nearest anchor by Euclidean distance**. They are deliberately
dense in the for-it-and-want-it quadrant, where most real
stances land and small differences matter, and sparse at the
extremes, where finer distinctions carry no meaning. A regular
grid cannot express that, and puts visible seams in a
continuous field.

| `p_d` | `p_i` | Readout | Label |
|---:|---:|:---:|---|
| +0.15 | +0.15 | 🙂 | Nice |
| +0.55 | +0.20 | 😊 | Like this |
| +0.90 | +0.25 | 😍 | Love this |
| +0.20 | +0.60 | 👀 | Show me more |
| +0.60 | +0.65 | 🤩 | Really into this |
| +0.25 | +0.95 | 🍿 | Tell me everything |
| +0.95 | +0.90 | 🔥 | All in |
| −0.15 | +0.15 | 😕 | Not for me |
| −0.55 | +0.25 | 🙁 | Don't like this |
| −0.90 | +0.30 | 😠 | Really against this |
| −0.45 | +0.75 | 😤 | Against, but keep me posted |
| −0.90 | +0.90 | 🤬 | Against, and I want all of it |
| +0.20 | −0.20 | 😶 | Fine, just not for me |
| +0.70 | −0.30 | 😌 | Good, but not in my world |
| +0.30 | −0.80 | 🙈 | Rather not see this |
| +0.90 | −0.85 | 🤐 | Good, keep it away |
| −0.20 | −0.20 | 😑 | Meh |
| −0.60 | −0.45 | 😖 | Dislike, keep away |
| −0.35 | −0.85 | 🚫 | Keep this away |
| −0.90 | −0.90 | 💀 | Absolutely not |

The table is the contract: both platforms read these values,
and a change here changes both apps.

System emoji are used rather than drawn faces. They render
differently across Android versions and between the two
clients, which is a known and accepted cost; drawn faces are
the upgrade path if that inconsistency becomes a problem.

### 8.5 Severance

Severance — a bundle netted to `(0, 0)` — has its own flow for
the case where it is the goal: an explicit route with its own
confirmation, **findable from the open pad**, because someone
who has decided they need it has to be able to discover how.

It can also arrive as the result of an ordinary pick (§8.2).
That case is handled by the same confirmation rather than by
refusing the pick: the user is told what the choice nets to,
what it costs, and asked whether that was the intent.

Either way, this is where the read-side guidance belongs —
current standing, and what reaching zero would actually take.

### 8.6 Alternate inputs

The pad is the default, not the only way. Settings offer the
same value through:

- **Paired sliders** — one per parameter.
- **Direct entry** — typed values for people who want exact
  control.

Same machinery, different surface. These are also the
**accessible path**: the pad is a drag gesture, and the
alternates give screen-reader and switch users the full range
through ordinary, well-supported controls rather than a
degraded version of the gesture. Selecting an alternate
replaces the pad everywhere, not per-screen.

### 8.7 Teaching it

A held gesture is invisible until taught. The pad gets a
one-time first-run coach mark, the resting target is labelled,
and a plain tap always works without ever opening the pad —
so the feature is discoverable but never blocking.

---

## 9. Honesty surfaces

The protocol never deletes and never erases silently
([layers.md §5](../primitive/layers.md)), and the UI has to
carry that without alarming anyone.

- **Edited** — a soft marker with an optional tap to see what
  changed. Friendly, not forensic.
- **Removed** — a calm placeholder in place of the content,
  never a silent gap. It reads as a statement of fact, not a
  warning.
- **Sensitive** — a gentle blur with tap to reveal, tuned by
  the reader's own preference. Warm wording.

None of these use `error` colouring.

---

## 10. Accessibility

Part of the bar from day one, never retrofitted — the same
rule the platform docs already carry ([android.md
§Accessibility](android.md#accessibility), [web.md
§Accessibility](web.md#accessibility)).

- Every `on`-colour pair meets WCAG AA, verified at palette
  generation.
- Colour never carries meaning alone; stance is always
  accompanied by words.
- 48dp minimum touch targets.
- Every icon-only control is labelled.
- Drag gestures always have a non-drag equivalent (§8.6).
- Both themes are designed, not derived by inversion.

---

## 11. The mark

CoGra's mark is a **lowercase g**. The bowl is the stance pad and
the dot inside it is a committed pick sitting in the
for-it-and-want-it quadrant — the letterform and the signature
interaction (§8) are the same drawing.

The obvious alternative, a rounded square holding an offset
circle, is not available: that is Instagram's glyph in silhouette,
corner radius, and dot placement. The g keeps the field and the
pick inside a shape nobody owns.

**It is drawn on Figtree's own `g`**, not freehand — bowl 524
units across, x-height 500, overshoot 12, descender 213 below the
baseline, advance 601, left sidebearing 30. The stroke is matched
to weight 700 so the mark sits in the wordmark without reading as
a lighter letter dropped between the others. The tail is the
font's descender centreline, extracted from the glyph outline
rather than approximated, trimmed so the round terminal stops
short of where the font's flat cut lands.

`docs/assets/cogra-mark.svg` is the source of truth. Every other
asset is generated from it and **never redrawn** — a second
drawing is how a mark starts to drift.

**Colour.** Standing alone, the letter takes `primary` and the
pick takes `primaryContainer`. As an app icon or favicon the mark
sits on a `primaryContainer` ground with `onPrimaryContainer` ink
and a `surface` pick, so a browser tab and a home screen show the
same tile.

**Android.** An adaptive icon: `primaryContainer` background
layer, the mark as the foreground, and a monochrome layer for
themed icons. Content is scaled so the mark's enclosing circle
matches the 66dp keyline on the 108dp layer, which no launcher
mask can clip.

**Web.** The same tile as `favicon.ico` (16/32/48), `icon.svg`,
and `apple-icon.png`, placed by Next.js's file conventions rather
than hand-written `<link>` tags.

**Wordmark.** "cogra" set in Figtree. The mark may stand in for
the `g`, taking the real glyph's advance and left sidebearing so
the spacing matches rather than approximates it.

---

## 12. Open decisions

- **Drawn faces** as a replacement for system emoji (§8.4).
- **Cyrillic or Greek support**, which would force the
  typeface choice open again (§3).
