/* Remove — the think-twice dialog. The SAFE action is the filled one.

   AND `Remove` CARRIES NO COLOUR (jakob 2026-09-15: "probabely non
   destructive? a removal is not an error no?"). §11's rule needs no exception
   here: the error role is for something that went wrong, and a reader removing
   their own post is doing exactly what they meant to. What makes this dialog
   careful is the emphasis — the safe action filled, the removal a text button
   — and the two sentences above it, not a red word. `SeveranceConfirm` and
   `RejectConfirm` were already drawn this way. */
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard {...SOL_POST} variant="detail" bundle={mkBundle(0.1, 1)} />
      </DetailColumn>
      <DialogSurface ariaLabel="Remove this post?">
        <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>Remove this post?</h2>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the post's spot in threads stays with it.
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>This is immediate and permanent.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Remove</Button>
          <Button>Keep it</Button>
        </div>
      </DialogSurface>
    </>
  );
}
