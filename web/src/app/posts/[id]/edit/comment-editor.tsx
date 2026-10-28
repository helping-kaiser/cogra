"use client";

// The comment edit's controller: the batch, the bytes it takes, and the one
// signing pass (CommentEdit, CommentEditVideo, CommentEditActs). The surface
// is `comment-edit-view.tsx`; the gallery's law is `lib/compose/comment-edit.ts`
// and the batch's `lib/compose/edit-batch.ts`.
//
// IT IS ITS OWN COMPONENT because the comments sheet raises it and nothing
// else about the thread needs its state: the sheet says which comment and
// where the reader should land after, and the edit owns everything between —
// the way the reply wizard does.
//
// PREPARES EVERYTHING BEFORE SIGNING ANYTHING (F10): a refusal on the third
// tag must not leave the first two signed, and staged writes nobody signs are
// the server's own GC to collect.
//
// NOTHING SIGNS BEFORE THE BYTES EXIST: a picture the edit adds uploads at
// pick (a comment's pictures never crop), a clip's new face once the cover's
// crop hands it back, and a press of Sign while they run is HELD until the
// last lands; a failure drops it (CommentEdit.md, CommentEditVideo.md).

import { useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchCommentSelfMark,
  prepareCommentEdit,
  type CommentView,
  type ReplyView,
} from "@/lib/api/content-api";
import { firstRefusalMessage } from "@/lib/ui/error-messages";
import type { StagedWriteView } from "@/lib/api/writes-api";
import type { UserError } from "@/lib/api/outcome";
import { fetchGraphIds, graphIdOf } from "@/lib/api/graph-ids-api";
import { fetchKnownMedia } from "@/lib/api/media-api";
import { prepareTag } from "@/lib/api/topics-api";
import { prepareReference, prepareReferenceWithdrawal } from "@/lib/api/references-api";
import { editExpectation } from "@/lib/compose/intent";
import { contentExpectation } from "@/lib/compose/payload-expectation";
import { commentEdit, type ExpectedWrite } from "@/lib/signing/intent";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { signedValues, tagChanges, type TagDraft } from "@/lib/topics/draft";
import { referenceDrafts } from "@/lib/references/claims";
import { referenceChanges, type ReferenceDraft } from "@/lib/references/draft";
import { PUBLIC_DOMAIN, type License } from "@/lib/license";
import {
  editActCount,
  editActRows,
  undoReferenceWithdrawal,
  undoTagWithdrawal,
} from "@/lib/compose/edit-batch";
import {
  addTo,
  addedLedger,
  clipOf,
  editBlocked,
  editClaims,
  editUploads,
  galleryOf,
  keptMediaIds,
  keptPreviews,
  pictureAltText,
  pictureId,
  removeFrom,
  uploadsFailed,
  uploadsPending,
  withAltText,
  withNewCover,
  withUpload,
  type EditGallery,
} from "@/lib/compose/comment-edit";
import { COMMENT_ATTACHMENT_CAP } from "@/lib/compose/comment-media";
import { newComposeId } from "@/lib/compose/ids";
import { COMMENT_SCALE, screenPick, TOO_MANY_COMMENT, VIDEO_AT_EDIT, type PickRefusal } from "@/lib/compose/pick";
import { usePreviewUrls } from "@/lib/compose/previews";
import { runUpload } from "@/lib/compose/uploads";
import { sensitiveReasonProblem, type PickedAsset } from "@/lib/compose/wizard";
import type { SealFault } from "@/lib/compose/seal-fault";
import { useWaitedPast, SLOW_NETWORK_MS } from "@/lib/ui2/waiting-commit";
import { CENTERED } from "@/lib/ui2/media/crop";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { DiscardConfirm } from "@/lib/ui2/compose/discard-confirm";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { CommentEditView } from "./comment-edit-view";

/** The comment pager's square — the window a comment clip's face is cut to (CoverCrop.md). */
const COMMENT_COVER_RATIO = 1;

/** A comment's add control screens to its own cap, never dropping a picture in silence. */
const EDIT_SCALE = {
  ...COMMENT_SCALE,
  pictureCap: { count: COMMENT_ATTACHMENT_CAP, refusal: TOO_MANY_COMMENT },
};

