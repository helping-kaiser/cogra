// What each authoring gesture ordered, rebuilt from its form state for the
// intent check (Intent.kt; web twin: src/lib/compose/intent.ts). Every
// value here is one the form holds — the picked pairs, the drafted topics
// and citations, the license — and every node is named by the L1 id the
// read surface served for it (`ContentRepository.graphIds`).

package com.cogra.domain.signing

import com.cogra.domain.LicenseChoice
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.topics.TagClaim

/** A form's L2 id that was never read as an L1 id: a programming fault, not a verdict. */
private fun Map<String, String>.graphIdOf(id: String): String =
    get(id) ?: throw IllegalStateException("graph identifier for $id was never read")

private fun LicenseChoice.canonical(): String = canonicalLicense(attribution, provenance)

/** The topic and citation acts hung off a minting record or a standing node. */
private fun claims(
    middle: NodeExpectation,
    tags: List<TagClaim>,
    references: List<ReferenceClaim>,
    graphIds: Map<String, String>,
): List<ExpectedWrite> =
    tags.map { tagClaim(middle, it.name, it.relevance, it.confidence) } +
        references.map { referenceClaim(middle, graphIds.graphIdOf(it.targetId), it.relevance, it.support) }

/** A new post: its genesis Publish, then one act per topic and per citation. */
fun postExpectation(
    pDirected: Double,
    license: LicenseChoice,
    tags: List<TagClaim>,
    references: List<ReferenceClaim>,
    graphIds: Map<String, String>,
): Expectation = Expectation(
    listOf(postGenesis(pDirected, license.canonical())) +
        claims(NodeExpectation.MintedBy(0), tags, references, graphIds),
)

/** A new comment: its genesis Review at the parent, then its topics and citations. */
@Suppress("LongParameterList") // one parameter per thing the reply seal holds
fun commentExpectation(
    parentGraphId: String,
    pDirected: Double,
    pInterest: Double,
    license: LicenseChoice,
    tags: List<TagClaim>,
    references: List<ReferenceClaim>,
    graphIds: Map<String, String>,
): Expectation = Expectation(
    listOf(commentGenesis(parentGraphId, pDirected, pInterest, license.canonical())) +
        claims(NodeExpectation.MintedBy(0), tags, references, graphIds),
)

/**
 * One citation an edit withdraws, as its card showed it: the cited node's
 * L2 id, the raw sums the walk-back must net, and its cost.
 */
data class WithdrawnReference(
    val targetId: String,
    val rawRelevance: Double,
    val rawSupport: Double,
    val cost: Int,
)

/**
 * The acts card of an edit: the record when it is staged, one Tag act per
 * tag change ([tags] carry the relevance each act signs — 0 for an
 * un-tag), one Reference act per citation added or revised, and one
 * walk-back per citation withdrawn, checked against the raw sums its card
 * was read with.
 */
@Suppress("LongParameterList") // one parameter per row kind the acts card lists
fun editExpectation(
    nodeGraphId: String,
    record: ExpectedWrite?,
    tags: List<TagClaim>,
    references: List<ReferenceClaim>,
    withdrawals: List<WithdrawnReference>,
    graphIds: Map<String, String>,
): Expectation = Expectation(
    writes = listOfNotNull(record) + claims(node(nodeGraphId), tags, references, graphIds),
    netting = withdrawals.map {
        referenceWithdrawal(nodeGraphId, graphIds.graphIdOf(it.targetId), it.rawRelevance, it.rawSupport, it.cost)
    },
)
