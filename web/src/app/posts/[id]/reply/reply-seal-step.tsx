"use client";

// ReplySeal / ReplyPad / ComposeKeyAbsent — the reply's last screen, where
// every act is named with its price before anything is signed.
//
// THE SENSITIVE ROW IS THE BOARD'S THIRD TERM ROW — "Sensitive · Not marked ·
// Mark" (`_shared.jsx:780-788`), opening the same `ComposeSensitive` sheet the
// post seal and the comment editor open. It was held back while a
// sensitive-marked COMMENT had no veiled read state, so that the switch could
// not promise a veil the reader never got; design backlog item 25.4 built that
// veil on 2026-09-02 and says in as many words that "the reply-wizard lanes
// can implement ReplySeal 1:1". The row closes the group now, and the License
// row gives back the closing hairline it was holding.
//
// THE TOPIC AND CITATION ROWS ARE THE BOARD'S, THE CONTROLS ARE THE PRODUCT'S.
// ReplySeal draws "+ Add a topic" and "+ Cite something" inside the acts card,
// each with the act it would add. Both boarded destinations are gaps — the
// topic picker is not boarded at all, and ReferencePicker has no web
// implementation — so pressing a row opens the entry field this product
// already ships, in the sheet idiom the seal already uses for the licence and
// the sensitive mark. Nothing here invents the picker.

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { CitedSheet } from "@/lib/ui2/compose/cited-sheet";
import { ParkedPad } from "@/lib/ui2/compose/parked-pad";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { StancePad } from "@/lib/ui2/compose/stance-pad";
import { UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { LicenseRows } from "@/lib/ui/license-rows";
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

export type ReplySheet =
  | "none"
  | "license"
  | "stance"
  | "topics"
  | "references"
  | "cited"
  | "sensitive";

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
  onSensitive,
  onSensitiveReason,
  onSensitiveHelp,
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
  onSensitive: (next: boolean) => void;
  onSensitiveReason: (next: string) => void;
  onSensitiveHelp: () => void;
  onSign: () => void;
  onBack: () => void;
  onRestoreKey: () => void;
}) {
  const acts = signedActions(state);
  const uploading = uploadsPending(state.media);

  return (
    <div data-testid="reply-seal" className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6 pt-2">
      <p className="m-0 text-body-small text-on-surface-variant">{replySummary(state)}</p>

      <div
        data-testid="reply-seal-acts"
        className="flex flex-col rounded-medium bg-surface-container-highest px-4 py-1"
      >
        <div className="flex min-h-11 items-center gap-2 border-b border-outline-variant">
          <span className="w-19 flex-none text-label-medium text-on-surface-variant">Comment</span>
          <span className="min-w-0 flex-1 truncate text-body-medium" data-testid="reply-act-comment">
            {replyActLabel(state.target)}
          </span>
          <ActsCount count={1} noun="comment" />
        </div>

        <AddRow
          label="+ Add a topic"
          filled={state.tags.map((tag) => `#${tag.name}`).join("  ")}
          count={state.tags.length}
          countNoun="tag"
          testId="reply-open-topics"
          onOpen={() => onSheet("topics")}
        />
        {/* THE SAME THREE READINGS THE POST'S SEAL TAKES (jakob's ruling
            2026-09-14, design backlog item 70): the rule is about citations,
            not about which composer staged them. One reads back as itself,
            two or more read back as their count behind a door — and the
            add-row stays in every state, because a comment's seal IS its
            details stage and counting the citations takes away no way to add
            another (`ReplyCitedMany.jsx:12-16`). */}
        {state.references.length === 1 && (
          <ReplyCitedRow
            // Singular: the label names the EDGE staged rather than the block
            // it sits in, and one edge is a reference (`_shared.jsx:1046-1052`).
            label="Reference"
            name={state.references[0].target.label}
            onRepair={() => onSheet("references")}
            onRemove={() =>
              onReferences(
                state.references.filter(
                  (reference) => reference.targetId !== state.references[0].targetId,
                ),
              )
            }
          />
        )}
        {state.references.length > 1 && (
          <CitedRow
            count={state.references.length}
            testId="reply-open-cited"
            onOpen={() => onSheet("cited")}
          />
        )}
        {/* "+ Cite something", the short form: the hand board spelled the
            kinds out while the staged twin said the short form, so one
            surface said two things depending on whether a reference had
            landed. The picker's own screen is where the kinds are enumerated
            (`ReplySeal.jsx:14-17`). */}
        <OfferRow
          label="+ Cite something"
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
          value={<StanceValue pair={state.stance} testId="reply-stance-value" />}
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
        />
        <TermRow
          label="Sensitive"
          value={
            <span
              className="text-body-medium text-on-surface-variant"
              data-testid="reply-sensitive-value"
            >
              {state.sensitive ? "Marked" : "Not marked"}
            </span>
          }
          action={state.sensitive ? "Change" : "Mark"}
          testId="reply-open-sensitive"
          onAction={() => onSheet("sensitive")}
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
        {/* The board's own row anatomy — a dot, the reading, its hint —
            rather than `LicenseChooser`'s settings-page fieldset, which
            drew a second "License" legend and a second note inside a
            sheet already titled and noted (`ComposeLicense.jsx:5-11`).
            The post seal's license sheet was corrected first; this is
            the same component, not a second copy of it. */}
        <LicenseRows value={state.license} onChange={onLicense} testIdPrefix="reply" />
        <div className="flex items-center gap-2 border-t border-outline-variant pt-2.5">
          <span className="flex-1 text-label-small text-on-surface-variant">
            {licenseTerms(state.license).join(" ")}
          </span>
          <PillButton testId="reply-license-done" onClick={() => onSheet("none")}>
            Done
          </PillButton>
        </div>
      </BottomSheet>

      {/* ReplyPad. It PARKS over the page rather than riding a drawer
          (`ReplyPadBody`, design/readme.md §"Fixed elements"): the same
          place every time, because muscle memory is part of the control —
          which is also what android's reply pad already does.

          Cancel and the wash stage nothing; only Set moves the stance the
          seal reads, which is why the pad works on its own staged pair
          rather than writing through on every drag. */}
      <ParkedPad
        open={sheet === "stance"}
        onClose={() => onSheet("none")}
        ariaLabel="Toward what you answer"
        standoff="reply"
        testId="reply-stance-pad-panel"
      >
        <div className="flex flex-col">
          <span className="text-label-small text-on-surface-variant">
            Toward &ldquo;{state.target.label}&rdquo;
          </span>
          <StanceValue pair={stagedStance} large testId="reply-stance-staged" />
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
      </ParkedPad>

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

      {/* The post seal's own sheet, opened from this seal's door: one surface,
          drawn once, wherever a staged collection is managed. It adds nothing —
          the add-row above it is where another citation is staged. */}
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
        testId="reply-cited-sheet"
      />

      {/* The same sheet the post seal and the comment editor open — one mark,
          explained one way (design/backlog.md item 42). */}
      <SensitiveSheet
        open={sheet === "sensitive"}
        marked={state.sensitive}
        reason={state.sensitiveReason}
        onMarked={onSensitive}
        onReason={onSensitiveReason}
        onClose={() => onSheet("none")}
        onHelp={onSensitiveHelp}
        testIdPrefix="reply"
      />
    </div>
  );
}

