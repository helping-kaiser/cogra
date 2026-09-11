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

/* ONE ACTION, AND ONLY WHERE THE ACT IS WORTH REVERSING (`action`, the
   review-fix round). Material's snackbar takes a single action and this one
   takes the same: `Undo` on hiding someone, a read-side comfort a reader may
   have meant for one post rather than for a person. It is a WORD, not a button
   body — a pill's ground inside a surface that is itself a lift off the page
   would be a second surface arguing with the first — and it takes
   `--action-on-snackbar`, since `primary` on the inverse ground is the one
   place the brand colour stops being legible. It rides the message's own line:
   a snackbar that grows a second row is a dialog nobody asked for.

   NOT EVERY SNACKBAR GETS ONE, and the absence is a decision each time. The
   canceled-deletion board records the case where a way back is worse than
   none. */
export function Snackbar({ message, action, onAction, onDismiss, durationMs = 4000, inline = false, offset = 80 }) {
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
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <span style={{ minWidth: 0 }}>{message}</span>
          {action && (
            <button
              type="button"
              onClick={onAction}
              className="cg-state cg-focus cg-hit"
              style={{
                flex: "none",
                border: 0,
                background: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--action-on-snackbar)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-label-large)",
                lineHeight: "var(--text-label-large--line-height)",
                letterSpacing: "var(--text-label-large--letter-spacing)",
                fontWeight: "var(--text-label-large--font-weight)",
                whiteSpace: "nowrap",
                borderRadius: "var(--radius-extra-small)",
              }}
            >
              {action}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
