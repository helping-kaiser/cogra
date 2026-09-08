// The media surface: one asset up, one asset back.
//
// The bytes handed here are already the post's bytes — cropped, downscaled,
// re-encoded to WebP and stripped of metadata on the device (D11, D17) — so
// this layer only names the file and carries the alt text.
//
// THE SINGLE-SHOT PATH OWNS NO RETRY: a picture that fails is retried by the
// composer, per asset, because only the composer knows which of ten pictures
// the reader is still waiting for. THE RESUMABLE PATH DOES retry, per part and
// automatically — a part is small, its retry is invisible, and the alternative
// is asking an author to re-send ninety megabytes because one of a dozen parts
// blinked. The two policies are different because the units are.

import type { ApolloClient } from "@apollo/client";

import {
  AbortMediaUploadDocument,
  BeginMediaUploadDocument,
  CompleteMediaUploadDocument,
  UploadMediaDocument,
  type MediaUploadKind,
  type UploadMediaMutation,
} from "@/__generated__/graphql";
import { graphqlUri } from "@/lib/graphql-uri";
import { tokenStore } from "@/lib/session/token-store";
import type { AuthGuard } from "@/lib/session/guard";
import { RESUMABLE_THRESHOLD_BYTES } from "@/lib/ui2/media/caps";
import { OUTPUT_TYPE } from "@/lib/ui2/media/encode-image";
import { createPartUploader, uploadsOrigin, type PartUploader } from "./part-uploader";
import { failed, payloadOutcome, type Outcome } from "./outcome";

/** The asset as the contract hands it back — the id an attachment then names. */
export type MediaAsset = NonNullable<UploadMediaMutation["uploadMedia"]["media"]>;

/**
 * The server is told a filename because a multipart part carries one, and a
 * part with no name reads as a stream of unknown provenance to some parsers.
 * It is generated rather than taken from the picked file: the original name can
 * itself be personal data ("IMG_20260828_ourhouse.jpg"), and nothing downstream
 * reads it — the storage key is server-generated (D2).
 */
export function uploadFilename(type: string = OUTPUT_TYPE): string {
  // The subtype is the extension for both formats this app sends — `webp` and
  // `mp4` — so one derivation covers them and an unknown type still produces a
  // name rather than `upload.undefined`.
  return `upload.${type.split("/")[1] ?? "bin"}`;
}

/**
 * Bytes, and nothing the author typed. The description rides the prepare
 * input's `AttachmentInput` instead, so a picture uploads the moment it is
 * picked and neither half waits on the other.
 *
 * `coverMediaId` is the ONE exception, and only a video carries it. The cover
 * is part of what the video is rather than something attached to it afterwards
 * — an asset row is immutable once written — so it is named on the call that
 * creates the video, which is why the composer uploads the poster first and
 * this second.
 */
export async function uploadMedia(
  client: ApolloClient,
  asset: { blob: Blob; coverMediaId?: string },
): Promise<Outcome<MediaAsset>> {
  const file = new File([asset.blob], uploadFilename(asset.blob.type), {
    type: asset.blob.type,
  });
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: UploadMediaDocument,
        variables: {
          input:
            asset.coverMediaId === undefined
              ? { file }
              : { file, coverMediaId: asset.coverMediaId },
        },
      }),
    (data) => data.uploadMedia.userErrors,
    (data) => data.uploadMedia.media,
  );
}

/**
 * What a video needs beyond its bytes, and what a test replaces.
 *
 * The uploader is injectable because everything about the part route that a
 * suite would want to drive — the origin, the token, the clock, the network —
 * lives inside it.
 */
/**
 * A parts run that spent its budget or was refused.
 *
 * It lands in the `failed` tier because that is the tier the composer's
 * retry button reads, but it carries a sentence of its own: "couldn't reach
 * the server" is the wrong thing to print when the server answered and said
 * no.
 */
export class UploadPartsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadPartsError";
  }
}

export type ResumableDeps = {
  uploader?: PartUploader;
  /** Lowered by a suite so a test-sized file still takes the parts path. */
  thresholdBytes?: number;
};

function defaultUploader(): PartUploader {
  return createPartUploader({
    origin: uploadsOrigin(graphqlUri()),
    accessToken: () => tokenStore.accessToken(),
  });
}

/**
 * A video, by whichever of the two paths its size calls for.
 *
 * BELOW THE THRESHOLD IT IS ONE REQUEST. A session is three round trips and a
 * server-side row; for a file that fits in one part it buys nothing, and the
 * single-shot route is the one the rest of the contract already uses.
 *
 * AT OR ABOVE IT, THE PARTS PATH. Begin, parts, complete — with the parts
 * retried individually, which is the whole reason a browser should not send
 * ninety megabytes in one POST it cannot resume.
 *
 * EACH STEP IS GUARDED ON ITS OWN rather than the whole flow: `AuthGuard`
 * replays the block it wraps, and a refresh landing mid-upload must not
 * re-send a file that is most of the way up.
 */
export async function uploadVideo(
  client: ApolloClient,
  guard: AuthGuard,
  asset: { blob: Blob; coverMediaId: string },
  deps: ResumableDeps = {},
): Promise<Outcome<MediaAsset>> {
  const threshold = deps.thresholdBytes ?? RESUMABLE_THRESHOLD_BYTES;
  if (asset.blob.size < threshold) {
    return guard.run(() => uploadMedia(client, asset));
  }

  // `kind` is VIDEO at every call site: `MediaUploadKind.STILL` is reserved
  // (see media.graphql) and no client names it.
  const kind: MediaUploadKind = "VIDEO";
  const session = await guard.run(() =>
    payloadOutcome(
      () =>
        client.mutate({
          mutation: BeginMediaUploadDocument,
          variables: { declaredBytes: asset.blob.size, kind },
        }),
      (data) => data.beginMediaUpload.userErrors,
      (data) => data.beginMediaUpload.upload,
    ),
  );
  if (session.kind !== "success") return session;

  const opened = session.value;
  const uploader = deps.uploader ?? defaultUploader();
  const failure = await uploader.sendAll(
    opened.id,
    asset.blob,
    opened.partSizeBytes,
    opened.partCount,
  );
  if (failure !== null) {
    // The session is dead the moment the parts are abandoned — a retry from
    // the composer opens a new one — so the parts go back now rather than
    // sitting in the store until the sweep. Android leaves this to a
    // discarded composer; here the id is already in hand.
    await abortMediaUpload(client, opened.id);
    return failed(new UploadPartsError(failure));
  }

  // Completion is idempotent by contract, so a lost reply is worth asking
  // again for: the session remembers the asset it made and hands back the
  // same one.
  return guard.run(() =>
    payloadOutcome(
      () =>
        client.mutate({
          mutation: CompleteMediaUploadDocument,
          variables: { uploadId: opened.id, coverMediaId: asset.coverMediaId },
        }),
      (data) => data.completeMediaUpload.userErrors,
      (data) => data.completeMediaUpload.media,
    ),
  );
}

/**
 * Gives a cancelled session's parts back now rather than at expiry.
 *
 * Fire and forget: a discarded composer is not waiting to hear whether the
 * store let go, and the sweep would do it anyway.
 */
export async function abortMediaUpload(client: ApolloClient, uploadId: string): Promise<void> {
  try {
    await client.mutate({ mutation: AbortMediaUploadDocument, variables: { uploadId } });
  } catch {
    // Nothing to report to: see above.
  }
}
