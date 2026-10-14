// The intent check (architecture.md "The write path", step 2; web mirror:
// src/lib/signing/intent.ts). The transport check proves the device signs
// exactly the bytes it pre-signed; this proves those bytes are the gesture
// its user ordered. Before the first pre-signature of a batch, the device
// rebuilds what every act's structural body must be from the form state the
// gesture was made with — the EXPECTATION — and refuses the whole batch on
// any write that is extra, missing, or different.
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
// one value, as on web, whose JSON cannot carry the sign of zero.
//
// A NETTING BATCH IS CHECKED AS A PROPERTY. Severance and citation
// withdrawal stage counter-records the server computes from the bundle, so
// the device cannot know each write in advance. It checks instead that
// every counter-record points where the shown bundle points, stays in
// range, that there are exactly as many as the cost shown, and that the
// shown raw sums plus the batch net to exactly (0, 0) — the records carry
// picked values, never deltas (design.md §8.1).
//
// The shared `intent-vectors.json` pins this file and intent.ts to the same
// verdicts over the same canonical bytes.

@file:Suppress("TooManyFunctions") // the check's own steps, and one expectation builder per gesture

package com.cogra.domain.signing

import com.cogra.crypto.Family
import com.cogra.crypto.Proposal
import com.cogra.crypto.WireException
import com.cogra.crypto.decodeProposal
import java.util.Locale

/** Where an expected write's middle or target must point. */
sealed interface NodeExpectation {
    /** Exactly this node — a raw L1 identifier read off the screen. */
    data class Node(val id: String) : NodeExpectation

    /** The node this write mints: `mint:<its own act id>`. */
    data object OwnMint : NodeExpectation

    /** The node another write of the same batch mints, by its index in `writes`. */
    data class MintedBy(val write: Int) : NodeExpectation

    /** The author's own profile, `prof:<author>`. */
    data object OwnProfile : NodeExpectation
}

/** None, or exactly one parent: the head of the author's own chain on this node. */
enum class Parents { NONE, OWN_CHAIN_HEAD }

/** Whether a payload rides the act at all. */
enum class PayloadPresence { EMPTY, PRESENT }

/** One write the gesture ordered, field by field. */
data class ExpectedWrite(
    val family: Family,
    val middle: NodeExpectation?,
    val target: NodeExpectation,
    val pDirected: Double,
    val pInterest: Double,
    val license: String?,
    val parents: Parents,
    val payload: PayloadPresence,
)

/** A walk-back the server computes: checked as a net-to-zero property. */
data class ExpectedNetting(
    val family: Family,
    val middle: String?,
    val target: String,
    /** The raw sums the read surface served, before the clip. */
    val rawPDirected: Double,
    val rawPInterest: Double,
    /** The record count the user was shown as the gesture's cost. */
    val cost: Int,
)

/** What the device checks a staged write against before it signs. */
sealed interface Intent

/** What a gesture's batch must be, rebuilt from its form state. */
data class Expectation(
    val writes: List<ExpectedWrite>,
    val netting: List<ExpectedNetting> = emptyList(),
) : Intent

/**
 * The one named exemption: the admission Registration, which the backend
 * stages at approval and the device discovers on its status poll with no
 * form behind it. It still runs every transport check, and it holds only
 * for a Registration.
 */
data object RegistrationExemption : Intent

/**
 * The carried batch's signing at the landing (WriteSigner.signCarriedAtLanding):
 * no form is held for it there, so it runs the transport checks alone. Internal,
 * so no surface outside this module can choose it.
 */
internal data object TransportOnly : Intent

/** The device found the batch is not what its user ordered. */
class IntentMismatchException(message: String) : Exception(message)

/** Joins the expectations of several prepares a single gesture signs as one batch. */
fun joinExpectations(parts: List<Expectation>): Expectation {
    val writes = mutableListOf<ExpectedWrite>()
    val netting = mutableListOf<ExpectedNetting>()
    for (part in parts) {
        val offset = writes.size
        for (write in part.writes) {
            writes += write.copy(middle = write.middle?.shifted(offset), target = write.target.shifted(offset))
        }
        netting += part.netting
    }
    return Expectation(writes, netting)
}

private fun NodeExpectation.shifted(offset: Int): NodeExpectation =
    if (this is NodeExpectation.MintedBy) NodeExpectation.MintedBy(write + offset) else this

// ---- the check -------------------------------------------------------------

private fun inRange(x: Double): Boolean = x.isFinite() && x >= -1.0 && x <= 1.0

private fun ownMintOf(p: Proposal): String = "mint:${p.body.actId()}"

