import React from "react";

/* The license surface (platform-guidelines.md §5), shared by the two composers
   that declare one and the sheet the read surfaces open to show it.

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

/* THE MENU ROW THAT OPENS THE TERMS is an atom (readme §13, atoms): one
   assignment, many surfaces. The cards prepend it to their own overflow menus
   and the detail surfaces' headers spell the same menu, so the words live here
   rather than in each of them. */
export const LICENSE_MENU_LABEL = "License terms";

/* THE READER'S READINGS, not the author's. The chooser's hints address the
   author declaring the terms ("Every use credits you"), which on a read surface
   would tell a reader they are owed the credit they in fact owe. So the read
   side has its own table, in the reuser's second person, one line per axis. */
const READER_READINGS = {
  attribution: { 0: "Not required", 0.5: "Required for commercial use", 1: "Required for every use" },
  provenance: { 0: "Not logged", 0.5: "Commercial uses logged publicly", 1: "Every use logged publicly" },
};

function tierOf(tiers, value) {
  return tiers.find((tier) => tier.value === value) ?? null;
}

/** What a pair obliges, per axis, as the read surface says it. */
export function licenseReadings(license) {
  return [
    { axis: "Credit", reading: READER_READINGS.attribution[license.attribution] ?? `Owed to degree ${license.attribution}` },
    { axis: "Public record of use", reading: READER_READINGS.provenance[license.provenance] ?? `Logged to degree ${license.provenance}` },
  ];
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

/** What a landed node's qualifiers oblige, on the read surface.

   A QUIET INSET, NOT A PARAGRAPH. The terms are the one thing about a post a
   reader may have to act on — a reuser checking what they owe — so they are
   drawn as a block that can be read at a glance rather than a sentence to be
   parsed: the caption names the words the reader tapped, and each axis states
   its own reading on its own row, the two readings aligned so the pair reads
   as a pair.

   It takes NO fill. The sheet it comes up in is already the highest container
   rung, so a filled inset on top of it would either invert between the themes
   or claim an elevation this owes nothing to; a hairline at the medium rung
   recesses it in both. Nothing here is coloured — the terms are neither a warning nor a
   promotion, and `--error` is spoken for (readme §13, the input-error round). */
export function LicenseTerms({ license = PUBLIC_DOMAIN }) {
  const publicDomain = license.attribution === 0 && license.provenance === 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-medium)",
        padding: "var(--space-3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <span
          style={{
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            fontWeight: "var(--text-label-small--font-weight)",
            letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
            color: "var(--text-secondary)",
          }}
        >
          License terms
        </span>
        {/* THE NAME OF THE COMMON PAIR. Both axes at zero is the one reading
            readers already have a word for, and the word carries further than
            the two rows that spell it — so it rides the caption line rather
            than replacing the rows, which stay uniform across every license. */}
        {publicDomain && (
          <span
            style={{
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              fontWeight: "var(--text-label-small--font-weight)",
            }}
          >
            Public domain
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "116px 1fr", columnGap: "var(--space-2)", rowGap: "var(--space-1)" }}>
        {licenseReadings(license).map((row) => (
          <React.Fragment key={row.axis}>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
              {row.axis}
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)" }}>{row.reading}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
