// @vitest-environment node
// The client-crypto contract: every assertion pins this implementation
// to the repo-root client-crypto-vectors.json exported from the Rust
// reference (`make vectors`). Mirrors android/core/crypto
// GoldenVectorsTest.kt group for group.

import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { fromHex, toHex } from "./bytes";
import { CborEncoder } from "./cbor";
import { commitment, preDigest, sha256Tagged, Tags, verify, verifyDigest } from "./hashing";
import { ActId, FAMILIES, NodeId, parseFamily } from "./identifiers";
import {
  canonicalDeps,
  CONTENT_EDITION,
  contentCommitment,
  contentPreDigest,
  DEPENDENCY_EDITION,
  dependencyCommitment,
  dependencyPreDigest,
  preCommitment,
  preCommitmentMsg,
  Proposal,
  SealedAct,
  StructuralBody,
  VerifiedAct,
} from "./handshake";
import { ActorKey, HandshakeError } from "./actor-key";
import {
  decodePreCommitment,
  decodeProposal,
  decodeVerifiedAct,
  encodePreCommitmentOf,
  encodeProposal,
  encodeVerifiedAct,
  WireError,
} from "./wire";
import {
  KeyBackupError,
  openKeyBackup,
  RecoveryCode,
  RecoveryCodeLengthError,
  sealKeyBackup,
  signUpload,
  UPLOAD_PROOF_TAG,
} from "./key-backup";

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
  /**
   * A STRING, and read with `BigInt`. The field is a u64 and a JSON
   * number loses precision above 2^53, so the exporter writes it as text
   * — typing it as `number` here would let a sequence past that range
   * arrive already wrong.
   */
  seq: string;
  settlementRef: string | null;
  target: string;
}

