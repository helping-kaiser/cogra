import React from "react";
import { buttonStyle, BUTTON_CLASS } from "./Button.jsx";

/* The guest prompt behind an account-needing slot (design.md §6): ASK, NEVER
   BOUNCE — the reader picks the auth flow or stays put. Dialog surface is
   `surfaceContainerHigh` at the extra-large rung with 24px padding.

   DIVERGENCE FROM THE SOURCE: the affirmative is a FILLED button, not a third text
   button. M3's dialog vocabulary is text buttons, and the source follows it — which
   leaves "Keep browsing" and "Sign in or join" weighted identically. They are not
   identical: joining is the one committing action on this surface, and §6 gives the
   filled button to exactly that. `Keep browsing` stays a text button and stays
   first, so the reader who wants to be left alone is never nudged into signing by
   thumb position.

   It is still an ask, not a wall: nothing behind it is destroyed, the reader can
   dismiss it, and the read they were in the middle of is still there. */

export function DialogSurface({ children, ariaLabel, inline = false, onScrimPress, width = "20rem" }) {
  const surface = (
    <div
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-label={ariaLabel}
      style={{
        width: `min(90vw, ${width})`,
        borderRadius: "var(--radius-extra-large)",
        background: "var(--surface-dialog)",
        color: "var(--on-surface)",
        padding: "var(--space-6)",
        textAlign: "left",
      }}
    >
      {children}
    </div>
  );
  if (inline) return surface;
  return (
    <div
      onPointerDown={onScrimPress}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "grid",
        placeItems: "center",
        background: "var(--scrim-dialog)",
      }}
    >
      {surface}
    </div>
  );
}

export function JoinPrompt({ open = true, onClose, onSignIn, inline = false }) {
  if (!open) return null;
  return (
    <DialogSurface ariaLabel="Join the conversation" inline={inline} onScrimPress={onClose}>
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
      >
        Join the conversation
      </h2>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          color: "var(--text-secondary)",
        }}
      >
        Posting and profiles need an account.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-6)" }}>
        <button type="button" onClick={onClose} className={BUTTON_CLASS} style={buttonStyle({ variant: "text", size: "sm" })}>
          Keep browsing
        </button>
        <button type="button" onClick={onSignIn} className={BUTTON_CLASS} style={buttonStyle({ variant: "primary", size: "sm" })}>
          Sign in or join
        </button>
      </div>
    </DialogSurface>
  );
}
