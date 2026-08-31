"use client";

// The profile edit form — a parallel Registration prepared by the
// backend and signed in this browser (substrate.md §9). The form holds
// the full field set: a blanked bio or website clears; the display
// name cannot blank. Client-gated like the (app) group.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchMyProfile,
  prepareProfileUpdate,
  type MediaSelection,
} from "@/lib/api/profile-api";
import { uploadMedia } from "@/lib/api/media-api";
import { encodeForUpload } from "@/lib/ui2/media/encode-image";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError } from "@/lib/ui/transport-error";
import {
  PROFILE_RATIOS,
  ProfileMediaField,
  UNCHANGED,
  type ProfileMediaChoice,
} from "./profile-media-field";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<ProfileMediaChoice>(UNCHANGED);

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
          setAvatarUrl(outcome.value.avatar?.url ?? null);
        } else {
          setTransportFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, guard, phase]);

  if (phase !== "signedIn") return null;

  /**
   * One field's choice, turned into the value the update carries.
   *
   * The mapping is the whole three-valued rule in four lines: untouched stays
   * `unchanged` and serialises to an absent field, cleared becomes an explicit
   * null, and a pick becomes the id of the asset its bytes just made.
   */
  const resolve = async (
    choice: ProfileMediaChoice,
    ratio: number,
  ): Promise<{ selection: MediaSelection; error?: string }> => {
    if (choice.kind === "unchanged") return { selection: "unchanged" };
    if (choice.kind === "cleared") return { selection: { clear: true } };
    let encoded;
    try {
      encoded = await encodeForUpload(choice.file, { ratio, crop: choice.crop });
    } catch {
      return { selection: "unchanged", error: "This browser couldn't read that picture." };
    }
    const result = await uploadMedia(client, { blob: encoded.blob, altText: null });
    if (result.kind === "success") return { selection: { mediaId: result.value.id } };
    return {
      selection: "unchanged",
      error:
        result.kind === "refused"
          ? (result.errors[0]?.message ?? "The server refused that picture.")
          : "Couldn't reach the server.",
    };
  };

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

    // The pictures go up BEFORE the record is prepared: an update naming an
    // asset id that does not exist yet would be refused, and a refusal at that
    // point would have already cost the author their framing.
    const uploaded = [await resolve(avatar, PROFILE_RATIOS.avatar)];
    const failure = uploaded.find((result) => result.error !== undefined);
    if (failure?.error !== undefined) {
      setSubmitting(false);
      setRefusedMessage(failure.error);
      return;
    }

    const prepared = await guard.run(() =>
      prepareProfileUpdate(client, {
        displayName: displayName.trim(),
        bio: bio.trim() === "" ? null : bio,
        websiteUrl: websiteUrl.trim() === "" ? null : websiteUrl.trim(),
        avatar: uploaded[0].selection,
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
          <ProfileMediaField
            kind="avatar"
            name={displayName}
            currentUrl={avatarUrl}
            choice={avatar}
            onChoice={setAvatar}
            testIdPrefix="profile-edit"
          />
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
