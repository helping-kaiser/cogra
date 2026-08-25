// The seam over the real operations, driven against MSW: what each read
// asks for, how a bundle folding nothing is reported, and — the part
// that has no stand-in equivalent — that a severance batch is signed
// element by element in one pass.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { startMswServer } from "@/test/msw";
import { createApolloStanceData } from "./apollo-stance-data";
import type { StanceTarget } from "./stance-data";

const server = startMswServer();

const POST: StanceTarget = { id: "post-1", kind: "post" };
const PROFILE: StanceTarget = { id: "user-1", kind: "profile" };

/** Passes everything through: the replay path has its own tests. */
const guard: AuthGuard = { run: (block) => block() };

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function signer(result: (staged: StagedWriteView) => WriteResult = (s) => ({
  kind: "done",
  id: s.id,
  state: "RELAYING",
})): WriteSigner & { signed: string[] } {
  const signed: string[] = [];
  return {
    signed,
    signStaged: vi.fn(async (staged: StagedWriteView) => {
      signed.push(staged.id);
      return result(staged);
    }),
    resume: vi.fn(async () => []),
  };
}

function bundleFields(over: Record<string, unknown> = {}) {
  return {
    __typename: "StanceBundle",
    pDirected: 0.6,
    pInterest: 0.4,
    recordCount: 2,
    inert: false,
    severed: false,
    severanceCost: 2,
    projected: null,
    ...over,
  };
}

function prepared(ids: readonly string[]) {
  return ids.map((id) => ({
    __typename: "PreparedWrite",
    id,
    family: "OPINION",
    canonicalProposal: "cHJvcG9zYWw=",
  }));
}

describe("reading the standing", () => {
  it("enters through the root that matches the target", async () => {
    const asked: string[] = [];
    server.use(
      graphql.query("PostStance", () => {
        asked.push("post");
        return HttpResponse.json({
          data: { post: { __typename: "Post", id: "post-1", viewerStance: bundleFields() } },
        });
      }),
      graphql.query("ProfileStance", () => {
        asked.push("profile");
        return HttpResponse.json({
          data: { user: { __typename: "User", id: "user-1", viewerStance: bundleFields() } },
        });
      }),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    await data.bundle(POST);
    await data.bundle(PROFILE);
    expect(asked).toEqual(["post", "profile"]);
  });

  it("carries the fold's own flags rather than any reading of the numbers", async () => {
    server.use(
      graphql.query("PostStance", () =>
        HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "post-1",
              viewerStance: bundleFields({ inert: true, severed: false, severanceCost: 3 }),
            },
          },
        }),
      ),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    expect(await data.bundle(POST)).toEqual({
      kind: "success",
      value: {
        current: { pDirected: 0.6, pInterest: 0.4 },
        inert: true,
        severed: false,
        severance: { records: 3 },
      },
    });
  });

  it("reports no standing for a bundle that folds no records", async () => {
    server.use(
      graphql.query("PostStance", () =>
        HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "post-1",
              viewerStance: bundleFields({ recordCount: 0, severed: true, severanceCost: 0 }),
            },
          },
        }),
      ),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    expect(await data.bundle(POST)).toEqual({ kind: "success", value: null });
  });

  it("reports no standing where the viewer has no bundle to read at all", async () => {
    server.use(
      graphql.query("PostStance", () =>
        HttpResponse.json({
          data: { post: { __typename: "Post", id: "post-1", viewerStance: null } },
        }),
      ),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    expect(await data.bundle(POST)).toEqual({ kind: "success", value: null });
  });

  it("counts pending stances unless asked otherwise", async () => {
    const flags: unknown[] = [];
    server.use(
      graphql.query("PostStance", ({ variables }) => {
        flags.push(variables.includePending);
        return HttpResponse.json({
          data: { post: { __typename: "Post", id: "post-1", viewerStance: bundleFields() } },
        });
      }),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    await data.bundle(POST);
    await data.bundle(POST, { includePending: false });
    expect(flags).toEqual([true, false]);
  });
});

