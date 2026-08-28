# Iconography

**Material Symbols, one weight and one fill style throughout** — mixing
fills is the most common way an icon set starts to look accidental.
`design.md` §5 is three sentences long, and this is the whole of it plus
what the code actually does.

## How each client gets them

- **Android** — the Compose `material-icons-extended` artifact, exposed
  by `core:designsystem`.
- **Web** — inlined SVG paths copied from Google's
  `material-design-icons` (Apache-2.0) into
  `web/src/lib/ui/icons.tsx`. Self-hosted like the fonts: **no icon
  font, no external fetch, no runtime dependency.** This system matches
  that — the hosted-font substitution is gone as of 2026-08-26.

## The complete set the product uses

All of them are **inlined SVG path data** in `Icon`, and each is a file in
`assets/icons/`. All but `graph_3` are the classic **filled** 24px variant, verbatim from
`material-design-icons` (Apache-2.0) — the exact set and variant the
product already inlines, so web and Android match.

| Glyph | Where | Call |
|---|---|---|
| `dynamic_feed` | bottom bar, feed slot | `<Icon name="dynamic_feed" />` |
| `person` | bottom bar, profile slot, selected | `<Icon name="person" />` |
| `person` outlined | bottom bar, profile slot, unselected | `<Icon name="person_outline" />` |
| `add` | bottom bar, the compose action | `<Icon name="add" />` |
| `search` | bottom bar, explore/search slot | `<Icon name="search" />` |
| `account_balance_wallet` | bottom bar, wallet slot | `<Icon name="wallet" />` |
| `visibility` / `visibility_off` | password field toggle | `<Icon name="visibility" />` |
| `settings` | profile top bar | `<Icon name="settings" />` |
| `arrow_back` | every page header | `<Icon name="arrow_back" />` |
| `more_vert` | the post overflow menu | `<Icon name="more_vert" />` |
| `chat_bubble` | the comments affordance on a card | `<Icon name="chat_bubble" />` |
| `volume_up` / `volume_off` | a video's sound toggle | `<Icon name="volume_up" />` |
| `check` | the checkbox's mark, and only that | `<Icon name="check" />` |
| `graph_3` | the Post Score | `<Icon name="graph" />` |
| `how_to_vote` | a proposal's node-type mark (reference rows, search results) | `<Icon name="how_to_vote" />` |
| `inventory_2` | an item's node-type mark | `<Icon name="inventory_2" />` |
| `campaign` | a campaign's node-type mark | `<Icon name="campaign" />` |
| `sell` | an offer's node-type mark | `<Icon name="sell" />` |
| `forum` | a chat's node-type mark | `<Icon name="forum" />` |
| `send` | a chat message's node-type mark | `<Icon name="send" />` |

The web client's interim words (`Show` / `Hide`, `Settings`) and its `←`
character were placeholders for icons it had not inlined. **The icons now
exist, so the glyph is the answer everywhere** — with a label in the
accessibility tree, never text beside the glyph.

**`arrow_back` is direction-sensitive.** Android wraps it AutoMirrored;
if RTL ships, mirror it with a transform at the call site rather than
adding a second drawing.

**`graph_3` is the one derived glyph.** It exists only in the newer
Material *Symbols* set (no classic equivalent, hence the `0 -960 960 960`
viewBox), and Material ships no FILL-1 cut of it. Ours is the official
outlined path with the node counters closed — the six hairline rings
become solid dots — so it carries the same weight as the filled set.
**Derived, not redrawn:** the geometry is Google's, only the counters are
gone. That is the single allowed exception to "do not draw icons", it is
recorded here, and it is why `graph_3` may now sit in a row beside other
glyphs.

## Rules

- 24×24, `currentColor`. Colour comes from the parent's text colour.
- **Reach for `Icon`, never for raw path data or a second icon set.**
  `dynamic_feed` has one drawing in the classic set — Android's Filled
  and Outlined variants share it, and selection shows in colour. Only
  `person` carries two cuts.
- **An icon never carries meaning alone.** Every icon-only control has a
  label for assistive technology; the SVG itself is always
  `aria-hidden`.
- One fill style per surface. Never mix filled and outlined cuts except
  where selection is the distinction (the profile slot).
- **Emoji are not icons.** The stance readout is a value, not a glyph
  set, and emoji never appear anywhere else.
- **Do not draw new icons.** If the set lacks a glyph, take the official
  Material one; if Material lacks it, the design needs a word. Ask for an
  export — never trace one.
- No icon buttons with backgrounds. The one circular container in the
  product is the compose action's `primaryContainer` disc, and that is a
  loud surface spent deliberately.
