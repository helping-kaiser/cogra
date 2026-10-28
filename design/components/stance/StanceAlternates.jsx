import React from "react";
import { DialogSurface } from "../core/JoinPrompt.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import { StanceSlider } from "./StanceSlider.jsx";
import { STANCE_AXES } from "./StancePad.jsx";
import { TransportError } from "../honesty/TransportError.jsx";
import { NoticePanel, NoticeLine } from "../honesty/NoticePanel.jsx";
import { alternatesHelp, clampDimension, HelpLine, helpKey, severanceWords, STANCE_RANGES, WRITE_RULE_WORDS } from "./StanceReadout.jsx";

/* The alternate inputs (guidelines/stance-control.md, *Alternate and accessible
   inputs*) — paired sliders and direct entry. Same
   machinery as the pad, different surface: they write the same two values, and the
   readout above them is the same lossy face.

   They are also the ACCESSIBLE path (the same section; readme §10): the pad is a drag gesture, and
   these give screen-reader and switch users the FULL RANGE through ordinary,
   well-supported controls rather than a degraded version of the gesture — which is
   why the entry into them is present on every stance control regardless of the
   stored preference. Selecting an alternate replaces the pad everywhere, not
   per-screen.

   DIVERGENCE FROM THE SOURCE: ONE CONTROL AT A TIME. The source shows sliders AND
   direct entry together whenever neither is the stored input. Two controls editing
   the same two numbers in one dialog is a needless choice at the moment of a
   priced act — the reader has to work out that they are the same values before
   using either. Sliders lead (draggable, but keyboard- and switch-operable, and
   Android's own StanceSlider); typing is one quiet tap away. The section asks that both
   routes exist, not that both are on screen at once.

   Severance is findable from the open pad; for anyone whose input is an alternate
   the pad never opens, so it is findable here instead.

   THE WORDS TRAVEL WITH THE RECORD FAMILY, exactly as they do on the field
   (`STANCE_AXES`, StancePad.jsx). The alternates are the SAME gesture through
   other controls, so a family that names its own poles must name them here too
   — a field reading `Dislike / Like` beside a slider reading `Against / For`
   would make the accessible route a different question from the drawn one.
   THE AXIS NAMES ABOVE THE TRACKS TRAVEL THE SAME WAY (backlog item 79): this
   is where the axis is actually NAMED rather than merely ended, so a family
   whose slots hold something other than a stance says so here or nowhere. */

/* THE BOUND IS A PROP HERE TOO, for `StanceSlider`'s reason: the typed route and
   the dragged one must not disagree about what a value may be. A field that
   refuses −1 on one axis and accepts it on another is the census speaking, and
   the census travels with the record family.

   A TYPED VALUE CLAMPS AS THE PAD CLAMPS (seam 245, ask 14 — the readout
   law). The field keeps what the reader typed while they type; the pick
   takes the nearest value the bound allows, so a `1.5` signs +1.00 the way a
   knob dragged past the edge stops on it, and the readout above says so
   before anything is signed. No refusal line: the field never refuses a
   value it can clamp, any more than the pad refuses a corner. What does not
   parse — an emptied field, a lone minus sign — moves nothing: the pick
   keeps its last value, because reading it as 0 would land a pick on the
   one number that means something of its own. Leaving the field rewrites
   it to the value the pick holds. `text` draws a field mid-typing for a
   board, a state a click cannot reach. */
function DirectEntry({ label, value, onChange, min = -1, max = 1, text }) {
  const id = React.useId();
  const [draft, setDraft] = React.useState(text ?? null);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
      <label htmlFor={id} style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={0.01}
        value={draft ?? value}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const parsed = raw.trim() === "" ? NaN : Number(raw);
          if (Number.isFinite(parsed) && onChange) onChange(clampDimension(parsed, min, max));
        }}
        onBlur={() => setDraft(null)}
        style={{
          width: "6rem",
          borderRadius: "var(--radius-extra-small)",
          border: "1px solid var(--border-field)",
          background: "transparent",
          color: "var(--on-surface)",
          padding: "8px",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body-medium)",
        }}
      />
    </div>
  );
}

