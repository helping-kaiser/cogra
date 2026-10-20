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
// settlement reference, the license, the asserted parents — and the
// payload's FIELDS, read by the device's own envelope decoder
// (crypto/envelope.ts): the node the payload binds to, the title,
// description and words, the gallery in order with each picture's
// description, poster and both digests, the self-mark, and a profile's
// name, bio, website and avatar. The sequence value and the dependency
// list are not: the seq is allocated by the backend, and dependencies are
// server-completed ordering facts the author never chose — L1 refuses an
// unsatisfiable one.
//
// THE SERVER'S NORMALIZATION IS PART OF THE EXPECTATION. The server trims a
// title, a description and alt text with Rust's `str::trim`, whose
// whitespace set is Unicode's White_Space property — not JavaScript's
// (which adds U+FEFF and drops U+0085). `serverTrim` is that set, pinned by
// the vectors' `trims` group; a naive `trim()` here would refuse lawful
// writes or accept altered ones.
//
// BOTH DIGESTS, ALWAYS. Every manifest entry carries the rendition digest
// the device read for the asset at READY and the upload digest the device
// computed over the bytes it sent. A placement the device neither uploaded
// nor read from the version it is editing has neither, and is refused: there
// is nothing to check it against.
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
// shown raw sums plus the batch net to exactly (0, 0) in exact decimal
// arithmetic (`@/lib/stance/exact`) — the records carry picked values,
// never deltas (design.md §8.1), so the net is the only thing a walk-back
// means.
//
// The shared `intent-vectors.json` pins this file and Intent.kt to the
// same verdicts over the same canonical bytes.

import { toHex } from "@/lib/crypto/bytes";
import {
  decodeContent,
  decodeProfile,
  EnvelopeError,
  type CograContent,
  type CograProfile,
  type MediaAsset,
} from "@/lib/crypto/envelope";
import type { Proposal } from "@/lib/crypto/handshake";
import type { Family } from "@/lib/crypto/identifiers";
import { netsToZero } from "@/lib/stance/exact";
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

/** One manifest entry the gesture ordered — every key the envelope carries. */
export type ExpectedAsset = {
  readonly kind: "asset";
  /** The rendition digest the device read for the asset at READY, hex. */
  readonly digest: string;
  readonly mime: string;
  readonly altText: string | null;
  /** The poster's rendition digest, hex. */
  readonly cover: string | null;
  readonly coverTaken: boolean;
  /** The upload digest the device computed over the bytes it sent, hex. */
  readonly uploadDigest: string;
};

/** A placement the device can state nothing about: it never matches. */
export type UnknownAsset = { readonly kind: "unknown"; readonly mediaId: string };

/** What a content payload must decode to. */
export type ExpectedContent = {
  /** The L2 node id the prepare named for this content. */
  readonly node: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly body: string | null;
  readonly media: readonly (ExpectedAsset | UnknownAsset)[];
  readonly sensitive: { readonly reason: string | null } | null;
};

/** What a profile payload must decode to; the avatar three-valued. */
export type ExpectedProfile = {
  readonly node: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly websiteUrl: string | null;
  readonly avatar:
    | { readonly state: "untouched" }
    | { readonly state: "cleared" }
    | { readonly state: "set"; readonly asset: ExpectedAsset | UnknownAsset };
};

/** A write's payload: none at all, or an envelope whose fields are stated. */
export type PayloadExpectation =
  | "empty"
  | { readonly kind: "content"; readonly content: ExpectedContent }
  | { readonly kind: "profile"; readonly profile: ExpectedProfile };

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
  readonly payload: PayloadExpectation;
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
 * The named exemption: the admission Registration, which the backend
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

// ---- the server's normalization ---------------------------------------------

/**
 * Unicode's White_Space property — the set Rust's `char::is_whitespace`,
 * and so `str::trim`, reads.
 */
function isServerWhitespace(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    code === 0x20 ||
    code === 0x85 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000
  );
}

/** Rust's `str::trim`: White_Space off both ends, nothing else. */
export function serverTrim(s: string): string {
  const chars = Array.from(s);
  let start = 0;
  let end = chars.length;
  while (start < end && isServerWhitespace(chars[start].codePointAt(0) ?? 0)) start++;
  while (end > start && isServerWhitespace(chars[end - 1].codePointAt(0) ?? 0)) end--;
  return chars.slice(start, end).join("");
}

/** A title, description or alt text as the server carries it: trimmed, blank folded to absent. */
export function serverChecked(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const trimmed = serverTrim(s);
  return trimmed === "" ? null : trimmed;
}

/** Words or a reason as the server carries them: untouched, blank folded to absent. */
export function serverBlankFolded(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  return serverTrim(s) === "" ? null : s;
}

// ---- the check -------------------------------------------------------------

