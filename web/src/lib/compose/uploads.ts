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
import { compressVideo } from "@/lib/ui2/media/compress-video";
import { encodeForUpload } from "@/lib/ui2/media/encode-image";
import { stripVideoMetadata } from "@/lib/ui2/media/strip-video";
import { TOO_BIG_PICTURE, type PickScale } from "./pick";
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
  // A token in hand before the bytes go, or they go twice — see `prime`.
  await guard.prime();
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
 * A video and its cover: two standalone assets the placement ties together.
 *
 * THE COVER GOES FIRST because it is the cheap leg. Both are ordinary uploads
 * — the poster rides `AttachmentInput` at prepare, not the clip's own call —
 * so nothing in the contract forces an order; what does is that a refused
 * cover discovered after ninety megabytes have gone up costs the author the
 * whole wait. Proving the small one first is why this is a SEQUENCE rather
 * than one of ten independent uploads, and it is why a cover that fails fails
 * the video too, said in those words rather than leaving a video stuck at
 * "uploading" with no explanation.
 *
 * THE CLIP IS COMPRESSED, THEN STRIPPED, BEFORE IT GOES. Where the browser can
 * encode H.264 and AAC, a clip outside the upload target is encoded to it
 * first (`compress-video.ts` — the same target as Android's), and a browser
 * that cannot hands the picked bytes on unchanged. Either way the result is
 * then remuxed — its encoded packets copied into a fresh container with no
 * metadata boxes — so the tags are gone on every path. The server checks,
 * re-strips and transcodes regardless; this is the first line, not the only
 * one.
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
 * sequence then has no first leg, and the placement names no poster, which the
 * contract accepts. Treating null as "not ready yet" is what left a clip
 * waiting forever with nothing to report.
 */
export async function runVideoUpload(
  client: ApolloClient,
  guard: AuthGuard,
  video: PickedAsset,
  cover: CoverAsset | null,
  onVideo: UploadStep,
  onCover: UploadStep,
  /**
   * The destination — a post's or a comment's. A long clip is encoded at the
   * rate that fits its cap, exactly as Android plans one, and a clip that still
   * comes out over it is refused in that destination's own sentence.
   */
  scale: PickScale,
): Promise<void> {
  if (cover === null) {
    await sendVideo(client, guard, video, onVideo, scale);
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
  await guard.prime();
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

  await sendVideo(client, guard, video, onVideo, scale);
}

/**
 * The clip's own leg: compress, strip, then upload.
 *
 * Shared by both entries so a faceless clip takes exactly the path a covered
 * one does — the alternative was a second copy of the strip and its refusal
 * wording, which is how the two drift apart.
 */
async function sendVideo(
  client: ApolloClient,
  guard: AuthGuard,
  video: PickedAsset,
  onVideo: UploadStep,
  scale: PickScale,
): Promise<void> {
  // The compression and the strip are both reported as `encoding`: they are
  // the same stage in the same story — bytes being made ready — and inventing
  // a further state for either would put a word on screen that means nothing
  // to the person reading it.
  onVideo({ kind: "encoding" });
  // Never throws: a browser that cannot encode, or an encode that fails, hands
  // back the picked bytes and the clip carries on exactly as it would have.
  const compressed = await compressVideo(video.file, scale.videoMaxBytes);
  // A picture that is not H.264 and was not encoded here — the pick found this
  // browser able to, and the encode then failed or was refused — is one the
  // server admits no other way. Saying so now spares the author the upload
  // that would only earn that refusal. A failure mid-encode may pass on a
  // second try; a refusal of the configuration will not.
  if (
    compressed.path !== "encoded" &&
    compressed.videoCodec !== null &&
    compressed.videoCodec !== "avc"
  ) {
    onVideo({
      kind: "failed",
      message: "This browser couldn't prepare that video.",
      retryable: compressed.path === "failed",
    });
    return;
  }
  let stripped;
  try {
    stripped = await stripVideoMetadata(compressed.blob);
  } catch {
    onVideo({
      kind: "failed",
      message: "This browser couldn't prepare that video.",
      retryable: false,
    });
    return;
  }

  // THE CAP IS WEIGHED HERE, ON WHAT WOULD BE SENT (jakob 2026-09-23: "what
  // matters is the size after compression and before upload"). The pick lets
  // an over-cap clip in wherever this browser can encode it down, so the size
  // question is only settled now — the picture path's order exactly. A clip
  // still over the cap here is one whose encode overshot or never happened;
  // sending it would cost the whole upload to earn the server's refusal. Not
  // retryable, like the picture's: the same clip comes out the same size.
  if (stripped.blob.size > scale.videoMaxBytes) {
    onVideo({ kind: "failed", message: scale.tooBigVideo, retryable: false });
    return;
  }

  onVideo({ kind: "uploading" });
  // THE CLIP IS THE BODY WORTH PROTECTING. A picture sent twice costs a
  // moment; a video sent twice is the whole wait, twice.
  await guard.prime();
  const uploaded = await uploadVideo(client, guard, { blob: stripped.blob });

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
