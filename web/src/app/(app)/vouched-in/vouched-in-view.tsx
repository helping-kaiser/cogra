"use client";

// THE CEREMONY (`VouchedIn`; behavior/VouchedIn.md) — the vouch-back's own
// ending: the reader's opinion on the member who vouched them in is signed, the
// pair is complete, and the feed they see from here is their own. Android's
// twin is `feature/home`'s `VouchedInScreen`.
//
// It opens wherever the vouch-back's signing was taken — the vouch card's pad,
// or the voucher's profile anchor, by Set or by the hold (VouchedIn.md:3) — and
// shows while that opinion is signed and still settling (:5). A vouch-back that
// expires instead of landing raises only the ordinary did-not-land notice, and
// nothing special to this screen (:37).
//
// NO BACK ARROW AND NO BOTTOM BAR (:7): the shell draws its bar only on the
// read surfaces, and this route is not one. `Go to your feed` is the one way
// on (:9), and it REPLACES this entry, so the history holds no ceremony to
// come back to — and never the pad or the card behind it (:35).
//
// THE MOTION is the one declared exception to "nothing inside an arriving
// screen animates" (readme §4; `VouchedIn.jsx`), and it spends only existing
// tokens: every offset below is a sum of the durations the phases themselves
// run on. The sky stands from the first frame; only the reader's point, its
// halo, its edge and the words move (:13, :25). A tap anywhere completes every
// phase at once (:29), and a reader who asked for stillness gets the resting
// state whole (:31) — which is exactly what the board draws.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe } from "@/lib/api/auth-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { testAttributes } from "@/lib/ui/data-node";
import { PillButton } from "@/lib/ui2/pill-button";
import {
  CEREMONY_TITLE,
  ceremonyBody,
  GO_TO_YOUR_FEED,
  voucherOf,
  type Voucher,
} from "@/lib/vouch/vouch-back";

/**
 * The motion tokens the ceremony runs on, in milliseconds — `tokens-2.css`'s
 * own values (`ceremony-timeline.test.ts` pins them to the stylesheet), held
 * here because the phase OFFSETS are timers rather than CSS.
 */
export const CEREMONY_TOKENS = {
  navForward: 300, // --duration-nav-forward
  long2: 500, // --duration-long-2
  medium2: 300, // --duration-medium-2
  medium4: 400, // --duration-medium-4
} as const;

const T = CEREMONY_TOKENS;

/**
 * When each phase begins, measured from the screen's arrival — sums of the
 * durations, never a bespoke number (`VouchedIn.jsx` "THE MOTION").
 */
export const CEREMONY_TIMELINE = {
  point: T.navForward, // 300: the point fades in and rises
  halo: T.navForward + T.medium2, // 600: the halo opens
  edge: T.navForward + 2 * T.medium2, // 900: the edge draws
  words: T.navForward + T.medium2 + T.long2, // 1100: the words arrive
  landed: T.navForward + T.medium2 + T.long2 + T.medium4, // 1500: motion ends
} as const;

type Stage = "arriving" | "point" | "halo" | "edge" | "words" | "landed";

const SKY_W = 390;
const SKY_H = 560;
const VOUCHER_AT = { x: 240, y: 288, r: 16 };
const READER_AT = { x: 195, y: 516, r: 8 };
/** The reader's edge, from their point's rim out to the voucher's. */
const EDGE = { x1: 196.9, y1: 506.2, x2: 236.5, y2: 305.7 };
const EDGE_LENGTH = Math.hypot(EDGE.x2 - EDGE.x1, EDGE.y2 - EDGE.y1);

