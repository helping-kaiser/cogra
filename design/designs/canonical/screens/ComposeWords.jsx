/* THE WORDS PATH'S FIRST STAGE (legacy conversion, the conformance round):
   the post whose body is text. Reached from the pick step's "Write words
   instead", and it offers the way back the same way — the escape rides the
   instruction line, which is `PickPrompt`'s whole subject, so this board asks
   the master for it rather than drawing the pair again.

   THE BODY IS A GROWING FIELD, NOT A `TextField` — `_shared.jsx`'s
   `WordsBody`. This stage gives it the whole column, because it is the post,
   and draws it mid-writing: three paragraphs deep with the caret at the end
   of the last. The box moved to the prelude when the post EDIT grew a words
   body of its own; two boards drawing one field would drift. */
export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="The body is your words." escapeLabel="Add pictures instead" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "8px 24px 24px", overflow: "hidden" }}>
        <FieldLabel>What do you want to publish?</FieldLabel>
        <WordsBody
          cap={5000}
          paragraphs={[
            "Three weekends of walking the same stretch at low tide, tracing where the salt crust draws its lines.",
            "The rubbings pick up what the light misses. Paper against the crust, the side of a wax stick, and whatever the wind allows — none of them took longer than the walk out to make.",
            "If you ever drive it, stop at the third headland and look down for once.",
          ]}
        />
        <Button style={{ width: "100%", marginTop: 12 }}>Next</Button>
      </div>
    </>
  );
}
