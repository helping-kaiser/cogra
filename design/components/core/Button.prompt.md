Use `Button` for anything that performs an action; a control that navigates stays a link (styled with `buttonStyle` if it must look like a button).

```jsx
<Button onClick={publish}>Sign and publish</Button>
<Button variant="outline" size="sm" selfStart onClick={retry}>Retry</Button>
<Button variant="text" size="sm" onClick={close}>Cancel</Button>
<Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
```

Variants are Material's three on the page's own ground: `primary` (filled) for the **one** committing action on a surface, `outline` for a secondary action, `text` for a tertiary one. `inverse` is the filled button standing **inside a tonal panel** — the key-absent notice's `tertiary-container` block — where it takes the panel's pair and turns it over: `on-tertiary-container` fill, `tertiary-container` label. It is not a fourth emphasis and never appears on the page's ground. Both unfilled variants put `primary` on the label — never a body-coloured label with a coloured border. Sizes differ in padding only. `disabled` is 40% opacity on the whole control, never a grey swap. Never use `primaryContainer` on a button: that surface belongs to the compose action and a committed stance.

```jsx
<InlineAction onClick={openLicense}>Change</InlineAction>
```

`InlineAction` is the bare primary word — the same `label-large` in `primary` with no pill, no padding and no 64px minimum. **The test is whose line the action is on.** An action on its own line is a `Button`, `text` variant included: the minimum width is what keeps a short label from reading as an afterthought. An action at the end of a line the reader is already reading — a seal row's `Change`, the payout address's `Change` — is an `InlineAction`, because there the 64px minimum is what wraps a row that is meant to hold one line. It carries `BUTTON_CLASS` like every other pressable control, so 20px of ink still answers to a 48px target.

**Both sizes are tappable at 48px.** `sm` draws 33px of ink and `lg` 40px — Material's dense and default heights — but `BUTTON_CLASS` carries `cg-hit`, which expands the target to 48px on both axes without moving the ink. So a dialog footer and the stance pad's action row stay compact while the system's 48px minimum stays unconditional. If you build a pressable control by hand, add `cg-state cg-focus cg-hit` to it.
