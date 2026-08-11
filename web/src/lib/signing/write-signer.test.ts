// @vitest-environment node

// The device half of the handshake against a simulated host: MSW scripts
// the API while the test plays the host with real crypto — commitments
// over the submitted payload, a real Ed25519 host seal — so every
// verification branch runs against genuine bytes.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { StagedWriteState } from "@/__generated__/graphql";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { ActorKey } from "@/lib/crypto/actor-key";
import { fromBase64, randomBytes, toBase64 } from "@/lib/crypto/bytes";
import { commitment, Tags, verify } from "@/lib/crypto/hashing";
import {
  canonicalDeps,
  PreSignedProposal,
  Proposal,
  StructuralBody,
  VerifiedAct,
} from "@/lib/crypto/handshake";
import { ActId, AddrId } from "@/lib/crypto/identifiers";
import {
  decodePreCommitment,
  encodeProposal,
  encodeVerifiedAct,
} from "@/lib/crypto/wire";
import { createIdentityStore, type IdentityStore } from "@/lib/identity/store";
import type { AuthGuard } from "@/lib/session/guard";
import { startMswServer } from "@/test/msw";
import { createWriteSigner, type WriteSigner } from "./write-signer";

const server = startMswServer();

const passthroughGuard: AuthGuard = { run: (block) => block() };

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function sampleProposal(): Proposal {
  const body = new StructuralBody({
    author: "aa".repeat(20),
    seq: 1n,
    family: "registration",
    middle: null,
    target: new AddrId("bb".repeat(20)),
    pD: 1,
    pI: 0,
    settlementRef: null,
    license: null,
    assertedParents: [],
  });
  return new Proposal(body, new Uint8Array(), [new ActId("cc".repeat(20), 3n, "opinion")]);
}

async function sealOver(
  host: ActorKey,
  pre: PreSignedProposal,
  proposal: Proposal = pre.proposal,
): Promise<VerifiedAct> {
  const contentSalt = randomBytes(32);
  const depsSalt = randomBytes(32);
  const fields = {
    proposal,
    authorPubkey: pre.authorPubkey,
    nonce: pre.nonce,
    preSignature: pre.preSignature,
    contentSalt,
    depsSalt,
    contentCommitment: await commitment(Tags.COMMIT_CONTENT, contentSalt, proposal.payload),
    depsCommitment: await commitment(Tags.COMMIT_DEPS, depsSalt, canonicalDeps(proposal.deps)),
    hostSeal: new Uint8Array(64),
  };
  const unsealed = new VerifiedAct(fields);
  return new VerifiedAct({
    ...fields,
    hostSeal: await host.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()),
  });
}

function stagedJson(id: string, state: StagedWriteState, verifiedAct: string | null) {
  return {
    __typename: "StagedWrite",
    id,
    state,
    family: "REGISTRATION",
    canonicalProposal: PROPOSAL_B64,
    verifiedAct,
    record: null,
  };
}

function view(id: string, state: StagedWriteState, verifiedAct: string | null): StagedWriteView {
  return { id, state, family: "REGISTRATION", canonicalProposal: PROPOSAL_B64, verifiedAct };
}

const PROPOSAL = sampleProposal();
const PROPOSAL_B64 = toBase64(encodeProposal(PROPOSAL));
const ID = "sw-1";

/** Decodes what the device submitted back into its pre-signed form. */
function submittedPre(signature: string, actorPub: Uint8Array): PreSignedProposal {
  const blob = decodePreCommitment(fromBase64(signature));
  return new PreSignedProposal({
    proposal: PROPOSAL,
    authorPubkey: actorPub,
    nonce: blob.nonce,
    preSignature: blob.preSignature,
  });
}

