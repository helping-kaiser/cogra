// The expectation each gesture builds from its form state (Intent.kt holds the
// shapes; web mirror: src/lib/signing/intent.ts). Census-fixed values live here,
// once, so no call site restates them.

package com.cogra.domain.signing

import com.cogra.crypto.Family

/** A new post's genesis Publish carrying [content]: `p_i` is census-fixed at 1. */
fun postGenesis(pDirected: Double, license: String, content: ExpectedContent): ExpectedWrite = ExpectedWrite(
    family = Family.PUBLISH,
    middle = null,
    target = NodeExpectation.OwnMint,
    pDirected = pDirected,
    pInterest = 1.0,
    license = license,
    parents = Parents.NONE,
    payload = PayloadExpectation.Content(content),
)

/** A new comment's genesis Review carrying [content], its A leg at the parent on screen. */
fun commentGenesis(
    parentGraphId: String,
    pDirected: Double,
    pInterest: Double,
    license: String,
    content: ExpectedContent,
): ExpectedWrite =
    ExpectedWrite(
        family = Family.REVIEW,
        middle = node(parentGraphId),
        target = NodeExpectation.OwnMint,
        pDirected = pDirected,
        pInterest = pInterest,
        license = license,
        parents = Parents.NONE,
        payload = PayloadExpectation.Content(content),
    )

/** A post edit carrying [content]: an ordinary-role Publish at (0, 1) chained behind its own head. */
fun postEdit(postGraphId: String, content: ExpectedContent): ExpectedWrite = ExpectedWrite(
    family = Family.PUBLISH,
    middle = null,
    target = node(postGraphId),
    pDirected = 0.0,
    pInterest = 1.0,
    license = null,
    parents = Parents.OWN_CHAIN_HEAD,
    payload = PayloadExpectation.Content(content),
)

/** A comment edit carrying [content]: an ordinary-role Review at (0, 0) chained behind its own head. */
fun commentEdit(parentGraphId: String, commentGraphId: String, content: ExpectedContent): ExpectedWrite = ExpectedWrite(
    family = Family.REVIEW,
    middle = node(parentGraphId),
    target = node(commentGraphId),
    pDirected = 0.0,
    pInterest = 0.0,
    license = null,
    parents = Parents.OWN_CHAIN_HEAD,
    payload = PayloadExpectation.Content(content),
)

/** One Tag act: relevance and confidence, exactly as picked. */
fun tagClaim(middle: NodeExpectation, name: String, relevance: Double, confidence: Double): ExpectedWrite =
    ExpectedWrite(
        family = Family.TAG,
        middle = middle,
        target = node(topicNode(name)),
        pDirected = relevance,
        pInterest = confidence,
        license = null,
        parents = Parents.NONE,
        payload = PayloadExpectation.Empty,
    )

/** One Reference act: relevance and support, exactly as picked. */
fun referenceClaim(middle: NodeExpectation, targetGraphId: String, relevance: Double, support: Double): ExpectedWrite =
    ExpectedWrite(
        family = Family.REFERENCE,
        middle = middle,
        target = node(targetGraphId),
        pDirected = relevance,
        pInterest = support,
        license = null,
        parents = Parents.NONE,
        payload = PayloadExpectation.Empty,
    )

/** One stance record: the picked pair, never a delta (design.md §8.1). */
fun stanceRecord(targetGraphId: String, pDirected: Double, pInterest: Double): ExpectedWrite = ExpectedWrite(
    family = stanceFamilyOf(targetGraphId),
    middle = null,
    target = node(targetGraphId),
    pDirected = pDirected,
    pInterest = pInterest,
    license = null,
    parents = Parents.NONE,
    payload = PayloadExpectation.Empty,
)

/** A profile update carrying [profile]: the carrier Registration at (1, 1), chained on the own profile. */
fun profileUpdate(profile: ExpectedProfile): ExpectedWrite = ExpectedWrite(
    family = Family.REGISTRATION,
    middle = null,
    target = NodeExpectation.OwnProfile,
    pDirected = 1.0,
    pInterest = 1.0,
    license = null,
    parents = Parents.OWN_CHAIN_HEAD,
    payload = PayloadExpectation.Profile(profile),
)

/** Severance: the counter-records netting the shown bundle toward a target. */
fun severance(targetGraphId: String, rawPDirected: Double, rawPInterest: Double, cost: Int): ExpectedNetting =
    ExpectedNetting(
        family = stanceFamilyOf(targetGraphId),
        middle = null,
        target = targetGraphId,
        rawPDirected = rawPDirected,
        rawPInterest = rawPInterest,
        cost = cost,
    )

/** A citation withdrawal: the counter-records netting the shown citation bundle. */
fun referenceWithdrawal(
    artifactGraphId: String,
    targetGraphId: String,
    rawRelevance: Double,
    rawSupport: Double,
    cost: Int,
): ExpectedNetting = ExpectedNetting(
    family = Family.REFERENCE,
    middle = artifactGraphId,
    target = targetGraphId,
    rawPDirected = rawRelevance,
    rawPInterest = rawSupport,
    cost = cost,
)
