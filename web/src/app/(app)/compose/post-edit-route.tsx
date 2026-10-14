"use client";

// The post edit's controller: the read, the batch, and the one signing pass.
// The surface is `post-edit-view.tsx`; the state and its law are
// `lib/compose/post-edit.ts` and `lib/compose/edit-batch.ts`.
//
// PREPARES EVERYTHING BEFORE SIGNING ANYTHING: a refusal on the third tag must
// not leave the first two signed, and staged writes nobody signs are the
// server's own GC to collect. The whole batch then goes through one signing
// pass, so the edit either stages everything or nothing.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchPostDetail,
  preparePostEdit,
} from "@/lib/api/content-api";
import { prepareTag } from "@/lib/api/topics-api";
import { prepareReference, prepareReferenceWithdrawal } from "@/lib/api/references-api";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { firstRefusalMessage } from "@/lib/ui/error-messages";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { RestoreCard } from "@/app/applicant-status";
import { TransportError } from "@/lib/ui/transport-error";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { PickedSheet } from "@/lib/ui2/compose/picked-sheet";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { ActsSheet } from "@/lib/ui2/compose/edit-acts";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { WITHDRAWN_RELEVANCE } from "@/lib/topics/draft";
import { keptPreviews, pictureAltText, pictureId } from "@/lib/compose/comment-edit";
import {
  editActCount,
  editActRows,
  stagedChanges,
  undoReferenceWithdrawal,
  undoTagWithdrawal,
} from "@/lib/compose/edit-batch";
import {
  postEditInput,
  postEditOf,
  postEditProblem,
  postEditReducer,
  recordName,
  type PostEditAction,
  type PostEditState,
} from "@/lib/compose/post-edit";
import { PostEditView } from "./post-edit-view";

/** How long a signing may go unanswered before the foot says the network is slow. */
export const SLOW_SIGNING_MS = 5_000;

type Loaded =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "missing" }
  | { kind: "ready" };

function reducer(state: PostEditState | null, action: PostEditAction | { type: "load"; state: PostEditState }) {
  if (action.type === "load") return action.state;
  return state === null ? null : postEditReducer(state, action);
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
  const [slow, setSlow] = useState(false);
  const [countChanged, setCountChanged] = useState(false);
  const [writeRuleRefused, setWriteRuleRefused] = useState(false);
  const [keyAbsent, setKeyAbsent] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>({});
  const [sheet, setSheet] = useState<"acts" | "pictures" | "sensitive" | null>(null);
  const [describing, setDescribing] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPostDetail(client, postId).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind !== "success") setLoaded({ kind: "failed" });
      else if (outcome.value === null) setLoaded({ kind: "missing" });
      else {
        dispatch({ type: "load", state: postEditOf(outcome.value.post) });
        setLoaded({ kind: "ready" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, postId]);

  useEffect(
    () => () => {
      if (slowTimer.current !== null) clearTimeout(slowTimer.current);
    },
    [],
  );

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
  const previews = useMemo(() => (state === null ? {} : keptPreviews(state.gallery)), [state]);

  const back = () => router.push(`/posts/${postId}`);

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

  const endSigning = () => {
    setBusy(false);
    setSlow(false);
    if (slowTimer.current !== null) {
      clearTimeout(slowTimer.current);
      slowTimer.current = null;
    }
  };

  const sign = async () => {
    if (busy || count === 0 || postEditProblem(state) !== null) return;
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
    setBusy(true);
    slowTimer.current = setTimeout(() => setSlow(true), SLOW_SIGNING_MS);

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
      const prepared = await guard.run(() => preparePostEdit(client, postEditInput(state)));
      if (prepared.kind === "failed") {
        endSigning();
        setFailed(true);
        return;
      }
      if (prepared.kind === "refused") general = refused(prepared.errors);
      else writes.push(...prepared.value.writes);
    }

    const changes = stagedChanges({
      recordStaged: state.recordStaged,
      recordName: "",
      loadedTags: state.loadedTags,
      tags: state.tags,
      loadedReferences: state.loadedReferences,
      references: state.references,
    });
    for (const change of changes.tags) {
      const prepared = await guard.run(() =>
        prepareTag(client, {
          target: postId,
          name: change.kind === "tag" ? change.tag.name : change.name,
          // Withdrawing is a Tag act at relevance 0 (hashtag.md §4).
          relevance: change.kind === "tag" ? change.tag.relevance : WITHDRAWN_RELEVANCE,
          confidence: change.kind === "tag" ? change.tag.confidence : undefined,
        }),
      );
      if (prepared.kind === "failed") {
        endSigning();
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
    for (const change of changes.references) {
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
        endSigning();
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
      endSigning();
      setWriteRuleRefused(true);
      return;
    }
    if (general !== null || Object.keys(perTag).length > 0 || Object.keys(perReference).length > 0) {
      endSigning();
      setTagErrors(perTag);
      setReferenceErrors(perReference);
      setRefusal(general);
      return;
    }
    // THE COUNT THE SIGNING PREPARED IS THE ONE THE FOOT READ, or nothing is
    // signed: the held press drops and the foot says so (EditCompose.md).
    if (writes.length !== count) {
      endSigning();
      setCountChanged(true);
      return;
    }

    const results = await signer.sign(writes);
    endSigning();
    if (results.every((result) => result.kind === "done")) {
      // The post opens with the edit settling.
      router.push(`/posts/${postId}`);
    } else {
      setFailed(true);
    }
  };

  const describingPicture =
    describing === null ? undefined : state.gallery.find((picture) => pictureId(picture) === describing);

  return (
    <>
      <PostEditView
        state={state}
        previews={previews}
        count={count}
        tagErrors={tagErrors}
        referenceErrors={referenceErrors}
        busy={busy}
        slow={slow}
        countChanged={countChanged}
        writeRuleRefused={writeRuleRefused}
        keyAbsent={keyAbsent}
        refusal={refusal}
        failed={failed}
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
        onRemoveClip={() => {
          const clip = state.gallery[0];
          if (clip !== undefined) dispatch({ type: "removePicture", id: pictureId(clip) });
        }}
        onDescribeClip={() => {
          const clip = state.gallery[0];
          if (clip !== undefined) setDescribing(pictureId(clip));
        }}
        onOpenSensitive={() => setSheet("sensitive")}
        onOpenActs={() => setSheet("acts")}
        onHelp={() => setHelp(HELP_TOPICS.editing)}
        onSign={() => void sign()}
        onBack={() => {
          if (!busy) back();
        }}
        keyCard={<RestoreCard />}
      />
      <ActsSheet open={sheet === "acts"} rows={rows} onClose={() => setSheet(null)} testId="post-edit-acts" />
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
        src={describing === null ? null : (previews[describing] ?? null)}
        value={describingPicture === undefined ? "" : pictureAltText(describingPicture)}
        onChange={(altText) => {
          if (describing !== null) dispatch({ type: "describe", id: describing, altText });
        }}
        video={describing !== null && describing in state.durations}
        testId="post-edit-describe"
      />
      <SensitiveSheet
        open={sheet === "sensitive"}
        marked={state.sensitive}
        reason={state.sensitiveReason}
        onMarked={(next) => dispatch({ type: "sensitive", sensitive: next })}
        onReason={(reason) => dispatch({ type: "sensitiveReason", reason })}
        onClose={() => setSheet(null)}
        onHelp={() => setHelp(HELP_TOPICS.markingAsSensitive)}
        testIdPrefix="post-edit"
      />
      {help && <HelpDialog open topic={help} onClose={() => setHelp(null)} testId="post-edit-help" />}
    </>
  );
}
