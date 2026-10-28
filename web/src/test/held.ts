// THE READER'S HELD TOPICS, answered by default (`User.heldTopics`): nothing
// held. Explore's Your topics door counts them on every signed-in arrival and
// the feed's filter reads them at each opening, so every test of either
// reaches these reads; a test of the held set answers them with its own.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

const NOTHING = {
  __typename: "HeldTopicConnection",
  totalCount: 0,
  edges: [],
  pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
};

export const NOTHING_HELD = [
  gqlLink.query("HeldTopicsCount", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u-viewer", heldTopics: { __typename: "HeldTopicConnection", totalCount: 0 } } } }),
  ),
  gqlLink.query("HeldTopics", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u-viewer", heldTopics: NOTHING } } }),
  ),
];
