"use client";

// The profile edit form — a parallel Registration prepared by the
// backend and signed in this browser (substrate.md §9). The form holds
// the full field set: a blanked bio or website clears; the display
// name cannot blank. Client-gated like the (app) group.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchMyProfile, prepareProfileUpdate } from "@/lib/api/profile-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError } from "@/lib/ui/transport-error";

export default function ProfileEditPage() {
  const phase = useAuthPhase();
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();

  const [loading, setLoading] = useState(true);
  const [transportFailed, setTransportFailed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emptyName, setEmptyName] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);

  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);

  useEffect(() => {
    if (phase !== "signedIn") return;
    let cancelled = false;
    void guard
      .run(() => fetchMyProfile(client))
      .then((outcome) => {
        if (cancelled) return;
        setLoading(false);
        if (outcome.kind === "success" && outcome.value !== null) {
          setDisplayName(outcome.value.displayName.value ?? "");
          setBio(outcome.value.bio.value ?? "");
          setWebsiteUrl(outcome.value.websiteUrl.value ?? "");
        } else {
          setTransportFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, guard, phase]);

  if (phase !== "signedIn") return null;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (displayName.trim() === "") {
      setEmptyName(true);
      return;
    }
    setSubmitting(true);
    setRefusedMessage(null);
    setSignIncomplete(false);
    setTransportFailed(false);
    const prepared = await guard.run(() =>
      prepareProfileUpdate(client, {
        displayName: displayName.trim(),
        bio: bio.trim() === "" ? null : bio,
        websiteUrl: websiteUrl.trim() === "" ? null : websiteUrl.trim(),
      }),
    );
    if (prepared.kind === "refused") {
      setSubmitting(false);
      setRefusedMessage(prepared.errors[0]?.message ?? "The server refused this update.");
      return;
    }
    if (prepared.kind === "failed") {
      setSubmitting(false);
      setTransportFailed(true);
      return;
    }
    const results = [];
    for (const staged of prepared.value) {
      results.push(await signer.signStaged(staged));
    }
    setSubmitting(false);
    if (results.every((result) => result.kind === "done")) {
      router.push("/profile");
    } else {
      setSignIncomplete(true);
    }
  };

  const field =
    "rounded-medium border border-outline bg-surface px-3 py-2 text-body-large text-on-surface";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      <PageHeader
        title="Edit profile"
        backHref="/profile"
        backLabel="Back to profile"
        backTestId="profile-edit-back"
      />
      {loading && <p data-testid="profile-edit-loading">Loading…</p>}
      {!loading && transportFailed && displayName === "" && (
        <TransportError testId="profile-edit-transport-error" />
      )}
      {!loading && (
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <label className="flex flex-col gap-1 text-label-large">
            Display name
            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setEmptyName(false);
              }}
              data-testid="profile-edit-display-name"
              className={field}
            />
          </label>
          {emptyName && (
            <p role="alert" data-testid="profile-edit-empty-name" className="text-body-small text-error">
              A display name is required.
            </p>
          )}
          <label className="flex flex-col gap-1 text-label-large">
            Bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              data-testid="profile-edit-bio"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-label-large">
            Website
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              data-testid="profile-edit-website"
              className={field}
            />
          </label>
          {refusedMessage !== null && (
            <p role="alert" data-testid="profile-edit-refused" className="text-body-small text-error">
              {refusedMessage}
            </p>
          )}
          {signIncomplete && (
            <p role="alert" data-testid="profile-edit-signing-failed" className="text-body-small text-error">
              Signing didn&apos;t complete. Try again.
            </p>
          )}
          {transportFailed && displayName !== "" && (
            <TransportError testId="profile-edit-submit-transport" />
          )}
          <Button testId="profile-edit-save" type="submit" disabled={submitting}>
            Save
          </Button>
        </form>
      )}
    </main>
  );
}
