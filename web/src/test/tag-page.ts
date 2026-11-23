// The tag page's two reads on the wire (`topics.graphql`), served from one
// list: `HashtagDetail` names each tagged comment by id and carries every
// post whole; `TaggedComments` answers the ids it is asked for with the
// comments whole, in the order asked, null where it holds none.

import { HttpResponse } from "msw/http";

import { gqlLink } from "./gql-link";

type Row = { readonly node: Record<string, unknown> } & Record<string, unknown>;

/** What `HashtagDetail` carries for a row: a comment by its id alone. */
function named(row: Row): Row {
  const { node } = row;
  return node.__typename === "Comment" ? { ...row, node: { __typename: "Comment", id: node.id } } : row;
}

/** The log a test reads to see which ids the second read was asked for. */
export type TaggedCommentsLog = { asked: string[][] };

/**
 * The page's two handlers. `hashtag` is the `hashtag` field's body (or null
 * for a name that is not a tag); its rows hold every comment whole.
 */
export function tagPageHandlers(
  hashtag: ({ readonly taggedContent: readonly unknown[] } & Record<string, unknown>) | null,
  log: TaggedCommentsLog = { asked: [] },
) {
  const rows = (hashtag?.taggedContent ?? []) as readonly Row[];
  const comments = new Map<string, Record<string, unknown>>();
  for (const { node } of rows) {
    if (node.__typename === "Comment") comments.set(String(node.id), node);
  }
  return [
    gqlLink.query("HashtagDetail", () =>
      HttpResponse.json({
        data: { hashtag: hashtag === null ? null : { ...hashtag, taggedContent: rows.map(named) } },
      }),
    ),
    gqlLink.query("TaggedComments", ({ variables }) => {
      const ids = (variables.ids as string[] | undefined) ?? [];
      log.asked.push(ids);
      return HttpResponse.json({ data: { nodes: ids.map((id) => comments.get(id) ?? null) } });
    }),
  ];
}
