Use `PayoutAddress` for any LONG OPAQUE STRING that needs a home — the witnessed payout address (the wallet's address card, the seals' current/new blocks) and the invite link.

```jsx
<PayoutAddress address={addr} onCopy={copy} onChange={openChangeFlow}
  caption="The address is public — and so is every change to it." />
<PayoutAddress address={oldAddr} label="Current" />
<PayoutAddress address={newAddr} label="New" />

{/* the invites round: same card, its own words */}
<PayoutAddress address={inviteLink} label="Single use · not used yet"
  onCopy={copy} copyLabel="Copy the link"
  onChange={revoke} changeLabel="Revoke"
  caption="Expires in 7 days · 22.09.2026" />
```

```jsx
<PayoutAddressRow address={addr} onOpen={openTheCard} />   {/* at rest: one line, high on the page */}
```

What holds:

- **At rest the address is one line** (`PayoutAddressRow`, round 3): an entry point near the top of the wallet, out of scrolling's way — the ONE place the address may shorten (head…tail), because it is not a checking surface. Tapping opens the full card.
- **The address has a home**: a quiet `surface-card` container with the label, the copy button, and Change in its header — never bare text thrown on a page.
- **The address renders whole** — mono, wrapped, never truncated: checking it against a wallet is the point of showing it.
- The address is public and actor-attributed (the Registration guild-key field); changing it is a signed act (the address-change seal) and every earlier address stays on the public record — say it in the `caption`.
- **The copy button carries no word, so `copyLabel` is its only name.** It defaults to the wallet's own; every other kind of string passes one that names what it is copying.
- **`bare` drops the container and keeps everything else** — `SettingsGroup`'s own shape, for the same reason. Use it where the string RESTATES one beside it (the invite code under the link it was cut from) or where the card would sit on a surface of its own tonal rung (inside another card, or on a stacked sheet). Never for a string that is the surface's own subject.
- **`changeLabel` is the card's one inline act**, whatever that act is — `Change` on the wallet, `Revoke` on a live invite link. One act, never two: a card with a second inline word stops reading as a string with a home.
