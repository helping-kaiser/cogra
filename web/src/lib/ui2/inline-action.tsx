"use client";

// THE INLINE ACTION (design/components/core/Button.jsx `InlineAction`): an
// action word at the end of somebody else's line — the sessions' `Revoke`,
// the pair's `Resend`, `Cancel the change`. It keeps every promise the pill
// keeps (state layer, focus ring, 48px target) without the pill's minimum.
//
// A CONSEQUENTIAL WORD WAITS AS THE PILL DOES: `busy` swaps the word for its
// `busyLabel` (`Revoke` → `Revoking…`) and the word goes inert, never dimmed.

import type { ReactNode, Ref } from "react";

import { BUTTON_CLASS } from "@/lib/ui/button";
import { testAttributes, type DataNode } from "@/lib/ui/data-node";

export function InlineAction({
  children,
  onClick,
  size = "lg",
  busy = false,
  busyLabel,
  disabled = false,
  node,
  testId,
  buttonRef,
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: "lg" | "sm";
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  node?: DataNode;
  testId?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={busy ? undefined : onClick}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      {...testAttributes(node, testId)}
      className={`${BUTTON_CLASS} border-0 bg-transparent p-0 font-sans text-primary ${
        size === "sm" ? "self-start text-label-small" : "flex-none text-label-large"
      } ${disabled ? "opacity-[var(--state-disabled)]" : ""} ${
        disabled || busy ? "cursor-default" : "cursor-pointer"
      }`}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  );
}
