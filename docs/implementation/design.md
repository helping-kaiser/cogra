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
| 1 | Direction | the anti-goals: [readme §2](../../design/readme.md#2-product-context); the tone bullets stay here ([§1](#1-direction)) and also in [readme §3](../../design/readme.md#3-content-fundamentals) |
| 2 | Colour | rows 2.1 to 2.5 |
| 2.1 | The colour decision | [readme §4 Colour](../../design/readme.md#colour) |
| 2.2 | Reproducing the palette | the generator, `web/src/lib/ui/design-tokens.test.ts`, is the recipe; [readme §4 Colour](../../design/readme.md#colour) names it, `make tokens` regenerates the scheme |
| 2.3 | Tokens | the values: [scheme.json](../../design/tokens/scheme.json), [colors.css](../../design/tokens/colors.css), [tokens.json](../../design/tokens.json); the departures and the success role: [readme §4 Colour](../../design/readme.md#colour); on Android the roles beyond Material ride a CompositionLocal (`Theme.kt`) |
| 2.4 | Applying the roles | [readme §4 Colour](../../design/readme.md#colour), [semantic.css](../../design/tokens/semantic.css) |
| 2.5 | Dynamic colour | [readme §4 Colour](../../design/readme.md#colour) |
| 3 | Type | [readme §4 Type](../../design/readme.md#type), [typography.css](../../design/tokens/typography.css), [fonts.css](../../design/tokens/fonts.css); platform notes stay here ([§3](#3-type)) |
| 4 | Shape, spacing, motion | [readme §4](../../design/readme.md#4-visual-foundations): Spacing and layout, Corner radii and cards, Elevation, Motion; [shape.css](../../design/tokens/shape.css), [spacing.css](../../design/tokens/spacing.css), [motion.css](../../design/tokens/motion.css) |
| 5 | Iconography | [readme §5](../../design/readme.md#5-iconography), [iconography.md](../../design/guidelines/iconography.md) |
| 6 | Components | [readme §7](../../design/readme.md#7-components) and each component's `components/<family>/<Name>.prompt.md`; the bar and the collapsing top also [readme §4](../../design/readme.md#4-visual-foundations) |
| 7 | Copy | [readme §3](../../design/readme.md#3-content-fundamentals), [copy-voice.md](../../design/guidelines/copy-voice.md) |
| 8 | The stance control | [readme §8](../../design/readme.md#8-the-stance-control), [stance-control.md](../../design/guidelines/stance-control.md), `components/stance/` |
| 8.1 | What is being authored | [stance-control.md](../../design/guidelines/stance-control.md#what-is-being-authored) |
| 8.2 | What a pick lands you at | [stance-control.md](../../design/guidelines/stance-control.md#two-numbers-never-one) and [Severance](../../design/guidelines/stance-control.md#severance) |
| 8.3 | The gesture | [stance-control.md](../../design/guidelines/stance-control.md#the-gesture) and [Confirmation](../../design/guidelines/stance-control.md#confirmation); the passages the web tests parse stay here ([§8.3](#83-the-gesture)) |
| 8.4 | The emoji readout | [stance-control.md](../../design/guidelines/stance-control.md#the-emoji-readout), `components/stance/StanceReadout.jsx`; the table and the zero-bundle passage stay here ([§8.4](#84-the-emoji-readout)) |
| 8.5 | Severance | [stance-control.md](../../design/guidelines/stance-control.md#severance), `components/stance/SeveranceConfirm.jsx` |
| 8.6 | Alternate inputs | [stance-control.md](../../design/guidelines/stance-control.md#alternate-and-accessible-inputs) |
| 8.7 | Teaching it | [stance-control.md](../../design/guidelines/stance-control.md#teaching-it) |
| 9 | Honesty surfaces | [readme §9](../../design/readme.md#9-honesty-surfaces), `components/honesty/` |
| 10 | Accessibility | [readme §10](../../design/readme.md#10-accessibility) |
| 11 | The mark | [readme §6](../../design/readme.md#6-the-mark), [brand-mark.html](../../design/guidelines/brand-mark.html), [brand-tile.html](../../design/guidelines/brand-tile.html), [brand-wordmark.html](../../design/guidelines/brand-wordmark.html) |
| 12 | Open decisions | drawn faces: [stance-control.md](../../design/guidelines/stance-control.md#the-emoji-readout); Cyrillic and Greek: [readme §4 Type](../../design/readme.md#type) |

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

---

## 3. Type

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

---

## 8. The stance control

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