private fun resolve(node: NodeExpectation, p: Proposal, author: String, minted: Array<String?>): String? =
    when (node) {
        is NodeExpectation.Node -> node.id
        NodeExpectation.OwnMint -> ownMintOf(p)
        is NodeExpectation.MintedBy -> minted[node.write]
        NodeExpectation.OwnProfile -> "prof:$author"
    }

private fun parentsMatch(parents: Parents, p: Proposal, author: String): Boolean {
    val asserted = p.body.assertedParents
    return when (parents) {
        Parents.NONE -> asserted.isEmpty()
        // The chain head is the backend's to read (substrate.md §9): the
        // device cannot know its sequence value, only that it is one act,
        // its own, of the same family — an edit never chains behind
        // someone else's record.
        Parents.OWN_CHAIN_HEAD ->
            asserted.size == 1 && asserted[0].author == author && asserted[0].family == p.body.family
    }
}

private fun matches(e: ExpectedWrite, p: Proposal, author: String, minted: Array<String?>): Boolean {
    val body = p.body
    val target = resolve(e.target, p, author, minted)
    val middleMatches = when (val middle = e.middle) {
        null -> body.middle == null
        else -> {
            val expectedMiddle = resolve(middle, p, author, minted)
            expectedMiddle != null && body.middle?.toString() == expectedMiddle
        }
    }
    // `==` on two Doubles is the IEEE comparison: false for NaN, true
    // across the two zeros — exactly the equality the header states.
    val valuesMatch = body.pD == e.pDirected && body.pI == e.pInterest
    val payloadMatches = when (e.payload) {
        PayloadPresence.EMPTY -> p.payload.isEmpty()
        PayloadPresence.PRESENT -> p.payload.isNotEmpty()
    }
    return body.family == e.family &&
        target != null &&
        body.target.toString() == target &&
        middleMatches &&
        valuesMatch &&
        body.license == e.license &&
        parentsMatch(e.parents, p, author) &&
        payloadMatches
}

private fun dependsOnAnother(e: ExpectedWrite): Boolean =
    e.middle is NodeExpectation.MintedBy || e.target is NodeExpectation.MintedBy

/** The batch is not what its user ordered: says why, and never returns. */
private fun mismatch(message: String): Nothing = throw IntentMismatchException(message)

/**
 * Checks a prepared batch against the gesture's expectation, as signed by
 * [author] (this device's address). Throws [IntentMismatchException] on the
 * first disagreement; returns only when every write is accounted for
 * exactly once.
 */
fun checkIntent(expected: Expectation, author: String, batch: List<Proposal>) {
    for (p in batch) {
        if (p.body.author != author) mismatch("a write is authored by ${p.body.author}, not by this device's key")
        if (p.body.settlementRef != null) mismatch("a write carries a settlement reference no gesture orders")
    }

    val used = BooleanArray(batch.size)
    val minted = arrayOfNulls<String>(expected.writes.size)
    // Writes that mint first, so a write naming another's mint resolves
    // against the write actually matched for it.
    val order = expected.writes.indices.sortedBy { if (dependsOnAnother(expected.writes[it])) 1 else 0 }
    for (i in order) {
        val e = expected.writes[i]
        val at = batch.indices.firstOrNull { j -> !used[j] && matches(e, batch[j], author, minted) }
            ?: mismatch("no write in the batch is the ${e.family.wireName} the gesture ordered")
        used[at] = true
        minted[i] = batch[at].body.target.toString()
    }

    for (n in expected.netting) checkNetting(n, batch, used)

    if (used.any { !it }) mismatch("the batch carries a write the gesture never ordered")
}

/** Whether an unclaimed write is one of [n]'s counter-records: same family, same endpoints. */
private fun counterRecordOf(n: ExpectedNetting, p: Proposal): Boolean =
    p.body.family == n.family && p.body.target.toString() == n.target && p.body.middle?.toString() == n.middle

/** A counter-record carries its two values and nothing else, each inside the census range. */
private fun checkCounterRecord(p: Proposal) {
    val body = p.body
    if (!inRange(body.pD) || !inRange(body.pI)) mismatch("a counter-record lies outside [-1, 1]")
    if (body.license != null || body.assertedParents.isNotEmpty() || p.payload.isNotEmpty()) {
        mismatch("a counter-record carries more than its two values")
    }
}

private fun checkNetting(n: ExpectedNetting, batch: List<Proposal>, used: BooleanArray) {
    var netD = n.rawPDirected
    var netI = n.rawPInterest
    var count = 0
    for (j in batch.indices) {
        if (used[j] || !counterRecordOf(n, batch[j])) continue
        checkCounterRecord(batch[j])
        used[j] = true
        count += 1
        netD += batch[j].body.pD
        netI += batch[j].body.pI
    }
    if (count != n.cost) mismatch("the walk-back stages $count records where ${n.cost} were shown")
    if (netD != 0.0 || netI != 0.0) mismatch("the walk-back does not net the shown bundle to (0, 0)")
}

