// The admission-handshake objects the device signs (reference:
// crates/common/src/l1/handshake.rs). The structural body's canonical
// bytes are the signing base of the pre-commitment and, with the host
// additions, of the seal and approval.

package com.cogra.crypto

/**
 * The canonical structural body of a proposal — everything the actor
 * authors: identity fields, incidence, the family parameter tuple,
 * public protocol references, and asserted causal parents. Payload
 * bytes and the dependency list are the two removable projections and
 * ride beside the body, never inside it.
 */
data class StructuralBody(
    /** The author's L0 address atom. */
    val author: String,
    /** The author-local sequence value s_q. */
    val seq: ULong,
    val family: Family,
    /** Middle node for hyper-edge families; null for binary. */
    val middle: NodeId?,
    /** Semantic target: the binary target, or the hyper T-leg terminal. */
    val target: NodeId,
    /** The act's family parameter tuple. */
    val pD: Double,
    val pI: Double,
    val settlementRef: ActId?,
    val license: String?,
    /** Asserted causal parents. */
    val assertedParents: List<ActId>,
) {
    fun actId(): ActId = ActId(author, seq, family)

    /**
     * Canonical bytes: byte-identical to the Rust reference — the
     * golden vectors pin the layout.
     */
    fun canonicalBytes(): ByteArray {
        val e = CborEncoder()
        e.array(9u)
        e.text(actId().toString())
        if (middle != null) e.text(middle.toString()) else e.nul()
        e.text(target.toString())
        e.float(pD)
        e.float(pI)
        if (settlementRef != null) e.text(settlementRef.toString()) else e.nul()
        if (license != null) e.text(license) else e.nul()
        e.array(assertedParents.size.toULong())
        for (p in assertedParents) e.text(p.toString())
        // Trailing schema version for forward evolution of the body shape.
        e.uint(1u)
        return e.finish()
    }
}

/** Canonical encoding of the dependency list — the dependency projection's bytes. */
fun canonicalDeps(deps: List<ActId>): ByteArray {
    val e = CborEncoder()
    e.array(deps.size.toULong())
    for (d in deps) e.text(d.toString())
    return e.finish()
}

/**
 * A proposal before signing: body plus the two removable projections.
 * Equality is by content — [payload] compares byte-for-byte — because
 * the approve step checks the host returned exactly what was sent.
 */
class Proposal(
    val body: StructuralBody,
    /** Payload bytes — canonical empty is the zero-length string. */
    val payload: ByteArray,
    /** Declared dependencies (each naming a whole act). */
    val deps: List<ActId>,
) {
    override fun equals(other: Any?): Boolean =
        other is Proposal &&
            body == other.body &&
            payload.contentEquals(other.payload) &&
            deps == other.deps

    override fun hashCode(): Int = 31 * (31 * body.hashCode() + payload.contentHashCode()) + deps.hashCode()
}

/**
 * The actor's signed pre-commitment over the canonical structural body
 * plus both pre-digests.
 */
class PreSignedProposal(
    val proposal: Proposal,
    /** The actor's public key (32 bytes, Ed25519 interim realization). */
    val authorPubkey: ByteArray,
    /** The private nonce under the pre-digests. */
    val nonce: ByteArray,
    val preSignature: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        other is PreSignedProposal &&
            proposal == other.proposal &&
            authorPubkey.contentEquals(other.authorPubkey) &&
            nonce.contentEquals(other.nonce) &&
            preSignature.contentEquals(other.preSignature)

    override fun hashCode(): Int {
        var result = proposal.hashCode()
        result = 31 * result + authorPubkey.contentHashCode()
        result = 31 * result + nonce.contentHashCode()
        result = 31 * result + preSignature.contentHashCode()
        return result
    }
}

/** The message the pre-commitment signature covers. */
fun preCommitmentMsg(
    body: StructuralBody,
    digestContent: ByteArray,
    digestDeps: ByteArray,
): ByteArray {
    val e = CborEncoder()
    e.array(3u)
    e.bytes(body.canonicalBytes())
    e.bytes(digestContent)
    e.bytes(digestDeps)
    return e.finish()
}

/**
 * The host-sealed verified act: the exact proposal plus host salts and
 * the binding commitments, sealed by the host signature. No host order
 * fields.
 */
class VerifiedAct(
    val proposal: Proposal,
    val authorPubkey: ByteArray,
    val nonce: ByteArray,
    val preSignature: ByteArray,
    val contentSalt: ByteArray,
    val depsSalt: ByteArray,
    val contentCommitment: ByteArray,
    val depsCommitment: ByteArray,
    val hostSeal: ByteArray,
) {
    /**
     * The message the host seal and the approval witness cover: the
     * exact verified act including the host-added commitments — the
     * witness signs no epoch index, position, or logical time.
     */
    fun sealMsg(): ByteArray {
        val e = CborEncoder()
        e.array(5u)
        e.bytes(proposal.body.canonicalBytes())
        e.bytes(preSignature)
        e.bytes(contentCommitment)
        e.bytes(depsCommitment)
        e.uint(1u)
        return e.finish()
    }

    /**
     * Content equality, like every Rust counterpart derives. A
     * round-trip is then one assertion rather than nine spelled out by
     * hand — and a decoder that swapped two same-length salts fails it,
     * which a nine-field list only catches if every field is listed.
     */
    override fun equals(other: Any?): Boolean =
        other is VerifiedAct &&
            proposal == other.proposal &&
            authorPubkey.contentEquals(other.authorPubkey) &&
            nonce.contentEquals(other.nonce) &&
            preSignature.contentEquals(other.preSignature) &&
            contentSalt.contentEquals(other.contentSalt) &&
            depsSalt.contentEquals(other.depsSalt) &&
            contentCommitment.contentEquals(other.contentCommitment) &&
            depsCommitment.contentEquals(other.depsCommitment) &&
            hostSeal.contentEquals(other.hostSeal)

    override fun hashCode(): Int {
        var result = proposal.hashCode()
        result = 31 * result + authorPubkey.contentHashCode()
        result = 31 * result + nonce.contentHashCode()
        result = 31 * result + preSignature.contentHashCode()
        result = 31 * result + contentSalt.contentHashCode()
        result = 31 * result + depsSalt.contentHashCode()
        result = 31 * result + contentCommitment.contentHashCode()
        result = 31 * result + depsCommitment.contentHashCode()
        result = 31 * result + hostSeal.contentHashCode()
        return result
    }
}

/**
 * The client's approval: the act identifier plus the approval-witness
 * signature over the exact verified act.
 */
class ApprovalWitness(
    val actId: ActId,
    val approvalSignature: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        other is ApprovalWitness &&
            actId == other.actId &&
            approvalSignature.contentEquals(other.approvalSignature)

    override fun hashCode(): Int = 31 * actId.hashCode() + approvalSignature.contentHashCode()
}
