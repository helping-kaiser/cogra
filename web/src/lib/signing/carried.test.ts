// @vitest-environment node

// The carried expectation (PR-88): the digest a carried write is signed
// against at the landing, and the custody it waits in until then.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { beforeEach, describe, expect, it } from "vitest";

import { equalBytes } from "@/lib/crypto/bytes";
import { Proposal, StructuralBody } from "@/lib/crypto/handshake";
import { ActId, NodeId } from "@/lib/crypto/identifiers";
import { carriedDigest, createCarriedExpectationStore } from "./carried";

const AUTHOR = "aa".repeat(20);

function proposal(opts: { pD?: number; payload?: Uint8Array; deps?: ActId[] } = {}): Proposal {
  const body = new StructuralBody({
    author: AUTHOR,
    seq: 7n,
    family: "opinion",
    middle: null,
    target: NodeId.parse(`prof:${"bb".repeat(20)}`),
    pD: opts.pD ?? 0.4,
    pI: 0.2,
    settlementRef: null,
    license: null,
    assertedParents: [],
  });
  return new Proposal(body, opts.payload ?? new Uint8Array(), opts.deps ?? []);
}

describe("the carried digest", () => {
  it("the_dependency_completion_never_changes_the_carried_digest", async () => {
    // The landing appends [admission Registration, winning vouch]: the digest
    // is taken with the dependencies excluded, so the released write still
    // equals what was verified at its prepare.
    const prepared = await carriedDigest(proposal());
    const released = await carriedDigest(
      proposal({
        deps: [new ActId(AUTHOR, 1n, "registration"), new ActId("cc".repeat(20), 9n, "opinion")],
      }),
    );
    expect(equalBytes(prepared, released)).toBe(true);
  });

  it("a_changed_body_or_payload_changes_the_carried_digest", async () => {
    const prepared = await carriedDigest(proposal());
    expect(equalBytes(prepared, await carriedDigest(proposal({ pD: 0.41 })))).toBe(false);
    expect(
      equalBytes(prepared, await carriedDigest(proposal({ payload: Uint8Array.of(1) }))),
    ).toBe(false);
  });
});

describe("the carried expectation store", () => {
  let idb: IDBFactory;
  const active = { account: "acct-a" as string | null };
  const store = () => createCarriedExpectationStore({ activeAccountId: () => active.account, idb: () => idb });

  beforeEach(() => {
    idb = new IDBFactory();
    active.account = "acct-a";
  });

  it("keeps a digest per staged write and per account", async () => {
    await store().save("sw-1", Uint8Array.of(1, 2, 3));
    expect(await store().get("sw-1")).toEqual(Uint8Array.of(1, 2, 3));
    active.account = "acct-b";
    // Another account's custody reads as empty, never as this one's.
    expect(await store().get("sw-1")).toBeNull();
  });

  it("clears one expectation, and forgets every one of the account", async () => {
    await store().save("sw-1", Uint8Array.of(1));
    await store().save("sw-2", Uint8Array.of(2));
    await store().clear("sw-1");
    expect(await store().get("sw-1")).toBeNull();
    expect(await store().get("sw-2")).toEqual(Uint8Array.of(2));
    active.account = "acct-b";
    await store().save("sw-3", Uint8Array.of(3));
    await store().forget();
    active.account = "acct-a";
    expect(await store().get("sw-2")).toEqual(Uint8Array.of(2));
  });

  it("reads nothing with nobody signed in", async () => {
    await store().save("sw-1", Uint8Array.of(1));
    active.account = null;
    expect(await store().get("sw-1")).toBeNull();
  });
});
