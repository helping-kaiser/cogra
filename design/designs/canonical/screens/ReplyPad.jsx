/* THE STANCE PAD ON THE POST YOU ANSWER (legacy conversion, lane C): what the
   reply seal's "Adjust" opens. The wash covers the seal; only the parked pad is
   live, which is what the board's `scanExempt` line says.

   THE FIELD IS THE MASTER, both axes. Unlike `ComposePad` — where the author's
   own post always reaches them in full, so only one parameter is theirs to pick
   — a reply's stance is toward somebody else's post: for or against it, and how
   much of them reaches you. Both are choices, so the value space is the square
   `StancePad` draws, and the pad reads from it rather than drawing its own.

   IT KEEPS THE HAND BOARD'S 240px FIELD, centred, rather than letting the
   square fill the panel: the pad is a thumb-sized instrument and the drawing is
   the one the round inherited. Everything inside it — the dead centre-lines,
   the four named directions, the knob and where it sits for +0.10 / +0.10 — is
   now the master's.

   THE READOUT NAMES ITS TARGET where `ComposePad`'s says "Your pick": on your
   own post there is only one thing a pick could be about, and here there are
   two — the post being answered, and the comment being written.

   THE SEAL BENEATH IS THE SEAL — `ReplySealBody`, the same body `ReplySeal`
   draws. What a wash covers is inert, not shortened, so the acts card keeps its
   add-rows and the three facts stand where the reader left them.

   THE DRAWING IS `ReplyPadBody` in `_shared.jsx`, because the help dialog this
   board's "?" opens has to show the same surface underneath and a stand-in
   would be the one untrue thing on it. */
export function Screen() {
  return <ReplyPadBody />;
}
