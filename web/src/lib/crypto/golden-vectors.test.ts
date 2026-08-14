// @vitest-environment node
// The client-crypto contract: every assertion pins this implementation
// to the repo-root client-crypto-vectors.json exported from the Rust
// reference (`make vectors`). Mirrors android/core/crypto
// GoldenVectorsTest.kt, plus the two fields the Kotlin test leaves
// unused (keyBackup.contentKeyHex / plaintextHex).

import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { fromHex, toHex } from "./bytes";
import { CborEncoder } from "./cbor";
import { commitment, preDigest, sha256Tagged, Tags, verify } from "./hashing";
import { ActId, NodeId, parseFamily } from "./identifiers";
import { canonicalDeps, preCommitmentMsg, Proposal, StructuralBody, VerifiedAct } from "./handshake";
import { ActorKey } from "./actor-key";
import { decodeProposal, decodeVerifiedAct, encodePreCommitmentOf, encodeProposal, encodeVerifiedAct } from "./wire";
import { openKeyBackup, RecoveryCode, sealKeyBackup, signUpload, UPLOAD_PROOF_TAG } from "./key-backup";

interface BodyVector {
  actId: string;
  assertedParents: string[];
  author: string;
  canonicalBytesHex: string;
  family: string;
  license: string | null;
  middle: string | null;
  pD: number;
  pI: number;
  seq: number;
  settlementRef: string | null;
  target: string;
}

interface Vectors {
  version: number;
  encoding: { cborHex: string; value: string }[];
  sha256Tagged: { digestHex: string; partsHex: string[]; tagUtf8: string }[];
  signing: {
    l0Address: string;
    publicKeyHex: string;
    seedHex: string;
    samples: { msgUtf8: string; signatureHex: string; tagUtf8: string }[];
  };
  structuralBodies: BodyVector[];
  handshake: {
    approvalActId: string;
    approvalSignatureHex: string;
    canonicalDepsHex: string;
    contentCommitmentHex: string;
    contentPreDigestHex: string;
    contentSaltHex: string;
    depsCommitmentHex: string;
    depsPreDigestHex: string;
    depsSaltHex: string;
    host: { publicKeyHex: string; seedHex: string };
    hostSealHex: string;
    nonceHex: string;
    preCommitmentMsgHex: string;
    preSignatureHex: string;
    proposal: { body: BodyVector; deps: string[]; payloadHex: string };
    sealMsgHex: string;
    wirePreCommitmentHex: string;
    wireProposalHex: string;
    wireVerifiedActHex: string;
  };
  keyBackup: {
    aesNonceHex: string;
    blobBase64: string;
    blobHex: string;
    contentKeyHex: string;
    hkdfInfoUtf8: string;
    hkdfSaltHex: string;
    plaintextHex: string;
    recoveryCodeBytesHex: string;
    recoveryCodeDisplay: string;
    uploadChallengeHex: string;
    uploadProofTagUtf8: string;
    uploadSignatureHex: string;
  };
}

const vectors = JSON.parse(
  readFileSync(new URL("../../../../client-crypto-vectors.json", import.meta.url), "utf-8"),
) as Vectors;

const utf8 = (s: string) => Uint8Array.from(new TextEncoder().encode(s));

function bodyOf(v: BodyVector): StructuralBody {
  return new StructuralBody({
    author: v.author,
    seq: BigInt(v.seq),
    family: parseFamily(v.family),
    middle: v.middle === null ? null : NodeId.parse(v.middle),
    target: NodeId.parse(v.target),
    pD: v.pD,
    pI: v.pI,
    settlementRef: v.settlementRef === null ? null : ActId.parse(v.settlementRef),
    license: v.license,
    assertedParents: v.assertedParents.map((p) => ActId.parse(p)),
  });
}

it("the vectors file is current", () => {
  expect(vectors.version).toBe(1);
});