type Editing = {
  draft: string;
  loadedTags: readonly TagDraft[];
  tags: readonly TagDraft[];
  loadedReferences: readonly ReferenceDraft[];
  references: readonly ReferenceDraft[];
  gallery: EditGallery;
  /** The author's own mark as it holds it now. */
  sensitive: boolean;
  sensitiveReason: string;
  license: License;
  /**
   * Whether the edit record is in the batch: set by the first change to a
   * field it carries and never cleared by typing it back — the guard is the
   * acts batch, never a byte comparison (EditComposeUnchanged.md:3).
   */
  recordStaged: boolean;
};

/** A comment's claims as the tag section drafts them. */
function tagDrafts(
  topics: readonly {
    hashtag: { name: { value?: string | null } };
    relevance: number;
    confidence: number;
  }[],
): readonly TagDraft[] {
  return topics.map((claim) => ({
    name: claim.hashtag.name.value ?? "",
    relevance: claim.relevance,
    confidence: claim.confidence,
  }));
}

/** The comment as it arrived, ready to edit — an untouched editor stages nothing (F10). */
function editingOf(comment: CommentView | ReplyView): Editing {
  const tags = tagDrafts(comment.topics);
  // A claim CoGra cannot type has no L2 id to name it back by, so it is left
  // out of the section — never staged, never read as a removal.
  const references = referenceDrafts(comment.references);
  return {
    draft: comment.content.value ?? "",
    loadedTags: tags,
    tags,
    loadedReferences: references,
    references,
    gallery: galleryOf(comment.attachments),
    // The OR is what a READER sees; the switch is the author's own mark and
    // arrives from its own read a moment later (round 4). Starting from the
    // OR would show a moderator's verdict as the author's until it landed,
    // so the switch starts unmarked and the read turns it on.
    sensitive: false,
    sensitiveReason: "",
    license: comment.license ?? PUBLIC_DOMAIN,
    recordStaged: false,
  };
}

function writeRuleIn(errors: readonly UserError[]): boolean {
  return errors.some((error) => error.code === "WRITE_RULE_FAILED");
}

