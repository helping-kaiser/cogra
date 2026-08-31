"use client";

// The composer, in create and edit mode (post.md §1, §4): create is a
// genesis Publish carrying the mandatory license declaration; edit
// (?post=<id>) is the ordinary-role Publish behind the chain head and
// never shows the immutable license. The backend prepares; this browser
// signs.
//
// Tagging lives here and nowhere else (F3): cards and detail views show
// read-only chips, and the author changes their tags on the screen where
// they change the rest. Tags are still never FIELDS of the edit record
// (D14, api-spec.md `PreparePostEditInput`) — each change is prepared as
// its own Tag act, and the whole batch goes through the one signing
// pass, so the submit either stages everything or stages nothing.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { PUBLIC_DOMAIN, type License } from "@/lib/license";
import {
  fetchPostDetail,
  preparePost,
  preparePostEdit,
} from "@/lib/api/content-api";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { prepareTag } from "@/lib/api/topics-api";
import {
  fetchReferenceCandidates,
  prepareReference,
  prepareReferenceWithdrawal,
} from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { tagChanges, WITHDRAWN_RELEVANCE, type TagDraft } from "@/lib/topics/draft";
import { TAG_BATCH_CAP } from "@/lib/topics/normalize";
import { referenceDrafts } from "@/lib/references/claims";
import {
  referenceActs,
  referenceChanges,
  type ReferenceDraft,
} from "@/lib/references/draft";
import { REFERENCE_BATCH_CAP } from "@/lib/references/normalize";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { useWriteSigner } from "@/lib/signing/provider";
import { RestoreCard } from "@/app/applicant-status";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { LicenseChooser } from "@/lib/ui/license-fields";
import { PageHeader } from "@/lib/ui/page-header";
import { MultiActionConfirm, SignedActionsIndicator } from "@/lib/ui/signed-actions";
import { SigningPending } from "@/lib/ui/signing-pending";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

/** Parses a `["tags", i, "name"]`-shaped refusal path down to the index. */
function tagErrorIndex(field: readonly string[] | null): number | null {
  return pathIndex(field, "tags");
}

/** Parses a `["references", i, …]`-shaped refusal path down to the index. */
function referenceErrorIndex(field: readonly string[] | null): number | null {
  return pathIndex(field, "references");
}

function pathIndex(field: readonly string[] | null, head: string): number | null {
  if (field === null || field.length < 2 || field[0] !== head) return null;
  const index = Number(field[1]);
  return Number.isInteger(index) ? index : null;
}

export function ComposeForm({
  store = identityStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
}) {
  return (
    <Suspense>
      <ComposeFormInner store={store} />
    </Suspense>
  );
}

