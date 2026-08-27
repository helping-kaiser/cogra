import React from "react";
import { DialogSurface } from "../core/JoinPrompt.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import { StanceSlider } from "./StanceSlider.jsx";
import { STANCE_ALTERNATES_HELP } from "./StanceCoachMark.jsx";
import { clampDimension, DIRECTED_LABEL, DIRECTED_POLES, INTEREST_LABEL, INTEREST_POLES } from "./StanceReadout.jsx";

/* The alternate inputs (design.md §8.6) — paired sliders and direct entry. Same
   machinery as the pad, different surface: they write the same two values, and the
   readout above them is the same lossy face.

   They are also the ACCESSIBLE path (§8.6, §10): the pad is a drag gesture, and
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
   Android's own StanceSlider); typing is one quiet tap away. §8.6 asks that both
   routes exist, not that both are on screen at once.

   Severance is findable from the open pad; for anyone whose input is an alternate
   the pad never opens, so it is findable here instead. */

function DirectEntry({ label, value, onChange }) {
  const id = React.useId();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
      <label htmlFor={id} style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange && onChange(clampDimension(Number(event.target.value)))}
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
}) {
  const [showing, setShowing] = React.useState(mode === "entry" ? "entry" : "sliders");
  // The same help affordance the pad carries, for the same reason: TWO VALUES per
  // interaction is the genuinely new idea in this control, and a reader meeting it
  // as two sliders has nothing to infer it from — the pad at least teaches it by
  // being a square.
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
    if (explaining) return;
    const measured = slotRef.current?.offsetHeight;
    if (measured) setSlotHeight(measured);
  }, [explaining, showing]);
  return (
    <DialogSurface ariaLabel="Choose your stance" inline={inline} onScrimPress={onCancel} width="24rem">
      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-expanded={explaining}
          aria-label="How stances work"
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
          Choose your stance
        </h2>
      </div>
      {/* The help replaces the readouts and the inputs alike. */}
      {explaining ? (
        <div
          style={{
            minHeight: slotHeight ?? undefined,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          {STANCE_ALTERNATES_HELP.map((line) => (
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
            Back
          </button>
        </div>
      ) : (
        <div ref={slotRef} style={{ display: "flex", flexDirection: "column" }}>
          {children}
          <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {showing === "sliders" ? (
          <>
            <StanceSlider
              label={DIRECTED_LABEL}
              minLabel={DIRECTED_POLES[0]}
              maxLabel={DIRECTED_POLES[1]}
              value={pick.pDirected}
              onChange={(pDirected) => onPick && onPick({ ...pick, pDirected })}
            />
            <StanceSlider
              label={INTEREST_LABEL}
              minLabel={INTEREST_POLES[0]}
              maxLabel={INTEREST_POLES[1]}
              value={pick.pInterest}
              onChange={(pInterest) => onPick && onPick({ ...pick, pInterest })}
            />
          </>
        ) : (
          <>
            <DirectEntry label={DIRECTED_LABEL} value={pick.pDirected} onChange={(pDirected) => onPick && onPick({ ...pick, pDirected })} />
            <DirectEntry label={INTEREST_LABEL} value={pick.pInterest} onChange={(pInterest) => onPick && onPick({ ...pick, pInterest })} />
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
        {showing === "sliders" ? "Type exact values" : "Use sliders"}
      </button>
      {landing}
        </div>
      )}
      <div style={{ marginTop: "var(--space-6)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-2)" }}>
        <button type="button" onClick={onSever} className={BUTTON_CLASS} style={{ ...buttonStyle({ variant: "text", size: "sm" }), marginRight: "auto" }}>
          Sever
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_CLASS} style={buttonStyle({ variant: "text", size: "sm" })}>
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={onCommit} className={BUTTON_CLASS} style={buttonStyle({ variant: "primary", size: "sm", disabled: busy })}>
          Sign it
        </button>
      </div>
    </DialogSurface>
  );
}
