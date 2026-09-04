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

/**
 * A minimal in-test host: verifies nothing (host checks are the
 * backend's job), just salts, commits, and seals — enough to exercise
 * the client-side verification branches.
 */
private fun seal(pre: PreSignedProposal, host: ActorKey): VerifiedAct {
    val contentSalt = ByteArray(SALT_LEN) { 1 }
    val depsSalt = ByteArray(SALT_LEN) { 2 }
    val unsealed = VerifiedAct(
        proposal = pre.proposal,
        authorPubkey = pre.authorPubkey,
        nonce = pre.nonce,
        preSignature = pre.preSignature,
        contentSalt = contentSalt,
        depsSalt = depsSalt,
        contentCommitment = commitment(Tags.COMMIT_CONTENT, contentSalt, pre.proposal.payload),
        depsCommitment = commitment(Tags.COMMIT_DEPS, depsSalt, canonicalDeps(pre.proposal.deps)),
        hostSeal = ByteArray(0),
    )
    return VerifiedAct(
        proposal = unsealed.proposal,
        authorPubkey = unsealed.authorPubkey,
        nonce = unsealed.nonce,
        preSignature = unsealed.preSignature,
        contentSalt = unsealed.contentSalt,
        depsSalt = unsealed.depsSalt,
        contentCommitment = unsealed.contentCommitment,
        depsCommitment = unsealed.depsCommitment,
        hostSeal = host.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()),
    )
}

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
            verify(actor.publicKeyBytes(), Tags.APPROVAL, sealed.sealMsg(), witness.approvalSignature)
        ).isTrue()
    }

    @Test
    fun approveRejectsAlteredBody() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val altered = pre.proposal.body.copy(pD = -1.0)
        val sealed = seal(pre, host)
        val tampered = VerifiedAct(
            proposal = Proposal(altered, pre.proposal.payload, pre.proposal.deps),
            authorPubkey = sealed.authorPubkey,
            nonce = sealed.nonce,
            preSignature = sealed.preSignature,
            contentSalt = sealed.contentSalt,
            depsSalt = sealed.depsSalt,
            contentCommitment = sealed.contentCommitment,
            depsCommitment = sealed.depsCommitment,
            hostSeal = sealed.hostSeal,
        )
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, tampered, host.publicKeyBytes())
        }
    }

    @Test
    fun approveRejectsForeignNonceEcho() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        val foreign = VerifiedAct(
            proposal = sealed.proposal,
            authorPubkey = sealed.authorPubkey,
            nonce = ByteArray(SALT_LEN) { 9 },
            preSignature = sealed.preSignature,
            contentSalt = sealed.contentSalt,
            depsSalt = sealed.depsSalt,
            contentCommitment = sealed.contentCommitment,
            depsCommitment = sealed.depsCommitment,
            hostSeal = sealed.hostSeal,
        )
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
        // Host swaps a salt after sealing: the opening no longer matches.
        val swapped = VerifiedAct(
            proposal = sealed.proposal,
            authorPubkey = sealed.authorPubkey,
            nonce = sealed.nonce,
            preSignature = sealed.preSignature,
            contentSalt = ByteArray(SALT_LEN) { 9 },
            depsSalt = sealed.depsSalt,
            contentCommitment = sealed.contentCommitment,
            depsCommitment = sealed.depsCommitment,
            hostSeal = host.signTagged(
                Tags.HOST_SEAL,
                sealed.sealMsg(),
            ),
        )
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, swapped, host.publicKeyBytes())
        }
    }

    @Test
    fun approveRejectsWrongDepsOpening() {
        val actor = ActorKey.generate()
        val host = ActorKey.generate()
        val pre = actor.preSign(proposal(actor.address()))
        val sealed = seal(pre, host)
        val swapped = VerifiedAct(
            proposal = sealed.proposal,
            authorPubkey = sealed.authorPubkey,
            nonce = sealed.nonce,
            preSignature = sealed.preSignature,
            contentSalt = sealed.contentSalt,
            depsSalt = ByteArray(SALT_LEN) { 9 },
            contentCommitment = sealed.contentCommitment,
            depsCommitment = sealed.depsCommitment,
            hostSeal = sealed.hostSeal,
        )
        assertThrows(HandshakeException::class.java) {
            actor.approve(pre, swapped, host.publicKeyBytes())
        }
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
            a.copy(assertedParents = listOf(ActId.parse("act:alice:1:opinion"))).canonicalBytes()
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
