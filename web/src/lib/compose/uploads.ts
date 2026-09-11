// Getting one picked picture onto the server: crop, downscale, strip, upload.
//
// The unit is ONE asset, and that is the design rather than an accident. The
// contract takes one file per call, so a ten-picture post is ten calls; running
// them concurrently and retrying them individually means a single flaky upload
// costs one retry instead of the whole gallery, which is worth much more than
// one fat request would be (D5).

import type { ApolloClient } from "@apollo/client";

import { uploadMedia, uploadVideo, UploadPartsError } from "@/lib/api/media-api";
import type { Outcome, UserError } from "@/lib/api/outcome";
import type { AuthGuard } from "@/lib/session/guard";
import { mediaRefusalMessage } from "@/lib/ui/error-messages";
import { pictureTooBig } from "@/lib/ui2/media/caps";
import { encodeForUpload } from "@/lib/ui2/media/encode-image";
import { stripVideoMetadata } from "@/lib/ui2/media/strip-video";
import { TOO_BIG_PICTURE } from "./pick";
import type { AssetUpload, CoverAsset, PickedAsset } from "./wizard";

export type UploadStep = (next: AssetUpload) => void;

function refusalFor(errors: readonly UserError[], subject: string): string {
  const first = errors[0];
  return first === undefined
    ? `The server refused that ${subject}.`
    : mediaRefusalMessage(first.code, subject);
}

/**
 * What a transport-tier failure says.
 *
 * "Couldn't reach the server" is right for a fetch that never landed and
 * wrong for a parts run that the server answered and refused, so the parts
 * path's own sentence is kept when it carries one.
 */
function transportMessage(outcome: Outcome<unknown> & { kind: "failed" }): string {
  return outcome.cause instanceof UploadPartsError
    ? outcome.cause.message
    : "Couldn't reach the server.";
}

/**
 * Runs one asset all the way to an id, reporting each stage as it starts.
 *
 * Never throws: the caller is a fire-and-forget effect over ten of these, and a
 * rejected promise there is an unhandled rejection rather than a message the
 * reader can act on. Every failure comes back as a `failed` step instead, and
 * the two kinds are told apart because only one of them is worth a retry
 * button — a picture this browser cannot decode will not decode on the second
 * press either.
 *
 * THE UPLOAD IS GUARDED like every other authenticated call. The access token
 * lives in this tab's memory alone, so a tab that has loaded rather than signed
 * in holds none until something refreshes it — and in a composer the picture is
 * usually the FIRST authenticated call the page makes, with no earlier
 * `UNAUTHENTICATED` to have woken the refresh. Unguarded it fails on a freshly
 * loaded page and keeps failing, because the retry button re-sends the same
 * anonymous request.
 */
export async function runUpload(
  client: ApolloClient,
  guard: AuthGuard,
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
  if (pictureTooBig(encoded.blob)) {
    // Not retryable: the same source encodes to the same bytes next time.
    step({ kind: "failed", message: TOO_BIG_PICTURE, retryable: false });
    return;
  }

  step({ kind: "uploading" });
  const uploaded = await guard.run(() => uploadMedia(client, { blob: encoded.blob }));

  if (uploaded.kind === "success") {
    step({ kind: "done", mediaId: uploaded.value.id });
    return;
  }
  if (uploaded.kind === "refused") {
    // The refusal is read off its CODE, never off the server's sentence:
    // `UserError.message` is developer-facing fallback text (api-spec.md
    // § Errors). It stays retryable because a rate limit is the common case
    // and it clears.
    step({
      kind: "failed",
      message: refusalFor(uploaded.errors, "picture"),
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
 *
 * THE CLIP GOES BY WHICHEVER PATH ITS SIZE CALLS FOR. `uploadVideo` sends
 * anything at or above eight mebibytes as a resumable session whose parts are
 * retried individually, and anything smaller in one request — the same
 * boundary, on the same reasoning, as android's.
 *
 * A FACELESS CLIP STILL GOES UP. `cover` is null when the author left the face
 * unset — which the cover screen has allowed since the pick became optional
 * (jakob 2026-09-10) — and when the frame capture found nothing to offer. The
 * sequence then has no first leg: the video is uploaded naming no cover, which
 * the contract accepts. Treating null as "not ready yet" is what left a clip
 * waiting forever with nothing to report.
 */
export async function runVideoUpload(
  client: ApolloClient,
  guard: AuthGuard,
  video: PickedAsset,
  cover: CoverAsset | null,
  onVideo: UploadStep,
  onCover: UploadStep,
): Promise<void> {
  if (cover === null) {
    await sendVideo(client, guard, video, null, onVideo);
    return;
  }
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
  // A cover is an ordinary still and rides the still cap, on the encoded bytes
  // exactly as a picture does.
  if (pictureTooBig(encoded.blob)) {
    onCover({ kind: "failed", message: TOO_BIG_PICTURE, retryable: false });
    onVideo({ kind: "failed", message: "The cover didn't upload.", retryable: true });
    return;
  }

  onCover({ kind: "uploading" });
  const poster = await guard.run(() => uploadMedia(client, { blob: encoded.blob }));
  if (poster.kind !== "success") {
    const message =
      poster.kind === "refused"
        ? refusalFor(poster.errors, "cover")
        : "Couldn't reach the server.";
    onCover({ kind: "failed", message, retryable: true });
    onVideo({ kind: "failed", message: "The cover didn't upload.", retryable: true });
    return;
  }
  onCover({ kind: "done", mediaId: poster.value.id });

  await sendVideo(client, guard, video, poster.value.id, onVideo);
}

/**
 * The clip's own leg: strip, then upload naming whatever face it has.
 *
 * Shared by both entries so a faceless clip takes exactly the path a covered
 * one does, minus the cover — the alternative was a second copy of the strip
 * and its refusal wording, which is how the two drift apart.
 */
async function sendVideo(
  client: ApolloClient,
  guard: AuthGuard,
  video: PickedAsset,
  coverMediaId: string | null,
  onVideo: UploadStep,
): Promise<void> {
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
  const uploaded = await uploadVideo(client, guard, { blob: stripped.blob, coverMediaId });

  if (uploaded.kind === "success") {
    onVideo({ kind: "done", mediaId: uploaded.value.id });
    return;
  }
  if (uploaded.kind === "refused") {
    onVideo({
      kind: "failed",
      message: refusalFor(uploaded.errors, "video"),
      retryable: true,
    });
    return;
  }
  onVideo({ kind: "failed", message: transportMessage(uploaded), retryable: true });
}
