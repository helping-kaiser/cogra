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
dense dashboards, no monospace UI, no dark "hacker" aesthetic,
no raw numbers presented as scores.

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
| `error` | `#BA1A1A` | `#FFB4AB` |
| `onError` | `#FFFFFF` | `#690005` |
| `errorContainer` | `#FFDAD6` | `#93000A` |
| `onErrorContainer` | `#93000A` | `#FFDAD6` |

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

`scrim` and `shadow` are `#000000` in both themes.

### 2.4 Applying the roles

- Page and screen ground is `surface`. Cards and raised
  regions step up through `surfaceContainerLow` →
  `surfaceContainer` → `surfaceContainerHigh`; never invent an
  intermediate.
- `primaryContainer` is the loudest surface in the app. It
  belongs to the compose FAB and to a committed stance — not
  to every button. Spend it in one place per screen.
- Secondary text is `onSurfaceVariant`, never `onSurface` at
  reduced opacity: opacity breaks the contrast guarantee the
  token carries.
- `error` is for failure, never for negative stance. A
  negative stance is an ordinary, legitimate opinion (§8) and
  colouring it as an error editorialises it.

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
~24 KB as a subset woff2 and ~54 KB as TTF, so the whole type
budget is smaller than a single static weight of most
alternatives.

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

On web, `next/font/google` downloads and self-hosts at build
time, so no request reaches Google from the browser. Pass
`subsets: ['latin', 'latin-ext']` explicitly.

---

## 4. Shape, spacing, motion

These follow Material 3 as documented. Where this doc is
silent, M3 is the answer, and the M3 default is the decision —
not a placeholder awaiting taste.

- **Shape.** The M3 shape scale. Cards and sheets sit at the
  generous end of it; the direction is rounded and soft, and a
  square corner should look like a mistake.
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

The inventory both platforms implement, with equivalent
behaviour and matching names:

- **Post card** — author (avatar, display name, handle,
  timestamp), optional title, optional description, body,
  media gallery, stance control. Variants: text-only,
  single-image, gallery, with and without title.
- **Comment** — author, body, timestamp, media, nested
  replies, stance control. Variants: top-level, nested.
- **Profile header** — cover, avatar, name, handle, bio, link,
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
- **Scaffolding** — top app bars, bottom navigation, compose
  FAB, bottom sheets, snackbars.

Confirmation of a completed action is a snackbar on both
platforms, fired once per event.

---

## 7. Copy

The product is a social network, not a graph. **These words
never appear in user-facing copy:** graph, node, edge, tensor,
vertex, weight, parameter, decentralized, protocol, token,
crypto, algorithm, score, ranking. Nor do raw numeric values
of any stance.

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

### 8.2 Zero contributes nothing

An edge with either parameter at zero is routing-inert — it
adds nothing to the bundle ([edges.md
§1](../primitive/edges.md)). Authoring one is pointless, not
dangerous.

Severance is a different act: netting a *whole* bundle toward
someone to `(0, 0)`. That is deliberate and burn-priced, and
carries consequences ordinary stances do not — no feed
presence, no attribution earnings, no vouch propagation
([feed-ranking.md](../primitive/feed-ranking.md)). Because one
edge never nets a bundle, no single pick can reach it by
accident, and it has its own flow (§8.5).

So the control **never prevents a choice**. The whole square is
reachable, corners included — someone dragging to the far
corner means it, and refusing to give them `(−1, −1)` would be
the worse failure. What the control does instead is explain,
and confirm when it matters:

- Land on an inert value and it says the pick will do nothing.
- Pick something drastic and it says what that means before it
  commits.

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

The pad shows words and a face, never numbers, axes, or
gridlines. The inert centre-lines are drawn as visibly dead
ground rather than hidden, so the model reads as legible
rather than mysterious.

### 8.4 The emoji readout

The committed value is the exact continuous pair. The emoji is
a **lossy readout** of where you are — decoupling the two is
what lets the value stay continuous while the feedback stays
legible. Emoji count controls readability only, never
precision.

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

Netting a whole bundle to `(0, 0)` is its own flow with its
own confirmation — never something a pick on the pad performs.
It stays **findable from the open pad**, because someone who
has decided they need it has to be able to discover how: a
quiet affordance in the expanded state, leading to the
separate flow.

That flow is where the read-side guidance belongs — current
standing, and what reaching zero would actually take.

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

## 11. Open decisions

- **Launcher icon and wordmark.** Android currently ships no
  launcher icon at all and falls back to the system default;
  web still carries the `create-next-app` favicon. The one
  asset that cannot be generated from tokens.
- **Drawn faces** as a replacement for system emoji (§8.4).
- **Cyrillic or Greek support**, which would force the
  typeface choice open again (§3).