/* THE TWO TRACKS AND THEIR SWAP — the part of the alternates every host shares.
   The bound reaches both routes from one `ranges`, so the slider and the typed
   field refuse the same values the field does. */
function AlternateInputs({ showing, setShowing, pick, onPick, axes, ranges, axis = "pair", typed }) {
  const directed = ranges.pDirected;
  const interest = ranges.pInterest;
  const one = axis === "one";
  return (
    <>
      <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {one ? (
          showing === "sliders" ? (
            <StanceSlider
              label={axes.directed}
              minLabel={axes.left}
              maxLabel={axes.right}
              min={directed.min}
              max={directed.max}
              value={pick.pDirected}
              onChange={(pDirected) => onPick && onPick({ ...pick, pDirected })}
            />
          ) : (
            <DirectEntry label={axes.directed} min={directed.min} max={directed.max} value={pick.pDirected} text={typed?.pDirected} onChange={(pDirected) => onPick && onPick({ ...pick, pDirected })} />
          )
        ) : showing === "sliders" ? (
          <>
            <StanceSlider
              label={axes.directed}
              minLabel={axes.left}
              maxLabel={axes.right}
              min={directed.min}
              max={directed.max}
              value={pick.pDirected}
              onChange={(pDirected) => onPick && onPick({ ...pick, pDirected })}
            />
            <StanceSlider
              label={axes.interest}
              minLabel={axes.bottom}
              maxLabel={axes.top}
              min={interest.min}
              max={interest.max}
              value={pick.pInterest}
              onChange={(pInterest) => onPick && onPick({ ...pick, pInterest })}
            />
          </>
        ) : (
          <>
            <DirectEntry label={axes.directed} min={directed.min} max={directed.max} value={pick.pDirected} text={typed?.pDirected} onChange={(pDirected) => onPick && onPick({ ...pick, pDirected })} />
            <DirectEntry label={axes.interest} min={interest.min} max={interest.max} value={pick.pInterest} text={typed?.pInterest} onChange={(pInterest) => onPick && onPick({ ...pick, pInterest })} />
          </>
        )}
      </div>
      {/* The other control, one tap away — never beside it. */}
      <button
        type="button"
        onClick={() => setShowing((current) => (current === "sliders" ? "entry" : "sliders"))}
        className={BUTTON_CLASS}
        style={{
          ...buttonStyle({ variant: "text", size: "sm" }),
          alignSelf: "flex-start",
          marginTop: "var(--space-2)",
          color: "var(--text-secondary)",
          fontSize: "var(--text-label-medium)",
        }}
      >
        {showing === "sliders" ? (one ? "Type an exact value" : "Type exact values") : one ? "Use a slider" : "Use sliders"}
      </button>
    </>
  );
}

/* THE ALTERNATES TRAVEL WITH THE RECORD FAMILY, AND SO DOES THEIR HOST (jakob's
   ruling, the night batch 2026-10-01 — audit K10.1). The tag and citation
   sheets carried a pad no keyboard, switch or screen reader could reach, and
   this surface could not host them honestly: it took no bound, titled itself
   "Choose your opinion", committed with "Sign it", and always offered a
   walk-away. Each of those is now the caller's:

   · `ranges` — the census's reach per slot (`TAG_RANGES` for a tag's pair, the
     stance's ±1 otherwise), handed to both tracks and both typed fields.
   · `title` and `commitLabel` — the dialog's name and its affirmative, for a
     family whose act is not an opinion.
   · `onSever` — the walk-away is drawn only when the caller hands one. An
     opinion's control always does; a tag or citation sheet never does, because
     its withdrawal is a control of the sheet's own (`Un-tag`, `Remove
     citation`), never the far end of a pair.
   · `host="sheet"` — no dialog at all. The sheet that hosts it keeps its own
     title, its own `Done` and its own scrim; this renders only the readouts it
     is handed, the two tracks, their swap and the landing, IN THE PLACE OF THE
     FIELD. One commit, and no modal stacked over a sheet. The "?" stays the
     dialog's: its lines teach the opinion's sign-it act, which a sheet that
     stages and never signs does not have. */
