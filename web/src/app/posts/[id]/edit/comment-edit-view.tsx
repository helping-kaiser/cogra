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
// THERE IS NO SENSITIVE ROW, and that is FIDELITY rather than a deviation: the
// CommentEdit board draws none. The author's own mark still travels on the
// wire, unchanged, because the edit is complete state — an edit that omitted
// it would unveil a comment its author had veiled.
//
// THE ACTS FOOTER IS AN AFFORDANCE, not a label: it opens the acts sheet
// (CommentEditActs), which is the EditActs pattern at comment scale.

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { HeaderBar, HelpButton } from "@/lib/ui2/header-bar";
import { PillButton } from "@/lib/ui2/pill-button";
import { TextField } from "@/lib/ui2/text-field";
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { DescribeCounter } from "@/lib/ui2/compose/picked-row";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { TransportError } from "@/lib/ui/transport-error";
import { signedActionsLine } from "@/lib/ui/signed-actions";
import { COMMENT_ATTACHMENT_CAP } from "@/lib/compose/comment-media";
import {
  describedCount,
  pictureAltText,
  pictureId,
  type EditGallery,
} from "@/lib/compose/comment-edit";
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
  tags,
  references,
  tagErrors,
  referenceErrors,
  acts,
  actsOpen,
  busy,
  blocked,
  refusal,
  failed,
  onWords,
  onPick,
  onRemovePicture,
  onDescribe,
  onTags,
  onReferences,
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
  tags: readonly TagDraft[];
  references: readonly ReferenceDraft[];
  tagErrors?: Readonly<Record<number, string>>;
  referenceErrors?: Readonly<Record<number, string>>;
  acts: number;
  actsOpen: boolean;
  busy: boolean;
  /** Why the edit cannot be signed yet, or null. */
  blocked: string | null;
  refusal: string | null;
  failed: boolean;
  onWords: (words: string) => void;
  onPick: (files: readonly File[]) => void;
  onRemovePicture: (id: string) => void;
  onDescribe: (id: string) => void;
  onTags: (tags: readonly TagDraft[]) => void;
  onReferences: (references: readonly ReferenceDraft[]) => void;
  onActs: (open: boolean) => void;
  onHelp: () => void;
  onSign: () => void;
  onLeave: () => void;
}) {
  const full = gallery.length >= COMMENT_ATTACHMENT_CAP;

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
                      upload.kind === "uploading")
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
        </div>

        {/* The licence, stated and locked. */}
        <div className="flex min-h-11 items-center gap-2 border-y border-outline-variant">
          <span className="flex-1 text-body-medium">License</span>
          <span className="text-body-medium text-on-surface-variant">Public domain</span>
          <span
            className="inline-flex text-on-surface-variant"
            aria-label="The license never changes"
            data-testid="comment-edit-license-locked"
          >
            <LockGlyph />
          </span>
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
        <button
          type="button"
          data-testid="comment-edit-signed-actions"
          onClick={() => onActs(true)}
          className="cg-state cg-focus flex items-center justify-center gap-1 border-0 bg-transparent text-label-small text-on-surface-variant"
        >
          {/* The board draws the populated case; the product already owns the
              words for an untouched editor, and "0 signed actions" is not
              them. */}
          This {signedActionsLine(acts)}
          <ChevronGlyph />
        </button>

        <PillButton
          testId="comment-edit-save"
          full
          disabled={busy || acts === 0 || blocked !== null}
          onClick={onSign}
        >
          {busy ? "Signing…" : "Sign the edit"}
        </PillButton>
      </div>

      <BottomSheet
        open={actsOpen}
        onClose={() => onActs(false)}
        title={acts === 1 ? "1 signed action" : `${acts} signed actions`}
        testId="comment-edit-acts-sheet"
      >
        <div className="flex flex-col gap-3 px-6 pb-4">
          <p className="m-0 text-body-medium text-on-surface-variant">
            They land together, or none does.
          </p>
          <div className="flex justify-end">
            <PillButton variant="text" testId="comment-edit-acts-done" onClick={() => onActs(false)}>
              Done
            </PillButton>
          </div>
        </div>
      </BottomSheet>
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

// Material's `expand_more`, which is what the acts footer wears.
function ChevronGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
  );
}
