// @vitest-environment node
// Mirrors android/core/crypto WireTest.kt over the transport envelopes.

import { expect, it } from "vitest";
import { concat, toHex } from "./bytes";
import { CborDecoder, CborEncoder } from "./cbor";
import { ActId, NodeId } from "./identifiers";
import { Proposal, SealedAct, StructuralBody, VerifiedAct } from "./handshake";
import {
  decodePreCommitment,
  decodeProposal,
  decodeVerifiedAct,
  encodePreCommitment,
  encodeProposal,
  encodeVerifiedAct,
  WireError,
} from "./wire";

const utf8 = (s: string) => new TextEncoder().encode(s);

function fullProposal(): Proposal {
  return new Proposal(
    new StructuralBody({
      author: "alice-addr",
      seq: 7n,
      family: "review",
      middle: NodeId.parse("mint:act:alice-addr:3:publish"),
      target: NodeId.parse("name:general"),
      pD: 0.5,
      pI: -1.0,
      settlementRef: ActId.parse("act:alice-addr:5:send"),
      license: "CC-BY-4.0",
      assertedParents: [ActId.parse("act:alice-addr:6:opinion")],
    }),
    utf8("body bytes"),
    [ActId.parse("act:bob:1:registration")],
  );
}

function minimalProposal(): Proposal {
  return new Proposal(
    new StructuralBody({
      author: "alice-addr",
      seq: 1n,
      family: "opinion",
      middle: null,
      target: NodeId.parse("prof:bob"),
      pD: 1.0,
      pI: -0.25,
      settlementRef: null,
      license: null,
      assertedParents: [],
    }),
    new Uint8Array(0),
    [],
  );
}

function sealedActOf(proposal: Proposal): SealedAct {
  return new SealedAct({
    act: new VerifiedAct({
      body: proposal.body,
      preSignature: new Uint8Array(64).fill(5),
      preCommitment: new Uint8Array(32).fill(11),
      contentCommitment: new Uint8Array(32).fill(8),
      depsCommitment: new Uint8Array(32).fill(9),
      contentEdition: 2n,
      depsEdition: 1n,
    }),
    contentSalt: new Uint8Array(32).fill(6),
    depsSalt: new Uint8Array(32).fill(7),
    hostSeal: new Uint8Array(64).fill(10),
  });
}

it("proposals round-trip", () => {
  for (const p of [fullProposal(), minimalProposal()]) {
    expect(decodeProposal(encodeProposal(p)).equals(p)).toBe(true);
  }
});

it("the wire body is the canonical signing base", () => {
  const p = fullProposal();
  const d = new CborDecoder(encodeProposal(p));
  expect(d.array()).toBe(4n);
  expect(d.uint()).toBe(1n);
  expect(toHex(d.bytes())).toBe(toHex(p.body.canonicalBytes()));
});

it("sealed acts round-trip", () => {
  for (const p of [fullProposal(), minimalProposal()]) {
    const sealed = sealedActOf(p);
    const decoded = decodeVerifiedAct(encodeVerifiedAct(sealed));
    expect(toHex(decoded.act.body.canonicalBytes())).toBe(toHex(p.body.canonicalBytes()));
    expect(toHex(decoded.act.preSignature)).toBe(toHex(sealed.act.preSignature));
    expect(toHex(decoded.act.preCommitment)).toBe(toHex(sealed.act.preCommitment));
    expect(toHex(decoded.act.contentCommitment)).toBe(toHex(sealed.act.contentCommitment));
    expect(toHex(decoded.act.depsCommitment)).toBe(toHex(sealed.act.depsCommitment));
    expect(decoded.act.contentEdition).toBe(2n);
    expect(decoded.act.depsEdition).toBe(1n);
    expect(toHex(decoded.contentSalt)).toBe(toHex(sealed.contentSalt));
    expect(toHex(decoded.depsSalt)).toBe(toHex(sealed.depsSalt));
    expect(toHex(decoded.hostSeal)).toBe(toHex(sealed.hostSeal));
  }
});

