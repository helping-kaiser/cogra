import React from "react";
import { BottomSheet } from "../core/BottomSheet.jsx";
import { Button } from "../core/Button.jsx";
import { HelpDot } from "../core/HelpDot.jsx";
import { TextField } from "../forms/TextField.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* Describe this picture (media slice, 2026-08-31): where alt text is written —
   reached per picture from the details step's counter and from the Show all
   sheet, NEVER from the crop step (a geometry step is no place for a
   keyboard). The rule it makes enterable is the component rule: a description
   is authored, optional, and never invented — a picture without one is
   skipped by screen readers, not guessed at. The "?" carries the full
   explanation (copy-voice: "Describing pictures").

   TWO SHAPES, ONE SHEET (jakob 2026-09-03). `video` swaps the subject: the
   title reads "Describe the video", the field asks what's in the video, and
   the preview shows the clip's own frame. A clip is ONE thing to describe —
   there is no per-picture walk through the sheet and the cover is never
   offered, because the cover is the video's face, not a second picture.

   THE REASON IS PERMANENT, NOT BEHIND THE "?" — the sub-line under the title
   says who the words are for on both shapes. Someone deciding whether to
   write a description needs the reason at the moment of deciding; the "?"
   is for the reader who wants the rest of it. */

export function DescribeSheet({ open = false, onClose, src, alt = "", value, onChange, onDone, inline = false, video = false }) {
  const subject = video ? "video" : "picture";
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`Describe this ${subject}`} inline={inline} maxHeight="88%">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "0 var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--text-title-large)",
                lineHeight: "var(--text-title-large--line-height)",
                fontWeight: "var(--text-title-large--font-weight)",
              }}
            >
              {video ? "Describe the video" : "Describe this picture"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-label-small)",
                lineHeight: "var(--text-label-small--line-height)",
                letterSpacing: "0.4px",
                color: "var(--text-secondary)",
              }}
            >
              Read aloud to people who can&apos;t see it.
            </p>
          </div>
          <HelpDot ariaLabel="Describing pictures" />
        </div>
        <div
          style={{
            position: "relative",
            height: "180px",
            borderRadius: "var(--radius-medium)",
            background: "var(--surface-container-high)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {src && <img src={src} alt={alt} aria-hidden={alt ? undefined : "true"} style={{ maxWidth: "100%", maxHeight: "100%", display: "block" }} />}
          {video && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-full)",
                background: "var(--surface-snackbar, rgba(0,0,0,0.55))",
                color: "var(--on-surface-snackbar, #ffffff)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon name="play_arrow" size={28} />
            </span>
          )}
        </div>
        <TextField label={`What's in the ${subject}`} corner="Optional" rows={2} value={value} onChange={onChange} />
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 var(--space-2)" }}>
          <Button variant="text" onClick={onDone ?? onClose}>
            Done
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
