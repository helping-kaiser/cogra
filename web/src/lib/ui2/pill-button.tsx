// The 2.0 button. Material's three vocabularies and no others: filled for the
// one committing action on a surface, outlined for a secondary action, text for
// a tertiary one. Both unfilled variants put `primary` on the LABEL — the label
// carries the emphasis, not the border.
//
// The sizes are the canvas's own measurements (design/readme.md §13, "Button
// rule", and the compose boards): a body button renders a TRUE 40px tall with
// 24px side padding and a 64px minimum width, so short labels — Next, Set,
// Done — keep their weight instead of shrinking to the width of four letters. A
// header pill is a compact true 32px with 16px padding, which is what lets it
// sit inside the 48px header band without crowding the title.
//
// `label-large` at every size (Material's button role); the pill is Material's
// button shape at every size — `rounded-full`, not a rung of the shape scale.

import type { ReactNode } from "react";

const VARIANTS = {
  filled: "bg-primary text-on-primary",
  outlined: "border border-outline text-primary",
  text: "text-primary",
} as const;

// Heights are `min-h` on a border-box element, so the border of the outlined
// variant sits inside the stated height rather than adding to it — that is what
// makes "true 40px" true across all three variants.
const SIZES = {
  // The wizard's own action button: Next, Set, Done.
  md: "min-h-10 min-w-16 px-6 py-2.5",
  // The header's trailing action, and dense rows.
  sm: "min-h-8 min-w-16 px-4 py-1.5",
} as const;

export type PillVariant = keyof typeof VARIANTS;
export type PillSize = keyof typeof SIZES;

export function pillClassName({
  variant = "filled",
  size = "md",
  full = false,
}: {
  variant?: PillVariant;
  size?: PillSize;
  full?: boolean;
}): string {
  return [
    "cg-state cg-focus",
    "box-border inline-flex items-center justify-center gap-2 rounded-full",
    "text-label-large",
    "disabled:opacity-40",
    SIZES[size],
    VARIANTS[variant],
    full ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function PillButton({
  children,
  testId,
  type = "button",
  variant = "filled",
  size = "md",
  full = false,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  testId: string;
  type?: "button" | "submit";
  variant?: PillVariant;
  size?: PillSize;
  full?: boolean;
  disabled?: boolean;
  // For a button whose visible content is a glyph rather than words.
  label?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      data-testid={testId}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      className={pillClassName({ variant, size, full })}
    >
      {children}
    </button>
  );
}

// The inline word-sized action the canvas uses wherever a pill would be too
// loud: "Write words instead", "Show all", "Crop", "Edit", "+ Cite something".
// `label-medium` in `primary`, and a real button — it performs an action, so it
// is not a link. `cg-hit` gives it the 48px target its 16px of ink does not.
export function TextAction({
  children,
  testId,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  testId: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="cg-state cg-focus cg-hit relative inline-flex items-center rounded-extra-small text-label-medium text-primary disabled:opacity-40"
    >
      {children}
    </button>
  );
}
