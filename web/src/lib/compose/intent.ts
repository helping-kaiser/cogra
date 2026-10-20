// What each authoring gesture ordered, rebuilt from its form state for the
// intent check (lib/signing/intent.ts; Android twin: ComposeIntent.kt).
// Every value here is one the form holds — the picked pairs, the drafted
// topics and citations, the license, and the payload its request must
// decode to (payload-expectation.ts) — and every node is named by the L1
// id the read surface served for it (graph-ids-api.ts).

import { graphIdOf, type GraphIds } from "@/lib/api/graph-ids-api";
import type { ReferenceChange, ReferenceDraft } from "@/lib/references/draft";
import {
  canonicalLicense,
  commentGenesis,
  expectation,
  node,
  postGenesis,
  referenceClaim,
  referenceWithdrawal,
  tagClaim,
  type Expectation,
  type ExpectedContent,
  type ExpectedWrite,
  type NodeExpectation,
} from "@/lib/signing/intent";
import type { TagChange, TagDraft } from "@/lib/topics/draft";
import { WITHDRAWN_RELEVANCE } from "@/lib/topics/draft";

type License = { readonly attribution: number; readonly provenance: number };

/** The topic and citation acts hung off a minting record or a standing node. */
function claims(
  middle: NodeExpectation,
  tags: readonly TagDraft[],
  references: readonly ReferenceDraft[],
  graphIds: GraphIds,
): ExpectedWrite[] {
  return [
    ...tags.map((tag) => tagClaim(middle, tag.name, tag.relevance, tag.confidence)),
    ...references.map((reference) =>
      referenceClaim(
        middle,
        graphIdOf(graphIds, reference.targetId),
        reference.relevance,
        reference.support,
      ),
    ),
  ];
}

/**
 * A new post: its genesis Publish carrying `content` — the payload the
 * request must decode to (payload-expectation.ts) — then one act per topic
 * and per citation.
 */
export function postExpectation(
  form: {
    readonly pDirected: number;
    readonly license: License;
    readonly tags: readonly TagDraft[];
    readonly references: readonly ReferenceDraft[];
  },
  content: ExpectedContent,
  graphIds: GraphIds,
): Expectation {
  const minted: NodeExpectation = { kind: "mintedBy", write: 0 };
  return expectation([
    postGenesis(form.pDirected, canonicalLicense(form.license), content),
    ...claims(minted, form.tags, form.references, graphIds),
  ]);
}

/** A new comment: its genesis Review at the parent carrying `content`, then its topics and citations. */
export function commentExpectation(
  parentGraphId: string,
  form: {
    readonly stance: { readonly pDirected: number; readonly pInterest: number };
    readonly license: License;
    readonly tags: readonly TagDraft[];
    readonly references: readonly ReferenceDraft[];
  },
  content: ExpectedContent,
  graphIds: GraphIds,
): Expectation {
  const minted: NodeExpectation = { kind: "mintedBy", write: 0 };
  return expectation([
    commentGenesis(
      parentGraphId,
      form.stance.pDirected,
      form.stance.pInterest,
      canonicalLicense(form.license),
      content,
    ),
    ...claims(minted, form.tags, form.references, graphIds),
  ]);
}

/**
 * The acts card of an edit (edit-batch.ts): the record when it is staged,
 * one Tag act per tag change, one Reference act per citation added or
 * revised, and one walk-back per citation withdrawn — checked against the
 * raw sums its card was read with.
 */
export function editExpectation(
  nodeGraphId: string,
  record: ExpectedWrite | null,
  changes: {
    readonly tags: readonly TagChange[];
    readonly references: readonly ReferenceChange[];
  },
  graphIds: GraphIds,
): Expectation {
  const standing = node(nodeGraphId);
  const writes: ExpectedWrite[] = record === null ? [] : [record];
  for (const change of changes.tags) {
    // Withdrawing is a Tag act at relevance 0; it signs the confidence its chip showed.
    const relevance = change.kind === "tag" ? change.tag.relevance : WITHDRAWN_RELEVANCE;
    writes.push(tagClaim(standing, change.tag.name, relevance, change.tag.confidence));
  }
  const netting = [];
  for (const change of changes.references) {
    const target = graphIdOf(graphIds, change.reference.targetId);
    if (change.kind === "reference") {
      writes.push(
        referenceClaim(standing, target, change.reference.relevance, change.reference.support),
      );
    } else {
      netting.push(
        referenceWithdrawal(nodeGraphId, target, {
          rawRelevance: change.reference.rawRelevance,
          rawSupport: change.reference.rawSupport,
          cost: change.reference.withdrawalCost,
        }),
      );
    }
  }
  return expectation(writes, netting);
}
