/* The "?" dialog · toward what you answer — the reply pad's help topic
   (readme §13, the audit states; jakob 2026-09-09, item 25).

   THE COPY IS NOT NEW. `copy-voice.md` has carried **Toward what you answer**
   since the compose-session rulings landed, and it says exactly the true
   thing: a reply's stance is toward the post it answers, both axes, riding
   the reply's own signature. What was missing was never the words — it was a
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

      <DialogSurface ariaLabel="Toward what you answer" width="21rem">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            Toward what you answer
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Replying also signs where you stand on the post you answer — for or against, and how much of it reaches you. It
            starts at a gentle +0.10 / +0.10 and rides the same signature as your reply.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Nothing is signed until Set. Swap the input in settings if you prefer sliders or numbers.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button>Close</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
