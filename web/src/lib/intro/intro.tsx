"use client";

// THE INTRO — five full-screen cards (OnboardingSteps, OnboardingShape,
// OnboardingPublic, OnboardingLayers, OnboardingVouch; their sidecars in
// design/designs/canonical/behavior/). The frame is `_shared.jsx`'s
// `IntroFrame`: Skip · illustration · words · dots · the card's button.
//
// THE BUTTONS ARE THE MOVEMENT (each sidecar's "a swipe moves nothing"): Next
// opens the next card, Skip leaves from any card, and the last card's button
// reads `Start reading` and leaves where Skip leaves. The dots are an
// indicator, never a control, spoken `Step n of 5`.
//
// BACK WALKS THE CARDS BACK, and on the first card leaves the way Skip does
// (OnboardingSteps.md:25, OnboardingShape.md:21). Every card rides a history
// entry of its own — the wizard's documented pattern (`stage-history.ts`) —
// so the platform's back gesture lands on the card before, and the first card
// stands one entry above the page it opened over: a Back from there pops onto
// the page, which is the intro leaving, never the browser leaving the page.
//
// IT COVERS THE PAGE (no bottom bar, OnboardingSteps.md:9): a fixed layer over
// everything, announced as a covering layer so a clip under it stops
// (`covering-layer.tsx`).
//
// AT ANY WIDTH AND TEXT SIZE (each sidecar's last line; `_shared.jsx` "AT ANY
// WIDTH AND ANY TEXT SIZE"): the stage scales to the column as one picture,
// keeping its proportions, and the card scrolls between Skip and its button —
// both pinned at their edges — when its words outgrow the screen.

import { useLayoutEffect, useRef, useState } from "react";

import { useStageHistory } from "@/lib/compose/stage-history";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { nameInText } from "@/lib/ui/names";
import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { SCREEN_LAYER } from "@/lib/ui2/screen-layer";

import { INTRO_CARDS, INTRO_STEPS, stepWords } from "./intro-cards";
import { IntroIllustration, STAGE_SIZE, type IntroInviter } from "./intro-stages";

/** The registered prefix (nodes.json `OnboardingVouch`, `onboarding`). */
const NODE: DataNode = { path: "onboarding" };

/** The history entries the cards ride are marked with this surface. */
const SURFACE = "intro";

/** How the intro leaves: by Skip (or Back off the first card), or by `Start reading`. */
export type IntroExit = "skip" | "start";

function Dots({ step }: { step: number }) {
  return (
    <div
      {...testAttributes(part(NODE, "dots"))}
      className="flex items-center justify-center"
      style={{ gap: 8, padding: "20px 0 16px" }}
    >
      <span className="sr-only">{stepWords(step)}</span>
      {Array.from({ length: INTRO_STEPS }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          data-testid="intro-dot"
          data-current={index + 1 === step ? "true" : undefined}
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            background: index + 1 === step ? "var(--primary)" : "var(--border-field)",
          }}
        />
      ))}
    </div>
  );
}

/**
 * The stage, scaled to the column: the board's drawing size, multiplied by the
 * column's width over the board's 342, so every piece keeps its place.
 */
function ScaledStage({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    const measure = () => {
      const column = element.getBoundingClientRect().width;
      // A box not laid out yet (a test DOM) keeps the drawing's own size.
      setScale(column > 0 ? column / width : 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={box} style={{ width: "100%", height: height * scale }}>
      <div
        {...testAttributes(part(NODE, "stage"))}
        style={{
          position: "relative",
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Intro({
  inviter,
  onLeave,
}: {
  /** The reader's actual inviter — the fifth card's face and name. */
  inviter: IntroInviter | null;
  onLeave: (exit: IntroExit) => void;
}) {
  const [index, setIndex] = useState(0);
  const card = INTRO_CARDS[index] ?? INTRO_CARDS[0]!;
  const step = index + 1;
  const last = step === INTRO_STEPS;
  useCoversSurface(true, "suspend");

  useStageHistory({
    surface: SURFACE,
    level: step,
    onBack: () => {
      if (index === 0) onLeave("skip");
      else setIndex(index - 1);
    },
    onForward: () => setIndex((at) => Math.min(at + 1, INTRO_STEPS - 1)),
  });

  const advance = () => {
    if (last) onLeave("start");
    else setIndex(index + 1);
  };

  // The fifth card names the reader's own inviter; with no inviter on the
  // account there is no one for its line to name.
  const line = card.id === "vouch" && inviter === null ? null : card.line(inviter?.handle ?? "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      data-testid="intro"
      data-card={card.id}
      className={`${SCREEN_LAYER} z-50 flex flex-col bg-surface text-on-surface`}
    >
      <div className="flex flex-none justify-end" style={{ padding: "8px 12px 0" }}>
        <button
          type="button"
          {...testAttributes(part(NODE, "skip"))}
          className={buttonClassName({ variant: "text" })}
          onClick={() => onLeave("skip")}
        >
          Skip
        </button>
      </div>
      {/* Between Skip and the button, the stage and the words scroll. */}
      <div
        data-testid="intro-scroll"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain *:shrink-0"
      >
        <div className="flex flex-1 items-center justify-center" style={{ padding: "0 24px" }}>
          <ScaledStage key={card.id} {...STAGE_SIZE[card.id]}>
            <IntroIllustration card={card.id} inviter={inviter} node={part(NODE, "stage")} />
          </ScaledStage>
        </div>
        <div className="flex-none" style={{ padding: "0 24px" }}>
          <h1 id="intro-title" {...testAttributes(part(NODE, "title"))} className="m-0 text-headline-small">
            {card.headline}
          </h1>
          {line !== null && (
            <p
              {...testAttributes(part(NODE, "body"))}
              className="text-body-medium [overflow-wrap:anywhere]"
              style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}
            >
              {nameInText(line)}
            </p>
          )}
          <Dots step={step} />
        </div>
      </div>
      <div className="flex-none" style={{ padding: "0 24px 32px" }}>
        <button
          type="button"
          {...testAttributes(part(NODE, "next"))}
          className={`${buttonClassName({ variant: "primary" })} w-full`}
          onClick={advance}
        >
          {card.cta}
        </button>
      </div>
    </div>
  );
}
