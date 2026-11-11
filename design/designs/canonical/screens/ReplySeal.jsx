/* THE REPLY'S SEAL (legacy conversion, lane C): the comment wizard's last
   stage, where everything the signature commits is read back before it is
   given. Two stages, so this is also the stage where a comment's tags and
   references are named — which is why the card carries two add-rows where a
   post's seal carries none.

   IT IS `ReplyCited` WITHOUT THE REFERENCE. That board is this one after the
   picker hands a citation back: same header slots, same acts card, same three
   facts, same foot — with the staged reference as a row of its own, the total
   at two, and the all-or-nothing subline that a second act brings. Two boards,
   one anatomy, and now one source for it: the add-rows are `_shared.jsx`'s,
   and everything else here is the system's own masters.

   THE CITE ROW SAYS "+ Cite something". The hand board spelled it out — "a
   post, a person, a comment, an item" — while the staged twin said the short
   form, so one surface said two things depending on whether a reference had
   landed. The picker's own screen is where the kinds are enumerated.

   THE BODY IS `_shared.jsx`'s `ReplySealBody`, because the reply's stance pad
   stands on this seal and draws it whole. It is drawn answering the post;
   `ReplySealComment` is it answering a comment, and `ReplySealKeyAbsent` it
   with the key gone mid-write.

   WHILE IT SIGNS, IT HOLDS THE READER AS THE POST'S SEAL DOES (jakob
   2026-10-01): `Signing comment…` locks the back arrow, Back and the X, and
   past 5s the subline under the total says the network is slow
   (`SealSigning`, `SealSigningSlow`).

   IT READS ITS STAGED TAGS AS THE POST'S SEAL DOES (seam 254 item 10, jakob
   2026-11-10: the reply seal mirrors the post seal exactly). The `tags` chip
   draws the Tags row in both of `ComposeSeal`'s readings, with the post
   seal's own fixtures: `two`, `#fieldnotes` and `#coastroad` as chips, the
   slot's capacity (`ComposeSeal`); `seven`, `7 tags` and a bare count, the row
   a door to the tags sheet (`ComposeSealTagged`). The row stands under the
   act, the post seal's order, and the add-rows stay beneath, since this seal
   is also the comment's details stage.

   A STAGED ACT REFUSED AT SIGNING (seam 254 item 11, jakob 2026-11-10: "the
   reply seal reuses that row and never shows server words"). The `state`
   chip draws the post seal's two boards of it at reply scale: `refused`, the
   seal with its one citation (`ReplyCited`'s) whose post never landed — the
   row reads back as before and under it `This post didn't land, so it can't
   be cited.` with `Remove it`, the commit staying (`SealFaultRow`);
   `bug`, `This shouldn't have happened` in the commit's place, `Try again` in
   it, then `Report a problem` and `Discard the reply` (`SealFaultBug`);
   `tagRefused` (round 30, jakob 2026-11-11, Q7), the seal with one staged
   tag, `#fieldnotes`, that never landed — the Tags row reads back as before
   and under it `This tag didn't land.` with `Remove it`, no reason given,
   the commit staying: the refused citation's row at the Tags row. 
   THE `state` CHIP'S `signing` IS THE SEAL CLOSED ON (round 37, jakob
   2026-11-11: Close on every seal). From the press on `Sign comment` the act
   is done: past 200ms it reads `Signing comment…` over Back, which reads
   `Close` from the press itself; it, the arrow and the X close the seal and
   the reply goes on, its wait and its answer at the end of the branch it
   answers (`SigningAfterClose`). */
export const PROPS = {
  tags: { editor: "enum", options: ["none", "two", "seven"], default: "none" },
  state: { editor: "enum", options: ["rest", "refused", "bug", "tagRefused", "signing"], default: "rest" },
};
export const VALS = `none0Shown: this.props.tags === "none" && this.props.state !== "refused" && this.props.state !== "tagRefused" ? "flex" : "none", none1Shown: this.props.tags === "none" && this.props.state === "refused" ? "flex" : "none", two0Shown: this.props.tags === "two" && this.props.state !== "refused" && this.props.state !== "tagRefused" ? "flex" : "none", two1Shown: this.props.tags === "two" && this.props.state === "refused" ? "flex" : "none", seven0Shown: this.props.tags === "seven" && this.props.state !== "refused" && this.props.state !== "tagRefused" ? "flex" : "none", seven1Shown: this.props.tags === "seven" && this.props.state === "refused" ? "flex" : "none", signShown: this.props.state === "bug" || this.props.state === "signing" ? "none" : "flex", signingShown: this.props.state === "signing" ? "flex" : "none", bugShown: this.props.state === "bug" ? "flex" : "none", tagRefusedShown: this.props.state === "tagRefused" ? "flex" : "none"`;

export function Screen() {
  return <ReplySealBody chipped />;
}
