// @vitest-environment node
// Mirrors android/core/crypto HandshakeTest.kt (plus the Rust
// commitments_bind case) over the pre-sign/approve handshake.

import { expect, it } from "vitest";
import { equalBytes, toHex } from "./bytes";
import { commitment, preDigest, sha256Tagged, Tags, verify, verifyDigest } from "./hashing";
import { ActId, ProfId } from "./identifiers";
import {
  canonicalDeps,
  CONTENT_EDITION,
  contentCommitment,
  contentPreDigest,
  DEPENDENCY_EDITION,
  dependencyCommitment,
  dependencyPreDigest,
  preCommitment,
  PreSignedProposal,
  Proposal,
  SealedAct,
  StructuralBody,
  VerifiedAct,
} from "./handshake";
import { ActorKey, HandshakeError } from "./actor-key";

const utf8 = (s: string) => new TextEncoder().encode(s);

function body(
  author: string,
  fields?: Partial<{ pD: number; pI: number; assertedParents: ActId[] }>,
): StructuralBody {
  return new StructuralBody({
    author,
    seq: 1n,
    family: "opinion",
    middle: null,
    target: new ProfId("bob"),
    pD: fields?.pD ?? 1.0,
    pI: fields?.pI ?? -0.25,
    settlementRef: null,
    license: null,
    assertedParents: fields?.assertedParents ?? [],
  });
}

function proposal(author: string): Proposal {
  return new Proposal(body(author), utf8("hello, cogra"), [ActId.parse("act:bob:1:registration")]);
}

/**
 * The host side of the handshake, as the tests play it: the host holds the
 * body, the dependency list, the content pre-digest, P and σ — never the
 * payload or the content nonce — and every part is consistent with what it
 * seals, so a refusal comes from the one check a test aims at.
 */
async function sealBy(
  host: ActorKey,
  sent: PreSignedProposal,
  fields?: Partial<{
    body: StructuralBody;
    deps: readonly ActId[];
    contentDigest: Uint8Array;
    /** Forms C_c over these raw bytes instead of a pre-digest (the earlier formula). */
    contentBytes: Uint8Array;
    preCommitment: Uint8Array;
    contentEdition: bigint;
    depsEdition: bigint;
    carriedContentSalt: Uint8Array;
    carriedDepsSalt: Uint8Array;
  }>,
): Promise<SealedAct> {
  const sealedBody = fields?.body ?? sent.proposal.body;
  const actId = sealedBody.actId();
  const sealedPreCommitment = fields?.preCommitment ?? (await sent.preCommitment());
  const contentSalt = new Uint8Array(32).fill(1);
  const depsSalt = new Uint8Array(32).fill(2);
  const contentWitness =
    fields?.contentBytes !== undefined
      ? await commitment(Tags.COMMIT_CONTENT, utf8(actId.toString()), sealedPreCommitment, contentSalt, fields.contentBytes)
      : await contentCommitment(
          actId,
          sealedPreCommitment,
          contentSalt,
          fields?.contentDigest ?? (await sent.contentPreDigest()),
        );
  const depsWitness = await dependencyCommitment(actId, sealedPreCommitment, depsSalt, fields?.deps ?? sent.proposal.deps);
  const act = new VerifiedAct({
    body: sealedBody,
    preCommitment: sealedPreCommitment,
    preSignature: sent.preSignature,
    contentCommitment: contentWitness,
    depsCommitment: depsWitness,
    contentEdition: fields?.contentEdition ?? CONTENT_EDITION,
    depsEdition: fields?.depsEdition ?? DEPENDENCY_EDITION,
  });
  return new SealedAct({
    act,
    contentSalt: fields?.carriedContentSalt ?? contentSalt,
    depsSalt: fields?.carriedDepsSalt ?? depsSalt,
    hostSeal: await host.signTagged(Tags.HOST_SEAL, act.sealMsg()),
  });
}

it("approve happy path", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent);
  const witness = await actor.approve(sent, sealed, host.publicKeyBytes());
  expect(witness.actId.toString()).toBe(sent.proposal.body.actId().toString());
  expect(await verifyDigest(actor.publicKeyBytes(), await sealed.approvalDigest(), witness.approvalSignature)).toBe(
    true,
  );
});

