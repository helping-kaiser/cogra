// The client-side signing steps and their refusal branches (mirrors
// crates/common/src/l1/client.rs tests): the device never signs what it
// cannot verify.

package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

private fun proposal(author: String) = Proposal(
    body = StructuralBody(
        author = author,
        seq = 1u,
        family = Family.OPINION,
        middle = null,
        target = NodeId.parse("prof:bob"),
        pD = 1.0,
        pI = 1.0,
        settlementRef = null,
        license = null,
        assertedParents = emptyList(),
    ),
    payload = "hello".toByteArray(),
    deps = emptyList(),
)

/** One verified act with some fields replaced — the tests' stand-in for a data-class copy. */
private fun VerifiedAct.with(
    proposal: Proposal = this.proposal,
    nonce: ByteArray = this.nonce,
    preCommitment: ByteArray = this.preCommitment,
    contentSalt: ByteArray = this.contentSalt,
    depsSalt: ByteArray = this.depsSalt,
    contentCommitment: ByteArray = this.contentCommitment,
    depsCommitment: ByteArray = this.depsCommitment,
    edition: ULong = this.contentEdition,
    hostSeal: ByteArray = this.hostSeal,
) = VerifiedAct(
    proposal = proposal,
    authorPubkey = authorPubkey,
    nonce = nonce,
    preSignature = preSignature,
    preCommitment = preCommitment,
    contentSalt = contentSalt,
    depsSalt = depsSalt,
    contentCommitment = contentCommitment,
    depsCommitment = depsCommitment,
    contentEdition = edition,
    depsEdition = edition,
    hostSeal = hostSeal,
)

/**
 * A minimal in-test host: verifies nothing (host checks are the
 * backend's job), just salts, commits, and seals — every part consistent
 * with the pre-commitment and edition it seals under, so a refusal comes
 * from the one device check a test aims at.
 */
private fun seal(
    pre: PreSignedProposal,
    host: ActorKey,
    preCommitment: ByteArray = pre.preCommitment(),
    edition: ULong = EDITION,
): VerifiedAct {
    val actId = pre.proposal.body.actId()
    val contentSalt = ByteArray(SALT_LEN) { 1 }
    val depsSalt = ByteArray(SALT_LEN) { 2 }
    val unsealed = VerifiedAct(
        proposal = pre.proposal,
        authorPubkey = pre.authorPubkey,
        nonce = pre.nonce,
        preSignature = pre.preSignature,
        preCommitment = preCommitment,
        contentSalt = contentSalt,
        depsSalt = depsSalt,
        contentCommitment = contentCommitment(actId, preCommitment, contentSalt, pre.proposal.payload),
        depsCommitment = depsCommitment(actId, preCommitment, depsSalt, pre.proposal.deps),
        contentEdition = edition,
        depsEdition = edition,
        hostSeal = ByteArray(0),
    )
    return unsealed.with(hostSeal = host.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()))
}

private val ACT = "act:alice:1:publish".toByteArray()
private val OTHER_ACT = "act:alice:2:publish".toByteArray()
private val PRE = ByteArray(32) { 3 }

class HandshakeTest {

