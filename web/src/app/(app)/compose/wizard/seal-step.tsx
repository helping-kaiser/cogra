"use client";

// ComposeSeal and its states — the last screen, where everything the signature
// commits is read back before it is given (`ComposeSealBody`, design/designs/
// canonical/screens/_shared.jsx).
//
// THE ANATOMY IS THE MASTERS': the quiet note naming the post, the acts card
// (`ActsCard`: one row per act kind, the total, the all-or-nothing line), the
// three fact rows (`FactRow`'s seal emphasis: License, Your backing,
// Sensitive), and the foot (`SealFooter`: the commit, and Back under it).
//
// WHAT BECAME OF THE COMMIT IS ONE BODY'S STATES (the failure pack, jakob
// 2026-09-30), so the seal a fault is drawn on is the seal the reader was on:
// - signing — past 200ms without an answer the commit reads `Signing and
//   publishing…`, inert but never dimmed, no spinner, and the ways out lock
//   with it (`SealSigning`); past 5s the acts card's subline says the network
//   is slow (`SealSigningSlow`);
// - offline — no answer reached the seal: the fault line, an outlined Retry and
//   Back take the commit's place;
// - refused row — a cited post that never landed: its row says so with
//   `Remove it`, and the commit stays (`SealFaultRow`);
// - bug — any other refusal of one staged act: the tertiary notice in the
//   bug's own words, with Try again, then Report a problem and Discard the post
//   (`SealFaultBug`, `SealDiscardConfirm`);
// - write rule — nothing failed and nothing was spent: the notice, and the way
//   out keeps the draft;
// - key absent — no commit at all: the key notice, and the way out keeps the
//   draft (`ComposeKeyAbsent`).
//
// YOUR BACKING IS ONE AXIS (jakob 2026-10-16, PR-101). Publishing signs one
// record toward the post, a Publish, and the census gives it one free
// parameter: the author's attachment — their BACKING — with `pInterest` pinned
// at 1, never a choice, so never drawn as one. `ComposePad` draws the master
// `AttachmentPad` strip, parked over a wash, the pick reading alone above it.

