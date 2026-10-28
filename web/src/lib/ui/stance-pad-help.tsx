// What the open pad says about itself: the two coaching lines of the
// first-ever open, the four help lines its `?` opens, and the three lines an
// unreachable landing's 🤔 opens.
//
// THE PAD IS THE TEACHER (design/guidelines/stance-control.md "Teaching
// it"; copy-voice.md "The first-ever pad teaches in two coaching lines,
// and nothing else teaches it"). The tap that opens the pad costs
// nothing, so a reader finds the considered route on their own; what is
// left to teach is the shortcut. The lines ride the account's first-ever
// pad open, wherever that pad opens, close with it, and never show again.
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
  // `Your people`, a topic on `Your topics`; a post or a comment sits on no
  // list of the reader's, so its line stops at the opinion.
  const stays = targetLabel.startsWith("@")
    ? `${targetLabel} stays under Your people`
    : targetLabel.startsWith("#")
      ? `${targetLabel} stays on Your topics`
      : null;
  return [
    stays === null ? "It still counts among your opinions." : `It still counts among your opinions — ${stays}.`,
    "It shapes no one's feed, earns nothing, and nothing passes on through you.",
    `${severanceWords(axes).control} is different: its own act, confirmed and paid for, that leaves a clean slate.`,
  ];
}

/**
 * The first-ever open's two coaching lines (`VouchBackPad`). The face is
 * drawn and the digits ride a `cg-exact` tail that paints only for a reader
 * who asked for exact values; the spoken twin says the face and the pair
 * either way (VouchBackPad.md: "the coaching's exact pair shows only when the
 * reader has asked for exact values").
 */
export function StanceCoaching({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <p className="m-0 text-body-small text-on-surface-variant">
        Later, tap the small face under a post to open this — press and hold it instead and a
        gentle <span aria-hidden="true">🙂</span>
        <span aria-hidden="true" className="cg-exact">
          {" (+0.10 / +0.10)"}
        </span>
        <span className="sr-only">Nice, For or against +0.10, How much reaches you +0.10</span> is
        signed on the spot.
      </p>
      <p className="m-0 text-body-small text-on-surface-variant">
        Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.
      </p>
    </div>
  );
}
