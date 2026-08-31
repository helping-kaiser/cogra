Use `WalletBalance` as the wallet's headline — nowhere else. It is the ONE surface that spells the word CGT (readme §13, Money figures): everywhere else the mark alone is the unit.

```jsx
<WalletBalance amount={128.4} approx="0.00087" onHelp={openWhatIsCgt} />
```

What holds:

- The "?" is *What is CGT?* (copy-voice) — the headline teaches the mark-word equivalence and the "?" explains both as CoGra's own money.
- **The ≈ line is an estimate, ruled in** (jakob 2026-08-31): read from the public CGT–L-BTC market — the protocol's own ladder, live from genesis — so it exists the moment the wallet does. It moves with the market and is never a promise; omit `approx` when there is no reading, and it hides itself at zero balance (nothing to price).
- Never render a fiat figure here; the market the product owns quotes L-BTC.