it("the pre-signature verifies over the named pre-commitment", async () => {
  const actor = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  expect(await verifyDigest(actor.publicKeyBytes(), await sent.preCommitment(), sent.preSignature)).toBe(true);
  // Another payload under the same nonces forms another P.
  const actId = sent.actId();
  const otherDigest = await contentPreDigest(actId, sent.contentNonce, utf8("another payload"));
  const otherP = await preCommitment(sent.proposal.body, otherDigest, await sent.dependencyPreDigest());
  expect(await verifyDigest(actor.publicKeyBytes(), otherP, sent.preSignature)).toBe(false);
});

it("each pre-digest depends on its own nonce alone", async () => {
  const actId = ActId.parse("act:alice:1:opinion");
  const deps = [ActId.parse("act:bob:1:registration")];
  const payload = utf8("payload");
  const n1 = new Uint8Array(32).fill(1);
  const n2 = new Uint8Array(32).fill(2);
  const hC = await contentPreDigest(actId, n1, payload);
  const hD = await dependencyPreDigest(actId, n1, deps);
  // Changing the content nonce moves h_c and only h_c — and the other way round.
  expect(equalBytes(await contentPreDigest(actId, n2, payload), hC)).toBe(false);
  expect(equalBytes(await dependencyPreDigest(actId, n2, deps), hD)).toBe(false);
  const a = await actorPreSigned(n1, n2);
  const b = await actorPreSigned(n1, new Uint8Array(32).fill(3));
  const c = await actorPreSigned(new Uint8Array(32).fill(3), n2);
  expect(equalBytes(await a.pre.contentPreDigest(), await b.pre.contentPreDigest())).toBe(true);
  expect(equalBytes(await a.pre.dependencyPreDigest(), await b.pre.dependencyPreDigest())).toBe(false);
  expect(equalBytes(await a.pre.dependencyPreDigest(), await c.pre.dependencyPreDigest())).toBe(true);
  expect(equalBytes(await a.pre.contentPreDigest(), await c.pre.contentPreDigest())).toBe(false);
});

/** One fixed actor's pre-signed proposal under the given nonces. */
async function actorPreSigned(contentNonce: Uint8Array, dependencyNonce: Uint8Array) {
  const actor = await ActorKey.fromSeed(new Uint8Array(32).fill(4));
  const pre = await actor.preSign(proposal(await actor.address()), contentNonce, dependencyNonce);
  return { actor, pre };
}

it("a verified act whose pre-commitment differs from the device's is refused before approval", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { preCommitment: new Uint8Array(32).fill(5) });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("host returned a different pre-commitment than was formed"),
  );
});

it("a verified act with an unexpected content edition is refused before approval", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { contentEdition: 1n });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(/unexpected editions/);
});

it("a verified act with an unexpected dependency edition is refused before approval", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { depsEdition: 2n });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(/unexpected editions/);
});

it("the approval witness signs the verified act and its host seal together", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent);
  const witness = await actor.approve(sent, sealed, host.publicKeyBytes());
  const digest = await sha256Tagged(Tags.APPROVAL, [sealed.act.sealMsg(), sealed.hostSeal]);
  expect(await verifyDigest(actor.publicKeyBytes(), digest, witness.approvalSignature)).toBe(true);
  const otherSeal = await sha256Tagged(Tags.APPROVAL, [sealed.act.sealMsg(), new Uint8Array(64)]);
  expect(await verifyDigest(actor.publicKeyBytes(), otherSeal, witness.approvalSignature)).toBe(false);
});

it("an approval over the verified act without its seal does not verify", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent);
  const unsealed = await actor.signTagged(Tags.APPROVAL, sealed.act.sealMsg());
  expect(await verifyDigest(actor.publicKeyBytes(), await sealed.approvalDigest(), unsealed)).toBe(false);
});

it("approve rejects an altered body", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const author = await actor.address();
  const sent = await actor.preSign(proposal(author));
  const sealed = await sealBy(host, sent, { body: body(author, { pI: -1.0 }) });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("host returned a different act than was pre-signed"),
  );
});

it("approve rejects a pre-signature other than its own", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent);
  const swapped = new SealedAct({
    ...sealed,
    act: new VerifiedAct({ ...sealed.act, preSignature: new Uint8Array(64).fill(7) }),
  });
  await expect(actor.approve(sent, swapped, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("host returned a different act than was pre-signed"),
  );
});

