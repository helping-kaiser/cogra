// The house button (Android's Material buttons): one home for the
// class strings that were pasted across every surface. Links styled as
// buttons take buttonClassName directly.

import type { ReactNode } from "react";

// primary, not primaryContainer: design.md §2.4 reserves the loudest surface
// for the compose FAB and a committed stance, one place per screen.
// Material's three button vocabularies, matching what Compose gives Android:
// filled (`primary`/`onPrimary`), outlined (transparent, `outline` border, and
// a *`primary`* label — the label carries the emphasis, not the border), and
// text (transparent, `primary`, no border). A control that performs an action
// is one of these three; a control that navigates stays a link.
const VARIANTS = {
  primary: "bg-primary text-on-primary disabled:opacity-[var(--state-disabled)]",
  outline:
    "border border-outline text-primary disabled:opacity-[var(--state-disabled)]",
  text: "text-primary disabled:opacity-[var(--state-disabled)]",
} as const;

// label-large is Material's button role, so both sizes carry the same type and
// differ only in padding (design.md §3). The pill is Material's button shape at
// every size — `CornerFull`, not a rung of the shape scale.
//
// The measurements are the canvas's own (design/components/core/Button.jsx):
// a TRUE 40px tall with 24px side padding at `lg`, a true 32px with 16px at
// `sm`, and a 64px MINIMUM WIDTH at both, so short labels — Next, Set, Done —
// keep their weight instead of shrinking to the width of four letters. Heights
// are `min-h` on a border-box element, so the outlined variant's border sits
// inside the stated height rather than adding to it.
const SIZES = {
  sm: "min-h-8 min-w-16 rounded-full px-4 py-1.5 text-label-large",
  lg: "min-h-10 min-w-16 rounded-full px-6 py-2.5 text-label-large",
} as const;

// What every pressable control wears (design/components/core/Button.jsx's
// BUTTON_CLASS): the state layer, the focus ring, and the 48px hit expansion —
// a 32px button is 32px of ink and 48px of target, which is how the
// unconditional 48px promise survives a dense row.
export const BUTTON_CLASS = "cg-state cg-focus cg-hit";

// selfStart is layout, not look: buttons in a flex column pass it so
// they don't stretch; buttons in a centered row leave it off.
export function buttonClassName({
  variant = "primary",
  size = "lg",
  selfStart = false,
}: {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  selfStart?: boolean;
}): string {
  return [
    BUTTON_CLASS,
    "box-border inline-flex items-center justify-center gap-2",
    selfStart ? "self-start" : "",
    SIZES[size],
    VARIANTS[variant],
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  testId,
  type = "button",
  variant = "primary",
  size = "lg",
  selfStart = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  testId: string;
  type?: "button" | "submit";
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  selfStart?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={buttonClassName({ variant, size, selfStart })}
    >
      {children}
    </button>
  );
}
