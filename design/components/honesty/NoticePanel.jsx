import React from "react";
import { HelpDot } from "../core/HelpDot.jsx";

/* THE NOTICE PANEL (the failure pack, 2026-09-30) — the `tertiary-container`
   block a surface wears when the one act it exists for cannot happen right
   now, and nothing failed. Nothing was staged, nothing was signed, nothing
   was spent: the state is a notice, not a fault, so it never takes `error`.

   IT IS THE KEY-ABSENT BOARDS' PANEL, PROMOTED. `ComposeKeyAbsent`,
   `PadKeyAbsent`, `SettingsBackupKeyAbsent`, `YourKeyAbsent`,
   `KeyCeremonyUnsupported` and the reply's `KeyAbsentNotice` wear it, beside
   the write rule's restoration surface and the seal's bug register — one
   corner rule and one title, letter-spacing included.

   ITS ANATOMY IS THEIRS: the title in `title-medium`, the panel's one "?" in
   `HelpDot`'s `inverse` beside it when the panel has something to explain,
   the body in `body-medium`, and what the reader can do about it last — a
   filled button in `Button`'s `inverse`, never `primary`, because a primary
   fill inside a tonal panel is a second colour family arguing with the
   panel's own. `corner` is the one thing the copies disagree on: the seal's
   panel sits beside the acts card and takes its `medium` rung; a page's
   panel leads the page and takes `large`.

   THE REGISTER IS THE ACCOUNT NOTICE, AND IT REACHES THE FEED (jakob
   2026-10-02, the olive split). `tertiary-container` — the olive — is how the
   system speaks to the reader about their own account: this panel, and every
   feed card that needs the reader's action (verify the email, restore or
   bring the key, the security notice, the vouch-back, a closed application's
   way back in), which wears the same ground and the same `inverse` fill
   (`TaskCard`'s `tone="notice"`). A feed card that only says how things stand
   — waiting, approved and landing, a post that didn't land with its draft
   kept — keeps the feed card's ground, so the olive always means "this is
   yours to do". It is never a page's wash and never a failure. */
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
