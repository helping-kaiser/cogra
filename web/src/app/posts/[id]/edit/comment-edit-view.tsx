"use client";

// CommentEdit / CommentEditActs — the post's one-screen-one-batch, scaled to a
// comment's anatomy: words, pictures, topics, citations, the licence locked.
//
// THE LICENCE IS READ-ONLY HERE, and the lock says why. A licence is a term of
// the minting record; an edit is a new record over the same node, so there is
// nothing an edit could change it to. Drawing it greyed with a lock is the
// board's own answer to "why can't I touch this" — better than hiding a term
// the comment is still under.
//
// THE MARK IS THE AUTHOR'S ONGOING JUDGEMENT, which is why it sits beside a
// licence that cannot move: the licence is fixed by contract at signing, the
// mark is not, so an author can veil or unveil their own comment after
// publishing (design/backlog.md item 25.2). It opens the same ComposeSensitive
// sheet the post's seal opens — one sheet for every surface that marks.
//
// THE ROW SENDS COMPLETE STATE, mark and reason together. An edit that carried
// the switch but dropped the reason would strip the line the veil shows without
// anyone asking for it.
//
// THE ACTS FOOTER IS AN AFFORDANCE, not a label: it opens the acts sheet
// (CommentEditActs), which is the EditActs pattern at comment scale. At an
// empty batch it is no control at all — `Nothing to sign yet` — and Sign the
// edit stays visible and inert (EditComposeUnchanged: the guard is the
// family's, and it is the acts batch, never a byte comparison).

import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { HeaderBar, HelpButton } from "@/lib/ui2/header-bar";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { TextField } from "@/lib/ui2/text-field";
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { DescribeCounter } from "@/lib/ui2/compose/picked-row";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { ActsFooter, ActsSheet, WithdrawnLine } from "@/lib/ui2/compose/edit-acts";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { TransportError } from "@/lib/ui/transport-error";
import { licenseName, type License } from "@/lib/license";
import {
  editActCount,
  withdrawnReferences,
  withdrawnTags,
  type EditActRow,
} from "@/lib/compose/edit-batch";
import { COMMENT_ATTACHMENT_CAP } from "@/lib/compose/comment-media";
import {
  describedCount,
  pictureAltText,
  pictureId,
  type EditGallery,
} from "@/lib/compose/comment-edit";
import { COMMENT_BODY_MAX_CHARS, commentBodyProblem } from "@/lib/compose/reply-wizard";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";

/** A group's caption — the board's own label rung. */
function FieldLabel({ children }: { children: string }) {
  return <span className="text-label-large">{children}</span>;
}

