Use `BorrowedViewBand` in the collapsing top of a read surface whose feed shows a borrowed vantage point — a visitor from an invite link (the link issuer's view), a signed-in applicant or a landed member who has not vouched back yet (the issuer of the link they came through), or a bare arrival (the genesis moderator's, strictly as the fallback). It subsumes the guest notice: the band names the borrowed view and carries the one sign-in-or-join entry.

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
  line="Browsing from @mira's view — vouch back to start your own."
  actionLabel="Vouch back"
  onAction={openVouchBackPad}
/>
```

The default line invites ("— join to build your own."); pass `line` for the applicant and landed readings. The action is `Sign in or join` for a guest, absent for a signed-in applicant, and `Vouch back` for a landed member whose vouch-back is not signed yet — the pair is incomplete, so the band keeps the way to it after the vouch card is put away. The label is what makes borrowed ranking honest (§9): it always names whose view this is, and it exposes nothing the public record does not already carry. The band disappears when the vouch-back is signed, and only then: an opinion on anything else leaves the view borrowed. Until that signature lands the view is still borrowed, so the band stands through the whole approach to the pad.
