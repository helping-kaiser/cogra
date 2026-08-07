// @vitest-environment node

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { KeyCeremony } from "@/lib/identity/key-ceremony";
import { createIdentityStore, type IdentityStore } from "@/lib/identity/store";
import { randomBytes } from "@/lib/crypto/bytes";
import type { AuthGuard } from "@/lib/session/guard";
import { startMswServer } from "@/test/msw";
import { createRegistrationSigner, type RegistrationSigner } from "./registration-signer";
import type { WriteResult, WriteSigner } from "./write-signer";

const server = startMswServer();

const passthroughGuard: AuthGuard = { run: (block) => block() };

const NOW = Date.parse("2026-08-07T12:00:00Z");
const FUTURE = "2026-08-08T12:00:00Z";
const PAST = "2026-08-06T12:00:00Z";

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function fakeCeremony(overrides: Partial<KeyCeremony> = {}): KeyCeremony & {
  flushes: number;
  attaches: number;
} {
  const state = { flushes: 0, attaches: 0 };
  return {
    createActorKey: () => Promise.reject(new Error("unused")),
    publicIdentity: () => Promise.resolve(null),
    attachActorKey() {
      state.attaches += 1;
      return Promise.resolve({ kind: "success", value: true as const });
    },
    createPendingBackup: () => Promise.reject(new Error("unused")),
    uploadPendingBackup() {
      state.flushes += 1;
      return Promise.resolve(true);
    },
    ...overrides,
    get flushes() {
      return state.flushes;
    },
    get attaches() {
      return state.attaches;
    },
  };
}

function fakeWriteSigner(result: WriteResult): WriteSigner & { calls: number } {
  const holder = { calls: 0 };
  return {
    signStaged() {
      holder.calls += 1;
      return Promise.resolve(result);
    },
    resume: () => Promise.resolve([]),
    get calls() {
      return holder.calls;
    },
  };
}

function statusHandler(me: unknown) {
  return graphql.query("ApplicationStatus", () => HttpResponse.json({ data: { me } }));
}

function application(overrides: Record<string, unknown> = {}) {
  return {
    __typename: "Application",
    id: "app-1",
    handle: "ada",
    emailVerified: false,
    keyAttached: false,
    approvedAt: null,
    landedAt: null,
    createdAt: PAST,
    expiresAt: FUTURE,
    ...overrides,
  };
}

function stagedRegistration() {
  return {
    __typename: "StagedWrite",
    id: "sw-1",
    state: "AWAITING_PRE_SIGN",
    family: "REGISTRATION",
    canonicalProposal: "cHJvcG9zYWw=",
    verifiedAct: null,
    record: null,
  };
}

function me(fields: Record<string, unknown>) {
  return {
    __typename: "User",
    id: "u1",
    accountState: "APPLICANT",
    application: application(),
    stagedWrites: { __typename: "StagedWriteConnection", nodes: [] },
    ...fields,
  };
}

