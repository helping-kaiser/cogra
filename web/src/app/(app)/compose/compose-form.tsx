"use client";

// The composer, in create and edit mode (post.md §1, §4): create is a
// genesis Publish carrying the mandatory license declaration; edit
// (?post=<id>) is the ordinary-role Publish behind the chain head and
// never shows the immutable license. The backend prepares; this browser
// signs.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { Oversight } from "@/__generated__/graphql";
import {
  fetchPostDetail,
  preparePost,
  preparePostEdit,
} from "@/lib/api/content-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { PageHeader } from "@/lib/ui/page-header";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

const OVERSIGHT_OPTIONS: readonly { value: Oversight; label: string }[] = [
  { value: "NONE", label: "No AI" },
  { value: "CONDITIONAL", label: "AI-assisted" },
  { value: "FULL", label: "AI-generated" },
];

export function ComposeForm() {
  return (
    <Suspense>
      <ComposeFormInner />
    </Suspense>
  );
}

function ComposeFormInner() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const router = useRouter();
  const editingId = useSearchParams().get("post");

  const [loading, setLoading] = useState(editingId !== null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [attributionRequired, setAttributionRequired] = useState(false);
  const [oversight, setOversight] = useState<Oversight>("NONE");
  const [submitting, setSubmitting] = useState(false);
  const [emptyBody, setEmptyBody] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);
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
    setSignIncomplete(false);
    setTransportFailed(false);
    const prepared = await guard.run(() =>
      editingId === null
        ? preparePost(client, {
            title: title.trim() === "" ? null : title,
            description: description.trim() === "" ? null : description,
            content: body,
            license: { attributionRequired, oversight },
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
      setRefusedMessage(prepared.errors[0]?.message ?? "The server refused this write.");
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
      setSignIncomplete(true);
    }
  };

  // Leaving is plain back navigation, no discard confirm — the Android
  // composer's behavior. A post that no longer resolves backs to the
  // feed instead of the dead detail page.
  const header = (
    <PageHeader
      title={editingId === null ? "New post" : "Edit post"}
      backHref={editingId === null || notFound ? "/feed" : `/posts/${editingId}`}
      backLabel={editingId === null || notFound ? "Back to feed" : "Back to post"}
      backTestId="compose-back"
    />
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
      {editingId === null && (
        <fieldset className="flex flex-col gap-2" data-testid="compose-license">
          <legend className="text-label-large">License</legend>
          <label className="flex items-center gap-2 text-body-medium">
            <input
              type="checkbox"
              data-testid="license-attribution"
              className="accent-primary"
              checked={attributionRequired}
              onChange={(event) => setAttributionRequired(event.target.checked)}
            />
            Require attribution
          </label>
          <div className="flex gap-3" role="radiogroup" aria-label="AI provenance">
            {OVERSIGHT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-1 text-body-medium">
                <input
                  type="radio"
                  name="oversight"
                  className="accent-primary"
                  data-testid={`license-oversight-${option.value.toLowerCase()}`}
                  checked={oversight === option.value}
                  onChange={() => setOversight(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {refusedMessage && (
        <p role="alert" data-testid="compose-refused" className="text-body-medium text-error">
          {refusedMessage}
        </p>
      )}
      {signIncomplete && (
        <p role="alert" data-testid="compose-signing-failed" className="text-body-medium text-error">
          Signing did not finish — the write stays pending.
        </p>
      )}
      {transportFailed && <TransportError testId="compose-transport-error" />}
      <Button testId="compose-submit" onClick={() => void onSubmit()} disabled={submitting}>
        {editingId === null ? "Sign and publish" : "Sign the edit"}
      </Button>
    </main>
  );
}
