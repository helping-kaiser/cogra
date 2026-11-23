// WHOSE VIEW A READER BORROWS (`Query.borrowedView`, api-spec.md "Queries"),
// as the band and a guest's wide anchor read it. Null is the contract's
// answer for a reader whose view is their own.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

/** `borrowedView` answering `handle`'s actor, or null for a view of one's own. */
export function borrowedViewHandler(handle: string | null) {
  return gqlLink.query("BorrowedView", () =>
    HttpResponse.json({
      data: {
        borrowedView:
          handle === null
            ? null
            : {
                __typename: "User",
                id: `vantage-${handle}`,
                handle,
                displayName: { __typename: "ModeratedText", value: handle },
                avatar: null,
              },
      },
    }),
  );
}
