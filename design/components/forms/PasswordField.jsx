import React from "react";
import { BUTTON_CLASS } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* A labeled password input with a show/hide toggle. The toggle is the Material
   `visibility` / `visibility_off` glyph in the field's trailing slot, matching
   Android's transparent IconButton — it replaced the web's interim "Show"/"Hide"
   words when the icon exports landed (2026-08-26). No background: an icon button
   in this system never wears one. The state lives in the accessible name, which
   says what the tap will DO ("Show password"), not what is on screen. */

export function PasswordField({ label, value, onChange, autoComplete = "current-password", id }) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const [visible, setVisible] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <label
        htmlFor={fieldId}
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
          fontWeight: "var(--text-label-large--font-weight)",
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange && onChange(event.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: "var(--radius-extra-small)",
            border: "1px solid var(--border-field)",
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
    </div>
  );
}
