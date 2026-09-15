// The reference surface (references.graphql; post.md §3, comment.md §3):
// the finder's lookup and the two standalone gestures the edit surfaces
// stage. References declared at creation ride the content prepares
// instead, batched onto the minting record.
//
// D20 fixes the vocabulary: the user-facing word is Reference, and a
// reference whose target is a person is a MENTION.

import type { ApolloClient } from "@apollo/client";

import {
  CitedByCountDocument,
  CitedByDocument,
  PrepareReferenceDocument,
  PrepareReferenceWithdrawalDocument,
  ReferenceCandidatesDocument,
  type CitedByQuery,
} from "@/__generated__/graphql";
import {
  newReferenceDraft,
  type ReferenceDraft,
} from "@/lib/references/draft";
import { isQueryable, targetView } from "@/lib/references/normalize";
import { CONTENT_PAGE_SIZE, type Page } from "./content-api";
import { fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

/** How many candidates one lookup asks for. */
export const CANDIDATE_LIMIT = 10;

/**
 * The finder's lookup (D20). Exact-match resolution today; real search
 * arrives in slice 2.7 behind this same field, so nothing here changes
 * when the implementation is replaced.
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
    /** Effort `f`; omit for the server default `+0.1`. */
    relevance?: number;
    /** Enthusiasm `e`; omit for the server default `+0.1`. */
    support?: number;
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
            relevance: fields.relevance ?? null,
            support: fields.support ?? null,
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

/**
 * One citing artifact, as the cited-by sheet draws it: the record's own
 * signed pair, plus the artifact the citation was built into.
 */
export type CitingRecordView = CitedByQuery["records"]["edges"][number]["node"];

/**
 * A page of what cites a node, newest-first, with the count of the whole
 * match beside it.
 *
 * The read is terminal-anchored rather than node-anchored: a Reference
 * is a hyper act, so a node sits on the target end of two different legs
 * — the T leg of the citations aimed at it, and the A leg of the ones it
 * made itself. Only the terminal leg answers "what cites this".
 */
export async function fetchCitedBy(
  client: ApolloClient,
  nodeId: string,
  after: string | null = null,
): Promise<Outcome<Page<CitingRecordView> & { total: number }>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: CitedByDocument,
      variables: { id: nodeId, first: CONTENT_PAGE_SIZE, after },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const records = fetched.value.records;
  return success({
    items: records.edges.map((edge) => edge.node),
    endCursor: records.pageInfo.endCursor ?? null,
    hasNextPage: records.pageInfo.hasNextPage,
    total: records.totalCount ?? 0,
  });
}

/**
 * How many artifacts cite this one — the number the detail card's line
 * reads to know whether to draw itself at all.
 *
 * Null counts as zero: the contract leaves the count nullable, and a
 * count the server cannot state is not a count a line can print.
 */
export async function fetchCitedByCount(
  client: ApolloClient,
  nodeId: string,
): Promise<Outcome<number>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: CitedByCountDocument,
      variables: { id: nodeId },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.records.totalCount ?? 0);
}