describe("write signer", () => {
  let store: IdentityStore;
  let signer: WriteSigner;
  let actorPub: Uint8Array;
  let host: ActorKey;
  let hostHandler: ReturnType<typeof graphql.query>;

  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore({ activeAccountId: () => "acct-1" });
    const seed = randomBytes(32);
    const saved = await store.saveActor(seed, true);
    actorPub = saved.publicKeyBytes();
    host = await ActorKey.generate();
    hostHandler = graphql.query("HostPublicKey", () =>
      HttpResponse.json({ data: { hostPublicKey: toBase64(host.publicKeyBytes()) } }),
    );
    signer = createWriteSigner({
      client: client(),
      guard: passthroughGuard,
      store,
      sleep: () => Promise.resolve(),
    });
  });

  it("runs the full handshake on a synchronous seal and clears the material", async () => {
    let sealed: VerifiedAct | null = null;
    server.use(
      hostHandler,
      graphql.mutation("SubmitProposals", async ({ variables }) => {
        const input = (variables as { input: { proposals: { signature: string }[] } }).input;
        const pre = submittedPre(input.proposals[0].signature, actorPub);
        sealed = await sealOver(host, pre);
        return HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [
                stagedJson(ID, "AWAITING_APPROVAL", toBase64(encodeVerifiedAct(sealed))),
              ],
              userErrors: [],
            },
          },
        });
      }),
      graphql.mutation("ApproveActs", async ({ variables }) => {
        const input = (variables as { input: { approvals: { signature: string }[] } }).input;
        if (sealed === null) throw new Error("approve before submit");
        const witnessOk = await verify(
          actorPub,
          Tags.APPROVAL,
          sealed.sealMsg(),
          fromBase64(input.approvals[0].signature),
        );
        if (!witnessOk) throw new Error("approval witness does not verify");
        return HttpResponse.json({
          data: {
            approveActs: {
              __typename: "ApproveActsPayload",
              stagedWrites: [stagedJson(ID, "RELAYING", null)],
              userErrors: [],
            },
          },
        });
      }),
    );

    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result).toEqual({ kind: "done", id: ID, state: "RELAYING" });
    expect(await store.handshake(ID)).toBeNull();
  });

  it("polls for an asynchronous seal, then approves", async () => {
    let sealedB64: string | null = null;
    let polls = 0;
    server.use(
      hostHandler,
      graphql.mutation("SubmitProposals", async ({ variables }) => {
        const input = (variables as { input: { proposals: { signature: string }[] } }).input;
        const pre = submittedPre(input.proposals[0].signature, actorPub);
        sealedB64 = toBase64(encodeVerifiedAct(await sealOver(host, pre)));
        return HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [stagedJson(ID, "SEALING", null)],
              userErrors: [],
            },
          },
        });
      }),
      graphql.query("StagedWrite", () => {
        polls += 1;
        return HttpResponse.json({
          data: {
            stagedWrite:
              polls < 2
                ? stagedJson(ID, "SEALING", null)
                : stagedJson(ID, "AWAITING_APPROVAL", sealedB64),
          },
        });
      }),
      graphql.mutation("ApproveActs", () =>
        HttpResponse.json({
          data: {
            approveActs: {
              __typename: "ApproveActsPayload",
              stagedWrites: [stagedJson(ID, "RELAYING", null)],
              userErrors: [],
            },
          },
        }),
      ),
    );

    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result).toEqual({ kind: "done", id: ID, state: "RELAYING" });
    expect(polls).toBe(2);
  });

  it("parks as awaitingSeal when the seal budget runs out, material kept", async () => {
    server.use(
      hostHandler,
      graphql.mutation("SubmitProposals", () =>
        HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [stagedJson(ID, "SEALING", null)],
              userErrors: [],
            },
          },
        }),
      ),
      graphql.query("StagedWrite", () =>
        HttpResponse.json({ data: { stagedWrite: stagedJson(ID, "SEALING", null) } }),
      ),
    );

    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result).toEqual({ kind: "awaitingSeal", id: ID });
    expect(await store.handshake(ID)).not.toBeNull();
  });

  it("a submit refusal ends the handshake and clears the material", async () => {
    server.use(
      graphql.mutation("SubmitProposals", () =>
        HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: null,
              userErrors: [
                { __typename: "UserError", message: "bad", code: "SIGNATURE_INVALID", field: null },
              ],
            },
          },
        }),
      ),
    );
    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result.kind).toBe("refused");
    expect(await store.handshake(ID)).toBeNull();
  });

  it("a transport fault keeps the material and resume re-sends the same nonce", async () => {
    server.use(graphql.mutation("SubmitProposals", () => HttpResponse.error()));
    const first = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(first.kind).toBe("failed");
    const parked = await store.handshake(ID);
    expect(parked).not.toBeNull();

    let resent: Uint8Array | null = null;
    let sealed: VerifiedAct | null = null;
    server.use(
      hostHandler,
      graphql.query("StagedWrite", () =>
        HttpResponse.json({ data: { stagedWrite: stagedJson(ID, "AWAITING_PRE_SIGN", null) } }),
      ),
      graphql.mutation("SubmitProposals", async ({ variables }) => {
        const input = (variables as { input: { proposals: { signature: string }[] } }).input;
        resent = decodePreCommitment(fromBase64(input.proposals[0].signature)).nonce;
        const pre = submittedPre(input.proposals[0].signature, actorPub);
        sealed = await sealOver(host, pre);
        return HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [
                stagedJson(ID, "AWAITING_APPROVAL", toBase64(encodeVerifiedAct(sealed))),
              ],
              userErrors: [],
            },
          },
        });
      }),
      graphql.mutation("ApproveActs", () =>
        HttpResponse.json({
          data: {
            approveActs: {
              __typename: "ApproveActsPayload",
              stagedWrites: [stagedJson(ID, "RELAYING", null)],
              userErrors: [],
            },
          },
        }),
      ),
    );

    const results = await signer.resume();
    expect(results).toEqual([{ kind: "done", id: ID, state: "RELAYING" }]);
    expect(resent).toEqual(parked?.nonce);
  });

  it("rejects a seal over a body the device never signed", async () => {
    server.use(
      hostHandler,
      graphql.mutation("SubmitProposals", async ({ variables }) => {
        const input = (variables as { input: { proposals: { signature: string }[] } }).input;
        const pre = submittedPre(input.proposals[0].signature, actorPub);
        const other = new Proposal(PROPOSAL.body, new TextEncoder().encode("swapped"), []);
        const sealed = await sealOver(host, pre, other);
        return HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [
                stagedJson(ID, "AWAITING_APPROVAL", toBase64(encodeVerifiedAct(sealed))),
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result.kind).toBe("rejectedByDevice");
    if (result.kind === "rejectedByDevice") expect(result.reason).toMatch(/different act/);
    expect(await store.handshake(ID)).toBeNull();
  });

  it("rejects a seal from the wrong host key", async () => {
    const impostor = await ActorKey.generate();
    server.use(
      hostHandler,
      graphql.mutation("SubmitProposals", async ({ variables }) => {
        const input = (variables as { input: { proposals: { signature: string }[] } }).input;
        const pre = submittedPre(input.proposals[0].signature, actorPub);
        const sealed = await sealOver(impostor, pre);
        return HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [
                stagedJson(ID, "AWAITING_APPROVAL", toBase64(encodeVerifiedAct(sealed))),
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result.kind).toBe("rejectedByDevice");
    if (result.kind === "rejectedByDevice") expect(result.reason).toMatch(/host seal/);
  });

  it("rejects a malformed canonical proposal without submitting", async () => {
    let submits = 0;
    server.use(
      graphql.mutation("SubmitProposals", () => {
        submits += 1;
        return HttpResponse.json({ data: {} });
      }),
    );
    const malformed: StagedWriteView = {
      id: ID,
      state: "AWAITING_PRE_SIGN",
      family: "REGISTRATION",
      canonicalProposal: toBase64(new Uint8Array([0x00])),
      verifiedAct: null,
    };
    const result = await signer.signStaged(malformed);
    expect(result.kind).toBe("rejectedByDevice");
    expect(submits).toBe(0);
    expect(await store.handshake(ID)).toBeNull();
  });

  it("refuses a sealing staged write when the material is lost", async () => {
    const result = await signer.signStaged(view(ID, "AWAITING_APPROVAL", null));
    expect(result.kind).toBe("refused");
    if (result.kind === "refused") {
      expect(result.errors[0].code).toBe("INTERNAL");
      expect(result.errors[0].message).toMatch(/awaiting re-stage/);
    }
  });

  it("treats expiry during the seal wait as a refusal and clears", async () => {
    server.use(
      graphql.mutation("SubmitProposals", () =>
        HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [stagedJson(ID, "SEALING", null)],
              userErrors: [],
            },
          },
        }),
      ),
      graphql.query("StagedWrite", () =>
        HttpResponse.json({ data: { stagedWrite: stagedJson(ID, "EXPIRED", null) } }),
      ),
    );
    const result = await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result.kind).toBe("refused");
    if (result.kind === "refused") expect(result.errors[0].code).toBe("STAGED_WRITE_EXPIRED");
    expect(await store.handshake(ID)).toBeNull();
  });

  it("completes already-relaying and expired states without a handshake", async () => {
    const key = await store.actorKey();
    if (key === null) throw new Error("expected a key");

    expect(await signer.signStaged(view(ID, "RELAYING", null))).toEqual({
      kind: "done",
      id: ID,
      state: "RELAYING",
    });

    const expired = await signer.signStaged(view(ID, "EXPIRED", null));
    expect(expired.kind).toBe("refused");
    if (expired.kind === "refused") expect(expired.errors[0].code).toBe("STAGED_WRITE_EXPIRED");
  });

  it("resume refuses a vanished staged write and clears the material", async () => {
    server.use(graphql.mutation("SubmitProposals", () => HttpResponse.error()));
    await signer.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    server.use(
      graphql.query("StagedWrite", () => HttpResponse.json({ data: { stagedWrite: null } })),
    );
    const results = await signer.resume();
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("refused");
    if (results[0].kind === "refused") expect(results[0].errors[0].code).toBe("NOT_FOUND");
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("fails without an actor key on this device", async () => {
    globalThis.indexedDB = new IDBFactory();
    const emptyStore = createIdentityStore({ activeAccountId: () => "acct-1" });
    const keyless = createWriteSigner({
      client: client(),
      guard: passthroughGuard,
      store: emptyStore,
      sleep: () => Promise.resolve(),
    });
    const result = await keyless.signStaged(view(ID, "AWAITING_PRE_SIGN", null));
    expect(result.kind).toBe("failed");
  });
});
