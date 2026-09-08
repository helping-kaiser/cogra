import React from "react";

/* THE COMPOSER'S TEXT CURSOR, STANDING STILL (item 17, the conformance round).
   A board is a photograph of a moment, and the moment a reply composer is worth
   drawing is mid-sentence. The caret at the end of the words is the whole
   difference between a body someone is writing and a body someone finished:
   without it the reply reads as already said, and the board stops being a
   composer.

   IT IS DECORATION, NOT A CONTROL. The real surfaces put a real `<textarea>`
   here and the platform draws its own cursor, blinking, where the insertion
   point actually is. This is the still frame of that — 2px of `--primary`, the
   height of one `body-large` line, sitting on the text baseline's bottom so it
   ends the last word rather than floating past it. Nothing focuses it and
   nothing reads it aloud.

   IT BELONGS AT THE END OF THE WORDS, inside the paragraph, never on a line of
   its own: a cursor with a line to itself is a loading bar. */

export function Caret() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: 20,
        background: "var(--primary)",
        verticalAlign: "text-bottom",
        marginLeft: 1,
      }}
    />
  );
}
