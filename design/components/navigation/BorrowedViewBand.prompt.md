Use `BorrowedViewBand` in the collapsing top of a read surface whose feed shows a borrowed vantage point — a visitor from an invite link (the link issuer's view), a signed-in applicant or a landed member who has not given an opinion yet (the issuer of the link they came through), or a bare arrival (the genesis moderator's, strictly as the fallback). It subsumes the guest notice: the band names the borrowed view and carries the one sign-in-or-join entry.

```jsx
<BorrowedViewBand
  handle="mira"
  displayName="Mira Halvorsen"
  avatarSrc={photo}
  actionLabel="Sign in or join"
  onAction={openAuth}
/>

<BorrowedViewBand
  handle="mira"
  line="Browsing from @mira's view while your application lands."
/>

<BorrowedViewBand
  handle="mira"
  line="Browsing from @mira's view — your first opinion starts your own."
/>
```

The default line invites ("— join to build your own."); pass `line` for the applicant and landed readings. The action is `Sign in or join` for a guest and absent for every signed-in reader — the band asks a member for nothing. The label is what makes borrowed ranking honest (§9): it always names whose view this is, and it exposes nothing the public record does not already carry. The band disappears with the member's first signed opinion, on anyone — their own graph then exists, so their own feed does. Vouching back is not the gate: it stays the vouch card's, and the inviter's profile's for good.
