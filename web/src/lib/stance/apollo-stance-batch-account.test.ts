// A KEPT BATCH BELONGS TO THE ACCOUNT THAT PRESSED (auth.md "Multi-account
// device custody"). Its seal closes from the press and the batch goes on
// (KeptPicksSeal.md:59), so the tab's account can change while it prepares.
// No leg may then be prepared under the next account's session, nor any of it
// signed with that account's key: the batch stops there, answered as a failure.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import type { StagedWriteView } from "@/lib/api/writes-api";
import type { WriteSigner } from "@/lib/signing/write-signer";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApolloStanceData } from "./apollo-stance-data";
import type { StanceTarget } from "./stance-data";

const server = startMswServer();

const POST: StanceTarget = { id: "post-1", kind: "post" };
const OTHER: StanceTarget = { id: "post-2", kind: "post" };
const NODE_1 = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish";
const NODE_2 = "mint:act:c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0:4:publish";
const BATCH = [
  { target: POST, pick: { pDirected: 0.4, pInterest: 0.2 } },
  { target: OTHER, pick: { pDirected: -0.1, pInterest: 0.3 } },
];

function bundle(id: string, node: string) {
  return {
    __typename: "Post",
    id,
    viewerStance: {
      __typename: "StanceBundle",
      targetGraphId: node,
      pDirected: 0,
      pInterest: 0,
      rawPDirected: 0,
      rawPInterest: 0,
      recordCount: 0,
      inert: true,
      severed: false,
      severanceCost: 0,
      projected: null,
    },
  };
}

/** The tab's account, switched from inside the server when a test says so. */
function tab(first: string) {
  let active = first;
  const listeners = new Set<() => void>();
  return {
    accounts: {
      activeAccountId: () => active,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
    switchTo: (next: string) => {
      active = next;
      for (const listener of [...listeners]) listener();
    },
    active: () => active,
  };
}

/** Every prepare, with the account the tab was signed in as when it reached the server. */
function host(account: ReturnType<typeof tab>, onPrepare: (count: number) => void = () => {}) {
  const prepares: { target: string; as: string }[] = [];
  server.use(
    gqlLink.query("PostStance", ({ variables }) =>
      HttpResponse.json({
        data: { post: variables.id === "post-1" ? bundle("post-1", NODE_1) : bundle("post-2", NODE_2) },
      }),
    ),
    gqlLink.mutation("PrepareStance", ({ variables }) => {
      const input = variables.input as { target: string };
      prepares.push({ target: input.target, as: account.active() });
      onPrepare(prepares.length);
      return HttpResponse.json({
        data: {
          prepareStance: {
            __typename: "PreparePayload",
            writes: [
              {
                __typename: "PreparedWrite",
                id: `w-${prepares.length}`,
                family: "OPINION",
                canonicalProposal: "cHJvcG9zYWw=",
                carried: false,
              },
            ],
            userErrors: [],
          },
        },
      });
    }),
  );
  return prepares;
}

function seam(account: ReturnType<typeof tab>) {
  const signedAs: string[] = [];
  const signer: WriteSigner = {
    signStaged: vi.fn(),
    sign: vi.fn(async (staged: readonly StagedWriteView[]) => {
      signedAs.push(account.active());
      return staged.map((write) => ({ kind: "done" as const, id: write.id, state: "RELAYING" as const }));
    }),
    signAgain: vi.fn(async (ids: readonly string[]) => {
      signedAs.push(account.active());
      return ids.map((id) => ({ kind: "done" as const, id, state: "RELAYING" as const }));
    }),
    signCarriedAtLanding: vi.fn(async () => []),
    resume: vi.fn(async () => []),
  };
  const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };
  const data = createApolloStanceData({
    client: new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) }),
    guard,
    signer,
    store: { clearHandshake: async () => {} },
    accounts: account.accounts,
  });
  return { data, signedAs };
}

