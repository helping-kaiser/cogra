import React from "react";

/* The house labeled text input. `label-large` label above a field on the
   EXTRA-SMALL rung (4px) — Material's text-field corner — with a 1px `outline`
   border and a transparent fill. `mono` dresses codes and identifiers in the
   platform monospace: the one exception to Figtree (design.md §3), a legibility
   device for strings read character by character.

   SUPPORTING TEXT IS ONE SLOT WITH TWO STATES, which is Material 3's own
   arrangement rather than two independent lines. `hint` is the base: the
   body-small line in `--text-secondary` that says what the field will accept
   ("3–30 characters: a–z, 0–9, _"). `error` is that same line in its error
   state — the outline and the label switch to `--error` with it, and the
   message replaces the hint rather than joining it. A field never carries both
   at once: the rule the reader broke is the rule they needed to read, and two
   lines under one input is where the eye stops knowing which one is live.

   The message is always words (direction-by-words) — this component renders it
   verbatim, no icon. */

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
  hint,
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
      {(error || hint) && (
        <span
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
