// A page's stance faces in one request (`PageStances`): the seam over the
// real operations, driven against MSW. What it pins: how many requests a
// page of controls sends, that each face is what its own root read gives,
// that the two views never answer each other, that an act names the node
// the slot named, and that nothing a face read is left in the cache.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import { createGuard, type AuthGuard } from "@/lib/session/guard";
import { createTokenStore } from "@/lib/session/token-store";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { expectation, stanceRecord, type Expectation } from "@/lib/signing/intent";
import type { WriteSigner } from "@/lib/signing/write-signer";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApolloStanceData, PAGE_STANCES_CHUNK } from "./apollo-stance-data";
import type { StanceTarget, StanceTargetKind } from "./stance-data";

const server = startMswServer();

/** Passes everything through; the replay has its own test below. */
const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };

function client(cache = new InMemoryCache()) {
  return new ApolloClient({ cache, link: new HttpLink({ uri: "http://localhost/graphql" }) });
}

function signer(): WriteSigner & { expected: unknown[] } {
  const expected: unknown[] = [];
  return {
    expected,
    signStaged: vi.fn(async (staged: StagedWriteView) => ({ kind: "done" as const, id: staged.id, state: "RELAYING" as const })),
    sign: vi.fn(async (writes: readonly StagedWriteView[], intent: Expectation) => {
      expected.push(intent);
      return writes.map((staged) => ({ kind: "done" as const, id: staged.id, state: "RELAYING" as const }));
    }),
    signCarriedAtLanding: vi.fn(async () => []),
    resume: vi.fn(async () => []),
  };
}

const TYPENAME: Record<Exclude<StanceTargetKind, "topic">, string> = {
  post: "Post",
  comment: "Comment",
  profile: "User",
};
const ROOT: Record<Exclude<StanceTargetKind, "topic">, [operation: string, field: string]> = {
  post: ["PostStance", "post"],
  comment: ["CommentStance", "comment"],
  profile: ["ProfileStance", "user"],
};

/** A page of cards as the feed mixes them: posts, comments, people. */
function page(count: number, prefix = "n"): StanceTarget[] {
  const kinds = ["post", "comment", "profile"] as const;
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, kind: kinds[i % 3] }));
}

/** Each target's own standing — distinct per id and per view, so a face read from the wrong slot or view shows. */
function wire(id: string, includePending: boolean, era = 0) {
  const n = Number(id.replace(/\D/g, "")) || 1;
  const pDirected = Math.round((((n % 9) + 1) / 10 + era / 100) * 100) / 100;
  const pInterest = includePending ? 0.3 : -0.3;
  return {
    __typename: "StanceBundle",
    targetGraphId: `graph:${id}`,
    pDirected,
    pInterest,
    rawPDirected: pDirected,
    rawPInterest: pInterest,
    recordCount: includePending ? 3 : 2,
    inert: false,
    severed: false,
    severanceCost: includePending ? 3 : 2,
    projected: null,
  };
}

type Asked = { operation: string; ids: string[]; includePending: unknown };

/**
 * The server for a set of targets: the page read and each root read, both
 * answering the same standings, and a log of every stance request sent.
 * `era` moves every standing — what an account change or an act does.
 */
function stanceServer(targets: readonly StanceTarget[]) {
  const asked: Asked[] = [];
  const kindOf = new Map(targets.map((target) => [target.id, target.kind]));
  const state = { era: 0 };
  const roots = (["post", "comment", "profile"] as const).map((kind) => {
    const [operation, field] = ROOT[kind];
    return gqlLink.query(operation, ({ variables }) => {
      const id = String(variables.id);
      asked.push({ operation, ids: [id], includePending: variables.includePending });
      // A root answers only an id of its own class, as the server does.
      return HttpResponse.json({
        data: {
          [field]:
            kindOf.get(id) === kind
              ? { __typename: TYPENAME[kind], id, viewerStance: wire(id, Boolean(variables.includePending), state.era) }
              : null,
        },
      });
    });
  });
  server.use(
    ...roots,
    gqlLink.query("PageStances", ({ variables }) => {
      const ids = (variables.ids as unknown[]).map(String);
      asked.push({ operation: "PageStances", ids, includePending: variables.includePending });
      return HttpResponse.json({
        data: {
          nodes: ids.map((id) => {
            const kind = kindOf.get(id);
            return kind === undefined || kind === "topic"
              ? null
              : {
                  __typename: TYPENAME[kind],
                  id,
                  viewerStance: wire(id, Boolean(variables.includePending), state.era),
                };
          }),
        },
      });
    }),
  );
  return { asked, state };
}

