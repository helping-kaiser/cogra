import React from "react";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { Snackbar } from "../core/Snackbar.jsx";
import { JoinPrompt } from "../core/JoinPrompt.jsx";
import { StancePad } from "./StancePad.jsx";
import { StanceAlternates } from "./StanceAlternates.jsx";
import { StanceCoachMark, STANCE_PAD_HELP, HelpLine, helpKey } from "./StanceCoachMark.jsx";
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

   A TAP OPENS THE PAD (jakob's ruling, the geek round). The light gesture — the
   one a thumb gives by accident — costs nothing and signs nothing; it blooms the
   pad at ONE FIXED SPOT, the lower centre of the viewport, the same place every
   time. Muscle memory is part of the control.

   PRESS AND HOLD 500ms SIGNS THE DEFAULT, the modest positive (+0.1, +0.1)
   verbatim. THE PRICE IS ACCEPTED DELIBERATELY: the shortcut that spends a
   signature is the one that takes a held finger, and the gesture nobody gives by
   mistake is the only one allowed to act by itself.

   THE HOLD ANSWERS IMMEDIATELY. The resting target moves to the new standing at
   once and a snackbar confirms the signature: a gesture that stages a priced act
   must never be silent, because silence reads as failure and invites the same act
   again.

   THE PAD IS THE TEACHER. The one-time coach mark rides the FIRST OPEN, inside
   the pad it explains, and what it teaches is the shortcut — a reader who has
   found the pad has already found everything they need, and the only thing left
   to say is that the hold is faster.

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

/* THE ANCHOR ON A MEDIA SURFACE (jakob, review rounds 1 and 2). On the stream
   the control sits on whatever the clip happens to be showing, where the card's
   quiet anchor disappears — the unset face worst of all. It becomes a GLYPH IN
   THE RAIL'S FAMILY: `sentiment_neutral`, the same line weight and 28px optical
   size as the comment bubble beside it, white with the same soft shadow. No
   disc and no ring — a plate around one control in a column of five reads as
   chrome, and the first cut of it was exactly the clonky thing that made the
   rail stop looking like one set. A stance that HAS been taken still shows its
   own face at the same size, because that face is the readout.

   The gesture, the pad, the ceremony and the muting rule are unchanged; this
   restyles the anchor on one kind of surface and nothing else. */
const OVER_MEDIA_ANCHOR = {
  width: "56px",
  height: "44px",
  minWidth: "56px",
  minHeight: "44px",
  padding: 0,
  border: 0,
  background: "none",
  color: "#fff",
  filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.55))",
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
  helpLabel = "How stances work",
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
    setCoach(false);
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

  /* THE TAP OPENS. It teaches on the first open ever and never again — the
     coach rides inside the pad, so opening it is both the answer and the
     lesson, and a feed of twenty cannot teach twenty times. */
  const onTap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!signedIn) {
      setJoinPrompt(true);
      return;
    }
    setPick(ORIGIN);
    setSigned(null);
    setOpen(true);
    if (taught) {
      setCoach(false);
    } else {
      setTaught(true);
      setCoach(true);
    }
  };

  /* THE HOLD SIGNS. It fires under the finger, so the click that follows the
     release has to be swallowed or the pad would open on top of the signature. */
  const onPointerDown = () => {
    if (!signedIn) return;
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setSigned(null);
      commitChecked(TAP_DEFAULT);
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
      {/* OVER MEDIA THE ROW SPENDS NO GAP: the skip-link beside the anchor is a
          hairline the eye never sees, but its gap pushes the anchor off the
          rail's axis — and a glyph a few pixels left of the column reads as an
          accident, which is what it was. */}
      <div style={{ display: "flex", alignItems: "center", gap: overMedia ? 0 : "var(--space-2)", width: wide ? "100%" : undefined }}>
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
          {overMedia && restingFace === null ? (
            /* OVER MEDIA THE UNSET STATE IS A LINE FACE, not a muted emoji: on
               photography "quiet" and "invisible" are the same thing, and the
               glyph says "no standing yet" by being the empty face rather than
               by being faint. */
            <Icon name="sentiment_neutral" size={28} />
          ) : (
            <span
              aria-hidden="true"
              style={{
                fontSize: overMedia ? "var(--size-face-over-media)" : "var(--text-title-large)",
                lineHeight: 1,
                opacity: restingFace === null ? "var(--opacity-resting-face)" : 1,
                filter: restingFace === null ? "grayscale(1)" : "none",
              }}
            >
              {restingFace === null ? RESTING_FACE_EMOJI : restingFace.emoji}
            </span>
          )}
          {wide && restingPair === null && (
            /* The wide anchor's words — only where there is no pair to show. */
            <span aria-hidden="true" style={{ whiteSpace: "nowrap" }}>
              Take a stance
            </span>
          )}
          {restingPair !== null && (
            /* NEVER WRAPS. This is the post card's affordance row, which is one
               line by rule — a pair broken across two text lines reads as a
               two-line block even when the row height has not changed.

               The face is the default reading and these numbers are the geek
               one (`cg-exact`, readme §13): at rest the affordance row carries
               the face alone, and the button's accessible name carries the
               values in both modes. */
            <span
              className="cg-exact"
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
            settings, which replaces the pad everywhere (§8.6). ITS NAME CARRIES
            `targetLabel` (backlog item 46.1) — the same source the face's own
            aria-label reads — so a page with more than one stance control, like
            `TagPage`, does not repeat one anonymous name across all of them. */}
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
            Choose your stance on {targetLabel}
          </button>
        )}
      </div>

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
                ring. Its name is `helpLabel` (jakob's ruling A7) — the dialog's
                own title, not a generic one, wherever a board draws a named
                pad (`ComposePad`'s "Where you stand on it", `ReplyPad`'s
                "Toward what you answer", `VouchBackPad`'s "Your first
                stance"); the ordinary feed-card control keeps the default. */}
            <button
              type="button"
              aria-expanded={explaining}
              aria-label={helpLabel}
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
            {/* THE COACH RIDES THE FIRST OPEN, INSIDE THE PAD. It is a note on
                the surface it explains rather than a card floating beside the
                anchor — the anchor may be anywhere on the screen and the pad is
                always parked at the same spot, so a mark attached to the anchor
                would point at nothing the reader is looking at.

                IT GROWS UPWARD, not down: the pad is parked by its bottom edge,
                so a note above the field leaves Set and Cancel exactly where the
                thumb expects them. It wears the pad's own container tone rather
                than the dialog surface — a second dialog-coloured card inside a
                dialog reads as a second dialog. */}
            {coach && (
              <StanceCoachMark
                onDismiss={() => setCoach(false)}
                style={{ width: "auto", background: "var(--surface-container-highest)", padding: "var(--space-3)" }}
              />
            )}
            {/* The help panel REPLACES the field and the readouts rather than
                growing below them: the pad is parked, and a panel that pushes Set
                and Cancel away from the thumb defeats the parking. */}
            {explaining ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {STANCE_PAD_HELP.map((line) => (
                  <p key={helpKey(line)} style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
                    <HelpLine line={line} />
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
          helpLabel={helpLabel}
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
