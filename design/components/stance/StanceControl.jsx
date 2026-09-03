import React from "react";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import { Snackbar } from "../core/Snackbar.jsx";
import { JoinPrompt } from "../core/JoinPrompt.jsx";
import { StancePad } from "./StancePad.jsx";
import { StanceAlternates } from "./StanceAlternates.jsx";
import { StanceCoachMark, STANCE_PAD_HELP } from "./StanceCoachMark.jsx";
import { SeveranceConfirm } from "./SeveranceConfirm.jsx";
import {
  bundleReadout,
  clampPair,
  formatStancePair,
  localLanding,
  ORIGIN,
  RESTING_FACE_EMOJI,
  signedLine,
  StanceLandingLine,
  StanceStanding,
  TAP_DEFAULT,
} from "./StanceReadout.jsx";

/* CoGra's SIGNATURE INTERACTION (design.md §8). Everything in this file is a rule
   from that section, not a preference:

   AT REST the target shows the standing — face, words, and the folded pair. A
   viewer without a standing sees a MUTED, TRANSLUCENT face: the same control at
   rest, visibly waiting to be given a value, never a bare word and never the shrug
   a zero standing owns.

   THE FIRST TAP EVER TEACHES and stages nothing. Every tap after that acts,
   committing the modest positive default (+0.1, +0.1) verbatim.

   A TAP ANSWERS IMMEDIATELY. The resting target moves to the new standing at once
   and a snackbar confirms the signature: a gesture that stages a priced act must
   never be silent, because silence reads as failure and invites the same act again.

   PRESS AND HOLD 500ms and the pad blooms — at ONE FIXED SPOT, the lower centre of
   the viewport, the same place every time. Muscle memory is part of the control.

   RELEASING THE FINGER NEVER COMMITS. Release parks the pick and leaves the pad
   open; an explicit SET commits; CANCEL or a press outside stages nothing. An
   accidental lift must never sign a priced act.

   THE CONTROL OWNS ITS TOUCHES. Nothing it receives reaches the card behind it:
   opening the pad must never also open the post.

   IT NEVER PREVENTS A CHOICE. The whole square is reachable, corners included. A
   pick that nets the standing to (0, 0) is confirmed, not refused.

   This recreation folds locally and keeps its own standing in state; the product
   asks the backend for the authoritative projection before signing. */

export const LONG_PRESS_MS = 500;

/* THE ANCHOR ON A MEDIA SURFACE (jakob, review round 1). On the stream the
   control sits on whatever the clip happens to be showing, where the card's
   quiet anchor disappears — the unset face worst of all. So over media it wears
   a disc: a dark translucent fill and a white ring, at the touch target's own
   size, with the face at full strength inside it. The gesture, the pad and the
   ceremony are unchanged; this restyles the anchor and nothing else. */
const OVER_MEDIA_ANCHOR = {
  width: "var(--touch-target-min)",
  height: "var(--touch-target-min)",
  padding: 0,
  border: "2px solid rgba(255,255,255,0.92)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.55))",
};

const EMPTY_BUNDLE = { current: ORIGIN, rawSum: ORIGIN, records: 0, severed: false, severance: { records: 0 } };

function parkedPadStyle(inset = 16) {
  return {
    position: "fixed",
    left: "50%",
    bottom: `${inset}px`,
    transform: "translateX(-50%)",
    maxHeight: `calc(100dvh - ${inset * 2}px)`,
  };
}

/* `defaultOpen`/`defaultPick` exist for STATES A CLICK CANNOT REACH: the
   prototype boards are server-rendered, so a screen showing the parked pad asks
   the MASTER for it instead of copying the card — the copy is never the answer.
   `padInset` lifts the parked card clear of a bottom bar (the pad sits above the
   bar, readme §13); `padNote` is the shell's one-time coaching slot — the first
   vouch speaks there, between the field and the landing line.

   `wide` (profile round, 2026-09-01) is the PRESENTATIONAL variant a profile
   header wears: the same anchor stretched to the row's width in the outline
   button's clothes, and — divergence from the card anchor, deliberate — the
   words drawn beside the face, because here the stance IS the row's one action
   and a lone face at full width reads as lost. Tap, hold, pad, severance: all
   unchanged — the variant restyles the anchor and nothing else. */
