// What the open pad says about itself: the one line of the first-ever open,
// the four help lines its `?` opens, the vouch-back pad's own help, and the
// three lines an unreachable landing's 🤔 opens.
//
// THE FIRST-EVER OPEN SAYS ONLY `Nothing is signed until Set.` (copy-voice
// "The first-ever pad's coaching stands behind its ?", jakob 2026-11-12):
// the line rides the account's first-ever pad open, wherever that pad opens,
// closes with it, and never shows again. The shortcut it used to teach is
// said in `Your vouch back`.
//
// THE HELP REPLACES THE PAD'S BODY (stance-control.md "The gesture": the
// `?` "replaces the pad's body with four lines of help, and disables Set
// while it shows"). The words are the master's (`StanceReadout.jsx`'s
// `STANCE_PAD_HELP`, `STANCE_ALTERNATES_HELP`, `unreachableHelp`) verbatim;
// the fourth line names the record family's own way out, so a topic's ends
// on Disconnect.

import { severanceWords, type StanceAxes } from "@/lib/ui/stance-format";

const STANCE_PAD_HELP = [
  "Drag the knob. Left to right is against to for; bottom to top is how much more of it you want reaching you.",
  "Letting go changes nothing. Set signs it, Cancel leaves without signing.",
  "Your pick adds to what you've said before — that's why the two faces can differ.",
] as const;

/** The alternates have no field, so their first line teaches two values, not one. */
const STANCE_ALTERNATES_HELP = [
  "Two values, not one. The first is whether you're for or against it; the second is how much more of it you want reaching you.",
  "Nothing is signed until you press Sign it.",
  "Your pick adds to what you've said before — that's why the two faces can differ.",
] as const;

/** The pad's four help lines, the last one the family's own. */
export function padHelp(axes?: StanceAxes): readonly string[] {
  return [...STANCE_PAD_HELP, severanceWords(axes).help];
}

/** The alternates' four help lines, the last one the family's own. */
export function alternatesHelp(axes?: StanceAxes): readonly string[] {
  return [...STANCE_ALTERNATES_HELP, severanceWords(axes).helpAlternates];
}

/**
 * WHAT THE 🤔 OPENS ON AN UNREACHABLE LANDING (jakob 2026-10-20, seam 240):
 * three facts in the order a reader doubts them — the opinion is still held
 * (a person stays under `Your people`), nothing passes through it, and it is
 * not the family's way out, which is an act of its own.
 */
export function unreachableHelp(axes: StanceAxes | undefined, targetLabel: string): readonly string[] {
  // THE FIRST LINE NAMES THE LIST THE TARGET STAYS ON, by the label's kind
  // (StanceReadout.jsx `unreachableHelp`, round 21): a person stays under
  // `Your people`, a tag on `Your tags` (round 30); a post or a comment sits on no
  // list of the reader's, so its line stops at the opinion.
  const stays = targetLabel.startsWith("@")
    ? `${targetLabel} stays under Your people`
    : targetLabel.startsWith("#")
      ? `${targetLabel} stays on Your tags`
      : null;
  return [
    stays === null ? "It still counts among your opinions." : `It still counts among your opinions — ${stays}.`,
    "It shapes no one's feed, earns nothing, and nothing passes on through you.",
    `${severanceWords(axes).control} is different: its own act, confirmed and paid for, that leaves a clean slate.`,
  ];
}

/**
 * THE FIRST-EVER OPEN SAYS ONE THING (jakob 2026-11-12; copy-voice "The
 * first-ever pad's coaching stands behind its ?"; VouchBackPad.md:15): on
 * the account's first-ever pad open, wherever that pad opens, the pad says
 * only `Nothing is signed until Set.` The shortcut and the input swap stand
 * in `Your vouch back`, the vouch-back pad's "?".
 */
export const FIRST_OPEN_LINE = "Nothing is signed until Set.";

export function StanceFirstOpenLine({ testId }: { testId: string }) {
  return (
    <p data-testid={testId} className="m-0 text-body-small text-on-surface-variant">
      {FIRST_OPEN_LINE}
    </p>
  );
}

/**
 * A help line that is more than words: the press-and-hold shortcut, whose
 * face is drawn and whose digits ride a `cg-exact` tail (VouchBackPad.md:17:
 * "the help's exact pair shows only when the reader has asked for exact
 * values, and its spoken twin says the face and the pair either way").
 */
export const PRESS_AND_HOLD = { kind: "pressAndHold" } as const;

/** One line of a pad's in-place help: words, or the press-and-hold line. */
export type PadHelpLine = string | typeof PRESS_AND_HOLD;

/** The press-and-hold line of `Your vouch back` (_shared.jsx `YOUR_VOUCH_BACK_HELP`). */
export function PressAndHoldLine() {
  return (
    <p className="m-0 text-body-small text-on-surface-variant">
      Later, tap the small face under a post to open this — press and hold it instead and a gentle{" "}
      <span aria-hidden="true">🙂</span>
      <span aria-hidden="true" className="cg-exact">
        {" (+0.10 / +0.10)"}
      </span>
      <span className="sr-only">Nice, For or against +0.10, How much reaches you +0.10,</span> is signed on the
      spot.
    </p>
  );
}

/** The input swap, the last line of `Your vouch back`. */
export const SWAP_THE_INPUT = "Prefer sliders or exact numbers? Swap the input in settings.";