export function CommentEditor({
  comment,
  parentId,
  postId,
  targetLabel,
  onLeave,
  onSigned,
}: {
  comment: CommentView | ReplyView;
  /** The comment this one hangs under, or null at the top level — the node it answers. */
  parentId: string | null;
  postId: string;
  /** What the comment is on, for the editor's lede. */
  targetLabel: string;
  /** Back to the thread, nothing kept. */
  onLeave: () => void;
  /** The signing was taken: the thread reopens with the edit settling. */
  onSigned: () => void;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();

  const [editing, setEditing] = useState<Editing>(() => editingOf(comment));
  const [describing, setDescribing] = useState<string | null>(null);
  const [actsOpen, setActsOpen] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Two help doors — the header's "Editing" and the mark sheet's "?" — plus
  // the write rule's own: the state is which topic is open.
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const [sensitiveOpen, setSensitiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(false);
  const signing = busy || held;
  const slow = useWaitedPast(signing, SLOW_NETWORK_MS);
  const [countChanged, setCountChanged] = useState(false);
  const [fault, setFault] = useState<SealFault | null>(null);
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>({});
  const [refusals, setRefusals] = useState<readonly PickRefusal[]>([]);
  // A picture back from the picker for the clip's face, standing in the
  // cover's crop until Next sets it or the back arrow lets it go.
  const [cropping, setCropping] = useState<PickedAsset | null>(null);
  const started = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    void fetchCommentSelfMark(client, comment.id).then((outcome) => {
      if (cancelled || outcome.kind !== "success" || outcome.value === null) return;
      const mark = outcome.value;
      // The read lands as the switch itself, so arriving marked is not a
      // change the editor offers to sign.
      setEditing((current) => ({ ...current, sensitive: mark.sensitive, sensitiveReason: mark.reason }));
    });
    return () => {
      cancelled = true;
    };
  }, [client, comment.id]);

  // ---- the bytes the edit takes ---------------------------------------------

  const uploads = useMemo(() => editUploads(editing.gallery), [editing.gallery]);
  const local = useMemo(() => (cropping === null ? uploads : [...uploads, cropping]), [uploads, cropping]);
  const localPreviews = usePreviewUrls(local);
  const previews = useMemo(
    () => ({ ...keptPreviews(editing.gallery), ...localPreviews }),
    [editing.gallery, localPreviews],
  );
  const clip = clipOf(editing.gallery);

  useEffect(() => {
    for (const asset of uploads) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      started.current.add(asset.id);
      // A comment's pictures keep their own shape (no ratio); a clip's face
      // is cut to the comment pager's square.
      const ratio = clip?.newCover?.id === asset.id ? COMMENT_COVER_RATIO : undefined;
      void runUpload(client, guard, asset, ratio, (upload) =>
        setEditing((current) => ({ ...current, gallery: withUpload(current.gallery, asset.id, upload) })),
      );
    }
  }, [uploads, clip, client, guard]);

  const pendingUploads = uploadsPending(editing.gallery);
  const failedUploads = uploadsFailed(editing.gallery);
  // A failure drops the held press during render (React, "adjusting some
  // state when a prop changes"): the commit reads its resting label, the ways
  // out answer, nothing signs.
  if (held && failedUploads > 0) setHeld(false);

  // ---- the batch --------------------------------------------------------------

  // THE GUARD IS THE ACTS BATCH, NEVER A BYTE COMPARISON (EditComposeUnchanged.md
  // — the family's rule). The edit record is staged by the first change to a
  // field it carries — the words, the gallery, the face, the mark — and stays
  // staged when the field is typed back; each tag and citation change is its
  // own act, a citation's withdrawal at its counter-records (`withdrawalCost`).
  const changes = tagChanges(editing.loadedTags, editing.tags);
  const referenceChangeList = referenceChanges(editing.loadedReferences, editing.references);
  const rows = editActRows({
    recordStaged: editing.recordStaged,
    recordName: editing.draft.trim().slice(0, 60) || "Your comment",
    loadedTags: editing.loadedTags,
    tags: editing.tags,
    loadedReferences: editing.loadedReferences,
    references: editing.references,
  });
  const count = editActCount(rows);

  /**
   * One change of the author's, read off the editor as it stands when React
   * applies it — an upload's step can land between a render and a tap, and a
   * patch built from the render's copy would undo it. `stagesRecord` marks a
   * change to a field the edit record carries.
   */
  const update = (patch: (current: Editing) => Partial<Editing>, stagesRecord = false) =>
    setEditing((current) => ({
      ...current,
      ...patch(current),
      recordStaged: current.recordStaged || stagesRecord,
    }));

  /**
   * F10: prepares EVERYTHING before signing anything. The edit record is
   * staged only when a field it carries moved; staged writes nobody signs are
   * collected by the server's own GC.
   */
  const submit = async () => {
    setBusy(true);
    setHeld(false);
    const end = () => setBusy(false);
    const writes: StagedWriteView[] = [];
    const perTag: Record<number, string> = {};
    const perReference: Record<number, string> = {};
    let general: string | null = null;
    let nextFault: SealFault | null = null;

    // The L1 ids of the comment, the node it answers, and every cited node
    // the edit touches — read before anything is staged, so the batch is
    // checked against them before its first pre-signature (intent.ts).
    const parentUuid = parentId ?? postId;
    const graphIds = await guard.run(() =>
      fetchGraphIds(client, [
        comment.id,
        parentUuid,
        ...referenceChangeList.map((change) => change.reference.targetId),
      ]),
    );
    if (graphIds.kind !== "success") {
      end();
      setFailed(true);
      return;
    }
    const commentGraphId = graphIdOf(graphIds.value, comment.id);
    const sent = {
      id: comment.id,
      content: editing.draft,
      // Re-stated, never omitted: the edit carries the whole state — the
      // gallery for the same reason as the mark.
      attachments: editClaims(editing.gallery) ?? undefined,
      sensitive: editing.sensitive,
      sensitiveReason: editing.sensitiveReason,
    };
    // The record's payload is complete state: the bytes uploaded here are
    // held to the digests this device computed, the kept ones to the digests
    // of the asset each names, read back by id (payload-expectation.ts).
    let record: ExpectedWrite | null = null;
    if (editing.recordStaged) {
      const kept = await guard.run(() => fetchKnownMedia(client, keptMediaIds(editing.gallery)));
      if (kept.kind !== "success") {
        end();
        setFailed(true);
        return;
      }
      const ledger = new Map([...kept.value, ...addedLedger(editing.gallery)]);
      record = commentEdit(
        graphIdOf(graphIds.value, parentUuid),
        commentGraphId,
        contentExpectation(comment.id, sent, "comment", ledger),
      );
    }
    const expected = editExpectation(
      commentGraphId,
      record,
      { tags: changes, references: referenceChangeList },
      graphIds.value,
    );

    if (editing.recordStaged) {
      const prepared = await guard.run(() => prepareCommentEdit(client, sent));
      if (prepared.kind === "failed") {
        end();
        setFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        if (writeRuleIn(prepared.errors)) nextFault = { kind: "writeRule" };
        else general = firstRefusalMessage(prepared.errors, "The server refused this write.");
      } else {
        writes.push(...prepared.value.writes);
      }
    }

    for (const change of changes) {
      const prepared = await guard.run(() =>
        prepareTag(client, {
          target: comment.id,
          name: change.tag.name,
          // Withdrawing is a Tag act at (0,0) (hashtag.md §4).
          ...signedValues(change),
        }),
      );
      if (prepared.kind === "failed") {
        end();
        setFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        if (writeRuleIn(prepared.errors)) {
          nextFault = { kind: "writeRule" };
          continue;
        }
        // A PRE-STAGING refusal is a field error, never the signing line
        // (F2). An added tag carries it on its own chip; a withdrawal has no
        // chip left to carry it, so it reads on the general line.
        const message = firstRefusalMessage(prepared.errors, "The server refused this write.");
        const index =
          change.kind === "tag" ? editing.tags.findIndex((tag) => tag.name === change.tag.name) : -1;
        if (index >= 0) perTag[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    // One Reference act per added or re-tuned reference; a removal is a
    // WITHDRAWAL, whose counter-records the server assembles (D11).
    for (const change of referenceChangeList) {
      const prepared = await guard.run(() =>
        change.kind === "reference"
          ? prepareReference(client, {
              artifact: comment.id,
              target: change.reference.targetId,
              relevance: change.reference.relevance,
              support: change.reference.support,
            })
          : prepareReferenceWithdrawal(client, {
              artifact: comment.id,
              target: change.reference.targetId,
            }),
      );
      if (prepared.kind === "failed") {
        end();
        setFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        if (writeRuleIn(prepared.errors)) {
          nextFault = { kind: "writeRule" };
          continue;
        }
        // A cited post that never landed: its row says so, with Remove it
        // (CommentEdit.md; copy-voice, *One staged act refused*).
        const unlanded =
          change.kind === "reference" &&
          prepared.errors.some(
            (error) => error.code === "NOT_FOUND" && error.field?.[error.field.length - 1] === "target",
          );
        if (unlanded) {
          nextFault = nextFault ?? { kind: "row", targetId: change.reference.targetId };
          continue;
        }
        const message = firstRefusalMessage(prepared.errors, "The server refused this write.");
        const index =
          change.kind === "reference"
            ? editing.references.findIndex((reference) => reference.targetId === change.reference.targetId)
            : -1;
        if (index >= 0) perReference[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    if (nextFault !== null) {
      end();
      setFault(nextFault);
      return;
    }
    if (general !== null || Object.keys(perTag).length > 0 || Object.keys(perReference).length > 0) {
      end();
      setTagErrors(perTag);
      setReferenceErrors(perReference);
      setRefusal(general);
      return;
    }
    // THE COUNT THE SIGNING PREPARED IS THE ONE THE FOOT READ, or nothing is
    // signed: the held press drops and the foot says so (CommentEdit.md).
    if (writes.length !== count) {
      end();
      setCountChanged(true);
      return;
    }

    const results = await signer.sign(writes, expected);
    end();
    if (results.every((result) => result.kind === "done")) {
      // The edit settles IN THE THREAD (`CommentEdit` → the thread).
      onSigned();
      return;
    }
    const refused = results.find((result) => result.kind === "refused");
    if (refused !== undefined && refused.kind === "refused") {
      // A refused act whose target landed is a bug the picking stage should
      // have blocked: the notice in the bug's own words (CommentEdit.md).
      setFault(writeRuleIn(refused.errors) ? { kind: "writeRule" } : { kind: "bug" });
      return;
    }
    // No answer reached the edit: the network error answers, and everything
    // the reader chose stays as it was.
    setFailed(true);
  };

  // The last upload landing releases a held press into `submit`, which takes
  // it over as `busy` (it clears `held`).
  useEffect(() => {
    if (!held || pendingUploads > 0 || failedUploads > 0) return;
    const release = setTimeout(() => void submit(), 0);
    return () => clearTimeout(release);
    // `submit` reads the state it is handed this render; the press is the
    // trigger, and the upload counts are what release it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, pendingUploads, failedUploads]);

  const reasonProblem = editing.sensitive ? sensitiveReasonProblem(editing.sensitiveReason) : null;

  const press = () => {
    // The reason answers to its cap only while the mark is on: an unmarked
    // edit's reason is never sent (`sensitiveInput`).
    // A comment needs words (the reply's own gate), whatever else it carries.
    if (
      signing ||
      count === 0 ||
      editing.draft.trim() === "" ||
      editBlocked(editing.gallery, editing.draft) !== null ||
      reasonProblem !== null
    ) {
      return;
    }
    setCountChanged(false);
    setRefusal(null);
    setFailed(false);
    setFault(null);
    setTagErrors({});
    setReferenceErrors({});
    // Sign is the confirmation: the count is said on the foot and in the acts
    // sheet, and no dialog asks again (CommentEditActs).
    if (uploadsPending(editing.gallery) > 0 || editClaims(editing.gallery) === null) setHeld(true);
    else void submit();
  };

  // THE EDIT KEEPS NO DRAFT, so the way out reads the acts batch — the same
  // count the sign guard reads: an empty batch leaves at once, and a batch
  // holding an act is asked before anything is discarded (DiscardConfirm.md).
  const leave = () => {
    if (signing) return;
    if (count === 0) onLeave();
    else setConfirmingDiscard(true);
  };

  const retryUploads = () => {
    for (const asset of editUploads(editing.gallery)) {
      if (asset.upload.kind !== "failed") continue;
      started.current.delete(asset.id);
      setEditing((current) => ({
        ...current,
        gallery: withUpload(current.gallery, asset.id, { kind: "waiting" }),
      }));
    }
  };

  // `+ Add pictures · N of 4`: screened file by file against the comment's
  // cap and its pictures-or-one-video grammar; what is refused says why under
  // the pictures, never in a dialog (CommentEdit.md).
  const pick = async (files: readonly File[]) => {
    const outcome = await screenPick(
      files,
      { hasVideo: clip !== undefined, count: editing.gallery.length },
      EDIT_SCALE,
    );
    const refused: PickRefusal[] = [...outcome.refusals];
    if (outcome.kind === "video") {
      for (const file of outcome.accepted) {
        refused.push({ id: newComposeId(), name: file.name, reason: VIDEO_AT_EDIT, file });
      }
    }
    if (refused.length > 0) setRefusals((current) => [...current, ...refused]);
    if (outcome.kind !== "picture" || outcome.accepted.length === 0) return;
    const picked = outcome.accepted.map((file) => ({ id: newComposeId(), file }));
    update((current) => ({ gallery: addTo(current.gallery, picked) }), true);
  };

  const describingPicture =
    describing === null ? undefined : editing.gallery.find((picture) => pictureId(picture) === describing);

  return (
    <>
      <CommentEditView
        targetLabel={targetLabel}
        words={editing.draft}
        gallery={editing.gallery}
        previews={previews}
        license={editing.license}
        tags={editing.tags}
        references={editing.references}
        loadedTags={editing.loadedTags}
        loadedReferences={editing.loadedReferences}
        tagErrors={tagErrors}
        referenceErrors={referenceErrors}
        sensitive={editing.sensitive}
        sensitiveReason={editing.sensitiveReason}
        sensitiveOpen={sensitiveOpen}
        acts={rows}
        actsOpen={actsOpen}
        busy={busy}
        held={held}
        slow={slow}
        countChanged={countChanged}
        fault={fault}
        refusals={refusals}
        cropping={
          cropping === null
            ? null
            : {
                src: previews[cropping.id] ?? "",
                crop: cropping.crop,
                onCrop: (crop) => setCropping({ ...cropping, crop }),
                onNext: () => {
                  // The face is set and the cover row is back; its cropped
                  // export starts uploading (CoverCrop.md).
                  if (clip !== undefined) {
                    const face = cropping;
                    update((current) => ({ gallery: withNewCover(current.gallery, clip.mediaId, face) }), true);
                  }
                  setCropping(null);
                },
                onBack: () => setCropping(null),
              }
        }
        refusal={refusal}
        failed={failed}
        onWords={(draft) => update(() => ({ draft }), true)}
        onSensitive={(sensitive) => update(() => ({ sensitive }), true)}
        onSensitiveReason={(sensitiveReason) => update(() => ({ sensitiveReason }), true)}
        onSensitiveOpen={setSensitiveOpen}
        onSensitiveHelp={() => setHelp(HELP_TOPICS.markingAsSensitive)}
        onPick={(files) => void pick(files)}
        onDismissRefusal={(id) => setRefusals((current) => current.filter((one) => one.id !== id))}
        onRemovePicture={(id) => update((current) => ({ gallery: removeFrom(current.gallery, id) }), true)}
        onRetryUploads={retryUploads}
        onRemoveFailed={() =>
          update((current) => {
            let gallery = current.gallery;
            for (const asset of editUploads(gallery)) {
              if (asset.upload.kind === "failed") gallery = removeFrom(gallery, asset.id);
            }
            return { gallery };
          }, true)
        }
        onDescribe={setDescribing}
        onPickCover={(file) =>
          setCropping({
            id: newComposeId(),
            file,
            crop: CENTERED,
            altText: "",
            upload: { kind: "waiting" },
            kind: "picture",
          })
        }
        onRemoveCover={() => {
          if (clip !== undefined) update((current) => ({ gallery: withNewCover(current.gallery, clip.mediaId, null) }));
        }}
        onTags={(tags) => update(() => ({ tags }))}
        onReferences={(references) => update(() => ({ references }))}
        onUndoTag={(name) => update((current) => ({ tags: undoTagWithdrawal(current.loadedTags, current.tags, name) }))}
        onUndoReference={(targetId) =>
          update((current) => ({
            references: undoReferenceWithdrawal(current.loadedReferences, current.references, targetId),
          }))
        }
        onActs={setActsOpen}
        onHelp={() => setHelp(HELP_TOPICS.editing)}
        onWriteRuleHelp={() => setHelp(HELP_TOPICS.whySigningWaitsAtEdit)}
        onNotNow={() => setFault(null)}
        onTryAgain={() => {
          setFault(null);
          void submit();
        }}
        // Introduced-but-inert, as on the seal: the report path ships later.
        onReport={() => {}}
        onDiscard={() => setConfirmingDiscard(true)}
        onRemoveRefusedCitation={(targetId) => {
          setFault(null);
          update((current) => ({
            references: current.references.filter((reference) => reference.targetId !== targetId),
          }));
        }}
        onSign={press}
        onLeave={leave}
      />
      {/* Discard keeps nothing: the edit's state lives here alone, and leaving
          drops it — the comment stands as it was. */}
      <DiscardConfirm
        open={confirmingDiscard}
        subject="edit"
        onKeepWriting={() => setConfirmingDiscard(false)}
        onDiscard={onLeave}
        testId="comment-edit-discard-confirm"
      />
      {/* One picture at a time, keyed by id: comments have no in-sheet
          stepping, on the editor as on the composer. */}
      <DescribeSheet
        open={describingPicture !== undefined}
        onClose={() => setDescribing(null)}
        src={
          describing === null
            ? null
            : describingPicture?.kind === "kept" && describingPicture.video
              ? describingPicture.coverUrl
              : (previews[describing] ?? null)
        }
        crop={null}
        value={describingPicture === undefined ? "" : pictureAltText(describingPicture)}
        onChange={(altText) => {
          const id = describing;
          if (id !== null) update((current) => ({ gallery: withAltText(current.gallery, id, altText) }), true);
        }}
        video={describingPicture?.kind === "kept" && describingPicture.video}
        testId="comment-edit-describe-sheet"
      />
      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help ?? HELP_TOPICS.editing}
        testId="comment-edit-help-dialog"
      />
    </>
  );
}
