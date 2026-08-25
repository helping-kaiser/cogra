"use client";

// CoGra's signature interaction (design.md §8), on the web.
//
// AT REST (§8.3) the target shows the standing: a viewer with a bundle
// toward the thing sees its face, its words, and its folded pair on the
// target itself; a viewer without one sees the labelled affordance. The
// bundle is already loaded by the read that rendered the surface (§8.2),
// so showing it costs nothing and is the difference between a control
// and a mystery button.
//
// THE FIRST TAP EVER TEACHES (§8.7) and stages nothing: it opens the
// coach mark and records that the gesture has been met. Every tap after
// that acts, committing the modest positive default verbatim.
//
// A TAP ANSWERS IMMEDIATELY (§8.3). The resting target moves to the
// pending-inclusive fold the moment the projection comes back — that
// number is the backend's, never arithmetic done here — and a snackbar
// confirms the signature. A gesture that stages a priced act must never
// be silent: silence reads as failure and invites the same act again.
//
// PRESS AND HOLD and the pad blooms, anchored to the target rather than
// under the press, clamped inside the viewport, opening AT THE ORIGIN.
// The pick is the accumulated travel from where the thumb went down, so
// the finger's absolute position never matters, and the drawn field is
// the value space — the knob never leaves it (`pad-geometry.ts`).
//
// What it writes (§8.1): exactly the pair picked. There is no delta in
// this file. Current standing and where a pick lands the bundle are both
// READS, rendered around the field and never folded into it. Whether a
// landing carries nothing is the fold's own flag, never a comparison
// made here.
//
// What it never does (§8.2): prevent a choice. The whole square is
// reachable, corners included. A pick that nets the bundle to (0, 0) is
// confirmed rather than refused, through the same dialog the explicit
// severance gesture uses.
//
// Pointer Events carry mouse, touch, and pen through one set of handlers
// — the platform's own unification, so there is no second touch path to
// keep in sync. `touch-action: none` is what stops the browser from
// claiming the drag as a scroll, pointer capture is what keeps the
// events coming after the finger leaves the button it started on, and
// suppressing the callout is what stops a long press from becoming a
// context menu instead of a gesture.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStanceInputMode } from "@/lib/stance/input-mode";
import { nearestAnchor } from "@/lib/stance/anchors";
import { ORIGIN, TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { KNOB_TRAVEL_INSET_PX, padPairFromTravel, padPercentOf } from "@/lib/stance/pad-geometry";
import { useStanceData } from "@/lib/stance/provider";
import { useStanceTaught } from "@/lib/stance/stance-coach";
import type { StanceBundle, StanceLanding, StanceTargetRef } from "@/lib/stance/stance-data";
import { useAuthPhase } from "@/lib/session/provider";
import { buttonClassName } from "@/lib/ui/button";
import { AddIcon } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { StanceCoachMark } from "@/lib/ui/stance-coach-mark";
import { formatStancePair } from "@/lib/ui/stance-format";
import { StanceLandingLine, StanceStanding, type BundleState } from "@/lib/ui/stance-readout";
import { TransportError } from "@/lib/ui/transport-error";
import { anchoredStyle, useAnchoredPlacement } from "@/lib/ui/use-anchored";

/**
 * How long a press has to be held before the pad blooms. Android's own
 * platform long-press timeout, so the two clients ask the same thing of
 * the same thumb.
 */
export const LONG_PRESS_MS = 500;

/**
 * How long the pick has to settle before its landing is read. The
 * projection is a backend fold, so it cannot ride every pointer move; a
 * short settle keeps it one read per pause instead of one per pixel. The
 * landing line says it is still working the gap out.
 */
export const PROJECTION_SETTLE_MS = 150;

/** An open severance confirmation. A null pick is the explicit gesture. */
type Confirming = {
  pick: StancePair | null;
  records: number;
  alreadySevered: boolean;
};

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
  const [taught, teach] = useStanceTaught();

  /**
   * The control's own read, once it has one. Wrapped rather than bare so
   * "not read yet" stays distinct from "read, and there is no standing"
   * — and so a control that re-reads after its own write outranks the
   * copy its host read before that write.
   */
  const [own, setOwn] = useState<{ value: BundleState } | null>(null);
  const bundle: BundleState = own !== null ? own.value : suppliedBundle;

  const [open, setOpen] = useState(false);
  const [alternates, setAlternates] = useState(false);
  const [coach, setCoach] = useState(false);
  const [pick, setPick] = useState<StancePair>(ORIGIN);
  const [landing, setLanding] = useState<StanceLanding | null>(null);
  /**
   * Where the gesture just put the standing, as the fold projected it.
   * It holds the resting target until a fresh read replaces it, which is
   * what makes the answer visible before the record lands (§8.3).
   */
  const [pending, setPending] = useState<StancePair | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [joinPrompt, setJoinPrompt] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const capturedPointer = useRef<number | null>(null);
  /** Where the pointer went down — the origin the pick is measured from. */
  const travelOrigin = useRef<{ x: number; y: number } | null>(null);
  const bundleRead = useRef(0);

  const considered = open || alternates;
  const placement = useAnchoredPlacement(buttonRef, padRef, open);

  // Every host builds `target` inline, so its identity changes on each
  // render. The seam's copy is keyed on the two fields that actually
  // name the target, or the read effect below would re-run forever.
  const seamTarget = useMemo(
    () => ({ id: target.id, kind: target.kind }),
    [target.id, target.kind],
  );

  const readBundle = useCallback(
    (options: { fresh?: boolean } = {}) => {
      if (phase !== "signedIn") return;
      // A supplied bundle is the host's to keep current, except right
      // after this control wrote — then the control has to see its own
      // work rather than the copy the host read before it.
      if (suppliedBundle !== undefined && options.fresh !== true) return;
      // Every signed gesture re-reads; the generation drops an older read
      // that answers after a newer one, so the standing never goes back.
      const generation = ++bundleRead.current;
      void data.bundle(seamTarget, { fresh: options.fresh }).then((outcome) => {
        if (generation !== bundleRead.current) return;
        // A failed standing read leaves the control usable: it degrades to
        // "no standing known" rather than blanking the affordance, and
        // the projected standing stays up — it is the last thing known
        // about the gesture the reader just made.
        if (outcome.kind !== "success") {
          // Never trade a standing that is known for one that is not: a
          // transient fault on a re-read must not blank a good reading.
          setOwn((current) => current ?? { value: suppliedBundle ?? null });
          return;
        }
        setOwn({ value: outcome.value });
        setPending(null);
      });
    },
    [data, phase, suppliedBundle, seamTarget],
  );

  useEffect(() => {
    readBundle();
  }, [readBundle]);

  // The landing is read once the pick settles, and only while a
  // considered gesture is open — a resting control asks nothing.
  useEffect(() => {
    if (!considered) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void data.project(seamTarget, pick).then((outcome) => {
        if (cancelled) return;
        setLanding(outcome.kind === "success" ? outcome.value : null);
      });
    }, PROJECTION_SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [considered, data, pick, seamTarget]);

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
      setLanding(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, releasePointer]);

  const closeAll = () => {
    releasePointer();
    clearHold();
    setOpen(false);
    setAlternates(false);
    setLanding(null);
  };

  /** Signs the picked edge. Reports whether the gesture completed. */
  const runCommit = async (chosen: StancePair): Promise<boolean> => {
    setBusy(true);
    const outcome = await data.commit(seamTarget, chosen);
    setBusy(false);
    if (outcome.kind !== "success") return false;
    setSigned(
      outcome.value.records === 1
        ? "Signed — still settling."
        : `Signed ${outcome.value.records} actions — still settling.`,
    );
    readBundle({ fresh: true });
    return true;
  };

  /** Signs the whole counter-record batch. Reports whether it completed. */
  const runSever = async (): Promise<boolean> => {
    setBusy(true);
    const outcome = await data.sever(seamTarget);
    setBusy(false);
    if (outcome.kind !== "success") return false;
    setSigned(`Signed ${outcome.value.records} actions — still settling.`);
    readBundle({ fresh: true });
    return true;
  };

  const openSeverance = () => {
    closeAll();
    setSigned(null);
    setFailed(false);
    setConfirmFailed(false);
    const records = bundle === null || bundle === undefined ? 0 : bundle.severance.records;
    setConfirming({ pick: null, records, alreadySevered: records === 0 });
  };

  /**
   * Every commit route lands here: read where the pick puts the bundle,
   * and if the fold says that reaches severance, say so and ask rather
   * than refusing (§8.2). Otherwise the projection doubles as the
   * pending-inclusive answer the resting target shows at once (§8.3).
   */
  const commitChecked = async (chosen: StancePair) => {
    setSigned(null);
    setFailed(false);
    setConfirmFailed(false);
    const landed = await data.project(seamTarget, chosen);
    if (landed.kind !== "success") {
      setFailed(true);
      return;
    }
    closeAll();
    if (landed.value.severed) {
      setConfirming({ pick: chosen, records: 1, alreadySevered: false });
      return;
    }
    setPending(landed.value.landing);
    if (!(await runCommit(chosen))) {
      // Nothing was staged, so the target must not keep claiming it was.
      setPending(null);
      setFailed(true);
    }
  };

  const onConfirmSeverance = async () => {
    const pending = confirming;
    if (pending === null) return;
    setConfirmFailed(false);
    const completed = pending.pick === null ? await runSever() : await runCommit(pending.pick);
    // A failure keeps the dialog up and says so, rather than dropping the
    // reader back to a control that looks like nothing happened.
    if (completed) setConfirming(null);
    else setConfirmFailed(true);
  };

  /** A successful hold has met the gesture; the mark has nothing left to teach. */
  const markTaught = () => {
    if (!taught) teach();
    setCoach(false);
  };

  const onTap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (busy) return;
    if (phase !== "signedIn") {
      setJoinPrompt(true);
      return;
    }
    // The first tap ever teaches before it acts, and stages nothing
    // (§8.7). Recording it here is what makes the next tap act.
    if (!taught) {
      teach();
      setCoach(true);
      return;
    }
    void commitChecked(TAP_DEFAULT);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== "signedIn" || busy) return;
    const pointerId = event.pointerId;
    travelOrigin.current = { x: event.clientX, y: event.clientY };
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setPick(ORIGIN);
      setLanding(null);
      setSigned(null);
      markTaught();
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
    const field = fieldRef.current;
    const origin = travelOrigin.current;
    if (field === null || origin === null) return;
    setPick(
      padPairFromTravel(field.getBoundingClientRect(), {
        dx: event.clientX - origin.x,
        dy: event.clientY - origin.y,
      }),
    );
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

  // The standing the target wears: what the gesture just projected, or
  // the bundle as last read. A standing nobody has taken, and one this
  // session could not read, both show the "no stance yet" affordance.
  const restingPair: StancePair | null =
    pending !== null
      ? pending
      : bundle === null || bundle === undefined || bundle.records === 0
        ? null
        : bundle.current;
  const restingFace = restingPair === null ? null : nearestAnchor(restingPair);
  const knob = padPercentOf(pick);

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* 48px minimum, including at rest (design.md §4). */}
        <button
          ref={buttonRef}
          type="button"
          data-testid={testIdPrefix}
          aria-label={
            restingFace === null || restingPair === null
              ? `Take a stance on ${target.label}`
              : `Your stance on ${target.label}: ${restingFace.label}, ${formatStancePair(restingPair)}. Tap to add a positive one.`
          }
          aria-busy={busy}
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          // A long press is the gesture, so the platform must not take it
          // for a selection or a context menu first.
          onContextMenu={(event) => event.preventDefault()}
          className="flex min-h-12 min-w-12 touch-none select-none items-center justify-center gap-2 rounded-full px-3 text-label-large text-primary [-webkit-touch-callout:none]"
        >
          {restingFace === null ? (
            <AddIcon className="h-5 w-5" />
          ) : (
            <span aria-hidden="true" className="text-title-large">
              {restingFace.emoji}
            </span>
          )}
          {/* Colour never carries stance alone: the words say it too
              (design.md §10) — and the exact pair with them, because the
              numbers are part of the default reading (§8.3). */}
          <span aria-hidden="true">{restingFace === null ? "Stance" : restingFace.label}</span>
          {restingPair !== null && (
            <span
              aria-hidden="true"
              data-testid={`${testIdPrefix}-resting-exact`}
              className="text-body-small text-on-surface-variant"
            >
              {formatStancePair(restingPair)}
            </span>
          )}
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
              setLanding(null);
              setSigned(null);
              markTaught();
              setAlternates(true);
            }}
            className={buttonClassName({ variant: "text", size: "sm" })}
          >
            Choose values
          </button>
        )}
      </div>

      {coach && (
        <StanceCoachMark
          anchorRef={buttonRef}
          onDismiss={() => setCoach(false)}
          testId={`${testIdPrefix}-coach`}
        />
      )}

      {open && (
        <div
          ref={padRef}
          role="group"
          aria-label={`Stance pad for ${target.label}`}
          data-testid={`${testIdPrefix}-pad`}
          data-side={placement?.side ?? "unplaced"}
          style={anchoredStyle(placement)}
          className="z-20 flex w-64 touch-none flex-col gap-2 rounded-extra-large bg-surface-container-high p-4"
        >
          {/* Above the pad, never under the knob (§8.4). */}
          <StanceStanding
            pick={pick}
            bundle={bundle}
            targetLabel={target.label}
            testIdPrefix={testIdPrefix}
          />
          {/* A soft rounded square, and the drawn field IS the value
              space: its corners are (±1, ±1) and the knob never leaves
              it (§8.3). */}
          <div
            ref={fieldRef}
            data-testid={`${testIdPrefix}-field`}
            className="relative aspect-square w-full touch-none rounded-large bg-surface-container-highest"
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
            {/* The knob's centre travels this inset box, which is what
                keeps the knob itself inside the drawn corner. */}
            <div
              aria-hidden="true"
              className="absolute"
              style={{ inset: `${KNOB_TRAVEL_INSET_PX}px` }}
            >
              {/* primaryContainer is the loudest surface in the app and
                  belongs to a committed stance (§2.4). */}
              <div
                data-testid={`${testIdPrefix}-knob`}
                style={{ left: `${knob.x}%`, top: `${knob.y}%` }}
                className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container"
              />
            </div>
          </div>
          {/* Below the field, and never merged into the line above it. */}
          <StanceLandingLine landing={landing} testIdPrefix={testIdPrefix} />
          <button
            type="button"
            data-testid={`${testIdPrefix}-sever`}
            onClick={openSeverance}
            className={buttonClassName({ variant: "text", size: "sm" })}
          >
            Sever
          </button>
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
          onSever={openSeverance}
          landing={<StanceLandingLine landing={landing} testIdPrefix={testIdPrefix} />}
        >
          <StanceStanding
            pick={pick}
            bundle={bundle}
            targetLabel={target.label}
            testIdPrefix={testIdPrefix}
          />
        </StanceAlternates>
      )}

      {confirming !== null && (
        <SeveranceConfirm
          pick={confirming.pick}
          targetLabel={target.label}
          bundle={bundle}
          records={confirming.records}
          alreadySevered={confirming.alreadySevered}
          busy={busy}
          failed={confirmFailed}
          onCancel={() => {
            setConfirming(null);
            setConfirmFailed(false);
          }}
          onConfirm={() => void onConfirmSeverance()}
        />
      )}

      {/* Fired once per completed action (design.md §6), and mounted
          whether or not it has anything to say so the announcement is
          heard when it does. */}
      <Snackbar message={signed} onDismiss={() => setSigned(null)} testId={`${testIdPrefix}-signed`} />

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
