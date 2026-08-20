"use client";

// The license surface, shared by the two composers that declare one and
// the two read surfaces that show it (platform-guidelines.md §5). The
// chooser offers named readings only: the axes are continuous on the
// wire, but a degree CoGra has published no reading for is a term no
// author could mean and no reader could check.

import {
  ATTRIBUTION_TIERS,
  PROVENANCE_TIERS,
  licenseTerms,
  type License,
  type LicenseTier,
} from "@/lib/license";

function AxisChoice({
  legend,
  tiers,
  name,
  testIdPrefix,
  value,
  onChange,
}: {
  legend: string;
  tiers: readonly LicenseTier[];
  name: string;
  testIdPrefix: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1" role="radiogroup" aria-label={legend}>
      <span className="text-body-medium">{legend}</span>
      <div className="flex flex-wrap items-center gap-3">
        {tiers.map((tier) => (
          <label key={tier.value} className="flex items-center gap-1 text-body-medium">
            <input
              type="radio"
              name={name}
              className="accent-primary"
              data-testid={`${testIdPrefix}-${tier.value}`}
              checked={value === tier.value}
              onChange={() => onChange(tier.value)}
            />
            {tier.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** The two-axis declaration a genesis content record carries. */
export function LicenseChooser({
  value,
  onChange,
  testIdPrefix,
}: {
  value: License;
  onChange: (license: License) => void;
  testIdPrefix: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" data-testid={`${testIdPrefix}-license`}>
      <legend className="text-label-large">License</legend>
      <p className="text-body-small text-on-surface-variant">
        Terms for anyone who reuses this — not a statement about how you made
        it.
      </p>
      <AxisChoice
        legend="Credit"
        tiers={ATTRIBUTION_TIERS}
        name={`${testIdPrefix}-attribution`}
        testIdPrefix={`${testIdPrefix}-license-attribution`}
        value={value.attribution}
        onChange={(attribution) => onChange({ ...value, attribution })}
      />
      <AxisChoice
        legend="Public record of use"
        tiers={PROVENANCE_TIERS}
        name={`${testIdPrefix}-provenance`}
        testIdPrefix={`${testIdPrefix}-license-provenance`}
        value={value.provenance}
        onChange={(provenance) => onChange({ ...value, provenance })}
      />
    </fieldset>
  );
}

/** What a landed node's qualifiers oblige, on the read surface. */
export function LicenseTerms({ license, testId }: { license: License; testId: string }) {
  return (
    <p className="text-body-small text-on-surface-variant" data-testid={testId}>
      {licenseTerms(license).join(" ")}
    </p>
  );
}
