Use `PayoutAddress` wherever the witnessed payout address shows — the wallet's address card, the seals' current/new blocks.

```jsx
<PayoutAddress address={addr} onCopy={copy} onChange={openChangeFlow}
  caption="The address is public — and so is every change to it." />
<PayoutAddress address={oldAddr} label="Current" />
<PayoutAddress address={newAddr} label="New" />
```

```jsx
<PayoutAddressRow address={addr} onOpen={openTheCard} />   {/* at rest: one line, high on the page */}
```

What holds:

- **At rest the address is one line** (`PayoutAddressRow`, round 3): an entry point near the top of the wallet, out of scrolling's way — the ONE place the address may shorten (head…tail), because it is not a checking surface. Tapping opens the full card.
- **The address has a home**: a quiet `surface-card` container with the label, the copy button, and Change in its header — never bare text thrown on a page.
- **The address renders whole** — mono, wrapped, never truncated: checking it against a wallet is the point of showing it.
- The address is public and actor-attributed (the Registration guild-key field); changing it is a signed act (the address-change seal) and every earlier address stays on the public record — say it in the `caption`.
