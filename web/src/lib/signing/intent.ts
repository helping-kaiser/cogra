// The intent check (architecture.md "The write path", step 2; Android
// mirror: Intent.kt). The transport check proves the device signs exactly
// the bytes it pre-signed; this proves those bytes are the gesture its user
// ordered. Before the first pre-signature of a batch, the device rebuilds
// what every act's structural body must be from the form state the gesture
// was made with — the EXPECTATION — and refuses the whole batch on any
// write that is extra, missing, or different.
//
// WHAT IS COMPARED, AND WHAT IS NOT. Every author-meaning field of the
// structural body: family, author, middle, target, both parameters, the
// settlement reference, the license, the asserted parents, and whether a
// payload rides at all (the payload's fields wait for the envelope
// decoder). The sequence value and the dependency list are not: the seq is
// allocated by the backend, and dependencies are server-completed ordering
// facts the author never chose — L1 refuses an unsatisfiable one.
//
// EXACT, NEVER APPROXIMATE. Parameters compare as numbers with no
// tolerance: no server default stands in for a value the form did not
// hold, so a server that rounds has changed the order. The two zeros are
// one value — a JSON body cannot carry the sign of zero, so a pad's `-0`
// reaches the server as `0`.
//
// A NETTING BATCH IS CHECKED AS A PROPERTY. Severance and citation
// withdrawal stage counter-records the server computes from the bundle, so
// the device cannot know each write in advance. It checks instead that
// every counter-record points where the shown bundle points, stays in
// range, that there are exactly as many as the cost shown, and that the
// shown raw sums plus the batch net to exactly (0, 0) — the records carry
// picked values, never deltas (design.md §8.1), so the net is the only
// thing a walk-back means.
//
// The shared `intent-vectors.json` pins this file and Intent.kt to the
// same verdicts over the same canonical bytes.

import type { Proposal } from "@/lib/crypto/handshake";
import type { Family } from "@/lib/crypto/identifiers";
import { previewTagName } from "@/lib/topics/normalize";

/** Where an expected write's middle or target must point. */
export type NodeExpectation =
  /** Exactly this node — a raw L1 identifier read off the screen. */
  | { readonly kind: "node"; readonly id: string }
  /** The node this write mints: `mint:<its own act id>`. */
  | { readonly kind: "ownMint" }
  /** The node another write of the same batch mints, by its index in `writes`. */
  | { readonly kind: "mintedBy"; readonly write: number }
  /** The author's own profile, `prof:<author>`. */
  | { readonly kind: "ownProfile" };

/** One write the gesture ordered, field by field. */
export type ExpectedWrite = {
  readonly family: Family;
  readonly middle: NodeExpectation | null;
  readonly target: NodeExpectation;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly license: string | null;
  /** None, or exactly one parent: the head of the author's own chain on this node. */
  readonly parents: "none" | "ownChainHead";
  readonly payload: "empty" | "present";
};

/** A walk-back the server computes: checked as a net-to-zero property. */
export type ExpectedNetting = {
  readonly family: Family;
  readonly middle: string | null;
  readonly target: string;
  /** The raw sums the read surface served, before the clip. */
  readonly rawPDirected: number;
  readonly rawPInterest: number;
  /** The record count the user was shown as the gesture's cost. */
  readonly cost: number;
};

/** What a gesture's batch must be, rebuilt from its form state. */
export type Expectation = {
  readonly kind: "expectation";
  readonly writes: readonly ExpectedWrite[];
  readonly netting: readonly ExpectedNetting[];
};

/**
 * The one named exemption: the admission Registration, which the backend
 * stages at approval and the device discovers on its status poll with no
 * form behind it. It still runs every transport check, and it holds only
 * for a Registration.
 */
export const REGISTRATION_EXEMPTION = { kind: "registrationExemption" } as const;
export type RegistrationExemption = typeof REGISTRATION_EXEMPTION;

/** The device found the batch is not what its user ordered. */
export class IntentMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentMismatch";
  }
}

export function expectation(
  writes: readonly ExpectedWrite[],
  netting: readonly ExpectedNetting[] = [],
): Expectation {
  return { kind: "expectation", writes, netting };
}

/** Joins the expectations of several prepares a single gesture signs as one batch. */
export function joinExpectations(parts: readonly Expectation[]): Expectation {
  const writes: ExpectedWrite[] = [];
  const netting: ExpectedNetting[] = [];
  for (const part of parts) {
    const offset = writes.length;
    for (const write of part.writes) {
      writes.push({
        ...write,
        middle: shifted(write.middle, offset),
        target: shifted(write.target, offset) ?? write.target,
      });
    }
    netting.push(...part.netting);
  }
  return expectation(writes, netting);
}

function shifted(node: NodeExpectation | null, offset: number): NodeExpectation | null {
  return node?.kind === "mintedBy" ? { kind: "mintedBy", write: node.write + offset } : node;
}

// ---- the check -------------------------------------------------------------

