import React from "react";

/* The house button (design.md §6): Material's three vocabularies, and no others
   on the page's own ground. Filled `primary`/`onPrimary` for the one committing
   action on a surface, outlined for a secondary action, text for a tertiary
   one. Both unfilled variants put `primary` on the LABEL — the label carries
   the emphasis, not the border, and a body-coloured label on an outlined button
   reads as disabled.

   `inverse` is the fourth, and it is not a fourth emphasis: it is the filled
   button standing on a TONAL PANEL instead of the page. The key-absent notice
   is a `tertiary-container` block, and a `primary` fill inside it is a second
   colour arguing with the panel's own; the filled button there takes the
   panel's pair and turns it over — `on-tertiary-container` as the fill,
   `tertiary-container` as the label. Same shape, same weight, one colour
   family. Use it only inside such a panel; on the page's ground it is `primary`
   that carries a committing action.

   The pill at every size (Material's button shape, not a rung of the shape
   scale); both sizes carry `label-large`. Heights are TRUE heights (border-box):
   40px `lg`, 32px `sm` — and every pill holds a 64px minimum width so short
   labels (Next, Set, Done) keep their weight (readme §13, 2026-08-27). */

const VARIANTS = {
  primary: { background: "var(--primary)", color: "var(--on-primary)", border: "1px solid transparent" },
  outline: { background: "transparent", color: "var(--primary)", border: "1px solid var(--outline)" },
  text: { background: "transparent", color: "var(--primary)", border: "1px solid transparent" },
  inverse: { background: "var(--on-tertiary-container)", color: "var(--tertiary-container)", border: "1px solid transparent" },
};

const SIZES = {
  sm: { padding: "6px 16px" },
  lg: { padding: "10px 24px" },
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
    minWidth: "64px",
    boxSizing: "border-box",
  };
}

/* Every pressable control wears these: the state layer of tokens/states.css, the
   focus ring, and the 48px hit expansion — a small button is 33px of ink and 48px
   of target, which is how the unconditional 48px promise survives a dense row.
   Pass it wherever `buttonStyle` is used on a raw <button>. */
export const BUTTON_CLASS = "cg-state cg-focus cg-hit";

/* The two rungs of the bare word. `lg` is `Button`'s own `label-large`; `sm`
   is `label-small`, the size the composer's running text is set in — the word
   has to match the sentence it sits inside, or it reads as a button that fell
   into a paragraph.

   `sm` spells its letter-spacing `0.5px` rather than
   `var(--text-label-small--letter-spacing)`. The token is `0.03125rem`, the
   same half-pixel at a 16px root; every call site was written with the
   literal, and the rung is extracted from them value for value. */
const INLINE_SIZES = {
  lg: {
    fontSize: "var(--text-label-large)",
    lineHeight: "var(--text-label-large--line-height)",
    fontWeight: "var(--text-label-large--font-weight)",
    letterSpacing: "var(--text-label-large--letter-spacing)",
  },
  sm: {
    fontSize: "var(--text-label-small)",
    lineHeight: "var(--text-label-small--line-height)",
    fontWeight: "var(--text-label-small--font-weight)",
    letterSpacing: "0.5px",
  },
};

/* THE BARE PRIMARY WORD — `Button`'s vocabulary with the button's body taken
   away: the same `label-large` in `primary`, and nothing else. No pill, no
   padding, no 64px minimum, no shape.

   WHEN THIS AND NOT `Button variant="text"`. A text button is still a button:
   it holds the 64px minimum so a short label keeps its weight, and it reserves
   room around the word. That is right when the action OWNS ITS LINE — a dialog
   footer, the foot of a wizard. It is wrong when the action rides at the end
   of a line the reader is already reading: on a seal row the label, the value
   and the action share one line by ruling, and the pill's minimum is what
   wraps it. So — a `Button` for an action on its own line, an `InlineAction`
   for one at the end of somebody else's.

   It keeps every promise the pill keeps. `BUTTON_CLASS` rides along, so ink
   that is 20px tall still answers to a 48px target, and the state layer and
   focus ring are the same ones.

   `flex: "none"` belongs to the `lg` rung and not to the atom. The large word
   ends a flex ROW whose middle is the part allowed to give — a seal row, the
   payout address — so it declares that it is not the one that gives. The small
   word rides inside running text: the describe counter and the upload error
   set it in a paragraph, and the picked sheet stacks it in a column under a
   name. There is no row there to give, and a flex declaration on an inline
   word in a paragraph is noise. `selfStart` is the column case's one layout
   word, matching `Button`'s prop of the same name — it leads the style object
   because that is where the sheet writes it. */
export function InlineAction({
  children,
  onClick,
  size = "lg",
  selfStart = false,
  disabled = false,
  type = "button",
  ariaLabel,
  className,
  style,
}) {
  const rung = INLINE_SIZES[size] ?? INLINE_SIZES.lg;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className ? `${BUTTON_CLASS} ${className}` : BUTTON_CLASS}
      style={{
        alignSelf: selfStart ? "flex-start" : undefined,
        border: 0,
        background: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: rung.fontSize,
        lineHeight: rung.lineHeight,
        fontWeight: rung.fontWeight,
        letterSpacing: rung.letterSpacing,
        color: "var(--primary)",
        opacity: disabled ? "var(--state-disabled)" : undefined,
        flex: size === "sm" ? undefined : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

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
