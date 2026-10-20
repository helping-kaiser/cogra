// @vitest-environment node
// The intent check, pinned to the repo-root `intent-vectors.json` exported
// from the Rust reference (`crates/common/tests/intent_vectors.rs`): the
// same expectations, the same canonical proposal bytes, the same verdicts
// Android's IntentVectorsTest reads. Never transcribe a vector value.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fromHex } from "@/lib/crypto/bytes";
import type { Family } from "@/lib/crypto/identifiers";
import { decodeProposal } from "@/lib/crypto/wire";
import {
  canonicalLicense,
  checkIntent,
  expectation,
  IntentMismatch,
  joinExpectations,
  postEdit,
  postGenesis,
  serverBlankFolded,
  serverChecked,
  serverTrim,
  stanceRecord,
  tagClaim,
  topicNode,
  type ExpectedAsset,
  type ExpectedContent,
  type ExpectedNetting,
  type ExpectedWrite,
  type NodeExpectation,
  type PayloadExpectation,
} from "./intent";

type VectorWrite = {
  family: Family;
  middle: NodeExpectation | null;
  target: NodeExpectation;
  pDirectedBits: string;
  pInterestBits: string;
  license: string | null;
  parents: "none" | "ownChainHead";
  payload: "empty" | { content: VectorContent } | { profile: VectorProfile };
};

type VectorAsset = {
  digest: string;
  mime: string;
  altText: string | null;
  cover: string | null;
  coverTaken: boolean;
  uploadDigest: string;
};

type VectorContent = {
  node: string;
  title: string | null;
  description: string | null;
  body: string | null;
  media: VectorAsset[];
  sensitive: { reason: string | null } | null;
};

type VectorProfile = {
  node: string;
  displayName: string | null;
  bio: string | null;
  websiteUrl: string | null;
  avatar: { state: "untouched" } | { state: "cleared" } | { state: "set"; asset: VectorAsset };
};

type VectorNetting = {
  family: Family;
  middle: string | null;
  target: string;
  rawPDirectedBits: string;
  rawPInterestBits: string;
  cost: number;
};

type IntentVectors = {
  version: number;
  author: string;
  cases: {
    case: string;
    expectation: { writes: VectorWrite[]; netting: VectorNetting[] };
    batch: string[];
    verdict: "accept" | "refuse";
  }[];
  trims: { input: string; trimmed: string; blank: boolean }[];
};

function asset(v: VectorAsset): ExpectedAsset {
  return { kind: "asset", ...v };
}

function payload(v: VectorWrite["payload"]): PayloadExpectation {
  if (v === "empty") return "empty";
  if ("content" in v) {
    return { kind: "content", content: { ...v.content, media: v.content.media.map(asset) } };
  }
  const avatar = v.profile.avatar;
  return {
    kind: "profile",
    profile: {
      ...v.profile,
      avatar: avatar.state === "set" ? { state: "set", asset: asset(avatar.asset) } : avatar,
    },
  };
}

const vectors = JSON.parse(
  readFileSync(new URL("../../../../intent-vectors.json", import.meta.url), "utf-8"),
) as IntentVectors;

function fromBits(hex: string): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt(`0x${hex}`));
  return view.getFloat64(0);
}

function write(v: VectorWrite): ExpectedWrite {
  return {
    family: v.family,
    middle: v.middle,
    target: v.target,
    pDirected: fromBits(v.pDirectedBits),
    pInterest: fromBits(v.pInterestBits),
    license: v.license,
    parents: v.parents,
    payload: payload(v.payload),
  };
}

function netting(v: VectorNetting): ExpectedNetting {
  return {
    family: v.family,
    middle: v.middle,
    target: v.target,
    rawPDirected: fromBits(v.rawPDirectedBits),
    rawPInterest: fromBits(v.rawPInterestBits),
    cost: v.cost,
  };
}

function verdict(c: IntentVectors["cases"][number]): "accept" | "refuse" {
  const batch = c.batch.map((hex) => decodeProposal(fromHex(hex)));
  try {
    checkIntent(
      expectation(c.expectation.writes.map(write), c.expectation.netting.map(netting)),
      vectors.author,
      batch,
    );
    return "accept";
  } catch (e) {
    if (e instanceof IntentMismatch) return "refuse";
    throw e;
  }
}

