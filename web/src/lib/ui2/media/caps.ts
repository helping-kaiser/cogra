// The product's byte caps, and the numbers screens are allowed to say.
//
// THE CAPS ARE MiB; THE SCREENS WRITE MB (design/backlog.md item 31, round 2
// point 5). The two are not the same number and the difference is deliberate:
// 100 MiB is 104.9 MB, so a screen that says "100 MB" names a SMALLER figure
// than the one actually enforced. That under-promise is the point — the
// readable number can never refuse a file the product would have taken, which
// is the failure worth designing against. Saying "104.9 MB" would be precise
// and useless; saying "100 MB" is readable and safe.
//
// Every check in the codebase compares against the MiB constant. Only display
// goes through `megabytes`.
//
// The four byte figures are the SERVER'S, not this app's: `client-constants.json`
// exports them and `lib/client-constants.test.ts` pins every one of them to it,
// so a cap that moves on the backend fails here rather than reaching a reader as
// an upload the composer accepted and the server refused.

/** One still, matching the server's `DEFAULT_MAX_UPLOAD_BYTES`. */
export const PICTURE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * One video in a post, matching the server's `DEFAULT_MAX_VIDEO_UPLOAD_BYTES`.
 *
 * The parity is with the post's BODY rather than with one picture: ten stills
 * at their cap and one video at this one are the same hundred mebibytes.
 */
export const POST_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/**
 * One video in a comment — half the post's budget.
 *
 * The shape mirrors the post at half the bytes: a comment carries four pictures
 * or one video, where a post carries ten or one. Its cover rides the ordinary
 * still cap on top, exactly as a post's does.
 */
export const COMMENT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/**
 * When a file stops going in one request and starts going in parts.
 *
 * One part size, which is the server's default: "below 8 MiB a single-shot
 * `uploadMedia` is one round trip and resumability buys nothing, while every
 * video and any still near its cap belongs on this path" (api-spec.md,
 * "Resuming a large upload"). Android's `RESUMABLE_THRESHOLD_BYTES` is the
 * same number for the same reason.
 *
 * It is not a cap and never refuses anything — it only picks which of the two
 * upload paths a video takes.
 */
export const RESUMABLE_THRESHOLD_BYTES = 8 * 1024 * 1024;

/**
 * The readable figure for a cap, as screens write it.
 *
 * The mebibyte count is rendered with an MB label rather than converted — that
 * IS the under-promise: 100 MiB prints as "100 MB", which is less than the
 * 104.9 MB actually allowed.
 */
export function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
