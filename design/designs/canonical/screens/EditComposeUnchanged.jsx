/* AN EDIT THAT CHANGES NOTHING (the topic round, 2026-09-14) — the state the
   edit wizards have always been able to reach and no board has drawn: opened,
   looked at, and left exactly as it was found.

   THE GATE IS THE ACTS BATCH, NOT A BYTE COMPARISON. An edit signs when there
   is something in its batch to sign. Comparing bytes would refuse an author who
   typed a word and took it back again, and accept one whose only difference is
   whitespace no record carries — and it would have to be re-derived on every
   platform, from the fields rather than from the acts. The batch is the thing
   that is actually signed, it is what the acts sheet lists and what the footer
   counts, so the guard reads a number the screen was already showing.

   THE SIGN IS INERT, the caps round's idiom exactly (`ComposeWordsCaps`,
   `ComposeDetailsCaps`): the control stays where it is, disabled, and the edge
   says out loud that it goes nowhere. It is not hidden — a button that vanishes
   teaches nothing about why, and an author who came to edit should see the act
   they came for, waiting on them.

   AND THE FOOT SPEAKS THE ZERO. `Nothing to sign yet` — the footer's own
   sentence at zero, closing a wording `ActsFooter` itself recorded as unruled.
   It says WHY the button is inert in the one place an author's eye is already
   going, which is what makes the disabled control read as a state rather than
   as a fault. `yet` is doing work: nothing here is broken and nothing is owed;
   type one character and the line counts it.

   AT ZERO THE FOOT STOPS BEING A BUTTON, the menus round's rule: the acts sheet
   it opens would be empty, and a tap that can only open an empty list is a tap
   spent on nothing. The line still speaks — a foot gone silent would read as a
   fault — it just stops promising a detail that is not there.

   THE RULE IS THE FAMILY'S, and this board is its one drawing. `EditCompose`,
   `EditComposeVideo`, `EditWords`, `CommentEdit` and `CommentEditVideo` all
   carry the same foot over the same batch, so they all carry the same guard;
   the round record says so rather than five boards saying it five times. The
   SEAL-shaped edits are out of this round — a seal's acts card is a different
   anatomy with its own totals, and nothing has ruled its zero.

   THE BODY IS `EditComposeBody`, one prop apart, for the reason every state
   board in this family shares: an edit with an empty batch is a STATE of that
   screen, not a second screen. */
export function Screen() {
  return <EditComposeBody unchanged />;
}
