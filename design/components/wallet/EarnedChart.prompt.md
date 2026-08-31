Use `EarnedChart` for the wallet's progress strip — earnings per settlement as bars.

```jsx
<EarnedChart points={[{ amount: 4.1, label: "…", onOpen }, …]} caption="Earned · last 8 settlements" />
```

What holds:

- **Honest decoration only.** Every bar is a real payout from a real public settlement, and taps into it — that traceability is what makes a chart admissible under the numbers rules. Never draw projected, smoothed, or invented series here.
- The latest bar wears `primary`, the rest `secondary-container` — colour as emphasis on recency, never as direction or judgment.
- A zero settlement renders a visible stub, not a gap — the quiet epochs are part of the true story.
