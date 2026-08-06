// @vitest-environment node
// Mirrors android/core/crypto HandshakeTest.kt (plus the Rust
// commitments_bind case) over the pre-sign/approve handshake.

import { expect, it } from "vitest";
import { equalBytes, toHex } from "./bytes";
import { commitment, sha256Tagged, Tags, verify } from "./hashing";
import { ActId, ProfId } from "./identifiers";
import {
  canonicalDeps,
  PreSignedProposal,
  Proposal,
  StructuralBody,
  VerifiedAct,
} from "./handshake";
import { ActorKey, HandshakeError } from "./actor-key";

const utf8 = (s: string) => new TextEncoder().encode(s);

function body(author: string, fields?: Partial<{ pI: number; assertedParents: ActId[] }>): StructuralBody {
  return new StructuralBody({
    author,
    seq: 1n,
    family: "opinion",
    middle: null,
    target: new ProfId("bob"),
    pD: 1.0,
    pI: fields?.pI ?? -0.25,
    settlementRef: null,
    license: null,
    assertedParents: fields?.assertedParents ?? [],
  });
}

function proposal(author: string): Proposal {
  return new Proposal(body(author), utf8("hello, cogra"), [ActId.parse("act:bob:1:registration")]);
}

/** The host side of the handshake, as the tests play it. */
async function sealBy(
  host: ActorKey,
  sent: PreSignedProposal,
  fields?: Partial<{
    proposal: Proposal;
    nonce: Uint8Array;
    contentSalt: Uint8Array;
    depsSalt: Uint8Array;
    carriedContentSalt: Uint8Array;
    carriedDepsSalt: Uint8Array;
  }>,
): Promise<VerifiedAct> {
  const sealedProposal = fields?.proposal ?? sent.proposal;
  const contentSalt = fields?.contentSalt ?? new Uint8Array(32).fill(1);
  const depsSalt = fields?.depsSalt ?? new Uint8Array(32).fill(2);
  const build = async (hostSeal: Uint8Array) =>
    new VerifiedAct({
      proposal: sealedProposal,
      authorPubkey: sent.authorPubkey,
      nonce: fields?.nonce ?? sent.nonce,
      preSignature: sent.preSignature,
      contentSalt: fields?.carriedContentSalt ?? contentSalt,
      depsSalt: fields?.carriedDepsSalt ?? depsSalt,
      contentCommitment: await commitment(Tags.COMMIT_CONTENT, contentSalt, sealedProposal.payload),
      depsCommitment: await commitment(Tags.COMMIT_DEPS, depsSalt, canonicalDeps(sealedProposal.deps)),
      hostSeal,
    });
  const unsealed = await build(new Uint8Array(64));
  return build(await host.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()));
}

it("approve happy path", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent);
  const witness = await actor.approve(sent, sealed, host.publicKeyBytes());
  expect(witness.actId.toString()).toBe(sent.proposal.body.actId().toString());
  expect(await verify(actor.publicKeyBytes(), Tags.APPROVAL, sealed.sealMsg(), witness.approvalSignature)).toBe(true);
});

it("approve rejects an altered body", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const author = await actor.address();
  const sent = await actor.preSign(proposal(author));
  const altered = new Proposal(body(author, { pI: -1.0 }), sent.proposal.payload, sent.proposal.deps);
  const sealed = await sealBy(host, sent, { proposal: altered });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("host returned a different act than was pre-signed"),
  );
});

it("approve rejects a foreign nonce echo", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { nonce: new Uint8Array(32).fill(9) });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("host returned a different act than was pre-signed"),
  );
});

it("approve rejects a bad seal", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const impostor = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(impostor, sent);
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("invalid host seal"),
  );
});

it("approve rejects a malformed host key", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent);
  await expect(actor.approve(sent, sealed, Uint8Array.of(1, 2, 3))).rejects.toThrow(
    new HandshakeError("invalid host seal"),
  );
});

it("approve rejects a wrong content-commitment opening", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { carriedContentSalt: new Uint8Array(32).fill(9) });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("content commitment does not open over the sent payload"),
  );
});

