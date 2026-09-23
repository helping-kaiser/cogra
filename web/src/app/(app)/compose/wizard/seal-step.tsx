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
// THE STANCE IS ONE AXIS, AND IT IS A PAD RATHER THAN A SLIDER.
//
// On a Publish record `pInterest` is census-fixed at 1 and only `pDirected` is
// the author's to set — your own post always reaches you in full — so the
// square would offer a choice that is not one. `ComposePad` draws the line
// that is left: a 260×72 field with its own ends named, parked over a wash
// rather than riding a drawer.

import type { ReactNode } from "react";

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { HelpDot } from "@/lib/ui2/help-dot";
import { ReadoutChip } from "@/lib/ui2/chip";
import { CitedSheet } from "@/lib/ui2/compose/cited-sheet";
import { ParkedPad } from "@/lib/ui2/compose/parked-pad";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { ValenceField } from "@/lib/ui2/compose/valence-field";
import { OwnPickBlock, OwnStanceReadout } from "@/lib/ui/own-stance-readout";
import { LicenseRows } from "@/lib/ui/license-rows";
import { nearestAnchor } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { formatStancePair, formatStanceWords } from "@/lib/ui/stance-format";
import { licenseTerms, PUBLIC_DOMAIN, type License } from "@/lib/license";
import type { ReferenceDraft } from "@/lib/references/draft";
import type { WizardState } from "@/lib/compose/wizard";
import { signedActions } from "@/lib/compose/wizard";

export type SealSheet = "none" | "license" | "stance" | "sensitive" | "cited";

