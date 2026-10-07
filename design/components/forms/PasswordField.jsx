import React from "react";
import { BUTTON_CLASS } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* A labeled password input with a show/hide toggle. The toggle is the Material
   `visibility` / `visibility_off` glyph in the field's trailing slot, matching
   Android's transparent IconButton — it replaced the web's interim "Show"/"Hide"
   words when the icon exports landed (2026-08-26). No background: an icon button
   in this system never wears one. The state lives in the accessible name, which
   says what the tap will DO ("Show password"), not what is on screen.

   `hint` and `error` mirror TextField's supporting-text slot, since this
   component duplicates TextField's field markup rather than composing it: one
   body-small line under the field, `text-secondary` for what the field will
   accept and `--error` for the message when it is refused — the error replacing
   the hint, never joining it, and taking the outline and the label with it.

   The line is wired to the input exactly as `TextField` wires its own —
   `aria-describedby` always, `aria-invalid` and `role="alert"` in the error
   state — because duplicating the markup must not mean duplicating it minus
   the part that makes the message reach anyone.

   ONE RULE FOR CREDENTIAL FORMS (the K13 round, ruled; readme §10). A form
   that signs in, sets a password or re-proves one names the account it is for
   by its email — the login identifier — as `autocomplete="username"`: on its
   email field where it draws one (`SignIn`, `Join`), and where it draws none
   (`ChangePassword`, `ResetNew`, and the re-proving `ChangeEmail` and
   `ApplicantEmail`, jakob 2026-10-05) in a hidden input carrying the address, which
   is Chromium's documented way to tell a password manager whose password is
   changing. `account` renders that input beside this field. A password is
   `current-password` or `new-password`, never guessed at, never corrected,
   never capitalized; and a handle is never `username` — it is not what the
   reader signs in with.

   THE RETURN KEY: `go` by default — a password is the last field of every
   credential form but one — and `next` where a field follows
   (`ChangePassword`'s current password). */

export function PasswordField({ label, value, onChange, autoComplete = "current-password", id, hint, error, account, enterKeyHint = "go", node }) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const supportId = `${fieldId}-support`;
  const [visible, setVisible] = React.useState(false);
  return (
    // Same reasoning as TextField's own `data-field`: a replaced element
    // cannot host the flow badge's ::after, so the badge names the field as a
    // whole (jakob's ruling A9, backlog item 40).
    <div data-field={label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} data-node={node}>
      <label
        htmlFor={fieldId}
        data-node={node && "label"}
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
          fontWeight: "var(--text-label-large--font-weight)",
          color: error ? "var(--error)" : undefined,
        }}
      >
        {label}
      </label>
      {account && <input type="email" autoComplete="username" value={account} readOnly hidden style={{ display: "none" }} />}
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          aria-describedby={error || hint ? supportId : undefined}
          aria-invalid={error ? "true" : undefined}
          onChange={(event) => onChange && onChange(event.target.value)}
          data-node={node && "input"}
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: "var(--radius-extra-small)",
            border: error ? "1px solid var(--error)" : "1px solid var(--border-field)",
            background: "transparent",
            color: "var(--on-surface)",
            padding: "8px 12px",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-large)",
          }}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
          data-node={node && "reveal"}
          className={BUTTON_CLASS}
          style={{
            flex: "none",
            width: "var(--touch-target-min)",
            height: "var(--touch-target-min)",
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-full)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Icon name={visible ? "visibility_off" : "visibility"} />
        </button>
      </div>
      {(error || hint) && (
        <span
          id={supportId}
          role={error ? "alert" : undefined}
          data-node={node && "support"}
          style={{
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: error ? "var(--error)" : "var(--text-secondary)",
          }}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
}
