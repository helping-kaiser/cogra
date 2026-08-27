import React from "react";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";

/* The coach mark of design.md §8.7.
   "A held gesture is invisible until taught, and a tap that stages a priced act
   must not be the teaching moment's casualty." The FIRST TAP EVER on a stance
   target opens this and stages NOTHING; every tap after it acts. So the mark's
   first job is to say that nothing was signed — a reader who thinks their tap was
   swallowed taps again, which is the exact spend the teaching moment exists to
   prevent.

   NON-MODAL: discoverable but never blocking. Nothing behind it is inert and
   nothing is trapped. It stays until dismissed or until the first successful hold   — never on a timer, because a hint that disappears while it is being read has
   not taught anything. */

export const STANCE_EXPLANATION =
  "A tap signs a small positive, +0.10 / +0.10. Press and hold the same button to open the pad and " +
  "pick exactly where you stand.";

/* What the pad's `?` opens (design.md §8.7: "a small `?` on the pad opens the
   explanation on demand, for anyone meeting the control after the one-time coach
   mark is spent").

   It REPLACES the pad's body rather than growing below it. The pad is parked at a
   fixed spot and operated by muscle memory; a panel that pushes Set and Cancel
   further from the thumb every time it opens breaks the one thing the parking
   exists to guarantee.

   Four lines, in the order a reader needs them: what the field means, what commits,
   why the three readouts differ, and what the way out costs. The third is the one
   nobody can guess — that a pick ADDS to what they already said — and it is the
   reason "Your pick" and "Resulting stance" are two different numbers. */
export const STANCE_PAD_HELP = [
  "Drag the knob to where you stand. Left to right is against to for; bottom to top is how much more of it you want reaching you.",
  "Letting go changes nothing. Set signs it, Cancel leaves without signing.",
  "Your pick is one new thing you're saying. It adds to what you've said before, which is why the resulting stance is a different number.",
  "Sever walks everything you've said back to nothing. It has its own confirmation, and it costs one signed action per record.",
];

/* The same help, for the alternates — which have no field, so the first line has
   to teach the thing the pad teaches by being a square: that an interaction here
   carries TWO values, not one. That is the genuinely new idea in this control, and
   a reader meeting it as two sliders has nothing to infer it from. */
export const STANCE_ALTERNATES_HELP = [
  "Two values, not one. The first is whether you're for or against it; the second is how much more of it you want reaching you.",
  "Nothing is signed until you press Sign it.",
  "Your pick adds to what you've said before, which is why the resulting stance is a different number.",
  "Sever walks everything back to nothing, at one signed action per record.",
];

export function StanceCoachMark({ onDismiss, style }) {
  const dismissRef = React.useRef(null);
  React.useEffect(() => {
    dismissRef.current?.focus();
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="How stances work"
      style={{
        zIndex: 20,
        display: "flex",
        width: "16rem",
        flexDirection: "column",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-extra-large)",
        background: "var(--surface-dialog)",
        color: "var(--on-surface)",
        padding: "var(--card-padding)",
        ...style,
      }}
    >
      <p style={{ margin: 0, fontSize: "var(--text-title-small)", fontWeight: "var(--text-title-small--font-weight)" }}>
        Press and hold to pick exactly
      </p>
      <p style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
        Nothing was signed just now. {STANCE_EXPLANATION}
      </p>
      <button
        ref={dismissRef}
        type="button"
        onClick={onDismiss}
        className={BUTTON_CLASS}
        style={{ ...buttonStyle({ variant: "text", size: "sm" }), alignSelf: "flex-end" }}
      >
        Got it
      </button>
    </div>
  );
}
