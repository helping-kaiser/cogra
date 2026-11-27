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
// THE FIRST-EVER OPEN SAYS ONE LINE: `Nothing is signed until Set.` closes
// with the pad and never shows again; the shortcut is said in the vouch-back
// pad's "?" (copy-voice, jakob 2026-11-12).
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
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { hasCode, type Outcome } from "@/lib/api/outcome";
import { useStanceInputMode } from "@/lib/stance/input-mode";
import { bundleReadout, EMPTY_PICK_LABEL, RESTING_FACE_EMOJI } from "@/lib/stance/anchors";
import { keepPick, sameTarget, useKeptPicks, type KeptFamily } from "@/lib/stance/kept-picks";
import { useOpenKeptPicks } from "@/lib/stance/kept-picks-route";
import { localLanding } from "@/lib/stance/landing";
import { ORIGIN, TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { STANCE_RANGES } from "@/lib/stance/pad-geometry";
import { useStanceData } from "@/lib/stance/provider";
import { announceStanceSigned } from "@/lib/stance/signed-events";
import { useKeptBatchSigning } from "@/lib/stance/kept-batch";
import { clearSettling, useSettling } from "@/lib/stance/settling";
import { useStanceTaught } from "@/lib/stance/stance-coach";
import type {
  BorrowedStance,
  CommitSource,
  StanceBundle,
  StanceCommit,
  StanceLanding,
  StanceTargetRef,
} from "@/lib/stance/stance-data";
import { useActiveAccountId, useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { OPINION_LOCKED, useReaderIsApplicant } from "@/lib/session/reader-state";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { BUTTON_CLASS, buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { KeyAbsentNotice } from "@/lib/ui/key-absent-notice";
import {
  PAD_ABOVE_BAR_INSET_PX,
  PAD_PARK_INSET_PX,
  parkedPadStyle,
  useBarBeneath,
} from "@/lib/ui/pad-parking";
import { EmptySignConfirm } from "@/lib/ui/empty-sign-confirm";
import { swallowRestOfGesture } from "@/lib/ui/outside-press";
import { PendingMarker } from "@/lib/ui/pending-marker";
import { RowLine, SIGNING_ROW, type RowLineState } from "@/lib/ui/row-line";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import {
  padHelp,
  PressAndHoldLine,
  StanceFirstOpenLine,
  unreachableHelp,
  type PadHelpLine,
} from "@/lib/ui/stance-pad-help";
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
import {
  NO_ANSWER_LINE,
  NOT_THROUGH_LINE,
  outcomeFaultLine,
  UNVERIFIED_LINE,
} from "@/lib/ui/error-messages";
import { WriteRuleNotice } from "@/lib/ui/write-rule-notice";
import { PairField } from "@/lib/ui2/compose/pair-field";
import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { HELP_TOPICS, HelpDialog, type HelpTopic } from "@/lib/ui2/help-dialog";

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

/**
 * An act a dialog over the pad signs, as it was confirmed — what the row's
 * Retry asks again once the dialog was closed while it signed: the walk-back
 * over the standing the reader was shown, or exactly the pick.
 */
type DialogAct =
  | { readonly kind: "walkBack"; readonly shown: StanceBundle }
  | { readonly kind: "pick"; readonly pick: StancePair; readonly landing: StanceLanding };

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

/**
 * What did not go through on a surface: no answer (`failed`), an answered
 * fault of the whole act (`notThrough` — FORBIDDEN, INTERNAL,
 * SIGNATURE_INVALID, a fieldless BAD_INPUT — or `unverified`,
 * EMAIL_NOT_VERIFIED; NetworkError.md:13-19: an answer, so never the
 * no-answer line), or the write rule's notice.
 */
type Fault = "failed" | "notThrough" | "unverified" | "writeRule";

/** The faults that re-raise their surface with Retry. */
const retries = (fault: Fault | null): boolean => fault !== null && fault !== "writeRule";

/** The line a retrying fault says above its commit (copy-voice, *Faults by code*). */
const retryLine = (fault: Fault | null): string =>
  fault === "notThrough" ? NOT_THROUGH_LINE : fault === "unverified" ? UNVERIFIED_LINE : NO_ANSWER_LINE;

/** A refused commit's fault: the write rule's notice, an answered whole-act fault, else no answer. */
function refusalFault(outcome: Outcome<unknown>): Fault {
  if (hasCode(outcome, "WRITE_RULE_FAILED")) return "writeRule";
  const line = outcomeFaultLine(outcome);
  return line === UNVERIFIED_LINE ? "unverified" : line === NOT_THROUGH_LINE ? "notThrough" : "failed";
}

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
  /**
   * The pad's title and its ?'s name (VouchBackPad.md:9). A variant that
   * names only its ? (`helpLabel`) keeps the ordinary pad's own name.
   */
  readonly title?: string;
  /**
   * The ?'s name where it differs from the pad's (the approval pads'
   * `How vouching works`, ApprovePad.md:19 — the master's `helpLabel`).
   */
  readonly helpLabel?: string;
  /** The help that replaces the pad's body in place (:21); a line may be the press-and-hold one. */
  readonly help: readonly PadHelpLine[];
  /**
   * The line — or lines — above the field's foot on every open of this
   * variant (:13; the approval pads' two lines, ApprovePad.md:17).
   */
  readonly note: string | readonly string[];
  /**
   * A signing was taken — by Set or by the hold — landing at `landing`. The
   * host routes on (the ceremony, :33; ProfileOther.md:37), so the master's
   * own snackbar does not also answer: the host's replaces it.
   */
  readonly onTaken: (landing: StancePair) => void;
  /**
   * What `Keep it pending, restore later` does, where the host keeps the pick
   * itself (the ask link's pad stages the asker before keeping their vouch,
   * VouchAskPad.md:29). Left out, the pick is kept toward the target.
   */
  readonly keep?: (pick: StancePair) => void;
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
/**
 * THE RESTING FACE'S TYPE (`StanceControl.jsx`: the face takes title-large's
 * size, tracking and weight, `lineHeight: 1`): the whole title-large role set
 * solid — never the anchor button's label-large weight and tracking, which a
 * size-only face would inherit.
 */
const FACE_TYPE = "text-title-large [line-height:1]";

/**
 * THE ANCHOR IN ITS MEDIA DRESS (`StanceControl.jsx` `OVER_MEDIA_ANCHOR`): the
 * stream rail's 56 × 44 slot, white, under the rail's own shadow — kept equal
 * to `ReelRail`'s RAIL_SHADOW. Inline, so it outranks the anchor's utilities.
 */
const OVER_MEDIA_ANCHOR: CSSProperties = {
  width: "56px",
  height: "44px",
  minWidth: "56px",
  minHeight: "44px",
  padding: 0,
  border: 0,
  background: "none",
  color: "#fff",
  filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.75))",
};

/**
 * STATE AN ACT KEEPS BESIDE THE ACCOUNT THAT PRESSED IT (auth.md
 * "Multi-account device custody": bound "to the account it belongs to, never
 * to a device-global slot"). Several accounts share a tab and a page stays
 * mounted through another tab's switch, so the control reads only the
 * active account's entry: another's is hidden, never erased, and stands again
 * under its own account. Setting null removes the owner's entry alone.
 */
function useOwned<T>(): readonly [
  ReadonlyMap<string | null, T>,
  (owner: string | null, update: T | null | ((current: T | undefined) => T | null)) => void,
] {
  const [owned, setOwned] = useState<ReadonlyMap<string | null, T>>(() => new Map());
  const setOf = useCallback(
    (owner: string | null, update: T | null | ((current: T | undefined) => T | null)) =>
      setOwned((current) => {
        const value =
          typeof update === "function"
            ? (update as (current: T | undefined) => T | null)(current.get(owner))
            : update;
        if (value === null && !current.has(owner)) return current;
        if (value !== null && current.get(owner) === value) return current;
        const next = new Map(current);
        if (value === null) next.delete(owner);
        else next.set(owner, value);
        return next;
      }),
    [],
  );
  return [owned, setOf] as const;
}

const HOLD_RING_PX = 40;
const HOLD_RING_STROKE_PX = 4;

/**
 * The ring: filling over the hold, or — `closed` — standing whole and still
 * around the face while the row's act signs (the master's `progress={1}`).
 */
function HoldRing({ testId, closed = false }: { testId: string; closed?: boolean }) {
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
        strokeDashoffset={closed ? 0 : circumference}
      >
        {!closed && (
          <animate
            attributeName="stroke-dashoffset"
            from={circumference}
            to="0"
            dur={`${LONG_PRESS_MS}ms`}
            fill="freeze"
          />
        )}
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
  wide = false,
  overMedia = false,
  lineNode,
  padNode: plainPadNode,
}: {
  /**
   * The registered pad of a plain (non-variant) pad (`tagPage.actionRow.stance.pad`,
   * TagPageHeldPad): the pad and the parts this control draws itself wear its
   * paths, as a variant's `padNode` does. A variant's own wins.
   */
  padNode?: DataNode;
  /**
   * The registered node of the row line this control raises, where its board
   * names one (`reel.rail.stanceLine`, ReelRail.jsx: the face's line is the
   * placer's own, a sibling of the stance node — never its part). Its Retry
   * is the line's `retry`.
   */
  lineNode?: DataNode;
  /**
   * THE MEDIA DRESS (`StanceControl.jsx` `overMedia`; the stream's rail): the
   * anchor is the rail's white 56 × 44 slot, the unset state a line face, and
   * the hold's row line stands beside the face on the stream's plate. The
   * tap, the hold, the pad and its seal are unchanged.
   */
  overMedia?: boolean;
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
  padOnly?: {
    readonly onClose: () => void;
    /**
     * The pad blooms FROM an anchor the host shows in its place — the
     * approval pad's, standing in the row's close slot while the pad is up
     * (ApprovePad.md:15) — so the resting anchor stays drawn.
     */
    readonly keepAnchor?: boolean;
  };
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
  /**
   * THE WIDE ANCHOR (the master's `wide`, profile round 2026-09-01): the
   * presentational variant a profile header wears — the same anchor stretched
   * to the row in the outline button's clothes, the words `Your opinion`
   * drawn beside the face where there is no pair to show, because there the
   * opinion IS the row's one action and a lone face at full width reads as
   * lost. Tap, hold, pad and severance are unchanged.
   */
  wide?: boolean;
}) {
  const data = useStanceData();
  const phase = useAuthPhase();
  const accountId = useActiveAccountId();
  /** The session's token store, read live where a press must know whose it is. */
  const sessionStore = useTokenStore();
  // AN APPLICANT'S FACE IS LOCKED, NOT GONE (ruling PR-103; ApplicantFeed.md:45-53,
  // ProfileOther.md:45-49; the master's `anchorOpacity`): the disabled
  // opacity, still tappable, a tap or a hold answering OPINION_LOCKED, the
  // pad never blooming. Answered here, in the one control every face is, so
  // no host wires it. The application's own vouch flow stays live (PR-103's
  // carve-out): a pad-only host is the vouch-back gesture, and `vouchesIn`
  // is the approval and the ask link's vouch.
  const locked =
    useReaderIsApplicant() && phase === "signedIn" && padOnly === undefined && !vouchesIn;
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
  //
  // THE READ IS THE READER'S (`useOwned`): each account's own standing is
  // kept beside it, so another tab's account change never leaves the last
  // account's standing on the face, not even until the next read answers.
  const [owns, setOwnOf] = useOwned<{ value: BundleState }>();
  const own = owns.get(accountId) ?? null;
  const bundle: BundleState = own !== null ? own.value : suppliedBundle;

  // A pad-only host is the opening gesture itself, so the control mounts
  // already open, exactly as `openConsidered` below would leave it.
  const [open, setOpen] = useState(padOnly !== undefined && mode === "pad");
  const [alternates, setAlternates] = useState(padOnly !== undefined && mode !== "pad");
  /** This open is the account's first-ever, so the pad carries its one first-open line. */
  const [coaching, setCoaching] = useState(padOnly !== undefined && mode === "pad" && !taught);
  /** False, the "?"'s help, or the unreachable landing's 🤔 explanation. */
  const [explaining, setExplaining] = useState<false | "help" | "zero">(false);
  const [pick, setPick] = useState<StancePair>(TAP_DEFAULT);
  /** What did not go through from the open pad or the alternates. */
  const [padFault, setPadFault] = useState<Fault | null>(null);
  /**
   * What did not go through from the hold, on the target's own row — kept
   * beside the account that pressed (`useOwned`): never erased by a switch,
   * since it "stands until Retry is pressed, another act is made on the same
   * anchor, or the surface's next fresh load" (RowSigning.md), and an account
   * change is none of these.
   */
  const [rowLines, setRowLineOf] = useOwned<RowLineState>();
  const rowLine = rowLines.get(accountId) ?? null;
  /**
   * A signed act in flight, where it was made, and whether it has waited past
   * [SETTING_AFTER_MS] — the pressing account's (`useOwned`): its wait and its
   * inert anchor stand only under that account, and another account's anchor
   * is its own to use meanwhile.
   */
  const [flights, setFlightOf] = useOwned<{ readonly origin: Origin; readonly slow: boolean }>();
  const flight = flights.get(accountId) ?? null;
  const inFlight = flight?.origin ?? null;
  const slow = flight?.slow ?? false;
  /** The face, ringed while a hold is under way. */
  const [holding, setHolding] = useState(false);
  /**
   * The hold reached 500ms and its answer — the key's, then the signing's —
   * is being asked: the ring stays closed (RowSigning.md:35, "the ring stays
   * closed AND the signing begins"), the lift notwithstanding, until the
   * row's wait carries it or the hold opens a surface instead.
   */
  const [holdReached, setHoldReached] = useState(false);
  /**
   * Where a TAKEN signing put the standing, as the fold projected it. It
   * holds the resting target until a fresh read replaces it — never before
   * the signature is taken (RowSigning.md: "NEVER the face moves before").
   * The signing account's (`useOwned`): another account's face never wears it.
   */
  const [pendings, setPendingOf] = useOwned<Pending>();
  const pending = pendings.get(accountId) ?? null;
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  /** What did not go through from the walk-back's dialog, if anything. */
  const [confirmFault, setConfirmFault] = useState<Fault | null>(null);
  const [emptyAsk, setEmptyAsk] = useState<EmptyAsk | null>(null);
  /** What did not go through from the empty sign's ask, if anything. */
  const [emptyFault, setEmptyFault] = useState<Fault | null>(null);
  /** The snackbar confirming a taken signing — the signing account's (`useOwned`). */
  const [signeds, setSignedOf] = useOwned<ReactNode>();
  const signed = signeds.get(accountId) ?? null;
  const [joinPrompt, setJoinPrompt] = useState(false);
  /** The dialog a notice's own "?" opens over the pad, if any. */
  const [noticeHelp, setNoticeHelp] = useState<HelpTopic | null>(null);
  /** The signing key is not on this device — null until asked. */
  const [keyAbsent, setKeyAbsent] = useState<boolean | null>(null);
  /** The account has a recovery backup — asked once the key is known to be elsewhere. */
  const [backedUp, setBackedUp] = useState<boolean | null>(null);
  const openKeptPicks = useOpenKeptPicks();

  const busy = inFlight !== null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Each pressing account's [SETTING_AFTER_MS] timer. */
  const slowTimers = useRef(new Map<string | null, ReturnType<typeof setTimeout>>());
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
  /** A dialog over the pad is up — the walk-back's or the empty sign's. */
  const dialogUp = confirming !== null || emptyAsk !== null;
  /** Whether it is up right now — read when the act it sent answers. */
  const dialogUpRef = useRef(dialogUp);
  useEffect(() => {
    dialogUpRef.current = dialogUp;
  }, [dialogUp]);

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
  // THIS SURFACE'S COMMITS ARE ITS OWN (stance-attempts.ts `claim`): two
  // surfaces can show the same target, and each one's Retry asks the signing
  // it made, never the other's (SigningAfterClose.md:27).
  const [commitSource] = useState<{ readonly source: CommitSource }>(() => ({ source: {} }));

  // WHAT A PICK KEPT HERE WILL SIGN AS (KeptPicksReview.md:5): a vouch-back
  // or an approval is kept as itself, never as a plain opinion, so the
  // review's batch never takes it in.
  const family: KeptFamily = vouchesIn ? "approval" : variant !== undefined ? "vouchBack" : "opinion";
  const keptPicks = useKeptPicks(phase === "signedIn" ? accountId : null);
  const keptEntry =
    keptPicks?.find((entry) => entry.family === family && sameTarget(entry.target, seamTarget)) ?? null;
  const kept = keptEntry?.pick ?? null;
  const keep = (chosen: StancePair) => {
    if (accountId !== null) void keepPick(accountId, seamTarget, chosen, family);
  };
  // A kept pick asks once whether the key is back: with it elsewhere the
  // anchor waits for the key (PadPending.md); with it here, for the review
  // (PadPendingReview.md).
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
  // WITH THE KEY ELSEWHERE, IS THERE A BACKUP TO RESTORE FROM? Asked once, the
  // first time the key is known to be away (KeyElsewhereNoBackup.md).
  useEffect(() => {
    if (keyAbsent !== true || backedUp !== null) return undefined;
    let live = true;
    void data.keyBackedUp().then((backed) => {
      if (live) setBackedUp(backed);
    });
    return () => {
      live = false;
    };
  }, [keyAbsent, backedUp, data]);

  // THE KEPT PICKS JUST SIGNED SETTLE UNDER THEIR FACE (PadPendingReview.md:21):
  // `Still settling` until a read that leaves pending records out counts them
  // all — the record is ordered.
  const settling = useSettling(seamTarget);
  // THE KEPT PICKS' SEAL CLOSED WHILE ITS BATCH SIGNS (KeptPicksSeal.md:59,
  // :63): each target's row reads `Signing…` under its face until the batch
  // answers; its failure stands on Settings' row, never here.
  const keptBatchSigning = useKeptBatchSigning(seamTarget);

  const readBundle = useCallback(
    (options: { fresh?: boolean } = {}) => {
      if (phase !== "signedIn" || accountId === null) return;
      // A supplied bundle is the host's to keep current, except right
      // after this control wrote — then the control has to see its own
      // work rather than the copy the host read before it.
      if (suppliedBundle !== undefined && options.fresh !== true) return;
      // Every signed gesture re-reads; the generation drops an older read
      // that answers after a newer one, so the standing never goes back.
      const generation = ++bundleRead.current;
      // The read is the session's account's — the live one, which a taken
      // act's re-read may meet changed — so it answers that account's own
      // standing and projection only.
      const by = sessionStore.activeAccountId();
      void data.bundle(seamTarget, { fresh: options.fresh }).then((outcome) => {
        if (generation !== bundleRead.current) return;
        // A failed standing read leaves the control usable: it degrades to
        // "no standing known" rather than blanking the affordance, and
        // the projected standing stays up — it is the last thing known
        // about the gesture the reader just made.
        if (outcome.kind !== "success") {
          // Never trade a standing that is known for one that is not: a
          // transient fault on a re-read must not blank a good reading.
          setOwnOf(by, (current) => current ?? { value: suppliedBundle ?? null });
          return;
        }
        setOwnOf(by, { value: outcome.value });
        setPendingOf(by, null);
      });
    },
    // `accountId`: another tab's account change reads the next account's
    // standing at once (the effect below re-runs on a new read).
    [data, phase, accountId, suppliedBundle, seamTarget, sessionStore, setOwnOf, setPendingOf],
  );

  useEffect(() => {
    readBundle();
  }, [readBundle]);

  // A GUEST'S ANCHOR SPEAKS THE VIEWPOINT'S NAME (stance-control.md, *A
  // guest's view*: the vantage law; FeedBare.md:9, TagPage.md:75-79,
  // ProfileOther.md:59-63; the master's `anchorName`): every anchor, wide and
  // narrow, is `@genesis_mod's opinion on …`, and the wide one draws
  // `@genesis_mod's opinion` where `Your opinion` would stand. Only a guest's:
  // a signed-in reader's anchor is their own, whoever's view their feed still
  // borrows ("only a nobody borrows stances", seam 430.1). Only an opinion's
  // anchor: a vouch or an approval is the reader's own act, never the view's.
  const lends = phase === "signedOut" && family === "opinion" && padOnly === undefined;
  const [vantage, setVantage] = useState<{ handle: string | null } | null>(null);
  useEffect(() => {
    if (!lends) return undefined;
    let live = true;
    void data.borrowedViewHandle().then((handle) => {
      if (live) setVantage({ handle });
    });
    return () => {
      live = false;
    };
  }, [lends, data]);
  /** The borrowed view's handle, once the read named one. */
  const guestHandle = lends ? (vantage?.handle ?? null) : null;

  // A GUEST'S FACE WEARS THE BORROWED VIEW'S OWN STANCE (FeedBare.md:7,
  // TagPage.md:73, GuestGate.md:11): read-only, at the member's anchor
  // geometry, the hollow face where that view holds none. DISPLAY ONLY — it
  // lives in this state and nowhere else: never the bundle the pad, the
  // landing or the walk-back read, never a kept pick, never a node id.
  const [lent, setLent] = useState<{ value: BorrowedStance | null } | null>(null);
  useEffect(() => {
    if (!lends) return undefined;
    let live = true;
    void data.borrowedStance(seamTarget).then((outcome) => {
      // A read that did not answer is the hollow face, as today.
      if (live) setLent({ value: outcome.kind === "success" ? outcome.value : null });
    });
    return () => {
      live = false;
    };
  }, [lends, data, seamTarget]);
  /**
   * The borrowed stance the face wears — only while the reader is a guest,
   * and only once the view is named: a held face nobody owns would read as
   * the reader's own.
   */
  const borrowedFace = lends && guestHandle !== null ? (lent?.value ?? null) : null;

  // Settling ends when the ordered read has caught up with the pending one.
  const settledRecords = bundle === null || bundle === undefined ? null : bundle.records;
  useEffect(() => {
    if (!settling || settledRecords === null || phase !== "signedIn") return undefined;
    let live = true;
    void data.bundle(seamTarget, { includePending: false, fresh: true }).then((ordered) => {
      if (live && ordered.kind === "success" && ordered.value.records >= settledRecords) {
        clearSettling(seamTarget);
      }
    });
    return () => {
      live = false;
    };
  }, [settling, settledRecords, phase, data, seamTarget]);

  // THE PAD-ONLY HOST'S OPEN ASKS FOR THE KEY the way a tap's does
  // (PadKeyAbsent.md; ApprovePad.md:39): the pad mounts already open, so with
  // the key elsewhere the notice must stand in place of Set from the first
  // frame it can — never a Set that could only fail at the signature.
  const padOnlyHost = padOnly !== undefined;
  useEffect(() => {
    if (!padOnlyHost) return undefined;
    let live = true;
    void data.keyOnDevice().then((present) => {
      if (live) setKeyAbsent(!present);
    });
    return () => {
      live = false;
    };
  }, [padOnlyHost, data]);

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
  useEffect(() => {
    const timers = slowTimers.current;
    return () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      for (const timer of timers.values()) clearTimeout(timer);
      holdTimer.current = null;
      timers.clear();
      bundleRead.current += 1;
    };
  }, []);

  /**
   * Where the pick lands the bundle, folded locally against the SERVED raw
   * sums and recomputed on every pointer move. Null until the standing is
   * known — a landing needs a bundle to land in.
   */
  const landing: StanceLanding | null =
    !considered || bundle === undefined || bundle === null
      ? null
      : // Nothing stands when no record ever has, or the bundle is walked
        // back: a (0, 0) landing there is the empty sign's, read as one.
        localLanding(bundle.rawSum, pick, bundle.records === 0 || bundle.severed);

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
    // The first-open line closes with the pad and never shows again.
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

  /** `Keep it pending, restore later`: the one way a pick is kept (PadKeyAbsent.md:27). */
  const keepAndClose = () => {
    if (variant?.keep !== undefined) variant.keep(pick);
    else keep(pick);
    closeAll();
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

  // AN ACCOUNT CHANGE CLOSES THE CONSIDERED SURFACES, as `Close` closes them
  // (PadFailed.md: "WHEN tap Close GIVEN Set is waiting on its signing -> the
  // pad closes AND the act goes on"; SeveranceConfirm.md, EmptySignConfirm.md
  // the same): the pad and its dialogs carry the account's pick, so they are
  // never another account's to press. An act they started goes on, carried by
  // its own account's row. A first account arriving (a guest signing in, a
  // hydration) is no change.
  const onAccountChanged = useEffectEvent(() => {
    setConfirming(null);
    setConfirmFault(null);
    setEmptyAsk(null);
    setEmptyFault(null);
    setNoticeHelp(null);
    if (openRef.current) closeAll();
  });
  const shownAccount = useRef(accountId);
  useEffect(() => {
    const previous = shownAccount.current;
    shownAccount.current = accountId;
    if (previous !== null && previous !== accountId) onAccountChanged();
  }, [accountId]);

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
   * Runs one signed act of `by`'s: inert at once, saying so past
   * [SETTING_AFTER_MS] — under `by` only.
   */
  const runInFlight = async <T,>(origin: Origin, by: string | null, work: () => Promise<T>): Promise<T> => {
    const timers = slowTimers.current;
    const prior = timers.get(by);
    if (prior !== undefined) clearTimeout(prior);
    setFlightOf(by, { origin, slow: false });
    timers.set(
      by,
      setTimeout(() => setFlightOf(by, { origin, slow: true }), SETTING_AFTER_MS),
    );
    try {
      return await work();
    } finally {
      clearTimeout(timers.get(by));
      timers.delete(by);
      setFlightOf(by, null);
    }
  };

  /** Whether the tab is still signed in as `by` — the account an act was pressed as. */
  const stillAs = (by: string | null) => sessionStore.activeAccountId() === by;

  /**
   * A signing of `by`'s was taken: the face moves and the snackbar confirms
   * it, under `by` only; the surfaces close if they are still `by`'s (an
   * account change closed `by`'s already, and another's are its own).
   */
  const taken = (landed: StanceLanding, records: number, by: string | null) => {
    announceStanceSigned();
    readBundle({ fresh: true });
    if (variant !== undefined) {
      variant.onTaken(landed.landing);
      return;
    }
    setPendingOf(by, { pair: landed.landing, severed: landed.severed });
    if (stillAs(by)) closeSurfaces();
    setSignedOf(by, signedLine(landed.landing, records, landed.severed, target.label, axes));
  };

  /**
   * A signing did not go through: its own surface re-raises it. `sent` is the
   * pick that was sent, so a row's Retry asks THAT act again — the hold's
   * default after a hold, the pick after a Set whose pad was cancelled while
   * it signed (PadFailed.md: "NEVER the hold's +0.10 / +0.10 is signed in its
   * place").
   */
  const notTaken = (origin: "pad" | "row", fault: Fault, sent: StancePair, by: string | null) => {
    // A pad closed while its act was in flight has no surface left to
    // re-raise: the target's row carries it, as a hold's would. An account
    // change closed the presser's pad, so a pad open now is another's.
    if (origin === "pad" && openRef.current && stillAs(by)) setPadFault(fault);
    else raiseRow(fault, by, () => void signPick(sent, "row"));
  };

  /**
   * The target's row says an act of `by`'s did not go through — a hold's, or
   * one whose surface was closed while it signed. The row draws no
   * not-through form of its own (RowSigning.md), so a FORBIDDEN on a row
   * reads as a hold's fault does. The line is the pressing account's, and its
   * Retry asks that account's act again (`retry`): pressed once another
   * account is active, it does nothing.
   */
  const raiseRow = (fault: Fault, by: string | null, retry: () => void) =>
    setRowLineOf(
      by,
      fault === "writeRule"
        ? { kind: "writeRule" }
        : {
            kind: "didntSign",
            onRetry: () => {
              if (sessionStore.activeAccountId() !== by) return;
              retry();
            },
          },
    );

  /** What a dialog's own signing answered: taken, a fault, or the write rule's no. */
  const answerOf = (
    outcome: Outcome<StanceCommit>,
  ): { kind: "taken"; records: number } | { kind: Fault } =>
    outcome.kind === "success"
      ? { kind: "taken", records: outcome.value.records }
      : { kind: refusalFault(outcome) };

  /**
   * Every commit route lands here: read where the pick puts the bundle,
   * and if the fold says that reaches (0, 0), ask over the parked pad
   * rather than refusing (§8.2) — the walk-back's dialog over a standing,
   * the empty sign's ask over nothing standing. Otherwise sign exactly the
   * pick.
   */
  const signPick = async (chosen: StancePair, origin: "pad" | "row") => {
    if (busy) return;
    // The act is the account the tab is signed in as at the press: its own
    // line is the one it replaces, and the one its failure raises.
    const by = sessionStore.activeAccountId();
    setSignedOf(by, null);
    setPadFault(null);
    setRowLineOf(by, null);
    setConfirmFault(null);
    setEmptyFault(null);
    const answer = await runInFlight(origin, by, async () => {
      const landed = await data.project(seamTarget, chosen);
      if (landed.kind !== "success") return { kind: "failed" as const };
      const { standing, ...landing } = landed.value;
      // CANCEL DURING THE READ STAGED NOTHING: the pad that asked is gone,
      // and no dialog may rise over a pad that is no longer there — nor over
      // another account's anchor, the account change having closed it.
      if ((origin === "pad" && !openRef.current) || !stillAs(by)) return { kind: "dropped" as const };
      if (landing.severed) {
        // THE LANDING'S `severed` IS THE PAIR ALONE (StanceProjection.severed):
        // whether it walks something back is the standing's to say, read on
        // the same round trip — no record, or already walked back, is
        // nothing to walk back (jakob 2026-10-21).
        const nothingStands = standing.records === 0 || standing.severed;
        return { kind: nothingStands ? ("empty" as const) : ("severs" as const), landing };
      }
      const committed = await data.commit(seamTarget, chosen, commitSource);
      if (committed.kind === "success") {
        return { kind: "taken" as const, landing, records: committed.value.records };
      }
      return { kind: refusalFault(committed) };
    });
    switch (answer.kind) {
      case "dropped":
        return;
      case "taken":
        taken(answer.landing, answer.records, by);
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
        notTaken(origin, answer.kind, chosen, by);
    }
  };

  /**
   * `Set it anyway`: the one empty record, signed like any Set. Taken, it is
   * the ordinary path — the surfaces close, the face moves to 🤷 saying
   * nothing, and the ordinary snackbar answers (EmptySignConfirm.md:27).
   * Not taken, the ask stays up with the fault line and Retry (:33) — or,
   * where the write rule refused it, its quiet line with the act dimmed and
   * no Retry (round 21).
   */
  const onConfirmEmpty = async () => {
    const asked = emptyAsk;
    if (asked === null || busy) return;
    setEmptyFault(null);
    await signDialogAct(
      { kind: "pick", pick: asked.pick, landing: asked.landing },
      "empty",
      sessionStore.activeAccountId(),
    );
  };

  /**
   * Signs one act a dialog over the pad asked about — the walk-back over the
   * standing the reader confirmed (`shown`), or the pick the walk-back's
   * dialog or the empty sign's ask raised — as `by`, from that dialog or from
   * the row's Retry.
   *
   * A DIALOG CLOSED WHILE ITS ACT SIGNS LEAVES THE ACT TO THE ROW
   * (SeveranceConfirm.md:53, EmptySignConfirm.md:51, RowSigning.md:7): Close,
   * the scrim, Back, Escape — or an account change, which closes it as Close
   * does — and the act ends on the target's row as a hold's does. Taken, the
   * face moves and the snackbar confirms; not, the row says `That didn't
   * sign.` with a Retry that asks THIS act again — the same walk-back, the
   * same pick, from this surface (SigningAfterClose.md:27: "NEVER anything
   * else is signed"), never the dialog again: it was confirmed once.
   */
  const signDialogAct = async (act: DialogAct, from: "confirm" | "empty" | "row", by: string | null) => {
    if (from === "row") {
      setSignedOf(by, null);
      setRowLineOf(by, null);
    }
    const answer = await runInFlight(from, by, async () =>
      answerOf(
        act.kind === "walkBack"
          ? await data.sever(seamTarget, act.shown, commitSource)
          : await data.commit(seamTarget, act.pick, commitSource),
      ),
    );
    const onDialog = from !== "row" && stillAs(by) && dialogUpRef.current;
    if (answer.kind !== "taken") {
      // On its dialog: a fault with Retry in the act's slot, or the write
      // rule's quiet line with the act dimmed and no Retry (round 21).
      if (!onDialog) raiseRow(answer.kind, by, () => void signDialogAct(act, "row", by));
      else if (from === "confirm") setConfirmFault(answer.kind);
      else setEmptyFault(answer.kind);
      return;
    }
    if (onDialog) {
      setConfirming(null);
      setEmptyAsk(null);
    }
    if (act.kind === "pick") {
      taken(act.landing, answer.records, by);
      return;
    }
    announceStanceSigned();
    readBundle({ fresh: true });
    if (variant !== undefined) {
      variant.onTaken(SEVERED.landing);
      return;
    }
    if (stillAs(by)) closeSurfaces();
    setSignedOf(by, signedLine(SEVERED.landing, answer.records, true, target.label, axes));
  };

  /** The explicit walk-back asks over the parked pad, and costs what it stages. */
  const openSeverance = () => {
    setSignedOf(sessionStore.activeAccountId(), null);
    setPadFault(null);
    setConfirmFault(null);
    const records = bundle === null || bundle === undefined ? 0 : bundle.severance.records;
    setConfirming({ pick: null, records, alreadySevered: records === 0, landing: SEVERED });
  };

  const onConfirmSeverance = async () => {
    const asked = confirming;
    if (asked === null || busy) return;
    setConfirmFault(null);
    if (asked.pick === null) {
      // The walk-back is checked against the standing the reader confirmed;
      // with none known there is nothing to check against.
      if (bundle === null || bundle === undefined) {
        setConfirmFault("failed");
        return;
      }
      await signDialogAct({ kind: "walkBack", shown: bundle }, "confirm", sessionStore.activeAccountId());
      return;
    }
    await signDialogAct(
      { kind: "pick", pick: asked.pick, landing: asked.landing },
      "confirm",
      sessionStore.activeAccountId(),
    );
  };

  /**
   * The considered surface opens AT THE DEFAULT (stance-control.md, jakob
   * 2026-10-05). Opening spends the teaching: whatever opens first is the
   * first open ever, and only the pad carries the lines.
   */
  const openConsidered = (surface: "pad" | "alternates", from: StancePair = TAP_DEFAULT) => {
    setPick(from);
    setSignedOf(sessionStore.activeAccountId(), null);
    setPadFault(null);
    setRowLineOf(sessionStore.activeAccountId(), null);
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
    if (locked) {
      carrySnackbar(OPINION_LOCKED);
      return;
    }
    // A KEPT OPINION WITH THE KEY HERE WAITS FOR ITS REVIEW: the tap opens
    // the kept picks' review, never the key notice and never a pad
    // (PadPendingReview.md:13). One whose key answer has not come yet asks
    // first, and goes where the answer says.
    if (kept !== null && family === "opinion" && keyAbsent !== true) {
      if (keyAbsent === false) {
        openKeptPicks();
        return;
      }
      void data.keyOnDevice().then((present) => {
        setKeyAbsent(!present);
        if (present) openKeptPicks();
        else openConsidered(mode === "pad" ? "pad" : "alternates", kept);
      });
      return;
    }
    // A KEPT PICK REOPENS HOLDING ITSELF while the key is still elsewhere
    // (PadPending.md); otherwise the considered surface blooms at the
    // default. The alternate replaces the pad everywhere (§8.6), the tap that
    // opens it included, and carries the same key notice.
    const from = kept !== null && keyAbsent === true ? kept : TAP_DEFAULT;
    openConsidered(mode === "pad" ? "pad" : "alternates", from);
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
    // AN APPLICANT'S HOLD IS TOLD, as the tap is, and signs nothing: no ring,
    // no capture, and the click its release makes is swallowed.
    if (locked) {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        suppressClick.current = true;
        carrySnackbar(OPINION_LOCKED);
      }, LONG_PRESS_MS);
      return;
    }
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
      setHoldReached(true);
      suppressClick.current = true;
      // WITH THE KEY ELSEWHERE THE HOLD OPENS THE PAD, as a tap does, and
      // signs nothing (PadKeyAbsent.md) — a held finger cannot spend a
      // signature this device cannot give.
      void data.keyOnDevice().then((present) => {
        setKeyAbsent(!present);
        // Batched with what follows: a signing's flight takes the ring over
        // in the same render, so it never flickers open between the two.
        setHoldReached(false);
        // A KEPT OPINION NEVER SIGNS FROM A HOLD: with the key here the hold
        // opens the review, as the tap does (PadPendingReview.md:15).
        if (present && kept !== null && family === "opinion") {
          openKeptPicks();
          return;
        }
        if (present) {
          void signPick(TAP_DEFAULT, "row");
          return;
        }
        openConsidered(mode === "pad" ? "pad" : "alternates", kept ?? TAP_DEFAULT);
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
  // With the key back and the review left unsigned, the kept opinion waits on
  // the reader instead (PadPendingReview.md) — the face is still the kept
  // pick's, never `Still settling`: nothing is signed yet.
  const waitingForKey = kept !== null && keyAbsent === true;
  const waitingForReview = kept !== null && keyAbsent === false && family === "opinion";
  // The resting anchor stands unless a pad-only host is the opening itself.
  const anchored = padOnly === undefined || padOnly.keepAnchor === true;
  const keptShown = waitingForKey || waitingForReview;
  // A guest rests on the borrowed view's stance, read through the same
  // readout as a member's own (the master's `restingOf`).
  const restingPair: StancePair | null = keptShown
    ? kept
    : pending !== null
      ? pending.pair
      : lends
        ? borrowedFace === null || (borrowedFace.records === 0 && !borrowedFace.severed)
          ? null
          : borrowedFace.current
        : bundle === null || bundle === undefined || bundle.records === 0
          ? null
          : bundle.current;
  // A resting (0, 0) is walked back only when the bundle — or the signing
  // just taken — says so; otherwise (an empty sign's standing, a kept pick)
  // it says nothing (the master's `restingZero`; PadStanding.md:29).
  const restingSevered = keptShown
    ? false
    : pending !== null
      ? pending.severed
      : lends
        ? borrowedFace !== null && borrowedFace.severed
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
  const padNode = variant?.padNode ?? plainPadNode;

  /** Whose in-flight state shows where: the pad's, the row's, the dialog's. */
  const padSetting = inFlight === "pad" && slow;
  // CANCEL MID-SIGNING CLOSES THE SURFACE, NEVER THE SIGNING (PadFailed.md,
  // round 21): the act was sent and cannot be called back, so its wait passes
  // to the target's row, the anchor refusing a second hold — and it ends
  // there as a hold's would. A dialog closed while its act signs closes the
  // pad beneath with it, so its wait passes the same way
  // (SeveranceConfirm.md:53, EmptySignConfirm.md:51).
  //
  // THE ROW'S WAIT IS THE CLOSED RING, NEVER A LINE (RowSigning.md:5-9,
  // PadFailed.md:41; the master's `holdWaiting`): a hold's, a closed pad's, a
  // closed dialog's — the ring stands closed around the face, and `Signing…`
  // is spoken from a visually hidden status once 200ms pass, never drawn.
  // Only the kept picks' batch draws its wait as a line (KeptPicksSeal.md:59).
  const rowSigning = inFlight === "row" || (inFlight !== null && !considered && !dialogUp);
  const rowSpeaksSigning = rowSigning && slow;
  const rowState: RowLineState | null = keptBatchSigning ? { kind: "signing" } : rowLine;

  const inset = variant?.padInset ?? (barBeneath ? PAD_ABOVE_BAR_INSET_PX : PAD_PARK_INSET_PX);

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
          // The press closes the pad and nothing else: the rest of its gesture
          // never reaches what the wash was covering (`outside-press.ts`).
          swallowRestOfGesture(event.nativeEvent);
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
        style={parkedPadStyle(inset)}
        className="cg-dialog-in z-40 box-content flex w-[17rem] touch-none flex-col gap-3 overflow-y-auto rounded-extra-large bg-surface-container-high p-4 text-on-surface outline-none"
      >
        {/* The help affordance: a circled `?` in the pad's top-right corner,
            out of the reading order of the three readouts. 48px target,
            32px ring. Its name is the pad's own (ruling A7). With the key
            elsewhere the notice's own "?" is the pad's one (PadKeyAbsent
            draws no other — at most one "?" per screen, readme §13). */}
        {keyAbsent !== true && (
        <button
          type="button"
          {...testAttributes(part(padNode, "help"), `${testIdPrefix}-explain`)}
          aria-expanded={explaining === "help"}
          aria-label={variant?.helpLabel ?? variant?.title ?? PAD_HELP_LABEL}
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
        )}
        <StanceStanding
          pick={pick}
          bundle={bundle}
          targetLabel={target.label}
          testIdPrefix={testIdPrefix}
          axes={axes}
          node={part(padNode, "standing")}
          className={keyAbsent === true ? undefined : "pr-10"}
        />
        {/* The help and the 🤔's explanation REPLACE the field and the
            landing rather than growing below them: the pad is parked, and a
            panel that pushes Set and Cancel away from the thumb defeats the
            parking. */}
        {explaining !== false ? (
          <div data-testid={`${testIdPrefix}-explanation`} className="flex flex-col gap-2">
            {helpLines.map((line, index) =>
              typeof line === "string" ? (
                <p key={index} className="m-0 text-body-small text-on-surface-variant">
                  {line}
                </p>
              ) : (
                <PressAndHoldLine key={index} />
              ),
            )}
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
                open's one line. */}
            {variant !== undefined ? (
              <div
                {...testAttributes(part(padNode, "note"), `${testIdPrefix}-note`)}
                className="flex flex-col gap-1"
              >
                {(typeof variant.note === "string" ? [variant.note] : variant.note).map((line) => (
                  <p key={line} className="m-0 text-body-small text-on-surface-variant">
                    {line}
                  </p>
                ))}
                {coaching && <StanceFirstOpenLine testId={`${testIdPrefix}-coaching`} />}
              </div>
            ) : (
              coaching && <StanceFirstOpenLine testId={`${testIdPrefix}-coaching`} />
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
            <WriteRuleNotice
              testId={`${testIdPrefix}-write-rule`}
              onHelp={() => setNoticeHelp(HELP_TOPICS.whySigningWaitsOnPad)}
            />
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
          <KeyAbsentNotice
            testIdPrefix={testIdPrefix}
            backedUp={backedUp}
            onHelp={() => setNoticeHelp(HELP_TOPICS.yourKeyOnPad)}
            onKeep={keepAndClose}
          />
        )}
        {/* A SIGNING THAT DID NOT GO THROUGH says so above the commit row, in
            the failure voice, and Set's slot becomes the outlined Retry — the
            same commitment asked again. */}
        {retries(padFault) && <TransportError testId={`${testIdPrefix}-pad-failed`} message={retryLine(padFault)} />}
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
                variant: retries(padFault) ? "outline" : "primary",
                size: "sm",
              })}
            >
              {padSetting ? "Setting…" : retries(padFault) ? "Retry" : "Set"}
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
      className={`relative flex min-w-0 flex-col gap-1${wide ? " w-full" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {anchored && (
        // OVER MEDIA THE ROW SPENDS NO GAP (StanceControl.jsx:552-555): the
        // hidden skip-link's gap would push the anchor off the rail's axis.
        <div className={`flex min-w-0 items-center ${overMedia ? "gap-0" : "gap-2"}${wide ? " w-full" : ""}`}>
          {/* 48px minimum, including at rest (design.md §4); the wide anchor
              draws 40 and answers to 48 through `cg-hit`. */}
          <button
            ref={buttonRef}
            type="button"
            {...testAttributes(part(node, "anchor"), testIdPrefix)}
            aria-label={
              // The guest's name keeps the full handle: the ellipsis below
              // is print only (stance-control.md:108-119, TagPage.md:57).
              // Held, its reading follows as a member's does — read-only, so
              // never the press-and-hold hint (the master's `anchorName`).
              guestHandle !== null
                ? restingFace === null || restingPair === null
                  ? `@${guestHandle}'s opinion on ${target.label}`
                  : `@${guestHandle}'s opinion on ${target.label}: ${restingFace.label}, ${formatStancePair(restingPair)}.`
                : restingFace === null || restingPair === null
                ? `Give your opinion on ${target.label}`
                : keptShown
                  ? `Your opinion on ${target.label}, waiting for your ${waitingForReview ? "review" : "key"}: ${restingFace.label}, ${formatStancePair(restingPair)}.`
                  : `Your opinion on ${target.label}: ${restingFace.label}, ${formatStancePair(restingPair)}. Press and hold to add a positive one.`
            }
            aria-busy={rowSigning || undefined}
            onClick={onTap}
            onPointerDown={onPointerDown}
            onPointerMove={onTargetPointerMove}
            onPointerUp={onTargetPointerUp}
            onPointerCancel={onTargetPointerUp}
            // A long press is the shortcut, so the platform must not take
            // it for a selection or a context menu first.
            onContextMenu={(event) => event.preventDefault()}
            className={`${BUTTON_CLASS} flex cursor-pointer touch-none select-none items-center justify-center gap-2 rounded-full bg-transparent px-3 text-label-large text-primary [-webkit-touch-callout:none] ${
              wide ? "min-h-10 min-w-0 flex-1 border border-solid border-outline" : "min-h-12 min-w-12 border-0"
            }${locked ? " opacity-[var(--state-disabled)]" : ""}`}
            style={overMedia ? OVER_MEDIA_ANCHOR : undefined}
          >
            {/* Never a bare word: a viewer with no bundle gets a face outside
                the table, muted and translucent — the control visibly waiting
                to be given a value, never the shrug a zero opinion owns. The
                anchor's words are not drawn; they ride the accessible name. */}
            <span className="relative inline-grid flex-none place-items-center">
              {restingFace === null && overMedia ? (
                // OVER MEDIA THE UNSET STATE IS A LINE FACE at the rail's
                // weight (StanceControl.jsx:602-608): on photography "quiet"
                // and "invisible" are the same thing.
                <span
                  aria-hidden="true"
                  {...testAttributes(part(node, "anchor.face"), `${testIdPrefix}-resting-face`)}
                  className="inline-flex flex-none"
                >
                  <Icon name="sentiment_neutral" size={28} />
                </span>
              ) : restingFace === null && lineFaceInk !== undefined ? (
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
                      ? `flex-none ${FACE_TYPE} opacity-40 grayscale`
                      : `flex-none ${FACE_TYPE}`
                  }
                  // A set face over media at `--size-face-over-media`
                  // (StanceControl.jsx:618).
                  style={overMedia ? { fontSize: "var(--size-face-over-media)" } : undefined}
                >
                  {restingFace === null ? RESTING_FACE_EMOJI : restingFace.emoji}
                </span>
              )}
              {(holding || holdReached || rowSigning) && (
                <HoldRing testId={`${testIdPrefix}-hold-ring`} closed={!holding} />
              )}
            </span>
            {wide && restingPair === null && phase === "signedIn" && (
              // The wide anchor's words — only where there is no pair to show.
              // Drawn, not spoken: the button's name already says it. Only
              // once the reader is known to be signed in: the server render
              // cannot tell, and a guest never reads `Your opinion`.
              <span aria-hidden="true" className="whitespace-nowrap" data-testid={`${testIdPrefix}-words`}>
                Your opinion
              </span>
            )}
            {wide && restingPair === null && guestHandle !== null && (
              // A guest's words name the borrowed view. A name that outgrows
              // the anchor truncates its HANDLE, never its `'s opinion`, so
              // the words always say whose view it is (`@genesismo…'s
              // opinion`, jakob 2026-10-14). A read that named nobody draws
              // the face alone: never `Your opinion` for a guest.
              <span
                aria-hidden="true"
                className="flex min-w-0 whitespace-nowrap"
                data-testid={`${testIdPrefix}-words`}
              >
                <span className="min-w-0 truncate" data-testid={`${testIdPrefix}-words-handle`}>
                  @{guestHandle}
                </span>
                <span className="flex-none" data-testid={`${testIdPrefix}-words-suffix`}>
                  &apos;s opinion
                </span>
              </span>
            )}
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
          {/* HIDDEN BY ITS WRAPPER, NOT BY ITSELF: the button is a `cg-state`
              surface, whose unlayered `position: relative` outranks the
              utility layer's `sr-only` — so on the button itself the hiding
              never took, and the route stood in flow, 70px beside the face. */}
          {phase === "signedIn" && (
            <span className="sr-only focus-within:not-sr-only">
            <button
              type="button"
              data-testid={`${testIdPrefix}-choose`}
              disabled={busy}
              onClick={() => {
                // The accessible route answers as the tap does — an applicant
                // is told; a kept opinion with the key here opens its review
                // (PadPendingReview.md:13).
                if (locked) {
                  carrySnackbar(OPINION_LOCKED);
                  return;
                }
                if (kept !== null && family === "opinion" && keyAbsent === false) {
                  openKeptPicks();
                  return;
                }
                openConsidered("alternates", kept !== null && keyAbsent === true ? kept : TAP_DEFAULT);
                askForKey();
              }}
              className={buttonClassName({ variant: "text", size: "sm" })}
            >
              Choose your opinion on {target.label}
            </button>
            </span>
          )}
        </div>
      )}
      {/* THE ROW LINE (RowSigning.md, RowWriteRule.md): the hold's wait past
          200ms, its failure with Retry, or the write rule's quiet notice —
          under the face, in the slot the pending marker uses. */}
      {/* A PICK KEPT PENDING says what it waits on, under the face — never
          `Still settling`, which is a signed record's (PadPending.md). */}
      {anchored && keptShown && (
        <PendingMarker
          testId={`${testIdPrefix}-kept`}
          node={part(node, "pending")}
          label={waitingForReview ? "Waiting for your review" : "Waiting for your key"}
        />
      )}
      {/* THE KEPT PICKS JUST SIGNED, until their records are ordered
          (PadPendingReview.md:21) — never under a pick still kept. */}
      {anchored && !keptShown && settling && (
        <PendingMarker testId={`${testIdPrefix}-settling`} />
      )}
      {anchored && rowSpeaksSigning && (
        <span role="status" data-testid={`${testIdPrefix}-signing`} className="sr-only">
          {SIGNING_ROW}
        </span>
      )}
      {anchored && rowState !== null && !overMedia && (
        <RowLine state={rowState} node={lineNode} testId={`${testIdPrefix}-row-line`} />
      )}
      {/* OVER MEDIA THE LINE STANDS BESIDE THE FACE, on the stream's plate,
          reading leftward (ReelRail.jsx:178-186; Reel.md:65-69): the row the
          card would carry it on does not exist over a clip. */}
      {anchored && rowState !== null && overMedia && (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ right: "calc(100% + 8px)" }}>
          <RowLine plate state={rowState} node={lineNode} testId={`${testIdPrefix}-row-line`} />
        </div>
      )}

      {open && inBrowser && createPortal(pad, document.body)}

      {alternates && (
        <StanceAlternates
          mode={mode}
          pick={pick}
          onPick={setPick}
          busy={busy}
          slow={padSetting}
          fault={padFault === "writeRule" ? "writeRule" : retries(padFault) ? "failed" : null}
          failedLine={retryLine(padFault)}
          onWriteRuleHelp={() => setNoticeHelp(HELP_TOPICS.whySigningWaitsOnPad)}
          onCommit={() => void signPick(pick, "pad")}
          onCancel={closeAll}
          onSever={severable ? openSeverance : undefined}
          axes={axes}
          helpLabel={variant?.helpLabel ?? variant?.title ?? PAD_HELP_LABEL}
          zeroHelp={explaining === "zero" ? unreachableHelp(axes, target.label) : null}
          onZeroBack={() => setExplaining(false)}
          keyNotice={
            keyAbsent === true ? (
              <KeyAbsentNotice
                testIdPrefix={testIdPrefix}
                backedUp={backedUp}
                onHelp={() => setNoticeHelp(HELP_TOPICS.yourKeyOnPad)}
                onKeep={keepAndClose}
              />
            ) : null
          }
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
          failed={retries(confirmFault)}
          failedLine={retryLine(confirmFault)}
          writeRule={confirmFault === "writeRule"}
          axes={axes}
          onCancel={() => {
            setConfirming(null);
            setConfirmFault(null);
            // CLOSE WHILE IT SIGNS CLOSES THE PAD BENEATH TOO, and the whole
            // walk-back goes on, carried by the target's row
            // (SeveranceConfirm.md:53, :55); `Keep it` returns to the pick.
            if (inFlight === "confirm") closeAll();
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
          failed={retries(emptyFault)}
          failedLine={retryLine(emptyFault)}
          writeRule={emptyFault === "writeRule"}
          onCancel={() => {
            setEmptyAsk(null);
            setEmptyFault(null);
            // The same close while it signs (EmptySignConfirm.md:51, :53).
            if (inFlight === "empty") closeAll();
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
      {/* Out of the column's flow: an empty live region is still a flex item,
          and the column's gap stood 4px under every anchor for it. */}
      <div className="absolute">
        <Snackbar message={signed} onDismiss={() => setSignedOf(accountId, null)} testId={`${testIdPrefix}-signed`} />
      </div>

      {/* Mounted only when asked for: a read surface renders many of
          these controls, and an always-present dialog per card is a
          dialog per card in the DOM. */}
      {joinPrompt && <JoinPrompt open onClose={() => setJoinPrompt(false)} />}
    </div>
  );
}