it("the sealed act is an eleven-element version-2 frame with no payload", () => {
  const p = fullProposal();
  const bytes = encodeVerifiedAct(sealedActOf(p));
  const d = new CborDecoder(bytes);
  expect(d.array()).toBe(11n);
  expect(d.uint()).toBe(2n);
  expect(toHex(d.bytes())).toBe(toHex(p.body.canonicalBytes()));
  expect(toHex(bytes)).not.toContain(toHex(p.payload));
});

it("pre-commitments round-trip", () => {
  const contentNonce = new Uint8Array(32).fill(11);
  const dependencyNonce = new Uint8Array(32).fill(13);
  const preSignature = new Uint8Array(64).fill(12);
  const bytes = encodePreCommitment(contentNonce, dependencyNonce, preSignature);
  const decoded = decodePreCommitment(bytes);
  expect(toHex(decoded.contentNonce)).toBe(toHex(contentNonce));
  expect(toHex(decoded.dependencyNonce)).toBe(toHex(dependencyNonce));
  expect(toHex(decoded.preSignature)).toBe(toHex(preSignature));
  const d = new CborDecoder(bytes);
  expect(d.array()).toBe(4n);
  expect(d.uint()).toBe(2n);
});

function rawBody(actIdText: string, bodyVersion: bigint): Uint8Array {
  return new CborEncoder()
    .array(9n)
    .text(actIdText)
    .nul()
    .text("prof:bob")
    .float(1.0)
    .float(-0.25)
    .nul()
    .nul()
    .array(0n)
    .uint(bodyVersion)
    .finish();
}

function proposalEnvelope(version: bigint, body: Uint8Array): Uint8Array {
  return new CborEncoder().array(4n).uint(version).bytes(body).bytes(new Uint8Array(0)).array(0n).finish();
}

it("malformed input is refused, not misread", () => {
  const valid = encodeProposal(minimalProposal());
  const body = minimalProposal().body.canonicalBytes();

  expect(() => decodeProposal(proposalEnvelope(99n, body))).toThrow(
    new WireError("unsupported wire version 99"),
  );
  expect(() => decodeProposal(new CborEncoder().array(2n).uint(1n).bytes(body).finish())).toThrow(
    new WireError("malformed proposal"),
  );
  expect(() => decodeProposal(valid.slice(0, valid.length - 3))).toThrow(WireError);
  expect(() => decodeProposal(concat(valid, Uint8Array.of(0)))).toThrow(WireError);
  expect(() => decodeProposal(proposalEnvelope(1n, rawBody("not-an-act-id", 1n)))).toThrow(
    new WireError("malformed structural body: unparseable identifier `not-an-act-id`"),
  );
  expect(() =>
    decodeProposal(proposalEnvelope(1n, rawBody("act:alice-addr:1:opinion", 2n))),
  ).toThrow(new WireError("malformed structural body version"));
  // The handshake envelopes judge the version before the arity: a version-1
  // frame of any shape is refused as version 1 ...
  expect(() => decodeVerifiedAct(new CborEncoder().array(2n).uint(1n).bytes(body).finish())).toThrow(
    new WireError("unsupported wire version 1"),
  );
  expect(() =>
    decodePreCommitment(
      new CborEncoder().array(3n).uint(1n).bytes(new Uint8Array(32)).bytes(new Uint8Array(64)).finish(),
    ),
  ).toThrow(new WireError("unsupported wire version 1"));
  // ... and a version-2 frame of the wrong arity as malformed.
  expect(() => decodeVerifiedAct(new CborEncoder().array(2n).uint(2n).bytes(body).finish())).toThrow(
    new WireError("malformed verified act"),
  );
  expect(() =>
    decodePreCommitment(
      new CborEncoder().array(3n).uint(2n).bytes(new Uint8Array(32)).bytes(new Uint8Array(64)).finish(),
    ),
  ).toThrow(new WireError("malformed pre-commitment"));
  const blob = encodePreCommitment(new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(64));
  expect(() => decodePreCommitment(concat(blob, Uint8Array.of(0)))).toThrow(WireError);
  expect(() => decodePreCommitment(new Uint8Array(0))).toThrow(
    new WireError("malformed pre-commitment: unexpected end of input at byte 0"),
  );
});
