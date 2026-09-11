/* THE WORDS PATH'S FIRST STAGE (legacy conversion, the conformance round):
   the post whose body is text. Reached from the pick step's "Write words
   instead", and it offers the way back the same way — the escape rides the
   instruction line, which is `PickPrompt`'s whole subject, so this board asks
   the master for it rather than drawing the pair again.

   THE BODY IS A GROWING FIELD, NOT A `TextField` — `_shared.jsx`'s
   `WordsBody`. This stage gives it the whole column, because it is the post,
   and draws it mid-writing: three paragraphs deep with the caret at the end
   of the last. The box moved to the prelude when the post EDIT grew a words
   body of its own; two boards drawing one field would drift.

   THE STAGE ITSELF IS `_shared.jsx`'s `ComposeWordsBody` for the same reason —
   `ComposeWordsCaps` draws this stage with the body against its cap, and a
   stage on a second board stops being board-local. */
export function Screen() {
  return <ComposeWordsBody />;
}