import { useState, type ReactNode } from "react";

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { DialogSurface } from "@/lib/ui2/dialog-surface";
import { PillButton } from "@/lib/ui2/pill-button";
import { InlineAction } from "@/lib/ui2/inline-action";
import { HelpDot } from "@/lib/ui2/help-dot";
import { ReadoutChip } from "@/lib/ui2/chip";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { ActsCard, actsTotal, ALL_OR_NOTHING, SLOW_SIGNING_LINE, type ActsRow } from "@/lib/ui2/compose/acts-card";
import { CitedSheet } from "@/lib/ui2/compose/cited-sheet";
import { TagsSheet } from "@/lib/ui2/compose/tags-sheet";
import { ParkedPad } from "@/lib/ui2/compose/parked-pad";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { AttachmentPad } from "@/lib/ui2/compose/attachment-pad";
import { UnreachableConfirm } from "@/lib/ui2/compose/unreachable-confirm";
import { AttachmentReadout, AttachmentStanding } from "@/lib/ui/attachment-readout";
import { LicenseRows } from "@/lib/ui/license-rows";
import { TransportError } from "@/lib/ui/transport-error";
import { bundleReadout, EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { formatStancePair, formatStanceWords } from "@/lib/ui/stance-format";
import { licenseReading, type License } from "@/lib/license";
import type { ReferenceDraft } from "@/lib/references/draft";
import type { TagDraft } from "@/lib/topics/draft";
import type { WizardState } from "@/lib/compose/wizard";
import { isVideoPost, signedActions } from "@/lib/compose/wizard";
import type { SealFault } from "@/lib/compose/seal-fault";

export type SealSheet = "none" | "license" | "stance" | "sensitive" | "cited" | "tags";

export type { SealFault } from "@/lib/compose/seal-fault";

/** How many chips the Tags row holds before it counts (`TAGS_ROW_HOLDS`). */
export const TAGS_ROW_HOLDS = 2;

// The failure pack's words, blessed (copy-voice, *Faults by code*).
const SEAL_BUG_TITLE = "This shouldn't have happened";
const SEAL_BUG_FACT =
  "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it.";
const WRITE_RULE_TITLE = "You can't sign right now";
const WRITE_RULE_FACT =
  "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your draft is kept.";
const OFFLINE_LINE = "That didn't send. Try again.";
export const DISCARD_POST_TITLE = "Discard this post?";
export const DISCARD_POST_BODY =
  "The draft goes, with its pictures, tags and citations. Nothing was signed, so nothing else changes.";

/** The refused citation's line, in its own noun (copy-voice, *One staged act refused*). */
export function unlandedCitationLine(reference: ReferenceDraft): string {
  return reference.target.kind === "Comment"
    ? "This comment didn't land, so it can't be cited."
    : "This post didn't land, so it can't be cited.";
}

export function SealStep({
  state,
  sheet,
  stagedPDirected,
  confirmingUnreachable,
  signing,
  swapped,
  slow,
  keyOnDevice,
  fault,
  discarding,
  onSheet,
  onLicense,
  onReferences,
  onTags,
  onStagedPDirected,
  onSetStance,
  onKeepAdjusting,
  onSetAnyway,
  onStanceHelp,
  onSensitive,
  onHelp,
  onLicenseHelp,
  onKeyHelp,
  onWriteRuleHelp,
  onSign,
  onRetry,
  onRetryUploads,
  onBack,
  onRestoreKey,
  onKeepDraft,
  onRemoveRefused,
  onReport,
  onDiscard,
  onDiscardConfirmed,
  onKeepDiscarding,
}: {
  state: WizardState;
  sheet: SealSheet;
  /** What the pad has under the finger — staged, not set, until Set. */
  stagedPDirected: number;
  /** `Start it unreachable?` stands over the pad: Set was pressed at exactly 0.00. */
  confirmingUnreachable: boolean;
  /** A press is held or in flight: the commit refuses a second one. */
  signing: boolean;
  /** Past 200ms since the press: the label reads its participle and the ways out lock. */
  swapped: boolean;
  /** Past 5s since the press: the acts card's subline says so. */
  slow: boolean;
  keyOnDevice: boolean | null;
  fault: SealFault | null;
  /** `Discard this post?` stands over the seal. */
  discarding: boolean;
  onSheet: (next: SealSheet) => void;
  /** The license sheet's Done — the pair it staged. */
  onLicense: (next: License) => void;
  /**
   * The staged citations, after a removal or a re-pair made in the cited
   * sheet. It is the details step's own set and the details step's own
   * setter — the seal manages what was staged there, it does not keep a
   * second copy of it.
   */
  onReferences: (next: readonly ReferenceDraft[]) => void;
  /** The staged tags, after a removal or a re-pair made in the tags sheet. */
  onTags: (next: readonly TagDraft[]) => void;
  onStagedPDirected: (next: number) => void;
  /** The pad's Set — the host asks first at exactly 0.00 (ComposePad.md). */
  onSetStance: () => void;
  /** `Keep adjusting`: the question closes onto the pad at the same pick. */
  onKeepAdjusting: () => void;
  /** `Set it anyway`: 0.00 is set, and the question and the pad close. */
  onSetAnyway: () => void;
  onStanceHelp: () => void;
  /** The sensitive sheet's Done — the mark and its reason as staged there. */
  onSensitive: (next: { sensitive: boolean; sensitiveReason: string }) => void;
  onHelp: () => void;
  onLicenseHelp: () => void;
  onKeyHelp: () => void;
  onWriteRuleHelp: () => void;
  onSign: () => void;
  /** The offline fault's Retry and the bug notice's Try again: the same signing, asked again. */
  onRetry: () => void;
  /** The failed upload's Retry: the gate runs again, and nothing signs until the next press. */
  onRetryUploads: () => void;
  onBack: () => void;
  onRestoreKey: () => void;
  /** Leaves the wizard with the draft kept — not a step back. */
  onKeepDraft: () => void;
  /** `Remove it` under the refused citation's row. */
  onRemoveRefused: (targetId: string) => void;
  onReport: () => void;
  /** `Discard the post` under the bug notice: asks first. */
  onDiscard: () => void;
  onDiscardConfirmed: () => void;
  onKeepDiscarding: () => void;
}) {
  const acts = signedActions(state);
  const video = isVideoPost(state);
  // How many are still moving — the count the gate reads out. A failure is
  // not counted: it is not something the reader is waiting for.
  const uploading = state.assets.filter(
    (asset) =>
      asset.upload.kind === "waiting" ||
      asset.upload.kind === "encoding" ||
      asset.upload.kind === "uploading" ||
      asset.upload.kind === "processing",
  ).length;
  const failed = state.assets.filter((asset) => asset.upload.kind === "failed").length;
  const bodyLine =
    state.mode === "media"
      ? video
        ? "a video"
        : state.assets.length === 1
          ? "1 picture"
          : `${state.assets.length} pictures`
      : "words";
  const heading = state.title.trim() === "" ? "Untitled" : state.title;
  // Inert for the label swap's duration, never dimmed (SealSigning.md): a
  // press on a way out or a fact's action does nothing then.
  const guard = (act: () => void) => () => {
    if (!swapped) act();
  };
  const refusedTarget =
    fault?.kind === "row"
      ? state.references.find((reference) => reference.targetId === fault.targetId)
      : undefined;

  const rows: ActsRow[] = [
    { label: "Post", value: heading, count: 1, countNoun: "post", testId: "wizard-seal-post" },
  ];
  if (state.tags.length > TAGS_ROW_HOLDS) {
    // THE ROW COUNTS INSTEAD OF NAMING past what it holds (ComposeSealTagged):
    // a pill it would clip is a lie about what is being signed.
    rows.push({
      label: "Tags",
      value: `${state.tags.length} tags`,
      count: state.tags.length,
      countNoun: "tag",
      open: { label: `Manage the ${state.tags.length} tags`, onOpen: guard(() => onSheet("tags")) },
      testId: "wizard-open-tags",
    });
  } else if (state.tags.length > 0) {
    rows.push({
      label: "Tags",
      value: (
        <span className="flex items-center gap-1.5 overflow-hidden">
          {state.tags.map((tag) => (
            <ReadoutChip key={tag.name}>#{tag.name}</ReadoutChip>
          ))}
        </span>
      ),
      count: state.tags.length,
      countNoun: "tag",
      testId: "wizard-seal-tags",
    });
  }
  // THE REFERENCES ROW IN ITS THREE READINGS (jakob's rulings 2026-09-14,
  // backlog item 70): nothing staged draws no row; ONE reads back as itself,
  // its name over its pair; TWO OR MORE read back as their count and the row
  // becomes the door to the sheet that lists them.
  if (state.references.length === 1) {
    const only = state.references[0];
    rows.push({
      label: "References",
      value: (
        <span className="flex min-w-0 flex-col py-1.5">
          <span className="truncate">{only.target.label}</span>
          <StanceReadout pair={{ pDirected: only.relevance, pInterest: only.support }} />
        </span>
      ),
      count: 1,
      countNoun: "citation",
      fault:
        refusedTarget !== undefined
          ? { message: unlandedCitationLine(refusedTarget), onRemove: () => onRemoveRefused(refusedTarget.targetId) }
          : undefined,
      testId: "wizard-seal-references",
    });
  } else if (state.references.length > 1) {
    const count = state.references.length;
    rows.push({
      label: "References",
      value: `${count} cited`,
      count,
      countNoun: "citation",
      open: { label: `Manage the ${count} citations`, onOpen: guard(() => onSheet("cited")) },
      // Under a count the refused citation is named only by Remove it's name.
      fault:
        refusedTarget !== undefined
          ? {
              message: unlandedCitationLine(refusedTarget),
              onRemove: () => onRemoveRefused(refusedTarget.targetId),
              removeLabel: `Remove ${refusedTarget.target.label}`,
            }
          : undefined,
      testId: "wizard-open-cited",
    });
  }

  const note = slow ? SLOW_SIGNING_LINE : acts > 1 ? ALL_OR_NOTHING : null;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-2">
      <QuietNote testId="wizard-seal-note">
        {heading} — {bodyLine}.
      </QuietNote>

      <ActsCard rows={rows} total={actsTotal(acts)} note={note} noteTone={slow ? "slow" : "quiet"} testId="wizard-seal-acts" />

      <div className="flex flex-col">
        <FactRow
          label="License"
          value={licenseReading(state.license)}
          action="Change"
          testId="wizard-open-license"
          onAction={guard(() => onSheet("license"))}
          // Key absent: everything the signature would commit is still read
          // back, but the license is the only term left to change — the board
          // draws one row, last (ComposeKeyAbsent.jsx).
          last={keyOnDevice === false}
        />
        {keyOnDevice !== false && (
          <>
            <FactRow
              label="Your backing"
              // ONE NUMBER, not a pair: the second is census-fixed rather than
              // picked, and drawing it would show a figure nobody chose.
              value={<AttachmentReadout pDirected={state.pDirected} testId="wizard-stance-value" />}
              action="Adjust"
              testId="wizard-open-stance"
              onAction={guard(() => onSheet("stance"))}
            />
            <FactRow
              label="Sensitive"
              value={state.sensitive ? "Marked" : "Not marked"}
              action={state.sensitive ? "Change" : "Mark"}
              testId="wizard-open-sensitive"
              onAction={guard(() => onSheet("sensitive"))}
              last
            />
          </>
        )}
      </div>

      <div className="flex-1" />

      {keyOnDevice === false ? (
        // The key notice takes the commit's place: signing is not something
        // this browser can do, and nothing is staged or signed without it.
        <>
          <NoticePanel
            title="Your key isn't on this browser"
            help={{ label: "Your key", onOpen: onKeyHelp, testId: "wizard-key-help" }}
            testId="wizard-key-absent"
          >
            <PillButton testId="wizard-restore-key" variant="inverse" full onClick={onRestoreKey}>
              Restore the key
            </PillButton>
          </NoticePanel>
          <PillButton testId="wizard-keep-draft" variant="text" full onClick={onKeepDraft}>
            Keep the draft, restore later
          </PillButton>
        </>
      ) : fault?.kind === "offline" ? (
        <div className="flex flex-col gap-2">
          <TransportError testId="wizard-transport-error" message={OFFLINE_LINE} />
          <PillButton testId="wizard-retry" variant="outlined" full onClick={onRetry}>
            Retry
          </PillButton>
          <PillButton testId="wizard-back" variant="text" full onClick={onBack}>
            Back
          </PillButton>
        </div>
      ) : fault?.kind === "writeRule" ? (
        <>
          <NoticePanel
            title={WRITE_RULE_TITLE}
            help={{ label: "Why signing waits", onOpen: onWriteRuleHelp, testId: "wizard-write-rule-help" }}
            testId="wizard-write-rule"
          >
            <NoticeLine>{WRITE_RULE_FACT}</NoticeLine>
          </NoticePanel>
          <PillButton testId="wizard-sign-later" variant="text" full onClick={onKeepDraft}>
            Keep the draft, sign later
          </PillButton>
        </>
      ) : fault?.kind === "bug" ? (
        // Not a fault in `--error`, and not the write rule's notice: the reader
        // did nothing wrong and nothing was spent, so it is the tertiary panel,
        // and its words own the bug. No row is marked.
        <>
          <NoticePanel title={SEAL_BUG_TITLE} testId="wizard-seal-bug">
            <NoticeLine>{SEAL_BUG_FACT}</NoticeLine>
            <PillButton testId="wizard-try-again" variant="inverse" full onClick={onRetry}>
              Try again
            </PillButton>
          </NoticePanel>
          <div className="flex flex-col">
            <PillButton testId="wizard-report" variant="text" full onClick={onReport}>
              Report a problem
            </PillButton>
            <PillButton testId="wizard-discard" variant="text" full onClick={onDiscard}>
              Discard the post
            </PillButton>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {/* THE GATE (ComposeSealUploading): nothing signs until the content
              it signs exists. While bytes move the line counts them and the
              commit stays live — a press is held and signs the moment the last
              one lands. A failed upload is the one thing that disables the
              commit, and the line's failed form says why. */}
          {failed > 0 ? (
            <UploadStatusLine
              done={state.assets.length - failed}
              total={state.assets.length}
              failed
              message={
                video
                  ? "The video didn't upload."
                  : failed === 1
                    ? "One picture didn't upload."
                    : `${failed} pictures didn't upload.`
              }
              onRetry={onRetryUploads}
              testId="wizard-seal-blocked"
            />
          ) : uploading > 0 ? (
            <UploadStatusLine
              done={state.assets.length - uploading}
              total={state.assets.length}
              media={video ? "video" : "pictures"}
              testId="wizard-seal-blocked"
            />
          ) : null}
          {/* SealFooter: the commit names what it signs; inert from the press,
              its participle past 200ms, never dimmed and no spinner. */}
          <PillButton
            testId="wizard-sign"
            full
            disabled={failed > 0}
            onClick={() => {
              if (!signing) onSign();
            }}
          >
            {swapped ? "Signing and publishing…" : "Sign and publish"}
          </PillButton>
          <PillButton testId="wizard-back" variant="text" full onClick={guard(onBack)}>
            Back
          </PillButton>
        </div>
      )}

      <LicenseSheet
        open={sheet === "license"}
        license={state.license}
        onDone={(license) => {
          onLicense(license);
          onSheet("none");
        }}
        onClose={() => onSheet("none")}
        onHelp={onLicenseHelp}
      />

      {/* ComposePad. Cancel and the wash stage nothing; only Set moves the
          backing the seal reads — which is why the pad works on its own staged
          value rather than writing through on every drag. */}
      <ParkedPad
        open={sheet === "stance"}
        onClose={() => onSheet("none")}
        ariaLabel="Backing pad for your own post"
        standoff="compose"
        testId="wizard-stance-pad"
      >
        {/* The `?` sits in the card's corner, 4px in, out of the readout's
            reading order, and the readout keeps clear of it (`ComposePad.jsx`:
            `top: 4, right: 4`, `paddingRight: 40`). The parked dialog is the
            positioned box it is placed against. */}
        <span className="absolute top-1 right-1">
          <HelpDot
            ariaLabel="Your backing on your post"
            onOpen={onStanceHelp}
            testId="wizard-stance-help"
          />
        </span>
        <div className="pr-10">
          <AttachmentStanding pick={stagedPDirected} testIdPrefix="wizard-stance" />
        </div>
        <div role="group" aria-label="Backing pad for your own post" className="self-stretch">
          <AttachmentPad value={stagedPDirected} onChange={onStagedPDirected} testId="wizard-stance-field" />
        </div>
        <div className="flex justify-end gap-2">
          {/* The board's compact pair (`ComposePad.jsx`: `size="sm"`). */}
          <PillButton variant="text" size="sm" testId="wizard-stance-cancel" onClick={() => onSheet("none")}>
            Cancel
          </PillButton>
          <PillButton size="sm" testId="wizard-stance-set" onClick={onSetStance}>
            Set
          </PillButton>
        </div>
      </ParkedPad>

      {/* Set at exactly 0.00 warns over the parked pad and never refuses. */}
      <UnreachableConfirm
        open={sheet === "stance" && confirmingUnreachable}
        onKeepAdjusting={onKeepAdjusting}
        onSetAnyway={onSetAnyway}
        testId="wizard-unreachable"
      />

      <SensitiveSheet
        open={sheet === "sensitive"}
        reason={state.sensitiveReason}
        onDone={(next) => {
          onSensitive(next);
          onSheet("none");
        }}
        onClose={() => onSheet("none")}
        onHelp={() => onHelp()}
        testIdPrefix="wizard"
      />

      {/* What the counting rows open. They manage the staged sets and never
          offer another pick: a post's seal carries no add-rows by design. */}
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
      <TagsSheet
        open={sheet === "tags"}
        onClose={() => onSheet("none")}
        items={state.tags}
        onChange={onTags}
        testId="wizard-tags-sheet"
      />

      {discarding && (
        <DialogSurface
          title={DISCARD_POST_TITLE}
          body={[DISCARD_POST_BODY]}
          onDismiss={onKeepDiscarding}
          testId="wizard-discard-confirm"
          actions={
            <>
              <PillButton testId="wizard-discard-it" variant="text" onClick={onDiscardConfirmed}>
                Discard it
              </PillButton>
              <PillButton testId="wizard-keep-the-draft" onClick={onKeepDiscarding}>
                Keep the draft
              </PillButton>
            </>
          }
        />
      )}
    </div>
  );
}

