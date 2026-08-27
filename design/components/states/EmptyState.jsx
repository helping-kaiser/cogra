import React from "react";
import { Button } from "../core/Button.jsx";

/* "Empty, loading, and error states for every list surface. DESIGNED, NOT BLANK."
   — design.md §6.

   That line is in the source and the source does not meet it: the product ships
   bare `<p>Loading…</p>` and `<p>Nothing here yet.</p>` with no shared shape. So
   these are the stated requirement, built.

   Register rules, from §7 and §9: an empty list is a calm statement plus, where
   there is one, the single action that fills it. It never scolds ("You have no
   posts!"), never sells, and never carries `error` colouring — an empty list is
   not a fault. A loading state says what it is doing and nothing else.

   The loading state is TEXT, not a spinner or a shimmer: motion clarifies where
   something came from and never performs (§4), and a skeleton that pretends to be
   content is the opposite of §9's honesty. Space for media is reserved by the
   media component when it arrives, which is a different job. */

export function EmptyState({ title, action, actionLabel, onAction }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", color: "var(--text-secondary)" }}>{title}</p>
      {action ??
        (actionLabel && onAction ? (
          <Button variant="outline" size="sm" selfStart onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null)}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <p role="status" aria-live="polite" style={{ margin: 0, fontSize: "var(--text-body-medium)", color: "var(--text-secondary)" }}>
      {label}
    </p>
  );
}
