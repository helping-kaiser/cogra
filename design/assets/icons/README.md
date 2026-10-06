# Icons · `guide:design:icon-assets`

Material Design Icons (Apache-2.0), 24×24, `currentColor`, **classic
filled** variant — the set and variant the product inlines in
`web/src/lib/ui/icons.tsx` and wraps on Android via
`material-icons-extended`. The background `<path d="M0 0h24v24H0z"
fill="none"/>` rect is stripped, per the product's own convention.

**The inventory is [`../../guidelines/iconography.md`](../../guidelines/iconography.md)**
— every glyph, where it is used and how it is called, its two-cut and
derived exceptions included. This folder carries no list of its own.

These files are the reference copies. Components render from the inlined
path data in `components/navigation/Icon.jsx`, which is identical.
