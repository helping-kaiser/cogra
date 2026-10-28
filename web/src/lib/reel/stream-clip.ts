// WHICH ROWS ARE THE STREAM'S CLIPS — the one predicate the tap's routing and
// the stream's narrowing share (the reel packet's narrowing predicate;
// Reel.md:3).
//
// "ALWAYS the stream carries only clips taller than they are wide, from the
// list it was opened from narrowed to them in that list's order … and by no
// ranking of its own" (Reel.md:3). That is a mechanical post-rank filter over
// what the client already holds — the ranker reads no payload
// (ranked-feed-api.md:773), so a shape cut anywhere upstream would be a
// payload signal in ranking.
//
// A ROW IS A STREAM CLIP IFF all of these hold:
//
// - it is a POST — a comment's clip is square-scale and the rail acts on
//   "this post" (the packet's RL-G12 reading);
// - its body is ONE CLIP: exactly one attachment, and it is a video — "at
//   most ten pictures, or one video" (MediaAttachment.prompt.md:13);
// - nothing of it is removed: a redacted payload draws its mark, never a
//   clip to stream;
// - its probed shape is TALLER THAN WIDE: `MediaOptions.aspectRatio`, which
//   the server derives from the bytes, parses to w:h with h > w. A square
//   is the post's (readme §13: square and wider open the post), and an
//   UNPROBED shape is too — admitting a shape nobody measured would put
//   "one shape admitted" (roadmap.md:599) on a guess.
//
// THE ROUTER AND THE NARROWING CALL THIS SAME FUNCTION, so a clip whose tap
// opens the stream is always one the stream carries, and the reverse.

import { parseAspectRatio } from "@/lib/ui2/media/aspect";

/** The fields of a row the predicate reads — every list's post shape has them. */
export type StreamCandidate = {
  readonly __typename?: string;
  readonly attachmentsStatus?: string | null;
  readonly attachments?: readonly {
    readonly mimeType: string;
    readonly status?: string | null;
    readonly options: { readonly aspectRatio?: string | null };
  }[];
};

/** Whether `row` is a clip the stream carries — and so whether its media's tap opens the stream. */
export function isStreamClip(row: StreamCandidate | null | undefined): boolean {
  if (row == null || row.__typename !== "Post") return false;
  const attachments = row.attachments ?? [];
  if (attachments.length !== 1) return false;
  if (row.attachmentsStatus === "REDACTED") return false;
  const [clip] = attachments;
  if (!clip.mimeType.startsWith("video/") || clip.status === "REDACTED") return false;
  const ratio = parseAspectRatio(clip.options.aspectRatio);
  return ratio !== null && ratio < 1;
}

/** A list narrowed to its stream clips, in the list's own order — never re-ordered. */
export function streamClipsOf<T extends StreamCandidate>(rows: readonly T[]): T[] {
  return rows.filter(isStreamClip);
}
