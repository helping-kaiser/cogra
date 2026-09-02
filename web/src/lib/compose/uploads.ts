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
import { stripVideoMetadata } from "@/lib/ui2/media/strip-video";
import type { AssetUpload, CoverAsset, PickedAsset } from "./wizard";

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
  const uploaded = await uploadMedia(client, { blob: encoded.blob });

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

/**
 * A video and its cover, in the one order the contract allows.
 *
 * THE COVER GOES FIRST because the video names it: `coverMediaId` is part of
 * `uploadMedia`'s input, and an asset row is immutable once written, so there
 * is no second call that could attach a poster afterwards. That makes this the
 * one upload in the app that is a SEQUENCE rather than one of ten independent
 * ones — and it is why a cover that fails fails the video too, said in those
 * words rather than leaving a video stuck at "uploading" with no explanation.
 *
 * THE CLIP IS STRIPPED BEFORE IT GOES, on the device, exactly as a picture is.
 * The still path re-encodes through a canvas and the metadata cannot survive;
 * a video is remuxed instead — its encoded packets copied into a fresh
 * container with no metadata boxes — so the quality is untouched and the tags
 * are gone. The server checks and re-strips regardless; this is the first line,
 * not the only one.
 *
 * A FAILED STRIP FAILS THE UPLOAD. Falling back to the picked bytes would
 * upload the file with its GPS tag intact, which is the outcome the strip
 * exists to prevent — so it is reported as a refusal instead, and it is not
 * retryable, because a second attempt cannot make the container readable.
 */
export async function runVideoUpload(
  client: ApolloClient,
  video: PickedAsset,
  cover: CoverAsset,
  onVideo: UploadStep,
  onCover: UploadStep,
): Promise<void> {
  let encoded;
  try {
    onCover({ kind: "encoding" });
    // No ratio: a cover is not cropped to the post's shape — it is the clip's
    // own frame, or a picture the author chose, and either keeps its shape.
    encoded = await encodeForUpload(cover.file);
  } catch {
    onCover({ kind: "failed", message: "This browser couldn't read that cover.", retryable: false });
    onVideo({ kind: "failed", message: "The cover didn't upload.", retryable: true });
    return;
  }

  onCover({ kind: "uploading" });
  const poster = await uploadMedia(client, { blob: encoded.blob });
  if (poster.kind !== "success") {
    const message =
      poster.kind === "refused"
        ? (poster.errors[0]?.message ?? "The server refused that cover.")
        : "Couldn't reach the server.";
    onCover({ kind: "failed", message, retryable: true });
    onVideo({ kind: "failed", message: "The cover didn't upload.", retryable: true });
    return;
  }
  onCover({ kind: "done", mediaId: poster.value.id });

  // The strip is reported as `encoding`: it is the same stage in the same
  // story — bytes being made ready — and inventing a fourth state for it would
  // put a word on screen that means nothing to the person reading it.
  onVideo({ kind: "encoding" });
  let stripped;
  try {
    stripped = await stripVideoMetadata(video.file);
  } catch {
    onVideo({
      kind: "failed",
      message: "This browser couldn't prepare that video.",
      retryable: false,
    });
    return;
  }

  onVideo({ kind: "uploading" });
  const uploaded = await uploadMedia(client, {
    blob: stripped.blob,
    coverMediaId: poster.value.id,
  });

  if (uploaded.kind === "success") {
    onVideo({ kind: "done", mediaId: uploaded.value.id });
    return;
  }
  if (uploaded.kind === "refused") {
    onVideo({
      kind: "failed",
      message: uploaded.errors[0]?.message ?? "The server refused that video.",
      retryable: true,
    });
    return;
  }
  onVideo({ kind: "failed", message: "Couldn't reach the server.", retryable: true });
}