function assetMatches(e: ExpectedAsset | UnknownAsset, a: MediaAsset): boolean {
  if (e.kind === "unknown") return false;
  return (
    toHex(a.digest) === e.digest &&
    a.mime === e.mime &&
    a.altText === e.altText &&
    (a.cover === null ? null : toHex(a.cover)) === e.cover &&
    a.coverTaken === e.coverTaken &&
    a.uploadDigest !== null &&
    toHex(a.uploadDigest) === e.uploadDigest
  );
}

function contentMatches(e: ExpectedContent, c: CograContent): boolean {
  return (
    c.node === e.node &&
    c.title === e.title &&
    c.description === e.description &&
    c.body === e.body &&
    c.media.length === e.media.length &&
    c.media.every((asset, i) => assetMatches(e.media[i], asset)) &&
    (c.sensitive === null
      ? e.sensitive === null
      : e.sensitive !== null && c.sensitive.reason === e.sensitive.reason)
  );
}

function profileMatches(e: ExpectedProfile, p: CograProfile): boolean {
  if (
    p.node !== e.node ||
    p.displayName !== e.displayName ||
    p.bio !== e.bio ||
    p.websiteUrl !== e.websiteUrl ||
    p.avatar.state !== e.avatar.state
  ) {
    return false;
  }
  if (p.avatar.state !== "set" || e.avatar.state !== "set") return true;
  return assetMatches(e.avatar.asset, p.avatar.asset);
}

/** The payload against its expectation, through the device's own decoder. */
function payloadMatches(e: PayloadExpectation, payload: Uint8Array): boolean {
  if (e === "empty") return payload.length === 0;
  try {
    return e.kind === "content"
      ? contentMatches(e.content, decodeContent(payload))
      : profileMatches(e.profile, decodeProfile(payload));
  } catch (err) {
    // A payload the decoder refuses is not the gesture ordered.
    if (err instanceof EnvelopeError) return false;
    throw err;
  }
}

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
  return payloadMatches(e.payload, p.payload);
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
    if (!Number.isFinite(n.rawPDirected) || !Number.isFinite(n.rawPInterest)) {
      throw new IntentMismatch("the shown bundle is not a finite sum");
    }
    const netD = [n.rawPDirected];
    const netI = [n.rawPInterest];
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
      netD.push(body.pD);
      netI.push(body.pI);
    });
    if (count !== n.cost) {
      throw new IntentMismatch(`the walk-back stages ${count} records where ${n.cost} were shown`);
    }
    // Summed as the decimals the values denote, never as doubles
    // (edges.md §1): the backend nets that way, and floating addition
    // misses zero on lawful walk-backs.
    if (!netsToZero(netD) || !netsToZero(netI)) {
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
export function postGenesis(
  pDirected: number,
  license: string,
  content: ExpectedContent,
): ExpectedWrite {
  return {
    family: "publish",
    middle: null,
    target: { kind: "ownMint" },
    pDirected,
    pInterest: 1,
    license,
    parents: "none",
    payload: { kind: "content", content },
  };
}

/** A new comment's genesis Review, its A leg at the parent on screen. */
export function commentGenesis(
  parentGraphId: string,
  pDirected: number,
  pInterest: number,
  license: string,
  content: ExpectedContent,
): ExpectedWrite {
  return {
    family: "review",
    middle: node(parentGraphId),
    target: { kind: "ownMint" },
    pDirected,
    pInterest,
    license,
    parents: "none",
    payload: { kind: "content", content },
  };
}

/**
 * A post edit: an ordinary-role Publish at the author's pick — the edit's
 * own attachment, 0 unless moved (post.md §4, round 15) — with `p_i`
 * census-fixed at 1, chained behind its own head.
 */
export function postEdit(postGraphId: string, content: ExpectedContent, pick: number): ExpectedWrite {
  return {
    family: "publish",
    middle: null,
    target: node(postGraphId),
    pDirected: pick,
    pInterest: 1,
    license: null,
    parents: "ownChainHead",
    payload: { kind: "content", content },
  };
}

/** A comment edit: an ordinary-role Review at (0, 0) chained behind its own head. */
export function commentEdit(
  parentGraphId: string,
  commentGraphId: string,
  content: ExpectedContent,
): ExpectedWrite {
  return {
    family: "review",
    middle: node(parentGraphId),
    target: node(commentGraphId),
    pDirected: 0,
    pInterest: 0,
    license: null,
    parents: "ownChainHead",
    payload: { kind: "content", content },
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
export function profileUpdate(profile: ExpectedProfile): ExpectedWrite {
  return {
    family: "registration",
    middle: null,
    target: { kind: "ownProfile" },
    pDirected: 1,
    pInterest: 1,
    license: null,
    parents: "ownChainHead",
    payload: { kind: "profile", profile },
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