function sameValue(a: number, b: number): boolean {
  // `===` is false for NaN and true across the two zeros — exactly the
  // equality the doc header states.
  return a === b;
}

function inRange(x: number): boolean {
  return Number.isFinite(x) && x >= -1 && x <= 1;
}

function ownMintOf(p: Proposal): string {
  return `mint:${p.body.actId().toString()}`;
}

function resolveNode(
  node: NodeExpectation,
  p: Proposal,
  author: string,
  minted: readonly (string | undefined)[],
): string | undefined {
  switch (node.kind) {
    case "node":
      return node.id;
    case "ownMint":
      return ownMintOf(p);
    case "mintedBy":
      return minted[node.write];
    case "ownProfile":
      return `prof:${author}`;
  }
}

function matches(
  e: ExpectedWrite,
  p: Proposal,
  author: string,
  minted: readonly (string | undefined)[],
): boolean {
  const body = p.body;
  if (body.family !== e.family) return false;
  const target = resolveNode(e.target, p, author, minted);
  if (target === undefined || body.target.toString() !== target) return false;
  if (e.middle === null) {
    if (body.middle !== null) return false;
  } else {
    const middle = resolveNode(e.middle, p, author, minted);
    if (middle === undefined || body.middle?.toString() !== middle) return false;
  }
  if (!sameValue(body.pD, e.pDirected) || !sameValue(body.pI, e.pInterest)) return false;
  if (body.license !== e.license) return false;
  if (!parentsMatch(e.parents, p, author)) return false;
  return e.payload === "empty" ? p.payload.length === 0 : p.payload.length > 0;
}

function parentsMatch(parents: ExpectedWrite["parents"], p: Proposal, author: string): boolean {
  const asserted = p.body.assertedParents;
  if (parents === "none") return asserted.length === 0;
  // The chain head is the backend's to read (substrate.md §9): the device
  // cannot know its sequence value, only that it is one act, its own, of the
  // same family — an edit never chains behind someone else's record.
  return (
    asserted.length === 1 && asserted[0].author === author && asserted[0].family === p.body.family
  );
}

function dependsOnAnother(e: ExpectedWrite): boolean {
  return e.middle?.kind === "mintedBy" || e.target.kind === "mintedBy";
}

/**
 * Checks a prepared batch against the gesture's expectation, as signed by
 * `author` (this device's address). Throws `IntentMismatch` on the first
 * disagreement; returns only when every write is accounted for exactly once.
 */
export function checkIntent(
  expected: Expectation,
  author: string,
  batch: readonly Proposal[],
): void {
  for (const p of batch) {
    if (p.body.author !== author) {
      throw new IntentMismatch(`a write is authored by ${p.body.author}, not by this device's key`);
    }
    if (p.body.settlementRef !== null) {
      throw new IntentMismatch("a write carries a settlement reference no gesture orders");
    }
  }

  const used = new Array<boolean>(batch.length).fill(false);
  const minted = new Array<string | undefined>(expected.writes.length).fill(undefined);
  // Writes that mint first, so a write naming another's mint resolves
  // against the write actually matched for it.
  const order = expected.writes
    .map((_, i) => i)
    .sort((a, b) => Number(dependsOnAnother(expected.writes[a])) - Number(dependsOnAnother(expected.writes[b])));
  for (const i of order) {
    const e = expected.writes[i];
    const at = batch.findIndex((p, j) => !used[j] && matches(e, p, author, minted));
    if (at < 0) {
      throw new IntentMismatch(`no write in the batch is the ${e.family} the gesture ordered`);
    }
    used[at] = true;
    minted[i] = batch[at].body.target.toString();
  }

  for (const n of expected.netting) {
    let netD = n.rawPDirected;
    let netI = n.rawPInterest;
    let count = 0;
    batch.forEach((p, j) => {
      if (used[j]) return;
      const body = p.body;
      if (body.family !== n.family || body.target.toString() !== n.target) return;
      if ((body.middle?.toString() ?? null) !== n.middle) return;
      if (!inRange(body.pD) || !inRange(body.pI)) {
        throw new IntentMismatch("a counter-record lies outside [-1, 1]");
      }
      if (body.license !== null || body.assertedParents.length !== 0 || p.payload.length !== 0) {
        throw new IntentMismatch("a counter-record carries more than its two values");
      }
      used[j] = true;
      count += 1;
      netD += body.pD;
      netI += body.pI;
    });
    if (count !== n.cost) {
      throw new IntentMismatch(`the walk-back stages ${count} records where ${n.cost} were shown`);
    }
    if (netD !== 0 || netI !== 0) {
      throw new IntentMismatch("the walk-back does not net the shown bundle to (0, 0)");
    }
  }

  if (used.some((u) => !u)) {
    throw new IntentMismatch("the batch carries a write the gesture never ordered");
  }
}

// ---- the expectations each gesture builds -----------------------------------

