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
// ONE READ ANSWERS IT (api-spec.md `Query.ownPublishedPlacement`): the
// viewer's earliest published post whose gallery carries any of the named
// uploads. The server resolves each id the way an attachment does — through a
// merge to the asset it became, matched by id or rendition digest — so a
// re-picked clip whose re-encode merged into a held asset still finds its
// post; only the viewer's own posts answer, and a draft is never published.
// The marker's date is that post's `createdAt`.

import type { ApolloClient } from "@apollo/client";

import { OwnPublishedPlacementDocument } from "@/__generated__/graphql";
import { fetchOutcome, success, type Outcome } from "@/lib/api/outcome";

/** The post the line names. */
export type PublishedMatch = { readonly postId: string; readonly publishedAt: string };

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

/** The earliest of the viewer's published posts carrying any of `mediaIds`, or null. */
export async function findPublishedMatch(
  client: ApolloClient,
  mediaIds: readonly string[],
): Promise<Outcome<PublishedMatch | null>> {
  // An empty list answers null on the server too; it is not asked at all.
  if (mediaIds.length === 0) return success(null);
  const fetched = await fetchOutcome(() =>
    client.query({
      query: OwnPublishedPlacementDocument,
      variables: { mediaIds: [...mediaIds] },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const post = fetched.value.ownPublishedPlacement;
  return success(post === null || post === undefined ? null : { postId: post.id, publishedAt: post.createdAt });
}
