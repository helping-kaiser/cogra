// THE ALREADY-PUBLISHED MARKER'S READ, answered by default (ComposeDetails.md:
// the marker stands only GIVEN a match): no published post carries the stage's
// media. Every composer test that lands an upload reaches this read; a test of
// the marker itself answers it with its own post.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

export const NOTHING_PUBLISHED = [
  gqlLink.query("OwnPublishedPlacement", () => HttpResponse.json({ data: { ownPublishedPlacement: null } })),
];
