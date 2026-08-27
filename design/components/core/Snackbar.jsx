import React from "react";

/* The transient confirmation (design.md §6): "Confirmation of a completed action
   is a snackbar on both platforms, fired once per event." §8.3 makes it
   load-bearing rather than decoration — a gesture that stages a priced act must
   never be silent, because silence reads as failure and invites the same act
   again.

   Elevation is tonal: the INVERSE SURFACE is what lifts a snackbar off the page,
   not a drop shadow. It clears itself after Material's short duration (4000ms);
   anything the reader still needs afterwards belongs on the surface it happened
   on.

   The live region is mounted whether or not it has anything to say — assistive
   technology only announces changes to a region it was already watching. */

export function Snackbar({ message, onDismiss, durationMs = 4000, inline = false, offset = 80 }) {
  React.useEffect(() => {
    if (message === null || message === undefined) return undefined;
    const timer = setTimeout(() => onDismiss && onDismiss(), durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  // 16px side insets, centred, and `offset` off the bottom edge. 80px clears the
  // 64px bottom bar on a read surface; a task flow carries no bar, so it passes
  // 16 — the source hardcodes 80 everywhere, which leaves the snackbar floating
  // on every surface that has nothing under it.
  const placement = inline
    ? { position: "relative", margin: "0 auto" }
    : { position: "fixed", left: "16px", right: "16px", bottom: `${offset}px`, margin: "0 auto", zIndex: 30 };

  return (
    <div role="status" aria-live="polite">
      {message !== null && message !== undefined && (
        <div
          style={{
            ...placement,
            width: "fit-content",
            maxWidth: "min(92vw, 24rem)",
            borderRadius: "var(--radius-extra-small)",
            background: "var(--surface-snackbar)",
            color: "var(--on-surface-snackbar)",
            padding: "12px 16px",
            boxSizing: "border-box",
            // The whole body-medium role, not just its size: a snackbar can be
            // mounted anywhere in the tree, and inheriting a heading's weight is
            // what makes it read as a different component.
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            fontWeight: "var(--text-body-medium--font-weight)",
            textAlign: "left",
            textWrap: "pretty",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
