/* THE WORDS PATH'S FIRST STAGE (legacy conversion, the conformance round):
   the post whose body is text. Reached from the pick step's "Write words
   instead", and it offers the way back the same way — the escape rides the
   instruction line, which is `PickPrompt`'s whole subject, so this board asks
   the master for it rather than drawing the pair again.

   THE BODY IS A GROWING FIELD, NOT A `TextField`. The master's field is a
   `<textarea rows={n}>`: a fixed number of lines holding one string. This
   stage gives the body the whole column — it is the post — and draws it
   mid-writing, three paragraphs deep with the caret at the end of the last.
   Neither the height nor the paragraphs survive a textarea, so the box is
   spelled here at `TextField`'s own values (the extra-small corner, the field
   border, `body-large` inside) and the caret is the system's `Caret`. */
export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="The body is your words." escapeLabel="Add pictures instead" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "8px 24px 24px", overflow: "hidden" }}>
        <FieldLabel>What do you want to publish?</FieldLabel>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 12,
            borderRadius: "var(--radius-extra-small)",
            border: "1px solid var(--border-field)",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)", letterSpacing: "var(--text-body-large--letter-spacing)" }}>
            Three weekends of walking the same stretch at low tide, tracing where the salt crust draws its lines.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)", letterSpacing: "var(--text-body-large--letter-spacing)" }}>
            The rubbings pick up what the light misses. Paper against the crust, the side of a wax stick, and whatever the wind allows — none of them took longer than the walk out to make.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)", letterSpacing: "var(--text-body-large--letter-spacing)" }}>
            If you ever drive it, stop at the third headland and look down for once.
            <Caret />
          </p>
        </div>
        <Button style={{ width: "100%", marginTop: 12 }}>Next</Button>
      </div>
    </>
  );
}
