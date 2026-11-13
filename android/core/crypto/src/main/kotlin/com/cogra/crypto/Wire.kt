// Transport encodings for the handshake objects that cross the API
// (reference: crates/common/src/l1/wire.rs for the proposal,
// crates/common/src/l1/proposal/transport.rs for the rest) — the prepared
// proposal the device signs (`canonicalProposal`), the sealed verified act
// it approves (`verifiedAct`), and the pre-commitment blob it submits (the
// opaque `signature` input). The wire form is versioned CBOR over the
// same deterministic subset as the signing bases; the structural body
// travels as its exact canonical bytes, so what the device parses is
// what it signs.

package com.cogra.crypto

/** A wire blob that does not parse. */
class WireException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** The wire format version of the prepared proposal. */
private const val PROPOSAL_WIRE_VERSION = 1UL

/**
 * The wire format version of the two-nonce handshake's envelopes — the
 * pre-commitment blob and the sealed act.
 */
private const val HANDSHAKE_WIRE_VERSION = 2UL

/** Items in the pre-commitment blob: version, content nonce, dependency nonce, pre-signature. */
private const val PRE_COMMITMENT_ITEMS = 4UL

/**
 * Items in a sealed act's wire array: version, body, pre-commitment,
 * pre-signature, both commitments, both editions, both salts, and the
 * host seal.
 */
private const val SEALED_ACT_ITEMS = 11UL

/**
 * The device's pre-commitment leg, as `ProposalSignatureInput.signature`
 * carries it: both nonces and the pre-commitment signature. The author's
 * public key never rides the wire — the backend binds it from the
 * account's identity association.
 */
class PreCommitmentBlob(
    val contentNonce: ByteArray,
    val dependencyNonce: ByteArray,
    val preSignature: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        other is PreCommitmentBlob &&
            contentNonce.contentEquals(other.contentNonce) &&
            dependencyNonce.contentEquals(other.dependencyNonce) &&
            preSignature.contentEquals(other.preSignature)

    override fun hashCode(): Int {
        var result = contentNonce.contentHashCode()
        result = 31 * result + dependencyNonce.contentHashCode()
        result = 31 * result + preSignature.contentHashCode()
        return result
    }
}

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
        throw WireException("malformed structural body: ${e.message}", e)
    } catch (e: IdentifierException) {
        throw WireException("malformed structural body: ${e.message}", e)
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
    e.uint(PROPOSAL_WIRE_VERSION)
    e.bytes(p.body.canonicalBytes())
    e.bytes(p.payload)
    e.deps(p.deps)
    return e.finish()
}

fun decodeProposal(bytes: ByteArray): Proposal {
    val d = CborDecoder(bytes)
    try {
        if (d.array() != 4UL) throw WireException("malformed proposal")
        val version = d.uint()
        if (version != PROPOSAL_WIRE_VERSION) throw WireException("unsupported wire version $version")
        val body = decodeBody(d.bytes())
        val payload = d.bytes()
        val deps = decodeDeps(d)
        d.finish()
        return Proposal(body, payload, deps)
    } catch (e: CborDecodeException) {
        throw WireException("malformed proposal: ${e.message}", e)
    } catch (e: IdentifierException) {
        throw WireException("malformed proposal: ${e.message}", e)
    }
}

/**
 * Opens a handshake envelope: its version is judged before its arity, so
 * a frame of another version — the one-nonce frames among them — is
 * refused as that version rather than as a malformed frame.
 */
private fun CborDecoder.openHandshake(arity: ULong, what: String) {
    val n = array()
    val version = uint()
    if (version != HANDSHAKE_WIRE_VERSION) throw WireException("unsupported wire version $version")
    if (n != arity) throw WireException("malformed $what")
}

/**
 * The sealed act, as `StagedWrite.verifiedAct` carries it — every
 * host-added field visible to the device before approval. It carries no
 * payload and no nonce: the device holds those itself.
 */
fun encodeSealedAct(sealed: SealedAct): ByteArray {
    val act = sealed.act
    val e = CborEncoder()
    e.array(SEALED_ACT_ITEMS)
    e.uint(HANDSHAKE_WIRE_VERSION)
    e.bytes(act.body.canonicalBytes())
    e.bytes(act.preCommitment)
    e.bytes(act.preSignature)
    e.bytes(act.contentCommitment)
    e.bytes(act.dependencyCommitment)
    e.uint(act.contentEdition)
    e.uint(act.dependencyEdition)
    e.bytes(sealed.contentSalt)
    e.bytes(sealed.dependencySalt)
    e.bytes(sealed.hostSeal)
    return e.finish()
}

fun decodeSealedAct(bytes: ByteArray): SealedAct {
    val d = CborDecoder(bytes)
    try {
        d.openHandshake(SEALED_ACT_ITEMS, "verified act")
        val act = VerifiedAct(
            body = decodeBody(d.bytes()),
            preCommitment = d.bytes(),
            preSignature = d.bytes(),
            contentCommitment = d.bytes(),
            dependencyCommitment = d.bytes(),
            contentEdition = d.uint(),
            dependencyEdition = d.uint(),
        )
        val sealed = SealedAct(
            act = act,
            contentSalt = d.bytes(),
            dependencySalt = d.bytes(),
            hostSeal = d.bytes(),
        )
        d.finish()
        return sealed
    } catch (e: CborDecodeException) {
        throw WireException("malformed verified act: ${e.message}", e)
    }
}

/** The pre-commitment blob: `[2, content nonce, dependency nonce, pre-signature]`. */
fun encodePreCommitment(blob: PreCommitmentBlob): ByteArray {
    val e = CborEncoder()
    e.array(PRE_COMMITMENT_ITEMS)
    e.uint(HANDSHAKE_WIRE_VERSION)
    e.bytes(blob.contentNonce)
    e.bytes(blob.dependencyNonce)
    e.bytes(blob.preSignature)
    return e.finish()
}

/** Convenience for the device side: the pre-signed proposal's wire blob. */
fun encodePreCommitmentOf(pre: PreSignedProposal): ByteArray =
    encodePreCommitment(PreCommitmentBlob(pre.contentNonce, pre.dependencyNonce, pre.preSignature))

fun decodePreCommitment(bytes: ByteArray): PreCommitmentBlob {
    val d = CborDecoder(bytes)
    try {
        d.openHandshake(PRE_COMMITMENT_ITEMS, "pre-commitment")
        val blob = PreCommitmentBlob(
            contentNonce = d.bytes(),
            dependencyNonce = d.bytes(),
            preSignature = d.bytes(),
        )
        d.finish()
        return blob
    } catch (e: CborDecodeException) {
        throw WireException("malformed pre-commitment: ${e.message}", e)
    }
}