/**
 * Why the batch is not what [intent] says it must be, or null when it is.
 * A proposal that does not parse is a refusal too — the device cannot check
 * what it cannot read. [author] is this device's address.
 */
internal fun intentRefusal(author: String, proposals: List<ByteArray>, intent: Intent): String? = try {
    val batch = proposals.map { decodeProposal(it) }
    when (intent) {
        RegistrationExemption ->
            if (batch.all { it.body.family == Family.REGISTRATION }) {
                null
            } else {
                "only a Registration is exempt from the intent check"
            }
        is Expectation -> {
            checkIntent(intent, author, batch)
            null
        }
        TransportOnly -> null
    }
} catch (e: IntentMismatchException) {
    e.message ?: "the batch is not the gesture ordered"
} catch (e: WireException) {
    e.message ?: "malformed proposal"
}

// ---- the expectations each gesture builds -----------------------------------

/** A node read off the screen, by its raw L1 identifier. */
fun node(id: String): NodeExpectation = NodeExpectation.Node(id)

/** The Type a topic name canonicalizes to (hashtag.md §1): one leading `#` off, ASCII lowercase. */
fun topicNode(name: String): String = "name:${name.removePrefix("#").lowercase(Locale.ROOT)}"

/** Affinity toward a Type, Opinion toward everything else (edges.md §2). */
fun stanceFamilyOf(targetGraphId: String): Family =
    if (targetGraphId.startsWith("name:")) Family.AFFINITY else Family.OPINION

/**
 * The license string a record carries (data-model.md "License
 * qualifiers"): `a=<degree>;o=<degree>`, each rendered to three decimals
 * with trailing zeros trimmed — the server's `License::canonical`.
 */
fun canonicalLicense(attribution: Double, provenance: Double): String {
    fun axis(x: Double): String = String.format(Locale.ROOT, "%.3f", x).trimEnd('0').trimEnd('.')
    return "a=${axis(attribution)};o=${axis(provenance)}"
}

/** A new post's genesis Publish: `p_i` is census-fixed at 1. */
fun postGenesis(pDirected: Double, license: String): ExpectedWrite = ExpectedWrite(
    family = Family.PUBLISH,
    middle = null,
    target = NodeExpectation.OwnMint,
    pDirected = pDirected,
    pInterest = 1.0,
    license = license,
    parents = Parents.NONE,
    payload = PayloadPresence.PRESENT,
)

/** A new comment's genesis Review, its A leg at the parent on screen. */
fun commentGenesis(parentGraphId: String, pDirected: Double, pInterest: Double, license: String): ExpectedWrite =
    ExpectedWrite(
        family = Family.REVIEW,
        middle = node(parentGraphId),
        target = NodeExpectation.OwnMint,
        pDirected = pDirected,
        pInterest = pInterest,
        license = license,
        parents = Parents.NONE,
        payload = PayloadPresence.PRESENT,
    )

/** A post edit: an ordinary-role Publish at (0, 1) chained behind its own head. */
fun postEdit(postGraphId: String): ExpectedWrite = ExpectedWrite(
    family = Family.PUBLISH,
    middle = null,
    target = node(postGraphId),
    pDirected = 0.0,
    pInterest = 1.0,
    license = null,
    parents = Parents.OWN_CHAIN_HEAD,
    payload = PayloadPresence.PRESENT,
)

/** A comment edit: an ordinary-role Review at (0, 0) chained behind its own head. */
fun commentEdit(parentGraphId: String, commentGraphId: String): ExpectedWrite = ExpectedWrite(
    family = Family.REVIEW,
    middle = node(parentGraphId),
    target = node(commentGraphId),
    pDirected = 0.0,
    pInterest = 0.0,
    license = null,
    parents = Parents.OWN_CHAIN_HEAD,
    payload = PayloadPresence.PRESENT,
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
        payload = PayloadPresence.EMPTY,
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
        payload = PayloadPresence.EMPTY,
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
    payload = PayloadPresence.EMPTY,
)

/** A profile update: the carrier Registration at (1, 1), chained on the own profile. */
fun profileUpdate(): ExpectedWrite = ExpectedWrite(
    family = Family.REGISTRATION,
    middle = null,
    target = NodeExpectation.OwnProfile,
    pDirected = 1.0,
    pInterest = 1.0,
    license = null,
    parents = Parents.OWN_CHAIN_HEAD,
    payload = PayloadPresence.PRESENT,
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
