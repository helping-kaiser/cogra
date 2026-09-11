Use `SettingsGroup` and `SettingsRow` for every setting in the product. The group is the unit — a quiet heading, a filled card of rows, a footnote under it — and the row is one setting, drawn one way.

```jsx
<SettingsGroup label="Writing" footnote="Every signed action is paid for separately.">
  <SettingsRow label="Confirm multi-action submits" status="Ask first when one submit signs more than one action." checked />
  <SettingsRow label="Default license" value="Public domain" onOpen={openLicenseSheet} />
</SettingsGroup>

<SettingsGroup label="Giving an opinion" footnote="A tap opens this, everywhere. Press and hold instead, and a small positive one is signed on the spot.">
  <SettingsRow name="stance-input" selected label="The pad" status="A tap opens it; drift to where it feels right." />
  <SettingsRow name="stance-input" selected={false} label="Sliders" status="One slider per side of the opinion." />
</SettingsGroup>
```

What holds:

- **The trailing edge is the variant.** A switch for on/off, taking effect at once; a value plus a chevron for a choice made elsewhere; a chevron alone for a row that only goes somewhere; a node for a row carrying its own control (`inert` — the row is not the target, the word at its end is). The chevron means one thing and one thing only: **this opens another surface.**
- **The second line shows status, not description.** "Last used 2 days ago" earns its line; a restatement of the label does not. A switch is the exception — its line says what turning it on does, because the label alone cannot.
- **The footnote is what keeps rows short.** Whatever a group has to explain once goes under the card, not into every row. A page whose rows each carry a sentence is a wall.
- **A switch row is one target, announced once** — the row carries `role="switch"` and the drawn switch is `decorative` inside it. Never nest an interactive `Switch` in a row.
- **A choice row is a real radio**, sharing a `name`, with the dot the license sheet draws — the same question asked twice should look the same twice.
- **An action row is a row**, not a button dropped into a card: `action` puts the label on `primary` and drops the chevron. It never takes `error` — leaving is not a failure, and `error` is for failure only.
- Groups are separated by the screen's stack gap; rows inside one are separated by a hairline inset to the row's own padding, never after the last.
