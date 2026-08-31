Use `LedgerRow` for every line of the wallet's history — one stream, newest first (jakob 2026-08-31), holding the rail's own kinds: payouts, tips in and out, campaign deposits and refunds.

```jsx
<LedgerRow words='Payout · "Sunday at the tide market"' when="2d" amount={12.4} onOpen={openSettlement} />
<LedgerRow words="Tip to @ada" when="5d" amount={-2} />
<LedgerRow words="Payout · settling" amount={3.1} pending />
```

What holds:

- **The words carry what happened and what paid it** — the traceability promise behind every shown number. `onOpen` goes to the source (the settlement, the tipped post).
- **Direction is the sign and the words, never a colour** — the Money figures ruling. Rows default to `signed` so inflows wear `+`; dust renders `< 0.01` and never signs.
- A payout not yet landed is `pending`: the figure goes quiet and the line wears the product's own *Still settling* — never a spinner, never a different colour.