export function StanceControl({
  targetLabel = "this post",
  bundle: supplied,
  signedIn = true,
  taught: taughtProp,
  onCommit,
  defaultOpen = false,
  defaultPick,
  padInset = 16,
  padNote,
  wide = false,
  overMedia = false,
}) {
  const [bundle, setBundle] = React.useState(supplied ?? EMPTY_BUNDLE);
  React.useEffect(() => {
    if (supplied !== undefined) setBundle(supplied);
  }, [supplied]);

  const [taught, setTaught] = React.useState(taughtProp ?? false);
  // One-way: the shell can tell a control the reader has since met the gesture,
  // so a feed of twenty does not teach twenty times. It can never un-teach.
  React.useEffect(() => {
    if (taughtProp) setTaught(true);
  }, [taughtProp]);
  const [open, setOpen] = React.useState(defaultOpen);
  const [alternates, setAlternates] = React.useState(false);
  const [coach, setCoach] = React.useState(false);
  const [explaining, setExplaining] = React.useState(false);
  const [pick, setPick] = React.useState(defaultPick ?? ORIGIN);
  const [confirming, setConfirming] = React.useState(null);
  const [signed, setSigned] = React.useState(null);
  const [joinPrompt, setJoinPrompt] = React.useState(false);

  const holdTimer = React.useRef(null);
  const suppressClick = React.useRef(false);
  const fieldRef = React.useRef(null);

  const considered = open || alternates;
  const landing = considered ? localLanding(bundle.rawSum, pick) : null;

  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  const closeAll = () => {
    clearHold();
    setOpen(false);
    setAlternates(false);
    setExplaining(false);
  };

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const apply = (chosen, landed, records = 1) => {
    const rawSum = { pDirected: bundle.rawSum.pDirected + chosen.pDirected, pInterest: bundle.rawSum.pInterest + chosen.pInterest };
    const next = {
      current: landed.landing,
      rawSum: landed.severed ? ORIGIN : rawSum,
      records: landed.severed ? 0 : bundle.records + 1,
      severed: landed.severed,
      severance: { records: landed.severed ? 0 : bundle.records + 1 },
    };
    setBundle(next);
    setSigned(signedLine(landed.landing, records, landed.severed, targetLabel));
    if (onCommit) onCommit(clampPair(chosen), next);
  };

  const commitChecked = (chosen) => {
    const landed = localLanding(bundle.rawSum, chosen);
    closeAll();
    if (landed.severed) {
      setConfirming({ pick: chosen, records: Math.max(1, bundle.records), landed });
      return;
    }
    apply(chosen, landed);
  };

  const openSeverance = () => {
    closeAll();
    setSigned(null);
    setConfirming({
      pick: null,
      records: bundle.records,
      alreadySevered: bundle.records === 0,
      landed: { landing: ORIGIN, inert: true, severed: true },
    });
  };

  const onTap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!signedIn) {
      setJoinPrompt(true);
      return;
    }
    if (!taught) {
      setTaught(true);
      setCoach(true);
      return;
    }
    commitChecked(TAP_DEFAULT);
  };

  const onPointerDown = () => {
    if (!signedIn) return;
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setPick(ORIGIN);
      setSigned(null);
      setTaught(true);
      setCoach(false);
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const restingPair = bundle.records === 0 && !bundle.severed ? null : bundle.current;
  const restingFace = restingPair === null ? null : bundleReadout(restingPair);

  return (
    <div
      style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--space-1)", width: wide ? "100%" : undefined }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: wide ? "100%" : undefined }}>
        <button
          type="button"
          aria-label={
            restingFace === null
              ? `Take a stance on ${targetLabel}`
              : `Your stance on ${targetLabel}: ${restingFace.label}, ${formatStancePair(restingPair)}. Tap to add a positive one.`
          }
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerUp={clearHold}
          onPointerCancel={clearHold}
          onContextMenu={(event) => event.preventDefault()}
          className={BUTTON_CLASS}
          style={{
            display: "flex",
            minHeight: wide ? "40px" : "var(--touch-target-min)",
            minWidth: "var(--touch-target-min)",
            flex: wide ? 1 : undefined,
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            borderRadius: "var(--radius-full)",
            border: wide ? "1px solid var(--border-field)" : 0,
            background: "none",
            padding: "0 12px",
            cursor: "pointer",
            touchAction: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label-large)",
            fontWeight: "var(--text-label-large--font-weight)",
            color: "var(--primary)",
            ...(overMedia ? OVER_MEDIA_ANCHOR : null),
          }}
        >
          {/* Never a bare word (§8.3): a viewer with no bundle gets a face
              outside the table, muted and translucent — the control visibly
              waiting to be given a value, and never the shrug a zero standing
              owns (§8.4). The anchor's words are not drawn beside it; they ride
              the button's accessible name above. */}
          <span
            aria-hidden="true"
            style={{
              fontSize: "var(--text-title-large)",
              // OVER MEDIA THE MUTING IS THE DISC'S JOB, NOT THE FACE'S. A
              // translucent grey emoji on photography is not a quiet control, it
              // is an invisible one — so the face keeps its greyscale (still
              // "outside the table", still not a standing) and gives up the
              // translucency that the outlined disc now carries instead.
              opacity: restingFace === null && !overMedia ? "var(--opacity-resting-face)" : 1,
              filter: restingFace === null ? "grayscale(1)" : "none",
            }}
          >
            {restingFace === null ? RESTING_FACE_EMOJI : restingFace.emoji}
          </span>
          {wide && restingPair === null && (
            /* The wide anchor's words — only where there is no pair to show. */
            <span aria-hidden="true" style={{ whiteSpace: "nowrap" }}>
              Take a stance
            </span>
          )}
          {restingPair !== null && (
            /* NEVER WRAPS. This is the post card's affordance row, which is one
               line by rule — a pair broken across two text lines reads as a
               two-line block even when the row height has not changed. */
            <span
              aria-hidden="true"
              style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}
            >
              {formatStancePair(restingPair)}
            </span>
          )}
        </button>
        {/* The non-drag equivalent, present whatever the stored input is (§8.6,
            §10) — a drag gesture always has one.

            DIVERGENCE, deliberate: it is not DRAWN. The source renders it as a
            `primary` text button beside every stance on every card, and a feed of
            twenty posts then carries twenty copies of a control that duplicates
            the one beside it — and "Choose values" names nothing a reader can
            place. It is now visually hidden until focused (the skip-link
            pattern): keyboard, switch, and screen-reader users reach it in one
            tab, and a reader who cannot long-press sets the alternate once in
            settings, which replaces the pad everywhere (§8.6). */}
        {signedIn && (
          <button
            type="button"
            onClick={() => {
              setPick(ORIGIN);
              setSigned(null);
              setTaught(true);
              setAlternates(true);
            }}
            className={`cg-sr-focusable ${BUTTON_CLASS}`}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Choose your stance
          </button>
        )}
      </div>

      {coach && <StanceCoachMark onDismiss={() => setCoach(false)} style={{ position: "absolute", top: "100%", left: 0, marginTop: 8 }} />}

      {open && (
        <>
          <div
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              closeAll();
            }}
            style={{ position: "fixed", inset: 0, zIndex: 10, touchAction: "none" }}
          />
          <div
            role="group"
            aria-label={`Stance pad for ${targetLabel}`}
            style={{
              ...parkedPadStyle(padInset),
              zIndex: 20,
              display: "flex",
              width: "17rem",
              flexDirection: "column",
              gap: "var(--space-3)",
              overflowY: "auto",
              borderRadius: "var(--radius-extra-large)",
              background: "var(--surface-dialog)",
              padding: "var(--card-padding)",
              touchAction: "none",
              position: "fixed",
            }}
          >
            {/* The help affordance: a circled `?` in the pad's top-right corner,
                out of the reading order of the three readouts. 48px target, 32px
                ring. */}
            <button
              type="button"
              aria-expanded={explaining}
              aria-label="How stances work"
              onClick={() => setExplaining((shown) => !shown)}
              className={BUTTON_CLASS}
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                display: "grid",
                placeItems: "center",
                height: "var(--touch-target-min)",
                width: "var(--touch-target-min)",
                border: 0,
                background: "none",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "grid",
                  placeItems: "center",
                  height: "32px",
                  width: "32px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-hairline)",
                  color: "var(--primary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label-large)",
                  fontWeight: "var(--text-label-large--font-weight)",
                }}
              >
                ?
              </span>
            </button>
            <StanceStanding pick={pick} bundle={bundle} targetLabel={targetLabel} style={{ paddingRight: "40px" }} />
            {/* The help panel REPLACES the field and the readouts rather than
                growing below them: the pad is parked, and a panel that pushes Set
                and Cancel away from the thumb defeats the parking. */}
            {explaining ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {STANCE_PAD_HELP.map((line) => (
                  <p key={line} style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
                    {line}
                  </p>
                ))}
                <button
                  type="button"
                  onClick={() => setExplaining(false)}
                  className={BUTTON_CLASS}
                  style={{ ...buttonStyle({ variant: "text", size: "sm" }), alignSelf: "flex-start" }}
                >
                  Back to the pad
                </button>
              </div>
            ) : (
              <>
                <StancePad value={pick} onChange={setPick} fieldRef={fieldRef} />
                {padNote}
                <StanceLandingLine landing={landing} />
              </>
            )}
            {/* One row: the walk-away on the left, the two decisions on the right.
                SEVER NEEDS SOMETHING TO SEVER — with no records and nothing
                severed there is no relationship to walk away from, and the button
                led only to a dialog saying so. It arrives with the first stance. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              {(bundle.records > 0 || bundle.severed === true) && (
                <button
                  type="button"
                  onClick={openSeverance}
                  className={BUTTON_CLASS}
                  style={{ ...buttonStyle({ variant: "text", size: "sm" }), marginRight: "auto" }}
                >
                  Sever
                </button>
              )}
              <button type="button" onClick={closeAll} className={BUTTON_CLASS} style={buttonStyle({ variant: "text", size: "sm" })}>
                Cancel
              </button>
              <button
                type="button"
                disabled={explaining}
                onClick={() => commitChecked(pick)}
                className={BUTTON_CLASS}
                style={buttonStyle({ variant: "primary", size: "sm", disabled: explaining })}
              >
                Set
              </button>
            </div>
          </div>
        </>
      )}

      {alternates && (
        <StanceAlternates
          pick={pick}
          onPick={setPick}
          onCommit={() => commitChecked(pick)}
          onCancel={closeAll}
          onSever={openSeverance}
          landing={<StanceLandingLine landing={landing} />}
        >
          <StanceStanding pick={pick} bundle={bundle} targetLabel={targetLabel} />
        </StanceAlternates>
      )}

      {confirming !== null && (
        <SeveranceConfirm
          pick={confirming.pick}
          targetLabel={targetLabel}
          bundle={bundle}
          records={Math.max(1, confirming.records)}
          alreadySevered={confirming.alreadySevered === true}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            apply(confirming.pick ?? ORIGIN, confirming.landed, Math.max(1, confirming.records));
            setConfirming(null);
          }}
        />
      )}

      <Snackbar message={signed} onDismiss={() => setSigned(null)} />
      {joinPrompt && <JoinPrompt open onClose={() => setJoinPrompt(false)} />}
    </div>
  );
}
