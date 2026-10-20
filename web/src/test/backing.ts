// The MSW handler for the edit pad's backing read (`PostBacking`): the
// author's own Publish bundle toward their post, as its raw sum.
//
// Keyed by post id. An id with nothing seeded — or seeded null — answers the
// way the server answers any viewer but the post's creator: a post with no
// `viewerBacking`, which the edit reads as an unread backing.

import { graphql, HttpResponse } from "msw";

export function postBackingHandler(seeded: Readonly<Record<string, number | null>> = {}) {
  return graphql.query("PostBacking", ({ variables }) => {
    const id = String(variables.id);
    const rawSum = seeded[id] ?? null;
    return HttpResponse.json({
      data: {
        post: {
          __typename: "Post",
          id,
          viewerBacking:
            rawSum === null ? null : { __typename: "BackingBundle", rawPDirected: rawSum },
        },
      },
    });
  });
}