export function StanceAlternates({
  mode = "pad",
  pick,
  onPick,
  onCommit,
  onCancel,
  onSever,
  busy = false,
  children,
  landing,
  inline = false,
  helpLabel = "How opinions work",
  axes = STANCE_AXES,
  ranges = STANCE_RANGES,
  title = "Choose your opinion",
  commitLabel = "Sign it",
  host = "dialog",
  /* ONE AXIS (jakob 2026-10-20, seam 240: the input setting governs
     everywhere). A family with one free parameter — the backing an author
     signs with their own content, `p_i` pinned at 1 by the census — takes ONE
     track and ONE typed field, over `pDirected` alone. The pinned number is
     never drawn, not even as a locked track: a control nobody can move is a
     choice the record does not have. The pick keeps its pair shape, the pin
     riding along untouched. */
  axis = "pair",
  /* The unreachable landing's explanation, handed by the host once its 🤔 is
     tapped: it replaces the body in place, and `onZeroBack` returns. */
  zeroHelp,
  onZeroBack,
  /* THE COMMIT WAITS FOR ITS SIGNATURE, AS SET DOES (seam 245, ask 14 —
     `StanceControl`'s `signing`, handed on while the alternates are up).
     `"busy"`: past 200ms the commit reads `Signing…` and goes inert, never
     dimmed. `"failed"`: the dialog stays up at the pick, the fault line
     stands above the action row in the seal's words, and `Retry`, outlined,
     takes the commit's slot — the pad's grammar, because it is the same act
     through another control. `"writeRule"`: the write rule's notice stands
     where the landing line and the action row were, `PadWriteRule`'s shape,
     its own "?" by the stopper exception, and `Not now` the way out; no
     Retry. The legacy `busy` reads as `"busy"`. Dialog host only: a sheet
     never signs. */
  signing,
  /* What the typed fields hold mid-typing, for a board (`{ pDirected:
     "1.5" }`): a state a click cannot reach. */
  typed,
}) {
  const state = signing ?? (busy ? "busy" : undefined);
  const [showing, setShowing] = React.useState(mode === "entry" ? "entry" : "sliders");
  // The same help affordance the pad carries, for the same reason: TWO VALUES per
  // interaction is the genuinely new idea in this control, and a reader meeting it
  // as two sliders has nothing to infer it from — the pad at least teaches it by
  // being a square. `helpLabel` mirrors `StanceControl`'s own prop (ruling A7):
  // the caller passing one pad's name passes the same name here.
  const [explaining, setExplaining] = React.useState(false);
  /* THE DIALOG MUST NOT RESIZE WHEN THE HELP OPENS. The pad gets this for free — it
     is parked by its bottom edge, so its actions stay put however tall it is. This
     dialog is centred, so every height change moves every button in it.

     So the help replaces the WHOLE body — the readouts included, since a reader
     following an explanation is not reading their own numbers at the same time —
     and it takes at least the height of what it replaced. That space is larger
     than the four lines need, so nothing scrolls: an inner scrollbar on a phone
     surface is not a native gesture and the copy is not long enough to earn one. */
  const slotRef = React.useRef(null);
  const [slotHeight, setSlotHeight] = React.useState(null);
  React.useEffect(() => {
    if (explaining || zeroHelp) return;
    const measured = slotRef.current?.offsetHeight;
    if (measured) setSlotHeight(measured);
  }, [explaining, zeroHelp, showing]);
  const inputs = <AlternateInputs showing={showing} setShowing={setShowing} pick={pick} onPick={onPick} axes={axes} ranges={ranges} axis={axis} typed={typed} />;
  if (host === "sheet") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {children}
        {inputs}
        {landing}
      </div>
    );
  }
  return (
    <DialogSurface ariaLabel={title} inline={inline} onScrimPress={onCancel}>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-expanded={explaining}
          aria-label={helpLabel}
          onClick={() => setExplaining((shown) => !shown)}
          className={BUTTON_CLASS}
          style={{
            position: "absolute",
            top: "-12px",
            right: "-12px",
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
        <h2
          style={{
            margin: 0,
            paddingRight: "40px",
            fontSize: "var(--text-title-large)",
            lineHeight: "var(--text-title-large--line-height)",
            fontWeight: "var(--text-title-large--font-weight)",
          }}
        >
          {title}
        </h2>
      </div>
      {/* The help replaces the readouts and the inputs alike — and so does the
          unreachable landing's explanation, which the host hands as
          `zeroHelp` once its 🤔 is tapped. */}
      {zeroHelp ? (
        <div style={{ minHeight: slotHeight ?? undefined, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {zeroHelp.map((line) => (
            <p key={helpKey(line)} style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
              <HelpLine line={line} />
            </p>
          ))}
          <button
            type="button"
            onClick={onZeroBack}
            className={BUTTON_CLASS}
            style={{ ...buttonStyle({ variant: "text", size: "sm" }), alignSelf: "flex-start" }}
          >
            Back
          </button>
        </div>
      ) : explaining ? (
        <div
          style={{
            minHeight: slotHeight ?? undefined,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          {alternatesHelp(axes).map((line) => (
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
            Back
          </button>
        </div>
      ) : (
        <div ref={slotRef} style={{ display: "flex", flexDirection: "column" }}>
          {children}
          {inputs}
          {state !== "writeRule" && landing}
        </div>
      )}
      {state === "writeRule" ? (
        /* The write rule's no (`PadWriteRule`): the notice where the landing
           line and the action row were, the readouts and the tracks above it
           as they were, and `Not now` — the way out that keeps nothing. */
        <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <NoticePanel title={WRITE_RULE_WORDS.title} helpLabel={WRITE_RULE_WORDS.help} onHelp={() => {}}>
            <NoticeLine>{WRITE_RULE_WORDS.padFact}</NoticeLine>
          </NoticePanel>
          <button type="button" onClick={onCancel} className={BUTTON_CLASS} style={{ ...buttonStyle({ variant: "text" }), width: "100%" }}>
            Not now
          </button>
        </div>
      ) : (
        <>
          {/* A signing that did not go through says so above the action row,
              in the seal's words, and the commit's slot asks it again. */}
          {state === "failed" && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <TransportError message="That didn't send. Try again." />
            </div>
          )}
          <div
            style={{
              marginTop: state === "failed" ? "var(--space-3)" : "var(--space-6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "var(--space-2)",
            }}
          >
            {onSever && (
              <button type="button" onClick={onSever} className={BUTTON_CLASS} style={{ ...buttonStyle({ variant: "text", size: "sm" }), marginRight: "auto" }}>
                {severanceWords(axes).control}
              </button>
            )}
            <button type="button" onClick={onCancel} className={BUTTON_CLASS} style={buttonStyle({ variant: "text", size: "sm" })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={state === "busy" ? undefined : onCommit}
              aria-busy={state === "busy" || undefined}
              aria-disabled={state === "busy" || undefined}
              className={BUTTON_CLASS}
              style={buttonStyle({ variant: state === "failed" ? "outline" : "primary", size: "sm", busy: state === "busy" })}
            >
              {state === "busy" ? "Signing…" : state === "failed" ? "Retry" : commitLabel}
            </button>
          </div>
        </>
      )}
    </DialogSurface>
  );
}
