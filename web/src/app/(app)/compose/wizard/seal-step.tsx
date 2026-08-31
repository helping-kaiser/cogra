"use client";

// ComposeSeal / ComposeKeyAbsent — the last screen, where every act is named
// with its price before anything is signed.
//
// The board's promise is the whole point of the screen: "4 signed actions —
// they land together, or none does". So the card lists the acts by kind rather
// than summing them silently, and the three terms below it — licence, where the
// author stands, sensitivity — are the settings a reader might still want to
// change with the cost in front of them.
//
// WHERE THE CANVAS AND THE CONTRACT DISAGREE, twice.
//
// ComposePad draws the stance as a two-axis pad. On a Publish record
// `pInterest` is census-fixed at 1 and only `pDirected` is the author's to set,
// so a second axis would be a control that does nothing. One slider is shown
// instead.
//
// ComposeSensitive draws a "Sensitive — Mark" row. Nothing in the contract can
// carry that declaration, so the row is absent rather than inert: a control
// that reports "Marked" while sending nothing would be a safety promise the
// system does not keep. Both are reported, not decided here.

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { StanceSlider } from "@/lib/ui/stance-slider";
import { LicenseChooser } from "@/lib/ui/license-fields";
import { formatDimension } from "@/lib/ui/stance-format";
import { licenseTerms, PUBLIC_DOMAIN, type License } from "@/lib/license";
import type { WizardState } from "@/lib/compose/wizard";
import { signedActions } from "@/lib/compose/wizard";

export type SealSheet = "none" | "license" | "stance";

