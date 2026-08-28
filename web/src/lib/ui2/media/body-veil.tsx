"use client";

// The sensitive veil — ONE state over the whole body.
//
// GRANULARITY (D12, jakob 2026-08-28): the body region blurs as a unit — the
// media, the text body, and the description together — and the TITLE STAYS
// OUTSIDE IT, so choosing to look is an informed choice rather than a blind
// one. This deliberately reverses the earlier per-field/per-attachment reading
// in design/readme.md §12 and moderation.md, which had one image in a gallery
// veiling alone: that was ruled out as "ui hell". The doc write-back is lane
// E's; this component is the ruled behaviour.
//
// So this is a WRAPPER a screen puts around its body region, not a property of
// a tile. One reveal answers for everything inside, because the reader has
// already made the decision and asking again per item turns one decision into
// five.
//
// The content stays MOUNTED under the veil and keeps its exact space, so
// revealing moves nothing on screen. That is also why text is blurred in place
// rather than replaced.
//
// No `error` colouring and no warning glyph: a neutral wash of the standard
// scrim and a plain `visibility` chip. A veiled post is not a failure.

import { useState, type ReactNode } from "react";

export function BodyVeil({
  children,
  // The author's own reason, when they gave one. Shown on the veil so the
  // reader's choice is informed.
  reason,
  label = "Sensitive — tap to view",
  revealed: controlled,
  onReveal,
  radius = "var(--radius-medium)",
  testId = "body-veil",
}: {
  children: ReactNode;
  reason?: string | null;
  label?: string;
  // A screen that remembers the decision across a navigation drives it; a lone
  // body governs itself.
  revealed?: boolean;
  onReveal?: () => void;
  radius?: string;
  testId?: string;
}) {
  const [local, setLocal] = useState(false);
  const revealed = controlled ?? local;

  if (revealed) return <>{children}</>;

  const reveal = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    // The veil is a decision, not a route: tapping it must not also open the
    // post it sits in.
    event.preventDefault();
    event.stopPropagation();
    if (onReveal) onReveal();
    else setLocal(true);
  };

  return (
    <div
      data-testid={testId}
      style={{ borderRadius: radius }}
      className="relative flex min-w-0 overflow-hidden"
    >
      {/* The content still renders and still reserves its exact space — the
          veil is OVER it, not instead of it. `scale` hides the transparent edge
          a blur leaves at the bounds, and the wrapper clips it so the scaled
          halo never paints into the title above. */}
      <div
        aria-hidden="true"
        style={{ filter: "blur(24px)", transform: "scale(1.06)" }}
        className="min-w-0 flex-1 overflow-hidden select-none"
      >
        {children}
      </div>
      <button
        type="button"
        data-testid={`${testId}-reveal`}
        onClick={reveal}
        aria-label={reason ? `${label} — ${reason}` : label}
        style={{
          borderRadius: radius,
          // A neutral wash, not a warning: the same scrim every covering
          // surface in this system uses, at a little over half strength.
          background: "color-mix(in oklab, var(--scrim-dialog) 55%, transparent)",
        }}
        className="cg-focus absolute inset-0 grid cursor-pointer place-items-center border-0 p-0"
      >
        <span
          // Fixed white, deliberately theme-independent: the wash is dark in
          // both themes, so a role here would go invisible in one of them.
          style={{ color: "#ffffff" }}
          className="flex flex-col items-center gap-2 px-6 text-center"
        >
          <VisibilityGlyph />
          <span className="text-label-large">{label}</span>
          {reason && (
            <span className="text-body-small opacity-85">{reason}</span>
          )}
        </span>
      </button>
    </div>
  );
}

// Material's `visibility`, the filled 24px cut the product already inlines.
export function VisibilityGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
    </svg>
  );
}
