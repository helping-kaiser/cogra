Use `MoneyFigure` for every CGT amount on screen — a balance, an earning, a tip, a campaign amount, a price. Never format money by hand.

```jsx
<MoneyFigure amount={15.2} />                    {/* 15.20 ⟨mark⟩ */}
<MoneyFigure amount={-2} signed />               {/* −2.00 ⟨mark⟩ — an outflow */}
<MoneyFigure amount={12.4} signed />             {/* +12.40 ⟨mark⟩ — an inflow */}
<MoneyFigure amount={128.4} unit />              {/* 128.40 ⟨mark⟩ CGT — the balance headline only */}
```

- The unit is the mark, not the word. `unit` spells "CGT" beside the mark on exactly one kind of surface — the teaching headline (the wallet balance) — with its "?" explaining that mark and name are the same currency.
- Dust renders `< 0.01`, never `0.00`; the exact value belongs one layer down on the surface that shows it. Zero renders `0`, plainly.
- Direction is the sign and the line's own words, never a colour.
- The figure inherits its context's type role; set the font on the surrounding element, not on the figure.
- `CgtMark` alone may stand on wallet-adjacent chrome (the bottom bar already uses `account_balance_wallet` — don't swap it).
