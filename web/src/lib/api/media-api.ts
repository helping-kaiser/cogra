// The media surface: one asset up, one asset back.
//
// The bytes handed here are already the post's bytes — cropped, downscaled,
// re-encoded to WebP and stripped of metadata on the device (D11, D17) — so
// this layer only names the file and carries the alt text. It deliberately owns
// no retry: an upload that fails is retried by the composer, per asset, because
// only the composer knows which of ten pictures the reader is still waiting for.

import type { ApolloClient } from "@apollo/client";

import { UploadMediaDocument, type UploadMediaMutation } from "@/__generated__/graphql";
import { OUTPUT_TYPE } from "@/lib/ui2/media/encode-image";
import { payloadOutcome, type Outcome } from "./outcome";

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