it("approve rejects a wrong deps-commitment opening", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { carriedDepsSalt: new Uint8Array(32).fill(9) });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("dependency commitment does not open over the sent list"),
  );
});

it("preSign binds the nonce", async () => {
  const actor = await ActorKey.generate();
  const prop = proposal(await actor.address());
  const nonce = new Uint8Array(32).fill(7);
  const a = await actor.preSign(prop, nonce);
  const b = await actor.preSign(prop, nonce);
  const c = await actor.preSign(prop);
  expect(toHex(a.preSignature)).toBe(toHex(b.preSignature));
  expect(toHex(a.preSignature)).not.toBe(toHex(c.preSignature));
});

it("preSign rejects a wrong nonce length", async () => {
  const actor = await ActorKey.generate();
  await expect(actor.preSign(proposal(await actor.address()), new Uint8Array(16))).rejects.toThrow(
    new RangeError("nonce must be 32 bytes"),
  );
});

it("canonical bytes are stable and field-sensitive", () => {
  expect(toHex(body("alice").canonicalBytes())).toBe(toHex(body("alice").canonicalBytes()));
  expect(toHex(body("alice", { pI: 0.5 }).canonicalBytes())).not.toBe(toHex(body("alice").canonicalBytes()));
  const withParent = body("alice", { assertedParents: [ActId.parse("act:alice:0:publish")] });
  expect(toHex(withParent.canonicalBytes())).not.toBe(toHex(body("alice").canonicalBytes()));
});

it("deps encoding is order-sensitive", () => {
  const d1 = ActId.parse("act:alice:1:opinion");
  const d2 = ActId.parse("act:bob:2:opinion");
  expect(toHex(canonicalDeps([d1, d2]))).not.toBe(toHex(canonicalDeps([d2, d1])));
  expect(toHex(canonicalDeps([]))).toBe("80");
});

it("key derivation is stable", async () => {
  const seed = new Uint8Array(32).fill(4);
  const key = await ActorKey.fromSeed(seed);
  expect(toHex(key.seed())).toBe(toHex(seed));
  const address = await key.address();
  expect(address).toHaveLength(40);
  expect(await (await ActorKey.fromSeed(seed)).address()).toBe(address);
  await expect(ActorKey.fromSeed(new Uint8Array(16))).rejects.toThrow(
    new RangeError("an actor seed is 32 bytes"),
  );
});

it("signatures are domain-separated", async () => {
  const actor = await ActorKey.generate();
  const pub = actor.publicKeyBytes();
  const msg = utf8("seal");
  const sig = await actor.signTagged(Tags.HOST_SEAL, msg);
  expect(await verify(pub, Tags.HOST_SEAL, msg, sig)).toBe(true);
  expect(await verify(pub, Tags.APPROVAL, msg, sig)).toBe(false);
  expect(await verify(pub, Tags.HOST_SEAL, utf8("sea1"), sig)).toBe(false);
  expect(await verify(pub, Tags.HOST_SEAL, msg, Uint8Array.of(1))).toBe(false);
  expect(await verify(Uint8Array.of(1), Tags.HOST_SEAL, msg, sig)).toBe(false);
});

it("length framing prevents concatenation ambiguity", async () => {
  const a = await sha256Tagged("t", [utf8("ab"), utf8("c")]);
  const b = await sha256Tagged("t", [utf8("a"), utf8("bc")]);
  expect(toHex(a)).not.toBe(toHex(b));
});

it("commitments bind", async () => {
  const salt = new Uint8Array(32).fill(3);
  const bytes = utf8("payload");
  const base = await commitment(Tags.COMMIT_CONTENT, salt, bytes);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, salt, bytes), base)).toBe(true);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, salt, utf8("payloae")), base)).toBe(false);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, new Uint8Array(32).fill(5), bytes), base)).toBe(false);
  expect(equalBytes(await commitment(Tags.COMMIT_DEPS, salt, bytes), base)).toBe(false);
});