export function SealStep({
  state,
  sheet,
  stagedPDirected,
  blocked,
  busy,
  keyOnDevice,
  refusal,
  onSheet,
  onLicense,
  onReferences,
  onStagedPDirected,
  onSetStance,
  onStanceHelp,
  onSensitive,
  onSensitiveReason,
  onHelp,
  onLicenseHelp,
  onKeyHelp,
  onSign,
  onBack,
  onRestoreKey,
  onKeepDraft,
}: {
  state: WizardState;
  sheet: SealSheet;
  /** What the pad has under the finger — staged, not set, until Set. */
  stagedPDirected: number;
  /** Why the seal is closed, or null when it is open. */
  blocked: string | null;
  busy: boolean;
  keyOnDevice: boolean | null;
  refusal: string | null;
  onSheet: (next: SealSheet) => void;
  onLicense: (next: License) => void;
  /**
   * The staged citations, after a removal or a re-pair made in the cited
   * sheet. It is the details step's own set and the details step's own
   * setter — the seal manages what was staged there, it does not keep a
   * second copy of it.
   */
  onReferences: (next: readonly ReferenceDraft[]) => void;
  onStagedPDirected: (next: number) => void;
  onSetStance: () => void;
  onStanceHelp: () => void;
  onSensitive: (next: boolean) => void;
  onSensitiveReason: (next: string) => void;
  onHelp: () => void;
  onLicenseHelp: () => void;
  onKeyHelp: () => void;
  onSign: () => void;
  onBack: () => void;
  onRestoreKey: () => void;
  /** Leaves the wizard with the draft kept — not a step back (graph:
   *  `ComposeKeyAbsent`'s keep-draft edge is a terminal `back`, i.e. it
   *  leaves; see `wizard-view.tsx`'s `leaveFlow`). */
  onKeepDraft: () => void;
}) {
  const acts = signedActions(state);
  // How many are still moving — the count the gate reads out. A failure is not
  // counted here: it is not something the reader is waiting for.
  const uploading = state.assets.filter(
    (asset) =>
      asset.upload.kind === "waiting" ||
      asset.upload.kind === "encoding" ||
      asset.upload.kind === "uploading" ||
      asset.upload.kind === "processing",
  ).length;
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

      <div
        data-testid="wizard-seal-acts"
        className="flex flex-col rounded-medium bg-surface-container-highest px-4 py-1"
      >
        <ActRow label="Post" detail={heading} count={1} countNoun="post" />
        {state.tags.length > 0 && (
          <ActRow
            label="Tags"
            detail={
              <span className="flex flex-wrap items-center gap-1.5">
                {state.tags.map((tag) => (
                  <ReadoutChip key={tag.name}>#{tag.name}</ReadoutChip>
                ))}
              </span>
            }
            count={state.tags.length}
            countNoun="tag"
          />
        )}
        {/* THE REFERENCES ROW IN ITS THREE READINGS (jakob's rulings
            2026-09-14, design backlog item 70). Nothing staged draws no row;
            ONE staged citation reads back as itself, because a seal is a
            read-back and one thing read back is the thing; TWO OR MORE read
            back as their count and the row becomes a door. Ten names stacked
            in an act row is a seal that scrolls, and a seal that scrolls has
            stopped being a read-back — while a count with no way through to
            what it counts is a number the reader cannot check
            (`_shared.jsx:864-889`). */}
        {state.references.length === 1 && (
          <ActRow
            label="References"
            detail={
              <span className="flex min-w-0 flex-col py-1.5">
                <span className="truncate">{state.references[0].target.label}</span>
                <StanceReadout
                  pair={{
                    pDirected: state.references[0].relevance,
                    pInterest: state.references[0].support,
                  }}
                />
              </span>
            }
            count={1}
            countNoun="citation"
          />
        )}
        {state.references.length > 1 && (
          <CitedRow
            count={state.references.length}
            testId="wizard-open-cited"
            onOpen={() => onSheet("cited")}
          />
        )}
        <div className="flex min-h-12 flex-col justify-center gap-0.5 py-1.5">
          <span className="text-label-large" data-testid="wizard-signed-actions">
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
          // Key absent: everything the signature would commit is still read
          // back, but the license is the only term left changeable — the
          // board draws one row, last (ComposeKeyAbsent.jsx:47).
          last={keyOnDevice === false}
        />
        {keyOnDevice !== false && (
          <>
            <TermRow
              label="Where you stand on it"
              // ONE NUMBER, not a pair: the second is census-fixed rather
              // than picked, and drawing it would show the author a figure
              // nobody chose.
              value={<OwnStanceReadout pDirected={state.pDirected} testId="wizard-stance-value" />}
              action="Adjust"
              testId="wizard-open-stance"
              onAction={() => onSheet("stance")}
            />
            <TermRow
              label="Sensitive"
              value={state.sensitive ? "Marked" : "Not marked"}
              action={state.sensitive ? "Change" : "Mark"}
              testId="wizard-open-sensitive"
              onAction={() => onSheet("sensitive")}
              last
            />
          </>
        )}
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
        <div className="flex flex-col gap-3">
          <div
            data-testid="wizard-key-absent"
            className="flex flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
          >
            <div className="flex items-center gap-2">
              <h2 className="m-0 flex-1 text-title-medium">Your key isn&apos;t on this browser</h2>
              <HelpDot
                ariaLabel="Your key"
                variant="inverse"
                onOpen={onKeyHelp}
                testId="wizard-key-help"
              />
            </div>
            <PillButton testId="wizard-restore-key" variant="inverse" full onClick={onRestoreKey}>
              Restore the key
            </PillButton>
          </div>
          <PillButton testId="wizard-keep-draft" variant="text" full onClick={onKeepDraft}>
            Keep the draft, restore later
          </PillButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* THE GATE, drawn as the board draws it (ComposeSealUploading): while
              bytes are still moving the seal says so with the count and holds
              the sign button, because nothing signs until the content it signs
              exists. A failure is words rather than a count — there is nothing
              left to wait for. */}
          {blocked && uploading > 0 ? (
            <UploadStatusLine
              done={state.assets.length - uploading}
              total={state.assets.length}
              testId="wizard-seal-blocked"
            />
          ) : blocked ? (
            <p role="status" data-testid="wizard-seal-blocked" className="m-0 text-body-medium text-on-surface-variant">
              {blocked}
            </p>
          ) : null}
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
        titleTrailing={
          <HelpDot ariaLabel="License" onOpen={onLicenseHelp} testId="wizard-license-help" />
        }
        testId="wizard-license-sheet"
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-label-small text-on-surface-variant">
            Terms for anyone who reuses this.
          </p>
          <LicenseRows value={state.license} onChange={onLicense} testIdPrefix="wizard" />
          <div className="flex items-center gap-2 border-t border-outline-variant pt-2.5">
            <span className="flex-1 text-label-small text-on-surface-variant">
              {licenseTerms(state.license).join(" ")}
            </span>
            <PillButton testId="wizard-license-done" onClick={() => onSheet("none")}>
              Done
            </PillButton>
          </div>
        </div>
      </BottomSheet>

      {/* ComposePad. Cancel and the wash stage nothing; only Set moves the
          stance the seal reads — which is why the pad works on its own staged
          value rather than writing through on every drag. */}
      <ParkedPad
        open={sheet === "stance"}
        onClose={() => onSheet("none")}
        ariaLabel="Your opinion on your post"
        standoff="compose"
        testId="wizard-stance-pad"
      >
        {/* The `?` sits in the corner, out of the readout's reading order,
            and the readout keeps clear of it (`ComposePad.jsx:49-57`). */}
        <div className="relative">
          <span className="absolute top-0 right-0">
            <HelpDot
              ariaLabel="Your opinion on your post"
              onOpen={onStanceHelp}
              testId="wizard-stance-help"
            />
          </span>
          <OwnPickBlock pDirected={stagedPDirected} testId="wizard-stance-pick" />
        </div>
        <ValenceField
          value={stagedPDirected}
          onChange={onStagedPDirected}
          testId="wizard-stance"
        />
        <p className="m-0 text-label-small text-on-surface-variant">
          Your own post always reaches you in full.
        </p>
        <div className="flex justify-end gap-2">
          <PillButton variant="text" testId="wizard-stance-cancel" onClick={() => onSheet("none")}>
            Cancel
          </PillButton>
          <PillButton testId="wizard-stance-set" onClick={onSetStance}>
            Set
          </PillButton>
        </div>
      </ParkedPad>

      <SensitiveSheet
        open={sheet === "sensitive"}
        marked={state.sensitive}
        reason={state.sensitiveReason}
        onMarked={onSensitive}
        onReason={onSensitiveReason}
        onClose={() => onSheet("none")}
        onHelp={() => onHelp()}
        testIdPrefix="wizard"
      />

      {/* What the counting row opens. It manages the staged set and never
          offers another pick: a post's seal carries no add-rows by design, and
          a door out of it that grew one would hand the seal a stage's job. */}
      <CitedSheet
        open={sheet === "cited"}
        onClose={() => onSheet("none")}
        items={state.references}
        onRemove={(targetId) =>
          onReferences(state.references.filter((reference) => reference.targetId !== targetId))
        }
        onRepair={(targetId, next) =>
          onReferences(
            state.references.map((reference) =>
              reference.targetId === targetId ? { ...reference, ...next } : reference,
            ),
          )
        }
        testId="wizard-cited-sheet"
      />
    </div>
  );
}

