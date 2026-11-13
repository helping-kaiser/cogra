"use client";

// The profile edit form — a parallel Registration prepared by the
// backend and signed in this browser (substrate.md §9). The form holds
// the full field set, and a blanked bio or website clears. Client-gated
// like the (app) group.
//
// THIS SURFACE INVENTS NO PRODUCT RULES OF ITS OWN (design/backlog.md item
// 36.2). A display name is optional — account creation never asks for one and
// a profile with none is presented by its handle — so the empty-name check
// that used to stand here was a rule the product does not have, and it was
// this form's only local rule; Save's outcomes past what is checked below are
// the seal's and the faults the seal owns.
//
// THE LENGTH CAPS BELOW ARE NOT A LOCAL RULE EITHER — they are the write
// side's own limits, mirrored client-side exactly as a title or an alt text
// is elsewhere (`lib/profile/caps.ts`, pinned to `client-constants.json`), so
// a reader never types past a boundary the server was always going to refuse.

//
// THE EDIT IS A WIZARD STAGE (ProfileEdit.jsx, ProfileEdit.md): its top
// pinned while the fields scroll, `Save` pinned in the foot, no bottom bar,
// the heading taking focus as it opens so no keyboard rises. Its picture row's
// `Change picture` opens the picker and then the picture's own crop screen
// (`AvatarCrop`), whose Next brings the framed picture back here, to be
// signed with the fields under one seal.
//
// SAVE OPENS THE SEAL AND SIGNS NOTHING (ProfileEdit.md:15). Save uploads a
// picked picture and PREPARES the change — staging, never signing — so a
// refusal of the picture or of a field still says itself on the edit, where
// it always did (seam 325, G-A4); the seal (`ProfileEditSeal`) then holds
// the prepared change and its commit signs it.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchMyProfile,
  prepareProfileUpdate,
  type MediaSelection,
} from "@/lib/api/profile-api";
import { echoes, uploadDigestOf, uploadMedia } from "@/lib/api/media-api";
import { firstRefusalMessage, mediaRefusalMessage } from "@/lib/ui/error-messages";
import { profileExpectation, type MediaLedger } from "@/lib/compose/payload-expectation";
import { TOO_BIG_PICTURE } from "@/lib/compose/pick";
import { ECHO_MISMATCH } from "@/lib/compose/uploads";
import { pictureTooBig } from "@/lib/ui2/media/caps";
import { encodeForUpload } from "@/lib/ui2/media/encode-image";
import {
  BIO_MAX_CHARS,
  DISPLAY_NAME_MAX_CHARS,
  WEBSITE_URL_MAX_CHARS,
  bioProblem,
  displayNameProblem,
  websiteUrlProblem,
} from "@/lib/profile/caps";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { expectation, profileUpdate } from "@/lib/signing/intent";
import { useWriteSigner } from "@/lib/signing/provider";
import { TransportError } from "@/lib/ui/transport-error";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { PillButton } from "@/lib/ui2/pill-button";
import { TextField } from "@/lib/ui2/text-field";
import { CENTERED, type Crop } from "@/lib/ui2/media/crop";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { sealFaultOf } from "@/lib/compose/seal-fault";
import type { StagedWriteView } from "@/lib/api/writes-api";
import type { Expectation } from "@/lib/signing/intent";
import type { WriteResult } from "@/lib/signing/write-signer";
import { PROFILE_SIGNED, type ProfileChangeOutcome } from "@/lib/profile/profile-change";
import { AvatarCrop } from "./avatar-crop";
import { changeSummary, type ProfileFields } from "./change-summary";
import { ProfileEditSeal } from "./profile-edit-seal";
import {
  PictureDisc,
  PROFILE_RATIOS,
  ProfileMediaField,
  UNCHANGED,
  type ProfileMediaChoice,
} from "./profile-media-field";

/** The prepared change the seal holds and signs. */
type Sealing = {
  readonly writes: readonly StagedWriteView[];
  readonly expected: Expectation;
  readonly summary: string;
};

/**
 * What one signing came to, for the seal's states: every write taken is the
 * change taken; a refusal reads by the failure pack (`sealFaultOf`: the write
 * rule, else a bug); a device's own refusal of the bytes is a bug; no answer
 * — a transport failure, a seal still out — is the fault line.
 */
function outcomeOf(results: readonly WriteResult[]): ProfileChangeOutcome {
  if (results.every((result) => result.kind === "done" || result.kind === "carried")) return { kind: "taken" };
  const refused = results.flatMap((result) => (result.kind === "refused" ? result.errors : []));
  if (refused.length > 0) {
    return { kind: sealFaultOf(refused, []).kind === "writeRule" ? "writeRule" : "bug" };
  }
  if (results.some((result) => result.kind === "rejectedByDevice")) return { kind: "bug" };
  return { kind: "offline" };
}

