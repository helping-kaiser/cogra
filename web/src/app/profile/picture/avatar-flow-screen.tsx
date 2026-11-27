"use client";

// The picture's own flow, the head's change badge's destination (Profile.md:47:
// "the picture's crop opens AND its Next leads to the picture's own seal"):
// the crop (`AvatarCrop`), then the seal (`AvatarSeal`), then the signed
// change. Changing the picture is frequent and mostly standalone
// (ProfileHeader.jsx, jakob 2026-09-01), so it is its own signed act — the
// picture alone, never the profile's other fields.
//
// NEXT OPENS THE SEAL AT ONCE, THE UPLOAD RUNNING BEHIND ITS GATE
// (AvatarCrop.md:23, AvatarSeal.md:13-23). Next encodes the framed picture —
// the device's own leg, so a picture this browser cannot read or one over the
// cap is refused on the crop that framed it (AvatarCrop.md:43-57) — then
// opens the seal and starts the upload. The seal reads `Uploading 0 of 1 —
// signing waits for the picture.` with `Sign the change` live; a press while
// it runs is the act: it waits for the picture, then prepares and signs. A
// failed upload reads the gate's fault with Retry and drops a held press; a
// refused one reads the fact alone, Back the way out to the crop.
//
// THE PREPARE RIDES THE PRESS. The change is prepared once its picture is up
// and the reader has pressed — picture-only (`prepareAvatarChange`): the text
// fields are omitted, which the contract reads as untouched, so nothing the
// reader did not see here is restated or cleared by it.
//
// THE ACT IS THE PRESSING ACCOUNT'S (#679, #692): the owner guard in
// `profile-change.ts` stops a change whose account is no longer active before
// it runs, and this flow checks again before each of its legs — the prepare
// and the signing — and that the picture went up under that same account.
//
// THE WAYS OUT: the crop's arrow returns to its opener, the profile (seam
// 335, 325-2); the seal's arrow returns to the crop as it was framed; either X
// leaves, nothing signed; a change closed on while it signs — its upload
// included (design/readme.md, "A press held at the upload gate is the act") —
// goes on and lands under the profile's head (`ChangeSeal`).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchMyProfile, prepareAvatarChange } from "@/lib/api/profile-api";
import { avatarExpectation } from "@/lib/compose/payload-expectation";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import {
  encodeProfilePicture,
  uploadEncodedPicture,
  type EncodedPicture,
  type PictureUpload,
} from "@/lib/profile/avatar-upload";
import { heldPicture, releaseHeldPicture } from "@/lib/profile/held-picture";
import {
  outcomeOf,
  PROFILE_SIGNED,
  refusalOutcomeOf,
  type ProfileChangeOutcome,
} from "@/lib/profile/profile-change";
import type { SignedProfileChange } from "@/lib/profile/signed-profile";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { tokenStore } from "@/lib/session/token-store";
import { expectation, profileUpdate } from "@/lib/signing/intent";
import { useWriteSigner } from "@/lib/signing/provider";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { answeredFaultLine } from "@/lib/ui/error-messages";
import { CENTERED, type Crop } from "@/lib/ui2/media/crop";
import type { SealGate } from "../change-seal";
import { AvatarCrop } from "../edit/avatar-crop";
import { PictureDisc } from "../edit/profile-media-field";
import { AvatarSeal } from "./avatar-seal";

/** Where the flow returns: the profile that opened it. */
const OPENER = "/profile";

/** One upload of the framed picture, and the account it went up under. */
type Upload = { readonly by: string | null; readonly answer: Promise<PictureUpload> };

/** What the gate reads of the upload, or null once the picture is up. */
type GateReading = SealGate["reading"] | null;

