"use client";

// The coach mark of design.md §8.7.
//
// "A held gesture is invisible until taught, and a tap that stages a
// priced act must not be the teaching moment's casualty." The first tap
// ever on a stance target opens this and stages NOTHING; every tap after
// it acts. So the mark's first job is to say that nothing was signed —
// a reader who thinks their tap was swallowed taps again, which is the
// exact spend the teaching moment exists to prevent (§9).
//
// It is anchored to the target and overlaps nothing: the same placement
// the pad uses, which keeps it clear of the target and inside the
// viewport. It stays until dismissed or until the first successful hold
// — never on a timer, because a hint that disappears while it is being
// read has not taught anything.
//
// Non-modal (WAI-ARIA's dialog pattern): the mark must be discoverable
// but never blocking, so nothing behind it is inert and nothing is
// trapped. Focus moves to it once, because a reader who cannot see it
// otherwise has no way to learn why their tap did nothing, and Escape
// hands focus back where it came from.

import { useEffect, useRef } from "react";

import { buttonClassName } from "@/lib/ui/button";
import { anchoredStyle, useAnchoredPlacement } from "@/lib/ui/use-anchored";

/**
 * How the gesture works, in one place: the coach mark teaches it on the
 * first tap ever, and the pad's `?` opens the same words on demand for
 * anyone meeting the control after that one-time mark is spent (§8.7).
 * Two copies would drift, and the pad's copy is the one a reader reaches
 * for precisely because they no longer remember the mark.
 *
 * It has to say that releasing changes nothing: that is the part of the
 * gesture a reader cannot discover safely by trying, since the obvious
 * guess — release commits — is the one the pad deliberately does not do.
 */
export const STANCE_EXPLANATION =
  "A tap signs a small positive. Press and hold the same button to open the pad and drag to " +
  "exactly where you stand — letting go changes nothing. Set signs it; Cancel leaves without " +
  "signing.";

export function StanceCoachMark({
  anchorRef,
  onDismiss,
  testId,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  testId: string;
}) {
  const markRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const placement = useAnchoredPlacement(anchorRef, markRef, true);

  useEffect(() => {
    dismissRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onDismiss();
      anchorRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anchorRef, onDismiss]);

  return (
    <div
      ref={markRef}
      role="dialog"
      aria-modal="false"
      aria-label="How stances work"
      data-testid={testId}
      data-side={placement?.side ?? "unplaced"}
      style={anchoredStyle(placement)}
      className="z-20 flex w-64 flex-col gap-2 rounded-extra-large bg-surface-container-high p-4 text-on-surface"
    >
      <p className="text-title-small">Press and hold to say more</p>
      {/* Honesty first: the tap that opened this did not spend anything. */}
      <p className="text-body-small text-on-surface-variant">
        Nothing was signed just now. {STANCE_EXPLANATION}
      </p>
      <button
        ref={dismissRef}
        type="button"
        data-testid={`${testId}-dismiss`}
        onClick={() => {
          onDismiss();
          anchorRef.current?.focus();
        }}
        className={`self-end ${buttonClassName({ variant: "text", size: "sm" })}`}
      >
        Got it
      </button>
    </div>
  );
}
