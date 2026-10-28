// THE ALREADY-PUBLISHED MARKER'S READS, answered by default (ComposeDetails.md:
// the marker stands only GIVEN a match): the viewer's id, and a chronicle with
// no published post in it. Every composer test that lands an upload reaches
// these reads; a test of the marker itself answers them with its own posts.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

export const NOTHING_PUBLISHED = [
  gqlLink.query("ViewerId", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u-viewer" } } }),
  ),
  gqlLink.query("OwnPublishedMedia", () =>
    HttpResponse.json({
      data: {
        records: {
          __typename: "RecordConnection",
          edges: [],
          pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
        },
      },
    }),
  ),
];
