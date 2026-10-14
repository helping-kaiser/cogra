// The intent check over a decoded batch (Intent.kt holds the law it checks;
// web mirror: src/lib/signing/intent.ts `checkIntent`).

package com.cogra.domain.signing

import com.cogra.crypto.Proposal

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
