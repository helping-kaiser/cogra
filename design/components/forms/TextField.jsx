import React from "react";

/* The house labeled text input. `label-large` label above a field on the
   EXTRA-SMALL rung (4px) — Material's text-field corner — with a 1px `outline`
   border and a transparent fill. `mono` dresses codes and identifiers in the
   platform monospace: the one exception to Figtree (design.md §3), a legibility
   device for strings read character by character. */

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  mono = false,
  placeholder,
  rows,
  id,
}) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const shared = {
    borderRadius: "var(--radius-extra-small)",
    border: "1px solid var(--border-field)",
    background: "transparent",
    color: "var(--on-surface)",
    padding: rows ? "8px" : "8px 12px",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: "var(--text-body-large)",
    lineHeight: "var(--text-body-large--line-height)",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  };
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
      {rows ? (
        <textarea
          id={fieldId}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange && onChange(event.target.value)}
          style={shared}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange && onChange(event.target.value)}
          style={shared}
        />
      )}
    </div>
  );
}
