# Iconography · `guide:design:iconography`

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
  that.

## The set

This table is the one inventory: it lists every glyph `Icon` holds
(`components/navigation/Icon.jsx`, `PATHS`), and each is a file in
`assets/icons/`. All are **inlined SVG path data**; all but `graph_3`
are the classic **filled** 24px variant, verbatim from
`material-design-icons` (Apache-2.0) — the exact set and variant the
product already inlines, so web and Android match. A glyph marked
*addition* is the system's own, not yet in the product's set; one marked
*post-MVP* is drawn only in `designs/postmvp/`.

| Glyph | Where | Call |
|---|---|---|
| `dynamic_feed` | bottom bar, feed slot (one drawing for both selection states; selection shows in colour); the chronicle's posts tab | `<Icon name="dynamic_feed" />` |
| `person` | bottom bar, profile slot, selected | `<Icon name="person" />` |
| `person` outlined | bottom bar, profile slot, unselected | `<Icon name="person_outline" />` |
| `add` | bottom bar, the compose action; a picker row's add | `<Icon name="add" />` |
| `search` | bottom bar, explore slot; the search bar | `<Icon name="search" />` |
| `account_balance_wallet` | bottom bar, wallet slot | `<Icon name="wallet" />` |
| `notifications` | the band's bell, on every root | `<Icon name="notifications" />` |
| `forum` | the band's chats door; a chat's node-type mark | `<Icon name="forum" />` |
| `settings` | the own profile's band, the Settings door | `<Icon name="settings" />` |
| `arrow_back` | every page header | `<Icon name="arrow_back" />` |
| `more_vert` | every overflow menu — a post's, a comment's, and either profile's actions row | `<Icon name="more_vert" />` |
| `chat_bubble` | the comments affordance on a card; the chronicle's comments tab | `<Icon name="chat_bubble" />` |
| `share` | handing a post to the OS share sheet | `<Icon name="share" />` |
| `graph_3` | the Feed score | `<Icon name="graph" />` |
| `sentiment_neutral` | the stance anchor's unset state on the stream's rail | `<Icon name="sentiment_neutral" />` |
| `bookmark` | the unsave control on a Saved row — *addition* | `<Icon name="bookmark" />` |
| `history` | the chronicle's Everything tab — *addition* | `<Icon name="history" />` |
| `photo_camera` | the avatar's change badge on one's own profile — *addition* | `<Icon name="photo_camera" />` |
| `visibility` / `visibility_off` | the password field's toggle; the sensitive veil's reveal | `<Icon name="visibility" />` |
| `check` | the checkbox's mark, and only that — *addition* | `<Icon name="check" />` |
| `expand_more` | a disclosure that opens in place (the seal's acts, About's sections) | `<Icon name="expand_more" />` |
| `chevron_right` | a settings row's or a content row's way on | `<Icon name="chevron_right" />` |
| `close` | removing a staged picture, reference or tag; the compose wizard's and the media viewer's close | `<Icon name="close" />` |
| `image` | a picture's stand-in on the pick stage and the cover row | `<Icon name="image" />` |
| `drag_indicator` | a picked picture's reorder handle | `<Icon name="drag_indicator" />` |
| `lock` | a field that never changes (the license on an edit); post-MVP: a chat message sent encrypted, and the chat foot's lock toggle, on | `<Icon name="lock" />` |
| `lock_outline` | the chat foot's lock toggle, off — *post-MVP*, *addition* | `<Icon name="lock_outline" />` |
| `volume_up` / `volume_off` | a video's sound toggle | `<Icon name="volume_up" />` |
| `play_arrow` / `pause` | the transport's play slot; the play disc on a suppressed-autoplay card and on a staged clip | `<Icon name="play_arrow" />` |
| `replay` | the play slot's third state, a clip that has ended | `<Icon name="replay" />` |
| `fast_rewind` / `fast_forward` | the transport's flanking skips | `<Icon name="fast_rewind" />` |
| `fullscreen` | handing the clip the whole screen | `<Icon name="fullscreen" />` |
| `how_to_vote` | a proposal's node-type mark | `<Icon name="how_to_vote" />` |
| `inventory_2` | an item's node-type mark | `<Icon name="inventory_2" />` |
| `campaign` | a campaign's node-type mark | `<Icon name="campaign" />` |
| `sell` | an offer's node-type mark | `<Icon name="sell" />` |
| `send` | a chat message's node-type mark | `<Icon name="send" />` |
| `arrow_outward` | a wallet row's direction badge (incoming rotates it 180°) — *post-MVP* | `<Icon name="arrow_outward" />` |
| `content_copy` | copying a payout address — *post-MVP* | `<Icon name="content_copy" />` |
| `add_comment` | the chats list's floating New chat — *post-MVP*, *addition* | `<Icon name="add_comment" />` |
| `mic` | the chat foot's voice note, hold to record — *post-MVP*, *addition* | `<Icon name="mic" />` |
| `delete` | the locked voice recording's discard — *post-MVP*, *addition* | `<Icon name="delete" />` |

The glyph is the answer everywhere — with a label in the accessibility
tree, never text beside the glyph.

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
recorded here, and it is why `graph_3` may sit in a row beside other
glyphs.

## Rules

- 24×24, `currentColor`. Colour comes from the parent's text colour.
- **Reach for `Icon`, never for raw path data or a second icon set.**
  `dynamic_feed` has one drawing in the classic set — Android's Filled
  and Outlined variants share it, and selection shows in colour. Two
  glyphs carry two cuts, each on a control whose state is its fill:
  `person` (the bar's selected slot) and `lock` (the post-MVP chat
  foot's encryption toggle).
- **An icon never carries meaning alone.** Every icon-only control has a
  label for assistive technology; the SVG itself is always
  `aria-hidden`.
- One fill style per surface. Never mix filled and outlined cuts except
  where state is the distinction (the profile slot, the chat foot's
  lock).
- **Emoji are not icons.** The stance readout is a value, not a glyph
  set, and emoji never appear anywhere else.
- **Do not draw new icons.** If the set lacks a glyph, take the official
  Material one; if Material lacks it, the design needs a word. Ask for an
  export — never trace one.
- **Icon buttons carry no background, except the drawn discs.** The
  compose action's `primaryContainer` disc is a loud surface spent
  deliberately; the media discs — the sound disc and the play disc a
  video wears, on `surface-snackbar` — sit on photography, where a bare
  glyph would not read (readme §13, the reel round); the avatar's change
  badge is a `secondaryContainer` disc on the picture's corner. The
  chats list's floating New chat is the post-MVP chats round's and stays
  scoped there.