describe("projecting a pick", () => {
  it("asks the same field with the pick and reads the landing off it", async () => {
    let sentPick: unknown = null;
    server.use(
      graphql.query("PostStance", ({ variables }) => {
        sentPick = variables.pick;
        return HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "post-1",
              viewerStance: bundleFields({
                projected: {
                  __typename: "StanceProjection",
                  pDirected: 0,
                  pInterest: 0.3,
                  inert: true,
                  severed: false,
                },
              }),
            },
          },
        });
      }),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    expect(await data.project(POST, { pDirected: -0.6, pInterest: -0.1 })).toEqual({
      kind: "success",
      value: { landing: { pDirected: 0, pInterest: 0.3 }, inert: true, severed: false },
    });
    expect(sentPick).toEqual({ pDirected: -0.6, pInterest: -0.1 });
  });

  it("treats a projection the server did not answer as a fault, not as zero", async () => {
    server.use(
      graphql.query("PostStance", () =>
        HttpResponse.json({
          data: { post: { __typename: "Post", id: "post-1", viewerStance: bundleFields() } },
        }),
      ),
    );
    const data = createApolloStanceData({ client: client(), guard, signer: signer() });
    expect((await data.project(POST, { pDirected: 0.1, pInterest: 0.1 })).kind).toBe("failed");
  });
});

describe("writing", () => {
  it("stages exactly the picked pair — no delta reaches the wire", async () => {
    let input: unknown = null;
    server.use(
      graphql.mutation("PrepareStance", ({ variables }) => {
        input = variables.input;
        return HttpResponse.json({
          data: {
            prepareStance: {
              __typename: "PreparePayload",
              writes: prepared(["w-1"]),
              userErrors: [],
            },
          },
        });
      }),
    );
    const sign = signer();
    const data = createApolloStanceData({ client: client(), guard, signer: sign });
    expect(await data.commit(POST, { pDirected: -0.3, pInterest: 0.2 })).toEqual({
      kind: "success",
      value: { records: 1 },
    });
    expect(input).toEqual({ target: "post-1", pDirected: -0.3, pInterest: 0.2 });
    expect(sign.signed).toEqual(["w-1"]);
  });

  it("signs every counter-record of a severance batch in one pass", async () => {
    server.use(
      graphql.mutation("PrepareSeverance", () =>
        HttpResponse.json({
          data: {
            prepareSeverance: {
              __typename: "PreparePayload",
              writes: prepared(["w-1", "w-2", "w-3"]),
              userErrors: [],
            },
          },
        }),
      ),
    );
    const sign = signer();
    const data = createApolloStanceData({ client: client(), guard, signer: sign });
    expect(await data.sever(POST)).toEqual({ kind: "success", value: { records: 3 } });
    // In order, and every one of them: the reader agreed to the batch
    // once, at its stated cost.
    expect(sign.signed).toEqual(["w-1", "w-2", "w-3"]);
  });

  it("stops the batch at the first element that does not complete", async () => {
    server.use(
      graphql.mutation("PrepareSeverance", () =>
        HttpResponse.json({
          data: {
            prepareSeverance: {
              __typename: "PreparePayload",
              writes: prepared(["w-1", "w-2", "w-3"]),
              userErrors: [],
            },
          },
        }),
      ),
    );
    const sign = signer((staged) =>
      staged.id === "w-2"
        ? { kind: "awaitingSeal", id: staged.id }
        : { kind: "done", id: staged.id, state: "RELAYING" },
    );
    const data = createApolloStanceData({ client: client(), guard, signer: sign });
    expect((await data.sever(POST)).kind).toBe("failed");
    // The rest is left staged for resume(), not re-driven here.
    expect(sign.signed).toEqual(["w-1", "w-2"]);
  });

  it("surfaces a refusal to sever rather than manufacturing writes", async () => {
    server.use(
      graphql.mutation("PrepareSeverance", () =>
        HttpResponse.json({
          data: {
            prepareSeverance: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [
                { __typename: "UserError", message: "already at zero", code: "BAD_INPUT", field: null },
              ],
            },
          },
        }),
      ),
    );
    const sign = signer();
    const data = createApolloStanceData({ client: client(), guard, signer: sign });
    expect((await data.sever(POST)).kind).toBe("refused");
    expect(sign.signed).toEqual([]);
  });
});
