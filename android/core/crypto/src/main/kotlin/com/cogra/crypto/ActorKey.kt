// The device side of the admission handshake (reference:
// crates/common/src/l1/proposal/device.rs; substrate.md §6 — client-signed,
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

    /** The actor's address atom (stand-in convention). */
    fun address(): String = addressOf(publicKeyBytes())

    /**
     * Step 2 of the write — pre-sign: draw the content nonce and the
     * dependency nonce as two independent [SALT_LEN]-byte draws from the
     * platform CSPRNG, form P, and sign it.
     *
     * This is the production form, and the only one outside this
     * module: the nonces are drawn here rather than accepted, so no call
     * site can supply a constant. The deterministic form the golden
     * vectors pin is [preSignWith], mirroring the Rust reference's own
     * split (`crates/common/src/l1/proposal/device.rs`).
     */
    fun preSign(proposal: Proposal): PreSignedProposal =
        preSignWith(proposal, Entropy.bytes(SALT_LEN), Entropy.bytes(SALT_LEN))

    /**
     * The deterministic form the golden vectors pin. The lengths and the
     * distinctness are the ones the API refuses a submission over, so a
     * pair it would refuse is never signed.
     */
    internal fun preSignWith(
        proposal: Proposal,
        contentNonce: ByteArray,
        dependencyNonce: ByteArray,
    ): PreSignedProposal {
        require(contentNonce.size == SALT_LEN) { "the content nonce must be $SALT_LEN bytes" }
        require(dependencyNonce.size == SALT_LEN) { "the dependency nonce must be $SALT_LEN bytes" }
        require(!contentNonce.contentEquals(dependencyNonce)) { "the two nonces must differ" }
        val actId = proposal.body.actId()
        val formed = preCommitment(
            proposal.body,
            contentPreDigest(actId, contentNonce, proposal.payload),
            dependencyPreDigest(actId, dependencyNonce, proposal.deps),
        )
        return PreSignedProposal(
            proposal = proposal,
            authorPubkey = publicKeyBytes(),
            contentNonce = contentNonce,
            dependencyNonce = dependencyNonce,
            preSignature = signDigest(key, formed),
        )
    }

    /**
     * Step 4 of the write — approve: the actor's checks, then the witness
     * over the encoded verified act and its seal. [sent] is what this
     * device pre-signed; every check recomputes from material it holds
     * itself, never from anything the host could have chosen:
     *
     * 0. [sent] is this key's own: its body's author is [address], and its
     *    pre-signature verifies under this key over the P it recomputes to;
     * 1. the returned body's canonical bytes and the pre-signature equal
     *    what was pre-signed;
     * 2. the returned P equals the P this device forms from its own
     *    proposal and both nonces;
     * 3. the editions are [CONTENT_EDITION] and [DEPENDENCY_EDITION];
     * 4. the host seal verifies strictly under [hostPubkey];
     * 5. C_c recomputes over this device's own content pre-digest (its
     *    payload and content nonce) with the returned content salt — a
     *    commitment the host formed over anything else, the payload bytes
     *    included, does not recompute;
     * 6. C_d recomputes over this device's own canonical dependency list
     *    with the returned dependency salt.
     *
     * The hyper-edge legs are census renderings of the one body, so body
     * equality is their agreement.
     */
    fun approve(sent: PreSignedProposal, sealed: SealedAct, hostPubkey: ByteArray): ApprovalWitness {
        val act = sealed.act
        // Material reloaded from storage is proven this key's, not trusted
        // (the reference's `PreSigned::recover`).
        if (sent.proposal.body.author != address()) {
            throw HandshakeException("the held proposal is not this actor's")
        }
        val formed = sent.preCommitment()
        if (!verifyDigest(publicKeyBytes(), formed, sent.preSignature)) {
            throw HandshakeException("the held pre-signature is not this key's over the pre-commitment")
        }
        // By the signed bytes, not by field equality: float equality calls
        // two bodies equal whose canonical bytes differ — 0.0 and -0.0
        // under IEEE 754, NaNs of other bits under Double.equals — and the
        // seal and the approval cover the bytes.
        if (!act.body.canonicalBytes().contentEquals(sent.proposal.body.canonicalBytes()) ||
            !act.preSignature.contentEquals(sent.preSignature)
        ) {
            throw HandshakeException("host returned a different act than was pre-signed")
        }
        if (!act.preCommitment.contentEquals(formed)) {
            throw HandshakeException("host returned a different pre-commitment than was formed")
        }
        if (act.contentEdition != CONTENT_EDITION || act.dependencyEdition != DEPENDENCY_EDITION) {
            throw HandshakeException(
                "unexpected editions (content ${act.contentEdition}, dependencies ${act.dependencyEdition}); " +
                    "this device signs content edition $CONTENT_EDITION and dependency edition $DEPENDENCY_EDITION",
            )
        }
        if (!sealed.verifySeal(hostPubkey)) {
            throw HandshakeException("invalid host seal")
        }
        val actId = sent.actId()
        val content = contentCommitment(actId, formed, sealed.contentSalt, sent.contentPreDigest())
        if (!content.contentEquals(act.contentCommitment)) {
            throw HandshakeException("content commitment is not formed over this device's content pre-digest")
        }
        val deps = dependencyCommitment(actId, formed, sealed.dependencySalt, sent.proposal.deps)
        if (!deps.contentEquals(act.dependencyCommitment)) {
            throw HandshakeException("dependency commitment does not open over the dependency list")
        }
        return ApprovalWitness(
            actId = actId,
            approvalSignature = signDigest(key, sealed.approvalDigest()),
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
