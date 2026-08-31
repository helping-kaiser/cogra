// Getting one picked picture onto the server: crop, downscale, strip, upload.
//
// The unit is ONE asset, and that is the design rather than an accident. The
// contract takes one file per call, so a ten-picture post is ten calls; running
// them concurrently and retrying them individually means a single flaky upload
// costs one retry instead of the whole gallery, which is worth much more than
// one fat request would be (D5).

import type { ApolloClient } from "@apollo/client";

import { uploadMedia } from "@/lib/api/media-api";
import { encodeForUpload } from "@/lib/ui2/media/encode-image";
import type { AssetUpload, PickedAsset } from "./wizard";

export type UploadStep = (next: AssetUpload) => void;

/**
 * Runs one asset all the way to an id, reporting each stage as it starts.
 *
 * Never throws: the caller is a fire-and-forget effect over ten of these, and a
 * rejected promise there is an unhandled rejection rather than a message the
 * reader can act on. Every failure comes back as a `failed` step instead, and
 * the two kinds are told apart because only one of them is worth a retry
 * button — a picture this browser cannot decode will not decode on the second
 * press either.
 */
export async function runUpload(
  client: ApolloClient,
  asset: PickedAsset,
  /**
   * The post's shape. Undefined on a comment, which has no crop step at all —
   * the encoder then keeps the picture's own shape rather than cutting it to a
   * ratio the author was never shown.
   */
  ratio: number | undefined,
  step: UploadStep,
): Promise<void> {
  let encoded;
  try {
    step({ kind: "encoding" });
    encoded = await encodeForUpload(asset.file, { ratio, crop: asset.crop });
  } catch {
    step({
      kind: "failed",
      message: "This browser couldn't read that picture.",
      retryable: false,
    });
    return;
  }

  step({ kind: "uploading" });
  const uploaded = await uploadMedia(client, {
    blob: encoded.blob,
    altText: asset.altText,
  });

  if (uploaded.kind === "success") {
    step({ kind: "done", mediaId: uploaded.value.id });
    return;
  }
  if (uploaded.kind === "refused") {
    // A refusal is the server's own words about these bytes — too large, wrong
    // type, over the hourly limit — so it is shown rather than paraphrased. It
    // stays retryable because a rate limit is the common case and it clears.
    step({
      kind: "failed",
      message: uploaded.errors[0]?.message ?? "The server refused that picture.",
      retryable: true,
    });
    return;
  }
  step({ kind: "failed", message: "Couldn't reach the server.", retryable: true });
}

/** Which assets an effect should start right now. */
export function waitingAssets(assets: readonly PickedAsset[]): readonly PickedAsset[] {
  return assets.filter((asset) => asset.upload.kind === "waiting");
}
