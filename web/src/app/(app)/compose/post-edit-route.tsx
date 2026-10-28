"use client";

// The post edit's controller: the read, the batch, the uploads the edit takes,
// and the one signing pass. The surface is `post-edit-view.tsx`; the state and
// its law are `lib/compose/post-edit.ts`, `lib/compose/comment-edit.ts` (the
// edit gallery) and `lib/compose/edit-batch.ts`.
//
// PREPARES EVERYTHING BEFORE SIGNING ANYTHING: a refusal on the third tag must
// not leave the first two signed, and staged writes nobody signs are the
// server's own GC to collect. The whole batch then goes through one signing
// pass, so the edit either stages everything or nothing.
//
// NOTHING SIGNS BEFORE THE BYTES EXIST. The pictures the edit adds and a clip's
// new face upload from the moment their crop is done; a press of Sign while
// they run is HELD and signs the moment the last lands, and a failure drops
// it (EditCompose.md; the seal's grammar, ComposeSealUploading.md). Both
// clocks — the 200ms label swap and the 5s slow line — count from the press.
//
// THE CROPS ARE SCREENS OF THEIR OWN, raised from the edit and handing back to
// it: `ComposeCrop` locked to the post's one shape for added pictures, and
// `CoverCrop` locked to the clip's for its face. Their back arrow returns to
// the edit with the picture unused; their X is the edit's own X, asking first
// where the batch holds an act (ComposeCrop.md, CoverCrop.md).

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchPostBacking,
  fetchPostDetail,
  preparePostEdit,
} from "@/lib/api/content-api";
import { prepareTag } from "@/lib/api/topics-api";
import { prepareReference, prepareReferenceWithdrawal } from "@/lib/api/references-api";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { fetchGraphIds, graphIdOf } from "@/lib/api/graph-ids-api";
import { fetchKnownMedia } from "@/lib/api/media-api";
import { editExpectation } from "@/lib/compose/intent";
import { contentExpectation } from "@/lib/compose/payload-expectation";
import { postEdit, type ExpectedWrite } from "@/lib/signing/intent";
import { firstRefusalMessage } from "@/lib/ui/error-messages";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { RestoreCard } from "@/app/applicant-status";
import { TransportError } from "@/lib/ui/transport-error";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { useWaitedPast, SLOW_NETWORK_MS } from "@/lib/ui2/waiting-commit";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { DiscardConfirm } from "@/lib/ui2/compose/discard-confirm";
import { PickedSheet } from "@/lib/ui2/compose/picked-sheet";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { ActsSheet } from "@/lib/ui2/compose/edit-acts";
import { BackingEditPad } from "@/lib/ui2/compose/backing-edit-pad";
import { CoverCrop } from "@/lib/ui2/compose/cover-crop";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { CENTERED, type Crop } from "@/lib/ui2/media/crop";
import type { PostShape } from "@/lib/ui2/media/aspect";
import { signedValues } from "@/lib/topics/draft";
import { usePreviewUrls } from "@/lib/compose/previews";
import { newComposeId } from "@/lib/compose/ids";
import { POST_SCALE, screenPick, VIDEO_AT_EDIT, type PickRefusal } from "@/lib/compose/pick";
import { runUpload } from "@/lib/compose/uploads";
import type { PickedAsset } from "@/lib/compose/wizard";
import {
  addedLedger,
  clipOf,
  editClaims,
  editUploads,
  keptMediaIds,
  keptPreviews,
  pictureAltText,
  pictureId,
  uploadsFailed,
  uploadsPending,
} from "@/lib/compose/comment-edit";
import {
  editActCount,
  editActRows,
  stagedChanges,
  undoReferenceWithdrawal,
  undoTagWithdrawal,
} from "@/lib/compose/edit-batch";
import {
  coverRatio,
  isClipBody,
  postEditInput,
  postEditOf,
  postEditProblem,
  postEditReducer,
  recordName,
  uploadRatio,
  type PostEditAction,
  type PostEditState,
} from "@/lib/compose/post-edit";
import { EDIT_LEAVE_LABEL, PostEditView } from "./post-edit-view";
import { CropStep } from "./wizard/crop-step";