describe("registration signer", () => {
  let store: IdentityStore;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore();
  });

  function signer(deps: {
    ceremony?: KeyCeremony;
    writeSigner?: WriteSigner;
  }): RegistrationSigner {
    return createRegistrationSigner({
      client: client(),
      guard: passthroughGuard,
      store,
      ceremony: deps.ceremony ?? fakeCeremony(),
      writeSigner: deps.writeSigner ?? fakeWriteSigner({ kind: "done", id: "sw-1", state: "RELAYING" }),
      now: () => NOW,
    });
  }

  it("returns the status refusal before flushing anything", async () => {
    server.use(statusHandler(null));
    const ceremony = fakeCeremony();
    const progress = await signer({ ceremony }).advance();
    expect(progress.kind).toBe("refused");
    expect(ceremony.flushes).toBe(0);
  });

  it("maps a transport fault to failed", async () => {
    server.use(graphql.query("ApplicationStatus", () => HttpResponse.error()));
    expect((await signer({}).advance()).kind).toBe("failed");
  });

  it("flushes the parked backup on every pass, before branching", async () => {
    server.use(statusHandler(me({ accountState: "MEMBER" })));
    const ceremony = fakeCeremony();
    const progress = await signer({ ceremony }).advance();
    expect(progress).toEqual({ kind: "member" });
    expect(ceremony.flushes).toBe(1);
  });

  it("asks for the signing key when a Registration is staged and the device has none", async () => {
    server.use(
      statusHandler(
        me({
          stagedWrites: { __typename: "StagedWriteConnection", nodes: [stagedRegistration()] },
        }),
      ),
    );
    const writeSigner = fakeWriteSigner({ kind: "done", id: "sw-1", state: "RELAYING" });
    const progress = await signer({ writeSigner }).advance();
    expect(progress).toEqual({ kind: "awaitingSigningKey" });
    expect(writeSigner.calls).toBe(0);
  });

  it.each([
    [{ kind: "done", id: "sw-1", state: "RELAYING" }, "awaitingLanding"],
    [{ kind: "awaitingSeal", id: "sw-1" }, "awaitingLanding"],
    [{ kind: "refused", id: "sw-1", errors: [] }, "refused"],
    [{ kind: "rejectedByDevice", id: "sw-1", reason: "bad seal" }, "rejectedByDevice"],
    [{ kind: "failed", id: "sw-1", cause: new Error("net") }, "failed"],
  ] as const)("maps the staged-Registration result %o to %s", async (result, expected) => {
    server.use(
      statusHandler(
        me({
          stagedWrites: { __typename: "StagedWriteConnection", nodes: [stagedRegistration()] },
        }),
      ),
    );
    await store.saveActor(randomBytes(32), true);
    const writeSigner = fakeWriteSigner(result as WriteResult);
    const progress = await signer({ writeSigner }).advance();
    expect(progress.kind).toBe(expected);
    expect(writeSigner.calls).toBe(1);
  });

  it("needs an invite when no application exists", async () => {
    server.use(statusHandler(me({ application: null })));
    expect(await signer({}).advance()).toEqual({ kind: "needsInvite" });
  });

  it("awaits landing once approved", async () => {
    server.use(statusHandler(me({ application: application({ approvedAt: PAST }) })));
    expect(await signer({}).advance()).toEqual({ kind: "awaitingLanding" });
  });

  it("needs an invite when the application expired", async () => {
    server.use(statusHandler(me({ application: application({ expiresAt: PAST }) })));
    expect(await signer({}).advance()).toEqual({ kind: "needsInvite" });
  });

  it("reports the two proofs while approval is pending", async () => {
    server.use(
      statusHandler(me({ application: application({ emailVerified: true, keyAttached: true }) })),
    );
    await store.saveActor(randomBytes(32), true);
    expect(await signer({}).advance()).toEqual({
      kind: "awaitingApproval",
      emailVerified: true,
      keyAttached: true,
      keyOnDevice: true,
    });
  });

  it("repair-attaches silently when the server lost the key but the device has one", async () => {
    server.use(statusHandler(me({})));
    await store.saveActor(randomBytes(32), true);
    const ceremony = fakeCeremony();
    const progress = await signer({ ceremony }).advance();
    expect(progress).toEqual({
      kind: "awaitingApproval",
      emailVerified: false,
      keyAttached: true,
      keyOnDevice: true,
    });
    expect(ceremony.attaches).toBe(1);
  });

  it("a failed repair-attach leaves the proof unattached", async () => {
    server.use(statusHandler(me({})));
    await store.saveActor(randomBytes(32), true);
    const ceremony = fakeCeremony({
      attachActorKey: () => Promise.resolve({ kind: "failed", cause: new Error("net") }),
    });
    const progress = await signer({ ceremony }).advance();
    expect(progress).toEqual({
      kind: "awaitingApproval",
      emailVerified: false,
      keyAttached: false,
      keyOnDevice: true,
    });
  });

  it("does not repair-attach without a key on device", async () => {
    server.use(statusHandler(me({})));
    const ceremony = fakeCeremony();
    const progress = await signer({ ceremony }).advance();
    expect(progress).toEqual({
      kind: "awaitingApproval",
      emailVerified: false,
      keyAttached: false,
      keyOnDevice: false,
    });
    expect(ceremony.attaches).toBe(0);
  });
});
