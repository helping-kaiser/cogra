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
   stands on this seal and draws it whole. */
export function Screen() {
  return <ReplySealBody />;
}
