// THE INBOUND LISTS' READS — who holds an opinion on a node (`NodeOpinions`)
// and what cites it (`CitingRecords`) — answered by default with nothing: the
// post detail asks both on every open, and a comment's ⋮ asks them on a tap.
// Nothing held and nothing citing is the state that draws no line at all, so a
// test that cares answers them with its own records, built here.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

const LAST_PAGE = { __typename: "PageInfo", hasNextPage: false, endCursor: null } as const;

let sequence = 0;

/** The causal key a fixture record lands at: each one later than the last. */
function nextKey() {
  sequence += 1;
  return { landingEpoch: 1, actTime: sequence, position: 0 };
}

/** One Opinion record toward the node, by `handle` (null: no account fronts the address). */
export function opinionRecord(
  handle: string | null,
  pDirected: number,
  pInterest: number,
  extra: {
    severed?: boolean | null;
    displayName?: string | null;
    redacted?: boolean;
    payloadMarked?: boolean;
  } = {},
) {
  const key = nextKey();
  return {
    __typename: "Record",
    id: `op-${sequence}`,
    authorId: `addr-${handle ?? "system"}`,
    pDirected,
    pInterest,
    severed: extra.severed ?? false,
    payloadMarked: extra.payloadMarked ?? false,
    ...key,
    author:
      handle === null
        ? null
        : {
            __typename: "User",
            id: `u-${handle}`,
            handle,
            displayName: {
              __typename: "ModeratedText",
              value: extra.redacted ? null : (extra.displayName ?? null),
              status: extra.redacted ? "REDACTED" : "NORMAL",
            },
            avatar: null,
          },
  };
}

/** One Reference record whose terminal leg lands on the node, built into `artifact`. */
export function citingRecord(
  author: string,
  artifact: { kind: "post"; id: string; title: string } | { kind: "comment"; id: string; body: string; root: string | null },
  pDirected: number,
  pInterest: number,
) {
  const key = nextKey();
  const target =
    artifact.kind === "post"
      ? {
          __typename: "Post",
          id: artifact.id,
          title: { __typename: "ModeratedText", value: artifact.title, status: "NORMAL" },
          content: { __typename: "ModeratedText", value: null, status: "NORMAL" },
          attachments: [],
          author: { __typename: "User", id: `u-${author}`, handle: author },
          removal: null,
        }
      : {
          __typename: "Comment",
          id: artifact.id,
          content: { __typename: "ModeratedText", value: artifact.body, status: "NORMAL" },
          removal: null,
          target: artifact.root === null ? null : { __typename: "Post", id: artifact.root },
        };
  return {
    __typename: "Record",
    id: `ref-${sequence}`,
    authorId: `addr-${author}`,
    targetId: `graph-${artifact.id}`,
    pDirected,
    pInterest,
    payloadMarked: false,
    ...key,
    target,
  };
}

function edges(records: readonly object[]) {
  return records.map((node) => ({ __typename: "RecordEdge", node }));
}

/** `NodeOpinions` answered with these records, on one page. */
export function nodeOpinions(records: readonly object[], onRead?: (id: string) => void) {
  return gqlLink.query("NodeOpinions", ({ variables }) => {
    onRead?.(variables.id as string);
    return HttpResponse.json({
      data: {
        node: {
          __typename: "Post",
          id: variables.id,
          incomingRecords: { __typename: "RecordConnection", edges: edges(records), pageInfo: LAST_PAGE },
        },
      },
    });
  });
}

/** `CitingRecords` answered with these records, on one page. */
export function citingRecords(records: readonly object[], onRead?: (id: string) => void) {
  return gqlLink.query("CitingRecords", ({ variables }) => {
    onRead?.(variables.id as string);
    return HttpResponse.json({
      data: {
        records: { __typename: "RecordConnection", edges: edges(records), pageInfo: LAST_PAGE },
      },
    });
  });
}

export const NOTHING_INBOUND = [nodeOpinions([]), citingRecords([])];
