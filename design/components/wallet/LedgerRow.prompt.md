Use `LedgerRow` for every line of the wallet's history — one stream, newest first, and every row an IDENTITY row, not a ledger line.

```jsx
<LedgerRow words="Tip from @tobias" context='On "Salt maps of the coast road"' when="4d" amount={2} name="Tobias Lindqvist" onOpen={openTip} />
<LedgerRow words='Payout · "Sunday at the tide market"' context="Campaign settled" when="2d" amount={12.4} image={cover} onOpen={openSettlement} />
<LedgerRow words="Payout · settling" amount={3.1} pending glyph="campaign" />
```

What holds:

- **The disc leads**: the tipper's face, the paying campaign's cover, a glyph for the rest — money moves with someone or something, and the row says who. The small badge on the disc is the direction (arrow out; in = rotated); **the amount is never coloured**.
- **The words + context carry what paid it** — the traceability promise; `onOpen` opens the source.
- A payout not yet landed is `pending`: quiet figure, the product's own *Still settling*.
- Rows are card-lite (`surface-card`, medium radius) with 8px seams — the feed's rhythm, calmer.
