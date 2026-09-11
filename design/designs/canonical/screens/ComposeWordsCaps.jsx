/* THE WORDS STAGE PAST ITS CAP (readme §13, the caps-affordance round) — the
   one capped field in the product that is not a `TextField`, drawn in the state
   the affordance was ruled for.

   THE BODY IS WHERE A WRITER ACTUALLY MEETS A CAP. A title runs out in a line
   and a description in a paragraph; five thousand characters is the one length
   somebody reaches while thinking about something else, which is exactly the
   case the late counter exists to serve — silence for the first four and a
   half thousand, then a number in time to land the ending.

   THE BOX TAKES THE ERROR OUTLINE AND THE ROW UNDER IT CARRIES BOTH HALVES:
   the refusal at its start, the count at its end, `TextField`'s own geometry
   rendered by a field that is not one. That is the whole point of the round —
   a cap and its refusal are one component's problem, drawn once.

   THE PARAGRAPHS ARE THE TAIL, THE COUNT IS THE WHOLE. 5,024 characters are
   written; the box shows the last of them, because that is what a writer that
   far into a post can see. The count says `24 over` against the 5,000.

   NEXT IS DISABLED, the same refusal `ComposeDetailsCaps` draws: a step does
   not advance on a body it cannot sign. */
const TAIL = [
  "By the fourth weekend I had stopped bringing the good paper. The crust takes what it wants from whatever you lay on it, and the cheap sheets tore in the same places the expensive ones did.",
  "What I did not expect was how much of it is listening. You hear the plates give before you feel them, and if you are quick the sheet comes away with the sound still in it.",
  "If you ever drive it, stop at the third headland and look down for once.",
];

export function Screen() {
  return (
    <ComposeWordsBody
      paragraphs={TAIL}
      used={5024}
      error="A post's words are at most 5,000 characters."
      nextDisabled
    />
  );
}
