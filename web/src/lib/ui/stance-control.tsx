"use client";

// CoGra's signature interaction (design.md §8), on the web.
//
// The gesture (§8.3): a single tap target at rest; a plain tap commits
// the modest positive default; press and hold and a soft circular pad
// blooms, opening AT THE ORIGIN — the low default belongs to the tap, not
// to the considered gesture. Drift to position, release to commit.
//
// What it writes (§8.1): exactly the pair picked. There is no delta in
// this file. Current standing and where a pick lands the bundle are both
// READS, rendered beside the pick and never folded into it.
//
// What it never does (§8.2): prevent a choice. The whole square is
// reachable, corners included. A pick that nets the bundle to (0, 0) is
// confirmed rather than refused, through the same dialog the explicit
// severance gesture uses.
//
// Pointer Events carry mouse, touch, and pen through one set of handlers
// — the platform's own unification, so there is no second touch path to
// keep in sync. `touch-action: none` is what stops the browser from
// claiming the drag as a scroll, and pointer capture is what keeps the
// events coming after the finger leaves the button it started on.

import { useCallback, useEffect, useRef, useState } from "react";

import { useStanceInputMode } from "@/lib/stance/input-mode";
import { nearestAnchor } from "@/lib/stance/anchors";
import { isSevered, ORIGIN, TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { padPairAt, padPercentOf } from "@/lib/stance/pad-geometry";
import { useStanceData } from "@/lib/stance/provider";
import type { StanceBundle, StanceTargetRef } from "@/lib/stance/stance-data";
import { useAuthPhase } from "@/lib/session/provider";
import { buttonClassName } from "@/lib/ui/button";
import { AddIcon } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { SeveranceConfirm, type SeveranceKind } from "@/lib/ui/severance-confirm";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { StanceReadout, type BundleState } from "@/lib/ui/stance-readout";
import { TransportError } from "@/lib/ui/transport-error";

/**
 * How long a press has to be held before the pad blooms. Android's own
 * platform long-press timeout, so the two clients ask the same thing of
 * the same thumb; the Android pad adopts this number rather than a second
 * one.
 */
export const LONG_PRESS_MS = 500;

/**
 * How long the pick has to settle before its landing is read. The
 * projection is a backend fold, so it cannot ride every pointer move; a
 * short settle keeps it one read per pause instead of one per pixel.
 */
export const PROJECTION_SETTLE_MS = 150;

type Confirming = { kind: SeveranceKind; records: number; pick: StancePair | null };

export function StanceControl({
  target,
  bundle: suppliedBundle,
  testIdPrefix,
}: {
  target: StanceTargetRef;
  /**
   * The standing the hosting read already carried. §8.2 counts on that —
   * "the bundle is already loaded by the read that rendered the thing
   * being rated" — so a surface that has it passes it down. Left out, the
   * control reads it through the seam instead.
   */
  bundle?: StanceBundle | null;
  testIdPrefix: string;
}) {
  const data = useStanceData();
  const phase = useAuthPhase();
  const [mode] = useStanceInputMode();

  const [fetched, setFetched] = useState<BundleState>(undefined);
  const bundle: BundleState = suppliedBundle === undefined ? fetched : suppliedBundle;

  const [open, setOpen] = useState(false);
  const [alternates, setAlternates] = useState(false);
  const [pick, setPick] = useState<StancePair>(ORIGIN);
  const [projection, setProjection] = useState<StancePair | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [joinPrompt, setJoinPrompt] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const capturedPointer = useRef<number | null>(null);

  const considered = open || alternates;

  const readBundle = useCallback(() => {
    if (suppliedBundle !== undefined || phase !== "signedIn") return;
    let cancelled = false;
    void data.bundle(target.id).then((outcome) => {
      if (cancelled) return;
      // A failed standing read leaves the control usable: it degrades to
      // "no standing known" rather than blanking the affordance.
      setFetched(outcome.kind === "success" ? outcome.value : null);
    });
    return () => {
      cancelled = true;
    };
  }, [data, phase, suppliedBundle, target.id]);

  useEffect(() => readBundle(), [readBundle]);

  // The landing is read once the pick settles, and only while a
  // considered gesture is open — a resting control asks nothing.
  useEffect(() => {
    if (!considered) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void data.project(target.id, pick).then((outcome) => {
        if (cancelled) return;
        setProjection(outcome.kind === "success" ? outcome.value : null);
      });
    }, PROJECTION_SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [considered, data, pick, target.id]);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const releasePointer = useCallback(() => {
    const button = buttonRef.current;
    const pointerId = capturedPointer.current;
    capturedPointer.current = null;
    if (button === null || pointerId === null) return;
    if (typeof button.releasePointerCapture === "function" && button.hasPointerCapture?.(pointerId)) {
      button.releasePointerCapture(pointerId);
    }
  }, []);

  // Escape cancels the open pad. The pad is a pointer surface that takes
  // no focus of its own, so the listener sits on the document rather than
  // on a node the key would never reach.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      releasePointer();
      setOpen(false);
      setProjection(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, releasePointer]);

  const closeAll = () => {
    releasePointer();
    clearHold();
    setOpen(false);
    setAlternates(false);
    setProjection(null);
  };

  const commit = async (chosen: StancePair) => {
    setBusy(true);
    setFailed(false);
    const outcome = await data.commit(target.id, chosen);
    setBusy(false);
    if (outcome.kind === "success") {
      setSigned(outcome.value.records);
      readBundle();
    } else {
      setFailed(true);
    }
  };

  const sever = async () => {
    setBusy(true);
    setFailed(false);
    const outcome = await data.sever(target.id);
    setBusy(false);
    if (outcome.kind === "success") {
      setSigned(outcome.value.records);
      readBundle();
    } else {
      setFailed(true);
    }
  };

  /**
   * Every commit route lands here: read where the pick puts the bundle,
   * and if that is `(0, 0)` say so and ask, rather than refusing (§8.2).
   */
  const commitChecked = async (chosen: StancePair) => {
    setSigned(null);
    setFailed(false);
    const landed = await data.project(target.id, chosen);
    if (landed.kind !== "success") {
      setFailed(true);
      return;
    }
    closeAll();
    if (isSevered(landed.value)) {
      setConfirming({ kind: "landsAtZero", records: 1, pick: chosen });
      return;
    }
    await commit(chosen);
  };

  const onTap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (phase !== "signedIn") {
      setJoinPrompt(true);
      return;
    }
    void commitChecked(TAP_DEFAULT);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== "signedIn" || busy) return;
    const pointerId = event.pointerId;
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setPick(ORIGIN);
      setProjection(null);
      setSigned(null);
      if (mode === "pad") {
        setOpen(true);
        const button = buttonRef.current;
        if (button !== null && typeof button.setPointerCapture === "function") {
          button.setPointerCapture(pointerId);
          capturedPointer.current = pointerId;
        }
      } else {
        // The alternate replaces the pad everywhere (§8.6), the hold
        // gesture included.
        setAlternates(true);
      }
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!open) return;
    const pad = padRef.current;
    if (pad === null) return;
    setPick(padPairAt(pad.getBoundingClientRect(), event.clientX, event.clientY));
  };

  const onPointerUp = () => {
    clearHold();
    if (!open) return;
    releasePointer();
    void commitChecked(pick);
  };

  const onPointerCancel = () => {
    clearHold();
    if (open) closeAll();
  };

  const restingFace = bundle === null || bundle === undefined ? null : nearestAnchor(bundle.current);
  const knob = padPercentOf(pick);
  const severable = bundle !== null && bundle !== undefined && bundle.severance.records > 0;

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* 48px minimum, including at rest (design.md §4). */}
        <button
          ref={buttonRef}
          type="button"
          data-testid={testIdPrefix}
          aria-label={
            restingFace === null
              ? `Take a stance on ${target.label}`
              : `Your stance on ${target.label}: ${restingFace.label}. Tap to add a positive one.`
          }
          disabled={busy}
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="flex min-h-12 min-w-12 touch-none items-center justify-center gap-2 rounded-full px-3 text-label-large text-primary"
        >
          {restingFace === null ? (
            <AddIcon className="h-5 w-5" />
          ) : (
            <span aria-hidden="true" className="text-title-large">
              {restingFace.emoji}
            </span>
          )}
          {/* Colour never carries stance alone: the words say it too
              (design.md §10). */}
          <span>{restingFace === null ? "Stance" : restingFace.label}</span>
        </button>
        {/* The non-drag equivalent, present whatever the stored input is
            (design.md §8.6, §10) — a drag gesture always has one. */}
        {phase === "signedIn" && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-choose`}
            disabled={busy}
            onClick={() => {
              setPick(ORIGIN);
              setProjection(null);
              setSigned(null);
              setAlternates(true);
            }}
            className={buttonClassName({ variant: "text", size: "sm" })}
          >
            Choose values
          </button>
        )}
      </div>

      {open && (
        <div
          role="group"
          aria-label={`Stance pad for ${target.label}`}
          data-testid={`${testIdPrefix}-pad`}
          className="absolute bottom-full left-0 z-10 mb-2 flex w-64 flex-col gap-2 rounded-extra-large bg-surface-container-high p-4"
        >
          {/* Above the pad, never under the knob (§8.4). */}
          <StanceReadout
            pick={pick}
            bundle={bundle}
            projection={projection}
            targetLabel={target.label}
            testIdPrefix={testIdPrefix}
          />
          <div
            ref={padRef}
            data-testid={`${testIdPrefix}-field`}
            className="relative aspect-square w-full touch-none rounded-full bg-surface-container-highest"
          >
            {/* The inert centre-lines are drawn as visibly dead ground
                rather than hidden, so the model reads as legible rather
                than mysterious (§8.3). */}
            <div
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-px w-full bg-outline-variant"
            />
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 h-full w-px bg-outline-variant"
            />
            {/* primaryContainer is the loudest surface in the app and
                belongs to a committed stance (§2.4). */}
            <div
              aria-hidden="true"
              data-testid={`${testIdPrefix}-knob`}
              style={{ left: `${knob.x}%`, top: `${knob.y}%` }}
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container"
            />
          </div>
          {severable && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-sever`}
              onClick={() => {
                closeAll();
                setConfirming({ kind: "sever", records: bundle.severance.records, pick: null });
              }}
              className={buttonClassName({ variant: "text", size: "sm" })}
            >
              Cut it off
            </button>
          )}
        </div>
      )}

      {alternates && (
        <StanceAlternates
          mode={mode}
          pick={pick}
          onPick={setPick}
          busy={busy}
          onCommit={() => void commitChecked(pick)}
          onCancel={closeAll}
          onSever={
            severable
              ? () => {
                  closeAll();
                  setConfirming({ kind: "sever", records: bundle.severance.records, pick: null });
                }
              : undefined
          }
        >
          <StanceReadout
            pick={pick}
            bundle={bundle}
            projection={projection}
            targetLabel={target.label}
            showExact
            testIdPrefix={testIdPrefix}
          />
        </StanceAlternates>
      )}

      {confirming !== null && (
        <SeveranceConfirm
          kind={confirming.kind}
          targetLabel={target.label}
          records={confirming.records}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const pending = confirming;
            setConfirming(null);
            void (pending.pick === null ? sever() : commit(pending.pick));
          }}
        />
      )}

      {signed !== null && (
        <p role="status" data-testid={`${testIdPrefix}-signed`} className="text-body-small text-success">
          {signed === 1 ? "Signed — still settling." : `Signed ${signed} steps — still settling.`}
        </p>
      )}
      {/* A failed write is a composer error beside its control, never a
          read fault (web.md "Design guidelines"). */}
      {failed && <TransportError testId={`${testIdPrefix}-error`} message="That didn't send. Try again." />}

      {/* Mounted only when asked for: a read surface renders many of
          these controls, and an always-present dialog per card is a
          dialog per card in the DOM. */}
      {joinPrompt && <JoinPrompt open onClose={() => setJoinPrompt(false)} />}
    </div>
  );
}
