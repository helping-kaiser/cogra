"use client";

// The license sheet's own row anatomy — a radio dot, the reading, and its
// hint beneath — as `ComposeLicense` draws it
// (design/designs/canonical/screens/ComposeLicense.jsx:5-11, 35-59), which
// explicitly refuses `LicenseChooser`'s layout: that fieldset of wrapped
// native radios is a settings-page form control, where this sheet is the
// author's own decision surface for the one post being signed.
//
// The readings and their hints still come off `ATTRIBUTION_TIERS` and
// `PROVENANCE_TIERS` — the same tables `LicenseChooser` reads — so what a
// license promises is written once regardless of which layout shows it.
//
// `LicenseChooser` itself is untouched: the account-default settings page
// and any other settings-shaped caller keep its fieldset.

import {
  ATTRIBUTION_TIERS,
  PROVENANCE_TIERS,
  type License,
  type LicenseTier,
} from "@/lib/license";

function AxisRows({
  legend,
  tiers,
  name,
  testIdPrefix,
  value,
  onChange,
  flat,
}: {
  legend: string;
  tiers: readonly LicenseTier[];
  name: string;
  testIdPrefix: string;
  value: number;
  onChange: (value: number) => void;
  flat: boolean;
}) {
  return (
    <div className={flat ? "contents" : "flex flex-col gap-1.5"}>
      {/* The axis's label stands BESIDE its group, one item of the sheet's
          8px column (`LicenseAxisLabel`, `ComposeLicense.jsx`). */}
      <span className="text-label-small text-on-surface-variant">{legend}</span>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={legend}>
      {tiers.map((tier) => (
        <label
          key={tier.value}
          className="cg-state cg-focus flex min-h-6 cursor-pointer items-start gap-2.5 rounded-small"
        >
          <input
            type="radio"
            name={name}
            data-testid={`${testIdPrefix}-${tier.value}`}
            checked={value === tier.value}
            onChange={() => onChange(tier.value)}
            className="sr-only"
          />
          {/* The dot keeps the reading's first line — the same 1px offset
              `LicenseAxis` draws — so it centres on the words that name the
              choice rather than on the row as a whole. */}
          <span
            aria-hidden="true"
            className={`mt-px box-border size-[18px] flex-none rounded-full border ${
              value === tier.value ? "border-[5px] border-primary" : "border-outline"
            }`}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body-medium">{tier.label}</span>
            <span className="text-body-small text-on-surface-variant">{tier.hint}</span>
          </span>
        </label>
      ))}
      </div>
    </div>
  );
}

/** The license sheet's two axis groups, drawn as the board's own rows. */
export function LicenseRows({
  value,
  onChange,
  testIdPrefix,
  flat = false,
}: {
  value: License;
  onChange: (license: License) => void;
  testIdPrefix: string;
  /**
   * The labels and groups become items of the sheet's own column, as the
   * post's license sheet draws them (8px apart); otherwise the two axes stand
   * 16px apart in a column of their own.
   */
  flat?: boolean;
}) {
  return (
    <div
      className={flat ? "contents" : "flex flex-col gap-4"}
      data-testid={`${testIdPrefix}-license-rows`}
    >
      <AxisRows
        legend="Credit"
        tiers={ATTRIBUTION_TIERS}
        name={`${testIdPrefix}-license-attribution`}
        testIdPrefix={`${testIdPrefix}-license-attribution`}
        value={value.attribution}
        onChange={(attribution) => onChange({ ...value, attribution })}
        flat={flat}
      />
      <AxisRows
        legend="Public record of use"
        tiers={PROVENANCE_TIERS}
        name={`${testIdPrefix}-license-provenance`}
        testIdPrefix={`${testIdPrefix}-license-provenance`}
        value={value.provenance}
        onChange={(provenance) => onChange({ ...value, provenance })}
        flat={flat}
      />
    </div>
  );
}
