// What the open pad says about itself: the two coaching lines of the
// first-ever open, and the four help lines its `?` opens.
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
// while it shows"). The words are copy-voice.md's "The pad's four help
// lines", verbatim; the fourth names the record family's own way out
// (`StanceReadout.jsx`'s `padHelp`), so a topic's ends on Disconnect.

const STANCE_PAD_HELP = [
  "Drag the knob. Left to right is against to for; bottom to top is how much more of it you want reaching you.",
  "Letting go changes nothing. Set signs it, Cancel leaves without signing.",
  "Your pick adds to what you've said before — that's why the two faces can differ.",
] as const;

const WALK_BACK_HELP =
  "Walk it back takes everything you've said to nothing. It has its own confirmation, and each thing you've said is walked back by its own signature.";

/** The topic family's way out (`_shared.jsx`'s topic axes, copy-voice.md). */
const DISCONNECT_HELP =
  "Disconnect takes everything you've said about the topic to nothing. It has its own confirmation, and each thing you've said is cleared by its own signature.";

/** The pad's four help lines, the last one the family's own. */
export function padHelp(isTopic: boolean): readonly string[] {
  return [...STANCE_PAD_HELP, isTopic ? DISCONNECT_HELP : WALK_BACK_HELP];
}

/**
 * The first-ever open's two coaching lines (`VouchBackPad`). The face is
 * drawn and the digits are not: the coaching's exact pair shows only for
 * a reader who asked for exact values, and its spoken twin says the face
 * and the pair either way.
 */
export function StanceCoaching({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <p className="text-body-small text-on-surface-variant">
        Later, tap the small face under a post to open this — press and hold it instead and a
        gentle <span aria-hidden="true">🙂</span>
        <span className="sr-only">Nice, For or against +0.10, How much reaches you +0.10</span> is
        signed on the spot.
      </p>
      <p className="text-body-small text-on-surface-variant">
        Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.
      </p>
    </div>
  );
}