describe("a kept batch whose tab changes account while it prepares", () => {
  it("prepares nothing more and signs nothing once the account changed after its first prepare", async () => {
    const account = tab("acct-a");
    const prepares = host(account, (count) => {
      if (count === 1) account.switchTo("acct-b");
    });
    const { data, signedAs } = seam(account);

    const outcome = await data.commitBatch(BATCH);

    expect(prepares).toEqual([{ target: "post-1", as: "acct-a" }]);
    expect(signedAs).toEqual([]);
    expect(outcome.kind).toBe("failed");
  });

  it("signs nothing when the account changed after every leg was prepared", async () => {
    const account = tab("acct-a");
    const prepares = host(account, (count) => {
      if (count === 2) account.switchTo("acct-b");
    });
    const { data, signedAs } = seam(account);

    const outcome = await data.commitBatch(BATCH);

    expect(prepares.map((p) => p.as)).toEqual(["acct-a", "acct-a"]);
    expect(signedAs).toEqual([]);
    expect(outcome.kind).toBe("failed");
  });

  // The case the signer's own author check cannot catch (intent.ts: a write
  // authored by another key is a mismatch): every leg prepared under the next
  // account is that account's own, and its key would sign the owner's picks.
  it("prepares nothing when the account changed before its first prepare", async () => {
    const account = tab("acct-a");
    const prepares = host(account);
    server.use(
      gqlLink.query("PostStance", ({ variables }) => {
        account.switchTo("acct-b");
        return HttpResponse.json({
          data: { post: variables.id === "post-1" ? bundle("post-1", NODE_1) : bundle("post-2", NODE_2) },
        });
      }),
    );
    const { data, signedAs } = seam(account);

    const outcome = await data.commitBatch(BATCH);

    expect(prepares).toEqual([]);
    expect(signedAs).toEqual([]);
    expect(outcome.kind).toBe("failed");
  });

  it("still prepares and signs the whole batch while the account stays", async () => {
    const account = tab("acct-a");
    const prepares = host(account);
    const { data, signedAs } = seam(account);

    expect((await data.commitBatch(BATCH)).kind).toBe("success");
    expect(prepares).toHaveLength(2);
    expect(signedAs).toEqual(["acct-a"]);
  });
});

// THE SAME HOLE IN THE SINGLE GESTURES. A pad or a row closes mid-signing and
// the act goes on (PadFailed.md: "CANCEL MID-SIGNING CLOSES THE SURFACE, NEVER
// THE SIGNING"), so the tab's account can change before the gesture's prepare
// or between its prepare and its signing. A prepare under the next account's
// session is that account's own stance and would pass the signer's author
// check (intent.ts `checkIntent`); a write prepared as the owner and signed
// after the switch is refused there whole. Either way the gesture stops.

/** Prepares of each kind, with the account active when each reached the server. */
function gestureHost(account: ReturnType<typeof tab>, onPrepare: () => void = () => {}) {
  const prepares = host(account, onPrepare);
  server.use(
    gqlLink.mutation("PrepareSeverance", ({ variables }) => {
      const input = variables.input as { target: string };
      prepares.push({ target: input.target, as: account.active() });
      onPrepare();
      return HttpResponse.json({
        data: {
          prepareSeverance: {
            __typename: "PreparePayload",
            writes: [{ __typename: "PreparedWrite", id: "s-1", family: "SEVERANCE", canonicalProposal: "cHJvcG9zYWw=" }],
            userErrors: [],
          },
        },
      });
    }),
  );
  return prepares;
}

/** Switches the tab the moment the target's read answers — before any prepare. */
function switchOnRead(account: ReturnType<typeof tab>) {
  server.use(
    gqlLink.query("PostStance", ({ variables }) => {
      account.switchTo("acct-b");
      return HttpResponse.json({
        data: { post: variables.id === "post-1" ? bundle("post-1", NODE_1) : bundle("post-2", NODE_2) },
      });
    }),
  );
}

const SHOWN = {
  current: { pDirected: 0.4, pInterest: 0.2 },
  rawSum: { pDirected: 0.4, pInterest: 0.2 },
  records: 1,
  inert: false,
  severed: false,
  severance: { records: 1 },
} as unknown as Parameters<ReturnType<typeof createApolloStanceData>["sever"]>[1];

const gestures = {
  commit: (data: ReturnType<typeof createApolloStanceData>) => data.commit(POST, BATCH[0].pick),
  sever: (data: ReturnType<typeof createApolloStanceData>) => data.sever(POST, SHOWN),
};

describe.each(Object.entries(gestures))("a %s whose tab changes account", (_name, gesture) => {
  it("prepares nothing and signs nothing when the account changed before its prepare", async () => {
    const account = tab("acct-a");
    const prepares = gestureHost(account);
    switchOnRead(account);
    const { data, signedAs } = seam(account);

    const outcome = await gesture(data);

    expect(prepares).toEqual([]);
    expect(signedAs).toEqual([]);
    expect(outcome.kind).toBe("failed");
  });

  it("signs nothing when the account changed between its prepare and its signing", async () => {
    const account = tab("acct-a");
    const prepares = gestureHost(account, () => account.switchTo("acct-b"));
    const { data, signedAs } = seam(account);

    const outcome = await gesture(data);

    expect(prepares.map((p) => p.as)).toEqual(["acct-a"]);
    expect(signedAs).toEqual([]);
    expect(outcome.kind).toBe("failed");
  });

  it("prepares and signs while the account stays", async () => {
    const account = tab("acct-a");
    gestureHost(account);
    const { data, signedAs } = seam(account);

    expect((await gesture(data)).kind).toBe("success");
    expect(signedAs).toEqual(["acct-a"]);
  });
});
