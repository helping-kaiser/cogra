/* THE CITED POST DIDN'T LAND (jakob 2026-10-01, redrawing the failure pack's
   one-thing-can't-be-signed board) — the seal after the signing was refused
   because one staged citation points at a post that never landed.

   THE ONE HONEST WAY A PICKED TARGET STOPS ANSWERING. Nothing that landed ever
   leaves: no record is removed, a removed post is a reduced node that still
   answers, a deleted account is a husk that still answers, and a tag is not
   citable. What can go is a target that never landed. With `Still settling`
   on in the filter's "Also show", a reader can pick a post that is still
   settling — their own or anyone else's (jakob: "a user can toggle on the
   'show me not yet landed stuff' toggle and could cite a post by someone else
   that didnt land yet") — and if that post's staged act then expires
   unlanded, on the graph nothing ever existed to cite. Every other refusal at
   this stage is a bug, drawn on its own board (`SealFaultBug`).

   THE REFUSAL IS SAID WHERE THE ACT IS READ BACK. The contract names the
   refused entry (`references.<index>.target`), so the seal names the row: the
   References row reads back exactly as before, and under its value the
   refused-file line — `ActsCard`'s `fault`, which is `UploadErrorLine` — says
   `This post didn't land, so it can't be cited.` in the failure voice, with
   `Remove it`. A cited comment takes the same construction with its own noun.
   The fixture is @ada's post, someone else's, because that is the case the
   amendment added.

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
