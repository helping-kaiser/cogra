// The admission-handshake objects the device signs (reference:
// crates/common/src/l1/proposal/ over crates/common/src/l1/handshake.rs).
// The structural body's canonical bytes are the signing base of the
// pre-commitment and, with the host additions, of the seal and approval.
// The actor binds its proposal under two independently drawn nonces —
// one per removable projection — so a holder of the dependency opening
// holds nothing that tests a guess at the payload.

package com.cogra.crypto

/**
 * The canonical structural body of a proposal — everything the actor
 * authors: identity fields, incidence, the family parameter tuple,
 * public protocol references, and asserted causal parents. Payload
 * bytes and the dependency list are the two removable projections and
 * ride beside the body, never inside it.
 */
data class StructuralBody(
    /** The author's address atom. */
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
 * Equality is by content — [payload] compares byte-for-byte.
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

/** Length of a pre-digest, a pre-commitment and a commitment: one SHA-256 output. */
const val DIGEST_LEN = 32

/**
 * The content pre-digest h_c, typed apart from raw bytes so a payload
 * can never be passed where the content commitment takes the digest —
 * the one substitution a host forming C_c over the payload would hope
 * the device repeats.
 */
@JvmInline
value class ContentPreDigest(val bytes: ByteArray) {
    init {
        require(bytes.size == DIGEST_LEN) { "a content pre-digest is $DIGEST_LEN bytes" }
    }
}

/** The act identifier's bytes as every pre-digest and commitment binds them. */
private fun ActId.bound(): ByteArray = toString().toByteArray(Charsets.UTF_8)

/**
 * The content pre-digest h_c over the act identifier, the content nonce
 * and the payload. Without the content nonce it confirms no payload guess.
 */
fun contentPreDigest(actId: ActId, contentNonce: ByteArray, payload: ByteArray): ContentPreDigest =
    ContentPreDigest(preDigest(Tags.PRE_DIGEST_CONTENT, actId.bound(), contentNonce, payload))

/**
 * The dependency pre-digest h_d over the act identifier, the dependency
 * nonce and the canonical dependency encoding.
 */
fun dependencyPreDigest(actId: ActId, dependencyNonce: ByteArray, deps: List<ActId>): ByteArray =
    preDigest(Tags.PRE_DIGEST_DEPS, actId.bound(), dependencyNonce, canonicalDeps(deps))

/** The message the pre-commitment hashes: the canonical body and both pre-digests. */
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
 * The proposal pre-commitment P over the canonical body and both
 * pre-digests. The pre-signature signs exactly these 32 bytes, and both
 * commitments bind them.
 */
fun preCommitment(body: StructuralBody, contentPreDigest: ContentPreDigest, dependencyPreDigest: ByteArray): ByteArray =
    sha256Tagged(Tags.PRE_COMMITMENT, listOf(preCommitmentMsg(body, contentPreDigest.bytes, dependencyPreDigest)))

/**
 * The content commitment C_c over the act identifier, P, the host's
 * content salt and the content pre-digest — never over the payload: the
 * commitment binds the payload through h_c and inherits its concealment.
 */
fun contentCommitment(
    actId: ActId,
    preCommitment: ByteArray,
    salt: ByteArray,
    contentPreDigest: ContentPreDigest,
): ByteArray = commitment(Tags.COMMIT_CONTENT, actId.bound(), preCommitment, salt, contentPreDigest.bytes)

/** The dependency commitment C_d over the canonical dependency list — it needs no nonce to open. */
fun dependencyCommitment(actId: ActId, preCommitment: ByteArray, salt: ByteArray, deps: List<ActId>): ByteArray =
    commitment(Tags.COMMIT_DEPS, actId.bound(), preCommitment, salt, canonicalDeps(deps))

/**
 * The content edition a verified act is sealed under: the content
 * commitment is formed over the content pre-digest. The device refuses
 * any other.
 */
const val CONTENT_EDITION: ULong = 2u

/** The dependency edition a verified act is sealed under. The device refuses any other. */
const val DEPENDENCY_EDITION: ULong = 1u

/**
 * The actor's pre-signed proposal: the proposal it signed, both nonces
 * it drew, and its signature over P. Both nonces go to CoGra's API on
 * the submit leg, which keeps the content nonce and passes the host only
 * the dependency nonce; nothing returns either, so the device keeps its own.
 */
class PreSignedProposal(
    val proposal: Proposal,
    /** The actor's public key (32 bytes, Ed25519 interim realization). */
    val authorPubkey: ByteArray,
    /** The content nonce n_c under the content pre-digest. */
    val contentNonce: ByteArray,
    /** The dependency nonce n_d under the dependency pre-digest. */
    val dependencyNonce: ByteArray,
    val preSignature: ByteArray,
) {
    fun actId(): ActId = proposal.body.actId()

    fun contentPreDigest(): ContentPreDigest = contentPreDigest(actId(), contentNonce, proposal.payload)

    fun dependencyPreDigest(): ByteArray = dependencyPreDigest(actId(), dependencyNonce, proposal.deps)

    /** P, recomputed from the proposal and both nonces. */
    fun preCommitment(): ByteArray = preCommitment(proposal.body, contentPreDigest(), dependencyPreDigest())

    override fun equals(other: Any?): Boolean =
        other is PreSignedProposal &&
            proposal == other.proposal &&
            authorPubkey.contentEquals(other.authorPubkey) &&
            contentNonce.contentEquals(other.contentNonce) &&
            dependencyNonce.contentEquals(other.dependencyNonce) &&
            preSignature.contentEquals(other.preSignature)

    override fun hashCode(): Int {
        var result = proposal.hashCode()
        result = 31 * result + authorPubkey.contentHashCode()
        result = 31 * result + contentNonce.contentHashCode()
        result = 31 * result + dependencyNonce.contentHashCode()
        result = 31 * result + preSignature.contentHashCode()
        return result
    }
}

/**
 * Items in the encoded verified act: body, pre-commitment, pre-signature,
 * both commitments, both editions, and the frame's schema version.
 */
private const val VERIFIED_ACT_FRAME_ITEMS = 8UL

/**
 * The verified act: the header the host seals — body, P, pre-signature,
 * both commitments and both edition tags. No payload, no nonce, no host
 * order field.
 */
class VerifiedAct(
    val body: StructuralBody,
    val preCommitment: ByteArray,
    val preSignature: ByteArray,
    val contentCommitment: ByteArray,
    val dependencyCommitment: ByteArray,
    val contentEdition: ULong,
    val dependencyEdition: ULong,
) {
    fun actId(): ActId = body.actId()

    /**
     * The encoded verified act — the message the host seal covers, and
     * with the seal the message the approval witness covers.
     */
    fun sealMsg(): ByteArray {
        val e = CborEncoder()
        e.array(VERIFIED_ACT_FRAME_ITEMS)
        e.bytes(body.canonicalBytes())
        e.bytes(preCommitment)
        e.bytes(preSignature)
        e.bytes(contentCommitment)
        e.bytes(dependencyCommitment)
        e.uint(contentEdition)
        e.uint(dependencyEdition)
        // Trailing schema version for forward evolution of the frame shape.
        e.uint(1u)
        return e.finish()
    }

    override fun equals(other: Any?): Boolean =
        other is VerifiedAct &&
            body == other.body &&
            preCommitment.contentEquals(other.preCommitment) &&
            preSignature.contentEquals(other.preSignature) &&
            contentCommitment.contentEquals(other.contentCommitment) &&
            dependencyCommitment.contentEquals(other.dependencyCommitment) &&
            contentEdition == other.contentEdition &&
            dependencyEdition == other.dependencyEdition

    override fun hashCode(): Int {
        var result = body.hashCode()
        result = 31 * result + preCommitment.contentHashCode()
        result = 31 * result + preSignature.contentHashCode()
        result = 31 * result + contentCommitment.contentHashCode()
        result = 31 * result + dependencyCommitment.contentHashCode()
        result = 31 * result + contentEdition.hashCode()
        result = 31 * result + dependencyEdition.hashCode()
        return result
    }
}

/**
 * What the host returns: the verified act, both salts and the host seal
 * over the encoded verified act.
 */
class SealedAct(
    val act: VerifiedAct,
    val contentSalt: ByteArray,
    val dependencySalt: ByteArray,
    val hostSeal: ByteArray,
) {
    /** Whether the host seal verifies, strictly, under [hostPubkey]. */
    fun verifySeal(hostPubkey: ByteArray): Boolean = verify(hostPubkey, Tags.HOST_SEAL, act.sealMsg(), hostSeal)

    /**
     * The digest the author's approval witness signs: the encoded
     * verified act and its host seal, together.
     */
    fun approvalDigest(): ByteArray = sha256Tagged(Tags.APPROVAL, listOf(act.sealMsg(), hostSeal))

    /**
     * Content equality, like every Rust counterpart derives: a decoder
     * that swapped the two same-length salts fails one round-trip
     * assertion, where a field list only catches it if every field is listed.
     */
    override fun equals(other: Any?): Boolean =
        other is SealedAct &&
            act == other.act &&
            contentSalt.contentEquals(other.contentSalt) &&
            dependencySalt.contentEquals(other.dependencySalt) &&
            hostSeal.contentEquals(other.hostSeal)

    override fun hashCode(): Int {
        var result = act.hashCode()
        result = 31 * result + contentSalt.contentHashCode()
        result = 31 * result + dependencySalt.contentHashCode()
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
