"use client";

// CoGra's signature interaction (design.md §8), on the web.
//
// AT REST (§8.3) the target shows the standing: a viewer with a bundle
// toward the thing sees its face, its words, and its folded pair on the
// target itself; a viewer without one sees a MUTED, TRANSLUCENT FACE —
// the same control at rest, visibly waiting to be given a value, never a
// bare word. The bundle is already loaded by the read that rendered the
// surface (§8.2), so showing it costs nothing and is the difference
// between a control and a mystery button.
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
// PRESS AND HOLD and the pad blooms — at ONE FIXED SPOT, the lower
// centre of the viewport, the same place every time (`pad-parking.ts`).
// The pick is the accumulated travel from where the thumb went down, so
// the finger's absolute position never matters, and the drawn field is
// the value space — the knob never leaves it (`pad-geometry.ts`).
//
// RELEASING THE FINGER NEVER COMMITS (§8.3). The pad is a considered
// surface: release leaves the pick standing and the pad open, an
// explicit SET commits, and CANCEL — or a press outside — dismisses and
// stages nothing. An accidental lift must never sign a priced act. A
// small `?` opens the §8.7 explanation on demand, for anyone meeting the
// control after the one-time coach mark is spent.
//
// THE CONTROL OWNS ITS TOUCHES (§8.3). Nothing it receives — tap, hold,
// drag, release, or the open pad itself — reaches the surface underneath:
// opening the pad must never also open the post, and dismissing it must
// never navigate. One gesture, one meaning. The wrapper stops the
// propagation, so that is a property of the control rather than of where
// a host happens to place it.
//
// What it writes (§8.1): exactly the pair picked. There is no delta in
// this file. The current standing is a READ, rendered around the field
// and never folded into the value. The LANDING is folded here — locally,
// from the raw sums the same read served, so it keeps up with the drag
// (`landing.ts`) — but it is display only: `commitChecked` asks the
// backend for the authoritative projection before anything is signed.
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
// events coming after the finger leaves the element it started on, and
// suppressing the callout is what stops a long press from becoming a
// context menu instead of a gesture.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStanceInputMode } from "@/lib/stance/input-mode";
import { bundleReadout, RESTING_FACE_EMOJI } from "@/lib/stance/anchors";
import { localLanding } from "@/lib/stance/landing";
import { ORIGIN, TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { KNOB_TRAVEL_INSET_PX, padPairFrom, padPercentOf } from "@/lib/stance/pad-geometry";
import { useStanceData } from "@/lib/stance/provider";
import { useStanceTaught } from "@/lib/stance/stance-coach";
import type { StanceBundle, StanceLanding, StanceTargetRef } from "@/lib/stance/stance-data";
import { useAuthPhase } from "@/lib/session/provider";
import { buttonClassName } from "@/lib/ui/button";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { parkedPadStyle } from "@/lib/ui/pad-parking";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { StanceCoachMark, STANCE_EXPLANATION } from "@/lib/ui/stance-coach-mark";
import { formatStancePair } from "@/lib/ui/stance-format";
import {
  NO_STANDING_LABEL,
  SEVERED_LABEL,
  signedLine,
  StanceLandingLine,
  StanceStanding,
  type BundleState,
} from "@/lib/ui/stance-readout";
import { TransportError } from "@/lib/ui/transport-error";

/**
 * How long a press has to be held before the pad blooms. Android's own
 * platform long-press timeout, so the two clients ask the same thing of
 * the same thumb.
 */
export const LONG_PRESS_MS = 500;

/** An open severance confirmation. A null pick is the explicit gesture. */
type Confirming = {
  pick: StancePair | null;
  records: number;
  alreadySevered: boolean;
  /** Where confirming leaves the bundle — the fold's answer, for the receipt. */
  landing: StanceLanding;
};

/** Everything reaching severance lands at the origin, by definition. */
const SEVERED: StanceLanding = { landing: ORIGIN, inert: true, severed: true };

/** A drag in progress: where the pointer went down, and the pick it started from. */
type Drag = { x: number; y: number; base: StancePair };

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
  const [explaining, setExplaining] = useState(false);
  const [pick, setPick] = useState<StancePair>(ORIGIN);
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
  const fieldRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  /** The element holding the pointer capture, and the pointer it holds. */
  const captured = useRef<{ element: HTMLElement; pointerId: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const bundleRead = useRef(0);

  const considered = open || alternates;

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

  /**
   * Where the pick lands the bundle, folded locally against the SERVED
   * raw sums and recomputed on every pointer move (§8.3). There is no
   * round trip on this path and so no lag: the read that rendered the
   * surface already carried everything the fold needs.
   *
   * Null until the standing is known — a landing needs a bundle to land
   * in, and guessing at one would be worse than saying so.
   */
  const landing: StanceLanding | null =
    !considered || bundle === undefined || bundle === null
      ? null
      : localLanding(bundle.rawSum, pick);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const releasePointer = useCallback(() => {
    const held = captured.current;
    captured.current = null;
    drag.current = null;
    if (held === null) return;
    if (
      typeof held.element.releasePointerCapture === "function" &&
      held.element.hasPointerCapture?.(held.pointerId)
    ) {
      held.element.releasePointerCapture(held.pointerId);
    }
  }, []);

  const capturePointer = (element: HTMLElement | null, pointerId: number) => {
    if (element === null || typeof element.setPointerCapture !== "function") return;
    element.setPointerCapture(pointerId);
    captured.current = { element, pointerId };
  };

  const closeAll = useCallback(() => {
    releasePointer();
    clearHold();
    setOpen(false);
    setAlternates(false);
    setExplaining(false);
  }, [releasePointer]);

  // Escape cancels the open pad. The pad takes no focus of its own while
  // a pointer is driving it, so the listener sits on the document rather
  // than on a node the key would never reach.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeAll]);

  /** Signs the picked edge. Reports whether the gesture completed. */
  const runCommit = async (chosen: StancePair, landed: StanceLanding): Promise<boolean> => {
    setBusy(true);
    const outcome = await data.commit(seamTarget, chosen);
    setBusy(false);
    if (outcome.kind !== "success") return false;
    setSigned(
      signedLine(landed.landing, outcome.value.records, landed.severed, target.label),
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
    setSigned(signedLine(SEVERED.landing, outcome.value.records, true, target.label));
    readBundle({ fresh: true });
    return true;
  };

  const openSeverance = () => {
    closeAll();
    setSigned(null);
    setFailed(false);
    setConfirmFailed(false);
    const records = bundle === null || bundle === undefined ? 0 : bundle.severance.records;
    setConfirming({ pick: null, records, alreadySevered: records === 0, landing: SEVERED });
  };

  /**
   * Every commit route lands here: read where the pick puts the bundle,
   * and if the fold says that reaches severance, say so and ask rather
   * than refusing (§8.2). Otherwise the projection doubles as the
   * pending-inclusive answer the resting target shows at once (§8.3).
   *
   * The backend's projection is the authority here even though the
   * landing LINE is folded locally under the drag (§8.3): the line is
   * display, and this is the moment a record gets signed.
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
      setConfirming({ pick: chosen, records: 1, alreadySevered: false, landing: landed.value });
      return;
    }
    setPending(landed.value.landing);
    if (!(await runCommit(chosen, landed.value))) {
      // Nothing was staged, so the target must not keep claiming it was.
      setPending(null);
      setFailed(true);
    }
  };

  const onConfirmSeverance = async () => {
    const pending = confirming;
    if (pending === null) return;
    setConfirmFailed(false);
    const completed =
      pending.pick === null ? await runSever() : await runCommit(pending.pick, pending.landing);
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
    const from = { x: event.clientX, y: event.clientY };
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setPick(ORIGIN);
      setSigned(null);
      markTaught();
      // The pad opens at the origin, so that is what this drag builds on.
      drag.current = { ...from, base: ORIGIN };
      if (mode === "pad") {
        setOpen(true);
        capturePointer(buttonRef.current, pointerId);
      } else {
        // The alternate replaces the pad everywhere (§8.6), the hold
        // gesture included.
        setAlternates(true);
      }
    }, LONG_PRESS_MS);
  };

  /** One rule for how a finger moves the knob, wherever the drag began. */
  const trackDrag = (clientX: number, clientY: number) => {
    const field = fieldRef.current;
    const from = drag.current;
    if (field === null || from === null) return;
    setPick(
      padPairFrom(from.base, field.getBoundingClientRect(), {
        dx: clientX - from.x,
        dy: clientY - from.y,
      }),
    );
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!open) return;
    trackDrag(event.clientX, event.clientY);
  };

  /**
   * The release ENDS THE DRAG and nothing else (§8.3). The pick stands,
   * the pad stays open, and Set is what signs it.
   */
  const onPointerUp = () => {
    clearHold();
    if (!open) return;
    releasePointer();
  };

  const onPointerCancel = () => {
    clearHold();
    // A lost pointer is not a dismissal: the pad parks the way a release
    // parks it, and the reader still has Set and Cancel in front of them.
    releasePointer();
  };

  /**
   * A second drag, started on the parked field, adjusts the pick that is
   * already standing rather than starting over.
   */
  const onFieldPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    drag.current = { x: event.clientX, y: event.clientY, base: pick };
    capturePointer(event.currentTarget, event.pointerId);
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
  // A standing, so the table is not consulted at the origin (§8.4).
  const restingFace = restingPair === null ? null : bundleReadout(restingPair, SEVERED_LABEL);
  const knob = padPercentOf(pick);

  const padBody = (
    <>
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
        onPointerDown={onFieldPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="relative aspect-square w-full touch-none rounded-large bg-surface-container-highest"
      >
        {/* The inert centre-lines are drawn as visibly dead ground
            rather than hidden, so the model reads as legible rather
            than mysterious (§8.3). */}
        <div aria-hidden="true" className="absolute left-0 top-1/2 h-px w-full bg-outline-variant" />
        <div aria-hidden="true" className="absolute left-1/2 top-0 h-full w-px bg-outline-variant" />
        {/* The knob's centre travels this inset box, which is what
            keeps the knob itself inside the drawn corner. */}
        <div aria-hidden="true" className="absolute" style={{ inset: `${KNOB_TRAVEL_INSET_PX}px` }}>
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
    </>
  );

  return (
    // The control owns its touches (§8.3): nothing it receives reaches
    // the card or the link behind it.
    <div
      className="relative flex flex-col gap-1"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
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
          {/* Never a bare word (§8.3): a viewer with no bundle gets a
              face outside the table, muted and translucent — the control
              visibly waiting to be given a value rather than wearing an
              answer, and never the shrug a zero standing owns (§8.4). */}
          <span
            aria-hidden="true"
            data-testid={`${testIdPrefix}-resting-face`}
            className={
              restingFace === null
                ? "text-title-large opacity-40 grayscale"
                : "text-title-large"
            }
          >
            {restingFace === null ? RESTING_FACE_EMOJI : restingFace.emoji}
          </span>
          {/* Colour never carries stance alone: the words say it too
              (design.md §10) — and the exact pair with them, because the
              numbers are part of the default reading (§8.3). */}
          <span aria-hidden="true">
            {restingFace === null ? NO_STANDING_LABEL : restingFace.label}
          </span>
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
        <>
          {/* A press outside dismisses and stages nothing (§8.3). The
              scrim is also what makes the open pad's surroundings inert:
              a touch meant for the pad's edge cannot reach a card. */}
          <div
            data-testid={`${testIdPrefix}-scrim`}
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              closeAll();
            }}
            className="fixed inset-0 z-10 touch-none"
          />
          <div
            role="group"
            aria-label={`Stance pad for ${target.label}`}
            data-testid={`${testIdPrefix}-pad`}
            style={parkedPadStyle()}
            className="z-20 flex w-64 touch-none flex-col gap-2 overflow-y-auto rounded-extra-large bg-surface-container-high p-4"
          >
            {padBody}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid={`${testIdPrefix}-explain`}
                aria-expanded={explaining}
                aria-label="How stances work"
                onClick={() => setExplaining((shown) => !shown)}
                className={buttonClassName({ variant: "text", size: "sm" })}
              >
                ?
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-cancel`}
                  onClick={closeAll}
                  className={buttonClassName({ variant: "text", size: "sm" })}
                >
                  Cancel
                </button>
                {/* The only thing on the pad that signs anything (§8.3). */}
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-set`}
                  disabled={busy}
                  onClick={() => void commitChecked(pick)}
                  className={buttonClassName({ variant: "primary", size: "sm" })}
                >
                  Set
                </button>
              </div>
            </div>
            {explaining && (
              <p
                data-testid={`${testIdPrefix}-explanation`}
                className="text-body-small text-on-surface-variant"
              >
                {STANCE_EXPLANATION}
              </p>
            )}
            <button
              type="button"
              data-testid={`${testIdPrefix}-sever`}
              onClick={openSeverance}
              className={buttonClassName({ variant: "text", size: "sm" })}
            >
              Sever
            </button>
          </div>
        </>
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