describe("a page's faces", () => {
  it("carries the server's cap on one lookup", () => {
    const constants = JSON.parse(
      readFileSync(join(process.cwd(), "..", "client-constants.json"), "utf-8"),
    ) as { paging: { maxPageSize: number } };
    expect(PAGE_STANCES_CHUNK).toBe(constants.paging.maxPageSize);
  });

  it("a page of twenty controls sends one stance request, not twenty", async () => {
    const targets = page(20);
    const { asked } = stanceServer(targets);
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const outcomes = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(asked.map((a) => a.operation)).toEqual(["PageStances"]);
    expect(asked[0].ids).toEqual(targets.map((target) => target.id));
    expect(outcomes.every((outcome) => outcome.kind === "success")).toBe(true);
  });

  it("gives every face exactly what its own read gives, in both views", async () => {
    const targets = page(20);
    stanceServer(targets);
    for (const includePending of [true, false]) {
      const batched = createApolloStanceData({ client: client(), guard, signer: signer() });
      const together = await Promise.all(targets.map((target) => batched.bundle(target, { includePending })));
      const alone = createApolloStanceData({ client: client(), guard, signer: signer() });
      for (const [index, target] of targets.entries()) {
        expect(together[index]).toEqual(await alone.bundle(target, { includePending }));
      }
    }
  });

  it("never answers one view from the other — each view is its own request", async () => {
    const targets = page(6);
    const { asked } = stanceServer(targets);
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const [l2, l1] = await Promise.all([
      Promise.all(targets.map((target) => data.bundle(target))),
      Promise.all(targets.map((target) => data.bundle(target, { includePending: false }))),
    ]);
    expect(asked.map((a) => [a.operation, a.includePending])).toEqual([
      ["PageStances", true],
      ["PageStances", false],
    ]);
    expect(l2[0]).toMatchObject({ value: { current: { pInterest: 0.3 }, records: 3 } });
    expect(l1[0]).toMatchObject({ value: { current: { pInterest: -0.3 }, records: 2 } });
  });

  it("asks each id once however many controls show it", async () => {
    const targets = page(3);
    const { asked } = stanceServer(targets);
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const outcomes = await Promise.all([...targets, targets[0]].map((target) => data.bundle(target)));
    expect(asked).toHaveLength(1);
    expect(asked[0].ids).toEqual(["n1", "n2", "n3"]);
    expect(outcomes[3]).toEqual(outcomes[0]);
  });

  it("chunks a page longer than the server's cap", async () => {
    const targets = page(PAGE_STANCES_CHUNK + 50);
    const { asked } = stanceServer(targets);
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const outcomes = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(asked.map((a) => [a.operation, a.ids.length])).toEqual([
      ["PageStances", PAGE_STANCES_CHUNK],
      ["PageStances", 50],
    ]);
    expect(outcomes.every((outcome) => outcome.kind === "success")).toBe(true);
  });

  it("a control asking alone reads its own root, as it always did", async () => {
    const targets = page(3);
    const { asked } = stanceServer(targets);
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    await data.bundle(targets[1]);
    expect(asked).toEqual([{ operation: "CommentStance", ids: ["n2"], includePending: true }]);
  });

  it("an act signs toward the node the page read's slot named", async () => {
    const targets = page(3);
    stanceServer(targets);
    server.use(
      gqlLink.mutation("PrepareStance", () =>
        HttpResponse.json({
          data: {
            prepareStance: {
              __typename: "PreparePayload",
              writes: [{ __typename: "PreparedWrite", id: "w-1", family: "OPINION", canonicalProposal: "cA==" }],
              userErrors: [],
            },
          },
        }),
      ),
    );
    const sign = signer();
    const data = createApolloStanceData({ client: client(), guard, signer: sign });
    await Promise.all(targets.map((target) => data.bundle(target)));
    await data.commit(targets[1], { pDirected: 0.4, pInterest: 0.1 });
    expect(sign.expected).toEqual([expectation([stanceRecord("graph:n2", 0.4, 0.1)])]);
  });

  it("after the reader's act the face reads the state the act made", async () => {
    const targets = page(4);
    const { asked, state } = stanceServer(targets);
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    await Promise.all(targets.map((target) => data.bundle(target)));
    state.era = 5;
    // The control's own re-read after its act (`fresh`), asked alone.
    const after = await data.bundle(targets[0], { fresh: true });
    expect(after).toMatchObject({ value: { current: { pDirected: 0.25 } } });
    expect(asked.map((a) => a.operation)).toEqual(["PageStances", "PostStance"]);
  });

  it("an account change never shows the previous account's face", async () => {
    const targets = page(5);
    const { asked, state } = stanceServer(targets);
    const cache = new InMemoryCache();
    const data = createApolloStanceData({ client: client(cache), guard, signer: signer() });
    const before = await Promise.all(targets.map((target) => data.bundle(target)));
    // Another reader signs in: the server answers their standings now.
    state.era = 7;
    const after = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(asked.map((a) => a.operation)).toEqual(["PageStances", "PageStances"]);
    expect(before[0]).toMatchObject({ value: { current: { pDirected: 0.2 } } });
    expect(after[0]).toMatchObject({ value: { current: { pDirected: 0.27 } } });
    // And nothing a face read stays behind in the cache the tab keeps.
    expect(JSON.stringify(cache.extract())).not.toContain("viewerStance");
  });

  it("an id the server does not know, or of a kind with no stance, is refused as its own read refuses it", async () => {
    const targets = page(3);
    const { asked } = stanceServer(targets);
    server.use(
      gqlLink.query("PageStances", ({ variables }) => {
        const ids = (variables.ids as unknown[]).map(String);
        asked.push({ operation: "PageStances", ids, includePending: variables.includePending });
        return HttpResponse.json({
          data: {
            nodes: [
              { __typename: "Post", id: "n1", viewerStance: wire("n1", true) },
              null,
              { __typename: "Chat", id: "n3" },
            ],
          },
        });
      }),
    );
    // A page with a viewer is no stale token: the faces that did answer say
    // the session stands, so nothing refreshes for the ones that did not.
    const refresh = vi.fn(async () => true);
    const data = createApolloStanceData({
      client: client(),
      guard: createGuard(createTokenStore(), { refresh }),
      signer: signer(),
    });
    const [known, unknown, chat] = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(known.kind).toBe("success");
    for (const outcome of [unknown, chat]) {
      expect(outcome.kind === "refused" && outcome.errors[0].code).toBe("UNAUTHENTICATED");
    }
    expect(asked).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a target whose id is a node of another kind is refused as its own read refuses it", async () => {
    // The server holds n2 as a comment; the reader's control names it a post.
    const held = page(3);
    const { asked } = stanceServer(held);
    const named: StanceTarget[] = [held[0], { id: "n2", kind: "post" }, held[2]];
    const alone = createApolloStanceData({ client: client(), guard, signer: signer() });
    const single = await alone.bundle(named[1]);
    expect(single.kind).toBe("refused");
    asked.length = 0;

    server.use(
      gqlLink.mutation("PrepareStance", () => {
        asked.push({ operation: "PrepareStance", ids: [], includePending: null });
        return HttpResponse.json({ data: { prepareStance: { __typename: "PreparePayload", writes: [], userErrors: [] } } });
      }),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const [post, mislabelled, profile] = await Promise.all(named.map((target) => data.bundle(target)));
    expect(asked.map((a) => a.operation)).toEqual(["PageStances"]);
    expect(mislabelled).toEqual(single);
    expect(post.kind).toBe("success");
    expect(profile.kind).toBe("success");

    // No node was remembered for it: an act asks its own root first, which
    // refuses, and nothing is prepared toward the comment's node.
    asked.length = 0;
    expect((await data.commit(named[1], { pDirected: 0.4, pInterest: 0.1 })).kind).toBe("refused");
    expect(asked.map((a) => a.operation)).toEqual(["PostStance"]);
  });

  it("a page answered with no viewer at all is refreshed and replayed whole", async () => {
    const targets = page(4);
    const classOf = new Map(targets.map((target) => [target.id, TYPENAME[target.kind as keyof typeof TYPENAME]]));
    let reads = 0;
    server.use(
      gqlLink.query("PageStances", ({ variables }) => {
        reads += 1;
        const ids = (variables.ids as unknown[]).map(String);
        return HttpResponse.json({
          data: {
            nodes: ids.map((id) => ({
              __typename: classOf.get(id),
              id,
              viewerStance: reads === 1 ? null : wire(id, true),
            })),
          },
        });
      }),
    );
    const replaying = createGuard(createTokenStore(), { refresh: async () => true });
    const data = createApolloStanceData({ client: client(), guard: replaying, signer: signer() });
    const outcomes = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(reads).toBe(2);
    expect(outcomes.every((outcome) => outcome.kind === "success")).toBe(true);
  });

  it("a page the server refused as a whole falls back to each face's own read", async () => {
    const targets = page(3);
    const { asked } = stanceServer(targets);
    server.use(
      gqlLink.query("PageStances", () => HttpResponse.json({ errors: [{ message: "Query is too complex." }] })),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const outcomes = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(asked.map((a) => a.operation).sort()).toEqual(["CommentStance", "PostStance", "ProfileStance"]);
    expect(outcomes.every((outcome) => outcome.kind === "success")).toBe(true);
  });

  it("a page that could not reach the server fails every face once, without a second wave", async () => {
    const targets = page(3);
    const { asked } = stanceServer(targets);
    server.use(gqlLink.query("PageStances", () => HttpResponse.error()));
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    const outcomes = await Promise.all(targets.map((target) => data.bundle(target)));
    expect(outcomes.every((outcome) => outcome.kind === "failed")).toBe(true);
    expect(asked).toEqual([]);
  });

  it("a topic keeps its own read and never joins the page", async () => {
    const targets = page(2);
    const { asked } = stanceServer(targets);
    let topics = 0;
    server.use(
      gqlLink.query("HashtagStance", ({ variables }) => {
        topics += 1;
        return HttpResponse.json({
          data: { hashtag: { __typename: "Hashtag", id: "h", viewerStance: wire(String(variables.name), true) } },
        });
      }),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    await Promise.all([...targets.map((target) => data.bundle(target)), data.bundle({ id: "rust", kind: "topic" })]);
    expect(topics).toBe(1);
    expect(asked.map((a) => [a.operation, a.ids])).toEqual([["PageStances", ["n1", "n2"]]]);
  });
});
