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
  primary: "bg-primary text-on-primary disabled:opacity-40",
  outline: "border border-outline text-primary disabled:opacity-40",
  text: "text-primary disabled:opacity-40",
} as const;

// label-large is Material's button role, so both sizes carry the same type and
// differ only in padding (design.md §3). The pill is Material's button shape at
// every size — `CornerFull`, not a rung of the shape scale.
const SIZES = {
  sm: "rounded-full px-3 py-1.5 text-label-large",
  lg: "rounded-full px-4 py-2 text-label-large",
} as const;

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
  return `${selfStart ? "self-start " : ""}${SIZES[size]} ${VARIANTS[variant]}`;
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
