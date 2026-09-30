import React from "react";
import { HelpDot } from "../core/HelpDot.jsx";

/* THE NOTICE PANEL (the failure pack, 2026-09-30) — the `tertiary-container`
   block a surface wears when the one act it exists for cannot happen right
   now, and nothing failed. Nothing was staged, nothing was signed, nothing
   was spent: the state is a notice, not a fault, so it never takes `error`.

   IT IS THE KEY-ABSENT BOARDS' PANEL, PROMOTED. `ComposeKeyAbsent`,
   `PadKeyAbsent`, `SettingsBackupKeyAbsent`, `YourKeyAbsent` and
   `KeyCeremonyUnsupported` each draw this block by hand; the write rule's
   restoration surface was the sixth, and the componentization law says a
   sixth copy is a master owed. Those five still draw their own and move onto
   this one in a round of their own.

   ITS ANATOMY IS THEIRS: the title in `title-medium`, the panel's one "?" in
   `HelpDot`'s `inverse` beside it when the panel has something to explain,
   the body in `body-medium`, and what the reader can do about it last — a
   filled button in `Button`'s `inverse`, never `primary`, because a primary
   fill inside a tonal panel is a second colour family arguing with the
   panel's own. `corner` is the one thing the copies disagree on: the seal's
   panel sits beside the acts card and takes its `medium` rung; a page's
   panel leads the page and takes `large`. */
export function NoticePanel({ title, helpLabel, onHelp, corner = "medium", children }) {
  const body = React.Children.toArray(children);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderRadius: corner === "large" ? "var(--radius-large)" : "var(--radius-medium)",
        background: "var(--tertiary-container)",
        color: "var(--on-tertiary-container)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: "var(--text-title-medium)",
            lineHeight: "var(--text-title-medium--line-height)",
            fontWeight: "var(--text-title-medium--font-weight)",
            letterSpacing: "var(--text-title-medium--letter-spacing)",
          }}
        >
          {title}
        </h2>
        {helpLabel && <HelpDot ariaLabel={helpLabel} onOpen={onHelp} variant="inverse" />}
      </div>
      {body}
    </div>
  );
}

/* The panel's sentence — `body-medium` in the panel's own ink. */
export function NoticeLine({ children }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "var(--text-body-medium)",
        lineHeight: "var(--text-body-medium--line-height)",
        fontWeight: "var(--text-body-medium--font-weight)",
        letterSpacing: "var(--text-body-medium--letter-spacing)",
      }}
    >
      {children}
    </p>
  );
}
