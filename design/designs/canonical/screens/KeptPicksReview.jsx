/* THE KEPT PICKS' REVIEW (backlog item 113; jakob's rulings B1-B3,
   2026-10-01) — what `Restore the key` opens when picks were kept pending
   while the key was elsewhere (`PadKeyAbsent`'s `Keep it pending, restore
   later`). The canonical tree's one gap, `Restore/4`, closes here.

   ONE REVIEWED BATCH (jakob, 2026-09-30). Kept picks never sign on their
   own: once the key is back they sign together, in one batch the reader
   looks over first — never silently. This board is the looking-over, and
   `Sign them` leads to the batch's seal (`KeptPicksSeal`), the standard
   seal with the picks as its what-you-sign list. Review, then seal, as every
   other act runs: the seal idiom is untouched, and nothing is removable
   inside it.

   EACH KEPT PICK IS ONE ROW, `StagedReference` with its × — the staged
   section's idiom (readme §13, *The closing batch*): the target's face
   (`NodeMark` — the post's cover, the person's circle), its kind on the
   second line, and the pair in readout form, the face with the digits in
   geek mode and the anchor's word spoken (`stance`). One pick per target, so
   one row per target.

   PLAIN OPINIONS ONLY (jakob 2026-10-02, kept picks 4). A kept vouch-back or
   approval never joins the batch: the review lists plain opinions and
   nothing else, and a kept vouch-back surfaces as its own card, keeping its
   ceremony (`VouchedIn`). A kept approval is its twin: its own card on
   Invites, where approving lives, signed through `ApprovePad` (jakob
   2026-10-02, the fix-fix round's 22).

   NOTHING VANISHES (jakob 2026-10-02, kept picks 2 dissolved — the
   never-delete law). A pick's target always exists, so every row stays and
   signing stays valid. A pick whose target was removed or redacted while it
   waited wears the standard removed-mark face on its row instead of a live
   preview (`StagedReference`'s `removed`), as a removed post reads at the
   head of its thread: the tile empty, `Removed by its author` where the name
   stood, in the system's voice. Its × keeps its seat and drops the pick like
   any other. The third row draws it (jakob 2026-10-02, the fix-fix round's 21).

   A PICK THAT WOULD SEVER ITS BUNDLE SAYS SO ON ITS ROW (jakob 2026-10-02,
   kept picks 3): the consequence inline, in the family's landing words, the
   way `Remove citation` says its cost (`StagedReference`'s `consequence`).
   Sign is the confirmation — no extra dialog, the D2 ruling's consistency.
   The second row draws it: Mira's pick takes the reader back to zero toward
   her, so it reads `This takes you back to zero.` under its kind.

   THE × DROPS AT ONCE (B2): no confirm, no undo. Nothing was signed, so
   nothing is lost that the reader cannot make again — the pick is re-made
   from its pad. The drop is spoken in the pickers' status idiom
   (`PickAnnouncement`), `Removed —
   2 picks left.`, and focus moves to the next row (jakob 2026-10-02, kept
   picks 6). Dropping the last row leaves the review, with the snackbar
   `Nothing left to sign.`, where the review was opened from.

   LEAVING UNSIGNED KEEPS THEM (B3). The back arrow — and the system's Back —
   leave every remaining pick kept on this device, and the settings page's
   Key backup group carries a quiet row, `3 kept picks waiting`, that opens
   this review again. "Never silently" stays honest without a nag: the row is
   the one place the waiting batch is named, and nothing else reminds. The
   row shows only while the key is here and unsigned picks wait; if the key
   goes again, the waiting-for-key state owns the surface (jakob 2026-10-02,
   kept picks 7). Meanwhile each kept pick's anchor reads `Waiting for your
   review`, and its tap opens this review (kept picks 1).

   ARRIVAL. From `Restore`, the restore's own snackbar (`Your key is on this
   browser now.`) rides in over this board; from the settings row or a kept
   pick's anchor, nothing does. Either way the arrow returns where the review
   was opened from.

   THE FOOT IS PINNED, the wizard reading (jakob 2026-10-01, ruling A2): the
   board leads to a seal, as `ProfileEdit` does, and `Sign them` takes the
   foot the way `Save` does there.

   A KEPT APPROVAL IS NAMED HERE, NEVER SIGNED HERE (jakob 2026-10-05, the B
   round's 7, amended). When an approval was kept with the picks, one quiet
   line under the intro says it waits on Invites and signs on its own there,
   with the door to Invites (`KeptApprovalLine`) — so a reader signing the
   picks never takes the approval for done. The `approval` chip draws it.
   Wording flagged for blessing. */
export const PROPS = { approval: { editor: "enum", options: ["none", "waiting"], default: "none" } };
export const VALS = `approvalShown: this.props.approval === "waiting" ? "block" : "none"`;

export function Screen() {
  return (
    <>
      <PageHeader title="Kept picks" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          These waited on this device for your key, and nothing is signed yet. Remove any you no longer mean — the rest
          sign together.
        </p>
        <KeptApprovalLine shown="{{approvalShown}}" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {KEPT_PICKS.map((pick) => (
            <StagedReference key={pick.name} {...pick} stance onRemove={() => {}} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Sign them</Button>
      </div>
    </>
  );
}
