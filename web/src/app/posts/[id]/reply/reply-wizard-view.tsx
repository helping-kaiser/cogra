"use client";

// The reply wizard — ReplyCompose / ReplyPicturesWeb / ReplySeal / ReplyPad,
// with ComposeDescribe and ComposeLicense as the masters they are.
//
// IT IS A SURFACE OVER THE THREAD, NOT A ROUTE, and that is a considered
// departure from the post wizard's `/compose`. Every one of this flow's ways
// out goes back to the thread it was opened from — the boards say so on every
// leave edge — and the composer needs the target's own name, snippet and
// avatar, all of which the thread already holds. A route would have to re-read
// the post to draw its own header, and coming back would re-read it again and
// lose which branches the reader had unfolded. The STAGE MACHINE is the post
// wizard's, unchanged: a reducer, a header with two ways out, and the forward
// action at the foot of the column.
//
// NO DRAFTS (jakob 2026-09-01). The X discards the comment, silently and
// without a confirmation, so the header's leave label says that rather than
// the post wizard's "your draft is kept" — a label promising a draft that does
// not exist is worse than no label. `graph.json` still annotates these leave
// edges "draft kept"; the ruling supersedes it and the annotation is already
// filed with the design loop.
//
// THE SEAL IS THE CONFIRMATION. The inline composer this replaces asked for a
// second confirmation before signing several acts, because nothing had named
// them. ReplySeal names every act with its price, exactly as ComposeSeal does,
// so a modal on top of it would be the same question twice.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { prepareComment } from "@/lib/api/content-api";
import { hasFieldErrors, partitionFieldErrors } from "@/lib/api/field-errors";
import { firstRefusalMessage, writeRefusalMessage } from "@/lib/ui/error-messages";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { runUpload, runVideoUpload } from "@/lib/compose/uploads";
import { usePreviewUrls, useRevokeOnChange } from "@/lib/compose/previews";
import { commentAttachmentClaims } from "@/lib/compose/comment-media";
import { COMMENT_SCALE, screenPick, type PickRefusal } from "@/lib/compose/pick";
import { captureFrames, probeVideo } from "@/lib/ui2/media/video";
import {
  emptyReply,
  isVideoReply,
  replyHasContent,
  replyReducer,
  sealGate,
  type ReplyAction,
  type ReplyState,
  type ReplyTarget,
} from "@/lib/compose/reply-wizard";
import type { StancePair } from "@/lib/stance/model";
import { HeaderBar, HelpButton } from "@/lib/ui2/header-bar";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { DiscardConfirm } from "@/lib/ui2/compose/discard-confirm";
import { COVER_FROM_PICTURE } from "@/lib/compose/wizard";
import { TransportError } from "@/lib/ui/transport-error";
import { ReplyComposeStep } from "./reply-compose-step";
import { ReplySealStep, type ReplySheet } from "./reply-seal-step";

/**
 * The leave label. Nothing is kept — there are no comment drafts — and the
 * confirm is what stands between the author and that fact when they have
 * written something.
 */
export const LEAVE_LABEL = "Leave — this comment is discarded";

const NO_FRAMES: readonly Blob[] = [];
const NO_URLS: readonly string[] = [];
const NO_REFUSALS: readonly PickRefusal[] = [];

/** The faces one clip offers, and the URLs drawn from them. */
type Captured = {
  file: Blob;
  frames: readonly Blob[];
  urls: readonly string[];
};

