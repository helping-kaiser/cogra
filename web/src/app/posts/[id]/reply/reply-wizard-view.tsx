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
import { writeRefusalMessage } from "@/lib/ui/error-messages";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { fetchGraphIds, graphIdOf } from "@/lib/api/graph-ids-api";
import { commentExpectation } from "@/lib/compose/intent";
import type { Expectation } from "@/lib/signing/intent";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { useStageHistory } from "@/lib/compose/stage-history";
import { runUpload, runVideoUpload } from "@/lib/compose/uploads";
import { useObjectUrl, usePreviewUrls, useRevokeOnChange } from "@/lib/compose/previews";
import { commentAttachmentClaims, commentMediaLedger } from "@/lib/compose/comment-media";
import { contentExpectation } from "@/lib/compose/payload-expectation";
import { COMMENT_SCALE, screenPick, type PickRefusal } from "@/lib/compose/pick";
import { captureFrames, captureFrameZero, probeVideo } from "@/lib/ui2/media/video";
import {
  advanceGate,
  commentBodyProblem,
  emptyReply,
  isVideoReply,
  replyHasContent,
  replyReducer,
  sealClosed,
  sealUploads,
  stepIndex,
  type ReplyAction,
  type ReplyState,
  type ReplyTarget,
} from "@/lib/compose/reply-wizard";
import type { StancePair } from "@/lib/stance/model";
import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { HelpDot } from "@/lib/ui2/help-dot";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { DiscardConfirm } from "@/lib/ui2/compose/discard-confirm";
import { ReferencePicker } from "@/lib/ui2/compose/reference-picker";
import { TagPicker } from "@/lib/ui2/compose/tag-picker";
import { COVER_FROM_PICTURE, effectiveCover } from "@/lib/compose/wizard";
import { sealFaultOf, type SealFault } from "@/lib/compose/seal-fault";
import { SLOW_NETWORK_MS, useSlowAnswer, useWaitedPast } from "@/lib/ui2/waiting-commit";
import { ReplyComposeStep } from "./reply-compose-step";
import { ReplySealStep, type ReplySheet } from "./reply-seal-step";

/**
 * The leave label, as every reply board's `WizardHeader` spells it. Nothing is
 * kept — there are no comment drafts — and the confirm is what stands between
 * the author and that fact when they have written something.
 */
