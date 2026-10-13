// The release registry, lifted into an outcome (api-spec.md `appVersions`).
// The web reads its own component: "behind" has to mean a release this
// platform can actually get (release-registry packet §4.2). Anonymous like
// every read, so no guard wraps it — a stale bearer is served as a guest.
//
// The list is one row per release, so the page is the documented maximum
// and the walk follows `endCursor` while `hasNextPage` (api-spec.md
// "Pagination"); `until` stops it once the version it is looking for has
// been read, which is all the announcer needs.

import type { ApolloClient } from "@apollo/client";

import { AppVersionsDocument } from "@/__generated__/graphql";
import type { Release } from "@/lib/release/version-status";
import { fetchOutcome, success, type Outcome } from "./outcome";

export async function fetchReleases(
  client: ApolloClient,
  until?: string,
): Promise<Outcome<readonly Release[]>> {
  const releases: Release[] = [];
  let after: string | null = null;
  for (;;) {
    const fetched = await fetchOutcome(() =>
      client.query({
        query: AppVersionsDocument,
        variables: { component: "WEB", after },
        fetchPolicy: "network-only",
      }),
    );
    if (fetched.kind !== "success") return fetched;
    const page = fetched.value.appVersions;
    for (const edge of page.edges) {
      releases.push({
        version: edge.node.version,
        notes: edge.node.notes,
        patchNotesUrl: edge.node.patchNotesUrl,
        releasedAt: edge.node.releasedAt,
      });
    }
    const found = until !== undefined && releases.some((r) => r.version === until);
    if (found || !page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) {
      return success(releases);
    }
    after = page.pageInfo.endCursor;
  }
}
