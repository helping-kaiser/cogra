/* DELETE ACCOUNT · DURING THE GRACE — what the settings row opens once the
   deletion is confirmed (jakob 2026-10-01, audit K3.22; mechanics in
   `docs/instances/erasure.md` §5 step 3).

   THE ROW'S SCREEN IS WHERE CANCELLING IS DONE ON PURPOSE. The band offers
   `Cancel` in passing on every surface; a reader who goes to settings to undo
   the deletion should find the same act where they looked for it, with the
   deadline said in full. So the page is `DeleteAccount`'s column with its
   request spent: the heading is the row's, the paragraph is the deadline and
   what holds until it, and the one commitment is `Cancel`, the band's word for
   the same act.

   THE BAND STEPS ASIDE ON THIS ONE PAGE. It rides every logged-in surface
   to put the deletion in front of the reader; here the page itself is the
   deletion's, and a band above it would say the paragraph twice and offer the
   button twice.

   CANCELLING ASKS NOTHING. It returns to settings with the canceled
   snackbar (`DeleteAccountCanceled`'s words), the band gone and the row back
   to `Delete account`. Nothing had been deleted, so nothing is restored.

   REGISTERED under the `deleteAccount` prefix (design ⇄ impl seam 080, the
   deletion packet), named as the request screen names its column. */
export const NODE = "deleteAccount";
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
          data-node="title"
        >
          Delete account
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
          data-node="body"
        >
          Your account is deleted in 6 days, on 08.10.2026. Until then nothing has changed, and canceling keeps
          everything as it is.
        </p>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }} node="cancel">Cancel</Button>
        </div>
      </div>
    </>
  );
}
