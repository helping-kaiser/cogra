"use client";

// ReplySeal / ReplyPad / ComposeKeyAbsent — the reply's last screen, where
// every act is named with its price before anything is signed.
//
// THE SENSITIVE ROW IS NOT HERE, and its absence is approved rather than an
// oversight (jakob 2026-09-01). The board draws "Sensitive · Not marked · Mark"
// as its third term row, but a sensitive-marked COMMENT has no veiled read
// state yet (design backlog item 25.4), so the switch would promise a veil the
// reader never gets. `PrepareCommentInput.sensitive` stays on the wire and
// stays defaulted — the contract is untouched, only the control is held back.
// The License row takes the closing hairline the Sensitive row used to carry,
// so the group is still drawn shut.
//
// THE TOPIC AND CITATION ROWS ARE THE BOARD'S, THE CONTROLS ARE THE PRODUCT'S.
// ReplySeal draws "+ Add a topic" and "+ Cite something" inside the acts card,
// each with the act it would add. Both boarded destinations are gaps — the
// topic picker is not boarded at all, and ReferencePicker has no web
// implementation — so pressing a row opens the entry field this product
// already ships, in the sheet idiom the seal already uses for licence and
// stance. Nothing here invents the picker.

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { StancePad } from "@/lib/ui2/compose/stance-pad";
import { UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { LicenseChooser } from "@/lib/ui/license-fields";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { nearestAnchor } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { formatStancePair, formatStanceWords } from "@/lib/ui/stance-format";
import { licenseTerms, type License } from "@/lib/license";
import { TAG_BATCH_CAP } from "@/lib/topics/normalize";
import { REFERENCE_BATCH_CAP } from "@/lib/references/normalize";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";
import { licenseSummary } from "@/app/(app)/compose/wizard/seal-step";
import {
  replyActLabel,
  replySummary,
  signedActions,
  type ReplyState,
} from "@/lib/compose/reply-wizard";
import { uploadsPending } from "@/lib/compose/comment-media";

export type ReplySheet = "none" | "license" | "stance" | "topics" | "references";

export function ReplySealStep({
  state,
  sheet,
  stagedStance,
  blocked,
  busy,
  keyOnDevice,
  refusal,
  tagErrors,
  referenceErrors,
  onSheet,
  onLicense,
  onStagedStance,
  onSetStance,
  onTags,
  onReferences,
  onSign,
  onBack,
  onRestoreKey,
}: {
  state: ReplyState;
  sheet: ReplySheet;
  /** What the pad has under the finger — staged, not set, until Set. */
  stagedStance: StancePair;
  /** Why the seal is closed, or null when it is open. */
  blocked: string | null;
  busy: boolean;
  keyOnDevice: boolean | null;
  refusal: string | null;
  tagErrors?: Readonly<Record<number, string>>;
  referenceErrors?: Readonly<Record<number, string>>;
  onSheet: (next: ReplySheet) => void;
  onLicense: (next: License) => void;
  onStagedStance: (next: StancePair) => void;
  onSetStance: () => void;
  onTags: (next: readonly TagDraft[]) => void;
  onReferences: (next: readonly ReferenceDraft[]) => void;
  onSign: () => void;
  onBack: () => void;
  onRestoreKey: () => void;
}) {
  const acts = signedActions(state);
  const uploading = uploadsPending(state.media);

  return (
    <div data-testid="reply-seal" className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6 pt-2">
      <p className="m-0 text-body-small text-on-surface-variant">{replySummary(state)}</p>

      <div className="flex flex-col rounded-medium bg-surface-container-highest px-4 py-1">
        <div className="flex min-h-11 items-center gap-2 border-b border-outline-variant">
          <span className="w-19 flex-none text-label-medium text-on-surface-variant">Comment</span>
          <span className="min-w-0 flex-1 truncate text-body-medium" data-testid="reply-act-comment">
            {replyActLabel(state.target)}
          </span>
          <span className="flex-none text-body-small text-on-surface-variant">1 action</span>
        </div>

        <AddRow
          label="+ Add a topic"
          filled={state.tags.map((tag) => `#${tag.name}`).join("  ")}
          count={state.tags.length}
          testId="reply-open-topics"
          onOpen={() => onSheet("topics")}
        />
        <AddRow
          label="+ Cite something — a post, a person, a comment, an item"
          filled={state.references.length === 1 ? "1 cited" : `${state.references.length} cited`}
          count={state.references.length}
          testId="reply-open-references"
          onOpen={() => onSheet("references")}
        />

        <div className="flex min-h-[46px] items-center gap-2">
          <span className="flex-1 text-label-large" data-testid="reply-signed-actions">
            {acts === 1 ? "1 signed action" : `${acts} signed actions`}
          </span>
          {acts > 1 && (
            <span className="text-body-small text-on-surface-variant">
              they land together, or none does
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <TermRow
          label="Toward what you answer"
          value={<StanceValue pair={state.stance} />}
          action="Adjust"
          testId="reply-open-stance"
          onAction={() => onSheet("stance")}
        />
        <TermRow
          label="License"
          value={
            <span className="text-body-medium text-on-surface-variant">
              {licenseSummary(state.license)}
            </span>
          }
          action="Change"
          testId="reply-open-license"
          onAction={() => onSheet("license")}
          last
        />
      </div>

      <div className="flex-1" />

      {refusal && (
        <p role="alert" data-testid="reply-refused" className="m-0 text-body-medium text-error">
          {refusal}
        </p>
      )}

      {/* The key card takes the place of the sign button rather than sitting
          beside it: signing is not something this browser can do, and a
          disabled button with a banner above it invites the press anyway.
          There is no "keep the draft" way out here — a comment keeps none. */}
      {keyOnDevice === false ? (
        <div
          data-testid="reply-key-absent"
          className="flex flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
        >
          <h2 className="m-0 text-title-small">Your key isn&apos;t on this browser</h2>
          <p className="m-0 text-body-medium">Nothing is spent until you sign.</p>
          <PillButton testId="reply-restore-key" full onClick={onRestoreKey}>
            Restore the key
          </PillButton>
          <PillButton testId="reply-back" variant="text" full onClick={onBack}>
            Back
          </PillButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* THE GATE, as ComposeSealUploading draws it: while bytes are still
              moving the seal says so with the count and holds the button,
              because nothing signs until the content it signs exists. A
              failure is words rather than a count — there is nothing left to
              wait for. */}
          {blocked && uploading > 0 ? (
            <UploadStatusLine
              done={state.media.length - uploading}
              total={state.media.length}
              testId="reply-seal-blocked"
            />
          ) : blocked ? (
            <p
              role="status"
              data-testid="reply-seal-blocked"
              className="m-0 text-body-medium text-on-surface-variant"
            >
              {blocked}
            </p>
          ) : null}
          <PillButton testId="reply-sign" full disabled={busy || blocked !== null} onClick={onSign}>
            {busy ? "Signing…" : "Sign comment"}
          </PillButton>
          <PillButton testId="reply-back" variant="text" full onClick={onBack}>
            Back
          </PillButton>
        </div>
      )}

      <BottomSheet
        open={sheet === "license"}
        onClose={() => onSheet("none")}
        title="License"
        testId="reply-license-sheet"
      >
        <p className="m-0 text-label-small text-on-surface-variant">
          Terms for anyone who reuses this.
        </p>
        <LicenseChooser value={state.license} onChange={onLicense} testIdPrefix="reply" />
        <div className="flex items-center gap-2 border-t border-outline-variant pt-2.5">
          <span className="flex-1 text-label-small text-on-surface-variant">
            {licenseTerms(state.license).join(" ")}
          </span>
          <PillButton testId="reply-license-done" onClick={() => onSheet("none")}>
            Done
          </PillButton>
        </div>
      </BottomSheet>

      {/* ReplyPad. Cancel and the scrim stage nothing; only Set moves the
          stance the seal reads — which is why the pad works on its own staged
          pair rather than writing through on every drag. */}
      <BottomSheet
        open={sheet === "stance"}
        onClose={() => onSheet("none")}
        title="Toward what you answer"
        testId="reply-stance-sheet"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <span className="text-label-small text-on-surface-variant">
              Toward &ldquo;{state.target.label}&rdquo;
            </span>
            <StanceValue pair={stagedStance} large />
          </div>
          <StancePad
            value={stagedStance}
            onChange={onStagedStance}
            ariaLabel={`Your stance toward ${state.target.label}`}
            testId="reply-stance-pad"
          />
          <p className="m-0 text-body-small text-on-surface-variant">
            Replying also signs where you stand on what it answers.
          </p>
          <div className="flex justify-end gap-2">
            <PillButton variant="text" testId="reply-stance-cancel" onClick={() => onSheet("none")}>
              Cancel
            </PillButton>
            <PillButton testId="reply-stance-set" onClick={onSetStance}>
              Set
            </PillButton>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "topics"}
        onClose={() => onSheet("none")}
        title="Topics"
        testId="reply-topics-sheet"
      >
        <div className="flex flex-col gap-3">
          <TagEntryField
            tags={state.tags}
            onChange={onTags}
            fieldErrors={tagErrors}
            cap={TAG_BATCH_CAP}
            testIdPrefix="reply"
          />
          <div className="flex justify-end">
            <PillButton testId="reply-topics-done" onClick={() => onSheet("none")}>
              Done
            </PillButton>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "references"}
        onClose={() => onSheet("none")}
        title="Cite something"
        testId="reply-references-sheet"
      >
        <div className="flex flex-col gap-3">
          <ReferenceEntryField
            references={state.references}
            onChange={onReferences}
            fieldErrors={referenceErrors}
            cap={REFERENCE_BATCH_CAP}
            testIdPrefix="reply"
          />
          <div className="flex justify-end">
            <PillButton testId="reply-references-done" onClick={() => onSheet("none")}>
              Done
            </PillButton>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

/**
 * An acts-card row that is an affordance while it is empty and a summary once
 * it is filled — the board draws the empty state, and the act it would add.
 */
function AddRow({
  label,
  filled,
  count,
  testId,
  onOpen,
}: {
  label: string;
  filled: string;
  count: number;
  testId: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex min-h-[38px] items-center gap-2 border-b border-outline-variant">
      {count === 0 ? (
        <>
          <button
            type="button"
            data-testid={testId}
            onClick={onOpen}
            className="cg-state cg-focus min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-label-medium text-primary"
          >
            {label}
          </button>
          <span className="flex-none text-body-small text-on-surface-variant">1 more action</span>
        </>
      ) : (
        <>
          <button
            type="button"
            data-testid={testId}
            onClick={onOpen}
            className="cg-state cg-focus min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-body-medium"
          >
            {filled}
          </button>
          <span className="flex-none text-body-small text-on-surface-variant">
            {count === 1 ? "1 action" : `${count} actions`}
          </span>
        </>
      )}
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
  value: React.ReactNode;
  action: string;
  testId: string;
  onAction: () => void;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-10 items-center gap-2 border-t border-outline-variant ${
        last ? "border-b" : ""
      }`}
    >
      <span className="flex-1 text-body-medium">{label}</span>
      {value}
      <TextAction testId={testId} onClick={onAction}>
        {action}
      </TextAction>
    </div>
  );
}

/** The face carries the feel and the pair carries the fact (design.md §8.3). */
function StanceValue({ pair, large = false }: { pair: StancePair; large?: boolean }) {
  const anchor = nearestAnchor(pair);
  return (
    <span className="inline-flex items-baseline gap-1" data-testid="reply-stance-value">
      <span aria-hidden="true" className={large ? "text-headline-small" : "text-body-medium"}>
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