/** How long a signing may go unanswered before the foot says the network is slow. */
export const SLOW_SIGNING_MS = SLOW_NETWORK_MS;

type Loaded =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "missing" }
  | { kind: "ready" };

/** A crop raised over the edit: pictures on their way in, or a face for the clip. */
type Cropping =
  | {
      readonly kind: "pictures";
      readonly assets: readonly PickedAsset[];
      readonly focused: number;
      readonly shape: PostShape;
      /** The post's one shape stands, so no chip is offered (ComposeCrop.md). */
      readonly locked: boolean;
    }
  | { readonly kind: "cover"; readonly asset: PickedAsset };

function reducer(state: PostEditState | null, action: PostEditAction | { type: "load"; state: PostEditState }) {
  if (action.type === "load") return action.state;
  return state === null ? null : postEditReducer(state, action);
}

/** A picked file as an asset the crop can frame: centred, undescribed, not yet uploading. */
function pickedAsset(file: File): PickedAsset {
  return {
    id: newComposeId(),
    file,
    crop: CENTERED,
    altText: "",
    upload: { kind: "waiting" },
    kind: "picture",
  };
}

export function PostEditRoute({
  postId,
  store = identityStore,
}: {
  postId: string;
  /** Test injection. */
  store?: IdentityStore;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const router = useRouter();
  const keyOnDevice = useKeyOnDevice(store);

  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [state, dispatch] = useReducer(reducer, null);
  const [busy, setBusy] = useState(false);
  // A press made while the edit's uploads still run is HELD and signs the
  // moment the last one lands (EditCompose.md).
  const [held, setHeld] = useState(false);
  const signing = busy || held;
  const slow = useWaitedPast(signing, SLOW_SIGNING_MS);
  const [countChanged, setCountChanged] = useState(false);
  const [writeRuleRefused, setWriteRuleRefused] = useState(false);
  const [keyAbsent, setKeyAbsent] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>({});
  const [sheet, setSheet] = useState<"acts" | "pictures" | "sensitive" | "backing" | null>(null);
  // The raw sum of the author's Publish records toward the post — what the
  // backing row and pad read. Null when the read answered none or failed
  // (`fetchPostBacking`): the readouts then stand unread.
  const [backingRawSum, setBackingRawSum] = useState<number | null>(null);
  const [describing, setDescribing] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  // `Discard the changes?` stands over the edit (DiscardConfirm.md).
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Files the add control turned away, standing on the media row until dismissed.
  const [refusals, setRefusals] = useState<readonly PickRefusal[]>([]);
  const [cropping, setCropping] = useState<Cropping | null>(null);
  // Which uploads have been started, so a re-render never starts one twice
  // and React's double mount in development never sends the bytes twice.
  const started = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    // The backing is read beside the post and the edit opens once both have
    // answered, so the readouts never flash unread while the read is in
    // flight. It never stands in the edit's way: a backing read that fails or
    // serves nothing leaves the readouts unread, and the edit opens anyway.
    // Viewer-scoped, so it rides the guard: a token that expired mid-session
    // refreshes and replays instead of reading as no backing at all.
    void Promise.all([
      fetchPostDetail(client, postId),
      guard.run(() => fetchPostBacking(client, postId)),
    ]).then(([outcome, backing]) => {
      if (cancelled) return;
      if (outcome.kind !== "success") setLoaded({ kind: "failed" });
      else if (outcome.value === null) setLoaded({ kind: "missing" });
      else {
        setBackingRawSum(
          backing.kind === "success" && backing.value !== null ? backing.value.rawSum : null,
        );
        dispatch({ type: "load", state: postEditOf(outcome.value.post) });
        setLoaded({ kind: "ready" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard, postId]);

  const rows = useMemo(
    () =>
      state === null
        ? []
        : editActRows({
            recordStaged: state.recordStaged,
            recordName: recordName(state),
            loadedTags: state.loadedTags,
            tags: state.tags,
            loadedReferences: state.loadedReferences,
            references: state.references,
          }),
    [state],
  );
  const count = editActCount(rows);

  // ---- the uploads the edit takes -------------------------------------------

  const uploads = useMemo(() => (state === null ? [] : editUploads(state.gallery)), [state]);
  // The bytes on screen: what the edit took, and what a crop is framing now.
  const local = useMemo(
    () =>
      cropping === null
        ? uploads
        : [...uploads, ...(cropping.kind === "pictures" ? cropping.assets : [cropping.asset])],
    [uploads, cropping],
  );
  const localPreviews = usePreviewUrls(local);
  const previews = useMemo(
    () => (state === null ? localPreviews : { ...keptPreviews(state.gallery), ...localPreviews }),
    [state, localPreviews],
  );

  useEffect(() => {
    if (state === null) return;
    for (const asset of uploads) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      started.current.add(asset.id);
      void runUpload(client, guard, asset, uploadRatio(state, asset.id), (upload) =>
        dispatch({ type: "upload", id: asset.id, upload }),
      );
    }
  }, [uploads, state, client, guard]);

  const pendingUploads = state === null ? 0 : uploadsPending(state.gallery);
  const failedUploads = state === null ? 0 : uploadsFailed(state.gallery);
  // A failure drops the held press during render, the state an upload's own
  // outcome leaves behind (React, "adjusting some state when a prop changes"):
  // the commit reads its resting label, the ways out answer, nothing signs.
  if (held && failedUploads > 0) setHeld(false);

  const back = () => router.push(`/posts/${postId}`);
  // THE EDIT KEEPS NO DRAFT, so the way out reads the acts batch — the same
  // count the sign guard reads, never a byte comparison: an empty batch leaves
  // at once, and a batch holding an act is asked before anything is discarded
  // (EditCompose.md, DiscardConfirm.md). A crop's X is this same X.
  const leave = () => {
    if (signing) return;
    if (count === 0) back();
    else setConfirmingDiscard(true);
  };

  const submit = async () => {
    if (state === null) return;
    setBusy(true);
    setHeld(false);
    const end = () => setBusy(false);

    // The L1 ids of the post and of every cited node the edit touches,
    // read before anything is staged: the batch is checked against them,
    // and against the acts card, before its first pre-signature (intent.ts).
    const touched = stagedChanges({
      recordStaged: state.recordStaged,
      recordName: "",
      loadedTags: state.loadedTags,
      tags: state.tags,
      loadedReferences: state.loadedReferences,
      references: state.references,
    });
    const graphIds = await guard.run(() =>
      fetchGraphIds(client, [
        postId,
        ...touched.references.map((change) => change.reference.targetId),
      ]),
    );
    if (graphIds.kind !== "success") {
      end();
      setFailed(true);
      return;
    }
    const postGraphId = graphIdOf(graphIds.value, postId);
    // The record's payload is complete state: every carried-over placement
    // is held to the digests of the asset it names, read back by id, since
    // no gallery read selects them; the bytes the edit uploaded are held to
    // the digests this device computed (payload-expectation.ts).
    const sent = postEditInput(state);
    let record: ExpectedWrite | null = null;
    if (state.recordStaged) {
      const known = await guard.run(() => fetchKnownMedia(client, keptMediaIds(state.gallery)));
      if (known.kind !== "success") {
        end();
        setFailed(true);
        return;
      }
      const ledger = new Map([...known.value, ...addedLedger(state.gallery)]);
      // The pick on screen is the pick the batch is checked against.
      record = postEdit(postGraphId, contentExpectation(postId, sent, "post", ledger), sent.pDirected);
    }
    const expected = editExpectation(postGraphId, record, touched, graphIds.value);

    const writes: StagedWriteView[] = [];
    const perTag: Record<number, string> = {};
    const perReference: Record<number, string> = {};
    let general: string | null = null;
    let writeRule = false;
    const refused = (errors: Parameters<typeof firstRefusalMessage>[0]) => {
      if (errors.some((error) => error.code === "WRITE_RULE_FAILED")) writeRule = true;
      return firstRefusalMessage(errors, "The server refused this write.");
    };

    if (state.recordStaged) {
      const prepared = await guard.run(() => preparePostEdit(client, sent));
      if (prepared.kind === "failed") {
        end();
        setFailed(true);
        return;
      }
      if (prepared.kind === "refused") general = refused(prepared.errors);
      else writes.push(...prepared.value.writes);
    }

    for (const change of touched.tags) {
      const prepared = await guard.run(() =>
        prepareTag(client, {
          target: postId,
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
        const message = refused(prepared.errors);
        const index =
          change.kind === "tag" ? state.tags.findIndex((tag) => tag.name === change.tag.name) : -1;
        if (index >= 0) perTag[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }
    for (const change of touched.references) {
      const prepared = await guard.run(() =>
        change.kind === "reference"
          ? prepareReference(client, {
              artifact: postId,
              target: change.reference.targetId,
              relevance: change.reference.relevance,
              support: change.reference.support,
            })
          : prepareReferenceWithdrawal(client, {
              artifact: postId,
              target: change.reference.targetId,
            }),
      );
      if (prepared.kind === "failed") {
        end();
        setFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        const message = refused(prepared.errors);
        const index =
          change.kind === "reference"
            ? state.references.findIndex(
                (reference) => reference.targetId === change.reference.targetId,
              )
            : -1;
        if (index >= 0) perReference[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    if (writeRule) {
      end();
      setWriteRuleRefused(true);
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
    // signed: the held press drops and the foot says so (EditCompose.md).
    if (writes.length !== count) {
      end();
      setCountChanged(true);
      return;
    }

    const results = await signer.sign(writes, expected);
    end();
    if (results.every((result) => result.kind === "done")) {
      // The post opens with the edit settling.
      router.push(`/posts/${postId}`);
    } else {
      setFailed(true);
    }
  };

  // Signing is the side effect: the last upload landing releases the held
  // press into `submit`, which takes it over as `busy` (it clears `held`). It
  // starts as a task of its own, as the network answer it waits on is.
  useEffect(() => {
    if (!held || pendingUploads > 0 || failedUploads > 0) return;
    const release = setTimeout(() => void submit(), 0);
    return () => clearTimeout(release);
    // `submit` reads the state it is handed this render; the press is the
    // trigger, and the upload counts are what release it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, pendingUploads, failedUploads]);

  if (loaded.kind === "loading" || state === null) {
    if (loaded.kind === "failed") {
      return (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
          <TransportError testId="post-edit-load-failed" />
        </main>
      );
    }
    if (loaded.kind === "missing") {
      return (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
          <p role="alert" data-testid="post-edit-not-found">
            This post no longer resolves.
          </p>
        </main>
      );
    }
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        <p>Loading…</p>
      </main>
    );
  }

  const press = async () => {
    if (signing || count === 0 || postEditProblem(state) !== null || failedUploads > 0) return;
    setCountChanged(false);
    setRefusal(null);
    setFailed(false);
    setTagErrors({});
    setReferenceErrors({});
    // THE KEY-ABSENT SEAL: nothing is staged or signed without the key.
    if (keyOnDevice === false || (await store.actorKey()) === null) {
      setKeyAbsent(true);
      return;
    }
    // NOTHING SIGNS BEFORE THE LAST BYTE LANDS: the press is held, and the
    // effect above releases it (EditCompose.md).
    if (uploadsPending(state.gallery) > 0 || editClaims(state.gallery) === null) setHeld(true);
    else void submit();
  };

  const retryUploads = () => {
    for (const asset of editUploads(state.gallery)) {
      if (asset.upload.kind !== "failed") continue;
      started.current.delete(asset.id);
      dispatch({ type: "upload", id: asset.id, upload: { kind: "waiting" } });
    }
  };

  // `+ Add pictures` / `+ Add pictures or a video`: the batch is screened
  // file by file against the body it would join — the cap of ten, the
  // pictures-or-one-video grammar, the formats nothing here reads — and what
  // is refused says why on the media row, never in a dialog (EditCompose.md).
  const addMedia = async (files: readonly File[]) => {
    const outcome = await screenPick(
      files,
      { hasVideo: isClipBody(state), count: state.gallery.length },
      POST_SCALE,
    );
    if (outcome.refusals.length > 0) setRefusals((current) => [...current, ...outcome.refusals]);
    if (outcome.accepted.length === 0) return;
    if (outcome.kind === "video") {
      // THE WORDS EDIT'S VIDEO PATH IS NOT BUILT (EditWords.md: "its face is
      // chosen on the cover step before the edit takes it") — said on the row
      // rather than taken half-way. Named in the lane report.
      setRefusals((current) => [
        ...current,
        ...outcome.accepted.map((file) => ({
          id: newComposeId(),
          name: file.name,
          reason: VIDEO_AT_EDIT,
          file,
        })),
      ]);
      return;
    }
    setCropping({
      kind: "pictures",
      assets: outcome.accepted.map(pickedAsset),
      focused: 0,
      shape: state.shape ?? "tall",
      locked: state.shape !== null,
    });
  };

  const describingPicture =
    describing === null ? undefined : state.gallery.find((picture) => pictureId(picture) === describing);
  const clip = clipOf(state.gallery);

  const cropScreen =
    cropping === null ? null : (
      <main
        data-testid={cropping.kind === "pictures" ? "post-edit-crop" : "post-edit-cover-crop"}
        className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-surface text-on-surface"
      >
        <HeaderBar
          title={cropping.kind === "pictures" ? "Crop" : "The cover"}
          // One stage back: the edit as it was left, the pictures unused.
          backLabel="Back to the edit"
          onBack={() => setCropping(null)}
          onLeave={leave}
          leaveLabel={EDIT_LEAVE_LABEL}
          testId="post-edit-crop-header"
          // The registered ComposeCrop and CoverCrop screens name their band.
          node={{ path: cropping.kind === "pictures" ? "composeCrop.header" : "coverCrop.header" }}
        />
        {cropping.kind === "pictures" ? (
          <CropStep
            assets={cropping.assets}
            previews={previews}
            shape={cropping.shape}
            locked={cropping.locked}
            focused={cropping.focused}
            onShape={(shape) => setCropping({ ...cropping, shape })}
            onFocus={(focused) => setCropping({ ...cropping, focused })}
            onCrop={(id, crop: Crop) =>
              setCropping({
                ...cropping,
                assets: cropping.assets.map((asset) => (asset.id === id ? { ...asset, crop } : asset)),
              })
            }
            onNext={() => {
              // The edit comes back with the pictures on its row, and their
              // cropped exports start uploading (ComposeCrop.md).
              dispatch({ type: "addPictures", assets: cropping.assets, shape: cropping.shape });
              setCropping(null);
            }}
            testIdPrefix="post-edit"
            node={{ path: "composeCrop" }}
          />
        ) : (
          <CoverCrop
            src={previews[cropping.asset.id] ?? ""}
            ratio={coverRatio(clip?.ratio ?? null)}
            crop={cropping.asset.crop}
            onCrop={(crop) => setCropping({ kind: "cover", asset: { ...cropping.asset, crop } })}
            onNext={() => {
              // The cover is set, and the cover row that asked for it is back
              // (CoverCrop.md): its cropped export starts uploading.
              dispatch({ type: "cover", cover: cropping.asset });
              setCropping(null);
            }}
            testIdPrefix="post-edit"
          />
        )}
      </main>
    );

  return (
    <>
      {cropScreen ?? (
        <PostEditView
          state={state}
          previews={previews}
          count={count}
          tagErrors={tagErrors}
          referenceErrors={referenceErrors}
          busy={busy}
          held={held}
          slow={slow}
          countChanged={countChanged}
          writeRuleRefused={writeRuleRefused}
          keyAbsent={keyAbsent}
          refusal={refusal}
          failed={failed}
          refusals={refusals}
          onTitle={(title) => dispatch({ type: "title", title })}
          onDescription={(description) => dispatch({ type: "description", description })}
          onWords={(words) => dispatch({ type: "words", words })}
          onTags={(tags) => dispatch({ type: "tags", tags })}
          onReferences={(references) => dispatch({ type: "references", references })}
          onUndoTag={(name) =>
            dispatch({ type: "tags", tags: undoTagWithdrawal(state.loadedTags, state.tags, name) })
          }
          onUndoReference={(targetId) =>
            dispatch({
              type: "references",
              references: undoReferenceWithdrawal(state.loadedReferences, state.references, targetId),
            })
          }
          onManagePictures={() => setSheet("pictures")}
          onAddMedia={(files) => void addMedia(files)}
          onDismissRefusal={(id) => setRefusals((current) => current.filter((one) => one.id !== id))}
          onRetryUploads={retryUploads}
          onRemoveFailed={() => {
            for (const asset of editUploads(state.gallery)) {
              if (asset.upload.kind === "failed") dispatch({ type: "removePicture", id: asset.id });
            }
          }}
          onRemoveClip={() => {
            if (clip !== undefined) dispatch({ type: "removePicture", id: clip.mediaId });
          }}
          onDescribeClip={() => {
            if (clip !== undefined) setDescribing(clip.mediaId);
          }}
          onPickCover={(file) => setCropping({ kind: "cover", asset: pickedAsset(file) })}
          onRemoveCover={() => dispatch({ type: "cover", cover: null })}
          onOpenSensitive={() => setSheet("sensitive")}
          backingRawSum={backingRawSum}
          onOpenBacking={() => setSheet("backing")}
          onOpenActs={() => setSheet("acts")}
          onHelp={() => setHelp(HELP_TOPICS.editing)}
          onWriteRuleHelp={() => setHelp(HELP_TOPICS.whySigningWaitsAtEdit)}
          onWriteRuleNotNow={() => setWriteRuleRefused(false)}
          onSign={() => void press()}
          onLeave={leave}
          keyCard={<RestoreCard />}
        />
      )}
      {/* Discard keeps nothing: the edit's state lives in this route alone, and
          leaving unmounts it — the post stands as it was. */}
      <DiscardConfirm
        open={confirmingDiscard}
        subject="edit"
        onKeepWriting={() => setConfirmingDiscard(false)}
        onDiscard={() => {
          setConfirmingDiscard(false);
          back();
        }}
        testId="post-edit-discard-confirm"
      />
      <ActsSheet open={sheet === "acts"} rows={rows} onClose={() => setSheet(null)} testId="post-edit-acts" />
      {/* EditPad: mounted per opening, so it opens at the edit's own pick and
          Cancel has nothing to put back. Set stages the pick; nothing signs
          before Sign the edit, and a Set at 0.00 asks nothing (EditPad.md). */}
      {sheet === "backing" && (
        <BackingEditPad
          open
          pick={state.pick}
          rawSum={backingRawSum}
          onSet={(pick) => {
            dispatch({ type: "pick", pick });
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
          onHelp={() => setHelp(HELP_TOPICS.yourBackingOnYourPost)}
          testId="post-edit-backing-pad"
        />
      )}
      <PickedSheet
        open={sheet === "pictures"}
        onClose={() => setSheet(null)}
        items={state.gallery.map((picture) => ({
          id: pictureId(picture),
          src: previews[pictureId(picture)] ?? null,
          altText: pictureAltText(picture),
          described: pictureAltText(picture).trim() !== "",
        }))}
        onDescribe={(id) => setDescribing(id)}
        onRemove={(id) => {
          // The last picture leaving closes the sheet onto the words edit.
          if (state.gallery.length === 1) setSheet(null);
          dispatch({ type: "removePicture", id });
        }}
        onMove={(from, to) => dispatch({ type: "movePicture", from, to })}
        testId="post-edit-picked-sheet"
      />
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
        value={describingPicture === undefined ? "" : pictureAltText(describingPicture)}
        onChange={(altText) => {
          if (describing !== null) dispatch({ type: "describe", id: describing, altText });
        }}
        video={describingPicture?.kind === "kept" && describingPicture.video}
        testId="post-edit-describe"
      />
      <SensitiveSheet
        open={sheet === "sensitive"}
        reason={state.sensitiveReason}
        onDone={(next) => {
          dispatch({ type: "sensitive", sensitive: next.sensitive });
          dispatch({ type: "sensitiveReason", reason: next.sensitiveReason });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        onHelp={() => setHelp(HELP_TOPICS.markingAsSensitive)}
        testIdPrefix="post-edit"
      />
      {help && <HelpDialog open topic={help} onClose={() => setHelp(null)} testId="post-edit-help" />}
    </>
  );
}