export function ProfileEditScreen({ store = identityStore }: { store?: IdentityStore }) {
  const phase = useAuthPhase();
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const keyOnDevice = useKeyOnDevice(store);
  // The fields as the profile carried them, to say what the change holds.
  const [before, setBefore] = useState<ProfileFields>({ displayName: "", bio: "", websiteUrl: "" });
  const [sealing, setSealing] = useState<Sealing | null>(null);

  const [loading, setLoading] = useState(true);
  const [transportFailed, setTransportFailed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<ProfileMediaChoice>(UNCHANGED);
  // The account's own id: the node a profile payload binds to.
  const [profileNode, setProfileNode] = useState<string | null>(null);
  // A picture on its crop screen, before Next hands it back to the row.
  const [cropping, setCropping] = useState<{ file: File; crop: Crop } | null>(null);
  const croppingFile = cropping?.file ?? null;
  const croppingSrc = useMemo(
    () => (croppingFile === null ? null : URL.createObjectURL(croppingFile)),
    [croppingFile],
  );
  useEffect(() => {
    if (croppingSrc === null) return;
    return () => URL.revokeObjectURL(croppingSrc);
  }, [croppingSrc]);

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
          setProfileNode(outcome.value.id);
          setDisplayName(outcome.value.displayName.value ?? "");
          setBio(outcome.value.bio.value ?? "");
          setWebsiteUrl(outcome.value.websiteUrl.value ?? "");
          setBefore({
            displayName: outcome.value.displayName.value ?? "",
            bio: outcome.value.bio.value ?? "",
            websiteUrl: outcome.value.websiteUrl.value ?? "",
          });
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
  ): Promise<{ selection: MediaSelection; ledger: MediaLedger; error?: string }> => {
    const none: MediaLedger = new Map();
    if (choice.kind === "unchanged") return { selection: "unchanged", ledger: none };
    if (choice.kind === "cleared") return { selection: { clear: true }, ledger: none };
    let encoded;
    let uploadDigest: string;
    try {
      encoded = await encodeForUpload(choice.file, { ratio, crop: choice.crop });
      uploadDigest = await uploadDigestOf(encoded.blob);
    } catch {
      return {
        selection: "unchanged",
        ledger: none,
        error: "This browser couldn't read that picture.",
      };
    }
    // HT-19: an avatar is a picture and takes the picture cap, in the composer's
    // own words and at the same moment — on the encoded bytes, before they go.
    if (pictureTooBig(encoded.blob)) {
      return { selection: "unchanged", ledger: none, error: TOO_BIG_PICTURE };
    }
    const result = await guard.run(() => uploadMedia(client, { blob: encoded.blob }));
    if (result.kind === "success") {
      // The echo first: an avatar whose recorded bytes are not the ones sent
      // is never named (uploads.ts).
      if (!echoes(result.value, uploadDigest)) {
        return { selection: "unchanged", ledger: none, error: ECHO_MISMATCH };
      }
      return {
        selection: { mediaId: result.value.id },
        ledger: new Map([
          [
            result.value.id,
            { digest: result.value.digest, uploadDigest, mime: result.value.mimeType },
          ],
        ]),
      };
    }
    return {
      selection: "unchanged",
      ledger: none,
      error:
        result.kind === "refused"
          ? (result.errors[0] === undefined
              ? "The server refused that picture."
              : mediaRefusalMessage(result.errors[0].code, "picture"))
          : "Couldn't reach the server.",
    };
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setRefusedMessage(null);
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

    const sent = {
      displayName: displayName.trim(),
      bio: bio.trim() === "" ? null : bio,
      websiteUrl: websiteUrl.trim() === "" ? null : websiteUrl.trim(),
      avatar: uploaded[0].selection,
    };
    const prepared = await guard.run(() => prepareProfileUpdate(client, sent));
    if (prepared.kind === "refused") {
      setSubmitting(false);
      setRefusedMessage(firstRefusalMessage(prepared.errors, "The server refused this update."));
      return;
    }
    if (prepared.kind === "failed") {
      setSubmitting(false);
      setTransportFailed(true);
      return;
    }
    // One profile update on this device's own profile, its payload held to
    // the fields this form sent and the avatar this device uploaded
    // (payload-expectation.ts). The profile's own id was read with the form;
    // without it there is nothing to bind the payload to, and the batch is
    // refused rather than signed.
    const profile = profileExpectation(profileNode ?? "", sent, uploaded[0].ledger);
    setSubmitting(false);
    // The change's seal opens; nothing is signed before its own commit.
    setSealing({
      writes: prepared.value,
      expected: expectation([profileUpdate(profile)]),
      summary: changeSummary(before, { displayName, bio, websiteUrl }, avatar),
    });
  };

  // The write side's own caps, mirrored so an over-length value never reaches
  // Save — a client stricter than the server would be the one failure a
  // mirrored cap must not have, so these read the exact same limits
  // `lib/profile/caps.ts` pins to `client-constants.json`.
  const displayNameTooLong = displayNameProblem(displayName);
  const bioTooLong = bioProblem(bio);
  const websiteUrlTooLong = websiteUrlProblem(websiteUrl);

  // THE CHANGE'S SEAL stands in the edit's place; the edit waits as it was
  // left, one stage behind.
  if (sealing !== null) {
    return (
      <ProfileEditSeal
        avatar={<PictureDisc name={displayName} currentUrl={avatarUrl} choice={avatar} testId="profile-edit-seal-avatar" />}
        change={sealing.summary}
        hasKey={async () => keyOnDevice !== false && (await store.actorKey()) !== null}
        sign={async () => outcomeOf(await signer.sign(sealing.writes, sealing.expected))}
        onTaken={() => {
          carrySnackbar(PROFILE_SIGNED);
          router.push("/profile");
        }}
        onBack={() => setSealing(null)}
        onLeave={() => router.push("/profile")}
        onClosed={() => router.push("/profile")}
      />
    );
  }

  // THE PICTURE'S OWN CROP SCREEN stands in the edit's place while it is up;
  // the edit's fields wait in this component's state, untouched.
  if (cropping !== null && croppingSrc !== null) {
    return (
      <AvatarCrop
        src={croppingSrc}
        crop={cropping.crop}
        onCrop={(crop) => setCropping({ ...cropping, crop })}
        onNext={() => {
          // AvatarCrop.md:19: the edit comes back holding the new picture, and
          // NEVER the picture's own seal opens.
          setAvatar({ kind: "picked", file: cropping.file, crop: cropping.crop });
          setCropping(null);
        }}
        onBack={() => setCropping(null)}
        onLeave={() => router.push("/profile")}
      />
    );
  }

  return (
    <main
      data-testid="profile-edit"
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-surface text-on-surface"
    >
      <HeaderBar
        title="Edit profile"
        backLabel="Back"
        onBack={() => router.push("/profile")}
        testId="profile-edit-header"
        focusTitle
      />
      {loading && (
        <p data-testid="profile-edit-loading" className="m-0 px-6 pt-2">
          Loading…
        </p>
      )}
      {!loading && transportFailed && displayName === "" && (
        <div className="px-6 pt-2">
          <TransportError testId="profile-edit-transport-error" />
        </div>
      )}
      {!loading && (
        <form
          className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 pt-2"
          onSubmit={(event) => void onSubmit(event)}
        >
          {/* The fields scroll under the pinned top; Save stays in the foot. */}
          <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6">
            <ProfileMediaField
              name={displayName}
              currentUrl={avatarUrl}
              choice={avatar}
              onChoice={setAvatar}
              onPick={(file) => setCropping({ file, crop: CENTERED })}
              testIdPrefix="profile-edit"
            />
            <TextField
              label="Display name"
              optional
              value={displayName}
              onChange={setDisplayName}
              testId="profile-edit-display-name"
              cap={DISPLAY_NAME_MAX_CHARS}
              error={displayNameTooLong ?? undefined}
            />
            <TextField
              label="Bio"
              optional
              value={bio}
              onChange={setBio}
              multiline
              rows={3}
              testId="profile-edit-bio"
              cap={BIO_MAX_CHARS}
              error={bioTooLong ?? undefined}
            />
            <TextField
              label="Website"
              optional
              value={websiteUrl}
              onChange={setWebsiteUrl}
              testId="profile-edit-website"
              cap={WEBSITE_URL_MAX_CHARS}
              error={websiteUrlTooLong ?? undefined}
            />
            {/* An upload refused or too big before signing keeps today's line
                on the edit (seam 325, G-A4: no board draws where it stands). */}
            {refusedMessage !== null && (
              <p role="alert" data-testid="profile-edit-refused" className="m-0 text-body-small text-error">
                {refusedMessage}
              </p>
            )}
            {transportFailed && displayName !== "" && <TransportError testId="profile-edit-submit-transport" />}
          </div>
          <PillButton
            testId="profile-edit-save"
            type="submit"
            full
            disabled={
              submitting ||
              displayNameTooLong !== null ||
              bioTooLong !== null ||
              websiteUrlTooLong !== null
            }
          >
            Save
          </PillButton>
        </form>
      )}
    </main>
  );
}
