Use `Button` for anything that performs an action; a control that navigates stays a link (styled with `buttonStyle` if it must look like a button).

```jsx
<Button onClick={publish}>Sign and publish</Button>
<Button variant="outline" size="sm" selfStart onClick={retry}>Retry</Button>
<Button variant="text" size="sm" onClick={close}>Cancel</Button>
```

Variants are Material's three and no others: `primary` (filled) for the **one** committing action on a surface, `outline` for a secondary action, `text` for a tertiary one. Both unfilled variants put `primary` on the label — never a body-coloured label with a coloured border. Sizes differ in padding only. `disabled` is 40% opacity on the whole control, never a grey swap. Never use `primaryContainer` on a button: that surface belongs to the compose action and a committed stance.

**Both sizes are tappable at 48px.** `sm` draws 33px of ink and `lg` 40px — Material's dense and default heights — but `BUTTON_CLASS` carries `cg-hit`, which expands the target to 48px on both axes without moving the ink. So a dialog footer and the stance pad's action row stay compact while the system's 48px minimum stays unconditional. If you build a pressable control by hand, add `cg-state cg-focus cg-hit` to it.