/**
 * A fact row, the seal's emphasis (design/components/core/FactRow.jsx): the
 * label at body-medium taking the row, the value in the secondary ink, the
 * action an `InlineAction`; a hairline above every row and under the last.
 */
function FactRow({
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
      className={`flex min-h-11 items-center gap-2 border-0 border-t border-solid border-outline-variant ${
        last ? "border-b" : ""
      }`}
    >
      <span className="flex-1 whitespace-nowrap text-body-medium">{label}</span>
      {typeof value === "string" ? (
        <span className="text-body-medium text-on-surface-variant">{value}</span>
      ) : (
        value
      )}
      <InlineAction testId={testId} onClick={onAction}>
        {action}
      </InlineAction>
    </div>
  );
}

/**
 * THE LICENSE SHEET over the seal (ComposeLicense): the note, the two axes,
 * and the foot that reads the sentence Done will put on the row. The radios
 * STAGE and Done commits (the sheet law, readme §4); the scrim, a swipe down,
 * system Back and Escape discard, and the post's terms are what they were.
 */
function LicenseSheet({
  open,
  license,
  onDone,
  onClose,
  onHelp,
}: {
  open: boolean;
  license: License;
  onDone: (next: License) => void;
  onClose: () => void;
  onHelp: () => void;
}) {
  const [staged, setStaged] = useState(license);
  // Each opening starts from the terms as they stand, adjusted during render
  // rather than in an effect: whatever a discarded opening staged is gone.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStaged(license);
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="License"
      titleTrailing={<HelpDot ariaLabel="License" onOpen={onHelp} testId="wizard-license-help" />}
      testId="wizard-license-sheet"
    >
      <div className="flex flex-col gap-2">
        <QuietNote>Terms for anyone who reuses this.</QuietNote>
        <LicenseRows value={staged} onChange={setStaged} testIdPrefix="wizard" flat />
        <div className="flex items-center gap-2 border-0 border-t border-solid border-outline-variant pt-2.5">
          <span className="flex-1 text-body-small text-on-surface-variant">{licenseReading(staged)}</span>
          <PillButton testId="wizard-license-done" onClick={() => onDone(staged)}>
            Done
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
}

/**
 * The face and the exact pair (design.md §8.3), the reading a staged citation
 * wears on the acts card: the digits are the geek reading, drawn in a
 * `cg-exact` span, painted only in exact mode, and spoken in both.
 */
function StanceReadout({ pair }: { pair: StancePair }) {
  // A pick being staged: its face follows its value (seam 243).
  const anchor = bundleReadout(pair, EMPTY_PICK_LABEL);
  return (
    <span className="inline-flex items-baseline gap-1">
      <span aria-hidden="true" className="text-body-medium">
        {anchor.emoji}
      </span>
      <span aria-hidden="true" className="cg-exact text-body-small text-on-surface-variant">
        {formatStancePair(pair)}
      </span>
      <span className="sr-only">
        {anchor.label}, {formatStanceWords(pair)}
      </span>
    </span>
  );
}
