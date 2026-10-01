/* The "?" dialog · toward what you answer — the reply pad's help topic
   (readme §13, the audit states; jakob 2026-09-09, item 25).

   THE COPY IS NOT NEW. `copy-voice.md` has carried **Toward what you answer**
   since the compose-session rulings landed, and it says exactly the true
   thing: a reply's stance is toward what it answers — a post or a comment —
   both axes, riding the reply's own signature. Its first sentence says "an
   opinion", never "your opinion" (jakob, the reply pack): the reply's own
   starts at the default, and must not read as the one the reader already
   gave. What was missing was never the words — it was a
   board drawing them, and an edge pointing at it. Android left the "?" out
   rather than open the post pad's topic, which says "only for-or-against is
   yours to set" and is the opposite of what is true here; that omission was
   the right call about the wrong problem.

   IT IS `HelpDialog`'S SHAPE, one topic over: a heading naming the thing
   asked about, two short paragraphs, one way out. Nothing to decide, nothing
   to navigate to.

   THE SURFACE BENEATH IS `ReplyPadBody`, the pad's real drawing — the seal,
   its wash, and the parked pad — for `HelpDialog`'s own reason: the reader
   opened this from a surface they can still see. Two washes stack, the way
   `CommentMenu`'s do when a sheet opens over a sheet, and the board says so
   in its `scanExempt` line. */
export function Screen() {
  return (
    <>
      <ReplyPadBody />

      <DialogSurface
        onScrimPress={() => {}}
        title="Toward what you answer"
        body={[
          <p style={{ margin: 0 }}>
            Replying also signs an opinion on what you answer — for or against, and how much of it reaches you. It
            starts at a gentle <span aria-hidden="true">🙂</span>
            <ExactTail exact=" (+0.10 / +0.10)" spoken="Nice, For or against +0.10, How much reaches you +0.10" /> and rides
            the same signature as your reply.
          </p>,
          "Nothing is signed until Set. Swap the input in settings if you prefer sliders or numbers.",
        ]}
        actions={<Button>Close</Button>}
      />
    </>
  );
}
