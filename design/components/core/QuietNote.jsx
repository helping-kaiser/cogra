import React from "react";

/* The quiet note (item 17, the conformance round): one line in the smallest
   type the system has, telling the reader something true about the surface
   they are standing on — what it is ("Your comment on 'The long way home'"),
   how it works ("Words first — pictures can join them"), or what a gesture
   does ("Drag to move, pinch to zoom").

   IT NEVER ASKS FOR ANYTHING. No action, no error, no warning: it is a fact
   offered on the way past, and the moment a line needs the reader to do
   something it stops being this and becomes a button, a hint under a field, or
   `UploadErrorLine`. That is why it carries no colour of its own beyond
   `text-secondary` — a note in `--error` is not a note.

   IT SITS WITH WHAT IT DESCRIBES and carries no spacing of its own: `margin`
   is zeroed and the column it lives in owns the gap. The crop boards put it
   under the viewport, the seals above the button, the reply composers above
   the foot — one component, because on all of them it is the same small true
   line, and eighteen copies of a type ramp is how a type ramp drifts.

   NEAR-TWINS ARE DELIBERATELY NOT THIS ONE. The lines that centre themselves,
   carry a board's own padding, or ride inline inside a row are that board's,
   and folding a `textAlign` or a `padding` prop in here would make this the
   place layout decisions get made. */

export function QuietNote({ children }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>{children}</p>
  );
}