/** A node read off the screen, by its raw L1 identifier. */
export function node(id: string): NodeExpectation {
  return { kind: "node", id };
}

/** The Type a topic name canonicalizes to (hashtag.md §1). */
export function topicNode(name: string): string {
  return `name:${previewTagName(name).canonical}`;
}

/** Affinity toward a Type, Opinion toward everything else (edges.md §2). */
export function stanceFamilyOf(targetGraphId: string): Family {
  return targetGraphId.startsWith("name:") ? "affinity" : "opinion";
}

/**
 * The license string a record carries (data-model.md "License
 * qualifiers"): `a=<degree>;o=<degree>`, each rendered to three decimals
 * with trailing zeros trimmed — the server's `License::canonical`.
 */
export function canonicalLicense(license: { attribution: number; provenance: number }): string {
  const axis = (x: number) => x.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `a=${axis(license.attribution)};o=${axis(license.provenance)}`;
}

/** A new post's genesis Publish: `p_i` is census-fixed at 1. */
export function postGenesis(pDirected: number, license: string): ExpectedWrite {
  return {
    family: "publish",
    middle: null,
    target: { kind: "ownMint" },
    pDirected,
    pInterest: 1,
    license,
    parents: "none",
    payload: "present",
  };
}

/** A new comment's genesis Review, its A leg at the parent on screen. */
export function commentGenesis(
  parentGraphId: string,
  pDirected: number,
  pInterest: number,
  license: string,
): ExpectedWrite {
  return {
    family: "review",
    middle: node(parentGraphId),
    target: { kind: "ownMint" },
    pDirected,
    pInterest,
    license,
    parents: "none",
    payload: "present",
  };
}

/** A post edit: an ordinary-role Publish at (0, 1) chained behind its own head. */
export function postEdit(postGraphId: string): ExpectedWrite {
  return {
    family: "publish",
    middle: null,
    target: node(postGraphId),
    pDirected: 0,
    pInterest: 1,
    license: null,
    parents: "ownChainHead",
    payload: "present",
  };
}

/** A comment edit: an ordinary-role Review at (0, 0) chained behind its own head. */
export function commentEdit(parentGraphId: string, commentGraphId: string): ExpectedWrite {
  return {
    family: "review",
    middle: node(parentGraphId),
    target: node(commentGraphId),
    pDirected: 0,
    pInterest: 0,
    license: null,
    parents: "ownChainHead",
    payload: "present",
  };
}

/** One Tag act: relevance and confidence, exactly as picked. */
export function tagClaim(
  middle: NodeExpectation,
  name: string,
  relevance: number,
  confidence: number,
): ExpectedWrite {
  return {
    family: "tag",
    middle,
    target: node(topicNode(name)),
    pDirected: relevance,
    pInterest: confidence,
    license: null,
    parents: "none",
    payload: "empty",
  };
}

/** One Reference act: relevance and support, exactly as picked. */
export function referenceClaim(
  middle: NodeExpectation,
  targetGraphId: string,
  relevance: number,
  support: number,
): ExpectedWrite {
  return {
    family: "reference",
    middle,
    target: node(targetGraphId),
    pDirected: relevance,
    pInterest: support,
    license: null,
    parents: "none",
    payload: "empty",
  };
}

/** One stance record: the picked pair, never a delta (design.md §8.1). */
export function stanceRecord(
  targetGraphId: string,
  pDirected: number,
  pInterest: number,
): ExpectedWrite {
  return {
    family: stanceFamilyOf(targetGraphId),
    middle: null,
    target: node(targetGraphId),
    pDirected,
    pInterest,
    license: null,
    parents: "none",
    payload: "empty",
  };
}

/** A profile update: the carrier Registration at (1, 1), chained on the own profile. */
export function profileUpdate(): ExpectedWrite {
  return {
    family: "registration",
    middle: null,
    target: { kind: "ownProfile" },
    pDirected: 1,
    pInterest: 1,
    license: null,
    parents: "ownChainHead",
    payload: "present",
  };
}

/** Severance: the counter-records netting the shown bundle toward a target. */
export function severance(
  targetGraphId: string,
  shown: { rawPDirected: number; rawPInterest: number; cost: number },
): ExpectedNetting {
  return {
    family: stanceFamilyOf(targetGraphId),
    middle: null,
    target: targetGraphId,
    rawPDirected: shown.rawPDirected,
    rawPInterest: shown.rawPInterest,
    cost: shown.cost,
  };
}

/** A citation withdrawal: the counter-records netting the shown citation bundle. */
export function referenceWithdrawal(
  artifactGraphId: string,
  targetGraphId: string,
  shown: { rawRelevance: number; rawSupport: number; cost: number },
): ExpectedNetting {
  return {
    family: "reference",
    middle: artifactGraphId,
    target: targetGraphId,
    rawPDirected: shown.rawRelevance,
    rawPInterest: shown.rawSupport,
    cost: shown.cost,
  };
}
