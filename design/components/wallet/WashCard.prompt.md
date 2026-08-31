Use `WashCard` for a wallet screen's ONE moment — the hero (via `WalletBalance`), the set-up card, the guest and applicant cards. Never as a general card fill, and never twice on a screen.

```jsx
<WashCard>
  <h2>Set up your wallet</h2>
  …
</WashCard>
```

What holds:

- **The charter**: `--surface-hero` is the system's one decorative gradient surface (blessed 2026-08-31 as the first move of the brand-feel push). It marks the places a page IS its moment; overuse turns the brand wash into wallpaper.
- The ghosted coin is texture, not a second logo — aria-hidden, cropped by the edge. Content that must sit above it in stacking order takes `position: relative`.
- Both wash stops are existing palette values (light and dark recipes in tokens/colors.css); no new colours ride in through this component.
