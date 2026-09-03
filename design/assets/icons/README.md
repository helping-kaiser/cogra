# Icons · `guide:design:icon-assets`

Material Design Icons (Apache-2.0), 24×24, `currentColor`, **classic
filled** variant — the set and variant the product inlines in
`web/src/lib/ui/icons.tsx` and wraps on Android via
`material-icons-extended`. The background `<path d="M0 0h24v24H0z"
fill="none"/>` rect is stripped, per the product's own convention.

| File | Material name | Where |
|---|---|---|
| dynamic-feed.svg | dynamic_feed | bottom bar, feed slot |
| person.svg | person (filled) | bottom bar, profile slot, selected |
| person-outline.svg | person (outlined) | bottom bar, profile slot, unselected |
| add.svg | add | bottom bar, the compose action |
| search.svg | search | bottom bar, explore/search slot |
| account-balance-wallet.svg | account_balance_wallet | bottom bar, wallet slot |
| settings.svg | settings | profile top bar |
| visibility.svg / visibility-off.svg | visibility, visibility_off | password field toggle |
| arrow-back.svg | arrow_back | page headers (mirror for RTL at the call site) |
| more-vert.svg | more_vert | the post overflow menu |
| chat-bubble.svg | chat_bubble | the comments affordance on a card |
| volume-up.svg / volume-off.svg | volume_up, volume_off | a video's sound toggle |
| play-arrow.svg / pause.svg | play_arrow, pause | the video transport; the play disc on a suppressed-autoplay card |
| share.svg | share | handing a post to the OS share sheet |
| fast-rewind.svg / fast-forward.svg | fast_rewind, fast_forward | the transport's skips, flanking play/pause |
| fullscreen.svg | fullscreen | the transport's hand-off to the fullscreen viewer |
| close.svg | close | the composer's leave control; the viewer's dismiss |
| drag-indicator.svg | drag_indicator | the picked tray's reorder handle |
| lock.svg | lock | a locked field (the edit's licence) |
| expand-more.svg / chevron-right.svg | expand_more, chevron_right | a disclosure, and a row that opens |
| arrow-outward.svg | arrow_outward | the wallet's direction badge (rotated 180° for incoming) |
| content-copy.svg | content_copy | copying the payout address |
| graph-3.svg | graph_3 | the Post Score |

`graph-3.svg` is the one exception: Material **Symbols** only (hence the
`0 -960 960 960` viewBox), and **derived** — Material ships no FILL-1 cut,
so this is the official outlined path with the node counters closed, which
turns the hairline rings into solid dots at the weight of the filled set.
Derived, not redrawn. See `../../guidelines/iconography.md`.

These files are the reference copies. Components render from the inlined
path data in `components/navigation/Icon.jsx`, which is identical.