export const LEAVE_LABEL = "Leave — the reply is discarded";

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

  // A modal dialog over the surface that raised it, so it announces itself as
  // one: the stage beneath it is suspended while it is up (Feed.md:31,
  // `covering-layer.tsx`). Mounted only while open, so it covers for as long
  // as it is mounted.
  useCoversSurface(true, "suspend");

  const [state, setState] = useState<ReplyState>(() => emptyReply(target));
  const dispatch = useCallback(
    (action: ReplyAction) => setState((current) => replyReducer(current, action)),
    [],
  );

  const [sheet, setSheet] = useState<ReplySheet>("none");
  // THE PICKERS STAND IN THE COMPOSER'S PLACE (round 27, seam 253; TagPicker.md,
  // ReferencePicker.md): `+ Add a tag` and `+ Cite something` on the seal raise
  // them, and every pick lands in the reply the moment it is made, so Done,
  // the arrow and the browser's Back have nothing left to apply.
  const [picking, setPicking] = useState<"tags" | "references" | null>(null);
  // The pad's own pick, staged until Set — Cancel and the scrim stage nothing.
  const [stagedStance, setStagedStance] = useState<StancePair>(state.stance);
  const [describing, setDescribing] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const [busy, setBusy] = useState(false);
  // A press made while the reply's bytes still move is HELD and signs the
  // moment the last one lands (ReplySealUploading.md:9-15); the commit is
  // inert from the press either way, and both clocks count from it.
  const [held, setHeld] = useState(false);
  const signing = busy || held;
  const swapped = useSlowAnswer(signing);
  const slow = useWaitedPast(signing, SLOW_NETWORK_MS);
  // What became of the last press, when it did not leave the seal (`SealFault`).
  const [fault, setFault] = useState<SealFault | null>(null);
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
  // The describe sheet's own preview: a clip shows its cover frame, the same
  // face the composer's tile wears, never the clip's own undecoded bytes.
  const coverPreview = useObjectUrl(cover?.file ?? null);

  // ---- the clip's length, and the faces it offers ---------------------------

  const [probed, setProbed] = useState<{ file: Blob; durationMs: number } | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const mine = captured !== null && captured.file === videoFile ? captured : null;
  const durationMs = probed !== null && probed.file === videoFile ? probed.durationMs : 0;
  const framePreviews = mine?.urls ?? NO_URLS;
  const capturing = videoFile !== null && captured?.file !== videoFile;
  useRevokeOnChange(framePreviews);
  // THE SILENT STILL'S OWN EXTRACTION, kept apart from the row's offers
  // above. FRAME 1 MEANS FRAME 0, STRICTLY (jakob, 2026-09-24): a coverless
  // clip's stored face is `captureFrameZero`'s read of the clip's true
  // start, never `frames[0]` — which stays the row's ~1s "opening" tile.
  const [silentCover, setSilentCover] = useState<{ file: Blob; frame: Blob | null } | null>(null);
  const forSilentCover = silentCover !== null && silentCover.file === videoFile ? silentCover : null;
  const silentCovering = videoFile !== null && forSilentCover === null;
  // THE PREVIEW FACE IS THE STORED FACE (jakob 2026-09-24, backlog item 106),
  // and THE RULE HOLDS AT BOTH SCALES (readme §13, same date): the composer
  // tile's face is this frame 0 always, never `framePreviews[0]` — the row's
  // own ~1s "opening" offer — and never displaced by a chosen cover, which
  // instead rides the tile as `CommentAttachments`' ringed inset. The
  // describe sheet below is a different, deliberately drawn scale
  // (ComposeDescribeVideo: "the cover ... is the video's face") and keeps
  // showing the chosen cover in place of `clipFace` there.
  const clipFace = useObjectUrl(forSilentCover?.frame ?? null);

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
        // EXTRACTION OFFERS; IT NEVER CHOOSES — the row grows its offers
        // and the author's (non-)choice stands untouched.
      })
      .catch(() => {
        // No frames is a state the row draws: "A picture" still works, and a
        // clip that never found a face goes up without one.
        if (!cancelled) setCaptured({ file: videoFile, frames: NO_FRAMES, urls: NO_URLS });
      });
    return () => {
      cancelled = true;
    };
  }, [videoFile, captured, dispatch]);

  // A SECOND, INDEPENDENT EXTRACTION for the silent still alone — never tied
  // to the row's capture above, so retiming the row's offers can never
  // retime what a coverless clip stores (`captureFrameZero`'s own docblock).
  useEffect(() => {
    if (videoFile === null || silentCover?.file === videoFile) return;
    let cancelled = false;
    void captureFrameZero(videoFile)
      .then((frame) => {
        if (!cancelled) setSilentCover({ file: videoFile, frame });
      })
      .catch(() => {
        if (!cancelled) setSilentCover({ file: videoFile, frame: null });
      });
    return () => {
      cancelled = true;
    };
  }, [videoFile, silentCover]);

  // THE UPLOADS WAIT FOR BOTH CAPTURES TO SETTLE, NOT FOR A COVER TO EXIST,
  // and the difference is the whole bug. A comment's face is taken off the
  // clip the moment it lands, so `cover === null` means one of two opposite
  // things — the extractions are still running, or they found nothing.
  // Read as "not ready" it is right once and wrong forever after: a clip
  // whose capture found nothing sat at "waiting" with no message and no
  // retry. `capturing`/`silentCovering` are the questions actually being
  // asked, and each answers false either way.
  useEffect(() => {
    if (video !== undefined) {
      if (
        capturing ||
        silentCovering ||
        video.upload.kind !== "waiting" ||
        started.current.has(video.id)
      ) {
        return;
      }

      // THE STORED FRAME, NOT A CHOICE (the feed-video rulings, 2026-09-23,
      // sharpened 2026-09-24). Nothing was picked and the silent extraction
      // has already settled (the guard above), so before this clip goes up
      // faceless it gets one chance to fill from its own frame 0, through
      // the same cover leg a chosen face would ride. Deciding only while
      // `autoCover` is still null is what tells "never tried" from "tried
      // and failed".
      if (cover === null && state.autoCover === null) {
        const frame = forSilentCover?.frame ?? undefined;
        if (frame !== undefined) {
          // THE RULE IS DISABLED DELIBERATELY, as `previews.ts` already does:
          // the capture is an external system, and its settled frame set is
          // exactly what this reads — there is no render-time or event-handler
          // moment that could make this decision instead.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          dispatch({
            type: "autoCover",
            cover: { id: crypto.randomUUID(), file: frame, frame: 0, upload: { kind: "waiting" } },
          });
          return;
        }
        // No frames came back at all: falls through and uploads faceless,
        // exactly as an author-skipped cover always has.
      }

      const effective = effectiveCover(cover, state.autoCover);
      started.current.add(video.id);
      if (effective !== null) started.current.add(effective.id);
      void runVideoUpload(
        client,
        guard,
        video,
        effective,
        (upload) => dispatch({ type: "upload", id: video.id, upload }),
        // The auto-cover has no row of its own to watch it, so its steps land
        // on `autoCoverUpload` — never on `coverUpload`, which is what the
        // (nonexistent) chosen-cover UI would read.
        (upload) => dispatch({ type: cover !== null ? "coverUpload" : "autoCoverUpload", upload }),
        COMMENT_SCALE,
      );
      return;
    }
    for (const asset of state.media) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      started.current.add(asset.id);
      // No ratio: a comment's pictures keep their own shape.
      void runUpload(client, guard, asset, undefined, (upload) =>
        dispatch({ type: "upload", id: asset.id, upload }),
      );
    }
  }, [
    state.media,
    video,
    cover,
    state.autoCover,
    capturing,
    silentCovering,
    forSilentCover,
    client,
    guard,
    dispatch,
  ]);

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

  /**
   * The arrow: ONE STAGE BACK, and from the first stage that is the thread —
   * which discards the comment just as the X does.
   */
  const stepBack = () => (state.step === "compose" ? leave() : back());

  /**
   * A refusal reading is the seal's answer to ONE press (SealSigning.md): going
   * a stage back, or changing a fact, shows the plain commit again until the
   * next press.
   */
  const retire = () => {
    setFault(null);
    setTagErrors({});
    setReferenceErrors({});
  };
  const back = () => {
    retire();
    dispatch({ type: "back" });
  };

  // The browser's Back is the same arrow (design/readme.md: "the platform
  // back gesture does the same"). This surface is not a route, so being OPEN
  // is an entry of its own above the thread's, and each stage past the first
  // one more: a Back press on the composer reaches the thread through the
  // arrow's own leave — asking first when something is written — rather
  // than taking the reader off the page the thread is on.
  // A picker belongs to the seal that opened it; a step back leaves it unshown.
  const pickerOpen = picking !== null && state.step === "seal";
  useStageHistory({
    surface: "reply",
    // A picker rides an entry above its stage, so the browser's Back closes it
    // the way its own arrow does (the post wizard's rule).
    level: stepIndex(state) + 1 + (pickerOpen ? 1 : 0),
    onBack: () => {
      if (pickerOpen) setPicking(null);
      else stepBack();
    },
    onForward: () => dispatch({ type: "advance" }),
  });

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
    setHeld(false);
    setTagErrors({});
    setReferenceErrors({});
    setFault(null);

    // The L1 ids of the node answered and of every cited node, read before
    // anything is staged: the batch is checked against them before its
    // first pre-signature (intent.ts).
    const graphIds = await guard.run(() =>
      fetchGraphIds(client, [
        state.target.id,
        ...state.references.map((reference) => reference.targetId),
      ]),
    );
    if (graphIds.kind !== "success") {
      setBusy(false);
      setFault({ kind: "offline" });
      return;
    }
    // One request, read twice: once by the API layer and once by the payload
    // expectation (payload-expectation.ts).
    const sent = {
      target: state.target.id,
      content: state.words,
      license: state.license,
      tags: state.tags,
      references: state.references,
      attachments: commentAttachmentClaims(state.media, state.cover, state.autoCover) ?? undefined,
      stance: state.stance,
      sensitive: state.sensitive,
      sensitiveReason: state.sensitiveReason,
    };
    const prepared = await guard.run(() => prepareComment(client, sent));

    if (prepared.kind === "failed") {
      setBusy(false);
      setFault({ kind: "offline" });
      return;
    }
    if (prepared.kind === "refused") {
      setBusy(false);
      // A refusal at prepare stages nothing, and the seal says it where it
      // stands (the post seal's failure pack, at comment scale): the write
      // rule's notice, or a cited post that never landed on its own row
      // (ReplySeal.md:21, ReplySealComment.md:9).
      const read = sealFaultOf(prepared.errors, state.references);
      if (read.kind !== "bug") {
        setFault(read);
        return;
      }
      // A tag or citation the server named by its place is said on its own
      // acts-card row with `Remove it` (`ActsCard`'s fault row) — no line at
      // the foot, the commit staying. Anything else is the bug notice.
      const partition = partitionFieldErrors(prepared.errors, (error) =>
        writeRefusalMessage(error.code),
      );
      if (hasFieldErrors(partition)) {
        setTagErrors(partition.perTag);
        setReferenceErrors(partition.perReference);
        return;
      }
      setFault(read);
      return;
    }

    const node = prepared.value.node;
    const expected = commentExpectation(
      graphIdOf(graphIds.value, state.target.id),
      state,
      contentExpectation(
        node,
        sent,
        "comment",
        commentMediaLedger(state.media, state.cover, state.autoCover),
      ),
      graphIds.value,
    );
    await finish(node, prepared.value.writes, expected);
  };

  const finish = async (
    node: string,
    writes: readonly StagedWriteView[],
    expected: Expectation,
  ) => {
    const results = await signer.sign(writes, expected);
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
    if (refused === undefined || refused.kind !== "refused") {
      // No answer reached the seal: the fault line and Retry, in the foot.
      setFault({ kind: "offline" });
      return;
    }
    // The write rule's notice; a cited post that never landed, on its row; any
    // other refused act, whose target landed, the bug notice
    // (ReplySealComment.md:9-11).
    setFault(sealFaultOf(refused.errors, state.references));
  };

  // ---- the gate ------------------------------------------------------------

  const uploads = sealUploads(state);
  // A HELD PRESS signs the moment the last upload lands, with no second press;
  // an upload that fails drops it, and the commit reads `Sign comment` again
  // (ReplySealUploading.md:15-17). The drop happens during render, the state
  // an upload's own outcome leaves behind (React, "adjusting some state when
  // a prop changes").
  if (held && uploads.failed > 0) setHeld(false);
  // Signing is the side effect: the last upload landing releases the press
  // into `submit`, which takes the press over as `busy` (it clears `held`).
  useEffect(() => {
    if (!held || uploads.pending > 0 || uploads.failed > 0) return;
    const release = setTimeout(() => void submit(), 0);
    return () => clearTimeout(release);
    // `submit` reads the state it is handed this render; the press is the
    // trigger, and the upload counts are what release it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, uploads.pending, uploads.failed]);

  const sign = () => {
    if (signing) return;
    if (uploads.pending > 0) setHeld(true);
    else void submit();
  };

  // The failed upload's Retry re-runs the gate; nothing signs until Sign
  // comment is pressed again (ReplySealUploading.md:19). A clip's retry takes
  // its face with it, the two going up as one sequence.
  const retryUploads = () => {
    if (video !== undefined) {
      retry(video.id);
      return;
    }
    for (const asset of state.media) {
      if (asset.upload.kind === "failed") retry(asset.id);
    }
  };

  // WHILE IT SIGNS, THE SEAL HOLDS THE READER (`ReplySeal.jsx`, jakob
  // 2026-10-01): past the label swap the header's arrow and X refuse a press
  // and keep their face, because leaving mid-sign would orphan the outcome
  // (ReplySealUploading.md:11, SealSigning.md).
  const locked = state.step === "seal" && swapped;

  // ---- the frame -----------------------------------------------------------

  const blocked = sealClosed(state);
  // The composer's own Next, gated the way PickStep/CoverStep already gate
  // the post wizard's — the reducer already refuses to advance past this
  // (`advanceGate`'s existing check), so this only makes that refusal visible.
  const composeGate = advanceGate(state);
  const title = state.step === "compose" ? "Reply" : "What you sign";

  return (
    <div
      data-testid="reply-wizard"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-40 flex flex-col bg-surface text-on-surface"
    >
      {pickerOpen ? (
        // THE PICKER IS A TASK PAGE inside the reply's dialog, with its own
        // header and foot (`TagPicker.jsx`, `ReferencePicker.jsx`): its arrow
        // reads `Back to the comment`, and the cap reads per comment.
        <div data-testid="reply-picker" className="flex min-h-0 flex-1 flex-col">
          {picking === "tags" ? (
            <TagPicker
              tags={state.tags}
              onTags={(tags) => {
                retire();
                dispatch({ type: "tags", tags });
              }}
              onDone={() => setPicking(null)}
              origin="comment"
            />
          ) : (
            <ReferencePicker
              references={state.references}
              onReferences={(references) => {
                retire();
                dispatch({ type: "references", references });
              }}
              onDone={() => setPicking(null)}
              origin="comment"
            />
          )}
        </div>
      ) : (
        <>
          <HeaderBar
            title={title}
            backLabel={state.step === "compose" ? "Back to the thread" : "Back a step"}
            // IT ASKS NOTHING, because the boards do not: every reply board carries
            // the confirm on its "X — leave" edge (via 2) and none carries it on
            // the back arrow (via 1), which is drawn as a plain cancel to
            // ReplyEntry. Followed as drawn rather than made symmetric here — but
            // the asymmetry means the arrow can still lose a written comment
            // silently, which is the exact thing the confirm exists to prevent, so
            // it is reported rather than quietly patched.
            onBack={() => {
              if (!locked) stepBack();
            }}
            onLeave={() => {
              if (!locked) leave();
            }}
            leaveLabel={LEAVE_LABEL}
            // `WizardHeader`'s own pair on the seal (`ReplySealBody`): the
            // stage's name, then the screen's one "?" as `HelpDot`.
            stageLabel={state.step === "seal" ? "Last step" : undefined}
            help={
              state.step === "seal" ? (
                <HelpDot
                  ariaLabel="How signing works"
                  onOpen={() => setHelp(HELP_TOPICS.howSigningWorks)}
                  testId="header-help"
                />
              ) : undefined
            }
          />

          {state.step === "compose" ? (
            <ReplyComposeStep
              state={state}
              previews={previews}
              framePreviews={framePreviews}
              clipFace={clipFace}
              capturing={capturing}
              durationMs={durationMs}
              refusals={refusals}
              bodyError={commentBodyProblem(state.words)}
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
              blocked={!composeGate.ok}
            />
          ) : (
            <ReplySealStep
              state={state}
              sheet={sheet}
              stagedStance={stagedStance}
              blocked={blocked}
              uploads={uploads}
              signing={signing}
              swapped={swapped}
              slow={slow}
              keyOnDevice={keyOnDevice}
              fault={fault}
              tagErrors={tagErrors}
              referenceErrors={referenceErrors}
              onSheet={(next) => {
                // Opening the pad starts it from the stance that is standing, so
                // Cancel can put it back exactly.
                if (next === "stance") setStagedStance(state.stance);
                setSheet(next);
              }}
              onLicense={(license) => {
                retire();
                dispatch({ type: "license", license });
              }}
              onStagedStance={setStagedStance}
              onSetStance={() => {
                retire();
                dispatch({ type: "stance", stance: stagedStance });
                setSheet("none");
              }}
              // A change to the staged set retires the refusal said against it:
              // its words named an item by its place, which has moved.
              onTags={(tags) => {
                retire();
                dispatch({ type: "tags", tags });
              }}
              onReferences={(references) => {
                retire();
                dispatch({ type: "references", references });
              }}
              onOpenTagPicker={() => setPicking("tags")}
              onOpenReferencePicker={() => setPicking("references")}
              onSensitive={(sensitive) => {
                retire();
                dispatch({ type: "sensitive", sensitive });
              }}
              onSensitiveReason={(reason) => dispatch({ type: "sensitiveReason", reason })}
              onSensitiveHelp={() => setHelp(HELP_TOPICS.markingAsSensitive)}
              onKeyHelp={() => setHelp(HELP_TOPICS.yourKey)}
              onSign={sign}
              onRetry={() => {
                // The same signing, asked again: Retry is the only re-send, and
                // past 200ms its slot reads the commit's own in-flight label.
                setFault(null);
                void submit();
              }}
              onRetryUploads={retryUploads}
              onWriteRuleHelp={() => setHelp(HELP_TOPICS.whySigningWaitsAtReply)}
              onNotNow={() => setFault(null)}
              // The report page Settings opens is not built on the web yet: the
              // word stands where the board draws it, as on the post seal.
              onReport={() => {}}
              onBack={back}
              onDiscard={leave}
              onRestoreKey={() => router.push("/restore")}
            />
          )}
        </>
      )}

      {/* Mounted at the flow level, keyed by ASSET ID rather than index, so a
          removal under an open sheet cannot silently describe another picture.
          One picture at a time: comments have no in-sheet stepping. */}
      <DescribeSheet
        open={describing !== null}
        onClose={() => setDescribing(null)}
        src={
          describing === null
            ? null
            : isVideoReply(state)
              ? // Out of scope for "the rule holds at both scales" (readme §13):
                // ComposeDescribeVideo draws this sheet with one face, the
                // chosen cover replacing `clipFace` outright — no ringed
                // inset at this scale.
                (coverPreview ?? clipFace)
              : (previews[describing] ?? null)
        }
        crop={state.media.find((asset) => asset.id === describing)?.crop ?? null}
        value={state.media.find((asset) => asset.id === describing)?.altText ?? ""}
        onChange={(altText) => {
          if (describing !== null) dispatch({ type: "altText", id: describing, altText });
        }}
        video={isVideoReply(state)}
        testId="reply-describe-sheet"
      />

      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help ?? HELP_TOPICS.howSigningWorks}
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
