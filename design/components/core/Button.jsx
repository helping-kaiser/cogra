import React from "react";

/* The house button (design.md §6): Material's three vocabularies and no others.
   Filled `primary`/`onPrimary` for the one committing action on a surface,
   outlined for a secondary action, text for a tertiary one. Both unfilled
   variants put `primary` on the LABEL — the label carries the emphasis, not the
   border, and a body-coloured label on an outlined button reads as disabled.

   The pill at every size (Material's button shape, not a rung of the shape
   scale); both sizes carry `label-large` and differ only in padding. */

const VARIANTS = {
  primary: { background: "var(--primary)", color: "var(--on-primary)", border: "1px solid transparent" },
  outline: { background: "transparent", color: "var(--primary)", border: "1px solid var(--outline)" },
  text: { background: "transparent", color: "var(--primary)", border: "1px solid transparent" },
};

const SIZES = {
  sm: { padding: "6px 12px" },
  lg: { padding: "8px 16px" },
};

export function buttonStyle({ variant = "primary", size = "lg", selfStart = false, disabled = false } = {}) {
  return {
    ...VARIANTS[variant] ?? VARIANTS.primary,
    ...SIZES[size] ?? SIZES.lg,
    alignSelf: selfStart ? "flex-start" : undefined,
    borderRadius: "var(--radius-full)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-label-large)",
    lineHeight: "var(--text-label-large--line-height)",
    letterSpacing: "var(--text-label-large--letter-spacing)",
    fontWeight: "var(--text-label-large--font-weight)",
    opacity: disabled ? "var(--state-disabled)" : 1,
    cursor: disabled ? "default" : "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    minHeight: size === "sm" ? "32px" : "40px",
  };
}

/* Every pressable control wears these: the state layer of tokens/states.css, the
   focus ring, and the 48px hit expansion — a small button is 33px of ink and 48px
   of target, which is how the unconditional 48px promise survives a dense row.
   Pass it wherever `buttonStyle` is used on a raw <button>. */
export const BUTTON_CLASS = "cg-state cg-focus cg-hit";

export function Button({
  children,
  variant = "primary",
  size = "lg",
  selfStart = false,
  disabled = false,
  type = "button",
  onClick,
  ariaLabel,
  className,
  style,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className ? `${BUTTON_CLASS} ${className}` : BUTTON_CLASS}
      style={{ ...buttonStyle({ variant, size, selfStart, disabled }), ...style }}
    >
      {children}
    </button>
  );
}