export function CommentEditView({
  targetLabel,
  words,
  gallery,
  previews,
  license,
  tags,
  references,
  loadedTags,
  loadedReferences,
  tagErrors,
  referenceErrors,
  sensitive,
  sensitiveReason,
  sensitiveOpen,
  acts,
  actsOpen,
  busy,
  blocked,
  refusal,
  failed,
  onWords,
  onSensitive,
  onSensitiveReason,
  onSensitiveOpen,
  onSensitiveHelp,
  onPick,
  onRemovePicture,
  onDescribe,
  onTags,
  onReferences,
  onUndoTag,
  onUndoReference,
  onActs,
  onHelp,
  onSign,
  onLeave,
}: {
  /** What the comment is on — the board's lede. */
  targetLabel: string;
  words: string;
  gallery: EditGallery;
  /** Picture id → something to draw: a served URL, or a local object URL. */
  previews: Readonly<Record<string, string>>;
  /** The comment's license as it was signed — shown, locked. */
  license: License;
  tags: readonly TagDraft[];
  references: readonly ReferenceDraft[];
  /** What the comment arrived with: the baseline a withdrawal is read against. */
  loadedTags: readonly TagDraft[];
  loadedReferences: readonly ReferenceDraft[];
  tagErrors?: Readonly<Record<number, string>>;
  referenceErrors?: Readonly<Record<number, string>>;
  /** The author's own mark, and the line the veil would show. */
  sensitive: boolean;
  sensitiveReason: string;
  sensitiveOpen: boolean;
  /** The batch, every kind counted in the records it signs. */
  acts: readonly EditActRow[];
  actsOpen: boolean;
  busy: boolean;
  /** Why the edit cannot be signed yet, or null. */
  blocked: string | null;
  refusal: string | null;
  failed: boolean;
  onWords: (words: string) => void;
  onSensitive: (next: boolean) => void;
  onSensitiveReason: (next: string) => void;
  onSensitiveOpen: (open: boolean) => void;
  onSensitiveHelp: () => void;
  onPick: (files: readonly File[]) => void;
  onRemovePicture: (id: string) => void;
  onDescribe: (id: string) => void;
  onTags: (tags: readonly TagDraft[]) => void;
  onReferences: (references: readonly ReferenceDraft[]) => void;
  onUndoTag: (name: string) => void;
  onUndoReference: (targetId: string) => void;
  onActs: (open: boolean) => void;
  onHelp: () => void;
  onSign: () => void;
  onLeave: () => void;
}) {
  const full = gallery.length >= COMMENT_ATTACHMENT_CAP;
  const count = editActCount(acts);
  const slowAnswer = useSlowAnswer(busy);
  // A modal dialog over the surface that raised it, so it announces itself as
  // one: the stage beneath it is suspended while it is up (Feed.md:31,
  // `covering-layer.tsx`). Mounted only while open, so it covers for as long
  // as it is mounted.
  useCoversSurface(true, "suspend");

  return (
    <div
      data-testid="comment-edit"
      role="dialog"
      aria-modal="true"
      aria-label="Edit comment"
      className="fixed inset-0 z-40 flex flex-col bg-surface text-on-surface"
    >
      <HeaderBar
        title="Edit comment"
        backLabel="Back to the thread"
        onBack={onLeave}
        onLeave={onLeave}
        leaveLabel="Leave — this edit is discarded"
        help={<HelpButton label="Editing" onOpen={onHelp} />}
      />

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-4 pt-3">
        <p className="m-0 text-label-small text-on-surface-variant">
          Your comment on &ldquo;{targetLabel}&rdquo;.
        </p>

        <TextField
          label="Words"
          value={words}
          onChange={onWords}
          multiline
          rows={3}
          testId="comment-edit-input"
          cap={COMMENT_BODY_MAX_CHARS}
          error={commentBodyProblem(words) ?? undefined}
        />

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Pictures</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {gallery.map((picture) => {
              const id = pictureId(picture);
              const upload = picture.kind === "added" ? picture.asset.upload : null;
              return (
                <MediaThumb
                  key={id}
                  src={previews[id] ?? null}
                  altText={pictureAltText(picture)}
                  width={56}
                  height={56}
                  fit="contain"
                  progress={
                    upload !== null &&
                    (upload.kind === "waiting" ||
                      upload.kind === "encoding" ||
                      upload.kind === "uploading" ||
                      upload.kind === "processing")
                      ? "indeterminate"
                      : undefined
                  }
                  failed={upload?.kind === "failed"}
                  onRemove={() => onRemovePicture(id)}
                  testId={`comment-edit-media-${id}`}
                />
              );
            })}
            {/* The platform's own dialog: an editor has no pick stage either. */}
            <label
              data-testid="comment-edit-add-media"
              className={`cg-state cg-focus-within cursor-pointer text-label-small text-primary ${
                full ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={full}
                data-testid="comment-edit-media-input"
                onChange={(event) => {
                  const files = event.target.files;
                  if (files !== null) {
                    onPick([...files].filter((file) => file.type.startsWith("image/")));
                  }
                  event.target.value = "";
                }}
                className="sr-only"
              />
              + Add · {gallery.length} of {COMMENT_ATTACHMENT_CAP}
            </label>
          </div>
          {gallery.length > 0 && (
            <DescribeCounter
              described={describedCount(gallery)}
              total={gallery.length}
              onDescribe={() => {
                const first = gallery[0];
                if (first !== undefined) onDescribe(pictureId(first));
              }}
              testId="comment-edit-describe-counter"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Topics</FieldLabel>
          {/* The edit stages a separate act per change, so there is no batch
              cap here — that is the creation gesture's rule. */}
          <TagEntryField
            tags={tags}
            onChange={onTags}
            fieldErrors={tagErrors}
            cap={null}
            testIdPrefix="comment-edit"
          />
          {withdrawnTags(loadedTags, tags).map((tag) => (
            <WithdrawnLine
              key={tag.name}
              name={`#${tag.name}`}
              onUndo={() => onUndoTag(tag.name)}
              testId={`comment-edit-withdrawn-tag-${tag.name}`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>References</FieldLabel>
          <ReferenceEntryField
            references={references}
            onChange={onReferences}
            fieldErrors={referenceErrors}
            cap={null}
            testIdPrefix="comment-edit"
          />
          {withdrawnReferences(loadedReferences, references).map((reference) => (
            <WithdrawnLine
              key={reference.targetId}
              name={reference.target.label}
              onUndo={() => onUndoReference(reference.targetId)}
              testId={`comment-edit-withdrawn-reference-${reference.targetId}`}
            />
          ))}
        </div>

        {/* The two term rows the board draws shut: the licence, stated and
            locked, then the author's own mark. */}
        <div className="flex flex-col">
          <div className="flex min-h-11 items-center gap-2 border-t border-outline-variant">
            <span className="flex-1 text-body-medium">License</span>
            <span
              className="text-body-medium text-on-surface-variant"
              data-testid="comment-edit-license"
            >
              {licenseName(license)}
            </span>
            <span
              className="inline-flex text-on-surface-variant"
              aria-label="The license never changes"
              data-testid="comment-edit-license-locked"
            >
              <LockGlyph />
            </span>
          </div>
          <div className="flex min-h-11 items-center gap-2 border-y border-outline-variant">
            <span className="flex-1 text-body-medium">Sensitive</span>
            <span
              className="text-body-medium text-on-surface-variant"
              data-testid="comment-edit-sensitive-value"
            >
              {sensitive ? "Marked" : "Not marked"}
            </span>
            <TextAction
              testId="comment-edit-open-sensitive"
              onClick={() => onSensitiveOpen(true)}
            >
              {sensitive ? "Change" : "Mark"}
            </TextAction>
          </div>
        </div>

        <div className="flex-1" />

        {refusal && (
          <p role="alert" data-testid="comment-edit-refused" className="m-0 text-body-medium text-error">
            {refusal}
          </p>
        )}
        {failed && <TransportError testId="comment-edit-failed" />}
        {blocked && (
          <p
            role="status"
            data-testid="comment-edit-blocked"
            className="m-0 text-body-medium text-on-surface-variant"
          >
            {blocked}
          </p>
        )}

        {/* What the edit would sign, and the way into the detail. */}
        <ActsFooter
          count={count}
          onOpen={() => onActs(true)}
          testId="comment-edit-signed-actions"
        />

        {/* Inert, never hidden, at an empty batch; a press while the signing
            is out is refused without the button dimming (CommentEdit.md). */}
        <PillButton
          testId="comment-edit-save"
          full
          disabled={count === 0 || blocked !== null}
          onClick={() => {
            if (!busy) onSign();
          }}
        >
          {slowAnswer ? "Signing the edit…" : "Sign the edit"}
        </PillButton>
      </div>

      <SensitiveSheet
        open={sensitiveOpen}
        marked={sensitive}
        reason={sensitiveReason}
        onMarked={onSensitive}
        onReason={onSensitiveReason}
        onClose={() => onSensitiveOpen(false)}
        onHelp={onSensitiveHelp}
        testIdPrefix="comment-edit"
      />

      <ActsSheet
        open={actsOpen}
        rows={acts}
        onClose={() => onActs(false)}
        testId="comment-edit-acts-sheet"
      />
    </div>
  );
}

// Material's `lock`, the 16px cut the board draws beside the licence.
function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6zm3 13a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}
