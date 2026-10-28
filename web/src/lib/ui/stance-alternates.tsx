"use client";

// THE ALTERNATE INPUTS (`design/components/stance/StanceAlternates.jsx` and
// its prompt) — paired sliders and direct entry. Same machinery as the pad,
// different surface: they write the same two values, and the readouts above
// them are the pad's own three.
//
// They are also the ACCESSIBLE path (§8.6, §10): the pad is a drag gesture,
// and these give screen-reader and switch users the full range through
// ordinary controls — which is why the entry into them is present on every
// stance control regardless of the stored preference.
//
// ONE CONTROL AT A TIME. Sliders lead; `Type exact values` swaps to the typed
// fields and back. Two controls editing the same two numbers is a needless
// choice at the moment of a priced act. A reader who chose typed entry in
// settings opens on the typed fields.
//
// THE "?" IS THE PAD'S OWN, and its first line teaches what two sliders
// cannot: two values, not one. The help — and an unreachable landing's
// explanation — replace the whole body in place, and the dialog keeps the
// body's height while they show, so no button moves.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import type { StanceInputMode } from "@/lib/stance/input-mode";
import { snapDimension, type StancePair } from "@/lib/stance/model";
import { BUTTON_CLASS, buttonClassName } from "@/lib/ui/button";
import { severanceWords, STANCE_AXES, type StanceAxes } from "@/lib/ui/stance-format";
import { alternatesHelp } from "@/lib/ui/stance-pad-help";
import { StanceSlider } from "@/lib/ui/stance-slider";
import { TransportError } from "@/lib/ui/transport-error";
import { useCoversSurface } from "@/lib/ui2/covering-layer";

function DirectEntry({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-label-large">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        type="number"
        inputMode="decimal"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        // A typed value lands on the hundredths grid, as a released drag does.
        onChange={(event) => onChange(snapDimension(Number(event.target.value)))}
        className="w-24 rounded-extra-small border border-outline bg-transparent p-2 text-body-medium text-on-surface"
      />
    </div>
  );
}

