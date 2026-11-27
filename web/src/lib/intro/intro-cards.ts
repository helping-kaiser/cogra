// THE INTRO'S FIVE CARDS, IN THEIR DRAWN ORDER (the boards' own `step`):
// OnboardingSteps 1, OnboardingShape 2, OnboardingPublic 3, OnboardingLayers
// 4, OnboardingVouch 5 (design/designs/canonical/screens/Onboarding*.jsx).
// Every word here is the board's, verbatim; the fifth card's handle is the
// reader's actual inviter, filled at run time (OnboardingVouch.md:9).

/** How many cards the intro has — the dots' count and the last step. */
export const INTRO_STEPS = 5;

/** The board each card is drawn on. */
export type IntroCardId = "steps" | "shape" | "public" | "layers" | "vouch";

export type IntroCard = {
  readonly id: IntroCardId;
  readonly headline: string;
  /** The card's one line under its headline. */
  readonly line: (inviterHandle: string) => string;
  /** The card's button: `Next`, and `Start reading` on the last card. */
  readonly cta: string;
};

export const INTRO_CARDS: readonly IntroCard[] = [
  {
    id: "steps",
    headline: "Your feed follows your own steps",
    line: () =>
      "Nothing is picked for you. What reaches you comes along the connections you made, one step at a time.",
    cta: "Next",
  },
  {
    id: "shape",
    headline: "Your opinions have a shape",
    line: () =>
      "Give one with the pad: how much you are for it, and how much of it you want reaching you.",
    cta: "Next",
  },
  {
    id: "public",
    headline: "Everything here is public",
    line: () =>
      "Posts, comments, opinions — and chats. Anything written on CoGra can be read, and cited, by anyone.",
    cta: "Next",
  },
  {
    id: "layers",
    headline: "Nothing is lost",
    line: () =>
      "Posts and comments keep every layer they were built from. Pictures added, words changed — the whole history stays readable.",
    cta: "Next",
  },
  {
    id: "vouch",
    headline: "Someone brings you in",
    line: (inviter) =>
      `You are here because @${inviter} invited you. @${inviter}'s link is your first way in to everyone else, and theirs to you.`,
    cta: "Start reading",
  },
];

/** The dots' spoken words: `Step 2 of 5` (OnboardingShape.md:11). */
export function stepWords(step: number): string {
  return `Step ${step} of ${INTRO_STEPS}`;
}
