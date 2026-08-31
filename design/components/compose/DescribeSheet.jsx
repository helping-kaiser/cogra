import React from "react";
import { BottomSheet } from "../core/BottomSheet.jsx";
import { Button } from "../core/Button.jsx";
import { HelpDot } from "../core/HelpDot.jsx";
import { TextField } from "../forms/TextField.jsx";

/* Describe this picture (media slice, 2026-08-31): where alt text is written —
   reached per picture from the details step's counter and from the Show all
   sheet, NEVER from the crop step (a geometry step is no place for a
   keyboard). The rule it makes enterable is the component rule: a description
   is authored, optional, and never invented — a picture without one is
   skipped by screen readers, not guessed at. The "?" carries the full
   explanation (copy-voice: "Describing pictures"). */

export function DescribeSheet({ open = false, onClose, src, alt = "", value, onChange, onDone, inline = false }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Describe this picture" inline={inline} maxHeight="88%">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "0 var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <h2
            style={{
              margin: 0,
              flex: 1,
              fontSize: "var(--text-title-large)",
              lineHeight: "var(--text-title-large--line-height)",
              fontWeight: "var(--text-title-large--font-weight)",
            }}
          >
            Describe this picture
          </h2>
          <HelpDot ariaLabel="Describing pictures" />
        </div>
        <div
          style={{
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
        </div>
        <TextField label="What's in the picture" corner="Optional" rows={2} value={value} onChange={onChange} />
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            letterSpacing: "0.4px",
            color: "var(--text-secondary)",
          }}
        >
          Read aloud to people who can't see it, and shown if the picture can't load.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 var(--space-2)" }}>
          <Button variant="text" onClick={onDone ?? onClose}>
            Done
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
