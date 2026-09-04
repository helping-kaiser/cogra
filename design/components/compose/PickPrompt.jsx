import React from "react";
import { Button } from "../core/Button.jsx";

/* The pick step's prompt (item 17, the conformance round): the line above the
   tray that says what may be picked, with the way out of the media path beside
   it.

   THE ESCAPE RIDES THE INSTRUCTION, not the header and not the tray. An author
   who opened the picker by mistake — or who came for a photo and decided the
   words are the post — must be able to leave the media path at the moment they
   read what it wants, which is this line. Putting it in the header would make
   it compete with the X that leaves the whole composer; putting it under the
   tray would make it the thing you find only after failing to pick.

   IT IS A TEXT BUTTON, at `sm`, deliberately quieter than anything in the tray
   below. Picking is what this step is for; writing instead is the alternative,
   offered without being urged. */

export function PickPrompt({ caption, escapeLabel, onEscape }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
      <p style={{ margin: 0, flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
        {caption}
      </p>
      <Button variant="text" size="sm" onClick={onEscape}>{escapeLabel}</Button>
    </div>
  );
}
