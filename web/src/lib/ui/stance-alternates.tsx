"use client";

// The alternate inputs of design.md §8.6 — paired sliders and direct
// entry. Same machinery as the pad, different surface: they write the
// same two values, and the readout above them is the same lossy face.
//
// They are also the ACCESSIBLE path (§8.6, §10). The pad is a drag
// gesture; these give screen-reader and switch users the full range
// through ordinary, well-supported controls rather than a degraded
// version of the gesture, which is why the entry into them is present on
// every stance control regardless of the stored preference.
//
// Which surfaces show follows that preference: choosing one replaces the
// pad everywhere, and while the pad is still the chosen input neither
// alternate has been picked, so both are offered here.

import { useEffect, useId, useRef } from "react";

import { clampDimension, type StancePair } from "@/lib/stance/model";
import type { StanceInputMode } from "@/lib/stance/input-mode";
import { buttonClassName } from "@/lib/ui/button";
import { DIRECTED_LABEL, formatStanceWords, INTEREST_LABEL } from "@/lib/ui/stance-format";
import { StanceSlider } from "@/lib/ui/stance-slider";

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
        onChange={(event) => onChange(clampDimension(Number(event.target.value)))}
        className="w-24 rounded-extra-small border border-outline p-2 text-body-medium"
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
  busy = false,
  children,
  landing,
}: {
  mode: StanceInputMode;
  pick: StancePair;
  onPick: (pair: StancePair) => void;
  onCommit: () => void;
  onCancel: () => void;
  /**
   * Severance is findable from the open pad (design.md §8.5); for anyone
   * whose input is an alternate, the pad never opens, so it is findable
   * here instead.
   */
  onSever: () => void;
  busy?: boolean;
  /** The standing, rendered above the inputs the way it sits above the pad. */
  children?: React.ReactNode;
  /** The landing line, which sits below the inputs as it sits below the field. */
  landing?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const showSliders = mode !== "entry";
  const showEntry = mode !== "sliders";

  return (
    <dialog
      ref={ref}
      data-testid="stance-alternates"
      onClose={onCancel}
      className="m-auto w-[min(90vw,24rem)] rounded-extra-large bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2 className="text-title-large">Choose your stance</h2>
      {children}
      <div className="mt-4 flex flex-col gap-4">
        {showSliders && (
          <>
            <StanceSlider
              label={DIRECTED_LABEL}
              value={pick.pDirected}
              onChange={(pDirected) => onPick({ ...pick, pDirected })}
              testId="stance-alt-directed"
            />
            <StanceSlider
              label={INTEREST_LABEL}
              value={pick.pInterest}
              onChange={(pInterest) => onPick({ ...pick, pInterest })}
              testId="stance-alt-interest"
            />
          </>
        )}
        {showEntry && (
          <>
            <DirectEntry
              label={DIRECTED_LABEL}
              value={pick.pDirected}
              onChange={(pDirected) => onPick({ ...pick, pDirected })}
              testId="stance-entry-directed"
            />
            <DirectEntry
              label={INTEREST_LABEL}
              value={pick.pInterest}
              onChange={(pInterest) => onPick({ ...pick, pInterest })}
              testId="stance-entry-interest"
            />
          </>
        )}
      </div>
      <p data-testid="stance-alt-exact" className="mt-3 text-body-small text-on-surface-variant">
        {formatStanceWords(pick)}
      </p>
      {landing}
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="stance-alt-sever"
          onClick={onSever}
          className={`mr-auto ${buttonClassName({ variant: "text", size: "sm" })}`}
        >
          Sever
        </button>
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
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Sign it
        </button>
      </div>
    </dialog>
  );
}