export function AvatarFlowScreen({ store = identityStore }: { store?: IdentityStore }) {
  const phase = useAuthPhase();
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const keyOnDevice = useKeyOnDevice(store);

  const [file] = useState<File | null>(() => heldPicture());
  const [crop, setCrop] = useState<Crop>(CENTERED);
  // The account's own id: the node a profile payload binds to.
  const [profileNode, setProfileNode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [encoding, setEncoding] = useState(false);
  // A picture the device itself refused, on the crop that framed it.
  const [refusal, setRefusal] = useState<string | null>(null);
  // The framed picture's bytes once Next encoded them: the seal is open.
  const [encoded, setEncoded] = useState<EncodedPicture | null>(null);
  const [gate, setGate] = useState<GateReading>(null);
  // The upload the seal waits on; a Retry or a fresh Next replaces it.
  const upload = useRef<Upload | null>(null);
  // What the change sets once its picture is up: the asset is known only then.
  const signedRef = useRef<SignedProfileChange | undefined>(undefined);

  const src = useMemo(() => (file === null ? null : URL.createObjectURL(file)), [file]);
  useEffect(() => {
    if (src === null) return;
    return () => URL.revokeObjectURL(src);
  }, [src]);

  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
    // Nothing picked — a reload, a typed address — leaves nothing to frame.
    else if (phase === "signedIn" && file === null) router.replace(OPENER);
  }, [phase, file, router]);

  useEffect(() => {
    if (phase !== "signedIn" || file === null) return;
    let cancelled = false;
    void guard
      .run(() => fetchMyProfile(client))
      .then((outcome) => {
        if (cancelled || outcome.kind !== "success" || outcome.value === null) return;
        setProfileNode(outcome.value.id);
        setName(outcome.value.displayName.value ?? outcome.value.handle);
      });
    return () => {
      cancelled = true;
    };
  }, [client, guard, phase, file]);

  if (phase !== "signedIn" || file === null || src === null) return null;

  const leave = () => {
    releaseHeldPicture();
    router.push(OPENER);
  };

  /** Starts the picture's upload behind the gate (AvatarSeal.md:13, :23). */
  const startUpload = (bytes: EncodedPicture) => {
    const mine: Upload = { by: tokenStore.activeAccountId(), answer: uploadEncodedPicture(client, guard, bytes) };
    upload.current = mine;
    setGate("uploading");
    void mine.answer.then((answer) => {
      // Only the latest upload speaks for the gate.
      if (upload.current !== mine) return;
      setGate(answer.kind === "uploaded" ? null : answer.refused ? "upload-refused" : "upload-failed");
    });
  };

  const next = async () => {
    // Next refuses a second press while the picture is being encoded.
    if (encoding) return;
    setEncoding(true);
    setRefusal(null);
    const bytes = await encodeProfilePicture({ file, crop });
    setEncoding(false);
    if (bytes.kind === "problem") {
      setRefusal(bytes.message);
      return;
    }
    // AvatarCrop.md:23: from the badge, Next opens the picture's own seal —
    // at once, the upload running behind its gate.
    setEncoded(bytes);
    startUpload(bytes);
  };

  if (encoded !== null) {
    const held = upload.current;
    // The change, signed: the picture once it is up, prepared and signed for
    // the account that pressed — checked again before every leg.
    const run = async (): Promise<ProfileChangeOutcome> => {
      // `signProfileChange` runs this only while the pressing account — the
      // change's owner, a Retry's included — is the active one.
      const owner = tokenStore.activeAccountId();
      const ownersStill = () => tokenStore.activeAccountId() === owner;
      const current = held;
      if (current === null) return { kind: "dropped" };
      const answer = await current.answer;
      // AvatarSeal.md:21: an upload failing under a held press drops it.
      if (answer.kind !== "uploaded") return { kind: "dropped" };
      if (current.by !== owner || !ownersStill()) return { kind: "offline" };
      const prepared = await guard.run(() => prepareAvatarChange(client, answer.selection));
      if (prepared.kind === "refused") return refusalOutcomeOf(prepared.errors);
      if (prepared.kind === "failed") {
        // An INTERNAL is an answer: the not-through line, never the
        // unreachable one (NetworkError.md:13).
        const answered = answeredFaultLine(prepared.cause);
        return answered === null ? { kind: "offline" } : { kind: "notThrough", line: answered };
      }
      if (!ownersStill()) return { kind: "offline" };
      // One profile update on this device's own profile, its payload held to
      // the avatar this device uploaded and no other field. Without the
      // profile's own id there is nothing to bind it to, and the batch is
      // refused rather than signed.
      const expected = expectation([profileUpdate(avatarExpectation(profileNode ?? "", answer.selection, answer.ledger))]);
      signedRef.current = { profileId: profileNode, fields: { avatar: answer.picture } };
      return outcomeOf(await signer.sign(prepared.value, expected));
    };
    return (
      <AvatarSeal
        avatar={
          <PictureDisc name={name} currentUrl={null} choice={{ kind: "picked", file, crop }} testId="avatar-seal-avatar" />
        }
        gate={
          gate === null
            ? null
            : { reading: gate, onRetry: () => startUpload(encoded), node: "avatarSeal.gate" }
        }
        hasKey={async () => keyOnDevice !== false && (await store.actorKey()) !== null}
        sign={run}
        signed={() => signedRef.current}
        onTaken={() => {
          carrySnackbar(PROFILE_SIGNED);
          leave();
        }}
        onBack={() => {
          upload.current = null;
          setGate(null);
          setEncoded(null);
        }}
        onLeave={leave}
        onClosed={leave}
      />
    );
  }

  return (
    <AvatarCrop
      src={src}
      crop={crop}
      onCrop={setCrop}
      onNext={() => void next()}
      onBack={leave}
      onLeave={leave}
      problem={
        refusal === null ? null : (
          <p role="alert" data-testid="avatar-crop-refused" className="m-0 text-body-small text-error">
            {refusal}
          </p>
        )
      }
    />
  );
}
