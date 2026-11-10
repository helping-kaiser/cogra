// The origins' next pages end where the server's list ends — and where a
// server answers a cursor it was already asked with, which would otherwise
// ask the same page forever under the stream's fill loop (W-STREAM-CURSOR-GUARD).

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import { gqlLink, startMswServer } from "@/test/msw";

import { savedOrigin } from "./origins";

const server = startMswServer();

function client() {
  return new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) });
}

const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };

/** Saved's server: every page holds nothing and names `endCursor` next. */
function serve(endCursor: string | null, hasNextPage = true) {
  const asked: (string | null)[] = [];
  server.use(
    gqlLink.query("SavedPage", ({ variables }) => {
      asked.push((variables.after as string | null | undefined) ?? null);
      return HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "me",
            bookmarks: {
              __typename: "BookmarkConnection",
              edges: [],
              pageInfo: { __typename: "PageInfo", hasNextPage, endCursor },
            },
          },
        },
      });
    }),
  );
  return asked;
}

describe("an origin's next page", () => {
  it("continues past a cursor that moved", async () => {
    const asked = serve("c4");
    const page = await savedOrigin({ client: client(), guard, after: "c3", query: "" })();
    expect(asked).toEqual(["c3"]);
    expect(page.kind === "success" && page.value.hasMore).toBe(true);
  });

  it("ends the list where the server answers the cursor it was asked with", async () => {
    serve("c3");
    const page = await savedOrigin({ client: client(), guard, after: "c3", query: "" })();
    expect(page.kind === "success" && page.value.hasMore).toBe(false);
  });

  it("ends the list where the server says it ends", async () => {
    serve(null, false);
    const page = await savedOrigin({ client: client(), guard, after: "c3", query: "" })();
    expect(page.kind === "success" && page.value.hasMore).toBe(false);
  });
});
