/* ONE THING CAN'T BE SIGNED (the failure pack, jakob 2026-09-30: the seal's
   faults speak `NetworkError`'s grammar) — the seal after the signing was
   refused because of one staged act: here, a post cited in the batch that
   nothing answers to any more.

   THE REFUSAL IS SAID WHERE THE ACT IS READ BACK. The contract names the
   refused entry (`references.<index>.target`), so the seal names the row: the
   References row reads back exactly as before, and under its value the
   refused-file line — `ActsCard`'s `fault`, which is `UploadErrorLine` — says
   `This can't be cited anymore.` in the failure voice, with `Remove it`.

   REMOVE IT IS THE ONLY WAY OUT, so no Retry. Signing the same batch again
   meets the same answer; a control that fails the same way twice is not a way
   out (`RefusedFile`'s rule). Removing it drops the citation from the staged
   set — the row goes, the count and the total fall by one — and the seal is
   ready to sign again.

   THE COMMIT STAYS. A refusal at prepare stages nothing — every citation
   target is checked before the minting record is staged — so there is no
   fault at the foot and nothing to retry there: `Sign and publish` is the
   same commit, and signing before removing gets the same row back. That is
   `JoinErrors`' arrangement, the field error beside a live submit. */
export function Screen() {
  return <ComposeSealBody state="refused" />;
}
