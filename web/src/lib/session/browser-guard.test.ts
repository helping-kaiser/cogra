// @vitest-environment jsdom
//
// F3-5 (web): the boot race, asserted at the boundary where it was lost.
// A reloaded tab keeps its refresh token and loses its access token, so what
// this file proves is what leaves the tab first — a refresh, then the read
// carrying what the refresh minted — and that a tab with nothing to refresh
// with pays no round trip for the privilege.

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BorrowedViewDocument,
  MeDocument,
  SessionsDocument,
} from "@/__generated__/graphql";
import { createGuardedClient, guardOf } from "./browser-guard";
import { createTokenStore, type TokenStore } from "./token-store";

type Sent = { readonly operation: string; readonly authorization: string | undefined };

/** Records every request the chain makes, and answers each in its own shape. */
function captureFetch() {
  const sent: Sent[] = [];
  const fetchStub = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { operationName: string };
    const headers = init.headers as Record<string, string>;
    sent.push({ operation: body.operationName, authorization: headers.authorization });
    return new Response(JSON.stringify({ data: answerTo(body.operationName) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchStub);
  return sent;
}

function answerTo(operation: string): unknown {
  if (operation === "RefreshSession") {
    return {
      refreshSession: {
        auth: {
          accessToken: "minted-access",
          refreshToken: "rotated-refresh",
          user: { id: "acct-1" },
        },
        userErrors: [],
      },
    };
  }
  if (operation === "BorrowedView") return { borrowedView: null };
  return { me: null };
}

function clientOver(store: TokenStore) {
  return createGuardedClient(
    store,
    "http://localhost/graphql",
    (link) => new ApolloClient({ cache: new InMemoryCache(), link }),
  );
}

/** A reload: the refresh token survived in localStorage, the access token did not. */
function reloadedTab(): TokenStore {
  window.localStorage.setItem("cogra.activeAccount", "acct-1");
  window.localStorage.setItem("cogra.refreshToken", "stored-refresh");
  return createTokenStore();
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the session gate on a page's first requests", () => {
  it("refreshes first, then sends the read with the token it minted", async () => {
    const sent = captureFetch();
    const client = clientOver(reloadedTab());

    await client.query({ query: MeDocument, fetchPolicy: "network-only" });

    expect(sent.map((call) => call.operation)).toEqual(["RefreshSession", "Me"]);
    // The refresh carries no bearer — it is what mints one, and waiting for
    // readiness inside the thing that produces readiness would deadlock.
    expect(sent[0]!.authorization).toBeUndefined();
    expect(sent[1]!.authorization).toBe("Bearer minted-access");
  });

  it("sends a signed-out tab's read straight out, with no refresh and no header", async () => {
    const sent = captureFetch();
    const client = clientOver(createTokenStore());

    await client.query({ query: MeDocument, fetchPolicy: "network-only" });

    // Settled is not signed in: nothing to refresh with is an answer, and a
    // guest pays no round trip to hear it.
    expect(sent.map((call) => call.operation)).toEqual(["Me"]);
    expect(sent[0]!.authorization).toBeUndefined();
  });

  it("spends one refresh on the whole first wave of reads", async () => {
    const sent = captureFetch();
    const client = clientOver(reloadedTab());

    // Three distinct operations, so query deduplication cannot be what makes
    // the count come out right.
    await Promise.all([
      client.query({ query: MeDocument, fetchPolicy: "network-only" }),
      client.query({ query: BorrowedViewDocument, fetchPolicy: "network-only" }),
      client.query({ query: SessionsDocument, fetchPolicy: "network-only" }),
    ]);

    const refreshes = sent.filter((call) => call.operation === "RefreshSession");
    // Rotating the pair once per read would spend two refresh tokens for
    // nothing — and reuse of a rotated token is what a session's replay
    // detection treats as theft (auth.md "Reuse detection").
    expect(refreshes).toHaveLength(1);
    expect(sent.filter((call) => call.operation !== "RefreshSession")).toHaveLength(3);
    for (const call of sent.filter((call) => call.operation !== "RefreshSession")) {
      expect(call.authorization).toBe("Bearer minted-access");
    }
  });

  it("shares its single flight with the guard the surfaces prime", async () => {
    const sent = captureFetch();
    const store = reloadedTab();
    const client = clientOver(store);

    // What an upload does before it builds its bytes, and what the chain does
    // before it sends anything: one guard, so one refresh between them.
    await Promise.all([
      guardOf(client).prime(),
      client.query({ query: MeDocument, fetchPolicy: "network-only" }),
    ]);

    expect(sent.filter((call) => call.operation === "RefreshSession")).toHaveLength(1);
    expect(store.accessToken()).toBe("minted-access");
  });

  it("sends the read anyway when the refresh cannot be made", async () => {
    const sent = captureFetch();
    const store = reloadedTab();
    const client = clientOver(store);
    // A refusal that is not REFRESH_TOKEN_INVALID keeps the session and
    // settles as anonymous — offline never signs a tab out, and never leaves
    // a read waiting on a token that is not coming.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { operationName: string };
        const headers = init.headers as Record<string, string>;
        sent.push({ operation: body.operationName, authorization: headers.authorization });
        if (body.operationName === "RefreshSession") {
          return new Response("", { status: 503 });
        }
        return new Response(JSON.stringify({ data: { me: null } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await client.query({ query: MeDocument, fetchPolicy: "network-only" });

    expect(sent.map((call) => call.operation)).toEqual(["RefreshSession", "Me"]);
    expect(sent[1]!.authorization).toBeUndefined();
    // The tokens stay: a transport failure is not a sign-out.
    expect(store.refreshToken()).toBe("stored-refresh");
  });

  it("refuses a client it did not build", () => {
    const stranger = new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
    expect(() => guardOf(stranger)).toThrow(/carries no guard/);
  });
});