    @Test
    fun approveHappyPath() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        val witness = actor.approve(pre, sealed, host.publicKeyBytes())
        assertThat(witness.actId).isEqualTo(pre.proposal.body.actId())
        assertThat(
            verifyDigest(actor.publicKeyBytes(), sealed.approvalDigest(), witness.approvalSignature),
        ).isTrue()
    }

    @Test
    fun approveRejectsAlteredBody() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val altered = pre.proposal.body.copy(pD = -1.0)
        val sealed = seal(pre, host)
        val tampered = sealed.with(proposal = Proposal(altered, pre.proposal.payload, pre.proposal.deps))
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, tampered, host.publicKeyBytes())
        }
    }

    @Test
    fun approveRejectsForeignNonceEcho() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val foreign = seal(pre, host).with(nonce = ByteArray(SALT_LEN) { 9 })
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, foreign, host.publicKeyBytes())
        }
    }

    @Test
    fun approveRejectsBadSeal() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val impostor = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, impostor)
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, sealed, host.publicKeyBytes())
        }
    }

    @Test
    fun approveRejectsMalformedHostKey() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, sealed, byteArrayOf(1, 2, 3))
        }
    }

    @Test
    fun approveRejectsWrongCommitmentOpening() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        // Host swaps a salt after committing and re-seals: the opening no longer matches.
        val swapped = sealed.with(contentSalt = ByteArray(SALT_LEN) { 9 })
        val resealed = swapped.with(hostSeal = host.signTagged(Tags.HOST_SEAL, swapped.sealMsg()))
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, resealed, host.publicKeyBytes())
        }
    }

    @Test
    fun approveRejectsWrongDepsOpening() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val swapped = seal(pre, host).with(depsSalt = ByteArray(SALT_LEN) { 9 })
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, swapped, host.publicKeyBytes())
        }
    }

    @Test
    fun thePreSignatureVerifiesOverTheNamedPreCommitment() {
        val actor = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        assertThat(verifyDigest(actor.publicKeyBytes(), pre.preCommitment(), pre.preSignature)).isTrue()
        val other = Proposal(pre.proposal.body, "another payload".toByteArray(), pre.proposal.deps)
        assertThat(
            verifyDigest(actor.publicKeyBytes(), preCommitment(other, pre.nonce), pre.preSignature),
        ).isFalse()
    }

    @Test
    fun aVerifiedActWhosePreCommitmentDiffersFromTheDevicesIsRefusedBeforeApproval() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host, preCommitment = ByteArray(32) { 5 })
        val e = assertThrows(HandshakeException::class.java) {
            actor.approve(pre, sealed, host.publicKeyBytes())
        }
        assertThat(e).hasMessageThat().isEqualTo("host returned a different pre-commitment than was formed")
    }

    @Test
    fun aVerifiedActWithAnUnexpectedEditionIsRefusedBeforeApproval() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host, edition = EDITION + 1u)
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, sealed, host.publicKeyBytes())
        }
    }

    @Test
    fun theApprovalWitnessSignsTheVerifiedActAndItsHostSealTogether() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        val witness = actor.approve(pre, sealed, host.publicKeyBytes())
        val digest = sha256Tagged(Tags.APPROVAL, listOf(sealed.sealMsg(), sealed.hostSeal))
        assertThat(verifyDigest(actor.publicKeyBytes(), digest, witness.approvalSignature)).isTrue()
        val otherSeal = sha256Tagged(Tags.APPROVAL, listOf(sealed.sealMsg(), ByteArray(64)))
        assertThat(verifyDigest(actor.publicKeyBytes(), otherSeal, witness.approvalSignature)).isFalse()
    }

    @Test
    fun anApprovalOverTheVerifiedActWithoutItsSealDoesNotVerify() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        val unsealed = actor.signTagged(Tags.APPROVAL, sealed.sealMsg())
        assertThat(verifyDigest(actor.publicKeyBytes(), sealed.approvalDigest(), unsealed)).isFalse()
    }

    @Test
    fun aContentCommitmentBindsTheActIdAndThePreCommitment() {
        val salt = ByteArray(SALT_LEN) { 7 }
        val bytes = "payload".toByteArray()
        val base = commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes)
        assertThat(commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes)).isEqualTo(base)
        // The same payload and salt under another act id commit differently …
        assertThat(commitment(Tags.COMMIT_CONTENT, OTHER_ACT, PRE, salt, bytes)).isNotEqualTo(base)
        // … and under another pre-commitment.
        assertThat(commitment(Tags.COMMIT_CONTENT, ACT, ByteArray(32) { 4 }, salt, bytes)).isNotEqualTo(base)
        assertThat(commitment(Tags.COMMIT_CONTENT, ACT, PRE, ByteArray(SALT_LEN) { 8 }, bytes)).isNotEqualTo(base)
        assertThat(commitment(Tags.COMMIT_DEPS, ACT, PRE, salt, bytes)).isNotEqualTo(base)
    }

    @Test
    fun aDependencyCommitmentBindsTheActIdAndThePreCommitment() {
        val salt = ByteArray(SALT_LEN) { 7 }
        val deps = byteArrayOf(0x80.toByte())
        val base = commitment(Tags.COMMIT_DEPS, ACT, PRE, salt, deps)
        assertThat(commitment(Tags.COMMIT_DEPS, OTHER_ACT, PRE, salt, deps)).isNotEqualTo(base)
        assertThat(commitment(Tags.COMMIT_DEPS, ACT, ByteArray(32) { 4 }, salt, deps)).isNotEqualTo(base)
    }

    @Test
    fun aPreDigestBindsTheActIdItWasFormedFor() {
        val nonce = ByteArray(SALT_LEN) { 9 }
        val bytes = "payload".toByteArray()
        val base = preDigest(Tags.PRE_DIGEST_CONTENT, ACT, nonce, bytes)
        assertThat(preDigest(Tags.PRE_DIGEST_CONTENT, ACT, nonce, bytes)).isEqualTo(base)
        assertThat(preDigest(Tags.PRE_DIGEST_CONTENT, OTHER_ACT, nonce, bytes)).isNotEqualTo(base)
        assertThat(preDigest(Tags.PRE_DIGEST_DEPS, ACT, nonce, bytes)).isNotEqualTo(base)
    }

    @Test
    fun aV1CommitmentNeverVerifiesUnderTheV2Formula() {
        val salt = ByteArray(SALT_LEN) { 7 }
        val bytes = "payload".toByteArray()
        val v1 = sha256Tagged("cogra-l1:commitment:content:v1", listOf(salt, bytes))
        assertThat(commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes)).isNotEqualTo(v1)
        assertThat(sha256Tagged(Tags.COMMIT_CONTENT, listOf(salt, bytes))).isNotEqualTo(v1)
    }

    @Test
    fun preSignBindsTheNonce() {
        val actor = ActorKey.generate()
        val p = proposal(actor.address())
        val nonce = ByteArray(SALT_LEN) { 5 }
        val a = actor.preSignWith(p, nonce)
        val b = actor.preSignWith(p, nonce)
        // Same nonce → identical signature (Ed25519 is deterministic);
        // fresh nonces → distinct pre-digests, distinct signatures.
        assertThat(a.preSignature).isEqualTo(b.preSignature)
        assertThat(actor.preSign(p).preSignature).isNotEqualTo(a.preSignature)
    }

    @Test
    fun preSignRejectsWrongNonceLength() {
        val actor = ActorKey.generate()
        assertThrows(IllegalArgumentException::class.java) {
            actor.preSignWith(proposal(actor.address()), ByteArray(16))
        }
    }

    @Test
    fun canonicalBytesAreStableAndFieldSensitive() {
        val a = proposal("alice").body
        assertThat(a.canonicalBytes()).isEqualTo(proposal("alice").body.canonicalBytes())
        assertThat(a.copy(pI = 0.6).canonicalBytes()).isNotEqualTo(a.canonicalBytes())
        assertThat(
            a.copy(assertedParents = listOf(ActId.parse("act:alice:1:opinion"))).canonicalBytes(),
        ).isNotEqualTo(a.canonicalBytes())
    }

    @Test
    fun depsEncodingIsOrderSensitive() {
        val d1 = ActId.parse("act:a:1:opinion")
        val d2 = ActId.parse("act:a:2:opinion")
        assertThat(canonicalDeps(listOf(d1, d2))).isNotEqualTo(canonicalDeps(listOf(d2, d1)))
        assertThat(canonicalDeps(emptyList())).isEqualTo(byteArrayOf(0x80.toByte()))
    }

    @Test
    fun keyDerivationIsStable() {
        val seed = ByteArray(32) { 42 }
        val key = ActorKey.fromSeed(seed)
        assertThat(key.seed()).isEqualTo(seed)
        assertThat(key.address()).hasLength(40)
        assertThat(key.address()).isEqualTo(ActorKey.fromSeed(seed).address())
        assertThrows(IllegalArgumentException::class.java) { ActorKey.fromSeed(ByteArray(16)) }
    }

    @Test
    fun signaturesAreDomainSeparated() {
        val key = ActorKey.generate()
        val msg = "structural body".toByteArray()
        val sig = key.signTagged(Tags.PRE_COMMITMENT, msg)
        assertThat(verify(key.publicKeyBytes(), Tags.PRE_COMMITMENT, msg, sig)).isTrue()
        assertThat(verify(key.publicKeyBytes(), Tags.APPROVAL, msg, sig)).isFalse()
        assertThat(verify(key.publicKeyBytes(), Tags.PRE_COMMITMENT, "tampered".toByteArray(), sig)).isFalse()
        assertThat(verify(key.publicKeyBytes(), Tags.PRE_COMMITMENT, msg, byteArrayOf(1))).isFalse()
        assertThat(verify(byteArrayOf(1), Tags.PRE_COMMITMENT, msg, sig)).isFalse()
    }

    @Test
    fun lengthFramingPreventsConcatenationAmbiguity() {
        assertThat(sha256Tagged("t", listOf("ab".toByteArray(), "c".toByteArray())))
            .isNotEqualTo(sha256Tagged("t", listOf("a".toByteArray(), "bc".toByteArray())))
    }
}
