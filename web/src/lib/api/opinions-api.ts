// Who holds an opinion on a post or a comment (api-spec.md `Node.
// incomingRecords`, family OPINION), lifted into an outcome and folded into
// the rows the opinions sheet draws (`held-opinions.ts`).

import type { ApolloClient } from "@apollo/client";

import { NodeOpinionsDocument, type NodeOpinionsQuery } from "@/__generated__/graphql";
import { foldHeldOpinions } from "@/lib/stance/held-opinions";
import type { StancePair } from "@/lib/stance/model";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";
import { fetchOutcome, success, type Outcome } from "./outcome";

type OpinionRecordNode = NonNullable<
  NodeOpinionsQuery["node"]
>["incomingRecords"]["edges"][number]["node"];

/** The person a row is about, as `StanceRow` draws them. */
export type OpinionHolder = {
  /** The name line: the written name, else the handle, else the raw address. */
  readonly name: string;
  /** The handle line and the profile the row opens; null where there is none to open. */
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  /** A deleted account: the reserved disc and `Deleted account`. */
  readonly redacted: boolean;
};

/** One sheet row: a person and their standing opinion. */
export type HeldOpinionView = {
  readonly authorId: string;
  readonly holder: OpinionHolder;
  readonly pair: StancePair;
  readonly severed: boolean;
};

/**
 * Who the row names. A deleted account reads REDACTED in its name and serves
 * no handle the row may print (ER-G10). An address no account fronts still
 * holds its opinion and keeps its row, named by its L1 identifier — the
 * chronicle never depends on typed coverage (`RefsSheet`'s untyped citation).
 */
function holderOf(record: OpinionRecordNode): OpinionHolder {
  const author = record.author;
  if (author === null || author === undefined) {
    return { name: record.authorId, handle: null, avatarUrl: null, redacted: false };
  }
  if (author.displayName.status === "REDACTED") {
    return { name: REDACTED_ACTOR_NAME, handle: null, avatarUrl: null, redacted: true };
  }
  const avatar = author.avatar;
  return {
    name: author.displayName.value?.trim() || author.handle,
    handle: author.handle,
    avatarUrl: avatar === null || avatar === undefined || avatar.status === "REDACTED" ? null : avatar.url,
    redacted: false,
  };
}

/** How many pages the whole set may take before the read gives up (100 apiece). */
const MAX_PAGES = 50;

/**
 * Everyone holding an opinion on this node, strongest first — one row per
 * person, however many records their opinion took. The whole set is read
 * because the fold needs every record of a bundle, and the order needs every
 * bundle; the detail's count and the sheet's rows are this one answer.
 */
export async function fetchHeldOpinions(
  client: ApolloClient,
  nodeId: string,
): Promise<Outcome<readonly HeldOpinionView[]>> {
  const records: OpinionRecordNode[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const fetched = await fetchOutcome(() =>
      client.query({
        query: NodeOpinionsDocument,
        variables: { id: nodeId, after },
        fetchPolicy: "network-only",
      }),
    );
    if (fetched.kind !== "success") return fetched;
    const connection = fetched.value.node?.incomingRecords;
    if (connection === undefined) break;
    records.push(...connection.edges.map((edge) => edge.node));
    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor ?? null;
    if (after === null) break;
  }
  return success(
    foldHeldOpinions(records.map((record) => ({ ...record, author: holderOf(record) }))).map(
      (held) => ({
        authorId: held.authorId,
        holder: held.author,
        pair: held.pair,
        severed: held.severed,
      }),
    ),
  );
}
