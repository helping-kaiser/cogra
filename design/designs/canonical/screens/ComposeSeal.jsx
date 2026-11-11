/* THE POST'S SEAL (legacy conversion, the conformance round): the last stage,
   where everything the signature commits is read back before it is given.

   IT IS `ComposeSealUploading` WITHOUT THE GATE. That board is this one caught
   mid-upload — the same header slots, the same acts card, the same three facts,
   the same foot — with an upload line above the button, because nothing signs
   until the content it signs exists; a press there waits for the bytes. Here
   the pictures have landed, so the line is gone. Two boards, one anatomy, and
   now one source for it.

   THE STANCE IS THE `StanceReadout`, PAIR AND ALL. The row used to print a
   single number while the reference row two lines above printed the pair — one
   quantity, two spellings, on one board. The readout is the system's spelling
   and it is what the uploading twin already shows.

   THE BODY IS `_shared.jsx`'s `ComposeSealBody`, because four overlays stand on
   it — the stance pad, the license and sensitive sheets, and the "?" dialog —
   and each of them draws the seal it covers, whole.

   WHILE IT SIGNS, THE SEAL HOLDS THE READER (jakob 2026-10-01). The commit's
   label swap locks the back arrow, Back and the X with it, and past 5s the
   acts card's subline says the network is slow — `SealSigning` and
   `SealSigningSlow` draw the two moments.

   A STAGED TAG THAT NEVER LANDED (round 30, jakob 2026-11-11, Q7) is the
   `state` chip's `tagRefused`: the seal with its one staged tag,
   `#fieldnotes`, refused at signing — the Tags row reads back as before and
   under it `This tag didn't land.` with `Remove it`, no reason given, and
   `Sign and publish` stays. It is `SealFaultRow`'s unlanded-citation row at
   the Tags row, the state `ReplySeal`'s `refused` draws at reply scale. */
export const PROPS = { state: { editor: "enum", options: ["rest", "tagRefused"], default: "rest" } };
export const VALS = `restCardShown: this.props.state === "tagRefused" ? "none" : "flex", tagRefusedShown: this.props.state === "tagRefused" ? "flex" : "none"`;

export function Screen() {
  return <ComposeSealBody chipped />;
}
