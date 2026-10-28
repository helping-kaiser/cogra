// The reference surface (references.graphql; post.md §3, comment.md §3):
// the finder's lookup and the two standalone gestures the edit surfaces
// stage. References declared at creation ride the content prepares
// instead, batched onto the minting record.
//
// D20 fixes the vocabulary: the user-facing word is Reference, and a
// reference whose target is a person is a MENTION.

import type { ApolloClient } from "@apollo/client";

import {
  CitingRecordsDocument,
  PrepareReferenceDocument,
  PrepareReferenceWithdrawalDocument,
  ReferenceCandidatesDocument,
  type CitingRecordsQuery,
} from "@/__generated__/graphql";
import {
  newReferenceDraft,
  type ReferenceDraft,
} from "@/lib/references/draft";
import {
  foldCitingArtifacts,
  type CitingArtifact,
  type ReferenceRecord,
} from "@/lib/references/citing-fold";
import { isQueryable, targetView } from "@/lib/references/normalize";
import { fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

/** How many candidates one lookup asks for. */
export const CANDIDATE_LIMIT = 10;

/**
 * The finder's lookup (D20), served by the one search matcher (slice 2.7):
 * names and titles, exact matches first. The matcher arrived behind this
 * same field, so nothing here changed.
 *
 * A query that resolves nothing never leaves the browser — the server
 * would answer with an empty list anyway, and a finder runs on every
 * keystroke.
 */
export async function fetchReferenceCandidates(
  client: ApolloClient,
  query: string,
  limit: number = CANDIDATE_LIMIT,
): Promise<Outcome<readonly ReferenceDraft[]>> {
  if (!isQueryable(query)) return success([]);
  const fetched = await fetchOutcome(() =>
    client.query({
      query: ReferenceCandidatesDocument,
      variables: { query: query.trim(), limit },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  // A candidate is only ever built from what CoGra can display, so its
  // target is non-null — the picker hands back a chip ready to draft.
  return success(
    fetched.value.referenceCandidates.map((candidate) =>
      newReferenceDraft(
        candidate.targetId,
        targetView(candidate.target, candidate.targetId),
      ),
    ),
  );
}

/**
 * The standalone Reference gesture (D10): adds a reference to existing
 * content, or re-declares one at new parameters. Never rides the
 * post/comment edit form (D14) — each is its own priced act.
 */
export async function prepareReference(
  client: ApolloClient,
  fields: {
    /** The citing artifact — the post or comment the reference hangs off. */
    artifact: string;
    /** The cited node's L2 id. */
    target: string;
    /** Effort `f`, as the UI shows it. Required: the server fills nothing in. */
    relevance: number;
    /** Enthusiasm `e`, as the UI shows it. Required, likewise. */
    support: number;
  },
): Promise<Outcome<readonly StagedWriteView[]>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareReferenceDocument,
        variables: {
          input: {
            artifact: fields.artifact,
            target: fields.target,
            relevance: fields.relevance,
            support: fields.support,
          },
        },
      }),
    (data) => data.prepareReference.userErrors,
    (data) => data.prepareReference.writes?.map(stagedFromPrepared) ?? null,
  );
}

/**
 * Withdrawing one reference (D11). Reference withdrawal is per-leg net
 * stance, so the server assembles counter-records until the bundle
 * reaches `(0, 0)` — the returned batch is the QUOTED COST, one priced
 * act per write, and the only place that count is known truthfully.
 * `ReferenceClaim` serves the clipped fold, not the raw sums, so the
 * client can only lower-bound it.
 */
export async function prepareReferenceWithdrawal(
  client: ApolloClient,
  fields: { artifact: string; target: string },
): Promise<Outcome<readonly StagedWriteView[]>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareReferenceWithdrawalDocument,
        variables: { input: { artifact: fields.artifact, target: fields.target } },
      }),
    (data) => data.prepareReferenceWithdrawal.userErrors,
    (data) => data.prepareReferenceWithdrawal.writes?.map(stagedFromPrepared) ?? null,
  );
}

/** The artifact a citation was built into, as the cited-by row names it. */
export type CitingTarget = NonNullable<
  CitingRecordsQuery["records"]["edges"][number]["node"]["target"]
>;

/** One standing citation of this node: a cited-by row. */
export type CitingArtifactView = CitingArtifact<CitingTarget | null>;

/** How many pages the whole set may take before the read gives up (100 apiece). */
const MAX_PAGES = 50;

/**
 * Everything that cites a node, newest first — one row per standing
 * citation, however many records it took, and none for a withdrawn one
 * (`citing-fold.ts`). The whole set is read because a bundle's net needs
 * every record in it; the detail's `Cited by N` and the sheet's rows are this
 * one answer, so the count is checkable against the list.
 *
 * The read is terminal-anchored rather than node-anchored: a Reference is a
 * hyper act, so a node sits on the target end of two different legs — the T
 * leg of the citations aimed at it, and the A leg of the ones it made itself.
 * Only the terminal leg answers "what cites this".
 */
export async function fetchCitingArtifacts(
  client: ApolloClient,
  nodeId: string,
): Promise<Outcome<readonly CitingArtifactView[]>> {
  const records: ReferenceRecord<CitingTarget | null>[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const fetched = await fetchOutcome(() =>
      client.query({
        query: CitingRecordsDocument,
        variables: { id: nodeId, after },
        fetchPolicy: "network-only",
      }),
    );
    if (fetched.kind !== "success") return fetched;
    const connection = fetched.value.records;
    for (const { node } of connection.edges) {
      records.push({ ...node, targetId: node.targetId ?? node.id, target: node.target ?? null });
    }
    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor ?? null;
    if (after === null) break;
  }
  return success(foldCitingArtifacts(records));
}
