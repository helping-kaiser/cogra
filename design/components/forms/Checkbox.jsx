import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* The house checkbox — the system had none, and the entry screens needed one
   ("Don't remember this account on this device" on sign-in and restore). An
   18px box on the extra-small rung with the system's one hairline weight: M3
   draws its checkbox border at 2px, but §4 rules that nothing carries a 2px
   border, and the 1px `outline` reads correctly beside the text field it
   usually sits under. Checked fills `primary` with the inlined `check` glyph
   (§5) — colour plus a mark, never colour alone.

   THE ROW IS THE CONTROL. The label is part of the target, and the row
   reaches the 48px minimum however small the box is drawn — the same
   drawn-vs-tapped split the chips use. */

export function Checkbox({ label, checked = false, onChange, id }) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  return (
    <label
      htmlFor={fieldId}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        minHeight: "var(--touch-target-min)",
        borderRadius: "var(--radius-small)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange && onChange(event.target.checked)}
        style={{ position: "absolute", opacity: 0, width: "1px", height: "1px", margin: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: "18px",
          height: "18px",
          flex: "none",
          borderRadius: "var(--radius-extra-small)",
          border: checked ? "1px solid transparent" : "1px solid var(--border-field)",
          background: checked ? "var(--primary)" : "transparent",
          color: "var(--on-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Icon name="check" size={14} />}
      </span>
      <span
        style={{
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          letterSpacing: "var(--text-body-medium--letter-spacing)",
        }}
      >
        {label}
      </span>
    </label>
  );
}
