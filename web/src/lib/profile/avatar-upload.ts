// The profile picture's way up — one picked file, framed by its crop, encoded,
// weighed against the picture cap, uploaded and its echo checked — shared by
// the two entrances that change the picture: the edit's `Change picture`
// (signed with the fields under `ProfileEditSeal`) and the head's change badge
// (signed alone under `AvatarSeal`). Both need the same bytes and the same
// refusals, so the way up is written once.
//
// TWO LEGS. The encode is the device's own and answers at once: a picture this
// browser cannot read, or one over the picture cap, is refused before anything
// leaves, so it stands where the picked file is (AvatarCrop.md:43-57, the
// crop's refusal line). The upload is the network's: behind the picture's own
// seal it runs under the seal's gate (AvatarSeal.md:13-23), where a failure
// offers Retry and a refusal by the server does not (:15, :17).

import type { ApolloClient } from "@apollo/client";

import { echoes, uploadDigestOf, uploadMedia } from "@/lib/api/media-api";
import type { MediaSelection } from "@/lib/api/profile-api";
import type { MediaLedger } from "@/lib/compose/payload-expectation";
import { TOO_BIG_PICTURE } from "@/lib/compose/pick";
import { ECHO_MISMATCH } from "@/lib/compose/uploads";
import type { AuthGuard } from "@/lib/session/guard";
import { mediaRefusalMessage } from "@/lib/ui/error-messages";
import { AVATAR_RATIO } from "@/lib/ui2/media/aspect";
import { pictureTooBig } from "@/lib/ui2/media/caps";
import type { Crop } from "@/lib/ui2/media/crop";
import { encodeForUpload } from "@/lib/ui2/media/encode-image";

export const UNREADABLE_PICTURE = "This browser couldn't read that picture.";
export const REFUSED_PICTURE = "The server refused that picture.";
export const UNREACHABLE_UPLOAD = "Couldn't reach the server.";

/** The framed picture's bytes, encoded and weighed, ready to go up. */
export type EncodedPicture = {
  readonly kind: "encoded";
  readonly blob: Blob;
  readonly uploadDigest: string;
};

/**
 * Why a picture did not go up. `refused` is an answer retrying cannot change —
 * the server's refusal, or the device's own before anything left; otherwise
 * the upload failed and may be tried again (UploadNotice.jsx's two readings).
 */
export type PictureProblem = { readonly kind: "problem"; readonly message: string; readonly refused: boolean };

/** What one picture's way up came to. */
export type PictureUpload =
  | {
      readonly kind: "uploaded";
      readonly selection: Extract<MediaSelection, { readonly mediaId: string }>;
      readonly ledger: MediaLedger;
      /** The asset as it went up, which the profile's head wears once the change is taken. */
      readonly picture: { readonly id: string; readonly url: string };
    }
  | PictureProblem;

/** The device's leg: the picture in the framing its crop gave it, encoded and weighed. */
export async function encodeProfilePicture(picked: {
  readonly file: Blob;
  readonly crop: Crop;
}): Promise<EncodedPicture | PictureProblem> {
  let encoded;
  let uploadDigest: string;
  try {
    encoded = await encodeForUpload(picked.file, { ratio: AVATAR_RATIO, crop: picked.crop });
    uploadDigest = await uploadDigestOf(encoded.blob);
  } catch {
    return { kind: "problem", message: UNREADABLE_PICTURE, refused: true };
  }
  // HT-19: an avatar is a picture and takes the picture cap, in the composer's
  // own words and at the same moment — on the encoded bytes, before they go.
  if (pictureTooBig(encoded.blob)) return { kind: "problem", message: TOO_BIG_PICTURE, refused: true };
  return { kind: "encoded", blob: encoded.blob, uploadDigest };
}

/**
 * The network's leg: uploads the encoded picture and answers the asset's id
 * with the ledger the intent check holds the signed payload to.
 */
export async function uploadEncodedPicture(
  client: ApolloClient,
  guard: AuthGuard,
  encoded: EncodedPicture,
): Promise<PictureUpload> {
  const result = await guard.run(() => uploadMedia(client, { blob: encoded.blob }));
  if (result.kind === "success") {
    // The echo first: an avatar whose recorded bytes are not the ones sent is
    // never named (uploads.ts). Sending them again may land them whole, so it
    // is a failure, not a refusal.
    if (!echoes(result.value, encoded.uploadDigest)) return { kind: "problem", message: ECHO_MISMATCH, refused: false };
    return {
      kind: "uploaded",
      selection: { mediaId: result.value.id },
      picture: { id: result.value.id, url: result.value.url },
      ledger: new Map([
        [result.value.id, { digest: result.value.digest, uploadDigest: encoded.uploadDigest, mime: result.value.mimeType }],
      ]),
    };
  }
  if (result.kind === "refused") {
    const first = result.errors[0];
    return {
      kind: "problem",
      message: first === undefined ? REFUSED_PICTURE : mediaRefusalMessage(first.code, "picture"),
      refused: true,
    };
  }
  return { kind: "problem", message: UNREACHABLE_UPLOAD, refused: false };
}

/** Both legs at once, where nothing stands between them (the edit's Save). */
export async function uploadProfilePicture(
  client: ApolloClient,
  guard: AuthGuard,
  picked: { readonly file: Blob; readonly crop: Crop },
): Promise<PictureUpload> {
  const encoded = await encodeProfilePicture(picked);
  return encoded.kind === "encoded" ? uploadEncodedPicture(client, guard, encoded) : encoded;
}
