Use `NoticePanel` where the one act a surface exists for cannot happen right now and **nothing failed** — nothing staged, nothing signed, nothing spent. It stands in the place of the act it replaces (a seal's commit, a pad's Set), in `tertiary-container`, never `error`.

```jsx
<NoticePanel title="You can't sign right now">
  <NoticeLine>Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your draft is kept.</NoticeLine>
</NoticePanel>

<NoticePanel title="Your key isn't on this browser" helpLabel="Your key">
  <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
</NoticePanel>
```

- **Title first, then at most one "?"** — `HelpDot`'s `inverse`, beside the title, only when the panel has something a dialog would add.
- **The sentence is `NoticeLine`**, the panel's own ink.
- **What the reader can do goes last, in `Button variant="inverse"`** — never a `primary` fill inside a tonal panel. When there is nothing to do yet, the panel carries no button, and the surface's way out stands under it.
- **`corner="medium"` beside the seal's acts card, `corner="large"` where the panel leads a page.**
- A fault is `TransportError`, not this: a notice says what is true, a fault says what went wrong.