it("approve rejects a content commitment formed over the payload bytes", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { contentBytes: sent.proposal.payload });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("content commitment is not formed over this device's content pre-digest"),
  );
});

it("approve rejects a content commitment over another pre-digest", async () => {
  // A host that formed C_c over a pre-digest it was not sent — say, one under
  // another content nonce — cannot pass: the device recomputes its own h_c.
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const foreign = await contentPreDigest(sent.actId(), new Uint8Array(32).fill(9), sent.proposal.payload);
  const sealed = await sealBy(host, sent, { contentDigest: foreign });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("content commitment is not formed over this device's content pre-digest"),
  );
});

it("approve rejects a dependency commitment over another dependency list", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { deps: [ActId.parse("act:carol:2:registration")] });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("dependency commitment does not open over the dependency list"),
  );
});

it("preSign refuses a proposal that names another author", async () => {
  const actor = await ActorKey.generate();
  const other = await ActorKey.generate();
  await expect(actor.preSign(proposal(await other.address()))).rejects.toThrow(
    new HandshakeError("the proposal is not this actor's"),
  );
});

it("approve refuses stored material whose body names another author", async () => {
  // Material as IndexedDB could hand it back: this key's pubkey, another
  // author in the body. It never reaches a signature check.
  const actor = await ActorKey.generate();
  const other = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = new PreSignedProposal({
    proposal: proposal(await other.address()),
    authorPubkey: actor.publicKeyBytes(),
    contentNonce: new Uint8Array(32).fill(1),
    dependencyNonce: new Uint8Array(32).fill(2),
    preSignature: new Uint8Array(64),
  });
  const sealed = await sealBy(host, sent);
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("the proposal is not this actor's"),
  );
});

it("approve refuses a stored pre-signature that is not this key's over the held proposal", async () => {
  // A real signature of this key, but over another proposal's P; the host
  // echoes it and seals over the held proposal's P, so every equality holds
  // and only the re-verification can refuse.
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const author = await actor.address();
  const held = await actor.preSign(proposal(author));
  const elsewhere = await actor.preSign(new Proposal(body(author), utf8("another payload"), []));
  const sent = new PreSignedProposal({ ...held, preSignature: elsewhere.preSignature });
  const sealed = await sealBy(host, sent);
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("the stored pre-signature is not this key's over the held proposal"),
  );
});

it("approve refuses material another key pre-signed", async () => {
  const actor = await ActorKey.generate();
  const other = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await other.preSign(proposal(await other.address()));
  const sealed = await sealBy(host, sent);
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("handshake material was pre-signed by a different key"),
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
    new HandshakeError("content commitment is not formed over this device's content pre-digest"),
  );
});

it("approve rejects a wrong deps-commitment opening", async () => {
  const actor = await ActorKey.generate();
  const host = await ActorKey.generate();
  const sent = await actor.preSign(proposal(await actor.address()));
  const sealed = await sealBy(host, sent, { carriedDepsSalt: new Uint8Array(32).fill(9) });
  await expect(actor.approve(sent, sealed, host.publicKeyBytes())).rejects.toThrow(
    new HandshakeError("dependency commitment does not open over the dependency list"),
  );
});

it("preSign binds both nonces", async () => {
  const actor = await ActorKey.generate();
  const prop = proposal(await actor.address());
  const nC = new Uint8Array(32).fill(7);
  const nD = new Uint8Array(32).fill(8);
  const a = await actor.preSign(prop, nC, nD);
  const b = await actor.preSign(prop, nC, nD);
  const otherContent = await actor.preSign(prop, new Uint8Array(32).fill(9), nD);
  const otherDeps = await actor.preSign(prop, nC, new Uint8Array(32).fill(9));
  expect(toHex(a.preSignature)).toBe(toHex(b.preSignature));
  expect(toHex(a.preSignature)).not.toBe(toHex(otherContent.preSignature));
  expect(toHex(a.preSignature)).not.toBe(toHex(otherDeps.preSignature));
});

