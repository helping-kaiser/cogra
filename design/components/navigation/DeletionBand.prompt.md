Use `DeletionBand` on every logged-in surface while an account deletion is confirmed and waiting out its seven days (`docs/instances/erasure.md` §5). It says when the deletion runs and carries the cancel, and it is drawn from the moment the emailed link is confirmed until the deadline passes or the reader cancels.

```jsx
<CograBand trailing={<FeedFilter />}>
  <DeletionBand days={6} onCancel={cancelDeletion} />
</CograBand>

<>
  <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
  <DeletionBand days={6} content onCancel={cancelDeletion} />
</>
```

It rides the non-shrinking top block directly under the surface's header — inside `CograBand`'s children on a tab root, immediately under `PageHeader` on an inner surface — the slot `BorrowedViewBand` takes, and the reason is the same: a band that scrolls away is a band a reader can be unaware of.

Pass `days` as whole days left; the line spells the number out rather than using the ages ladder's `6d`, because a forward-looking sentence is the one place that vocabulary can be read as "ago". `content` switches the line to name what the request opted into removing; nothing else about the band changes.

Never colour it `--error`. The reader asked for this and it is proceeding as asked — the band says what state the account is in, which is what the shell's own `surface-bar` fill is for. Do not draw it before the emailed link is confirmed: until then nothing is scheduled, and a countdown would be counting down to nothing.