interface Vectors {
  version: number;
  encoding: { cborHex: string; value: string }[];
  families: { actId: string; wireName: string }[];
  rejections: {
    case: string;
    what: "decodeProposal" | "parseActId";
    hex?: string;
    text?: string;
  }[];
  signatureRefusals: {
    case: string;
    msgUtf8: string;
    publicKeyHex: string;
    refusal: string;
    signatureHex: string;
    tagUtf8: string;
  }[];
  sha256Tagged: { digestHex: string; partsHex: string[]; tagUtf8: string }[];
  signing: {
    realizationAddress: string;
    publicKeyHex: string;
    seedHex: string;
    samples: { msgUtf8: string; signatureHex: string; tagUtf8: string }[];
  };
  structuralBodies: BodyVector[];
  /** The proposal envelope only: the one-nonce handshake fields of this group are not read. */
  handshake: {
    proposal: { body: BodyVector; deps: string[]; payloadHex: string };
    wireProposalHex: string;
  };
  proposalHandshake: {
    approvalActId: string;
    approvalDigestHex: string;
    approvalSignatureHex: string;
    canonicalDepsHex: string;
    contentCommitmentHex: string;
    contentEdition: number;
    contentNonceHex: string;
    contentPreDigestHex: string;
    contentSaltHex: string;
    dependencyCommitmentHex: string;
    dependencyEdition: number;
    dependencyNonceHex: string;
    dependencyPreDigestHex: string;
    dependencySaltHex: string;
    host: { publicKeyHex: string; seedHex: string };
    hostSealHex: string;
    preCommitmentHex: string;
    preCommitmentMsgHex: string;
    preSignatureHex: string;
    proposal: { body: BodyVector; deps: string[]; payloadHex: string };
    sealMsgHex: string;
    tags: {
      approvalUtf8: string;
      contentCommitmentUtf8: string;
      contentPreDigestUtf8: string;
      dependencyCommitmentUtf8: string;
      dependencyPreDigestUtf8: string;
      hostSealUtf8: string;
      preCommitmentUtf8: string;
    };
    wirePreCommitmentHex: string;
    wireVerifiedActHex: string;
  };
  proposalHandshakeRefusals: (
    | { case: string; what: "approve"; wireVerifiedActHex: string }
    | { case: string; what: "decodePreCommitment" | "decodeVerifiedAct"; hex: string; refusal: string }
  )[];
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
    recoveryCodeInputs: {
      case: string;
      input: string;
      expect: "bytes" | "length" | "character" | "padBits";
      bytesHex?: string;
    }[];
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

// A compatibility check, not a currency one: the file says which shape
// of vectors it holds, and this client reads that shape. Whether it was
// regenerated recently is the exporter's own drift test to answer.
it("is the contract version this client reads", () => {
  // 3: the handshake took the original's structure (act identifier and
  // pre-commitment in every pre-digest and commitment, editions, the
  // approval over the verified act and its seal).
  expect(vectors.version).toBe(3);
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
  expect(await key.address()).toBe(s.realizationAddress);
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

it("the prepared-proposal envelope matches", () => {
  // `canonicalProposal` keeps its one envelope; its vector rides in the
  // `handshake` group, over the same proposal `proposalHandshake` signs.
  const h = vectors.handshake;
  const proposal = new Proposal(
    bodyOf(h.proposal.body),
    fromHex(h.proposal.payloadHex),
    h.proposal.deps.map((d) => ActId.parse(d)),
  );
  expect(toHex(encodeProposal(proposal))).toBe(h.wireProposalHex);
  expect(decodeProposal(fromHex(h.wireProposalHex)).equals(proposal)).toBe(true);
  const p = vectors.proposalHandshake.proposal;
  expect(p).toEqual(h.proposal);
});

/** The two-nonce fixture: the proposal, actor, host and pre-signed proposal, from the inputs alone. */
async function proposalHandshakeFixture() {
  const h = vectors.proposalHandshake;
  const actor = await ActorKey.fromSeed(fromHex(vectors.signing.seedHex));
  const host = await ActorKey.fromSeed(fromHex(h.host.seedHex));
  const proposal = new Proposal(
    bodyOf(h.proposal.body),
    fromHex(h.proposal.payloadHex),
    h.proposal.deps.map((d) => ActId.parse(d)),
  );
  const pre = await actor.preSign(proposal, fromHex(h.contentNonceHex), fromHex(h.dependencyNonceHex));
  return { h, actor, host, proposal, pre };
}

it("the two-nonce handshake tags are the reference's", () => {
  const t = vectors.proposalHandshake.tags;
  expect(Tags.PRE_DIGEST_CONTENT).toBe(t.contentPreDigestUtf8);
  expect(Tags.PRE_DIGEST_DEPS).toBe(t.dependencyPreDigestUtf8);
  expect(Tags.PRE_COMMITMENT).toBe(t.preCommitmentUtf8);
  expect(Tags.COMMIT_CONTENT).toBe(t.contentCommitmentUtf8);
  expect(Tags.COMMIT_DEPS).toBe(t.dependencyCommitmentUtf8);
  expect(Tags.HOST_SEAL).toBe(t.hostSealUtf8);
  expect(Tags.APPROVAL).toBe(t.approvalUtf8);
});

it("the device reproduces every two-nonce handshake vector from the inputs", async () => {
  const { h, actor, host, proposal, pre } = await proposalHandshakeFixture();
  const actId = proposal.body.actId();
  const actIdUtf8 = utf8(actId.toString());
  const contentNonce = fromHex(h.contentNonceHex);
  const dependencyNonce = fromHex(h.dependencyNonceHex);
  // The nonce inputs are the fixed byte runs the reference names.
  expect(contentNonce).toEqual(Uint8Array.from({ length: 32 }, (_, i) => 0x2a + i));
  expect(dependencyNonce).toEqual(Uint8Array.from({ length: 32 }, (_, i) => 0x6a + i));

  expect(toHex(canonicalDeps(proposal.deps))).toBe(h.canonicalDepsHex);

  // Each pre-digest under its own nonce, by the helper and by the raw formula.
  const hC = await contentPreDigest(actId, contentNonce, proposal.payload);
  const hD = await dependencyPreDigest(actId, dependencyNonce, proposal.deps);
  expect(toHex(hC)).toBe(h.contentPreDigestHex);
  expect(toHex(hD)).toBe(h.dependencyPreDigestHex);
  expect(toHex(await preDigest(Tags.PRE_DIGEST_CONTENT, actIdUtf8, contentNonce, proposal.payload))).toBe(
    h.contentPreDigestHex,
  );
  expect(
    toHex(await preDigest(Tags.PRE_DIGEST_DEPS, actIdUtf8, dependencyNonce, canonicalDeps(proposal.deps))),
  ).toBe(h.dependencyPreDigestHex);
  expect(toHex(await pre.contentPreDigest())).toBe(h.contentPreDigestHex);
  expect(toHex(await pre.dependencyPreDigest())).toBe(h.dependencyPreDigestHex);

  expect(toHex(preCommitmentMsg(proposal.body, hC, hD))).toBe(h.preCommitmentMsgHex);
  const formed = await preCommitment(proposal.body, hC, hD);
  expect(toHex(formed)).toBe(h.preCommitmentHex);
  expect(toHex(await pre.preCommitment())).toBe(h.preCommitmentHex);
  expect(toHex(pre.preSignature)).toBe(h.preSignatureHex);
  expect(await verifyDigest(actor.publicKeyBytes(), formed, pre.preSignature)).toBe(true);

  expect(toHex(encodePreCommitmentOf(pre))).toBe(h.wirePreCommitmentHex);
  // Both directions. The pre-commitment is the one wire object this app
  // only ever writes, so nothing else exercises the reader — and a codec
  // pinned in one direction is half a codec.
  const readBack = decodePreCommitment(fromHex(h.wirePreCommitmentHex));
  expect(toHex(readBack.contentNonce)).toBe(h.contentNonceHex);
  expect(toHex(readBack.dependencyNonce)).toBe(h.dependencyNonceHex);
  expect(toHex(readBack.preSignature)).toBe(h.preSignatureHex);

  // The host's half, played from its seed and the salts: C_c over h_c.
  const contentSalt = fromHex(h.contentSaltHex);
  const depsSalt = fromHex(h.dependencySaltHex);
  const cC = await contentCommitment(actId, formed, contentSalt, hC);
  const cD = await dependencyCommitment(actId, formed, depsSalt, proposal.deps);
  expect(toHex(cC)).toBe(h.contentCommitmentHex);
  expect(toHex(cD)).toBe(h.dependencyCommitmentHex);
  expect(toHex(await commitment(Tags.COMMIT_CONTENT, actIdUtf8, formed, contentSalt, hC))).toBe(
    h.contentCommitmentHex,
  );
  expect(
    toHex(await commitment(Tags.COMMIT_DEPS, actIdUtf8, formed, depsSalt, canonicalDeps(proposal.deps))),
  ).toBe(h.dependencyCommitmentHex);
  expect(CONTENT_EDITION).toBe(BigInt(h.contentEdition));
  expect(DEPENDENCY_EDITION).toBe(BigInt(h.dependencyEdition));

  const act = new VerifiedAct({
    body: proposal.body,
    preCommitment: formed,
    preSignature: pre.preSignature,
    contentCommitment: cC,
    depsCommitment: cD,
    contentEdition: CONTENT_EDITION,
    depsEdition: DEPENDENCY_EDITION,
  });
  expect(toHex(act.sealMsg())).toBe(h.sealMsgHex);
  expect(toHex(host.publicKeyBytes())).toBe(h.host.publicKeyHex);
  const hostSeal = await host.signTagged(Tags.HOST_SEAL, act.sealMsg());
  expect(toHex(hostSeal)).toBe(h.hostSealHex);
  const sealed = new SealedAct({ act, contentSalt, depsSalt, hostSeal });
  expect(toHex(await sealed.approvalDigest())).toBe(h.approvalDigestHex);
  expect(toHex(encodeVerifiedAct(sealed))).toBe(h.wireVerifiedActHex);

  const decoded = decodeVerifiedAct(fromHex(h.wireVerifiedActHex));
  expect(toHex(decoded.act.body.canonicalBytes())).toBe(h.proposal.body.canonicalBytesHex);
  expect(toHex(decoded.act.preCommitment)).toBe(h.preCommitmentHex);
  expect(toHex(decoded.act.preSignature)).toBe(h.preSignatureHex);
  expect(toHex(decoded.act.contentCommitment)).toBe(h.contentCommitmentHex);
  expect(toHex(decoded.act.depsCommitment)).toBe(h.dependencyCommitmentHex);
  expect(decoded.act.contentEdition).toBe(CONTENT_EDITION);
  expect(decoded.act.depsEdition).toBe(DEPENDENCY_EDITION);
  expect(toHex(decoded.contentSalt)).toBe(h.contentSaltHex);
  expect(toHex(decoded.depsSalt)).toBe(h.dependencySaltHex);
  expect(toHex(decoded.hostSeal)).toBe(h.hostSealHex);
  expect(toHex(encodeVerifiedAct(decoded))).toBe(h.wireVerifiedActHex);

  // The device approves the act exactly as it arrives on the wire.
  const witness = await actor.approve(pre, decoded, fromHex(h.host.publicKeyHex));
  expect(witness.actId.toString()).toBe(h.approvalActId);
  expect(toHex(witness.approvalSignature)).toBe(h.approvalSignatureHex);
});

it("the sealed act carries no payload and no nonce", () => {
  const h = vectors.proposalHandshake;
  const wire = h.wireVerifiedActHex;
  expect(wire).not.toContain(h.proposal.payloadHex);
  expect(wire).not.toContain(h.contentNonceHex);
  expect(wire).not.toContain(h.dependencyNonceHex);
  // The positive control: the search finds what the frame does carry.
  expect(wire).toContain(h.preSignatureHex);
});

/**
 * Why each approve refusal must be refused — the check that names it. A
 * case this table does not know fails, so a new vector cannot pass for
 * the wrong reason.
 */
const APPROVE_REFUSALS: Record<string, string> = {
  "a content commitment over the payload bytes":
    "content commitment is not formed over this device's content pre-digest",
  "a pre-commitment the device did not form": "host returned a different pre-commitment than was formed",
  "an unexpected content edition": "unexpected editions (content 1, dependencies 1)",
  "an unexpected dependency edition": "unexpected editions (content 2, dependencies 2)",
};

it("the device refuses every two-nonce refusal vector, for its stated reason", async () => {
  const { h, actor, pre } = await proposalHandshakeFixture();
  const hostKey = fromHex(h.host.publicKeyHex);
  expect(vectors.proposalHandshakeRefusals).toHaveLength(6);
  for (const r of vectors.proposalHandshakeRefusals) {
    if (r.what === "approve") {
      const reason = APPROVE_REFUSALS[r.case];
      expect(reason, `no expected reason for "${r.case}"`).toBeDefined();
      const sealed = decodeVerifiedAct(fromHex(r.wireVerifiedActHex));
      // Validly resealed: the seal is not what refuses it.
      expect(await verify(hostKey, Tags.HOST_SEAL, sealed.act.sealMsg(), sealed.hostSeal), r.case).toBe(true);
      const refused = actor.approve(pre, sealed, hostKey);
      await expect(refused, r.case).rejects.toBeInstanceOf(HandshakeError);
      await expect(refused, r.case).rejects.toThrow(reason);
    } else {
      const decode = r.what === "decodePreCommitment" ? decodePreCommitment : decodeVerifiedAct;
      let thrown: unknown;
      try {
        decode(fromHex(r.hex));
      } catch (e) {
        thrown = e;
      }
      expect(thrown, r.case).toBeInstanceOf(WireError);
      expect((thrown as Error).message, r.case).toBe(`unsupported wire ${r.refusal}`);
    }
  }
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

it("the census families round-trip by wire name", () => {
  // SET equality, not order: the wire carries the name, never an index,
  // so the two lists agreeing member-for-member is the whole contract.
  expect([...FAMILIES].sort()).toEqual(vectors.families.map((f) => f.wireName).sort());
  for (const f of vectors.families) {
    expect(new ActId("alice-addr", 1n, parseFamily(f.wireName)).toString()).toBe(f.actId);
  }
});

it("rejects every malformed input the reference rejects", () => {
  for (const r of vectors.rejections) {
    if (r.what === "decodeProposal") {
      expect(() => decodeProposal(fromHex(r.hex ?? "")), r.case).toThrow();
    } else {
      expect(() => ActId.parse(r.text ?? ""), r.case).toThrow();
    }
  }
});

it("refuses every signature the reference refuses", async () => {
  for (const r of vectors.signatureRefusals) {
    const verified = await verify(
      fromHex(r.publicKeyHex),
      r.tagUtf8,
      utf8(r.msgUtf8),
      fromHex(r.signatureHex),
    );
    expect(verified, `${r.case}: ${r.refusal}`).toBe(false);
  }
});

it("reads every recovery-code input the reference reads, and refuses the rest", () => {
  for (const v of vectors.keyBackup.recoveryCodeInputs) {
    if (v.expect === "bytes") {
      expect(toHex(RecoveryCode.fromInput(v.input).bytes), v.case).toBe(v.bytesHex);
      continue;
    }
    let thrown: unknown;
    try {
      RecoveryCode.fromInput(v.input);
    } catch (e) {
      thrown = e;
    }
    expect(thrown, v.case).toBeInstanceOf(KeyBackupError);
    // The LENGTH failure is the one a reader can act on — characters are
    // missing or spare — and it is the only one that gets its own class.
    // An unusable character and set pad bits are both "this code will not
    // open", which the GCM tag would have said a moment later.
    expect(thrown instanceof RecoveryCodeLengthError, v.case).toBe(v.expect === "length");
  }
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
