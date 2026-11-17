"use client";

// The picture's own flow, the head's change badge's destination (Profile.md:47:
// "the picture's crop opens AND its Next leads to the picture's own seal"):
// the crop (`AvatarCrop`), then the seal (`AvatarSeal`), then the signed
// change. Changing the picture is frequent and mostly standalone
// (ProfileHeader.jsx, jakob 2026-09-01), so it is its own signed act — the
// picture alone, never the profile's other fields.
//
// NEXT STAGES THE CHANGE, THE SEAL SIGNS IT. Next uploads the framed picture
// and PREPARES the change — staging, never signing — the edit's own order
// (ProfileEdit.md:15; seam 325, G-A4), so a refusal of the picture says
// itself on the crop that framed it, where the edit says its own on the edit.
// The prepare is picture-only (`prepareAvatarChange`): the text fields are
// omitted, which the contract reads as untouched, so nothing the reader did
// not see here is restated or cleared by it.
//
// THE PICTURE'S REFUSALS ARE HELD AT DESIGN (round 50 is redrawing the upload
// failure and the refused / too-big picture). Until then they read today's
// lines, the edit's words in the edit's place (over the commit), and nothing
// more is built for them here.
//
// THE WAYS OUT: the crop's arrow returns to its opener, the profile (seam
// 335, 325-2); the seal's arrow returns to the crop as it was framed
// (AvatarSeal.md:41-43); either X leaves, nothing signed; a change closed on
// while it signs goes on and lands under the profile's head (`ChangeSeal`).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchMyProfile, prepareAvatarChange, type MediaSelection } from "@/lib/api/profile-api";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { avatarExpectation, type MediaLedger } from "@/lib/compose/payload-expectation";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { uploadProfilePicture } from "@/lib/profile/avatar-upload";
import { heldPicture, releaseHeldPicture } from "@/lib/profile/held-picture";
import { outcomeOf, PROFILE_SIGNED } from "@/lib/profile/profile-change";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { expectation, profileUpdate } from "@/lib/signing/intent";
import { useWriteSigner } from "@/lib/signing/provider";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { firstRefusalMessage } from "@/lib/ui/error-messages";
import { TransportError } from "@/lib/ui/transport-error";
import { CENTERED, type Crop } from "@/lib/ui2/media/crop";
import { AvatarCrop } from "../edit/avatar-crop";
import { PictureDisc } from "../edit/profile-media-field";
import { AvatarSeal } from "./avatar-seal";

/** Where the flow returns: the profile that opened it. */
const OPENER = "/profile";

/** The staged change the seal holds and signs. */
type Staged = {
  readonly writes: readonly StagedWriteView[];
  readonly selection: MediaSelection;
  readonly ledger: MediaLedger;
};

/** What stopped Next: a line in today's words, or no answer at all. */
type Problem = { readonly kind: "line"; readonly message: string } | { readonly kind: "unreachable" };

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
  const [staging, setStaging] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [staged, setStaged] = useState<Staged | null>(null);

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

  const next = async () => {
    // Next refuses a second press while the change is being staged.
    if (staging) return;
    setStaging(true);
    setProblem(null);
    // The picture goes up BEFORE the change is prepared: an update naming an
    // asset that does not exist yet would be refused.
    const uploaded = await uploadProfilePicture(client, guard, { file, crop });
    if (uploaded.kind === "problem") {
      setStaging(false);
      setProblem({ kind: "line", message: uploaded.message });
      return;
    }
    const prepared = await guard.run(() => prepareAvatarChange(client, uploaded.selection));
    setStaging(false);
    if (prepared.kind === "refused") {
      setProblem({ kind: "line", message: firstRefusalMessage(prepared.errors, "The server refused this update.") });
      return;
    }
    if (prepared.kind === "failed") {
      setProblem({ kind: "unreachable" });
      return;
    }
    // AvatarCrop.md:17: from the badge, Next opens the picture's own seal.
    setStaged({ writes: prepared.value, selection: uploaded.selection, ledger: uploaded.ledger });
  };

  if (staged !== null) {
    // One profile update on this device's own profile, its payload held to
    // the avatar this device uploaded and no other field. Without the
    // profile's own id there is nothing to bind it to, and the batch is
    // refused rather than signed.
    const expected = expectation([profileUpdate(avatarExpectation(profileNode ?? "", staged.selection, staged.ledger))]);
    return (
      <AvatarSeal
        avatar={
          <PictureDisc name={name} currentUrl={null} choice={{ kind: "picked", file, crop }} testId="avatar-seal-avatar" />
        }
        hasKey={async () => keyOnDevice !== false && (await store.actorKey()) !== null}
        sign={async () => outcomeOf(await signer.sign(staged.writes, expected))}
        onTaken={() => {
          carrySnackbar(PROFILE_SIGNED);
          leave();
        }}
        onBack={() => setStaged(null)}
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
        problem === null ? null : problem.kind === "unreachable" ? (
          <TransportError testId="avatar-crop-transport" />
        ) : (
          <p role="alert" data-testid="avatar-crop-refused" className="m-0 text-body-small text-error">
            {problem.message}
          </p>
        )
      }
    />
  );
}