it("encoding vectors match", () => {
  const produced: { value: string; bytes: Uint8Array }[] = [
    { value: "uint 0", bytes: new CborEncoder().uint(0n).finish() },
    { value: "uint 23", bytes: new CborEncoder().uint(23n).finish() },
    { value: "uint 24", bytes: new CborEncoder().uint(24n).finish() },
    { value: "uint 255", bytes: new CborEncoder().uint(255n).finish() },
    { value: "uint 256", bytes: new CborEncoder().uint(256n).finish() },
    { value: "uint 65535", bytes: new CborEncoder().uint(65535n).finish() },
    { value: "uint 65536", bytes: new CborEncoder().uint(65536n).finish() },
    { value: "uint 4294967295", bytes: new CborEncoder().uint(4294967295n).finish() },
    { value: "uint 4294967296", bytes: new CborEncoder().uint(4294967296n).finish() },
    { value: "bytes ''", bytes: new CborEncoder().bytes(new Uint8Array(0)).finish() },
    { value: "bytes 0102", bytes: new CborEncoder().bytes(Uint8Array.of(1, 2)).finish() },
    { value: "text ''", bytes: new CborEncoder().text("").finish() },
    { value: "text 'cogra'", bytes: new CborEncoder().text("cogra").finish() },
    { value: "text 'héllo → ✓'", bytes: new CborEncoder().text("héllo → ✓").finish() },
    { value: "float 0.0", bytes: new CborEncoder().float(0.0).finish() },
    { value: "float 1.0", bytes: new CborEncoder().float(1.0).finish() },
    { value: "float -1.0", bytes: new CborEncoder().float(-1.0).finish() },
    { value: "float 0.5", bytes: new CborEncoder().float(0.5).finish() },
    { value: "float -0.25", bytes: new CborEncoder().float(-0.25).finish() },
    { value: "null", bytes: new CborEncoder().nul().finish() },
    { value: "array(0)", bytes: new CborEncoder().array(0n).finish() },
    {
      value: "array(2)[uint 1, array(1)[text 'x']]",
      bytes: new CborEncoder().array(2n).uint(1n).array(1n).text("x").finish(),
    },
  ];
  expect(produced.length).toBe(vectors.encoding.length);
  for (let i = 0; i < produced.length; i++) {
    expect(produced[i].value).toBe(vectors.encoding[i].value);
    expect(toHex(produced[i].bytes)).toBe(vectors.encoding[i].cborHex);
  }
});

it("tagged hash vectors match", async () => {
  for (const v of vectors.sha256Tagged) {
    const digest = await sha256Tagged(v.tagUtf8, v.partsHex.map(fromHex));
    expect(toHex(digest)).toBe(v.digestHex);
  }
});

it("signing vectors match", async () => {
  const s = vectors.signing;
  const key = await ActorKey.fromSeed(fromHex(s.seedHex));
  expect(toHex(key.publicKeyBytes())).toBe(s.publicKeyHex);
  expect(await key.address()).toBe(s.l0Address);
  for (const sample of s.samples) {
    // Ed25519 is deterministic: byte-equality, not just verification.
    const signature = await key.signTagged(sample.tagUtf8, utf8(sample.msgUtf8));
    expect(toHex(signature)).toBe(sample.signatureHex);
    expect(await verify(key.publicKeyBytes(), sample.tagUtf8, utf8(sample.msgUtf8), signature)).toBe(true);
  }
});

it("structural body vectors match", () => {
  for (const v of vectors.structuralBodies) {
    const body = bodyOf(v);
    expect(body.actId().toString()).toBe(v.actId);
    expect(toHex(body.canonicalBytes())).toBe(v.canonicalBytesHex);
  }
});

