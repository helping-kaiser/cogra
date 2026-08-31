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
export function uploadFilename(): string {
  return `upload.${OUTPUT_TYPE.split("/")[1]}`;
}

/**
 * Bytes, and nothing the author typed. The description rides the prepare
 * input's `AttachmentInput` instead, so a picture uploads the moment it is
 * picked and neither half waits on the other.
 */
export async function uploadMedia(
  client: ApolloClient,
  asset: { blob: Blob },
): Promise<Outcome<MediaAsset>> {
  const file = new File([asset.blob], uploadFilename(), { type: asset.blob.type });
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: UploadMediaDocument,
        variables: { input: { file } },
      }),
    (data) => data.uploadMedia.userErrors,
    (data) => data.uploadMedia.media,
  );
}
