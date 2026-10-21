"use client";

// CoGra's signature interaction, on the web — the master is
// `design/components/stance/StanceControl.jsx` (with `StancePad.jsx` and
// `StanceReadout.jsx`), and its behaviour lines are PadStanding.md,
// PadFailed.md, PadWriteRule.md, RowSigning.md and RowWriteRule.md.
//
// AT REST the target shows the opinion: the face, with the exact pair beside
// it in a `cg-exact` span that paints only in geek mode (readme §13). No
// opinion yet is a muted, translucent 🫥 — never a bare word, never the 🤷 a
// zero opinion owns. The anchor's words are never drawn; they ride the
// button's accessible name, in both modes.
//
// A TAP OPENS THE PAD and stages nothing. It blooms at ONE FIXED SPOT, the
// lower centre of the viewport, 16px above the bottom bar where one stands
// (`pad-parking.ts`), over the wash, and opens AT THE DEFAULT, +0.10 / +0.10,
// so Set on a pick never moved signs exactly what the hold would. The field
// is the master `StancePad` (`PairField`): the four pole words in gutters
// outside it, the dead-ground hairlines inside, and a 20px knob that moves by
// the accumulated travel from where the finger went down, wearing the pressed
// layer while held.
//
// PRESS AND HOLD 500ms SIGNS THE DEFAULT, without opening anything. A ring
// fills around the face over the 500ms so the reader sees the threshold
// coming. The light gesture costs nothing and the held one spends.
//
// A SIGNED ACT WAITS FOR ITS SIGNATURE (the failure pack). Set keeps the pad
// open: past 200ms it reads `Setting…` and goes inert, never dimmed; a
// failure keeps the pad at the pick with the fault above the commit row and
// an outlined `Retry` in Set's slot; the write rule's refusal is a notice
// where the landing line and the commit row stood, with `Not now`. A hold
// moves the face only once signed: past 200ms the row says `Signing…`, and a
// failure says `That didn't sign.` with Retry. Never a snackbar for a failure.
//
// THE PAD IS THE TEACHER: the account's first-ever open carries the two
// coaching lines, and they close with the pad and never show again.
//
// RELEASING THE FINGER NEVER COMMITS. Release parks the pick; Set signs it;
// Cancel, a press on the wash, or Escape stages nothing. The walk-back — and a
// pick that nets the bundle to (0, 0) — asks over the parked pad, so `Keep
// it` returns to the pick as it was.
//
// A (0, 0) WITH NOTHING STANDING IS NOT A WALK-BACK (jakob 2026-10-21, seam
// 242/243). A pick landing (0, 0) while the bundle holds no record, or is
// already walked back, has nothing to walk back: it asks `EmptySignConfirm`
// over the parked pad instead, and `Set it anyway` signs the one record like
// any other — it counts, the bundle stays at (0, 0) unsevered, and the
// ordinary snackbar answers. An ask, never a block. Where the opinion vouches
// its target in (`vouchesIn`), the ask warns harder and the act proceeds.
//
// THE CONTROL OWNS ITS TOUCHES: nothing it receives — the open pad included,
// which is portalled to the document so its wash covers the band and the bar
// — reaches the card behind it.
//
// What it writes: exactly the pair picked. There is no delta in this file.
// The landing is folded here, locally, from the served raw sums so it keeps up
// with the drag (`landing.ts`) — display only: the projection the backend
// serves is what answers before anything is signed.

