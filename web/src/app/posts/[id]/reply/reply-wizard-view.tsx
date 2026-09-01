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
import type { StagedWriteView } from "@/lib/api/writes-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { runUpload } from "@/lib/compose/uploads";
import { usePreviewUrls } from "@/lib/compose/previews";
import { commentAttachmentClaims } from "@/lib/compose/comment-media";
import {
  emptyReply,
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
import { TransportError } from "@/lib/ui/transport-error";
import { ReplyComposeStep } from "./reply-compose-step";
import { ReplySealStep, type ReplySheet } from "./reply-seal-step";

/** The leave label the no-drafts ruling requires — it must not promise a draft. */
export const LEAVE_LABEL = "Leave — this comment is discarded";

function pathIndex(field: readonly string[] | null, head: string): number | null {
  if (field === null || field.length < 2 || field[0] !== head) return null;
  const index = Number(field[1]);
  return Number.isInteger(index) ? index : null;
}

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
  useEffect(() => {
    for (const asset of state.media) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      started.current.add(asset.id);
      // No ratio: a comment's pictures keep their own shape.
      void runUpload(client, asset, undefined, (upload) =>
        dispatch({ type: "upload", id: asset.id, upload }),
      );
    }
  }, [state.media, client, dispatch]);

  const pick = (files: readonly File[]) => {
    dispatch({
      type: "pick",
      assets: files.map((file) => ({ id: crypto.randomUUID(), file })),
    });
  };

  const retry = (id: string) => {
    started.current.delete(id);
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
      const perTag: Record<number, string> = {};
      const perReference: Record<number, string> = {};
      let general: string | null = null;
      for (const error of prepared.errors) {
        const tag = pathIndex(error.field, "tags");
        const reference = pathIndex(error.field, "references");
        if (tag !== null) perTag[tag] = error.message;
        else if (reference !== null) perReference[reference] = error.message;
        else general = general ?? error.message;
      }
      setTagErrors(perTag);
      setReferenceErrors(perReference);
      const sectioned = Object.keys(perTag).length + Object.keys(perReference).length > 0;
      setRefusal(
        general ??
          (sectioned ? "Something in the details was refused." : "The server refused this write."),
      );
      // The refused chip lives in the seal's own sheet, so the sheet is
      // reopened on it rather than the reader hunting for what was refused.
      if (Object.keys(perTag).length > 0) setSheet("topics");
      else if (Object.keys(perReference).length > 0) setSheet("references");
      return;
    }

    await finish(prepared.value.node, prepared.value.writes);
  };

  const finish = async (node: string, writes: readonly StagedWriteView[]) => {
    const results = [];
    for (const staged of writes) results.push(await signer.signStaged(staged));
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
        ? (refused.errors[0]?.message ?? "The comment wasn't signed.")
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
        onBack={() => (state.step === "compose" ? onLeave() : dispatch({ type: "back" }))}
        onLeave={onLeave}
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
          onWords={(words) => dispatch({ type: "words", words })}
          onPick={pick}
          onRemove={(id) => dispatch({ type: "unpick", id })}
          onRetry={retry}
          onDescribe={() => setDescribing(state.media[0]?.id ?? null)}
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