export function StanceAlternates({
  mode,
  pick,
  onPick,
  onCommit,
  onCancel,
  onSever,
  axes = STANCE_AXES,
  busy = false,
  fault = null,
  helpLabel = "How opinions work",
  zeroHelp = null,
  onZeroBack,
  children,
  landing,
  keyNotice = null,
}: {
  mode: StanceInputMode;
  pick: StancePair;
  onPick: (pair: StancePair) => void;
  onCommit: () => void;
  onCancel: () => void;
  /**
   * The walk-away, drawn only when handed: there must be something to walk
   * back, and for anyone whose input is an alternate the pad never opens, so
   * it is findable here instead.
   */
  onSever?: () => void;
  /** The record family's words — its tracks, poles and way out. */
  axes?: StanceAxes;
  busy?: boolean;
  /** What did not go through when `Sign it` was pressed. */
  fault?: "failed" | "writeRule" | null;
  /** The pad's own `?` name (ruling A7). */
  helpLabel?: string;
  /** The unreachable landing's explanation, once its 🤔 is tapped. */
  zeroHelp?: readonly string[] | null;
  onZeroBack?: () => void;
  /** The current opinion and the pick, above the inputs as above the field. */
  children?: ReactNode;
  /** The landing, below the inputs as below the field. */
  landing?: ReactNode;
  /**
   * THE KEY IS ELSEWHERE (PadKeyAbsent.md, carried to the alternates that
   * replace the pad, §8.6): the pad's key notice and its `Keep it pending,
   * restore later` stand where the landing, the faults and the actions would,
   * and the notice's "?" is the dialog's one. The inputs still move the pick.
   */
  keyNotice?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // THE PAD IN ITS ALTERNATE FORM, so it announces itself as the pad does — a
  // PAUSE, not a suspension (Feed.md:39/41; `covering-layer.tsx`). Mounted
  // only while open, so it covers for as long as it is mounted.
  useCoversSurface(true, "pause");
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const [showing, setShowing] = useState<"sliders" | "entry">(
    mode === "entry" ? "entry" : "sliders",
  );
  const [explaining, setExplaining] = useState(false);
  const replaced = zeroHelp !== null ? zeroHelp : explaining ? alternatesHelp(axes) : null;
  const back = zeroHelp !== null ? onZeroBack : () => setExplaining(false);

  return (
    <dialog
      ref={ref}
      data-testid="stance-alternates"
      aria-label="Choose your opinion"
      onClose={onCancel}
      onClick={(event) => {
        // The scrim is Cancel: nothing is staged by leaving.
        if (event.target === ref.current) onCancel();
      }}
      className="cg-dialog-in m-auto w-[min(calc(100vw_-_4rem),20rem)] overflow-visible rounded-extra-large border-0 bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <div className="relative">
        {keyNotice === null && (
        <button
          type="button"
          data-testid="stance-alt-help"
          aria-expanded={explaining}
          aria-label={helpLabel}
          onClick={() => setExplaining((shown) => !shown)}
          className={`${BUTTON_CLASS} absolute -right-3 -top-3 grid size-12 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0`}
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full border border-outline-variant text-label-large text-primary"
          >
            ?
          </span>
        </button>
        )}
        <h2 className="m-0 pr-10 text-title-large">Choose your opinion</h2>
      </div>
      {/* The help and the 🤔's explanation take the body's place AND its
          height: both stand in one grid cell, the body kept but invisible,
          so the centred dialog never resizes and no button moves. */}
      <div className="grid">
        <div
          className={`flex flex-col [grid-area:1/1] ${replaced !== null ? "invisible" : ""}`}
          aria-hidden={replaced !== null || undefined}
        >
          {children}
          <div className="mt-4 flex flex-col gap-4">
            {showing === "sliders" ? (
              <>
                <StanceSlider
                  label={axes.directed}
                  minLabel={axes.left}
                  maxLabel={axes.right}
                  value={pick.pDirected}
                  onChange={(pDirected) => onPick({ ...pick, pDirected })}
                  testId="stance-alt-directed"
                />
                <StanceSlider
                  label={axes.interest}
                  minLabel={axes.bottom}
                  maxLabel={axes.top}
                  value={pick.pInterest}
                  onChange={(pInterest) => onPick({ ...pick, pInterest })}
                  testId="stance-alt-interest"
                />
              </>
            ) : (
              <>
                <DirectEntry
                  label={axes.directed}
                  value={pick.pDirected}
                  onChange={(pDirected) => onPick({ ...pick, pDirected })}
                  testId="stance-entry-directed"
                />
                <DirectEntry
                  label={axes.interest}
                  value={pick.pInterest}
                  onChange={(pInterest) => onPick({ ...pick, pInterest })}
                  testId="stance-entry-interest"
                />
              </>
            )}
          </div>
          {/* The other control, one tap away — never beside it. */}
          <button
            type="button"
            data-testid="stance-alt-swap"
            onClick={() => setShowing((current) => (current === "sliders" ? "entry" : "sliders"))}
            className={`mt-2 self-start text-label-medium! text-on-surface-variant! ${buttonClassName({ variant: "text", size: "sm" })}`}
          >
            {showing === "sliders" ? "Type exact values" : "Use sliders"}
          </button>
          {keyNotice === null && landing}
        </div>
        {replaced !== null && (
          <div data-testid="stance-alt-explanation" className="flex flex-col gap-2 [grid-area:1/1]">
            {replaced.map((line) => (
              <p key={line} className="m-0 text-body-small text-on-surface-variant">
                {line}
              </p>
            ))}
            <button
              type="button"
              data-testid="stance-alt-back"
              onClick={back}
              className={`self-start ${buttonClassName({ variant: "text", size: "sm" })}`}
            >
              Back
            </button>
          </div>
        )}
      </div>
      {keyNotice !== null && <div className="mt-4 flex flex-col gap-3">{keyNotice}</div>}
      {keyNotice === null && fault === "failed" && (
        <div className="mt-4">
          <TransportError testId="stance-alt-failed" message="That didn't send. Try again." />
        </div>
      )}
      {keyNotice === null && fault === "writeRule" && (
        <p role="status" data-testid="stance-alt-write-rule" className="m-0 mt-4 text-body-medium text-on-surface-variant">
          You can&apos;t sign right now.
        </p>
      )}
      {keyNotice === null && (
      <div className="mt-6 flex items-center justify-end gap-2">
        {onSever !== undefined && (
          <button
            type="button"
            data-testid="stance-alt-sever"
            onClick={onSever}
            className={`mr-auto ${buttonClassName({ variant: "text", size: "sm" })}`}
          >
            {severanceWords(axes).control}
          </button>
        )}
        <button
          type="button"
          data-testid="stance-alt-cancel"
          onClick={onCancel}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="stance-alt-commit"
          disabled={busy}
          onClick={onCommit}
          className={buttonClassName({ variant: "primary", size: "sm" })}
        >
          Sign it
        </button>
      </div>
      )}
    </dialog>
  );
}
