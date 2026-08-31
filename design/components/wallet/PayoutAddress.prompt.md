Use `PayoutAddress` wherever the witnessed payout address shows — the wallet's address section, the change flow's current/new blocks.

```jsx
<PayoutAddress address={addr} onChange={openChangeFlow} />
<PayoutAddress address={oldAddr} label="Current" />
<PayoutAddress address={newAddr} label="New" />
```

What holds:

- **The address renders whole — mono, wrapped, never truncated.** This is the copy rule that codes and keys keep their precise form where the format is the content: a clipped address cannot be checked against a wallet, and checking is the point of showing it.
- The address is public and actor-attributed (the Registration guild-key field), and **every change to it stays on the public record** — the screens say so in one line; changing it is a signed act (the address-change seal).
- `Change` is the only affordance; there is no copy-to-clipboard promise here the platform can't keep honestly — clients add their own copy affordance per platform.
