import React from "react";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import { SR_ONLY } from "./StanceReadout.jsx";

/* A HELP SENTENCE SPEAKS THE FACE AND CARRIES THE DIGITS BEHIND IT (jakob's
   ruling, the geek round). Every line that names a pair is emoji-first: the
   face is the reading, and the numbers ride a trailing `cg-exact` span that
   paints only when the reader has asked for them (readme §13). The painted
   tail is `aria-hidden` and `spoken` says the whole fact in both modes —
   prose follows the mode exactly as a readout does, and neither redacts.

   A line with nothing to hide is a plain string and stays one. */
export function HelpLine({ line }) {
  if (typeof line === "string") return line;
  return (
    <>
      <span aria-hidden="true">
        {line.text}
        {line.face}
        <span className="cg-exact">{line.exact}</span>
        {line.tail}
      </span>
      <span style={SR_ONLY}>{line.spoken}</span>
    </>
  );
}

/** The key a list needs, whichever shape the line takes. */
export function helpKey(line) {
  return typeof line === "string" ? line : line.spoken;
}

/* The coach mark of design.md §8.7.

   A HELD GESTURE IS INVISIBLE UNTIL TAUGHT. The tap opens the pad, so the pad
   is where a reader arrives on their own and the teaching moment costs nothing;
   what is left to say is that the same button, HELD, signs the gentle default
   without opening anything. This rides the FIRST OPEN EVER and never again.

   NON-MODAL: discoverable but never blocking. Nothing behind it is inert and
   nothing is trapped. It stays until dismissed or until the pad closes — never
   on a timer, because a hint that disappears while it is being read has not
   taught anything. */

export const STANCE_EXPLANATION = {
  text: "A tap opens this pad. Press and hold the same button and a gentle ",
  face: "🙂",
  exact: " (+0.10 / +0.10)",
  tail: " is signed without opening anything.",
  spoken:
    "A tap opens this pad. Press and hold the same button and a gentle Nice, For or against +0.10, " +
    "How much reaches you +0.10, is signed without opening anything.",
};

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
   reason the pick and the result wear two different faces. IT SPEAKS FACES, not
   numbers (jakob's ruling, the geek round): the explanation has to hold for a
   reader who has never turned the digits on, and "the two faces can differ" is
   the same fact said in what they can see. */
export const STANCE_PAD_HELP = [
  "Drag the knob to where you stand. Left to right is against to for; bottom to top is how much more of it you want reaching you.",
  "Letting go changes nothing. Set signs it, Cancel leaves without signing.",
  "Your pick adds to what you've said before — that's why the two faces can differ.",
  "Walk it back takes everything you've said to nothing. It has its own confirmation, and each thing you've said is walked back by its own signature.",
];

/* The same help, for the alternates — which have no field, so the first line has
   to teach the thing the pad teaches by being a square: that an interaction here
   carries TWO values, not one. That is the genuinely new idea in this control, and
   a reader meeting it as two sliders has nothing to infer it from. */
export const STANCE_ALTERNATES_HELP = [
  "Two values, not one. The first is whether you're for or against it; the second is how much more of it you want reaching you.",
  "Nothing is signed until you press Sign it.",
  "Your pick adds to what you've said before — that's why the two faces can differ.",
  "Walk it back takes everything to nothing, and each thing you've said is walked back by its own signature.",
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
        Press and hold to sign it outright
      </p>
      <p style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
        Nothing was signed just now. <HelpLine line={STANCE_EXPLANATION} />
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
