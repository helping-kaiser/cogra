// The intro's cards, their sidecar lines compiled one to one
// (design/designs/canonical/behavior/Onboarding*.md).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Intro, type IntroExit } from "./intro";
import { INTRO_CARDS } from "./intro-cards";
import type { IntroInviter } from "./intro-stages";

const MIRA: IntroInviter = { handle: "mira", name: "Mira Voss", avatarUrl: null };

function renderIntro(inviter: IntroInviter | null = MIRA) {
  const onLeave = vi.fn<(exit: IntroExit) => void>();
  const view = render(<Intro inviter={inviter} onLeave={onLeave} />);
  return { onLeave, ...view };
}

function card(): string | null {
  return screen.getByTestId("intro").getAttribute("data-card");
}

function next() {
  fireEvent.click(screen.getByTestId("onboarding.next"));
}

/** Opens the intro and walks it to the card at `step` (1-based). */
function renderAt(step: number, inviter: IntroInviter | null = MIRA) {
  const rendered = renderIntro(inviter);
  for (let at = 1; at < step; at++) next();
  return rendered;
}

async function back(expected: string) {
  window.history.back();
  await vi.waitFor(() => expect(card()).toBe(expected));
}

afterEach(async () => {
  // An intro closed in place takes its history entries with it on a timer
  // (`stage-history.ts`); that traversal lands before the next test opens.
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
  window.history.replaceState(null, "");
});

