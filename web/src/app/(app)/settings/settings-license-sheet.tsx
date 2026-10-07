"use client";

// THE DEFAULT LICENSE (design/designs/canonical/screens/SettingsLicense.jsx;
// behavior/SettingsLicense.md). The seal's own license sheet's axes and
// readings, over settings, titled by the row that opened it, with the note a
// default needs and the seal's sheet cannot say. Taps stage; Done saves and
// closes; the scrim, a swipe down, Back and Escape discard.
//
// The axis rows are ComposeLicense's anatomy to the pixel (`LicenseRows`),
// drawn here with the registered `settings.licenseSheet.*` paths: each
// reading is a `tier` keyed by its place on the axis, the least asked first.

import { useState } from "react";

import {
  ATTRIBUTION_TIERS,
  licenseReading,
  PROVENANCE_TIERS,
  type License,
  type LicenseTier,
} from "@/lib/license";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { buttonClassName } from "@/lib/ui/button";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { HelpDot } from "@/lib/ui2/help-dot";
import { QuietNote } from "@/lib/ui2/quiet-note";

const SHEET: DataNode = { path: "settings.licenseSheet" };

function AxisLabel({ children, node }: { children: string; node: DataNode }) {
  return (
    <span className="text-label-small text-on-surface-variant" {...testAttributes(node)}>
      {children}
    </span>
  );
}

function Axis({
  legend,
  tiers,
  name,
  value,
  onChange,
  node,
}: {
  legend: string;
  tiers: readonly LicenseTier[];
  name: string;
  value: number;
  onChange: (value: number) => void;
  node: DataNode;
}) {
  return (
    <div role="radiogroup" aria-label={legend} className="flex flex-col gap-1.5" {...testAttributes(node)}>
      {tiers.map((tier, index) => {
        const tierNode = instance(node, "tier", String(index + 1));
        const chosen = value === tier.value;
        return (
          <label
            key={tier.value}
            className="cg-state cg-focus relative flex min-h-6 cursor-pointer items-start gap-2.5 rounded-small"
            {...testAttributes(tierNode)}
          >
            <input
              type="radio"
              name={name}
              checked={chosen}
              onChange={() => onChange(tier.value)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`mt-px box-border size-[18px] flex-none rounded-full border ${
                chosen ? "border-[5px] border-primary" : "border-outline"
              }`}
              {...testAttributes(part(tierNode, "dot"))}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body-medium" {...testAttributes(part(tierNode, "label"))}>
                {tier.label}
              </span>
              <span
                className="text-body-small text-on-surface-variant"
                {...testAttributes(part(tierNode, "hint"))}
              >
                {tier.hint}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function SettingsLicenseSheet({
  license,
  onDone,
  onDiscard,
}: {
  /** The account's current default — what the sheet opens on. */
  license: License;
  onDone: (license: License) => void;
  onDiscard: () => void;
}) {
  const [staged, setStaged] = useState<License>(license);
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <BottomSheet
        open
        onClose={onDiscard}
        title="Default license"
        titleTrailing={
          <HelpDot ariaLabel="License" onOpen={() => setHelpOpen(true)} node={part(SHEET, "title.help")} />
        }
        node={SHEET}
        foot={
          <div
            className="mx-6 flex items-center gap-2 border-t border-outline-variant pt-2.5"
            {...testAttributes(part(SHEET, "foot"))}
          >
            <span
              className="flex-1 text-body-small text-on-surface-variant"
              {...testAttributes(part(SHEET, "foot.summary"))}
            >
              {licenseReading(staged)}
            </span>
            <button
              type="button"
              onClick={() => onDone(staged)}
              className={buttonClassName({ variant: "primary" })}
              {...testAttributes(part(SHEET, "foot.done"))}
            >
              Done
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <QuietNote node={part(SHEET, "note")}>
            Where every new post starts. A post&apos;s terms settle when it is first signed, so
            changing this never reaches one you have already published.
          </QuietNote>
          <AxisLabel node={part(SHEET, "creditLabel")}>Credit</AxisLabel>
          <Axis
            legend="Credit"
            tiers={ATTRIBUTION_TIERS}
            name="default-license-attribution"
            value={staged.attribution}
            onChange={(attribution) => setStaged({ ...staged, attribution })}
            node={part(SHEET, "credit")}
          />
          <AxisLabel node={part(SHEET, "recordLabel")}>Public record of use</AxisLabel>
          <Axis
            legend="Public record of use"
            tiers={PROVENANCE_TIERS}
            name="default-license-provenance"
            value={staged.provenance}
            onChange={(provenance) => setStaged({ ...staged, provenance })}
            node={part(SHEET, "record")}
          />
        </div>
      </BottomSheet>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} topic={HELP_TOPICS.license} />
    </>
  );
}