function ActRow({
  label,
  detail,
  count,
  countNoun,
}: {
  label: string;
  detail: ReactNode;
  count: number;
  /** The singular noun the count counts — see `ActsCount`. */
  countNoun: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-outline-variant">
      <span className="w-19 flex-none text-label-small text-on-surface-variant">{label}</span>
      <span className="min-w-0 flex-1 truncate text-body-medium">{detail}</span>
      <ActsCount count={count} noun={countNoun} />
    </div>
  );
}

/**
 * THE COUNT IS SEEN BARE AND HEARD WHOLE (jakob's ruling 2026-09-14, design
 * backlog item 73; `ActsCard.jsx:27-39`).
 *
 * The digit is what the board draws: the word form spent the row's width on a
 * noun the label column already says, and what it spent came out of the value
 * slot. But a trailing "3" is unambiguous only to an eye that has the label on
 * the same line, and meaningless to an ear that gets the number alone — so the
 * digit leaves the accessibility tree and a paired reading says "3 citations".
 *
 * THE NOUN COMES FROM THE ROW, never from its label: the References row counts
 * CITATIONS, and no rule derives that word from "References".
 */
function ActsCount({ count, noun }: { count: number; noun: string }) {
  return (
    <span className="flex-none text-label-small text-on-surface-variant">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? noun : `${noun}s`}
      </span>
    </span>
  );
}

/**
 * The References row once it counts: "N cited", the bare count, and the WHOLE
 * ROW as the control (`ActsCard.jsx:99-104`, `_shared.jsx:883-889`).
 *
 * It keeps the fact row's three slots and stays a fact row rather than
 * becoming an action row, because what it opens is what it already says. It
 * carries no chevron and no trailing word — `PickedRow`'s rule for the picked
 * pictures, said here — so the accessible name is the only thing that tells a
 * listener the line is a door at all, count folded in ("Manage the N
 * citations", and at one "Manage the 1 citation" — copy-voice.md:409-419).
 *
 * THE TRAILING COUNT IS THE CITATIONS, BARE — the list's length and nothing
 * else. The signature's own total is the card's footer and already says in
 * words what it counts.
 */
function CitedRow({
  count,
  testId,
  onOpen,
}: {
  count: number;
  testId: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onOpen}
      aria-label={`Manage the ${count} ${count === 1 ? "citation" : "citations"}`}
      className="cg-state cg-focus flex min-h-11 w-full cursor-pointer items-center gap-2 border-0 border-b border-solid border-outline-variant bg-transparent p-0 text-left text-on-surface"
    >
      <span className="w-19 flex-none text-label-small text-on-surface-variant">References</span>
      <span className="min-w-0 flex-1 truncate text-body-medium">{count} cited</span>
      <ActsCount count={count} noun="citation" />
    </button>
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
  value: ReactNode;
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

/**
 * The face and the exact pair (design.md §8.3), the same reading
 * `reply-seal-step.tsx`'s local `StanceValue` gives the reply's own terms —
 * kept as its own small copy here rather than a shared import so this lane
 * stays self-contained; a later pass can fold both into one place.
 */
function StanceReadout({ pair }: { pair: StancePair }) {
  const anchor = nearestAnchor(pair);
  return (
    <span className="inline-flex items-baseline gap-1">
      <span aria-hidden="true" className="text-body-medium">
        {anchor.emoji}
      </span>
      <span aria-hidden="true" className="text-body-small text-on-surface-variant">
        {formatStancePair(pair)}
      </span>
      <span className="sr-only">
        {anchor.label}, {formatStanceWords(pair)}
      </span>
    </span>
  );
}
