import React from "react";

/* The license surface (platform-guidelines.md §5), shared by the two composers
   that declare one and the two read surfaces that show it.

   Two axes, each a degree on [0,1] — credit and public record of use. The chooser
   offers NAMED READINGS ONLY: the axes are continuous on the wire, but a degree
   CoGra has published no reading for is a term no author could mean and no reader
   could check. Both are terms over downstream use, never a statement about how the
   content was made. */

export const ATTRIBUTION_TIERS = [
  { value: 0, label: "No credit", hint: "Nobody owes you a name." },
  { value: 0.5, label: "Credit commercially", hint: "Commercial uses credit you; everything else is free." },
  { value: 1, label: "Credit always", hint: "Every use credits you." },
];

export const PROVENANCE_TIERS = [
  { value: 0, label: "No record", hint: "Uses go unlogged." },
  { value: 0.5, label: "Record commercially", hint: "Commercial uses are logged publicly and stay open to audit." },
  { value: 1, label: "Record always", hint: "Every use is logged publicly and stays open to audit." },
];

export const PUBLIC_DOMAIN = { attribution: 0, provenance: 0 };

function tierOf(tiers, value) {
  return tiers.find((tier) => tier.value === value) ?? null;
}

/** The obligations a pair puts on a reuser, as display lines. */
export function licenseTerms(license) {
  if (license.attribution === 0 && license.provenance === 0) {
    return ["Public domain — no obligation on reuse"];
  }
  const terms = [];
  if (license.attribution > 0) {
    terms.push(tierOf(ATTRIBUTION_TIERS, license.attribution)?.hint ?? `Credit owed to degree ${license.attribution}.`);
  }
  if (license.provenance > 0) {
    terms.push(tierOf(PROVENANCE_TIERS, license.provenance)?.hint ?? `Uses logged publicly to degree ${license.provenance}.`);
  }
  return terms;
}

function AxisChoice({ legend, tiers, name, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={legend} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-body-medium)" }}>{legend}</span>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
        {tiers.map((tier) => (
          <label key={tier.value} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "var(--text-body-medium)" }}>
            <input
              type="radio"
              name={name}
              checked={value === tier.value}
              onChange={() => onChange && onChange(tier.value)}
              style={{ accentColor: "var(--primary)" }}
            />
            {tier.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** The two-axis declaration a genesis content record carries. */
export function LicenseChooser({ value = PUBLIC_DOMAIN, onChange, name = "license" }) {
  return (
    <fieldset style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", border: 0, margin: 0, padding: 0 }}>
      <legend
        style={{
          padding: 0,
          fontSize: "var(--text-label-large)",
          fontWeight: "var(--text-label-large--font-weight)",
        }}
      >
        License
      </legend>
      <p style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
        Terms for anyone who reuses this — not a statement about how you made it.
      </p>
      <AxisChoice
        legend="Credit"
        tiers={ATTRIBUTION_TIERS}
        name={`${name}-attribution`}
        value={value.attribution}
        onChange={(attribution) => onChange && onChange({ ...value, attribution })}
      />
      <AxisChoice
        legend="Public record of use"
        tiers={PROVENANCE_TIERS}
        name={`${name}-provenance`}
        value={value.provenance}
        onChange={(provenance) => onChange && onChange({ ...value, provenance })}
      />
    </fieldset>
  );
}

/** What a landed node's qualifiers oblige, on the read surface. */
export function LicenseTerms({ license = PUBLIC_DOMAIN }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
      {licenseTerms(license).join(" ")}
    </p>
  );
}
