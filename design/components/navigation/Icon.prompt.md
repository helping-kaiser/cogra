Use `Icon` for every glyph in the product's set; it is `currentColor` and 24×24, so colour comes from the parent's text colour. All fourteen glyphs are inlined path data — no icon font, no external request.

```jsx
<Icon name="dynamic_feed" />
<Icon name={selected ? "person" : "person_outline"} />
```

Names: `dynamic_feed`, `person`, `person_outline`, `add`, `search`, `wallet`, `settings`, `visibility`, `visibility_off`, `arrow_back`, `more_vert`, `chat_bubble`, `volume_up`, `volume_off`, `graph`, and `mark`.

Do not add glyphs by drawing them — if the set lacks one, ask for the official Material export. `graph` is the one lighter-weight drawing (Symbols outlined, not classic filled): keep it out of rows with other glyphs. Every icon-only control needs an `aria-label` on the control itself; the SVG is always `aria-hidden`.
