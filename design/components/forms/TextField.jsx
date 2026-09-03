import React from "react";

/* The house labeled text input. `label-large` label above a field on the
   EXTRA-SMALL rung (4px) — Material's text-field corner — with a 1px `outline`
   border and a transparent fill. `mono` dresses codes and identifiers in the
   platform monospace: the one exception to Figtree (design.md §3), a legibility
   device for strings read character by character.

   `error` is Material 3's documented text-field error state: the outline and
   label both switch to `--error`, and a body-small supporting line in
   `--error` renders below the field carrying the message. The message is
   always words (direction-by-words) — this component renders it verbatim,
   no icon. This line is TextField-internal, separate from any screen-level
   helper span a board already draws under the field. */

export function TextField({
  label,
  corner,
  value,
  onChange,
  type = "text",
  autoComplete,
  mono = false,
  placeholder,
  rows,
  id,
  error,
}) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const shared = {
    borderRadius: "var(--radius-extra-small)",
    border: error ? "1px solid var(--error)" : "1px solid var(--border-field)",
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
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <label
          htmlFor={fieldId}
          style={{
            flex: 1,
            fontSize: "var(--text-label-large)",
            lineHeight: "var(--text-label-large--line-height)",
            letterSpacing: "var(--text-label-large--letter-spacing)",
            fontWeight: "var(--text-label-large--font-weight)",
            color: error ? "var(--error)" : undefined,
          }}
        >
          {label}
        </label>
        {/* The corner word — "Optional" on the details fields. A quiet fact
            beside the label, never inside it, so the label stays the name. */}
        {corner && (
          <span
            style={{
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              color: "var(--text-secondary)",
            }}
          >
            {corner}
          </span>
        )}
      </div>
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
      {error && (
        <span
          style={{
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--error)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