it("pre-signing draws two fresh, independent nonces", async () => {
  const actor = await ActorKey.generate();
  const prop = proposal(await actor.address());
  const first = await actor.preSign(prop);
  const second = await actor.preSign(prop);
  const nonces = [first.contentNonce, first.dependencyNonce, second.contentNonce, second.dependencyNonce];
  for (const n of nonces) expect(n).toHaveLength(32);
  expect(new Set(nonces.map(toHex)).size).toBe(4);
});

it("preSign rejects a wrong nonce length", async () => {
  const actor = await ActorKey.generate();
  const prop = proposal(await actor.address());
  await expect(actor.preSign(prop, new Uint8Array(16), new Uint8Array(32).fill(1))).rejects.toThrow(
    new RangeError("content nonce must be 32 bytes"),
  );
  await expect(actor.preSign(prop, new Uint8Array(32).fill(1), new Uint8Array(33))).rejects.toThrow(
    new RangeError("dependency nonce must be 32 bytes"),
  );
});

it("preSign refuses one nonce for both projections", async () => {
  const actor = await ActorKey.generate();
  const nonce = new Uint8Array(32).fill(6);
  await expect(actor.preSign(proposal(await actor.address()), nonce, nonce.slice())).rejects.toThrow(
    new RangeError("content nonce and dependency nonce must differ"),
  );
});

it("a content commitment takes a pre-digest, never payload bytes", async () => {
  const actId = ActId.parse("act:alice:1:publish");
  expect(() => contentCommitment(actId, PRE, new Uint8Array(32), utf8("payload"))).toThrow(
    new RangeError("a content pre-digest is 32 bytes"),
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

const ACT = utf8("act:alice:1:publish");
const OTHER_ACT = utf8("act:alice:2:publish");
const PRE = new Uint8Array(32).fill(3);

it("commitments bind", async () => {
  const salt = new Uint8Array(32).fill(3);
  const bytes = utf8("payload");
  const base = await commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes), base)).toBe(true);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, utf8("payloae")), base)).toBe(false);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, ACT, PRE, new Uint8Array(32).fill(5), bytes), base)).toBe(
    false,
  );
  expect(equalBytes(await commitment(Tags.COMMIT_DEPS, ACT, PRE, salt, bytes), base)).toBe(false);
});

it("a content commitment binds the act id and the pre-commitment", async () => {
  const salt = new Uint8Array(32).fill(7);
  const bytes = utf8("payload");
  const base = await commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes);
  // The same payload and salt under another act id commit differently …
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, OTHER_ACT, PRE, salt, bytes), base)).toBe(false);
  // … and under another pre-commitment.
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, ACT, new Uint8Array(32).fill(4), salt, bytes), base)).toBe(
    false,
  );
});

it("a dependency commitment binds the act id and the pre-commitment", async () => {
  const salt = new Uint8Array(32).fill(7);
  const deps = Uint8Array.of(0x80);
  const base = await commitment(Tags.COMMIT_DEPS, ACT, PRE, salt, deps);
  expect(equalBytes(await commitment(Tags.COMMIT_DEPS, OTHER_ACT, PRE, salt, deps), base)).toBe(false);
  expect(equalBytes(await commitment(Tags.COMMIT_DEPS, ACT, new Uint8Array(32).fill(4), salt, deps), base)).toBe(
    false,
  );
});

it("a pre-digest binds the act id it was formed for", async () => {
  const nonce = new Uint8Array(32).fill(9);
  const bytes = utf8("payload");
  const base = await preDigest(Tags.PRE_DIGEST_CONTENT, ACT, nonce, bytes);
  expect(equalBytes(await preDigest(Tags.PRE_DIGEST_CONTENT, ACT, nonce, bytes), base)).toBe(true);
  expect(equalBytes(await preDigest(Tags.PRE_DIGEST_CONTENT, OTHER_ACT, nonce, bytes), base)).toBe(false);
  expect(equalBytes(await preDigest(Tags.PRE_DIGEST_DEPS, ACT, nonce, bytes), base)).toBe(false);
});

it("a v1 commitment never verifies under the current formula", async () => {
  const salt = new Uint8Array(32).fill(7);
  const bytes = utf8("payload");
  const v1 = await sha256Tagged("cogra-l1:commitment:content:v1", [salt, bytes]);
  expect(equalBytes(await commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes), v1)).toBe(false);
  expect(equalBytes(await sha256Tagged(Tags.COMMIT_CONTENT, [salt, bytes]), v1)).toBe(false);
});
