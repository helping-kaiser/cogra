/* THE KEPT PICKS' SEAL (backlog item 113; jakob's ruling B1, 2026-10-01) —
   the standard seal, reached from `KeptPicksReview`'s `Sign them`, with the
   kept picks as its what-you-sign list.

   THE STANDARD SEAL, UNTOUCHED. `WizardHeader` with `What you sign` and
   `Last step`, the header's "?" opening the Signed-actions text, the acts
   card, and `SealFooter`'s pair — the anatomy `ProfileEditSeal` and
   `AvatarSeal` draw. Nothing on it is removable: dropping a pick is the
   review's, one stage back, and the seal only reads back what will be
   signed.

   ONE BATCH, ALL OR NOTHING (jakob, 2026-09-30: the kept picks sign
   together, in one batch the reader reviews first). Each pick is one
   opinion and one act, so the acts card reads each back on its own row —
   what it is on, and its pair as `StanceReadout` reads it — counts them in
   things, `3 things, signed together`, and carries the multi-act subline
   every seal of more than one act carries: `They land together, or none
   does.`

   THE COMMIT NAMES WHAT IT SIGNS (`SealFooter`'s rule): `Sign the
   opinions`. Signed, the batch leaves the seal for where the review was
   opened from, with the usual settled snackbar in its batch form, `Signed 3
   things, still settling.`, and each target's anchor wears `Still settling`
   until its record is ordered. The X leaves with every pick still kept, as
   leaving the review does.

   THE WRITE RULE AT THIS SCALE MIRRORS THE REPLY'S (jakob 2026-10-02, kept
   picks 5). `WriteRuleFailed` is the master: the fact ends `your picks are
   still kept.`, and the way out under the panel reads `Not now`, back to the
   review with every pick still in it.

   NO SEVERANCE STEP. A pick that nets its bundle to nothing said so on its
   review row, and `Sign the opinions` is its confirmation (kept picks 3);
   the seal raises no `SeveranceConfirm`. Mira's row here reads its pair and
   nothing more.

   A REMOVED TARGET READS BY ITS MARK HERE TOO (jakob 2026-10-02, the fix-fix
   round's 21). The review's removed row wears the removal mark where the name
   stood, and the seal reads it back the same way — `Removed by its author` in
   the system's voice, `text-secondary` at the body's weight — over the pair it
   still signs.

   THE BUG NOTICE'S WAY OUT IS `Not now` (jakob 2026-10-05, the collected
   brief's D8): `SealFaultBug` at this scale keeps `Try again` and `Report a
   problem`, and its third way out returns to the review with every pick still
   kept — nothing here is a draft to discard.

   A KEPT APPROVAL IS NAMED HERE TOO (jakob 2026-10-05, the B round's 7,
   amended): the review's line, `KeptApprovalLine`, under the acts card, with
   the door to Invites — the seal signs the picks and nothing else. The
   `approval` chip draws it. The wording is jakob's own, blessed (jakob
   2026-10-05). */
export const PROPS = { approval: { editor: "enum", options: ["none", "waiting"], default: "none" } };
export const VALS = `approvalShown: this.props.approval === "waiting" ? "block" : "none"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave — your picks are kept" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <ActsCard
          rows={KEPT_PICKS.map((pick) => ({
            label: "Opinion",
            countNoun: "opinion",
            value: (
              <span style={{ display: "flex", flexDirection: "column", padding: "6px 0", minWidth: 0 }}>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    ...(pick.removed ? { fontWeight: 400, color: "var(--text-secondary)" } : null),
                  }}
                >
                  {pick.removed || pick.name}
                </span>
                <StanceReadout pair={pick.pair} />
              </span>
            ),
            count: "1",
          }))}
          total={`${KEPT_PICKS.length} things, signed together`}
          note="They land together, or none does."
        />

        <KeptApprovalLine shown="{{approvalShown}}" />

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign the opinions" />
      </div>
    </>
  );
}
