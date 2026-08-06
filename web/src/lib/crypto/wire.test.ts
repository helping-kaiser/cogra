// @vitest-environment node
// Mirrors android/core/crypto WireTest.kt over the transport envelopes.

import { expect, it } from "vitest";
import { concat, toHex } from "./bytes";
import { CborDecoder, CborEncoder } from "./cbor";
import { ActId, NodeId } from "./identifiers";
import { Proposal, StructuralBody, VerifiedAct } from "./handshake";
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

function verifiedActOf(proposal: Proposal): VerifiedAct {
  return new VerifiedAct({
    proposal,
    authorPubkey: new Uint8Array(32).fill(3),
    nonce: new Uint8Array(32).fill(4),
    preSignature: new Uint8Array(64).fill(5),
    contentSalt: new Uint8Array(32).fill(6),
    depsSalt: new Uint8Array(32).fill(7),
    contentCommitment: new Uint8Array(32).fill(8),
    depsCommitment: new Uint8Array(32).fill(9),
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

it("verified acts round-trip", () => {
  const act = verifiedActOf(fullProposal());
  const decoded = decodeVerifiedAct(encodeVerifiedAct(act));
  expect(decoded.proposal.equals(act.proposal)).toBe(true);
  expect(toHex(decoded.authorPubkey)).toBe(toHex(act.authorPubkey));
  expect(toHex(decoded.nonce)).toBe(toHex(act.nonce));
  expect(toHex(decoded.preSignature)).toBe(toHex(act.preSignature));
  expect(toHex(decoded.contentSalt)).toBe(toHex(act.contentSalt));
  expect(toHex(decoded.depsSalt)).toBe(toHex(act.depsSalt));
  expect(toHex(decoded.contentCommitment)).toBe(toHex(act.contentCommitment));
  expect(toHex(decoded.depsCommitment)).toBe(toHex(act.depsCommitment));
  expect(toHex(decoded.hostSeal)).toBe(toHex(act.hostSeal));
});

it("pre-commitments round-trip", () => {
  const nonce = new Uint8Array(32).fill(11);
  const preSignature = new Uint8Array(64).fill(12);
  const decoded = decodePreCommitment(encodePreCommitment(nonce, preSignature));
  expect(toHex(decoded.nonce)).toBe(toHex(nonce));
  expect(toHex(decoded.preSignature)).toBe(toHex(preSignature));
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
  expect(() => decodeVerifiedAct(new CborEncoder().array(2n).uint(1n).bytes(body).finish())).toThrow(
    new WireError("malformed verified act"),
  );
  expect(() =>
    decodePreCommitment(
      new CborEncoder().array(3n).uint(2n).bytes(new Uint8Array(32)).bytes(new Uint8Array(64)).finish(),
    ),
  ).toThrow(new WireError("unsupported wire version 2"));
  expect(() => decodePreCommitment(new Uint8Array(0))).toThrow(
    new WireError("malformed pre-commitment: unexpected end of input at byte 0"),
  );
});
