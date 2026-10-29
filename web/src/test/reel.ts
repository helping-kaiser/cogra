// Fixtures for the stream's suites: a post as the feed's read serves it (the
// `FeedPost` shape, cast once), carrying one clip of a given shape.

import type { PostView } from "@/lib/api/content-api";

const moderated = (value: string | null, status = "NORMAL") => ({ __typename: "ModeratedText", value, status });

/** One attachment: a clip of `ratio` ("9:16", "16:9", "1:1", null unprobed), or a picture for "photo". */
export function clipAttachment(id: string, ratio: string | null | "photo") {
  return {
    __typename: "MediaAttachment",
    id: `${id}-m`,
    url: `https://media.test/${id}.${ratio === "photo" ? "webp" : "mp4"}`,
    altText: null,
    status: "NORMAL",
    mimeType: ratio === "photo" ? "image/webp" : "video/mp4",
    options: { __typename: "MediaOptions", aspectRatio: ratio === "photo" ? "4:5" : ratio, durationMs: 41_000 },
    coverMedia: null,
    coverTaken: false,
  };
}

export function reelPost(
  id: string,
  ratio: string | null | "photo" = "9:16",
  over: Record<string, unknown> = {},
): PostView {
  return {
    __typename: "Post",
    id,
    title: moderated(`Clip ${id}`),
    description: moderated(`The light over the lake, ${id}`),
    content: moderated(null),
    attachments: [clipAttachment(id, ratio)],
    attachmentsStatus: "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    author: {
      __typename: "User",
      id: "u-mira",
      handle: "mira",
      displayName: { __typename: "ModeratedText", value: "Mira Voss" },
      avatar: null,
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: "2026-10-28T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    removal: null,
    genesisRecordId: `rec-${id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    viewerBookmarkedAt: null,
    comments: { __typename: "CommentConnection", totalCount: 2 },
    ...over,
  } as unknown as PostView;
}
