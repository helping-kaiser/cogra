import React from "react";
import { buttonStyle, BUTTON_CLASS } from "./Button.jsx";
import { useModalFocus } from "./BottomSheet.jsx";

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

/* THE SHELL SETS THE WIDTH, AND ONE WIDTH IS THE POINT (jakob 2026-09-15:
   "popups should not be full width (if they dont need to).. it makes them
   standout more ... it almost looks like it is part of the normal pages body
   which is not how it should be"). A dialog is the only thing on screen that
   the reader must answer, and what says so before a word is read is the gap
   around it. The clamp this shell used to carry left 5% a side, which on a
   phone is nineteen pixels — narrower than the page's own gutter, so the
   widest dialogs came out WIDER than the column of body text behind them and
   read as another block of page. `--dialog-inset` is that gap now, and it is
   larger than the gutter on purpose.

   `width` OVERRIDES THE MAX AND NOTHING ELSE. The inset holds whatever is
   passed, so no caller can reach the edge; it exists for the rare dialog whose
   content genuinely cannot live at the house width, and every product dialog
   today is at the house width. Three shells drifting to three widths is what
   extracting this one was meant to stop.

   THE SHELL OWNS THE ANATOMY TOO (readme §11, *Dialogs*; jakob 2026-10-01).
   `title`, `body` and `actions` are slots, laid out by M3's dialog spec: the
   title in `headline-small`, the body in `body-medium` on `onSurfaceVariant`
   (M3's supporting text) — a string, a list of paragraphs, or nodes for a body
   that needs more than words — 16px under the title, and the actions at the
   default button size, end-aligned, 24px under the body. A board passes words
   and buttons, never a layout, so the dialogs that hand-built their own
   anatomy and drifted into two sizes, two alignments and two body colours
   cannot drift again. `children` stays for the two dialogs whose content is a
   master that lays itself out rather than a question with answers —
   `StanceAlternates`' chooser and the key notice `ReplyKeyAbsent` raises.

   THE SCRIM, BACK AND ESCAPE TAKE THE SAFE ANSWER. `onScrimPress` is that
   answer — cancel, keep, stay, close — never the destructive act; Escape (and
   Android's Back) call it too. Focus moves into the dialog, stays inside it,
   and returns to what opened it (readme §10). */
const DIALOG_TITLE_STYLE = {
  margin: 0,
  fontSize: "var(--text-headline-small)",
  lineHeight: "var(--text-headline-small--line-height)",
  fontWeight: "var(--text-headline-small--font-weight)",
};
const DIALOG_BODY_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  fontSize: "var(--text-body-medium)",
  lineHeight: "var(--text-body-medium--line-height)",
  letterSpacing: "var(--text-body-medium--letter-spacing)",
  color: "var(--text-secondary)",
};
const asParagraphs = (body) =>
  (Array.isArray(body) ? body : [body]).map((part, index) =>
    typeof part === "string" ? (
      <p key={index} style={{ margin: 0 }}>
        {part}
      </p>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );

export function DialogSurface({ children, ariaLabel, inline = false, onScrimPress, width = "var(--dialog-max-width)", title, body, actions }) {
  const surfaceRef = React.useRef(null);
  useModalFocus(surfaceRef, !inline, onScrimPress);
  const slotted = title !== undefined || body !== undefined || actions !== undefined;
  const surface = (
    <div
      ref={surfaceRef}
      tabIndex={inline ? undefined : -1}
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      style={{
        width: `min(calc(100vw - 2 * var(--dialog-inset)), ${width})`,
        borderRadius: "var(--radius-extra-large)",
        background: "var(--surface-dialog)",
        color: "var(--on-surface)",
        padding: "var(--space-6)",
        textAlign: "left",
        outline: "none",
      }}
    >
      {slotted ? (
        <>
          {title !== undefined && <h2 style={DIALOG_TITLE_STYLE}>{title}</h2>}
          {body !== undefined && <div style={{ ...DIALOG_BODY_STYLE, marginTop: title !== undefined ? "var(--space-4)" : 0 }}>{asParagraphs(body)}</div>}
          {actions !== undefined && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-6)" }}>{actions}</div>
          )}
        </>
      ) : (
        children
      )}
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
    <DialogSurface
      inline={inline}
      onScrimPress={onClose}
      title="Join the conversation"
      body="Posting and profiles need an account."
      actions={
        <>
          <button type="button" onClick={onClose} className={BUTTON_CLASS} style={buttonStyle({ variant: "text" })}>
            Keep browsing
          </button>
          <button type="button" onClick={onSignIn} className={BUTTON_CLASS} style={buttonStyle({ variant: "primary" })}>
            Sign in or join
          </button>
        </>
      }
    />
  );
}