/**
 * An acts-card row that is an affordance while it is empty and a summary once
 * it is filled — the board draws the empty state, and the act it would add.
 *
 * THE COUNT IS A BARE NUMBER, as `ActsCard` draws it: `1 more` on an empty
 * row, the count itself on a filled one. The word form spent the row's width
 * on a noun the column already says, and what it spent came out of the value
 * slot — the drawn example name ellipsised on a real device.
 */
function AddRow({
  label,
  filled,
  count,
  countNoun,
  testId,
  onOpen,
}: {
  label: string;
  filled: string;
  count: number;
  countNoun: string;
  testId: string;
  onOpen: () => void;
}) {
  if (count === 0) return <OfferRow label={label} testId={testId} onOpen={onOpen} />;
  return (
    <div className="flex min-h-[38px] items-center gap-2 border-b border-outline-variant">
      <button
        type="button"
        data-testid={testId}
        onClick={onOpen}
        className="cg-state cg-focus min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-body-medium"
      >
        {filled}
      </button>
      <ActsCount count={count} noun={countNoun} />
    </div>
  );
}

/**
 * THE COUNT IS SEEN BARE AND HEARD WHOLE (jakob's ruling 2026-09-14, design
 * backlog item 73; `ActsCard.jsx:27-39`). The digit is what the board draws;
 * an ear given the number alone gets nothing, so the digit leaves the
 * accessibility tree and a paired reading says "2 citations". The noun is the
 * row's own — the References row counts CITATIONS — never its label's.
 *
 * A count already made of words ("1 more", on a row that still offers an act)
 * keeps them and says itself.
 */