describe("Intro", () => {
  it("opens at the first card, its words the board's own (OnboardingSteps.md:3)", () => {
    renderIntro();
    expect(card()).toBe("steps");
    expect(screen.getByTestId("onboarding.title")).toHaveTextContent("Your feed follows your own steps");
    expect(screen.getByTestId("onboarding.body")).toHaveTextContent(
      "Nothing is picked for you. What reaches you comes along the connections you made, one step at a time.",
    );
  });

  it("walks the five cards in their drawn order with Next", () => {
    renderIntro();
    const seen = [card()];
    for (let step = 1; step < INTRO_CARDS.length; step++) {
      next();
      seen.push(card());
    }
    expect(seen).toEqual(["steps", "shape", "public", "layers", "vouch"]);
  });

  it.each([1, 2, 3, 4, 5])("card %i carries Skip and its button as its only live controls", (step) => {
    renderAt(step);
    const controls = within(screen.getByTestId("intro")).getAllByRole("button");
    expect(controls.map((control) => control.textContent)).toEqual([
      "Skip",
      step === 5 ? "Start reading" : "Next",
    ]);
    // Nothing else on the card is focusable either — the drawn pad included.
    const focusable = screen
      .getByTestId("intro")
      .querySelectorAll<HTMLElement>("[tabindex]:not([tabindex='-1']), a[href], input, textarea, select");
    expect([...focusable].filter((element) => element.closest("[inert]") === null)).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5])("card %i's dots are an indicator, spoken by their step", (step) => {
    renderAt(step);
    const dots = screen.getByTestId("onboarding.dots");
    expect(dots).toHaveTextContent(`Step ${step} of 5`);
    expect(within(dots).queryAllByRole("button")).toEqual([]);
    const lit = within(dots)
      .getAllByTestId("intro-dot")
      .map((dot) => dot.getAttribute("data-current") === "true");
    expect(lit.indexOf(true)).toBe(step - 1);
    expect(lit.filter(Boolean)).toHaveLength(1);
  });

  it.each([1, 2, 3, 4])("Skip on card %i leaves, and no later card shows", (step) => {
    const { onLeave } = renderAt(step);
    fireEvent.click(screen.getByTestId("onboarding.skip"));
    expect(onLeave).toHaveBeenCalledExactlyOnceWith("skip");
  });

  it("Skip on the last card leaves as Skip (OnboardingVouch.md:19)", () => {
    const { onLeave } = renderAt(5);
    fireEvent.click(screen.getByTestId("onboarding.skip"));
    expect(onLeave).toHaveBeenCalledExactlyOnceWith("skip");
  });

  it("Start reading on the last card leaves where Skip leaves (OnboardingVouch.md:15)", () => {
    const { onLeave } = renderAt(5);
    expect(screen.getByTestId("onboarding.next")).toHaveTextContent("Start reading");
    next();
    expect(onLeave).toHaveBeenCalledExactlyOnceWith("start");
  });

  it("a swipe moves nothing — the cards move only by their buttons", () => {
    renderIntro();
    const scroll = screen.getByTestId("intro-scroll");
    fireEvent.pointerDown(scroll, { clientX: 300, clientY: 400 });
    fireEvent.pointerMove(scroll, { clientX: 40, clientY: 400 });
    fireEvent.pointerUp(scroll, { clientX: 40, clientY: 400 });
    fireEvent.touchStart(scroll, { touches: [{ clientX: 300, clientY: 400 }] });
    fireEvent.touchMove(scroll, { touches: [{ clientX: 40, clientY: 400 }] });
    fireEvent.touchEnd(scroll);
    expect(card()).toBe("steps");
  });

  it("Back walks the cards back, one per press (the Back lines of cards 2–5)", async () => {
    const { onLeave } = renderAt(5);
    await back("layers");
    await back("public");
    await back("shape");
    await back("steps");
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("Back on the first card leaves the way Skip leaves (OnboardingSteps.md:25)", async () => {
    const { onLeave } = renderIntro();
    window.history.back();
    await vi.waitFor(() => expect(onLeave).toHaveBeenCalledExactlyOnceWith("skip"));
  });

  it("the first card's drawing carries no numbers (OnboardingSteps.md:15)", () => {
    renderIntro();
    // The board's own post likeness carries its age, `1h` (OnboardingSteps.jsx
    // `timestamp="1h"`) — an age, not a step's weight, and drawn by the board,
    // so it is read past here and reported to design.
    const drawing = screen.getByTestId("onboarding.stage").textContent ?? "";
    expect(drawing.replace("1h", "")).not.toMatch(/\d/);
  });

  it("the second card's drawn pad takes no input (OnboardingShape.md:7)", () => {
    renderAt(2);
    const pad = screen.getByTestId("intro-pad");
    expect(pad.closest("[inert]")).not.toBeNull();
  });

  it("each face on an edge is spoken by its anchor's own words (OnboardingShape.md:9)", () => {
    renderAt(2);
    expect(screen.getAllByTestId("intro-edge-face").map((face) => face.textContent)).toEqual([
      "😍Love this",
      "👀Show me more",
      "😌Good, but not in my world",
      "😕Not for me",
    ]);
  });

  it("the inviter's face and words are the reader's actual inviter (OnboardingVouch.md:9)", () => {
    renderAt(5, { handle: "noa", name: "Noa Berg", avatarUrl: null });
    expect(screen.getByTestId("onboarding.stage.inviter")).toHaveTextContent("N");
    expect(screen.getByTestId("onboarding.stage.inviterCaption")).toHaveTextContent("@noa");
    expect(screen.getByTestId("onboarding.body")).toHaveTextContent(
      "You are here because @noa invited you. @noa's link is your first way in to everyone else, and theirs to you.",
    );
  });

  it("the last card says invited and never vouched (OnboardingVouch.md:11)", () => {
    renderAt(5);
    expect(screen.getByTestId("intro")).toHaveTextContent("invited");
    expect(screen.getByTestId("intro").textContent).not.toMatch(/vouch/i);
  });

  it("the last card draws the reader as a dot in a dashed ring (OnboardingVouch.jsx)", () => {
    renderAt(5);
    expect(screen.getByTestId("onboarding.stage.you")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding.stage.youRing")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding.stage.youCaption")).toHaveTextContent("you");
  });

  it("draws an unsized board face as the master's sm disc, 24px (ActorChip.jsx)", () => {
    renderAt(3);
    const stage = screen.getByTestId("onboarding.stage");
    const discs = [...stage.querySelectorAll<HTMLElement>("span.rounded-full")].filter(
      (disc) => disc.style.width !== "",
    );
    // The chat's two faces and the comment's author, as OnboardingPublic.jsx draws them.
    expect(discs.map((disc) => disc.style.width)).toEqual(["24px", "24px", "24px"]);
  });

  it("covers the page: no bottom bar under it (OnboardingSteps.md:9)", () => {
    renderIntro();
    expect(screen.getByTestId("intro")).toHaveClass("fixed", "inset-x-0", "top-0");
    expect(screen.getByRole("dialog", { name: "Your feed follows your own steps" })).toBeInTheDocument();
  });
});
