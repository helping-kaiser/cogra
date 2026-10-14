// The hidden-actors list, lifted into outcomes (api-spec.md "Private viewer
// state", `User.hiddenActors`, `hideActor`, `unhideActor`). Authenticated-only
// and never member-gated: an applicant hides like a member.

import type { ApolloClient } from "@apollo/client";

import {
  HiddenActorsPageDocument,
  HideActorDocument,
  UnhideActorDocument,
  type HiddenActorsPageQuery,
} from "@/__generated__/graphql";
import type { HiddenEntry } from "@/lib/hidden/hidden-set";
import { payloadOutcome, success, viewerField, type Outcome } from "./outcome";

type HiddenEdge = NonNullable<
  NonNullable<HiddenActorsPageQuery["me"]>["hiddenActors"]
>["edges"][number];

/**
 * One row as the store holds it. A deleted account reads REDACTED in its name
 * (ER-G10, design digest item 19) and serves no handle the row may print.
 */
function entryOf(edge: HiddenEdge): HiddenEntry {
  const node = edge.node;
  const redacted = node.displayName.status === "REDACTED";
  const avatar = "avatar" in node ? node.avatar : null;
  return {
    id: node.id,
    handle: redacted ? null : node.handle,
    displayName: redacted ? null : node.displayName.value || null,
    avatarUrl: redacted || avatar?.status === "REDACTED" ? null : (avatar?.url ?? null),
    redacted,
    hiddenAt: edge.hiddenAt,
  };
}

/** How many pages the whole set may take before the read gives up (100 apiece). */
const MAX_PAGES = 50;

/**
 * The reader's whole hidden set, newest first. A null `me` is the shared
 * UNAUTHENTICATED refusal, so the auth guard refreshes a stale token and
 * replays.
 */
export async function fetchHiddenActors(client: ApolloClient): Promise<Outcome<HiddenEntry[]>> {
  const entries: HiddenEntry[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const fetched = await viewerField(
      () =>
        client.query({
          query: HiddenActorsPageDocument,
          variables: { after },
          fetchPolicy: "network-only",
        }),
      (data) => data.me?.hiddenActors,
    );
    if (fetched.kind !== "success") return fetched;
    entries.push(...fetched.value.edges.map(entryOf));
    if (!fetched.value.pageInfo.hasNextPage) break;
    after = fetched.value.pageInfo.endCursor ?? null;
    if (after === null) break;
  }
  return success(entries);
}

/**
 * Hides an actor; succeeds with the moment the server holds. `at` restores an
 * unhidden row's own time, which is how Undo puts the row back where it was.
 */
export function hideActor(
  client: ApolloClient,
  actor: string,
  at: string | null = null,
): Promise<Outcome<string>> {
  return payloadOutcome(
    () => client.mutate({ mutation: HideActorDocument, variables: { actor, hiddenAt: at } }),
    (data) => data.hideActor.userErrors,
    (data) => data.hideActor.hidden?.hiddenAt ?? null,
  );
}

/** Unhides an actor; unhiding one not hidden is ok. */
export function unhideActor(client: ApolloClient, actor: string): Promise<Outcome<true>> {
  return payloadOutcome(
    () => client.mutate({ mutation: UnhideActorDocument, variables: { actor } }),
    (data) => data.unhideActor.userErrors,
    (data) => (data.unhideActor.ok === true ? true : null),
  );
}