function prefersStillness(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const ORDER: readonly Stage[] = ["arriving", "point", "halo", "edge", "words", "landed"];
const reached = (stage: Stage, at: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(at);

export function VouchedInView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [stage, setStage] = useState<Stage>(() => (prefersStillness() ? "landed" : "arriving"));
  // Skipped or still: the resting state stands with no transition at all.
  const [still, setStill] = useState(() => prefersStillness());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The press that completes the motion is not also a press on the button.
  const swallowClick = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void guard.run(() => fetchMe(client)).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      setVoucher(voucherOf(outcome.value));
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard]);

  // The timeline starts once there is a sky to run it over.
  useEffect(() => {
    if (voucher === null || still) return;
    const at: [Stage, number][] = [
      ["point", CEREMONY_TIMELINE.point],
      ["halo", CEREMONY_TIMELINE.halo],
      ["edge", CEREMONY_TIMELINE.edge],
      ["words", CEREMONY_TIMELINE.words],
      ["landed", CEREMONY_TIMELINE.landed],
    ];
    timers.current = at.map(([next, ms]) => setTimeout(() => setStage(next), ms));
    return () => timers.current.forEach(clearTimeout);
  }, [voucher, still]);

  if (voucher === null) return null;

  const completeAtOnce = () => {
    // A fresh press on the resting screen is an ordinary press.
    swallowClick.current = stage !== "landed";
    if (stage === "landed") return;
    timers.current.forEach(clearTimeout);
    setStill(true);
    setStage("landed");
  };
  const landed = stage === "landed";
  const motion = (property: string, duration: string, easing: string) =>
    still ? "none" : `${property} var(${duration}) var(${easing})`;

  const pointIn = reached(stage, "point");
  const haloOpen = reached(stage, "halo");
  const edgeDrawn = reached(stage, "edge");
  const wordsIn = reached(stage, "words");

  return (
    <main
      data-testid="vouchedIn"
      data-stage={stage}
      // A tap anywhere while the motion runs completes it (VouchedIn.md:29).
      onPointerDown={completeAtOnce}
      className="cg-nav-in flex min-h-dvh flex-1 flex-col overflow-hidden"
    >
      <div
        {...testAttributes({ path: "vouchedIn.sky" })}
        className="relative mx-auto flex-none"
        style={{ width: SKY_W, height: SKY_H }}
      >
        <svg
          viewBox={`0 0 ${SKY_W} ${SKY_H}`}
          width={SKY_W}
          height={SKY_H}
          aria-hidden="true"
          className="block"
        >
          {/* The network was there before the reader arrived: it stands from
              the first frame and never builds (VouchedIn.md:13). */}
          <g stroke="var(--outline-variant)" strokeWidth={1} fill="none">
            <line x1="52" y1="136" x2="110" y2="78" />
            <line x1="110" y1="78" x2="206" y2="142" />
            <line x1="206" y1="142" x2="300" y2="132" />
            <line x1="300" y1="132" x2="348" y2="222" />
            <line x1="150" y1="212" x2="206" y2="142" />
            <line x1="84" y1="286" x2="150" y2="212" />
            <line x1="330" y1="344" x2="348" y2="222" />
            <line x1="150" y1="212" x2="176" y2="330" />
            <line x1="120" y1="378" x2="84" y2="286" />
            <line x1="206" y1="142" x2="236.1" y2="271.4" />
            <line x1="254.4" y1="297.0" x2="330" y2="344" />
            <line x1="225.8" y1="297.3" x2="176" y2="330" />
          </g>
          <circle cx="110" cy="78" r="3" fill="var(--outline)" />
          <circle cx="262" cy="64" r="3" fill="var(--outline)" />
          <circle cx="52" cy="136" r="4" fill="var(--outline)" />
          <circle cx="300" cy="132" r="7" fill="var(--primary-container)" />
          <circle cx="206" cy="142" r="5" fill="var(--outline)" />
          <circle cx="150" cy="212" r="6" fill="var(--primary-container)" />
          <circle cx="62" cy="216" r="3" fill="var(--outline)" />
          <circle cx="348" cy="222" r="4" fill="var(--outline)" />
          <circle cx="84" cy="286" r="5" fill="var(--outline)" />
          <circle cx="176" cy="330" r="3" fill="var(--outline)" />
          <circle cx="330" cy="344" r="5" fill="var(--outline)" />
          <circle cx="120" cy="378" r="4" fill="var(--outline)" />
          <circle cx="38" cy="392" r="3" fill="var(--outline)" />
          <circle cx="286" cy="430" r="3" fill="var(--outline)" />

          {/* The reader's edge draws from their point out to the voucher's
              rim — outward, because only viewer-rooted paths shape a feed. */}
          <line
            data-testid="vouchedIn-edge"
            x1={EDGE.x1}
            y1={EDGE.y1}
            x2={EDGE.x2}
            y2={EDGE.y2}
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={EDGE_LENGTH}
            style={{
              strokeDashoffset: edgeDrawn ? 0 : EDGE_LENGTH,
              transition: motion("stroke-dashoffset", "--duration-long-2", "--ease-standard"),
            }}
          />
          {/* The halo opens from the point's radius to twice it, and stays. */}
          <circle
            data-testid="vouchedIn-halo"
            cx={READER_AT.x}
            cy={READER_AT.y}
            fill="none"
            stroke="color-mix(in srgb, var(--primary) 40%, transparent)"
            strokeWidth={1}
            style={{
              r: haloOpen ? READER_AT.r * 2 : READER_AT.r,
              opacity: pointIn ? 1 : 0,
              transition: motion("r", "--duration-medium-2", "--ease-standard-decelerate"),
            }}
          />
          {/* The reader's point fades in and rises 24px — no scale, no spring. */}
          <circle
            data-testid="vouchedIn-point"
            cx={READER_AT.x}
            cy={READER_AT.y}
            r={READER_AT.r}
            fill="var(--primary)"
            style={{
              opacity: pointIn ? 1 : 0,
              transform: pointIn ? "translateY(0)" : "translateY(24px)",
              transition: still
                ? "none"
                : "opacity var(--duration-long-2) var(--ease-emphasized-decelerate), transform var(--duration-long-2) var(--ease-emphasized-decelerate)",
            }}
          />
        </svg>
        {/* The voucher carries their actual face — the only identified point. */}
        <div
          className="absolute"
          style={{ left: VOUCHER_AT.x - VOUCHER_AT.r, top: VOUCHER_AT.y - VOUCHER_AT.r }}
        >
          <MonogramAvatar
            name={voucher.name}
            src={voucher.avatarUrl}
            size={VOUCHER_AT.r * 2}
            testId="vouchedIn-voucher"
          />
        </div>
      </div>
      <div
        data-testid="vouchedIn-words"
        className="flex flex-1 flex-col items-center justify-center px-6 pb-8"
        style={{
          opacity: wordsIn ? 1 : 0,
          transform: wordsIn ? "translateY(0)" : "translateY(8px)",
          transition: still
            ? "none"
            : "opacity var(--duration-medium-4) var(--ease-standard-decelerate), transform var(--duration-medium-4) var(--ease-standard-decelerate)",
        }}
      >
        <h1
          {...testAttributes({ path: "vouchedIn.title" })}
          className="m-0 text-center text-headline-small"
        >
          {CEREMONY_TITLE}
        </h1>
        <p
          {...testAttributes({ path: "vouchedIn.body" })}
          className="m-0 mt-2 max-w-[300px] text-center text-body-medium text-on-surface-variant"
        >
          {ceremonyBody(voucher.handle)}
        </p>
        <div className="mt-8">
          <PillButton
            testId="vouchedIn-onward"
            node={{ path: "vouchedIn.onward" }}
            // No press until the words have landed (VouchedIn.md:27).
            onClick={() => {
              if (swallowClick.current) {
                swallowClick.current = false;
                return;
              }
              if (!landed) return;
              router.replace("/feed");
            }}
          >
            {GO_TO_YOUR_FEED}
          </PillButton>
        </div>
      </div>
    </main>
  );
}