export function ReplyWizard({
  target,
  onLeave,
  onSigned,
  store = identityStore,
}: {
  target: ReplyTarget;
  /** The thread, unchanged — the arrow off the first stage and the X both. */
  onLeave: () => void;
  /** The thread, with the new comment settling under its pending marker. */
  onSigned: (node: string) => void;
  store?: IdentityStore;
}) {
  const client = useApolloClient();
  const router = useRouter();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const keyOnDevice = useKeyOnDevice(store);

  const [state, setState] = useState<ReplyState>(() => emptyReply(target));
  const dispatch = useCallback(
    (action: ReplyAction) => setState((current) => replyReducer(current, action)),
    [],
  );

  const [sheet, setSheet] = useState<ReplySheet>("none");
  // The pad's own pick, staged until Set — Cancel and the scrim stage nothing.
  const [stagedStance, setStagedStance] = useState<StancePair>(state.stance);
  const [describing, setDescribing] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>({});

  const previews = usePreviewUrls(state.media);

  // ---- the uploads ---------------------------------------------------------

  // A comment has no crop step, so the bytes are ready the moment they are
  // picked: "they upload while you write". The ref guards React's double mount
  // in development, which would otherwise upload every picture twice.
  const started = useRef(new Set<string>());
  const video = isVideoReply(state) ? state.media[0] : undefined;
  const videoFile = video?.file ?? null;
  const cover = state.cover;

  useEffect(() => {
    // A VIDEO IS ONE SEQUENCE, NOT TWO RACES: the cover must exist as an asset
    // before the video can name it, so the pair goes through a single runner.
    if (video !== undefined) {
      if (cover === null || video.upload.kind !== "waiting" || started.current.has(video.id)) return;
      started.current.add(video.id);
      started.current.add(cover.id);
      void runVideoUpload(
        client,
        guard,
        video,
        cover,
        (upload) => dispatch({ type: "upload", id: video.id, upload }),
        (upload) => dispatch({ type: "coverUpload", upload }),
      );
      return;
    }
    for (const asset of state.media) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      started.current.add(asset.id);
      // No ratio: a comment's pictures keep their own shape.
      void runUpload(client, asset, undefined, (upload) =>
        dispatch({ type: "upload", id: asset.id, upload }),
      );
    }
  }, [state.media, video, cover, client, guard, dispatch]);

  // ---- the clip's length, and the faces it offers ---------------------------

  const [probed, setProbed] = useState<{ file: Blob; durationMs: number } | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const mine = captured !== null && captured.file === videoFile ? captured : null;
  const durationMs = probed !== null && probed.file === videoFile ? probed.durationMs : 0;
  const framePreviews = mine?.urls ?? NO_URLS;
  const capturing = videoFile !== null && captured?.file !== videoFile;
  useRevokeOnChange(framePreviews);

  useEffect(() => {
    if (videoFile === null) return;
    let cancelled = false;
    void probeVideo(videoFile)
      .then((probe) => {
        if (!cancelled) setProbed({ file: videoFile, durationMs: probe.durationMs });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoFile]);

  // THE FRAMES ARE TAKEN AS SOON AS THE CLIP LANDS, unlike the post's, which
  // waits for its cover screen. A comment has no stage to wait for: the cover
  // row is in the composer the author is already standing on, so the offers
  // have to be there when they look down.
  useEffect(() => {
    if (videoFile === null || captured?.file === videoFile) return;
    let cancelled = false;
    void captureFrames(videoFile)
      .then((taken) => {
        if (cancelled) return;
        setCaptured({
          file: videoFile,
          frames: taken,
          urls: taken.map((frame) => URL.createObjectURL(frame)),
        });
        const first = taken[0];
        if (first !== undefined) {
          dispatch({
            type: "coverIfUnset",
            cover: { id: crypto.randomUUID(), file: first, frame: 0, upload: { kind: "waiting" } },
          });
        }
      })
      .catch(() => {
        // No frames is a state the row draws: "A picture" still works, and the
        // gate keeps the author from signing without a cover.
        if (!cancelled) setCaptured({ file: videoFile, frames: NO_FRAMES, urls: NO_URLS });
      });
    return () => {
      cancelled = true;
    };
  }, [videoFile, captured, dispatch]);

  const chooseCover = (file: Blob, frame: number) => {
    // A new face is a new upload: the old one may already be on the server, and
    // it is attached to nothing, so the sweeper takes it.
    if (cover !== null) started.current.delete(cover.id);
    dispatch({
      type: "cover",
      cover: { id: crypto.randomUUID(), file, frame, upload: { kind: "waiting" } },
    });
    if (video !== undefined) {
      started.current.delete(video.id);
      dispatch({ type: "upload", id: video.id, upload: { kind: "waiting" } });
    }
  };

  const [refusals, setRefusals] = useState<readonly PickRefusal[]>(NO_REFUSALS);

  // ---- leaving --------------------------------------------------------------

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  /**
   * The X, and the arrow from the first stage.
   *
   * "Something written — the confirm; empty — leaves at once." An empty
   * composer must not ask: a confirmation over nothing is what trains an author
   * to dismiss the dialog unread, which is precisely how it fails on the day it
   * has something to protect.
   */
  const leave = () => {
    if (replyHasContent(state)) {
      setConfirmingDiscard(true);
      return;
    }
    onLeave();
  };

  const pick = async (files: readonly File[]) => {
    const outcome = await screenPick(
      files,
      { hasVideo: isVideoReply(state), count: state.media.length },
      COMMENT_SCALE,
    );
    if (outcome.refusals.length > 0) {
      setRefusals((current) => [...current, ...outcome.refusals]);
    }
    if (outcome.accepted.length === 0) return;
    dispatch({
      type: "pick",
      assets: outcome.accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        kind: outcome.kind,
      })),
    });
  };

  const retry = (id: string) => {
    started.current.delete(id);
    // The video's retry takes its cover with it: the two go up as one sequence.
    if (video !== undefined && id === video.id && cover !== null) {
      started.current.delete(cover.id);
      dispatch({ type: "coverUpload", upload: { kind: "waiting" } });
    }
    dispatch({ type: "upload", id, upload: { kind: "waiting" } });
  };

  // ---- signing -------------------------------------------------------------

  const submit = async () => {
    setBusy(true);
    setRefusal(null);
    setTagErrors({});
    setReferenceErrors({});
    setTransportFailed(false);

    const prepared = await guard.run(() =>
      prepareComment(client, {
        target: state.target.id,
        content: state.words,
        license: state.license,
        tags: state.tags,
        references: state.references,
        attachments: commentAttachmentClaims(state.media) ?? undefined,
        stance: state.stance,
      }),
    );

    if (prepared.kind === "failed") {
      setBusy(false);
      setTransportFailed(true);
      return;
    }
    if (prepared.kind === "refused") {
      setBusy(false);
      const partition = partitionFieldErrors(prepared.errors, (error) =>
        writeRefusalMessage(error.code),
      );
      setTagErrors(partition.perTag);
      setReferenceErrors(partition.perReference);
      setRefusal(
        partition.general ??
          (hasFieldErrors(partition)
            ? "Something in the details was refused."
            : "The server refused this write."),
      );
      // The refused chip lives in the seal's own sheet, so the sheet is
      // reopened on it rather than the reader hunting for what was refused.
      if (Object.keys(partition.perTag).length > 0) setSheet("topics");
      else if (Object.keys(partition.perReference).length > 0) setSheet("references");
      return;
    }

    await finish(prepared.value.node, prepared.value.writes);
  };

  const finish = async (node: string, writes: readonly StagedWriteView[]) => {
    const results = await signer.sign(writes);
    setBusy(false);

    if (results.every((result) => result.kind === "done")) {
      onSigned(node);
      return;
    }

    // The batch lands together or not at all, so one unlanded write means the
    // comment did not land — and nothing was spent. There is no draft to keep,
    // so the reader stays on the seal with what they wrote still in front of
    // them, which is the only place the words survive.
    const refused = results.find((result) => result.kind === "refused");
    setRefusal(
      refused && refused.kind === "refused"
        ? firstRefusalMessage(refused.errors, "The comment wasn't signed.")
        : "The comment wasn't signed.",
    );
  };

  // ---- the frame -----------------------------------------------------------

  const blocked = sealGate(state);
  const title = state.step === "compose" ? "Reply" : "What you sign";

  return (
    <div
      data-testid="reply-wizard"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-40 flex flex-col bg-surface text-on-surface"
    >
      <HeaderBar
        title={title}
        backLabel={state.step === "compose" ? "Back to the thread" : "Back a step"}
        // The arrow is ONE STAGE BACK, and from the first stage that is the
        // thread — which discards the comment just as the X does.
        //
        // IT ASKS NOTHING, because the boards do not: every reply board carries
        // the confirm on its "X — leave" edge (via 2) and none carries it on
        // the back arrow (via 1), which is drawn as a plain cancel to
        // ReplyEntry. Followed as drawn rather than made symmetric here — but
        // the asymmetry means the arrow can still lose a written comment
        // silently, which is the exact thing the confirm exists to prevent, so
        // it is reported rather than quietly patched.
        onBack={() => (state.step === "compose" ? leave() : dispatch({ type: "back" }))}
        onLeave={leave}
        leaveLabel={LEAVE_LABEL}
        action={
          state.step === "seal" ? (
            <span className="flex items-center gap-2">
              <span className="whitespace-nowrap text-body-small text-on-surface-variant">
                Last step
              </span>
              <HelpButton
                label="Signed actions"
                onOpen={() => setHelp(HELP_TOPICS.signedActions)}
              />
            </span>
          ) : undefined
        }
      />

      {transportFailed && (
        <div className="px-6">
          <TransportError testId="reply-transport-error" />
        </div>
      )}

      {state.step === "compose" ? (
        <ReplyComposeStep
          state={state}
          previews={previews}
          framePreviews={framePreviews}
          capturing={capturing}
          durationMs={durationMs}
          refusals={refusals}
          onWords={(words) => dispatch({ type: "words", words })}
          onPick={(files) => void pick(files)}
          onRemove={(id) => dispatch({ type: "unpick", id })}
          onRetry={retry}
          onDescribe={() => setDescribing(state.media[0]?.id ?? null)}
          onPickFrame={(index) => {
            const frame = mine?.frames[index];
            if (frame) chooseCover(frame, index);
          }}
          onPickCover={(file) => chooseCover(file, COVER_FROM_PICTURE)}
          onDismissRefusal={(id) =>
            setRefusals((current) => current.filter((refusal) => refusal.id !== id))
          }
          onNext={() => dispatch({ type: "advance" })}
        />
      ) : (
        <ReplySealStep
          state={state}
          sheet={sheet}
          stagedStance={stagedStance}
          blocked={blocked.ok ? null : blocked.reason}
          busy={busy}
          keyOnDevice={keyOnDevice}
          refusal={refusal}
          tagErrors={tagErrors}
          referenceErrors={referenceErrors}
          onSheet={(next) => {
            // Opening the pad starts it from the stance that is standing, so
            // Cancel can put it back exactly.
            if (next === "stance") setStagedStance(state.stance);
            setSheet(next);
          }}
          onLicense={(license) => dispatch({ type: "license", license })}
          onStagedStance={setStagedStance}
          onSetStance={() => {
            dispatch({ type: "stance", stance: stagedStance });
            setSheet("none");
          }}
          onTags={(tags) => dispatch({ type: "tags", tags })}
          onReferences={(references) => dispatch({ type: "references", references })}
          onSign={() => void submit()}
          onBack={() => dispatch({ type: "back" })}
          onRestoreKey={() => router.push("/restore")}
        />
      )}

      {/* Mounted at the flow level, keyed by ASSET ID rather than index, so a
          removal under an open sheet cannot silently describe another picture.
          One picture at a time: comments have no in-sheet stepping. */}
      <DescribeSheet
        open={describing !== null}
        onClose={() => setDescribing(null)}
        src={describing === null ? null : (previews[describing] ?? null)}
        crop={state.media.find((asset) => asset.id === describing)?.crop ?? null}
        value={state.media.find((asset) => asset.id === describing)?.altText ?? ""}
        onChange={(altText) => {
          if (describing !== null) dispatch({ type: "altText", id: describing, altText });
        }}
        position={{
          index: state.media.findIndex((asset) => asset.id === describing),
          total: state.media.length,
        }}
        testId="reply-describe-sheet"
      />

      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help ?? HELP_TOPICS.signedActions}
        testId="reply-help-dialog"
      />

      <DiscardConfirm
        open={confirmingDiscard}
        onKeepWriting={() => setConfirmingDiscard(false)}
        onDiscard={() => {
          setConfirmingDiscard(false);
          onLeave();
        }}
        testId="reply-discard-confirm"
      />
    </div>
  );
}

/**
 * What the thread hands the wizard when Reply is pressed on a comment.
 *
 * Typed on what a target actually needs rather than on `CommentView`, because
 * the affordance sits on nested replies too and a reply node carries no
 * `replies` of its own.
 */
export function commentTarget(comment: {
  id: string;
  content: { value?: string | null };
  author?: {
    handle: string;
    displayName: { value?: string | null };
    avatar?: { url: string } | null;
  } | null;
}): ReplyTarget {
  const name = comment.author?.displayName?.value?.trim();
  const handle = comment.author?.handle ?? "";
  return {
    id: comment.id,
    kind: "comment",
    label: name && name !== "" ? name : handle,
    authorHandle: handle,
    authorName: name && name !== "" ? name : handle,
    avatarUrl: comment.author?.avatar?.url ?? null,
    snippet: comment.content.value ?? "",
  };
}