function ComposeFormInner({ store }: { store: IdentityStore }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params.get("post");
  // D20's Reference affordance: a detail surface sends the author here
  // with the node it wants referenced, and the chip arrives prefilled.
  const prefillReference = params.get("reference");
  const keyOnDevice = useKeyOnDevice(store);

  const [loading, setLoading] = useState(editingId !== null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [license, setLicense] = useState<License>(PUBLIC_DOMAIN);
  const [tags, setTags] = useState<readonly TagDraft[]>([]);
  const [references, setReferences] = useState<readonly ReferenceDraft[]>([]);
  // What the post carried when it loaded: the baseline the tag changes,
  // the reference changes, and the "did the content change at all"
  // question all read.
  const [loadedTags, setLoadedTags] = useState<readonly TagDraft[]>([]);
  const [loadedReferences, setLoadedReferences] = useState<readonly ReferenceDraft[]>([]);
  const [loadedContent, setLoadedContent] = useState<{
    title: string;
    description: string;
    body: string;
  } | null>(null);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [emptyBody, setEmptyBody] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);
  const [signingNeedsKey, setSigningNeedsKey] = useState(false);
  const [transportFailed, setTransportFailed] = useState(false);
  const [confirmMultiAction, setConfirmMultiAction] = useConfirmMultiAction();
  const [confirming, setConfirming] = useState(false);
  // What the post being edited carries today; re-stated on the edit so a
  // complete-state write does not drop it.
  const [sensitive, setSensitive] = useState(false);

  useEffect(() => {
    if (editingId === null) return;
    let cancelled = false;
    void fetchPostDetail(client, editingId).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setTransportFailed(true);
      } else if (outcome.value === null) {
        setNotFound(true);
      } else {
        const post = outcome.value.post;
        const loaded = {
          title: post.title.value ?? "",
          description: post.description.value ?? "",
          body: post.content.value ?? "",
        };
        setTitle(loaded.title);
        setDescription(loaded.description);
        setBody(loaded.body);
        setLoadedContent(loaded);
        // AN EDIT IS COMPLETE STATE, so the mark has to be carried forward or
        // the edit would quietly unveil a post its author had veiled. The
        // status is already on the detail read, so preserving it costs no new
        // selection. Reported: the read cannot tell an author's own mark from a
        // moderator's, so an edit re-states whichever one is standing.
        setSensitive(post.moderationStatus === "SENSITIVE");
        // A pending claim is a current tag too — the author declared it.
        const current = post.topics.map((claim) => ({
          name: claim.hashtag.name.value ?? "",
          relevance: claim.relevance,
          confidence: claim.confidence,
        }));
        setLoadedTags(current);
        setTags(current);
        // A claim CoGra cannot type is dropped here: it has no L2 id to
        // name it back by, so it renders on the detail view but is never
        // staged — and never mistaken for one the author removed.
        const currentReferences = referenceDrafts(post.references);
        setLoadedReferences(currentReferences);
        setReferences(currentReferences);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, editingId]);

  // The prefill resolves through the finder's OWN lookup — an exact
  // UUID is one of the three shapes it answers — so the affordance
  // needs no second endpoint and cannot offer a target the mutation
  // would then refuse. A miss simply leaves the section empty.
  useEffect(() => {
    if (prefillReference === null || editingId !== null) return;
    let cancelled = false;
    void fetchReferenceCandidates(client, prefillReference, 1).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      const candidate = outcome.value[0];
      if (candidate === undefined) return;
      setReferences((current) =>
        current.some((reference) => reference.targetId === candidate.targetId)
          ? current
          : [...current, candidate],
      );
    });
    return () => {
      cancelled = true;
    };
  }, [client, prefillReference, editingId]);

  // What an edit would actually stage: the record only when the content
  // moved, one Tag act per tag change, and one Reference act per
  // reference change — a withdrawal being the whole counter-record
  // batch the claim quotes.
  const changes = editingId === null ? [] : tagChanges(loadedTags, tags);
  const refChanges =
    editingId === null ? [] : referenceChanges(loadedReferences, references);
  const contentChanged =
    loadedContent === null ||
    title !== loadedContent.title ||
    description !== loadedContent.description ||
    body !== loadedContent.body;

  // What pressing submit right now would sign (F4). Creating mints the
  // post and batches one act per drafted topic and per drafted
  // reference; editing signs the edit record only if the content moved,
  // plus one act per change.
  //
  // Exact, withdrawals included: a claim serves `withdrawalCost` off the
  // raw bundle sums, which is the batch `prepareReferenceWithdrawal`
  // then stages — so every submit can ask before it prepares.
  const signedActions =
    editingId === null
      ? 1 + tags.length + references.length
      : (contentChanged ? 1 : 0) + changes.length + referenceActs(refChanges);

  const signAll = async (writes: readonly StagedWriteView[]): Promise<boolean> => {
    const results = [];
    for (const staged of writes) {
      results.push(await signer.signStaged(staged));
    }
    return results.every((result) => result.kind === "done");
  };

  const finish = async (writes: readonly StagedWriteView[]) => {
    const done = await signAll(writes);
    setSubmitting(false);
    if (done) {
      router.push(editingId === null ? "/feed" : `/posts/${editingId}`);
    } else {
      setSigningNeedsKey((await store.actorKey()) === null);
      setSignIncomplete(true);
    }
  };

  const submitCreate = async () => {
    const prepared = await guard.run(() =>
      preparePost(client, {
        title: title.trim() === "" ? null : title,
        description: description.trim() === "" ? null : description,
        content: body,
        license,
        tags,
        references,
      }),
    );
    if (prepared.kind === "refused") {
      setSubmitting(false);
      // Field errors on a batched tag land at ["tags", i, "name"] and a
      // batched reference's at ["references", i, …] — each surfaced on
      // that exact chip; everything else is the general refusal line.
      // D19: a batch the balance cannot carry is refused WHOLE, before
      // any act is staged, and reads on that same general line.
      const perTag: Record<number, string> = {};
      const perReference: Record<number, string> = {};
      let general: string | null = null;
      for (const error of prepared.errors) {
        const tagIndex = tagErrorIndex(error.field);
        const referenceIndex = referenceErrorIndex(error.field);
        if (tagIndex !== null) perTag[tagIndex] = error.message;
        else if (referenceIndex !== null) perReference[referenceIndex] = error.message;
        else general = general ?? error.message;
      }
      setTagErrors(perTag);
      setReferenceErrors(perReference);
      setRefusedMessage(
        general ??
          (Object.keys(perTag).length + Object.keys(perReference).length > 0
            ? null
            : "The server refused this write."),
      );
      return;
    }
    if (prepared.kind === "failed") {
      setSubmitting(false);
      setTransportFailed(true);
      return;
    }
    await finish(prepared.value.writes);
  };

  /**
   * Prepares everything BEFORE signing anything: a refusal on the third
   * tag must not leave the first two signed. Staged writes nobody signs
   * are collected by the server's own GC.
   */
  const submitEdit = async (id: string) => {
    const writes: StagedWriteView[] = [];
    const perTag: Record<number, string> = {};
    let general: string | null = null;

    if (contentChanged) {
      const prepared = await guard.run(() =>
        preparePostEdit(client, {
          id,
          title: title.trim() === "" ? null : title,
          description: description.trim() === "" ? null : description,
          content: body,
          sensitive,
        }),
      );
      if (prepared.kind === "failed") {
        setSubmitting(false);
        setTransportFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        general = prepared.errors[0]?.message ?? "The server refused this write.";
      } else {
        writes.push(...prepared.value.writes);
      }
    }

    for (const change of changes) {
      const prepared = await guard.run(() =>
        prepareTag(client, {
          target: id,
          name: change.kind === "tag" ? change.tag.name : change.name,
          // Withdrawing is a Tag act at relevance 0 (hashtag.md §4).
          relevance: change.kind === "tag" ? change.tag.relevance : WITHDRAWN_RELEVANCE,
          confidence: change.kind === "tag" ? change.tag.confidence : undefined,
        }),
      );
      if (prepared.kind === "failed") {
        setSubmitting(false);
        setTransportFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        // A PRE-STAGING refusal is a field error, never the signing line
        // (F2): nothing was staged, so nothing stays pending. An added
        // tag carries it on its own chip; a withdrawal has no chip left
        // to carry it, so it reads on the general line.
        const message = prepared.errors[0]?.message ?? "The server refused this write.";
        const index =
          change.kind === "tag" ? tags.findIndex((tag) => tag.name === change.tag.name) : -1;
        if (index >= 0) perTag[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    // One Reference act per added or re-tuned reference; a REMOVAL is a
    // withdrawal, and the server assembles its counter-records — the
    // returned batch is the only truthful quote of what it costs (D11).
    const perReference: Record<number, string> = {};
    for (const change of refChanges) {
      const prepared = await guard.run(() =>
        change.kind === "reference"
          ? prepareReference(client, {
              artifact: id,
              target: change.reference.targetId,
              relevance: change.reference.relevance,
              support: change.reference.support,
            })
          : prepareReferenceWithdrawal(client, {
              artifact: id,
              target: change.reference.targetId,
            }),
      );
      if (prepared.kind === "failed") {
        setSubmitting(false);
        setTransportFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        // A PRE-STAGING refusal is a field error, never the signing line
        // (F2): nothing was staged, so nothing stays pending. An added
        // reference carries it on its own chip; a withdrawal has no chip
        // left to carry it, so it reads on the general line.
        const message = prepared.errors[0]?.message ?? "The server refused this write.";
        const index =
          change.kind === "reference"
            ? references.findIndex(
                (reference) => reference.targetId === change.reference.targetId,
              )
            : -1;
        if (index >= 0) perReference[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    if (
      general !== null ||
      Object.keys(perTag).length > 0 ||
      Object.keys(perReference).length > 0
    ) {
      setSubmitting(false);
      setTagErrors(perTag);
      setReferenceErrors(perReference);
      setRefusedMessage(general);
      return;
    }

    await finish(writes);
  };

  const run = async () => {
    setSubmitting(true);
    setRefusedMessage(null);
    setTagErrors({});
    setReferenceErrors({});
    setSignIncomplete(false);
    setTransportFailed(false);
    if (editingId === null) await submitCreate();
    else await submitEdit(editingId);
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (body.trim() === "" && editingId === null) {
      setEmptyBody(true);
      return;
    }
    // More than one signed action is more than one price, so it is asked
    // about before it is signed (F4) — unless the reader turned the
    // asking off. Every submit asks first, withdrawals included: the
    // count is served, so nothing has to be staged to learn it.
    if (signedActions > 1 && confirmMultiAction) {
      setConfirming(true);
      return;
    }
    await run();
  };

  // Leaving is plain back navigation, no discard confirm — the Android
  // composer's behavior. A post that no longer resolves backs to the
  // feed instead of the dead detail page.
  const header = (
    <CollapsingTop>
      <PageHeader
        title={editingId === null ? "New post" : "Edit post"}
        backHref={editingId === null || notFound ? "/feed" : `/posts/${editingId}`}
        backLabel={editingId === null || notFound ? "Back to feed" : "Back to post"}
        backTestId="compose-back"
      />
      {/* The key banner rides the collapsing top here too — a keyless
          writer learns before drafting, not at submit (design.md §6). */}
      {keyOnDevice === false && <RestoreCard />}
    </CollapsingTop>
  );

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header}
        <p>Loading…</p>
      </main>
    );
  }
  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header}
        <p role="alert" data-testid="compose-not-found">
          This post no longer resolves.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      {header}
      <TextField label="Title" value={title} onChange={setTitle} testId="compose-title" />
      <TextField
        label="Description"
        value={description}
        onChange={setDescription}
        testId="compose-description"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="compose-body" className="text-label-large">
          What do you want to publish?
        </label>
        <textarea
          id="compose-body"
          data-testid="compose-body"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setEmptyBody(false);
          }}
          rows={8}
          className="rounded-extra-small border border-outline p-2"
        />
        {emptyBody && (
          <p role="alert" data-testid="compose-empty-body" className="text-body-medium text-error">
            The post needs a body.
          </p>
        )}
      </div>
      {/* Creation batches its tags onto the minting record, so the batch
          cap applies; an edit stages one act per change, which is not a
          batch and carries no cap. */}
      <TagEntryField
        tags={tags}
        onChange={setTags}
        fieldErrors={tagErrors}
        cap={editingId === null ? TAG_BATCH_CAP : null}
        testIdPrefix="compose"
      />
      {/* The reference section, sibling to the tag section (D18). Same
          batch rule: creation carries its own ten-per-batch cap (D7),
          an edit stages one act per change and carries none. */}
      <ReferenceEntryField
        references={references}
        onChange={setReferences}
        fieldErrors={referenceErrors}
        cap={editingId === null ? REFERENCE_BATCH_CAP : null}
        testIdPrefix="compose"
      />
      {editingId === null && (
        <LicenseChooser value={license} onChange={setLicense} testIdPrefix="compose" />
      )}
      {refusedMessage && (
        <p role="alert" data-testid="compose-refused" className="text-body-medium text-error">
          {refusedMessage}
        </p>
      )}
      {signIncomplete && (
        <SigningPending needsKey={signingNeedsKey} testIdPrefix="compose" />
      )}
      {transportFailed && <TransportError testId="compose-transport-error" />}
      {/* The cost, beside the control that pays it (F4). */}
      <SignedActionsIndicator count={signedActions} testId="compose-signed-actions" />
      <Button
        testId="compose-submit"
        onClick={() => void onSubmit()}
        disabled={submitting || signedActions === 0}
      >
        {editingId === null ? "Sign and publish" : "Sign the edit"}
      </Button>
      {confirming && (
        <MultiActionConfirm
          count={signedActions}
          busy={submitting}
          testIdPrefix="compose"
          onCancel={() => setConfirming(false)}
          onConfirm={(stopAsking) => {
            if (stopAsking) setConfirmMultiAction(false);
            setConfirming(false);
            void run();
          }}
        />
      )}
    </main>
  );
}