import {
  useCallback,
  useEffectEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { hasCode } from "@/lib/api/outcome";
import { useStanceInputMode } from "@/lib/stance/input-mode";
import { bundleReadout, EMPTY_PICK_LABEL, RESTING_FACE_EMOJI } from "@/lib/stance/anchors";
import { useKeptPick } from "@/lib/stance/kept-picks";
import { localLanding } from "@/lib/stance/landing";
import { ORIGIN, TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { STANCE_RANGES } from "@/lib/stance/pad-geometry";
import { useStanceData } from "@/lib/stance/provider";
import { announceStanceSigned } from "@/lib/stance/signed-events";
import { useStanceTaught } from "@/lib/stance/stance-coach";
import type { StanceBundle, StanceLanding, StanceTargetRef } from "@/lib/stance/stance-data";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { BUTTON_CLASS, buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import {
  PAD_ABOVE_BAR_INSET_PX,
  PAD_PARK_INSET_PX,
  parkedPadStyle,
  useBarBeneath,
} from "@/lib/ui/pad-parking";
import { EmptySignConfirm } from "@/lib/ui/empty-sign-confirm";
import { PendingMarker } from "@/lib/ui/pending-marker";
import { RowLine, type RowLineState } from "@/lib/ui/row-line";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { padHelp, StanceCoaching, unreachableHelp } from "@/lib/ui/stance-pad-help";
import {
  formatStancePair,
  severanceWords,
  STANCE_AXES,
  type StanceAxes,
} from "@/lib/ui/stance-format";
import {
  PICK_LABEL,
  signedLine,
  StanceLandingLine,
  StanceStanding,
  type BundleState,
} from "@/lib/ui/stance-readout";
import { TransportError } from "@/lib/ui/transport-error";
import { PairField } from "@/lib/ui2/compose/pair-field";
import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { HELP_TOPICS, HelpDialog, type HelpTopic } from "@/lib/ui2/help-dialog";
import { HelpDot } from "@/lib/ui2/help-dot";
import { pillClassName } from "@/lib/ui2/pill-button";

/**
 * How long a press has to be held before it signs the default — the
 * table's 500ms, which is Android's own platform long-press timeout, so
 * the two clients ask the same thing of the same thumb.
 */
export const LONG_PRESS_MS = 500;

/**
 * How long a signed act may stay unanswered before it says it is still
 * working (PadStanding.md, RowSigning.md) — past it, Set reads `Setting…` and
 * the row says `Signing…`, rather than looking ignored.
 */
export const SETTING_AFTER_MS = 200;

/** The ordinary pad's `?` name (the master's `helpLabel` default, ruling A7). */
export const PAD_HELP_LABEL = "How opinions work";

/** The write rule's words at the pad's scale (copy-voice, *Faults by code*). */
const WRITE_RULE_TITLE = "You can't sign right now";
const WRITE_RULE_PAD_FACT =
  "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent.";
const WRITE_RULE_HELP = "Why signing waits";

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

/**
 * An open empty-sign ask: the pick that lands (0, 0) over nothing standing.
 * Signed, it is an ORDINARY record — the fold at (0, 0), never severed.
 */
type EmptyAsk = {
  pick: StancePair;
  landing: StanceLanding;
};

/** Where a signed act was made — what re-raises its outcome. */
type Origin = "pad" | "row" | "confirm" | "empty";

/**
 * Where a TAKEN signing put the standing, and whether it walked it back —
 * which word a (0, 0) resting face speaks until a fresh read replaces it.
 */
type Pending = {
  pair: StancePair;
  severed: boolean;
};

/** What did not go through on a surface: a fault, or the write rule's notice. */
type Fault = "failed" | "writeRule";

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

/* THE HOLD'S RING: M3's determinate circular indicator — a 40px circle, a
   4px active stroke in `primary`, no track — drawn around the face from
   twelve o'clock at the press, filling over the 500ms. Under reduced motion
   it still fills: it is a reading of the time left (readme §4). */
const HOLD_RING_PX = 40;
const HOLD_RING_STROKE_PX = 4;

function HoldRing({ testId }: { testId: string }) {
  const r = (HOLD_RING_PX - HOLD_RING_STROKE_PX) / 2;
  const circumference = Math.round(2 * Math.PI * r * 1000) / 1000;
  return (
    <svg
      aria-hidden="true"
      data-testid={testId}
      width={HOLD_RING_PX}
      height={HOLD_RING_PX}
      viewBox={`0 0 ${HOLD_RING_PX} ${HOLD_RING_PX}`}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 overflow-visible"
    >
      <circle
        cx={HOLD_RING_PX / 2}
        cy={HOLD_RING_PX / 2}
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={HOLD_RING_STROKE_PX}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
      >
        <animate
          attributeName="stroke-dashoffset"
          from={circumference}
          to="0"
          dur={`${LONG_PRESS_MS}ms`}
          fill="freeze"
        />
      </circle>
    </svg>
  );
}

const subscribeNothing = () => () => {};

/** Whether this render is in the browser — the portal needs a document. */
function useInBrowser(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** What can take focus inside the pad, for the Tab trap. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  vouchesIn = false,
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
   * The record family's own words for the two slots it fills, and its own
   * way out (`severance`). The control owns the geometry; the family owns
   * the words, passed through unchanged to the field, the readouts and the
   * alternates alike, so the drawn route and the accessible one never name
   * the same axis two ways.
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
   * (stance-control.md, jakob 2026-10-14; the master's `lineFaceInk`). Only
   * the empty resting face is affected (a set stance keeps its own emoji);
   * left out, every other host keeps the muted face.
   */
  lineFaceInk?: string;
  /**
   * THE READER STILL BORROWS A VIEW (jakob 2026-10-20; the master's
   * `borrowed`): an unreachable or severed landing then warns that the pick
   * keeps the borrowed view. Warns, never blocks.
   */
  borrowed?: boolean;
  /**
   * THE OPINION VOUCHES ITS TARGET IN (jakob 2026-10-21; the master's
   * `vouchesIn`): approving an applicant, or answering a vouch asked for. An
   * empty sign there still vouches them in, so its ask warns that they start
   * out cut off (`EmptySignConfirm`'s `vouchIn`), and `Set it anyway` is the
   * act. Off by default — every other host renders exactly as before.
   */
  vouchesIn?: boolean;
}) {
  const data = useStanceData();
  const phase = useAuthPhase();
  const accountId = useActiveAccountId();
  const [mode] = useStanceInputMode();
  const [taught, teach] = useStanceTaught();
  const barBeneath = useBarBeneath();
  const inBrowser = useInBrowser();
  const sever = severanceWords(axes);

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
  /** False, the "?"'s help, or the unreachable landing's 🤔 explanation. */
  const [explaining, setExplaining] = useState<false | "help" | "zero">(false);
  const [pick, setPick] = useState<StancePair>(TAP_DEFAULT);
  /** What did not go through from the open pad or the alternates. */
  const [padFault, setPadFault] = useState<Fault | null>(null);
  /** What did not go through from the hold, on the target's own row. */
  const [rowLine, setRowLine] = useState<RowLineState | null>(null);
  /** A signed act in flight, and where it was made. */
  const [inFlight, setInFlight] = useState<Origin | null>(null);
  /** The act in flight has waited past [SETTING_AFTER_MS]. */
  const [slow, setSlow] = useState(false);
  /** The face, ringed while a hold is under way. */
  const [holding, setHolding] = useState(false);
  /**
   * Where a TAKEN signing put the standing, as the fold projected it. It
   * holds the resting target until a fresh read replaces it — never before
   * the signature is taken (RowSigning.md: "NEVER the face moves before").
   */
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const [emptyAsk, setEmptyAsk] = useState<EmptyAsk | null>(null);
  const [emptyFailed, setEmptyFailed] = useState(false);
  const [signed, setSigned] = useState<ReactNode | null>(null);
  const [joinPrompt, setJoinPrompt] = useState(false);
  /** The dialog a notice's own "?" opens over the pad, if any. */
  const [noticeHelp, setNoticeHelp] = useState<HelpTopic | null>(null);
  /** The signing key is not on this device — null until asked. */
  const [keyAbsent, setKeyAbsent] = useState<boolean | null>(null);

  const busy = inFlight !== null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  /** The element holding the pointer capture, and the pointer it holds. */
  const captured = useRef<{ element: HTMLElement; pointerId: number } | null>(null);
  const bundleRead = useRef(0);
  /** Whether the pad is open right now — read when an act in flight answers. */
  const openRef = useRef(open || alternates);

  const considered = open || alternates;
  useEffect(() => {
    openRef.current = considered;
  }, [considered]);

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

  const [kept, keep] = useKeptPick(accountId, seamTarget);
  // A kept pick asks once whether the key is back: the anchor wears it only
  // while the key is still elsewhere (PadPending.md).
  useEffect(() => {
    if (kept === null) return undefined;
    let live = true;
    void data.keyOnDevice().then((present) => {
      if (live) setKeyAbsent(!present);
    });
    return () => {
      live = false;
    };
  }, [kept, data]);

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
  // hold would sign on nothing, and an in-flight standing read would set
  // state on an unmounted tree. Bumping the generation drops every read.
  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (slowTimer.current !== null) clearTimeout(slowTimer.current);
      holdTimer.current = null;
      slowTimer.current = null;
      bundleRead.current += 1;
    },
    [],
  );

  /**
   * Where the pick lands the bundle, folded locally against the SERVED raw
   * sums and recomputed on every pointer move. Null until the standing is
   * known — a landing needs a bundle to land in.
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
    setHolding(false);
  };

  const releasePointer = useCallback(() => {
    const held = captured.current;
    captured.current = null;
    if (held === null) return;
    if (
      typeof held.element.releasePointerCapture === "function" &&
      held.element.hasPointerCapture?.(held.pointerId)
    ) {
      held.element.releasePointerCapture(held.pointerId);
    }
  }, []);

  /** Closes the pad and the alternates without telling a pad-only host. */
  const closeSurfaces = () => {
    releasePointer();
    setOpen(false);
    setAlternates(false);
    setExplaining(false);
    setPadFault(null);
    // The coaching lines close with the pad and never show again.
    setCoaching(false);
  };

  /** Cancel, the wash, Escape: nothing is staged. */
  const closeAll = () => {
    releasePointer();
    setOpen(false);
    setAlternates(false);
    setExplaining(false);
    setPadFault(null);
    setCoaching(false);
    padOnly?.onClose();
  };

  // The Escape key's answer reads the latest state without re-subscribing
  // the listener on every render (react.dev, `useEffectEvent`).
  const onEscape = useEffectEvent(() => closeAll());

  // Escape cancels the open pad — unless the walk-back's dialog stands over
  // it, where Escape is that dialog's `Keep it` and the pad stays parked.
  useEffect(() => {
    // Over the walk-back's dialog, the empty sign's ask or the write rule's
    // help, Escape is that dialog's own way out, and the pad stays parked
    // beneath it.
    if (!open || confirming !== null || emptyAsk !== null || noticeHelp !== null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, confirming, emptyAsk, noticeHelp]);

  // THE PAD IS MODAL FOR ASSISTIVE TECH (PadStanding.md): opening moves
  // focus into it — a pad-only host's first paint included — and closing
  // returns it to the face that opened it.
  const focusedIn = useRef(false);
  useEffect(() => {
    if (open && inBrowser && !focusedIn.current) {
      padRef.current?.focus({ preventScroll: true });
      focusedIn.current = true;
    } else if (!open && focusedIn.current) {
      buttonRef.current?.focus({ preventScroll: true });
      focusedIn.current = false;
    }
  }, [open, inBrowser]);

  /** Focus stays inside the pad while it is up. */
  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const pad = padRef.current;
    if (pad === null) return;
    const focusables = [...pad.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === pad)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /**
   * Runs one signed act: inert at once, saying so past [SETTING_AFTER_MS].
   */
  const runInFlight = async <T,>(origin: Origin, work: () => Promise<T>): Promise<T> => {
    setInFlight(origin);
    setSlow(false);
    slowTimer.current = setTimeout(() => setSlow(true), SETTING_AFTER_MS);
    try {
      return await work();
    } finally {
      if (slowTimer.current !== null) clearTimeout(slowTimer.current);
      slowTimer.current = null;
      setSlow(false);
      setInFlight(null);
    }
  };

  /** A signing was taken: the surfaces close and the face moves. */
  const taken = (landed: StanceLanding, records: number) => {
    announceStanceSigned();
    readBundle({ fresh: true });
    if (variant !== undefined) {
      variant.onTaken();
      return;
    }
    setPending({ pair: landed.landing, severed: landed.severed });
    closeSurfaces();
    setSigned(signedLine(landed.landing, records, landed.severed, target.label, axes));
  };

  /** A signing did not go through: its own surface re-raises it. */
  const notTaken = (origin: Origin, fault: Fault) => {
    if (origin === "confirm") {
      setConfirmFailed(true);
      return;
    }
    // A pad closed while its act was in flight has no surface left to
    // re-raise: the target's row carries it, as a hold's would.
    if (origin === "pad" && openRef.current) setPadFault(fault);
    else
      setRowLine(
        fault === "failed"
          ? { kind: "didntSign", onRetry: () => void signPick(TAP_DEFAULT, "row") }
          : { kind: "writeRule" },
      );
  };

  /**
   * Every commit route lands here: read where the pick puts the bundle,
   * and if the fold says that reaches (0, 0), ask over the parked pad
   * rather than refusing (§8.2) — the walk-back's dialog over a standing,
   * the empty sign's ask over nothing standing. Otherwise sign exactly the
   * pick.
   */
  const signPick = async (chosen: StancePair, origin: "pad" | "row") => {
    if (busy) return;
    setSigned(null);
    setPadFault(null);
    setRowLine(null);
    setConfirmFailed(false);
    setEmptyFailed(false);
    const answer = await runInFlight(origin, async () => {
      const landed = await data.project(seamTarget, chosen);
      if (landed.kind !== "success") return { kind: "failed" as const };
      const { standing, ...landing } = landed.value;
      if (landing.severed) {
        // THE LANDING'S `severed` IS THE PAIR ALONE (StanceProjection.severed):
        // whether it walks something back is the standing's to say, read on
        // the same round trip — no record, or already walked back, is
        // nothing to walk back (jakob 2026-10-21).
        const nothingStands = standing.records === 0 || standing.severed;
        return { kind: nothingStands ? ("empty" as const) : ("severs" as const), landing };
      }
      const committed = await data.commit(seamTarget, chosen);
      if (committed.kind === "success") {
        return { kind: "taken" as const, landing, records: committed.value.records };
      }
      return { kind: hasCode(committed, "WRITE_RULE_FAILED") ? ("writeRule" as const) : ("failed" as const) };
    });
    switch (answer.kind) {
      case "taken":
        taken(answer.landing, answer.records);
        return;
      case "severs":
        // Confirmed, never refused — one record, asked over the pad.
        setConfirming({ pick: chosen, records: 1, alreadySevered: false, landing: answer.landing });
        return;
      case "empty":
        // Asked, never blocked: an empty sign is an ordinary record, so the
        // fold it leaves is (0, 0) and NOT severed.
        setEmptyAsk({ pick: chosen, landing: { ...answer.landing, severed: false } });
        return;
      default:
        notTaken(origin, answer.kind);
    }
  };

  /**
   * `Set it anyway`: the one empty record, signed like any Set. Taken, it is
   * the ordinary path — the surfaces close, the face moves to 🤷 saying
   * nothing, and the ordinary snackbar answers (EmptySignConfirm.md:27).
   * Not taken, the ask stays up with the fault line and Retry (:33).
   */
  const onConfirmEmpty = async () => {
    const asked = emptyAsk;
    if (asked === null || busy) return;
    setEmptyFailed(false);
    const answer = await runInFlight("empty", async () => {
      const outcome = await data.commit(seamTarget, asked.pick);
      return outcome.kind === "success"
        ? { kind: "taken" as const, records: outcome.value.records }
        : { kind: "failed" as const };
    });
    if (answer.kind !== "taken") {
      setEmptyFailed(true);
      return;
    }
    setEmptyAsk(null);
    taken(asked.landing, answer.records);
  };

  /** The explicit walk-back asks over the parked pad, and costs what it stages. */
  const openSeverance = () => {
    setSigned(null);
    setPadFault(null);
    setConfirmFailed(false);
    const records = bundle === null || bundle === undefined ? 0 : bundle.severance.records;
    setConfirming({ pick: null, records, alreadySevered: records === 0, landing: SEVERED });
  };

  const onConfirmSeverance = async () => {
    const asked = confirming;
    if (asked === null || busy) return;
    setConfirmFailed(false);
    const answer = await runInFlight("confirm", async () => {
      if (asked.pick === null) {
        // The walk-back is checked against the standing the reader
        // confirmed; with none known there is nothing to check against.
        if (bundle === null || bundle === undefined) return { kind: "failed" as const };
        const outcome = await data.sever(seamTarget, bundle);
        return outcome.kind === "success"
          ? { kind: "taken" as const, records: outcome.value.records }
          : { kind: "failed" as const };
      }
      const outcome = await data.commit(seamTarget, asked.pick);
      return outcome.kind === "success"
        ? { kind: "taken" as const, records: outcome.value.records }
        : { kind: "failed" as const };
    });
    if (answer.kind !== "taken") {
      // The dialog stays up and says so, its confirm reading Retry.
      notTaken("confirm", "failed");
      return;
    }
    setConfirming(null);
    if (asked.pick === null) {
      announceStanceSigned();
      readBundle({ fresh: true });
      if (variant !== undefined) {
        variant.onTaken();
        return;
      }
      closeSurfaces();
      setSigned(signedLine(SEVERED.landing, answer.records, true, target.label, axes));
      return;
    }
    taken(asked.landing, answer.records);
  };

  /**
   * The considered surface opens AT THE DEFAULT (stance-control.md, jakob
   * 2026-10-05). Opening spends the teaching: whatever opens first is the
   * first open ever, and only the pad carries the lines.
   */
  const openConsidered = (surface: "pad" | "alternates", from: StancePair = TAP_DEFAULT) => {
    setPick(from);
    setSigned(null);
    setPadFault(null);
    setRowLine(null);
    setExplaining(false);
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
    if (mode !== "pad") {
      openConsidered("alternates");
      return;
    }
    // A KEPT PICK REOPENS HOLDING ITSELF while the key is still elsewhere
    // (PadPending.md); otherwise the pad blooms at the default.
    openConsidered("pad", kept !== null && keyAbsent === true ? kept : TAP_DEFAULT);
    askForKey();
  };

  /**
   * WHETHER THE KEY IS HERE is asked as the pad opens, never before: the
   * pad blooms at once and, where the key is elsewhere, the key notice takes
   * the landing line's and the commit row's place (PadKeyAbsent.md).
   */
  const askForKey = () => {
    void data.keyOnDevice().then((present) => setKeyAbsent(!present));
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
    // Captured, so the lift always reaches the target that armed the hold:
    // a finger that slides off and lets go must disarm it.
    const element = event.currentTarget;
    if (typeof element.setPointerCapture === "function") {
      element.setPointerCapture(event.pointerId);
      captured.current = { element, pointerId: event.pointerId };
    }
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      suppressClick.current = true;
      // WITH THE KEY ELSEWHERE THE HOLD OPENS THE PAD, as a tap does, and
      // signs nothing (PadKeyAbsent.md) — a held finger cannot spend a
      // signature this device cannot give.
      void data.keyOnDevice().then((present) => {
        if (present) {
          void signPick(TAP_DEFAULT, "row");
          return;
        }
        setKeyAbsent(true);
        if (mode === "pad") openConsidered("pad", kept ?? TAP_DEFAULT);
        else openConsidered("alternates");
      });
    }, LONG_PRESS_MS);
  };

  /**
   * A press that leaves the target is not a hold on it — the platform's
   * own long press gives up the same way.
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

  /** A lift before the hold's time disarms it; the click that follows is the tap. */
  const onTargetPointerUp = () => {
    clearHold();
    releasePointer();
  };

  // The standing the target wears: what a taken signing projected, or the
  // bundle as last read. A standing nobody has taken, and one this session
  // could not read, both show the "no opinion yet" face.
  // A PICK KEPT PENDING is what the anchor wears while the key is elsewhere
  // (PadPending.md) — never the bundle's resting face, which it has not
  // joined.
  const waitingForKey = kept !== null && keyAbsent === true;
  const restingPair: StancePair | null = waitingForKey
    ? kept
    : pending !== null
      ? pending.pair
      : bundle === null || bundle === undefined || bundle.records === 0
        ? null
        : bundle.current;
  // A resting (0, 0) is walked back only when the bundle — or the signing
  // just taken — says so; otherwise (an empty sign's standing, a kept pick)
  // it says nothing (the master's `restingZero`; PadStanding.md:29).
  const restingSevered = waitingForKey
    ? false
    : pending !== null
      ? pending.severed
      : bundle !== null && bundle !== undefined && bundle.severed;
  const restingFace =
    restingPair === null
      ? null
      : bundleReadout(restingPair, restingSevered ? sever.zero : EMPTY_PICK_LABEL);

  // THE WALK-AWAY NEEDS SOMETHING TO WALK BACK (the master: "SEVER NEEDS
  // SOMETHING TO SEVER"): a bundle that folds records — an empty sign's
  // standing included, whose walk-back costs one record. A walked-back
  // bundle still folds its records, so it keeps the control and its dialog
  // says it is already at nothing. A VARIANT PAD CARRIES NO WALK IT BACK
  // (VouchBackPad.md:11): the vouch-back opens a relationship, it is never
  // the place to leave one.
  const severable =
    variant === undefined && bundle !== null && bundle !== undefined && bundle.records > 0;
  const padNode = variant?.padNode;

  /** Whose in-flight state shows where: the pad's, the row's, the dialog's. */
  const padSetting = inFlight === "pad" && slow;
  const rowState: RowLineState | null =
    inFlight === "row" && slow && confirming === null ? { kind: "signing" } : rowLine;

  const inset = variant?.padInset ?? (barBeneath ? PAD_ABOVE_BAR_INSET_PX : PAD_PARK_INSET_PX);
  const aboveBar = variant?.padInset !== undefined || barBeneath;

  const helpLines =
    explaining === "zero" ? unreachableHelp(axes, target.label) : (variant?.help ?? padHelp(axes));

  const pad = (
    <>
      {/* THE WASH (PadStanding.jsx: "the wash sits over the shell; the
          parked pad stays sharp"). A press on it dismisses and stages
          nothing, and it is what keeps the surface beneath inert while the
          pad is up — the band and the bar included. */}
      <div
        data-testid={`${testIdPrefix}-scrim`}
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault();
          closeAll();
        }}
        className="cg-scrim-in fixed inset-0 z-40 touch-none bg-scrim/50"
      />
      <div
        ref={padRef}
        role="dialog"
        aria-modal="true"
        aria-label={variant?.title ?? `Opinion pad for ${target.label}`}
        tabIndex={-1}
        onKeyDown={trapTab}
        {...testAttributes(padNode, `${testIdPrefix}-pad`)}
        style={parkedPadStyle(inset, aboveBar)}
        className="cg-dialog-in z-40 flex w-[17rem] touch-none flex-col gap-3 overflow-y-auto rounded-extra-large bg-surface-container-high p-4 text-on-surface outline-none"
      >
        {/* The help affordance: a circled `?` in the pad's top-right corner,
            out of the reading order of the three readouts. 48px target,
            32px ring. Its name is the pad's own (ruling A7). */}
        <button
          type="button"
          {...testAttributes(part(padNode, "help"), `${testIdPrefix}-explain`)}
          aria-expanded={explaining === "help"}
          aria-label={variant?.title ?? PAD_HELP_LABEL}
          onClick={() => setExplaining((shown) => (shown === "help" ? false : "help"))}
          className={`${BUTTON_CLASS} absolute right-1 top-1 grid size-12 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0`}
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full border border-outline-variant text-label-large text-primary"
          >
            ?
          </span>
        </button>
        <StanceStanding
          pick={pick}
          bundle={bundle}
          targetLabel={target.label}
          testIdPrefix={testIdPrefix}
          axes={axes}
          node={part(padNode, "standing")}
          className="pr-10"
        />
        {/* The help and the 🤔's explanation REPLACE the field and the
            landing rather than growing below them: the pad is parked, and a
            panel that pushes Set and Cancel away from the thumb defeats the
            parking. */}
        {explaining !== false ? (
          <div data-testid={`${testIdPrefix}-explanation`} className="flex flex-col gap-2">
            {helpLines.map((line) => (
              <p key={line} className="m-0 text-body-small text-on-surface-variant">
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
        ) : (
          <>
            <PairField
              value={pick}
              onChange={setPick}
              axes={axes}
              ranges={STANCE_RANGES}
              ariaLabel={PICK_LABEL}
              testId={`${testIdPrefix}-field`}
              node={part(padNode, "field")}
            />
            {/* The master's `padNote` slot, between the field and the landing
                line: a variant's own line on every open, and the first-ever
                open's two coaching lines. */}
            {variant !== undefined ? (
              <div
                {...testAttributes(part(padNode, "note"), `${testIdPrefix}-note`)}
                className="flex flex-col gap-1"
              >
                <p className="m-0 text-body-small text-on-surface-variant">{variant.note}</p>
                {coaching && <StanceCoaching testId={`${testIdPrefix}-coaching`} />}
              </div>
            ) : (
              coaching && <StanceCoaching testId={`${testIdPrefix}-coaching`} />
            )}
            {padFault !== "writeRule" && keyAbsent !== true && (
              <StanceLandingLine
                landing={landing}
                testIdPrefix={testIdPrefix}
                axes={axes}
                borrowed={borrowed}
                onExplainZero={() => setExplaining("zero")}
                node={part(padNode, "landing")}
              />
            )}
          </>
        )}
        {/* THE WRITE RULE REFUSED SET (PadWriteRule.md): the notice stands
            where the landing line and the commit row would, with its own "?"
            and `Not now` under it. No Retry — asking again at once meets the
            same answer — and no pick is kept. */}
        {padFault === "writeRule" && (
          <>
            <div
              data-testid={`${testIdPrefix}-write-rule`}
              role="status"
              className="flex flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
            >
              <div className="flex items-center gap-2">
                <h3 className="m-0 flex-1 text-title-medium">{WRITE_RULE_TITLE}</h3>
                <HelpDot
                  ariaLabel={WRITE_RULE_HELP}
                  onOpen={() => setNoticeHelp(HELP_TOPICS.whySigningWaitsOnPad)}
                  testId={`${testIdPrefix}-write-rule-help`}
                  variant="inverse"
                />
              </div>
              <p className="m-0 text-body-medium">{WRITE_RULE_PAD_FACT}</p>
            </div>
            <button
              type="button"
              data-testid={`${testIdPrefix}-not-now`}
              onClick={closeAll}
              className={`w-full ${buttonClassName({ variant: "text" })}`}
            >
              Not now
            </button>
          </>
        )}
        {/* THE KEY IS ELSEWHERE (PadKeyAbsent.md): the pad opened anyway and
            the pick is still made; the notice stands where the landing line
            and the actions would — no Set, no Cancel, no Walk it back — in
            the tertiary container, never the error colour. Only `Keep it
            pending, restore later` keeps the pick; the wash, Back and Escape
            drop it as Cancel would. */}
        {keyAbsent === true && explaining === false && (
          <>
            <div
              data-testid={`${testIdPrefix}-key-absent`}
              className="flex flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
            >
              <div className="flex items-center gap-2">
                <h3 className="m-0 flex-1 text-title-medium">Your key isn&apos;t on this browser</h3>
                <HelpDot
                  ariaLabel="Your key"
                  onOpen={() => setNoticeHelp(HELP_TOPICS.yourKey)}
                  testId={`${testIdPrefix}-key-help`}
                  variant="inverse"
                />
              </div>
              <p className="m-0 text-body-medium">
                Signing needs your key, which isn&apos;t in this browser — the write waits as pending.
              </p>
              <p className="m-0 text-body-medium">Restore the key with your recovery code to finish.</p>
              <Link
                href="/restore"
                data-testid={`${testIdPrefix}-restore`}
                className={pillClassName({ variant: "inverse", full: true })}
              >
                Restore the key
              </Link>
            </div>
            <button
              type="button"
              data-testid={`${testIdPrefix}-keep-pending`}
              onClick={() => {
                keep(pick);
                closeAll();
              }}
              className={`w-full ${buttonClassName({ variant: "text" })}`}
            >
              Keep it pending, restore later
            </button>
          </>
        )}
        {/* A SIGNING THAT DID NOT GO THROUGH says so above the commit row, in
            the failure voice, and Set's slot becomes the outlined Retry — the
            same commitment asked again. */}
        {padFault === "failed" && (
          <TransportError testId={`${testIdPrefix}-pad-failed`} message="That didn't send. Try again." />
        )}
        {padFault !== "writeRule" && keyAbsent !== true && (
          // ONE ROW: the walk-away on the left, pushed away from the two
          // decisions on the right — a walk-away beside a commit is a misfire
          // waiting to happen.
          <div className="flex items-center justify-end gap-2">
            {severable && (
              <button
                type="button"
                {...testAttributes(part(padNode, "sever"), `${testIdPrefix}-sever`)}
                onClick={openSeverance}
                className={`mr-auto ${buttonClassName({ variant: "text", size: "sm" })}`}
              >
                {sever.control}
              </button>
            )}
            <button
              type="button"
              {...testAttributes(part(padNode, "cancel"), `${testIdPrefix}-cancel`)}
              onClick={closeAll}
              className={buttonClassName({ variant: "text", size: "sm" })}
            >
              Cancel
            </button>
            {/* The only thing on the pad that signs anything — never through
                the help, whose field is not there to check against. Inert
                while in flight, refusing a second press without dimming. */}
            <button
              type="button"
              {...testAttributes(part(padNode, "set"), `${testIdPrefix}-set`)}
              disabled={explaining !== false}
              aria-disabled={busy || undefined}
              aria-busy={padSetting || undefined}
              onClick={() => {
                if (busy) return;
                void signPick(pick, "pad");
              }}
              className={buttonClassName({
                variant: padFault === "failed" ? "outline" : "primary",
                size: "sm",
              })}
            >
              {padSetting ? "Setting…" : padFault === "failed" ? "Retry" : "Set"}
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    // The control owns its touches (§8.3): nothing it receives — the
    // portalled pad included, whose events bubble through this tree — reaches
    // the card or the link behind it.
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
                ? `Give your opinion on ${target.label}`
                : waitingForKey
                  ? `Your opinion on ${target.label}, waiting for your key: ${restingFace.label}, ${formatStancePair(restingPair)}.`
                  : `Your opinion on ${target.label}: ${restingFace.label}, ${formatStancePair(restingPair)}. Press and hold to add a positive one.`
            }
            aria-busy={inFlight === "row" || undefined}
            onClick={onTap}
            onPointerDown={onPointerDown}
            onPointerMove={onTargetPointerMove}
            onPointerUp={onTargetPointerUp}
            onPointerCancel={onTargetPointerUp}
            // A long press is the shortcut, so the platform must not take
            // it for a selection or a context menu first.
            onContextMenu={(event) => event.preventDefault()}
            className={`${BUTTON_CLASS} flex min-h-12 min-w-12 cursor-pointer touch-none select-none items-center justify-center gap-2 rounded-full border-0 bg-transparent px-3 text-label-large text-primary [-webkit-touch-callout:none]`}
          >
            {/* Never a bare word: a viewer with no bundle gets a face outside
                the table, muted and translucent — the control visibly waiting
                to be given a value, never the shrug a zero opinion owns. The
                anchor's words are not drawn; they ride the accessible name. */}
            <span className="relative inline-grid flex-none place-items-center">
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
              {holding && <HoldRing testId={`${testIdPrefix}-hold-ring`} />}
            </span>
            {restingPair !== null && (
              // NEVER WRAPS — the affordance row is one line by rule. The
              // face is the default reading and these numbers the geek one;
              // the accessible name carries the values in both modes.
              <span
                aria-hidden="true"
                {...testAttributes(part(node, "anchor.exact"), `${testIdPrefix}-resting-exact`)}
                className="cg-exact flex-none whitespace-nowrap text-body-small text-on-surface-variant"
              >
                {formatStancePair(restingPair)}
              </span>
            )}
          </button>
          {/* The non-drag equivalent, present whatever the stored input is
              (§8.6, §10) — visually hidden until focused, and named for its
              target so a page with several controls never repeats one
              anonymous name (the master's `Choose your opinion on {label}`). */}
          {phase === "signedIn" && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-choose`}
              disabled={busy}
              onClick={() => openConsidered("alternates")}
              className={`sr-only focus:not-sr-only ${buttonClassName({ variant: "text", size: "sm" })}`}
            >
              Choose your opinion on {target.label}
            </button>
          )}
        </div>
      )}
      {/* THE ROW LINE (RowSigning.md, RowWriteRule.md): the hold's wait past
          200ms, its failure with Retry, or the write rule's quiet notice —
          under the face, in the slot the pending marker uses. */}
      {/* A PICK KEPT PENDING says what it waits on, under the face — never
          `Still settling`, which is a signed record's (PadPending.md). */}
      {padOnly === undefined && waitingForKey && (
        <PendingMarker testId={`${testIdPrefix}-kept`} label="Waiting for your key" />
      )}
      {padOnly === undefined && rowState !== null && (
        <RowLine state={rowState} testId={`${testIdPrefix}-row-line`} />
      )}

      {open && inBrowser && createPortal(pad, document.body)}

      {alternates && (
        <StanceAlternates
          mode={mode}
          pick={pick}
          onPick={setPick}
          busy={busy}
          fault={padFault}
          onCommit={() => void signPick(pick, "pad")}
          onCancel={closeAll}
          onSever={severable ? openSeverance : undefined}
          axes={axes}
          helpLabel={variant?.title ?? PAD_HELP_LABEL}
          zeroHelp={explaining === "zero" ? unreachableHelp(axes, target.label) : null}
          onZeroBack={() => setExplaining(false)}
          landing={
            <StanceLandingLine
              landing={landing}
              testIdPrefix={testIdPrefix}
              axes={axes}
              borrowed={borrowed}
              onExplainZero={() => setExplaining("zero")}
              zeroShown={explaining === "zero"}
            />
          }
        >
          <StanceStanding
            pick={pick}
            bundle={bundle}
            targetLabel={target.label}
            testIdPrefix={testIdPrefix}
            axes={axes}
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
          busy={inFlight === "confirm"}
          slow={inFlight === "confirm" && slow}
          failed={confirmFailed}
          axes={axes}
          onCancel={() => {
            setConfirming(null);
            setConfirmFailed(false);
          }}
          onConfirm={() => void onConfirmSeverance()}
        />
      )}

      {/* THE EMPTY SIGN'S ASK, over the parked pad (EmptySignConfirm.md):
          never the walk-back's dialog, never a block. */}
      {emptyAsk !== null && (
        <EmptySignConfirm
          targetLabel={target.label}
          vouchIn={vouchesIn}
          busy={inFlight === "empty"}
          slow={inFlight === "empty" && slow}
          failed={emptyFailed}
          onCancel={() => {
            setEmptyAsk(null);
            setEmptyFailed(false);
          }}
          onConfirm={() => void onConfirmEmpty()}
        />
      )}

      {/* Mounted only when asked for, as the join prompt is. */}
      {noticeHelp !== null && (
        <HelpDialog
          open
          onClose={() => setNoticeHelp(null)}
          topic={noticeHelp}
          testId={`${testIdPrefix}-notice-help`}
        />
      )}

      {/* Fired once per completed action (design.md §6), and mounted
          whether or not it has anything to say so the announcement is
          heard when it does. Never a failure. */}
      <Snackbar message={signed} onDismiss={() => setSigned(null)} testId={`${testIdPrefix}-signed`} />

      {/* Mounted only when asked for: a read surface renders many of
          these controls, and an always-present dialog per card is a
          dialog per card in the DOM. */}
      {joinPrompt && <JoinPrompt open onClose={() => setJoinPrompt(false)} />}
    </div>
  );
}
