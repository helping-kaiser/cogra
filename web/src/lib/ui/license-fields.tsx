"use client";

// The license surface, shared by the two composers that declare one and
// the two read surfaces that show it (platform-guidelines.md §5). The
// chooser offers named readings only: the axes are continuous on the
// wire, but a degree CoGra has published no reading for is a term no
// author could mean and no reader could check.

import React from "react";

import {
  ATTRIBUTION_TIERS,
  PROVENANCE_TIERS,
  isPublicDomain,
  licenseReadings,
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

/**
 * What a landed node's qualifiers oblige, on the read surface
 * (`LicenseChooser.jsx:110-176`).
 *
 * A QUIET INSET, NOT A PARAGRAPH. The terms are the one thing about a post a
 * reader may have to act on — a reuser checking what they owe — so they are
 * drawn as a block read at a glance rather than a sentence to be parsed: the
 * caption names the words the reader tapped, and each axis states its own
 * reading on its own row, the two aligned so the pair reads as a pair.
 *
 * It takes NO fill. The sheet it comes up in is a raised container already, so
 * a filled inset on top of it would either invert between the themes or claim
 * an elevation this owes nothing to; a hairline recesses it in both. Nothing
 * here is coloured — the terms are neither a warning nor a promotion.
 */
export function LicenseTerms({ license, testId }: { license: License; testId: string }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-medium border border-outline-variant p-3"
      data-testid={testId}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label-small text-on-surface-variant">License terms</span>
        {/* THE NAME OF THE COMMON PAIR. Both axes at zero is the one reading
            readers already have a word for, and the word carries further than
            the two rows that spell it — so it rides the caption line rather
            than replacing the rows, which stay uniform across every license. */}
        {isPublicDomain(license) && (
          <span className="text-label-small" data-testid={`${testId}-public-domain`}>
            Public domain
          </span>
        )}
      </div>
      <div className="grid grid-cols-[116px_1fr] gap-x-2 gap-y-1">
        {licenseReadings(license).map((row) => (
          <React.Fragment key={row.axis}>
            <span className="text-body-small text-on-surface-variant">{row.axis}</span>
            <span className="text-body-small">{row.reading}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
