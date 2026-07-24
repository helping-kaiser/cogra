// Transport encodings for the handshake objects that cross the API
// (reference: crates/common/src/l1/wire.rs) — the prepared proposal the
// device signs (`canonicalProposal`), the sealed verified act it
// approves (`verifiedAct`), and the pre-commitment blob it submits (the
// opaque `signature` input). The wire form is versioned CBOR over the
// same deterministic subset as the signing bases; the structural body
// travels as its exact canonical bytes, so what the device parses is
// what it signs.

package com.cogra.crypto

/** A wire blob that does not parse. */
class WireException(message: String) : Exception(message)

/** The wire format version every envelope opens with. */
private const val WIRE_VERSION = 1UL

/** The device's pre-commitment leg: nonce plus pre-commitment signature. */
class PreCommitment(val nonce: ByteArray, val preSignature: ByteArray)

private fun encodeBodyBytes(body: StructuralBody): ByteArray = body.canonicalBytes()

private fun decodeBody(bytes: ByteArray): StructuralBody {
    val d = CborDecoder(bytes)
    try {
        if (d.array() != 9UL) throw WireException("malformed structural body")
        val actId = ActId.parse(d.text())
        val middle = d.textOrNull()?.let { NodeId.parse(it) }
        val target = NodeId.parse(d.text())
        val pD = d.float()
        val pI = d.float()
        val settlementRef = d.textOrNull()?.let { ActId.parse(it) }
        val license = d.textOrNull()
        val n = d.array()
        val assertedParents = (0UL until n).map { ActId.parse(d.text()) }
        if (d.uint() != 1UL) throw WireException("malformed structural body version")
        d.finish()
        return StructuralBody(
            author = actId.author,
            seq = actId.seq,
            family = actId.family,
            middle = middle,
            target = target,
            pD = pD,
            pI = pI,
            settlementRef = settlementRef,
            license = license,
            assertedParents = assertedParents,
        )
    } catch (e: CborDecodeException) {
        throw WireException("malformed structural body: ${e.message}")
    } catch (e: IdentifierException) {
        throw WireException("malformed structural body: ${e.message}")
    }
}

private fun CborEncoder.deps(deps: List<ActId>) {
    array(deps.size.toULong())
    for (dep in deps) text(dep.toString())
}

private fun decodeDeps(d: CborDecoder): List<ActId> {
    val n = d.array()
    return (0UL until n).map { ActId.parse(d.text()) }
}

/** The prepared proposal, as `PreparedWrite.canonicalProposal` carries it. */
fun encodeProposal(p: Proposal): ByteArray {
    val e = CborEncoder()
    e.array(4u)
    e.uint(WIRE_VERSION)
    e.bytes(encodeBodyBytes(p.body))
    e.bytes(p.payload)
    e.deps(p.deps)
    return e.finish()
}

fun decodeProposal(bytes: ByteArray): Proposal {
    val d = CborDecoder(bytes)
    try {
        if (d.array() != 4UL) throw WireException("malformed proposal")
        val version = d.uint()
        if (version != WIRE_VERSION) throw WireException("unsupported wire version $version")
        val body = decodeBody(d.bytes())
        val payload = d.bytes()
        val deps = decodeDeps(d)
        d.finish()
        return Proposal(body, payload, deps)
    } catch (e: CborDecodeException) {
        throw WireException("malformed proposal: ${e.message}")
    } catch (e: IdentifierException) {
        throw WireException("malformed proposal: ${e.message}")
    }
}

/**
 * The host-sealed verified act, as `StagedWrite.verifiedAct` carries it
 * — every host-added field visible to the device before approval.
 */
fun encodeVerifiedAct(act: VerifiedAct): ByteArray {
    val e = CborEncoder()
    e.array(12u)
    e.uint(WIRE_VERSION)
    e.bytes(encodeBodyBytes(act.proposal.body))
    e.bytes(act.proposal.payload)
    e.deps(act.proposal.deps)
    e.bytes(act.authorPubkey)
    e.bytes(act.nonce)
    e.bytes(act.preSignature)
    e.bytes(act.contentSalt)
    e.bytes(act.depsSalt)
    e.bytes(act.contentCommitment)
    e.bytes(act.depsCommitment)
    e.bytes(act.hostSeal)
    return e.finish()
}

fun decodeVerifiedAct(bytes: ByteArray): VerifiedAct {
    val d = CborDecoder(bytes)
    try {
        if (d.array() != 12UL) throw WireException("malformed verified act")
        val version = d.uint()
        if (version != WIRE_VERSION) throw WireException("unsupported wire version $version")
        val body = decodeBody(d.bytes())
        val payload = d.bytes()
        val deps = decodeDeps(d)
        val act = VerifiedAct(
            proposal = Proposal(body, payload, deps),
            authorPubkey = d.bytes(),
            nonce = d.bytes(),
            preSignature = d.bytes(),
            contentSalt = d.bytes(),
            depsSalt = d.bytes(),
            contentCommitment = d.bytes(),
            depsCommitment = d.bytes(),
            hostSeal = d.bytes(),
        )
        d.finish()
        return act
    } catch (e: CborDecodeException) {
        throw WireException("malformed verified act: ${e.message}")
    } catch (e: IdentifierException) {
        throw WireException("malformed verified act: ${e.message}")
    }
}

/**
 * The device's pre-commitment leg as the opaque `signature` input
 * carries it. The author's public key never rides the wire — the
 * backend binds it from the account's identity association.
 */
fun encodePreCommitment(nonce: ByteArray, preSignature: ByteArray): ByteArray {
    val e = CborEncoder()
    e.array(3u)
    e.uint(WIRE_VERSION)
    e.bytes(nonce)
    e.bytes(preSignature)
    return e.finish()
}

/** Convenience for the device side: the pre-signed proposal's wire blob. */
fun encodePreCommitmentOf(pre: PreSignedProposal): ByteArray =
    encodePreCommitment(pre.nonce, pre.preSignature)

fun decodePreCommitment(bytes: ByteArray): PreCommitment {
    val d = CborDecoder(bytes)
    try {
        if (d.array() != 3UL) throw WireException("malformed pre-commitment")
        val version = d.uint()
        if (version != WIRE_VERSION) throw WireException("unsupported wire version $version")
        val nonce = d.bytes()
        val signature = d.bytes()
        d.finish()
        return PreCommitment(nonce, signature)
    } catch (e: CborDecodeException) {
        throw WireException("malformed pre-commitment: ${e.message}")
    }
}
