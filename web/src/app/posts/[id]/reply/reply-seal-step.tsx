"use client";

// ReplySeal / ReplyCited / ReplyCitedMany / ReplySealKeyAbsent — the reply's
// last screen, where every act is named with its price before anything is
// signed (`_shared.jsx` `ReplySealBody`).
//
// ONE SURFACE, THE SYSTEM'S OWN MASTERS. The quiet line that says what is
// answered, the acts card (`ActsCard`: the comment, the staged tags and
// citations, then the two action rows, the total and its all-or-nothing
// subline), the three fact rows (`FactRow`), the note that replying signs an
// opinion, and the foot. A comment's seal is also its details stage, so the
// action rows ride along in every state — what could still be added, lined up
// with what has been (ReplyCitedMany.md:7).
//
// THE ACTION ROWS OPEN THE PICKERS (round 27, seam 253: "the reply composer
// opens the pickers"): `+ Add a tag` raises `TagPicker` and `+ Cite something`
// raises `ReferencePicker`, each standing in the composer's place as the
// edits' do — the seal hands the opening up to the wizard, which owns the
// dialog the picker stands in.
//
// THE SENSITIVE ROW IS THE BOARD'S THIRD FACT ROW — "Sensitive · Not marked ·
// Mark" (`_shared.jsx`), opening the same `ComposeSensitive` sheet the post
// seal and the comment editor open (design backlog item 25.4).
//
// WHILE IT SIGNS, IT HOLDS THE READER AS THE POST'S SEAL DOES (`ReplySeal.jsx`,
// SealSigning.md, ReplySealUploading.md): the commit is inert from the press,
// never dimmed; past 200ms it reads `Signing comment…` and every way out and
// every row's door refuses a press; past 5s the subline under the total says
// the network is slow. A press made while the reply's bytes still move is
// HELD — the commit stays enabled through the gate, and only a failed upload
// closes it, the gate line's fault reading saying why.

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { PillButton } from "@/lib/ui2/pill-button";
import { FactRow } from "@/lib/ui2/fact-row";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { ReadoutChip } from "@/lib/ui2/chip";
import {
  ActsCard,
  actsTotal,
  ALL_OR_NOTHING,
  SLOW_SIGNING_LINE,
  type ActsAction,
  type ActsRow,
} from "@/lib/ui2/compose/acts-card";
import { CitedSheet } from "@/lib/ui2/compose/cited-sheet";
import { CITATION_FAMILY, PairSheet } from "@/lib/ui2/compose/pair-sheet";
import { TagsSheet } from "@/lib/ui2/compose/tags-sheet";
import { ParkedPad } from "@/lib/ui2/compose/parked-pad";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { StancePad } from "@/lib/ui2/compose/stance-pad";
import { UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { LicenseRows } from "@/lib/ui/license-rows";
import { bundleReadout, EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { formatStancePair, formatStanceWords } from "@/lib/ui/stance-format";
import { licenseReading, type License } from "@/lib/license";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";
import {
  replyActLabel,
  replySummary,
  signedActions,
  type ReplyState,
  type SealUploads,
} from "@/lib/compose/reply-wizard";

export type ReplySheet = "none" | "license" | "stance" | "tags" | "cited" | "pair" | "sensitive";

/** How many chips the Tags row holds before it counts — the post seal's rule (`TAGS_ROW_HOLDS`). */
const TAGS_ROW_HOLDS = 2;

/** The note under the fact rows (ReplySeal.md:7; `_shared.jsx` `ReplySealBody`). */
export const REPLYING_SIGNS_AN_OPINION = "Replying also signs an opinion on what it answers.";

/** The reply-scale key notice's line (ReplySealKeyAbsent.md:3). */
export const REPLY_KEY_ABSENT_LINE = "A reply can't wait as pending — restore the key to sign this one.";

const CLOSE_GLYPH =
  "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

export function ReplySealStep({
  state,
  sheet,
  stagedStance,
  blocked,
  uploads,
  signing,
  swapped,
  slow,
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
  onOpenTagPicker,
  onOpenReferencePicker,
  onSensitive,
  onSensitiveReason,
  onSensitiveHelp,
  onKeyHelp,
  onSign,
  onRetryUploads,
  onBack,
  onDiscard,
  onRestoreKey,
}: {
  state: ReplyState;
  sheet: ReplySheet;
  /** What the pad has under the finger — staged, not set, until Set. */
  stagedStance: StancePair;
  /** Why the commit is closed, or null when it may be pressed (`sealClosed`). */
  blocked: string | null;
  /** The gate line's reading (`sealUploads`). */
  uploads: SealUploads;
  /** A press is held or in flight: the commit refuses a second one. */
  signing: boolean;
  /** Past 200ms since the press: the label reads its participle and the ways out lock. */
  swapped: boolean;
  /** Past 5s since the press: the acts card's subline says so. */
  slow: boolean;
  keyOnDevice: boolean | null;
  refusal: string | null;
  /** A refused tag's words, by its place in the staged set. */
  tagErrors?: Readonly<Record<number, string>>;
  /** A refused citation's words, by its place in the staged set. */
  referenceErrors?: Readonly<Record<number, string>>;
  onSheet: (next: ReplySheet) => void;
  onLicense: (next: License) => void;
  onStagedStance: (next: StancePair) => void;
  onSetStance: () => void;
  onTags: (next: readonly TagDraft[]) => void;
  onReferences: (next: readonly ReferenceDraft[]) => void;
  /** `+ Add a tag`: the tag picker, in the composer's place. */
  onOpenTagPicker: () => void;
  /** `+ Cite something`: the citation picker, in the composer's place. */
  onOpenReferencePicker: () => void;
  onSensitive: (next: boolean) => void;
  onSensitiveReason: (next: string) => void;
  onSensitiveHelp: () => void;
  /** The key notice's own "?" (ReplySealKeyAbsent.md:5). */
  onKeyHelp: () => void;
  onSign: () => void;
  /** The failed upload's Retry: the gate runs again, and nothing signs until the next press. */
  onRetryUploads: () => void;
  onBack: () => void;
  /** `Discard the reply` under the key notice — the wizard's own leave, asking first. */
  onDiscard: () => void;
  onRestoreKey: () => void;
}) {
  const acts = signedActions(state);
  // Inert for the label swap's duration, never dimmed (SealSigning.md): a press
  // on a way out, a fact's action or a row's door does nothing then.
  const guard = (act: () => void) => () => {
    if (!swapped) act();
  };

  const removeReference = (targetId: string) =>
    onReferences(state.references.filter((reference) => reference.targetId !== targetId));
  const removeTag = (name: string) => onTags(state.tags.filter((tag) => tag.name !== name));

  const rows: (ActsRow | ActsAction)[] = [
    {
      label: "Comment",
      value: <span data-testid="reply-act-comment">{replyActLabel(state.target)}</span>,
      count: 1,
      countNoun: "comment",
      testId: "reply-seal-comment",
    },
  ];
  // THE STAGED TAGS READ BACK AS THE POST SEAL'S DO (`ComposeSealTagged`): the
  // chips while the row holds them, past that their count, the row the door
  // to the sheet that lists them. A refused tag is said on its row.
  const refusedTag = firstRefused(state.tags, tagErrors);
  const tagFault =
    refusedTag === null
      ? undefined
      : {
          message: refusedTag.message,
          onRemove: () => removeTag(refusedTag.item.name),
          removeLabel: `Remove #${refusedTag.item.name}`,
        };
  if (state.tags.length > TAGS_ROW_HOLDS) {
    rows.push({
      label: "Tags",
      value: `${state.tags.length} tags`,
      count: state.tags.length,
      countNoun: "tag",
      open: { label: `Manage the ${state.tags.length} tags`, onOpen: guard(() => onSheet("tags")) },
      fault: tagFault,
      testId: "reply-open-tags-sheet",
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
      fault: tagFault,
      testId: "reply-seal-tags",
    });
  }
  // THE CITATIONS' THREE READINGS (jakob's rulings 2026-09-14, design backlog
  // item 70): nothing staged draws no row; ONE reads back as itself — its
  // name, which opens its pair (ReplyCited.md:9), and the × that drops it;
  // TWO OR MORE read back as their count, the row the door to `CitedSheet`.
  const refusedReference = firstRefused(state.references, referenceErrors);
  const only = state.references.length === 1 ? state.references[0] : undefined;
  if (only !== undefined) {
    rows.push({
      label: "Reference",
      value: (
        <span className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            aria-label={`${only.target.label} — set how it relates`}
            data-testid="reply-cited-repair"
            onClick={guard(() => onSheet("pair"))}
            className="cg-state cg-focus min-w-0 cursor-pointer truncate rounded-small border-0 bg-transparent p-0 text-left font-sans text-body-medium text-on-surface"
          >
            {only.target.label}
          </button>
          <button
            type="button"
            aria-label={`Remove ${only.target.label}`}
            data-testid="reply-cited-remove"
            onClick={guard(() => removeReference(only.targetId))}
            className="cg-state cg-focus flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant"
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
              <path d={CLOSE_GLYPH} />
            </svg>
          </button>
        </span>
      ),
      count: 1,
      countNoun: "citation",
      fault:
        refusedReference === null
          ? undefined
          : { message: refusedReference.message, onRemove: () => removeReference(only.targetId) },
      testId: "reply-seal-reference",
    });
  } else if (state.references.length > 1) {
    const count = state.references.length;
    rows.push({
      label: "References",
      value: `${count} cited`,
      count,
      countNoun: "citation",
      open: { label: `Manage the ${count} citations`, onOpen: guard(() => onSheet("cited")) },
      // Under a count the refused citation is named by Remove it's name.
      fault:
        refusedReference === null
          ? undefined
          : {
              message: refusedReference.message,
              onRemove: () => removeReference(refusedReference.item.targetId),
              removeLabel: `Remove ${refusedReference.item.target.label}`,
            },
      testId: "reply-open-cited",
    });
  }
  // THE ACTION ROWS, in every state (`_shared.jsx` `ADD_ROWS`): the word and
  // what it would cost, `1 more`.
  rows.push(
    { action: "+ Add a tag", count: "1 more", onAct: guard(onOpenTagPicker), testId: "reply-open-tags" },
    { action: "+ Cite something", count: "1 more", onAct: guard(onOpenReferencePicker), testId: "reply-open-references" },
  );

  return (
    <div data-testid="reply-seal" className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6 pt-2">
      <QuietNote testId="reply-seal-summary">{replySummary(state)}</QuietNote>

      <ActsCard
        rows={rows}
        total={actsTotal(acts)}
        // Past 5s from the press the subline says the network is slow, in its
        // own place, whether the bytes have landed yet or not
        // (ReplySealUploading.md:13, SealSigningSlow.md).
        note={slow ? SLOW_SIGNING_LINE : acts > 1 ? ALL_OR_NOTHING : null}
        noteTone={slow ? "slow" : "quiet"}
        testId="reply-seal-acts"
      />

      <div className="flex flex-col">
        <FactRow
          label="Toward what you answer"
          value={<StanceValue pair={state.stance} testId="reply-stance-value" />}
          action="Adjust"
          testId="reply-open-stance"
          onAction={guard(() => onSheet("stance"))}
        />
        <FactRow
          label="License"
          value={licenseReading(state.license)}
          action="Change"
          testId="reply-open-license"
          onAction={guard(() => onSheet("license"))}
        />
        <FactRow
          label="Sensitive"
          value={
            <span className="text-body-medium text-on-surface-variant" data-testid="reply-sensitive-value">
              {state.sensitive ? "Marked" : "Not marked"}
            </span>
          }
          action={state.sensitive ? "Change" : "Mark"}
          testId="reply-open-sensitive"
          onAction={guard(() => onSheet("sensitive"))}
          last
        />
      </div>

      {/* The opinion the reply carries is a fact about replying, not about
          the row — so it stands under the ruled block (`ReplySealBody`). */}
      <QuietNote testId="reply-seal-note">{REPLYING_SIGNS_AN_OPINION}</QuietNote>

      <div className="flex-1" />

      {refusal && (
        <p role="alert" data-testid="reply-refused" className="m-0 text-body-medium text-error">
          {refusal}
        </p>
      )}

      {/* THE KEY NOTICE TAKES THE FOOT'S PLACE (ReplySealKeyAbsent.md): every
          row stays, the reply-scale line, the restore, and `Discard the reply`
          under it — never a way to keep a draft, since a comment keeps none. */}
      {keyOnDevice === false ? (
        <>
          <NoticePanel
            title="Your key isn't on this browser"
            help={{ label: "Your key", onOpen: onKeyHelp, testId: "reply-key-help" }}
            testId="reply-key-absent"
          >
            <NoticeLine>{REPLY_KEY_ABSENT_LINE}</NoticeLine>
            <PillButton testId="reply-restore-key" variant="inverse" full onClick={onRestoreKey}>
              Restore the key
            </PillButton>
          </NoticePanel>
          <PillButton testId="reply-discard" variant="text" full onClick={onDiscard}>
            Discard the reply
          </PillButton>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {/* THE GATE (ReplySealUploading, ReplySealUploadFailed): nothing
              signs until the content it signs exists. While bytes move the
              line counts them, naming the pictures or the video, and the
              commit stays live — a press is held and signs the moment the
              last one lands. A failed upload is the one thing that closes the
              commit, and the line's fault reading says why, with Retry. */}
          {uploads.failed > 0 ? (
            <UploadStatusLine
              done={uploads.done}
              total={uploads.total}
              failed
              failedCount={uploads.failed}
              message={
                uploads.video
                  ? "The video didn't upload."
                  : uploads.failed === 1
                    ? "One picture didn't upload."
                    : `${uploads.failed} pictures didn't upload.`
              }
              onRetry={onRetryUploads}
              testId="reply-seal-blocked"
            />
          ) : uploads.pending > 0 ? (
            <UploadStatusLine
              done={uploads.done}
              total={uploads.total}
              media={uploads.video ? "video" : "pictures"}
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
          {/* SealFooter: the commit names what it signs; inert from the press,
              its participle past 200ms, never dimmed and no spinner. */}
          <PillButton
            testId="reply-sign"
            full
            disabled={blocked !== null}
            onClick={() => {
              if (!signing) onSign();
            }}
          >
            {swapped ? "Signing comment…" : "Sign comment"}
          </PillButton>
          <PillButton testId="reply-back" variant="text" full onClick={guard(onBack)}>
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
            rather than `LicenseChooser`'s settings-page fieldset
            (`ComposeLicense.jsx:5-11`): the post seal's license sheet's
            component, not a second copy of it. */}
        <LicenseRows value={state.license} onChange={onLicense} testIdPrefix="reply" />
        <div className="flex items-center gap-2 border-t border-outline-variant pt-2.5">
          <span className="flex-1 text-label-small text-on-surface-variant">
            {licenseReading(state.license)}
          </span>
          <PillButton testId="reply-license-done" onClick={() => onSheet("none")}>
            Done
          </PillButton>
        </div>
      </BottomSheet>

      {/* ReplyPad. It PARKS over the page rather than riding a drawer
          (`ReplyPadBody`, design/readme.md §"Fixed elements"): the same
          place every time, because muscle memory is part of the control.
          Cancel and the wash stage nothing; only Set moves the stance the
          seal reads, which is why the pad works on its own staged pair. */}
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

      {/* The post seal's own sheets, opened from this seal's doors: one
          surface, drawn once, wherever a staged collection is managed. They
          add nothing — the action rows are where another is staged. */}
      <TagsSheet
        open={sheet === "tags"}
        onClose={() => onSheet("none")}
        items={state.tags}
        onChange={onTags}
        testId="reply-tags-sheet"
      />
      <CitedSheet
        open={sheet === "cited"}
        onClose={() => onSheet("none")}
        items={state.references}
        onRemove={removeReference}
        onRepair={(targetId, next) =>
          onReferences(
            state.references.map((reference) =>
              reference.targetId === targetId ? { ...reference, ...next } : reference,
            ),
          )
        }
        testId="reply-cited-sheet"
      />
      {/* THE ONE CITATION'S PAIR (ReplyCited.md:9): its name opens the pair
          sheet the citations sheet opens per row. */}
      {only !== undefined && (
        <PairSheet
          open={sheet === "pair"}
          title={only.target.label}
          value={{ pDirected: only.relevance, pInterest: only.support }}
          family={CITATION_FAMILY}
          onDone={(pair) => {
            onReferences([{ ...only, relevance: pair.pDirected, support: pair.pInterest }]);
            onSheet("none");
          }}
          onDiscard={() => onSheet("none")}
          testId="reply-cited-pair"
        />
      )}

      {/* The same sheet the post seal and the comment editor open — one mark,
          explained one way (design/backlog.md item 42). */}
      <SensitiveSheet
        open={sheet === "sensitive"}
        reason={state.sensitiveReason}
        onDone={(next) => {
          onSensitive(next.sensitive);
          onSensitiveReason(next.sensitiveReason);
          onSheet("none");
        }}
        onClose={() => onSheet("none")}
        onHelp={onSensitiveHelp}
        testIdPrefix="reply"
      />
    </div>
  );
}

/** The first staged item the server refused, with its words — said on its own row. */
function firstRefused<T>(
  items: readonly T[],
  errors: Readonly<Record<number, string>> | undefined,
): { item: T; message: string } | null {
  if (errors === undefined) return null;
  for (const [index, message] of Object.entries(errors)) {
    const item = items[Number(index)];
    if (item !== undefined) return { item, message };
  }
  return null;
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
  // A pick being staged: its face follows its value (seam 243).
  const anchor = bundleReadout(pair, EMPTY_PICK_LABEL);
  return (
    <span className="inline-flex items-baseline gap-1" data-testid={testId}>
      <span aria-hidden="true" className={large ? "text-headline-small" : "text-body-medium"}>
        {anchor.emoji}
      </span>
      {/* The digits are the geek reading (readme §13): drawn in a `cg-exact`
          span, painted only in geek mode, and spoken in both. */}
      <span aria-hidden="true" className="cg-exact text-body-small text-on-surface-variant">
        {formatStancePair(pair)}
      </span>
      <span className="sr-only">
        {anchor.label}, {formatStanceWords(pair)}
      </span>
    </span>
  );
}