export function SealStep({
  state,
  sheet,
  blocked,
  busy,
  keyOnDevice,
  refusal,
  onSheet,
  onLicense,
  onPDirected,
  onSign,
  onBack,
  onRestoreKey,
}: {
  state: WizardState;
  sheet: SealSheet;
  /** Why the seal is closed, or null when it is open. */
  blocked: string | null;
  busy: boolean;
  keyOnDevice: boolean | null;
  refusal: string | null;
  onSheet: (next: SealSheet) => void;
  onLicense: (next: License) => void;
  onPDirected: (next: number) => void;
  onSign: () => void;
  onBack: () => void;
  onRestoreKey: () => void;
}) {
  const acts = signedActions(state);
  const bodyLine =
    state.mode === "media"
      ? state.assets.length === 1
        ? "1 picture"
        : `${state.assets.length} pictures`
      : "words";
  const heading = state.title.trim() === "" ? "Untitled" : state.title;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-2">
      <p className="m-0 text-body-small text-on-surface-variant">
        {heading} — {bodyLine}.
      </p>

      <div className="flex flex-col rounded-medium bg-surface-container-highest px-4 py-1">
        <ActRow label="Post" detail={heading} count={1} />
        {state.tags.length > 0 && (
          <ActRow
            label="Topics"
            detail={state.tags.map((tag) => `#${tag.name}`).join("  ")}
            count={state.tags.length}
          />
        )}
        {state.references.length > 0 && (
          <ActRow
            label="References"
            detail={`${state.references.length} cited`}
            count={state.references.length}
          />
        )}
        <div className="flex min-h-12 items-center gap-2">
          <span className="flex-1 text-label-large" data-testid="wizard-signed-actions">
            {acts === 1 ? "1 signed action" : `${acts} signed actions`}
          </span>
          {acts > 1 && (
            <span className="text-label-small text-on-surface-variant">
              they land together, or none does
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <TermRow
          label="License"
          value={licenseSummary(state.license)}
          action="Change"
          testId="wizard-open-license"
          onAction={() => onSheet("license")}
        />
        <TermRow
          label="Where you stand on it"
          value={formatDimension(state.pDirected)}
          action="Adjust"
          testId="wizard-open-stance"
          onAction={() => onSheet("stance")}
          last
        />
      </div>

      <div className="flex-1" />

      {refusal && (
        <p role="alert" data-testid="wizard-refused" className="m-0 text-body-medium text-error">
          {refusal}
        </p>
      )}

      {/* The key card takes the place of the sign button rather than sitting
          beside it: signing is not something this browser can do, and a disabled
          button with a banner above it invites the press anyway. */}
      {keyOnDevice === false ? (
        <div
          data-testid="wizard-key-absent"
          className="flex flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
        >
          <h2 className="m-0 text-title-small">Your key isn&apos;t on this browser</h2>
          <p className="m-0 text-body-medium">
            Nothing is spent until you sign. The draft stays on this device.
          </p>
          <PillButton testId="wizard-restore-key" full onClick={onRestoreKey}>
            Restore the key
          </PillButton>
          <PillButton testId="wizard-keep-draft" variant="text" full onClick={onBack}>
            Keep the draft, restore later
          </PillButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {blocked && (
            <p role="status" data-testid="wizard-seal-blocked" className="m-0 text-body-medium text-on-surface-variant">
              {blocked}
            </p>
          )}
          <PillButton
            testId="wizard-sign"
            full
            disabled={busy || blocked !== null}
            onClick={onSign}
          >
            {busy ? "Signing…" : "Sign and publish"}
          </PillButton>
          <PillButton testId="wizard-back" variant="text" full onClick={onBack}>
            Back
          </PillButton>
        </div>
      )}

      <BottomSheet
        open={sheet === "license"}
        onClose={() => onSheet("none")}
        title="License"
        testId="wizard-license-sheet"
      >
        <p className="m-0 text-label-small text-on-surface-variant">
          Terms for anyone who reuses this.
        </p>
        <LicenseChooser value={state.license} onChange={onLicense} testIdPrefix="wizard" />
        <div className="flex items-center gap-2 border-t border-outline-variant pt-2.5">
          <span className="flex-1 text-label-small text-on-surface-variant">
            {licenseTerms(state.license).join(" ")}
          </span>
          <PillButton testId="wizard-license-done" onClick={() => onSheet("none")}>
            Done
          </PillButton>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "stance"}
        onClose={() => onSheet("none")}
        title="Where you stand on it"
        testId="wizard-stance-sheet"
      >
        <StanceSlider
          label="How you stand"
          value={state.pDirected}
          onChange={onPDirected}
          testId="wizard-stance-slider"
        />
        <p className="m-0 text-label-small text-on-surface-variant">
          Your own post always reaches you in full.
        </p>
        <div className="flex justify-end">
          <PillButton testId="wizard-stance-done" onClick={() => onSheet("none")}>
            Set
          </PillButton>
        </div>
      </BottomSheet>
    </div>
  );
}

function ActRow({ label, detail, count }: { label: string; detail: string; count: number }) {
  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-outline-variant">
      <span className="w-19 flex-none text-label-medium text-on-surface-variant">{label}</span>
      <span className="min-w-0 flex-1 truncate text-body-medium">{detail}</span>
      <span className="flex-none text-body-small text-on-surface-variant">
        {count === 1 ? "1 action" : `${count} actions`}
      </span>
    </div>
  );
}

function TermRow({
  label,
  value,
  action,
  testId,
  onAction,
  last = false,
}: {
  label: string;
  value: string;
  action: string;
  testId: string;
  onAction: () => void;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 items-center gap-2 border-t border-outline-variant ${
        last ? "border-b" : ""
      }`}
    >
      <span className="flex-1 text-body-medium">{label}</span>
      <span className="text-body-medium text-on-surface-variant">{value}</span>
      <TextAction testId={testId} onClick={onAction}>
        {action}
      </TextAction>
    </div>
  );
}

/** The licence in one line, the way the board writes it. */
export function licenseSummary(license: License): string {
  return license.attribution === PUBLIC_DOMAIN.attribution &&
    license.provenance === PUBLIC_DOMAIN.provenance
    ? "Public domain — your default"
    : licenseTerms(license).join(" ");
}
