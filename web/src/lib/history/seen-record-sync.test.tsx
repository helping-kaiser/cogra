// The sync's cadence (OS-22, PR-52): at app open and at sign-in, once per
// account per page load, never on the feed path.

import { waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { seenRecord } from "./seen-record";
import { SeenRecordSync } from "./seen-record-sync";

const server = startMswServer();

function signedIn(accountId = "acct-1") {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId });
  return store;
}

/** The reader's view log: ids, newest first, one page. */
function viewLog(ids: string[], reads: { n: number }) {
  return gqlLink.query("ViewHistoryIds", () => {
    reads.n += 1;
    return HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          viewHistory: {
            __typename: "ViewHistoryConnection",
            edges: ids.map((id, i) => ({
              __typename: "ViewHistoryEdge",
              firstSeenAt: new Date(Date.parse("2026-10-13T12:00:00Z") - i * 1000).toISOString(),
              node: { __typename: "Post", id },
            })),
            pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          },
        },
      },
    });
  });
}

describe("the seen record's sync", () => {
  // The token store persists the session; each test starts signed out.
  beforeEach(() => window.localStorage.clear());

  it("seeds the signed-in reader's record at open, once per page load", async () => {
    const reads = { n: 0 };
    server.use(viewLog(["p1", "p2"], reads));
    const first = renderWithProviders(<SeenRecordSync />, { store: signedIn() });
    await waitFor(() => expect(seenRecord.has("p2")).toBe(true));
    expect(seenRecord.account).toBe("acct-1");
    first.unmount();

    // The same account again in this load — a remount, a switch back.
    renderWithProviders(<SeenRecordSync />, { store: signedIn() });
    await new Promise((done) => setTimeout(done, 20));
    expect(reads.n).toBe(1);
  });

  it("reads nothing for a signed-out reader", async () => {
    renderWithProviders(<SeenRecordSync />);
    await new Promise((done) => setTimeout(done, 20));
    // An unhandled request would have failed the test.
    expect(seenRecord.account).toBeNull();
  });
});
