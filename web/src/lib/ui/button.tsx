// The house button (Android's Material buttons): one home for the
// class strings that were pasted across every surface. Links styled as
// buttons take buttonClassName directly.

import type { ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-zinc-900 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900",
  outline: "border border-zinc-300 font-medium disabled:opacity-40 dark:border-zinc-700",
} as const;

const SIZES = {
  sm: "rounded-md px-3 py-1.5 text-sm",
  lg: "rounded-md px-4 py-2",
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
