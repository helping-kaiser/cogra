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
  postGenesis,
  stanceRecord,
  tagClaim,
  topicNode,
  type ExpectedNetting,
  type ExpectedWrite,
  type NodeExpectation,
} from "./intent";

type VectorWrite = {
  family: Family;
  middle: NodeExpectation | null;
  target: NodeExpectation;
  pDirectedBits: string;
  pInterestBits: string;
  license: string | null;
  parents: "none" | "ownChainHead";
  payload: "empty" | "present";
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
};

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
    payload: v.payload,
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
    expect(vectors.version).toBe(1);
    expect(vectors.cases.length).toBeGreaterThan(0);
  });

  for (const c of vectors.cases) {
    it(c.case, () => {
      expect(verdict(c)).toBe(c.verdict);
    });
  }
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

  it("re-points a joined part's minted references at its own writes", () => {
    const joined = joinExpectations([
      expectation([stanceRecord("prof:ab", 0.1, 0.1)]),
      expectation([postGenesis(0.1, "a=0;o=0"), tagClaim({ kind: "mintedBy", write: 0 }, "x", 0.1, 1)]),
    ]);
    expect(joined.writes[2].middle).toEqual({ kind: "mintedBy", write: 1 });
  });
});
