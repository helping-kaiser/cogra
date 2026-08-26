"use client";

// The composer, in create and edit mode (post.md §1, §4): create is a
// genesis Publish carrying the mandatory license declaration; edit
// (?post=<id>) is the ordinary-role Publish behind the chain head and
// never shows the immutable license. The backend prepares; this browser
// signs.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { PUBLIC_DOMAIN, type License } from "@/lib/license";
import {
  fetchPostDetail,
  preparePost,
  preparePostEdit,
} from "@/lib/api/content-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { RestoreCard } from "@/app/applicant-status";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { LicenseChooser } from "@/lib/ui/license-fields";
import { PageHeader } from "@/lib/ui/page-header";
import { SigningPending } from "@/lib/ui/signing-pending";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

/** Parses a `["tags", i, "name"]`-shaped refusal path down to the index. */
function tagErrorIndex(field: readonly string[] | null): number | null {
  if (field === null || field.length < 2 || field[0] !== "tags") return null;
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
  const editingId = useSearchParams().get("post");
  const keyOnDevice = useKeyOnDevice(store);

  const [loading, setLoading] = useState(editingId !== null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [license, setLicense] = useState<License>(PUBLIC_DOMAIN);
  // Tags never carry into edit mode (D14): new tags are their own
  // gesture, not an edit field — the create-only state below is simply
  // unused once `editingId` is set.
  const [tags, setTags] = useState<readonly string[]>([]);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [emptyBody, setEmptyBody] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);
  const [signingNeedsKey, setSigningNeedsKey] = useState(false);
  const [transportFailed, setTransportFailed] = useState(false);

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
        setTitle(outcome.value.post.title.value ?? "");
        setDescription(outcome.value.post.description.value ?? "");
        setBody(outcome.value.post.content.value ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, editingId]);

  const onSubmit = async () => {
    if (submitting) return;
    if (body.trim() === "" && editingId === null) {
      setEmptyBody(true);
      return;
    }
    setSubmitting(true);
    setRefusedMessage(null);
    setTagErrors({});
    setSignIncomplete(false);
    setTransportFailed(false);
    const prepared = await guard.run(() =>
      editingId === null
        ? preparePost(client, {
            title: title.trim() === "" ? null : title,
            description: description.trim() === "" ? null : description,
            content: body,
            license,
            tags: tags.map((name) => ({ name })),
          })
        : preparePostEdit(client, {
            id: editingId,
            title: title.trim() === "" ? null : title,
            description: description.trim() === "" ? null : description,
            content: body,
          }),
    );
    if (prepared.kind === "refused") {
      setSubmitting(false);
      // Field errors on a batched tag land at ["tags", i, "name"] —
      // surfaced on that exact chip; everything else is the general
      // refusal line.
      const perTag: Record<number, string> = {};
      let general: string | null = null;
      for (const error of prepared.errors) {
        const index = tagErrorIndex(error.field);
        if (index !== null) perTag[index] = error.message;
        else general = general ?? error.message;
      }
      setTagErrors(perTag);
      setRefusedMessage(general ?? (Object.keys(perTag).length > 0 ? null : "The server refused this write."));
      return;
    }
    if (prepared.kind === "failed") {
      setSubmitting(false);
      setTransportFailed(true);
      return;
    }
    const results = [];
    for (const staged of prepared.value.writes) {
      results.push(await signer.signStaged(staged));
    }
    setSubmitting(false);
    if (results.every((result) => result.kind === "done")) {
      router.push(editingId === null ? "/feed" : `/posts/${editingId}`);
    } else {
      setSigningNeedsKey((await store.actorKey()) === null);
      setSignIncomplete(true);
    }
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
      {/* Tags never ride the edit form (D14): new tags are their own
          gesture, not an edit field. */}
      {editingId === null && (
        <TagEntryField tags={tags} onChange={setTags} fieldErrors={tagErrors} testIdPrefix="compose" />
      )}
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
      <Button testId="compose-submit" onClick={() => void onSubmit()} disabled={submitting}>
        {editingId === null ? "Sign and publish" : "Sign the edit"}
      </Button>
    </main>
  );
}
