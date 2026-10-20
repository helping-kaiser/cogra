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
// A TAP OPENS THE PAD (design/guidelines/stance-control.md "The
// gesture") and stages nothing. The pad blooms at ONE FIXED SPOT, the
// lower centre of the viewport, the same place every time
// (`pad-parking.ts`), and it opens AT THE DEFAULT, +0.10 / +0.10, so Set
// on a pick never moved signs exactly what the hold would. A drag on the
// field moves the knob by the accumulated travel from where the thumb
// went down, so the finger's absolute position never matters, and the
// drawn field is the value space — the knob never leaves it
// (`pad-geometry.ts`).
//
// PRESS AND HOLD 500ms SIGNS THE DEFAULT, the modest positive verbatim,
// without opening anything. The light gesture costs nothing and the held
// one spends: a tap is what a thumb gives by accident, so it opens the
// surface where a reader chooses; nobody holds a control for half a
// second by mistake. THE HOLD ANSWERS IMMEDIATELY (§8.3): the resting
// target moves to the pending-inclusive fold the moment the projection
// comes back — that number is the backend's, never arithmetic done here
// — and a snackbar confirms the signature. A gesture that stages a
// priced act must never be silent: silence reads as failure and invites
// the same act again.
//
// THE PAD IS THE TEACHER (stance-control.md "Teaching it"). The
// account's first-ever pad open carries two coaching lines — the
// press-and-hold shortcut, and that nothing is signed until Set — and
// they close with the pad and never show again. Nothing else teaches it.
//
// RELEASING THE FINGER NEVER COMMITS (§8.3). The pad is a considered
// surface: release leaves the pick standing and the pad open, an
// explicit SET commits, and CANCEL — or a press outside — dismisses and
// stages nothing. An accidental lift must never sign a priced act. The
// small `?` replaces the pad's body with four lines of help, and Set is
// disabled while they show.
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
import { ORIGIN, snapPair, TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { KNOB_TRAVEL_INSET_PX, padPairFrom, padPercentOf } from "@/lib/stance/pad-geometry";
import { useStanceData } from "@/lib/stance/provider";
import { announceStanceSigned } from "@/lib/stance/signed-events";
import { useStanceTaught } from "@/lib/stance/stance-coach";
import type { StanceBundle, StanceLanding, StanceTargetRef } from "@/lib/stance/stance-data";
import { useAuthPhase } from "@/lib/session/provider";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { parkedPadStyle } from "@/lib/ui/pad-parking";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { padHelp, StanceCoaching } from "@/lib/ui/stance-pad-help";
import { formatStancePair, STANCE_AXES, type StanceAxes } from "@/lib/ui/stance-format";
import {
  DISCONNECT_ZERO,
  NO_STANDING_LABEL,
  SEVERANCE_ZERO,
  signedLine,
  StanceLandingLine,
  StanceStanding,
  type BundleState,
} from "@/lib/ui/stance-readout";
import { TransportError } from "@/lib/ui/transport-error";
import { useCoversSurface } from "@/lib/ui2/covering-layer";

/**
 * How long a press has to be held before it signs the default — the
 * table's 500ms, which is Android's own platform long-press timeout, so
 * the two clients ask the same thing of the same thumb.
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

/**
 * How long a Set may stay unanswered before it says it is still working
 * (VouchBackPad.md:31) — the 200ms of K4.2, past which a signed act waits
 * visibly rather than looking ignored.
 */
export const SETTING_AFTER_MS = 200;

/**
 * A PAD OPENED AS SOMETHING IN PARTICULAR — the vouch-back (VouchBackPad.md,
 * the master's own additive props in `StanceControl.jsx`: `helpLabel`,
 * `help`, `padNote`). Off by default, so every other host renders exactly
 * the master it always did.
 *
 * The variant changes what the pad SAYS and where a taken signing GOES; the
 * gesture law is the master's and is not touched: a tap opens the pad, a
 * hold signs the default, Set signs the pick (stance-control.md "The
 * gesture").
 */
export type PadVariant = {
  /** The pad's title and its ?'s name (VouchBackPad.md:9). */
  readonly title: string;
  /** The help that replaces the pad's body in place (:21). */
  readonly help: readonly string[];
  /** The line above the field's foot on every open of this variant (:13). */
  readonly note: string;
  /**
   * A signing was taken — by Set or by the hold. The host routes on (the
   * ceremony, :33; ProfileOther.md:37), so the master's own snackbar does
   * not also answer: the ceremony replaces it.
   */
  readonly onTaken: () => void;
  /**
   * The registered pad (`<host>.stance.pad`, ruling 40): the pad and the
   * parts this control draws itself wear its paths.
   */
  readonly padNode?: DataNode;
  /**
   * Where the pad parks over a screen with a bar: 16px above it
   * (VouchBackPad.md:3, `padInset` on the master) rather than above the
   * viewport's edge.
   */
  readonly padInset?: number;
};

export function StanceControl({
  target,
  bundle: suppliedBundle,
  testIdPrefix,
  axes = STANCE_AXES,
  node,
  variant,
  padOnly,
  lineFaceInk,
  borrowed = false,
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
  /**
   * The registered stance node (`….actionRow.stance`). Its `anchor` — the
   * resting button — and the anchor's `face` and `exact` are its parts, and
   * they then carry the node ids instead of their `testIdPrefix` ones; the
   * pad, the sheets and the rest keep theirs.
   */
  node?: DataNode;
  /**
   * The record family's own words for the two slots it fills. The control
   * owns the geometry; the family owns the words, and they are passed
   * through unchanged to the readouts and the alternates alike so the
   * drawn route and the accessible one never name the same axis two ways.
   */
  axes?: StanceAxes;
  /** The pad opened as something in particular; see [PadVariant]. */
  variant?: PadVariant;
  /**
   * A host that IS the opening gesture — the vouch card's `Vouch back`
   * (VouchBack.md:31) — mounts the control with its pad already open and no
   * resting anchor of its own, and hears the close: a pad closed with
   * nothing taken closes back onto that host (VouchBackPad.md:45).
   */
  padOnly?: { readonly onClose: () => void };
  /**
   * THE VOUCH CARD'S EMPTY FACE IS A LINE FACE IN THE CARD'S INK
   * (stance-control.md, jakob 2026-10-14; the master's `lineFaceInk`). The
   * 🫥 emoji draws in its own fixed pale greys and cannot be tinted, so it
   * never reads on the card's tertiary-container ground. The card's unset
   * state is the line face, `sentiment_neutral`, drawn in the ink handed
   * here at full opacity. Only the empty resting face is affected (a set
   * stance keeps its own emoji); left out, every other host keeps the
   * muted face.
   */
  lineFaceInk?: string;
  /**
   * THE READER STILL BORROWS A VIEW (jakob 2026-10-20; the master's
   * `borrowed`): they hold no outgoing opinion with neither number at zero.
   * The host knows; an unreachable or severed landing then warns that the
   * pick keeps the borrowed view. Warns, never blocks. Left out, nothing
   * is added.
   */
  borrowed?: boolean;
}) {
  const data = useStanceData();
  const phase = useAuthPhase();
  const [mode] = useStanceInputMode();
  const [taught, teach] = useStanceTaught();

  // TOPICS DISCONNECT; EVERYTHING ELSE SEVERS (copy-voice.md "the topic
  // disconnects", jakob 2026-09-15) — the split is by record family, not
  // by surface, so every stance kind but `"topic"` keeps the severance
  // wording verbatim.
  const isTopic = target.kind === "topic";
  const zeroWords = isTopic ? DISCONNECT_ZERO : SEVERANCE_ZERO;
  const severLabel = isTopic ? "Disconnect" : "Walk it back";

  /**
   * The control's own read, once it has one. Wrapped rather than bare so
   * "not read yet" stays distinct from "read, and there is no standing"
   * — and so a control that re-reads after its own write outranks the
   * copy its host read before that write.
   */
  const [own, setOwn] = useState<{ value: BundleState } | null>(null);
  const bundle: BundleState = own !== null ? own.value : suppliedBundle;

  // A pad-only host is the opening gesture itself, so the control mounts
  // already open, exactly as `openConsidered` below would leave it.
  const [open, setOpen] = useState(padOnly !== undefined && mode === "pad");
  const [alternates, setAlternates] = useState(padOnly !== undefined && mode !== "pad");
  /** This open is the account's first-ever, so the pad carries the coaching lines. */
  const [coaching, setCoaching] = useState(padOnly !== undefined && mode === "pad" && !taught);
  const [explaining, setExplaining] = useState(false);
  const [pick, setPick] = useState<StancePair>(padOnly !== undefined ? TAP_DEFAULT : ORIGIN);
  /** A variant's Set did not go through: the pad stays open at the pick (PadFailed). */
  const [padFailed, setPadFailed] = useState(false);
  /** A variant's Set has waited past [SETTING_AFTER_MS] (VouchBackPad.md:31). */
  const [settingSlow, setSettingSlow] = useState(false);
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

  // THE OPINION PAD PAUSES, IT DOES NOT SUSPEND (Feed.md:39/41,
  // PostDetailVideo.md:39/41): opening it pauses the playing clip on its
  // frame and closing it resumes that same clip, with no re-election — so it
  // announces itself as a `pause` layer (`covering-layer.tsx`). The
  // alternates announce themselves the same way from their own dialog.
  useCoversSurface(open, "pause");

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

  // The pad-only host's open spends the teaching the way a tap's does.
  const taughtOnMount = useRef(false);
  useEffect(() => {
    if (padOnly === undefined || taughtOnMount.current) return;
    taughtOnMount.current = true;
    if (!taught) teach();
  }, [padOnly, taught, teach]);

  // Nothing this control started may answer after it is gone: an armed
  // hold would open a pad on nothing, and an in-flight standing read
  // would set state on an unmounted tree (past teardown, the document
  // itself is gone). Bumping the generation drops every pending read.
  useEffect(
    () => () => {
      if (holdTimer.current !== null) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      bundleRead.current += 1;
    },
    [],
  );

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
    // The coaching lines close with the pad and never show again.
    setCoaching(false);
    padOnly?.onClose();
  }, [releasePointer, padOnly]);

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
    announceStanceSigned();
    if (variant !== undefined) {
      readBundle({ fresh: true });
      variant.onTaken();
      return true;
    }
    setSigned(
      signedLine(
        landed.landing,
        outcome.value.records,
        landed.severed,
        target.label,
        axes,
        zeroWords,
      ),
    );
    readBundle({ fresh: true });
    return true;
  };

  /** Signs the whole counter-record batch. Reports whether it completed. */
  const runSever = async (): Promise<boolean> => {
    // The walk-back is checked against the standing the reader confirmed;
    // with none known there is nothing it could be checked against.
    if (bundle === null || bundle === undefined) return false;
    setBusy(true);
    const outcome = await data.sever(seamTarget, bundle);
    setBusy(false);
    if (outcome.kind !== "success") return false;
    announceStanceSigned();
    setSigned(
      signedLine(SEVERED.landing, outcome.value.records, true, target.label, axes, zeroWords),
    );
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
    if (variant !== undefined) {
      await commitInVariant(chosen);
      return;
    }
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

  /**
   * THE VARIANT SIGNS FROM INSIDE THE OPEN PAD. A taken signing leaves for
   * the host's destination (the ceremony), so the pad has nothing to close
   * back onto first; until then it stays parked at the pick, says it is
   * still working past [SETTING_AFTER_MS] (VouchBackPad.md:31), and a
   * signing that did not go through keeps it open at the same pick with
   * the fault above the commit row and Retry in Set's slot (:37, PadFailed).
   * From the hold, with no pad open, a failure is the row's own line.
   */
  const commitInVariant = async (chosen: StancePair) => {
    setPadFailed(false);
    setSettingSlow(false);
    const slow = setTimeout(() => setSettingSlow(true), SETTING_AFTER_MS);
    const fail = () => {
      if (open) setPadFailed(true);
      else setFailed(true);
    };
    try {
      setBusy(true);
      const landed = await data.project(seamTarget, chosen);
      if (landed.kind !== "success") {
        fail();
        return;
      }
      if (landed.value.severed) {
        // Asked rather than refused (§8.2); the pad stays parked beneath.
        setConfirming({ pick: chosen, records: 1, alreadySevered: false, landing: landed.value });
        return;
      }
      if (!(await runCommit(chosen, landed.value))) fail();
    } finally {
      clearTimeout(slow);
      setSettingSlow(false);
      setBusy(false);
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

  /**
   * The considered surface opens AT THE DEFAULT (stance-control.md, jakob
   * 2026-10-05): the hold's own modest positive, so Set on a pick never
   * moved signs exactly what the hold would, and never a (0, 0) that asks
   * to walk back nothing. Opening spends the teaching: whatever opens
   * first is the first open ever, and only the pad carries the lines.
   */
  const openConsidered = (surface: "pad" | "alternates") => {
    setPick(TAP_DEFAULT);
    setSigned(null);
    setFailed(false);
    if (surface === "pad") {
      setCoaching(!taught);
      setOpen(true);
    } else {
      setAlternates(true);
    }
    if (!taught) teach();
  };

  /** THE TAP OPENS, and stages nothing. */
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
    // The alternate replaces the pad everywhere (§8.6), the tap that
    // opens it included.
    openConsidered(mode === "pad" ? "pad" : "alternates");
  };

  /**
   * THE HOLD SIGNS. It fires under the finger, so the click that follows
   * the release has to be swallowed, or the pad would open on top of the
   * signature.
   */
  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    // A swallow left over from a hold whose release never became a click
    // must not eat this press's tap.
    suppressClick.current = false;
    if (phase !== "signedIn" || busy) return;
    clearHold();
    // Captured, so the lift always reaches the target that armed the
    // hold: a finger that slides off and lets go must disarm it, never
    // leave it running to sign after the touch is over.
    capturePointer(event.currentTarget, event.pointerId);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      // The anchor goes inert AT the hold, not once the projection has
      // answered: a second press in that gap must not arm a second
      // signature (stance-control.md "Confirmation").
      setBusy(true);
      void commitChecked(TAP_DEFAULT).finally(() => setBusy(false));
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
   * A press that leaves the target is not a hold on it — the platform's
   * own long press gives up the same way — so travelling off the face
   * disarms the shortcut rather than signing wherever the finger went.
   */
  const onTargetPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (holdTimer.current === null) return;
    const box = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    if (!inside) clearHold();
  };

  /**
   * The release ENDS THE DRAG and nothing else (§8.3). The pick stands,
   * the pad stays open, and Set is what signs it. On the target, a lift
   * before the hold's time disarms it, and the click that follows is the
   * tap.
   */
  const onPointerUp = () => {
    clearHold();
    landOnGrid();
    releasePointer();
  };

  const onPointerCancel = () => {
    clearHold();
    // A lost pointer is not a dismissal: the pad parks the way a release
    // parks it, and the reader still has Set and Cancel in front of them.
    landOnGrid();
    releasePointer();
  };

  /**
   * THE RELEASE PARKS THE PICK ON A HUNDREDTH (the value domain, jakob
   * 2026-10-20): the knob followed the finger, and the lift lands both axes
   * on the nearest hundredth — so a pick the readout prints as `+0.00` is the
   * exact 0 the landing line's severance and inertness read. Only a drag on
   * the field lands; a press on the target never moved the pick.
   */
  const landOnGrid = () => {
    if (drag.current === null) return;
    setPick((standing) => snapPair(standing));
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
  const restingFace = restingPair === null ? null : bundleReadout(restingPair, zeroWords.label);
  const knob = padPercentOf(pick);

  // THE WALK-AWAY NEEDS SOMETHING TO WALK BACK (design's `StanceControl`,
  // and the pair `TagPage` / `TagPageHeldPad` draws: the pad over a topic
  // nobody holds has three controls and the pad over a held one has four).
  // With nothing said there is no relationship to leave, and the button
  // led only to a dialog saying so.
  //
  // THE COUNT IS THE WHOLE TEST, and `severed` is deliberately not a
  // second clause: on the wire it means "both axes at zero", which a
  // bundle folding no records satisfies vacuously. A bundle that HAS
  // records and nets to zero is already covered by the count, and the
  // confirmation says so itself through `alreadySevered`.
  //
  // A VARIANT PAD CARRIES NO WALK IT BACK (VouchBackPad.md:11): the
  // vouch-back opens a relationship, it is never the place to leave one.
  const severable =
    variant === undefined && bundle !== null && bundle !== undefined && bundle.records > 0;
  const padNode = variant?.padNode;

  const padBody = (
    <>
      {/* Above the pad, never under the knob (§8.4). */}
      <StanceStanding
        pick={pick}
        bundle={bundle}
        targetLabel={target.label}
        testIdPrefix={testIdPrefix}
        axes={axes}
        zero={zeroWords}
      />
      {/* A soft rounded square, and the drawn field IS the value
          space: its corners are (±1, ±1) and the knob never leaves
          it (§8.3). */}
      <div
        ref={fieldRef}
        {...testAttributes(part(padNode, "field"), `${testIdPrefix}-field`)}
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
      {/* Between the field and the landing line: the master's `padNote`
          slot, where the first-ever open speaks once. */}
      {variant !== undefined ? (
        // The variant's own line stands on every open; the first-ever
        // open's two coaching lines stand under it (VouchBackPad.md:13-15).
        <div {...testAttributes(part(padNode, "note"), `${testIdPrefix}-note`)} className="flex flex-col gap-1">
          <p className="m-0 text-body-small text-on-surface-variant">{variant.note}</p>
          {coaching && <StanceCoaching testId={`${testIdPrefix}-coaching`} />}
        </div>
      ) : (
        coaching && <StanceCoaching testId={`${testIdPrefix}-coaching`} />
      )}
      {/* Below the field, and never merged into the line above it. */}
      <StanceLandingLine landing={landing} testIdPrefix={testIdPrefix} zero={zeroWords} borrowed={borrowed} />
    </>
  );

  // THE HELP REPLACES THE PAD'S BODY rather than growing below it: the
  // pad is parked and operated by muscle memory, and a panel that pushes
  // Set and Cancel away from the thumb defeats the parking.
  const helpBody = (
    <div data-testid={`${testIdPrefix}-explanation`} className="flex flex-col gap-2">
      {(variant?.help ?? padHelp(isTopic)).map((line) => (
        <p key={line} className="text-body-small text-on-surface-variant">
          {line}
        </p>
      ))}
      <button
        type="button"
        data-testid={`${testIdPrefix}-explain-back`}
        onClick={() => setExplaining(false)}
        className={`self-start ${buttonClassName({ variant: "text", size: "sm" })}`}
      >
        Back to the pad
      </button>
    </div>
  );

  return (
    // The control owns its touches (§8.3): nothing it receives reaches
    // the card or the link behind it.
    // THE CARD'S AFFORDANCE ROW IS ONE LINE THAT NEVER WRAPS
    // (`PostCard.jsx:300-309`, whose row carries `minWidth: 0` for exactly
    // this): the control is the widest thing in it, so it is the thing that
    // gives way. The reading's words shorten before the row does; the emoji
    // and the pair never do, because the numbers are part of the default
    // reading (§8.3). Standing alone, nothing shrinks it.
    <div
      {...testAttributes(node)}
      className="relative flex min-w-0 flex-col gap-1"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {padOnly === undefined && (
      <div className="flex min-w-0 items-center gap-2">
        {/* 48px minimum, including at rest (design.md §4). */}
        <button
          ref={buttonRef}
          type="button"
          {...testAttributes(part(node, "anchor"), testIdPrefix)}
          aria-label={
            restingFace === null || restingPair === null
              ? `Take a stance on ${target.label}`
              : `Your stance on ${target.label}: ${restingFace.label}, ${formatStancePair(restingPair)}. Press and hold to add a positive one.`
          }
          aria-busy={busy}
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerMove={onTargetPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          // A long press is the shortcut, so the platform must not take
          // it for a selection or a context menu first.
          onContextMenu={(event) => event.preventDefault()}
          className="flex min-h-12 min-w-12 touch-none select-none items-center justify-center gap-2 rounded-full px-3 text-label-large text-primary [-webkit-touch-callout:none]"
        >
          {/* Never a bare word (§8.3): a viewer with no bundle gets a
              face outside the table, muted and translucent — the control
              visibly waiting to be given a value rather than wearing an
              answer, and never the shrug a zero standing owns (§8.4). */}
          {restingFace === null && lineFaceInk !== undefined ? (
            <span
              aria-hidden="true"
              {...testAttributes(part(node, "anchor.face"), `${testIdPrefix}-resting-face`)}
              className="inline-flex flex-none"
              style={{ color: lineFaceInk }}
            >
              <Icon name="sentiment_neutral" size={24} />
            </span>
          ) : (
            <span
              aria-hidden="true"
              {...testAttributes(part(node, "anchor.face"), `${testIdPrefix}-resting-face`)}
              className={
                restingFace === null
                  ? "flex-none text-title-large opacity-40 grayscale"
                  : "flex-none text-title-large"
              }
            >
              {restingFace === null ? RESTING_FACE_EMOJI : restingFace.emoji}
            </span>
          )}
          {/* Colour never carries stance alone: the words say it too
              (design.md §10) — and the exact pair with them, because the
              numbers are part of the default reading (§8.3). The words are
              what gives way where the affordance row is tight; the face and
              the pair are the two channels that must not. */}
          <span aria-hidden="true" className="truncate">
            {restingFace === null ? NO_STANDING_LABEL : restingFace.label}
          </span>
          {restingPair !== null && (
            <span
              aria-hidden="true"
              {...testAttributes(part(node, "anchor.exact"), `${testIdPrefix}-resting-exact`)}
              className="flex-none text-body-small text-on-surface-variant"
            >
              {formatStancePair(restingPair)}
            </span>
          )}
        </button>
        {/* The non-drag equivalent, present whatever the stored input is
            (design.md §8.6, §10) — a drag gesture always has one.

            NOT DRAWN, AND RENAMED (design/readme.md §13, the stance round):
            "`Choose values` was a `primary` text button beside every stance,
            so a feed of twenty posts carried twenty copies of a control
            duplicating the one next to it — and 'values' named nothing a
            reader could place. It is now `Choose your stance`, visually
            hidden until focused." §10 is satisfied by the equivalent existing
            and being reachable in one tab, not by it being on screen twenty
            times — and the affordance row cannot hold its ruled four
            affordances on one line with a text button in front of them. */}
        {phase === "signedIn" && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-choose`}
            disabled={busy}
            onClick={() => openConsidered("alternates")}
            className={`sr-only focus:not-sr-only ${buttonClassName({ variant: "text", size: "sm" })}`}
          >
            Choose your stance
          </button>
        )}
      </div>
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
            // The variant's wash covers the shell (`--scrim-dialog`,
            // VouchBackPad.md:5); the master pad elsewhere draws none.
            className={`fixed inset-0 z-10 touch-none${variant !== undefined ? " bg-scrim/50" : ""}`}
          />
          <div
            role="group"
            aria-label={variant?.title ?? `Stance pad for ${target.label}`}
            {...testAttributes(padNode, `${testIdPrefix}-pad`)}
            style={parkedPadStyle(variant?.padInset)}
            className="z-20 flex w-64 touch-none flex-col gap-2 overflow-y-auto rounded-extra-large bg-surface-container-high p-4"
          >
            {explaining ? helpBody : padBody}
            {/* The fault stands above the commit row, in the failure voice
                (PadFailed), the pad still parked at the pick. */}
            {padFailed && (
              <p
                role="alert"
                data-testid={`${testIdPrefix}-pad-failed`}
                className="m-0 text-body-small text-error"
              >
                That didn&apos;t send. Try again.
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                {...testAttributes(part(padNode, "help"), `${testIdPrefix}-explain`)}
                aria-expanded={explaining}
                aria-label={variant?.title ?? "How stances work"}
                onClick={() => setExplaining((shown) => !shown)}
                className={buttonClassName({ variant: "text", size: "sm" })}
              >
                ?
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  {...testAttributes(part(padNode, "cancel"), `${testIdPrefix}-cancel`)}
                  onClick={closeAll}
                  className={buttonClassName({ variant: "text", size: "sm" })}
                >
                  Cancel
                </button>
                {/* The only thing on the pad that signs anything (§8.3) —
                    and never through the help, whose field is not there
                    to check against. */}
                {variant === undefined ? (
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-set`}
                    disabled={busy || explaining}
                    onClick={() => void commitChecked(pick)}
                    className={buttonClassName({ variant: "primary", size: "sm" })}
                  >
                    Set
                  </button>
                ) : (
                  // A signed act waits rather than answering at once (K4.1):
                  // inert while in flight — refusing a second press without
                  // dimming — and saying so past 200ms, never a spinner.
                  <button
                    type="button"
                    {...testAttributes(part(padNode, "set"), `${testIdPrefix}-set`)}
                    disabled={explaining}
                    aria-disabled={busy}
                    onClick={() => {
                      if (busy) return;
                      void commitChecked(pick);
                    }}
                    className={buttonClassName({
                      variant: padFailed ? "outline" : "primary",
                      size: "sm",
                    })}
                  >
                    {busy && settingSlow ? "Setting…" : padFailed ? "Retry" : "Set"}
                  </button>
                )}
              </div>
            </div>
            {severable && (
              <button
                type="button"
                data-testid={`${testIdPrefix}-sever`}
                onClick={openSeverance}
                className={buttonClassName({ variant: "text", size: "sm" })}
              >
                {severLabel}
              </button>
            )}
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
          severable={severable}
          severLabel={severLabel}
          axes={axes}
          landing={<StanceLandingLine landing={landing} testIdPrefix={testIdPrefix} zero={zeroWords} borrowed={borrowed} />}
        >
          <StanceStanding
            pick={pick}
            bundle={bundle}
            targetLabel={target.label}
            testIdPrefix={testIdPrefix}
            axes={axes}
            zero={zeroWords}
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
          kind={target.kind}
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
