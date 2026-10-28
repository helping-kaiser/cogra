// THE ALREADY-PUBLISHED MARKER (ComposeDetails.md, ComposeDetailsReused.md;
// copy-voice *The already-published marker*; jakob 2026-09-30).
//
// REUSING MEDIA NEVER BLOCKS (api-spec.md, "An author's bytes are one asset,
// and reusing them never refuses"). The composer marks it instead: when media
// on the stage already stands in one of the author's own published posts, one
// soft line under the media row names that post and its date, and the tap
// opens it. Where several match, the line names the EARLIEST — the origin,
// and stable: a later repost never repoints it.
//
// WHAT MATCHES. An upload of bytes the author already holds is answered with
// that asset, and a clip that re-encodes to a rendition the author holds
// resolves to it under the upload's own id with the held asset's rendition —
// so a placed asset matches the stage's media by its id OR its rendition
// digest. Only the author's own PUBLISHED posts count: a draft never reaches
// the chronicle, and another author's post is never in it.
//
// THE READ IS THE CHRONICLE, PAGED (a contract gap, named in the PR): no field
// answers "media → own published post", so this walks the viewer's Publish
// records, newest first, to their end — the earliest match can only be known
// once the oldest page is read. It stops at a page budget rather than read an
// unbounded chronicle while someone is typing a title; past it, the earliest
// match seen so far stands, and the budget is reported as a deviation.

import type { ApolloClient } from "@apollo/client";

import { OwnPublishedMediaDocument, ViewerIdDocument } from "@/__generated__/graphql";
import { fetchOutcome, success, type Outcome } from "@/lib/api/outcome";

/** What one of the stage's media is known by on the server. */
export type MediaKey = { readonly mediaId: string; readonly digest: string | null };

/** The post the line names. */
export type PublishedMatch = { readonly postId: string; readonly publishedAt: string };

/** One of the author's published posts, as the chronicle reads it. */
export type PlacedPost = {
  readonly postId: string;
  readonly createdAt: string;
  readonly assets: readonly { readonly id: string; readonly digest: string }[];
};

export const CHRONICLE_PAGE = 50;
/** The page budget: 20 pages of 50 — a thousand published posts. */
export const CHRONICLE_PAGES = 20;

/** The earliest post carrying any of `keys`, or null. Pure, so the rule is tested alone. */
export function earliestMatch(
  posts: readonly PlacedPost[],
  keys: readonly MediaKey[],
): PublishedMatch | null {
  if (keys.length === 0) return null;
  const ids = new Set(keys.map((key) => key.mediaId));
  const digests = new Set(keys.flatMap((key) => (key.digest === null ? [] : [key.digest])));
  let earliest: PublishedMatch | null = null;
  for (const post of posts) {
    if (!post.assets.some((asset) => ids.has(asset.id) || digests.has(asset.digest))) continue;
    if (earliest === null || Date.parse(post.createdAt) < Date.parse(earliest.publishedAt)) {
      earliest = { postId: post.postId, publishedAt: post.createdAt };
    }
  }
  return earliest;
}

/**
 * The marker's date, the way the chronicle's datelines read: day and month in
 * the viewer's locale conventions, the year appended only when the post's
 * year differs from the current one (`12 September`, `12 September 2025`).
 */
export function publishedOn(iso: string, now: Date = new Date(), locale?: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const sameYear = at.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(at);
}

/** The line's words, which are also the door's accessible name. */
export function publishedMarkerText(date: string): string {
  return `Already in your post from ${date}.`;
}

/** Reads the viewer's published posts and names the earliest carrying `keys`. */
export async function findPublishedMatch(
  client: ApolloClient,
  keys: readonly MediaKey[],
  pages: number = CHRONICLE_PAGES,
): Promise<Outcome<PublishedMatch | null>> {
  if (keys.length === 0) return success(null);
  const viewer = await fetchOutcome(() =>
    client.query({ query: ViewerIdDocument, fetchPolicy: "cache-first" }),
  );
  if (viewer.kind !== "success") return viewer;
  const author = viewer.value.me?.id;
  if (author === undefined) return success(null);

  const posts: PlacedPost[] = [];
  let after: string | null = null;
  for (let page = 0; page < pages; page += 1) {
    const fetched = await fetchOutcome(() =>
      client.query({
        query: OwnPublishedMediaDocument,
        variables: { author, first: CHRONICLE_PAGE, after },
        fetchPolicy: "network-only",
      }),
    );
    if (fetched.kind !== "success") return fetched;
    for (const edge of fetched.value.records.edges) {
      const target = edge.node.target;
      if (target?.__typename !== "Post") continue;
      posts.push({
        postId: target.id,
        createdAt: target.createdAt,
        assets: target.attachments.map((asset) => ({ id: asset.id, digest: asset.digest })),
      });
    }
    const info = fetched.value.records.pageInfo;
    if (!info.hasNextPage || !info.endCursor) break;
    after = info.endCursor;
  }
  return success(earliestMatch(posts, keys));
}
