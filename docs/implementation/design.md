# Design · `spec:implementation:design-system`

The design law lives in [`design/`](../../design/readme.md):
[readme.md](../../design/readme.md) and the behavior sidecars beside
the canonical screens ([behavior/](../../design/designs/canonical/behavior/README.md))
are the contract both clients conform to. Android and web read the
rules there; [android.md](android.md) and [web.md](web.md) carry only
what is platform-specific. **Every frontend change reads
`design/readme.md` before writing code.**

This file keeps its section numbers, so a citation of `design.md §n`
resolves through the map in one hop. Passages with no home in `design/`
stay below, under their own section number.

## Section map

| § | Topic | Home |
|---|---|---|
| 1 | Direction | stays here ([§1](#1-direction)); tone also in [readme §3](../../design/readme.md#3-content-fundamentals) |
| 2.1 | The colour decision | [readme §4 Colour](../../design/readme.md#colour); the deviations' reasoning stays here ([§2.1](#21-the-decision)) |
| 2.2 | Reproducing the palette | stays here ([§2.2](#22-reproducing-the-palette)) |
| 2.3 | Tokens | the values: [scheme.json](../../design/tokens/scheme.json), [colors.css](../../design/tokens/colors.css), [tokens.json](../../design/tokens.json); notes stay here ([§2.3](#23-tokens)) |
| 2.4 | Applying the roles | [readme §4 Colour](../../design/readme.md#colour), [semantic.css](../../design/tokens/semantic.css); the `success` rule stays here ([§2.4](#24-applying-the-roles)) |
| 2.5 | Dynamic colour | [readme §4 Colour](../../design/readme.md#colour) |
| 3 | Type | [readme §4 Type](../../design/readme.md#type), [typography.css](../../design/tokens/typography.css), [fonts.css](../../design/tokens/fonts.css); platform notes stay here ([§3](#3-type)) |
| 4 | Shape, spacing, motion | [readme §4](../../design/readme.md#4-visual-foundations): Spacing and layout, Corner radii and cards, Elevation, Motion; [shape.css](../../design/tokens/shape.css), [spacing.css](../../design/tokens/spacing.css), [motion.css](../../design/tokens/motion.css) |
| 5 | Iconography | [readme §5](../../design/readme.md#5-iconography), [iconography.md](../../design/guidelines/iconography.md) |
| 6 | Components | [readme §7](../../design/readme.md#7-components) and each component's `components/<family>/<Name>.prompt.md`; the bar and the collapsing top also [readme §4](../../design/readme.md#4-visual-foundations); the collapsing top's platform mechanics stay here ([§6](#6-components)) |
| 7 | Copy | [readme §3](../../design/readme.md#3-content-fundamentals), [copy-voice.md](../../design/guidelines/copy-voice.md) |
| 8 | The stance control | [readme §8](../../design/readme.md#8-the-stance-control), [stance-control.md](../../design/guidelines/stance-control.md), `components/stance/` |
| 8.1 | What is being authored | [stance-control.md](../../design/guidelines/stance-control.md#what-is-being-authored); the family slot table stays here ([§8.1](#81-what-is-being-authored)) |
| 8.2 | What a pick lands you at | [stance-control.md](../../design/guidelines/stance-control.md#two-numbers-never-one) and [Severance](../../design/guidelines/stance-control.md#severance) |
| 8.3 | The gesture | [stance-control.md](../../design/guidelines/stance-control.md#the-gesture) and [Confirmation](../../design/guidelines/stance-control.md#confirmation); the passages the web tests parse stay here ([§8.3](#83-the-gesture)) |
| 8.4 | The emoji readout | [stance-control.md](../../design/guidelines/stance-control.md#the-emoji-readout), `components/stance/StanceReadout.jsx`; the table and the zero-bundle passage stay here ([§8.4](#84-the-emoji-readout)) |
| 8.5 | Severance | [stance-control.md](../../design/guidelines/stance-control.md#severance), `components/stance/SeveranceConfirm.jsx` |
| 8.6 | Alternate inputs | [stance-control.md](../../design/guidelines/stance-control.md#alternate-and-accessible-inputs) |
| 8.7 | Teaching it | [stance-control.md](../../design/guidelines/stance-control.md#teaching-it) |
| 9 | Honesty surfaces | [readme §9](../../design/readme.md#9-honesty-surfaces), `components/honesty/` |
| 10 | Accessibility | [readme §10](../../design/readme.md#10-accessibility) |
| 11 | The mark | [readme §6](../../design/readme.md#6-the-mark), [brand-mark.html](../../design/guidelines/brand-mark.html), [brand-tile.html](../../design/guidelines/brand-tile.html), [brand-wordmark.html](../../design/guidelines/brand-wordmark.html) |
| 12 | Open decisions | drawn faces: [stance-control.md](../../design/guidelines/stance-control.md#the-emoji-readout); Cyrillic and Greek stay here ([§12](#12-open-decisions)) |

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
further from red than this one. That departure is recorded in §2.3.

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
writes **`design/tokens/scheme.json`**, the scheme
`design/tokens/colors.css` transcribes into **`design/tokens.json`**
— the token contract the clients pin their themes to, the same
arrangement the client crypto has with `client-crypto-vectors.json`.
`make tokens` regenerates the scheme; every other run asserts it is
not stale, and the AA check of §2.1 runs there, so a palette that
fails cannot be generated. `design/_build/export-tokens.mjs` fails
when `colors.css` drifts from the scheme. Neither client transcribes
a value: Android's `ColorSchemeTest` reads the contract and web's
`palette.test.ts` reads the scheme.

### 2.3 Tokens

The role values are in `design/tokens/scheme.json`.

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

`scrim` and `shadow` are `#000000` in both themes. `background` and
`onBackground` mirror `surface` and `onSurface` exactly — Material
carries both pairs, and the generator gives them the same values.
`surfaceTint` follows `primary`, so dark tonal elevation cannot
reintroduce the tone-80 orange §2.1 rejects.

### 2.4 Applying the roles

- `success` marks a completed action — a signed write landing, a
  saved edit. Landing settles content the reader already sees; it
  never announces an arrival (§9). It never carries the meaning
  alone: the words say what happened and the colour agrees with
  them (§10). It is not a stance colour either; a positive stance
  is an opinion, not an outcome.

---

## 3. Type

Latin-ext is not optional: `İ ğ ş` live there, so a
`latin`-only subset silently breaks Turkish. Figtree has no
Cyrillic or Greek and no upstream plan for them; if CoGra ever
ships either script this choice must be revisited, and that is
a product-scope decision rather than a typographic one.

Figtree's variable file is
~30 KB as subset woff2 (20 KB latin, 10 KB latin-ext) and
~61 KB as the upstream TTF, so the whole type budget is smaller
than a single static weight of most alternatives.

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
of a token edit, exactly as a literal hex is a bug ([readme §4 Colour](../../design/readme.md#colour)). Unclassed
text lands on `body-large`.

The two token sets round three trackings differently —
`display-large`, `body-medium`, and `title-medium`, by at most
0.05px at their own size. Each client takes its own platform's
value; the difference is under a pixel and does not earn a shared
contract file the way the palette does.

---

## 6. Components

Android gates M3's
`enterAlways` behind the accumulated-upward-scroll tally
([CollapsingTop](../../design/components/navigation/CollapsingTop.prompt.md);
`rememberCollapsingTop` in the design system), with the bar pinned to `surface` instead of
M3's on-scroll container tint — the collapsing region reads as
one plane with the key banner riding it. Reaching the top always
reveals it regardless of the tally — Android reads the upward
scroll the list could not consume at its boundary, the web the
region's own slot returning to view. The web otherwise mirrors
the motion with a sticky region that hides once half of its own
flow slot has scrolled past (early enough to feel prompt, late
enough that the exit motion covers the vacated slot).

---

## 8. The stance control

### 8.1 What is being authored

The census names the two slots per family:

| Family | `p_d` slot | `p_i` slot |
|---|---|---|
| Opinion, Affinity | valence | connection |
| Tag | relevance `r` | confidence `c` |
| Reference | relevance (census **effort `f`**) | support (census **enthusiasm `e`**) |

Relevance occupies `p_d` in both Tag and Reference, which is why
the word carries across the two composer sections unchanged.
Support is the axis that decides whether a mention vouches: a
citation strictly positive on both axes resolves its fold cell to
the cited person. These per-record parameters are authored with
paired sliders (§8.6), not the pad — the pad writes a stance, and
a citation is not one.

### 8.3 The gesture

The web tests parse these passages (`anchors.test.ts`, `landing.test.ts`, `pad-parking.test.ts`); where one differs from `design/`, `design/` rules.

A single tap target at rest. A plain tap commits a modest
positive — **`(+0.1, +0.1)`**, per the repo-wide low-defaults
policy: defaults sit low so stronger stances stay expressible
([invitations.md §3](../primitive/invitations.md)).

**The pad lives at one fixed spot: the lower centre of the
viewport** — the thumb-comfort zone — the same place every
time, regardless of which control opened it. Muscle memory is
part of the control; a pad that appears somewhere new on every
press cannot be operated without looking.

**The landing updates in real time.** The read that rendered
the surface already carries the viewer's bundle — its raw
sums, not only the fold — so the landing is a local fold
(`clip` of sum plus pick) recomputed live under the drag, with
no round trip and no visible lag. The staged record still
carries exactly the picked values (§8.1) and the backend's
answer remains the authority once a record is signed; the live
line is display, computed from served numbers.

### 8.4 The emoji readout

**The zero bundle never speaks through the table.** A bundle
standing at exactly `(0, 0)` — severed, or netted there — is
the absence of a feeling, and reading it as its nearest
neighbour ("🙂 Nice") is a lie. It gets its own readout: **🤷**
with the severed/no-standing wording, on every surface that
shows a standing. The anchor table reads picks and non-zero
bundles only.

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

---

## 12. Open decisions

- **Cyrillic or Greek support**, which would force the
  typeface choice open again (§3).