function ActsCount({ count, noun }: { count: number; noun: string }) {
  return (
    <span className="flex-none text-body-small text-on-surface-variant">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? noun : `${noun}s`}
      </span>
    </span>
  );
}

/**
 * A row that is still an offer: the gesture, and what it would cost.
 *
 * The citations' offer stays an offer in every state — the board's add-rows
 * ride along whether or not something is staged (`_shared.jsx:1076-1099`),
 * because the reply's seal is also the stage where its citations are named.
 */
function OfferRow({
  label,
  testId,
  onOpen,
}: {
  label: string;
  testId: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex min-h-[38px] items-center gap-2 border-b border-outline-variant">
      <button
        type="button"
        data-testid={testId}
        onClick={onOpen}
        className="cg-state cg-focus min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-label-medium text-primary"
      >
        {label}
      </button>
      <span className="flex-none text-body-small text-on-surface-variant">1 more</span>
    </div>
  );
}

/**
 * The reply's ONE staged citation, read back as itself: the name that opens
 * the citation's pair, and the × that drops it, each naming the citation it
 * acts on (`StagedReference`'s rule, jakob 2026-09-10).
 */
function ReplyCitedRow({
  label,
  name,
  onRepair,
  onRemove,
}: {
  label: string;
  name: string;
  onRepair: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-h-[38px] items-center gap-2 border-b border-outline-variant">
      <span className="w-19 flex-none text-label-medium text-on-surface-variant">{label}</span>
      <button
        type="button"
        aria-label={`${name} — set how it relates`}
        data-testid="reply-cited-repair"
        onClick={onRepair}
        className="cg-state cg-focus min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-body-medium"
      >
        {name}
      </button>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        data-testid="reply-cited-remove"
        onClick={onRemove}
        className="cg-state cg-focus flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full text-on-surface-variant"
      >
        <span aria-hidden="true">×</span>
      </button>
      <ActsCount count={1} noun="citation" />
    </div>
  );
}

/**
 * The References row once it counts: "N cited", the bare count, and the whole
 * row as the control — the post seal's own door, said on this seal, opening
 * the one sheet both seals open (`ReplyCitedMany.jsx:17-20`). No chevron and
 * no trailing word, so the accessible name is what tells a listener the line
 * is a door ("Manage the citations", copy-voice).
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
      aria-label="Manage the citations"
      className="cg-state cg-focus flex min-h-[38px] w-full cursor-pointer items-center gap-2 border-0 border-b border-solid border-outline-variant bg-transparent p-0 text-left text-on-surface"
    >
      <span className="w-19 flex-none text-label-medium text-on-surface-variant">References</span>
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
function StanceValue({
  pair,
  large = false,
  testId,
}: {
  pair: StancePair;
  large?: boolean;
  testId: string;
}) {
  const anchor = nearestAnchor(pair);
  return (
    <span className="inline-flex items-baseline gap-1" data-testid={testId}>
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