describe("the device reaches every intent verdict the vectors state", () => {
  it("reads a vector file it knows", () => {
    expect(vectors.version).toBe(2);
    expect(vectors.cases.length).toBeGreaterThan(0);
  });

  for (const c of vectors.cases) {
    it(c.case, () => {
      expect(verdict(c)).toBe(c.verdict);
    });
  }
});

describe("the server's normalization", () => {
  it("the_device_trims_exactly_as_the_server_does", () => {
    expect(vectors.trims.length).toBeGreaterThan(0);
    for (const t of vectors.trims) {
      expect(serverTrim(t.input), JSON.stringify(t.input)).toBe(t.trimmed);
      expect(serverChecked(t.input), JSON.stringify(t.input)).toBe(t.blank ? null : t.trimmed);
      expect(serverBlankFolded(t.input), JSON.stringify(t.input)).toBe(t.blank ? null : t.input);
    }
  });

  it("parts from JavaScript's own trim exactly where the platforms do", () => {
    // The two divergences the vectors carry, named so a regression reads as one.
    expect(serverTrim("\u{FEFF}x")).toBe("\u{FEFF}x");
    expect("\u{FEFF}x".trim()).toBe("x");
    expect(serverTrim("\u{0085}x")).toBe("x");
    expect("\u{0085}x".trim()).toBe("\u{0085}x");
  });
});

describe("the expectation builders", () => {
  it("renders a license exactly as the server's canonical string", () => {
    expect(canonicalLicense({ attribution: 0, provenance: 0 })).toBe("a=0;o=0");
    expect(canonicalLicense({ attribution: 0.5, provenance: 1 })).toBe("a=0.5;o=1");
    expect(canonicalLicense({ attribution: 1, provenance: 0.5 })).toBe("a=1;o=0.5");
  });

  it("names a topic by its canonical Type", () => {
    expect(topicNode("#Rust")).toBe("name:rust");
  });

  it("follows a Type with an Affinity and anything else with an Opinion", () => {
    expect(stanceRecord("name:rust", 0.1, 0.1).family).toBe("affinity");
    expect(stanceRecord("prof:ab", 0.1, 0.1).family).toBe("opinion");
  });

  // PR-101 (round 15): the face on one's own post signs an ordinary OPINION —
  // both numbers, its own bundle — never a Publish; the authoring backing is
  // the Publish bundle, one axis, `p_i` pinned at 1.
  it("signs the face on one's own post as an ordinary Opinion, both numbers free", () => {
    const face = stanceRecord("mint:own-post", -0.4, 0.7);
    expect(face).toMatchObject({ family: "opinion", pDirected: -0.4, pInterest: 0.7, payload: "empty" });
  });

  it("carries a post edit's own pick, p_i census-fixed — PICK-IS-THE-EDGE, never a delta", () => {
    const content: ExpectedContent = {
      node: "00000000-0000-4000-8000-000000000000",
      title: null,
      description: null,
      body: "words",
      media: [],
      sensitive: null,
    };
    expect(postEdit("mint:own-post", content, 0)).toMatchObject({ family: "publish", pDirected: 0, pInterest: 1 });
    expect(postEdit("mint:own-post", content, -0.3)).toMatchObject({ pDirected: -0.3, pInterest: 1 });
    expect(postGenesis(0.1, "a=0;o=0", content)).toMatchObject({ pDirected: 0.1, pInterest: 1 });
  });

  it("re-points a joined part's minted references at its own writes", () => {
    const content: ExpectedContent = {
      node: "00000000-0000-4000-8000-000000000000",
      title: null,
      description: null,
      body: "words",
      media: [],
      sensitive: null,
    };
    const joined = joinExpectations([
      expectation([stanceRecord("prof:ab", 0.1, 0.1)]),
      expectation([
        postGenesis(0.1, "a=0;o=0", content),
        tagClaim({ kind: "mintedBy", write: 0 }, "x", 0.1, 1),
      ]),
    ]);
    expect(joined.writes[2].middle).toEqual({ kind: "mintedBy", write: 1 });
  });
});
