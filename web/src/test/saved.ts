// THE SAVE ROW'S SHARED TEST HARNESS (saved-surface packet, "Test duty per
// row"): the bookmark verbs answered over MSW, with a log of what each menu
// sent, so every menu's test pins the one behaviour the same way.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

export type BookmarkLog = {
  /** Every `setBookmark`: the node, and the restore time an Undo passed. */
  sets: { node: string; at: string | null }[];
  removes: string[];
};

export function bookmarkLog(): BookmarkLog {
  return { sets: [], removes: [] };
}

const UNREACHABLE = [{ message: "unreachable", extensions: { code: "INTERNAL" } }];

/** `setBookmark` / `removeBookmark`, answering ok — or failing when told. */
export function bookmarkHandlers(
  log: BookmarkLog,
  {
    failSet = false,
    failRemove = false,
    keptAt = "2026-10-13T12:00:00Z",
  }: { failSet?: boolean; failRemove?: boolean; keptAt?: string } = {},
) {
  return [
    gqlLink.mutation("SetBookmark", ({ variables }) => {
      log.sets.push({
        node: variables.node as string,
        at: (variables.bookmarkedAt as string | null) ?? null,
      });
      // A fresh body per answer: a response body is read once.
      if (failSet) return HttpResponse.json({ data: null, errors: UNREACHABLE });
      return HttpResponse.json({
        data: {
          setBookmark: {
            __typename: "SetBookmarkPayload",
            bookmark: {
              __typename: "BookmarkEdge",
              cursor: "c",
              bookmarkedAt: (variables.bookmarkedAt as string | null) ?? keptAt,
            },
            userErrors: [],
          },
        },
      });
    }),
    gqlLink.mutation("RemoveBookmark", ({ variables }) => {
      log.removes.push(variables.node as string);
      if (failRemove) return HttpResponse.json({ data: null, errors: UNREACHABLE });
      return HttpResponse.json({
        data: { removeBookmark: { __typename: "RemoveBookmarkPayload", ok: true, userErrors: [] } },
      });
    }),
  ];
}
