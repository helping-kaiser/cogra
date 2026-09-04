// The device side of the admission handshake (reference:
// crates/common/src/l1/client.rs; substrate.md §6 — client-signed,
// backend-relayed). The signing side of a write is always this object;
// the backend relays, never signs.

package com.cogra.crypto

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters

/** A refused signing step — the device never signs what it cannot verify. */
class HandshakeException(message: String) : Exception(message)

/** An actor keypair under the interim realization. */
class ActorKey private constructor(private val key: Ed25519PrivateKeyParameters) {

    /** The 32-byte seed — what the key-backup blob carries. */
    fun seed(): ByteArray = key.encoded

    fun publicKeyBytes(): ByteArray = key.generatePublicKey().encoded

    /** The actor's L0 address atom (stand-in convention). */
    fun address(): String = addressOf(publicKeyBytes())

    /**
     * Step 2 of the write — pre-sign: bind the exact proposal under a
     * fresh private nonce.
     *
     * This is the production form, and the only one outside this
     * module: the nonce is drawn here rather than accepted, so no call
     * site can supply a constant. The deterministic form the golden
     * vectors pin is [preSignWith], mirroring the Rust reference's own
     * split (`crates/common/src/l1/client.rs`).
     */
    fun preSign(proposal: Proposal): PreSignedProposal = preSignWith(proposal, Entropy.bytes(SALT_LEN))

    /** The deterministic form the golden vectors pin. */
    internal fun preSignWith(proposal: Proposal, nonce: ByteArray): PreSignedProposal {
        require(nonce.size == SALT_LEN) { "nonce must be $SALT_LEN bytes" }
        val digestContent = preDigest(Tags.PRE_DIGEST_CONTENT, nonce, proposal.payload)
        val digestDeps = preDigest(Tags.PRE_DIGEST_DEPS, nonce, canonicalDeps(proposal.deps))
        val msg = preCommitmentMsg(proposal.body, digestContent, digestDeps)
        val preSignature = sign(key, Tags.PRE_COMMITMENT, msg)
        return PreSignedProposal(
            proposal = proposal,
            authorPubkey = publicKeyBytes(),
            nonce = nonce,
            preSignature = preSignature,
        )
    }

    /**
     * Step 4 of the write — approve: verify the host seal, the exact
     * returned body, and both commitment openings, then sign the
     * approval witness. [sent] is the proposal the client pre-signed;
     * the check is exact equality against what the host returned.
     */
    fun approve(sent: PreSignedProposal, sealed: VerifiedAct, hostPubkey: ByteArray): ApprovalWitness {
        if (sealed.proposal != sent.proposal ||
            !sealed.preSignature.contentEquals(sent.preSignature) ||
            !sealed.nonce.contentEquals(sent.nonce)
        ) {
            throw HandshakeException("host returned a different act than was pre-signed")
        }
        if (!verify(hostPubkey, Tags.HOST_SEAL, sealed.sealMsg(), sealed.hostSeal)) {
            throw HandshakeException("invalid host seal")
        }
        // Both commitment openings: recompute from the returned salts and
        // the bytes the client itself holds.
        val content = commitment(Tags.COMMIT_CONTENT, sealed.contentSalt, sent.proposal.payload)
        if (!content.contentEquals(sealed.contentCommitment)) {
            throw HandshakeException("content commitment does not open over the sent payload")
        }
        val deps = commitment(Tags.COMMIT_DEPS, sealed.depsSalt, canonicalDeps(sent.proposal.deps))
        if (!deps.contentEquals(sealed.depsCommitment)) {
            throw HandshakeException("dependency commitment does not open over the sent list")
        }
        val approvalSignature = sign(key, Tags.APPROVAL, sealed.sealMsg())
        return ApprovalWitness(
            actId = sent.proposal.body.actId(),
            approvalSignature = approvalSignature,
        )
    }

    /** Signs [msg] under [tag] — the raw primitive the vectors pin. */
    fun signTagged(tag: String, msg: ByteArray): ByteArray = sign(key, tag, msg)

    companion object {
        fun generate(): ActorKey = fromSeed(Entropy.bytes(32))

        fun fromSeed(seed: ByteArray): ActorKey {
            require(seed.size == 32) { "an actor seed is 32 bytes" }
            return ActorKey(Ed25519PrivateKeyParameters(seed, 0))
        }
    }
}
