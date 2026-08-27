Use `BorrowedViewBand` in the collapsing top of a read surface whose feed is ranked from a borrowed vantage point — a visitor from an invite link (the inviter's view), a bare arrival (the genesis moderator's), or a signed-in applicant who has not landed yet (still the inviter's). It subsumes the guest notice: the band names the borrowed view and carries the one sign-in-or-join entry.

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
```

The default line invites ("— join to build your own."); pass `line` for the applicant readings, and drop `actionLabel` once the reader is signed in. The label is what makes borrowed ranking honest (§9): it always names whose view this is, and it exposes nothing the public record does not already carry. The band disappears the moment the reader's own view exists — their first stance, the vouch-back.
