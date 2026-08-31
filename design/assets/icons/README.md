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
| graph-3.svg | graph_3 | the Post Score |

`graph-3.svg` is the one exception: Material **Symbols** only (hence the
`0 -960 960 960` viewBox), and **derived** — Material ships no FILL-1 cut,
so this is the official outlined path with the node counters closed, which
turns the hairline rings into solid dots at the weight of the filled set.
Derived, not redrawn. See `../../guidelines/iconography.md`.

These files are the reference copies. Components render from the inlined
path data in `components/navigation/Icon.jsx`, which is identical.