it("handshake vectors match", async () => {
  const h = vectors.handshake;
  const actor = await ActorKey.fromSeed(fromHex(vectors.signing.seedHex));
  const proposal = new Proposal(
    bodyOf(h.proposal.body),
    fromHex(h.proposal.payloadHex),
    h.proposal.deps.map((d) => ActId.parse(d)),
  );
  expect(toHex(canonicalDeps(proposal.deps))).toBe(h.canonicalDepsHex);
  expect(toHex(encodeProposal(proposal))).toBe(h.wireProposalHex);
  expect(decodeProposal(fromHex(h.wireProposalHex)).equals(proposal)).toBe(true);

  const nonce = fromHex(h.nonceHex);
  const pre = await actor.preSign(proposal, nonce);
  expect(toHex(await preDigest(Tags.PRE_DIGEST_CONTENT, nonce, proposal.payload))).toBe(h.contentPreDigestHex);
  expect(toHex(await preDigest(Tags.PRE_DIGEST_DEPS, nonce, canonicalDeps(proposal.deps)))).toBe(
    h.depsPreDigestHex,
  );
  expect(
    toHex(preCommitmentMsg(proposal.body, fromHex(h.contentPreDigestHex), fromHex(h.depsPreDigestHex))),
  ).toBe(h.preCommitmentMsgHex);
  expect(toHex(pre.preSignature)).toBe(h.preSignatureHex);
  expect(toHex(encodePreCommitmentOf(pre))).toBe(h.wirePreCommitmentHex);

  const contentSalt = fromHex(h.contentSaltHex);
  const depsSalt = fromHex(h.depsSaltHex);
  const sealed = new VerifiedAct({
    proposal,
    authorPubkey: actor.publicKeyBytes(),
    nonce,
    preSignature: pre.preSignature,
    contentSalt,
    depsSalt,
    contentCommitment: fromHex(h.contentCommitmentHex),
    depsCommitment: fromHex(h.depsCommitmentHex),
    hostSeal: fromHex(h.hostSealHex),
  });
  expect(toHex(await commitment(Tags.COMMIT_CONTENT, contentSalt, proposal.payload))).toBe(
    h.contentCommitmentHex,
  );
  expect(toHex(await commitment(Tags.COMMIT_DEPS, depsSalt, canonicalDeps(proposal.deps)))).toBe(
    h.depsCommitmentHex,
  );
  expect(toHex(sealed.sealMsg())).toBe(h.sealMsgHex);
  expect(toHex(encodeVerifiedAct(sealed))).toBe(h.wireVerifiedActHex);
  const decoded = decodeVerifiedAct(fromHex(h.wireVerifiedActHex));
  expect(decoded.proposal.equals(proposal)).toBe(true);
  expect(toHex(decoded.hostSeal)).toBe(h.hostSealHex);

  const witness = await actor.approve(pre, sealed, fromHex(h.host.publicKeyHex));
  expect(witness.actId.toString()).toBe(h.approvalActId);
  expect(toHex(witness.approvalSignature)).toBe(h.approvalSignatureHex);
});

it("key backup vectors match", async () => {
  const k = vectors.keyBackup;
  const seed = fromHex(vectors.signing.seedHex);
  const code = new RecoveryCode(fromHex(k.recoveryCodeBytesHex));
  expect(code.display()).toBe(k.recoveryCodeDisplay);
  expect(k.hkdfInfoUtf8).toBe("cogra:key-backup:v1");

  const blob = await sealKeyBackup(seed, code, fromHex(k.hkdfSaltHex), fromHex(k.aesNonceHex));
  expect(toHex(blob)).toBe(k.blobHex);
  expect(Buffer.from(blob).toString("base64")).toBe(k.blobBase64);

  const retyped = RecoveryCode.fromInput(k.recoveryCodeDisplay);
  expect(toHex(retyped.bytes)).toBe(toHex(code.bytes));
  expect(toHex(await openKeyBackup(fromHex(k.blobHex), retyped))).toBe(vectors.signing.seedHex);

  // The two fields the Kotlin golden test leaves unused.
  expect(toHex(new CborEncoder().array(2n).bytes(seed).uint(1n).finish())).toBe(k.plaintextHex);
  const ikm = await crypto.subtle.importKey("raw", fromHex(k.recoveryCodeBytesHex), "HKDF", false, [
    "deriveBits",
  ]);
  const contentKey = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: fromHex(k.hkdfSaltHex), info: utf8(k.hkdfInfoUtf8) },
    ikm,
    256,
  );
  expect(toHex(new Uint8Array(contentKey))).toBe(k.contentKeyHex);
});

it("key-backup upload proof vectors match", async () => {
  const k = vectors.keyBackup;
  expect(UPLOAD_PROOF_TAG).toBe(k.uploadProofTagUtf8);

  const actor = await ActorKey.fromSeed(fromHex(vectors.signing.seedHex));
  const signature = await signUpload(
    actor,
    fromHex(k.uploadChallengeHex),
    fromHex(k.blobHex),
  );
  expect(toHex(signature)).toBe(k.uploadSignatureHex);
});
