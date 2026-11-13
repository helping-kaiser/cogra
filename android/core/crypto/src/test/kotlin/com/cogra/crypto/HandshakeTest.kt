// The client-side signing steps and their refusal branches (mirrors
// crates/common/src/l1/proposal/tests.rs): the device never signs what it
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
    deps = listOf(ActId.parse("act:bob:1:registration")),
)

private val CONTENT_SALT = ByteArray(SALT_LEN) { 1 }
private val DEPENDENCY_SALT = ByteArray(SALT_LEN) { 2 }

/**
 * A minimal in-test host: verifies nothing (host checks are the
 * backend's job), forms the commitments from what the host receives —
 * the content pre-digest, never the payload — and seals. Every override
 * is resealed, so the seal verifies and a refusal comes from the one
 * device check a test aims at.
 */
private fun seal(
    pre: PreSignedProposal,
    host: ActorKey,
    body: StructuralBody = pre.proposal.body,
    preCommitment: ByteArray = pre.preCommitment(),
    preSignature: ByteArray = pre.preSignature,
    contentCommitment: ByteArray =
        contentCommitment(pre.actId(), preCommitment, CONTENT_SALT, pre.contentPreDigest()),
    dependencyCommitment: ByteArray =
        dependencyCommitment(pre.actId(), preCommitment, DEPENDENCY_SALT, pre.proposal.deps),
    contentEdition: ULong = CONTENT_EDITION,
    dependencyEdition: ULong = DEPENDENCY_EDITION,
    contentSalt: ByteArray = CONTENT_SALT,
    dependencySalt: ByteArray = DEPENDENCY_SALT,
): SealedAct {
    val act = VerifiedAct(
        body = body,
        preCommitment = preCommitment,
        preSignature = preSignature,
        contentCommitment = contentCommitment,
        dependencyCommitment = dependencyCommitment,
        contentEdition = contentEdition,
        dependencyEdition = dependencyEdition,
    )
    return SealedAct(act, contentSalt, dependencySalt, host.signTagged(Tags.HOST_SEAL, act.sealMsg()))
}

private fun ByteArray.contains(needle: ByteArray): Boolean =
    (0..size - needle.size).any { start -> needle.indices.all { this[start + it] == needle[it] } }

private val ACT = "act:alice:1:publish".toByteArray()
private val OTHER_ACT = "act:alice:2:publish".toByteArray()
private val PRE = ByteArray(32) { 3 }

class HandshakeTest {

    private val actor = ActorKey.generate()
    private val host = ActorKey.generate()
    private val pre = actor.preSign(proposal(actor.address()))

    private fun refusal(sealed: SealedAct, hostKey: ByteArray = host.publicKeyBytes()): String? =
        assertThrows(HandshakeException::class.java) { actor.approve(pre, sealed, hostKey) }.message

    @Test
    fun approveHappyPath() {
        val sealed = seal(pre, host)
        val witness = actor.approve(pre, sealed, host.publicKeyBytes())
        assertThat(witness.actId).isEqualTo(pre.proposal.body.actId())
        assertThat(
            verifyDigest(actor.publicKeyBytes(), sealed.approvalDigest(), witness.approvalSignature),
        ).isTrue()
    }

    @Test
    fun approveRejectsAlteredBody() {
        val altered = pre.proposal.body.copy(pD = -1.0)
        assertThat(refusal(seal(pre, host, body = altered)))
            .isEqualTo("host returned a different act than was pre-signed")
    }

    // A body the host re-renders with -0.0 where the device signed 0.0:
    // whatever float equality says, the signed bytes differ, and the seal
    // and approval would cover the host's bytes.
    @Test
    fun approveRejectsABodyThatDiffersOnlyInTheSignOfZero() {
        val p = proposal(actor.address())
        val zero = Proposal(p.body.copy(pI = 0.0), p.payload, p.deps)
        val signed = actor.preSign(zero)
        val negativeZero = zero.body.copy(pI = -0.0)
        assertThat(negativeZero.canonicalBytes()).isNotEqualTo(zero.body.canonicalBytes())
        val e = assertThrows(HandshakeException::class.java) {
            actor.approve(signed, seal(signed, host, body = negativeZero), host.publicKeyBytes())
        }
        assertThat(e).hasMessageThat().isEqualTo("host returned a different act than was pre-signed")
    }

    @Test
    fun approveRejectsAnotherPreSignature() {
        val other = actor.preSign(proposal(actor.address()))
        assertThat(refusal(seal(pre, host, preSignature = other.preSignature)))
            .isEqualTo("host returned a different act than was pre-signed")
    }

    @Test
    fun approveRejectsBadSeal() {
        val impostor = ActorKey.generate()
        assertThat(refusal(seal(pre, impostor))).isEqualTo("invalid host seal")
    }

    @Test
    fun approveRejectsMalformedHostKey() {
        assertThat(refusal(seal(pre, host), byteArrayOf(1, 2, 3))).isEqualTo("invalid host seal")
    }

    // The case the content edition exists for: a host that commits to the
    // payload bytes rather than to the content pre-digest, and seals it
    // properly. The device's own h_c does not recompute it.
    @Test
    fun approveRefusesAContentCommitmentOverThePayload() {
        val overPayload = commitment(
            Tags.COMMIT_CONTENT,
            pre.actId().toString().toByteArray(),
            pre.preCommitment(),
            CONTENT_SALT,
            pre.proposal.payload,
        )
        assertThat(refusal(seal(pre, host, contentCommitment = overPayload)))
            .isEqualTo("content commitment is not formed over this device's content pre-digest")
    }

    // A content commitment over a pre-digest the device did not form —
    // the same payload under a content nonce the host chose.
    @Test
    fun approveRefusesAContentCommitmentUnderAnotherContentNonce() {
        val foreign = contentPreDigest(pre.actId(), ByteArray(SALT_LEN) { 9 }, pre.proposal.payload)
        val cC = contentCommitment(pre.actId(), pre.preCommitment(), CONTENT_SALT, foreign)
        assertThat(refusal(seal(pre, host, contentCommitment = cC)))
            .isEqualTo("content commitment is not formed over this device's content pre-digest")
    }

    @Test
    fun approveRejectsWrongContentOpening() {
        // The host swaps the content salt after committing and reseals.
        assertThat(refusal(seal(pre, host, contentSalt = ByteArray(SALT_LEN) { 9 })))
            .isEqualTo("content commitment is not formed over this device's content pre-digest")
    }

    @Test
    fun approveRejectsWrongDependencyOpening() {
        assertThat(refusal(seal(pre, host, dependencySalt = ByteArray(SALT_LEN) { 9 })))
            .isEqualTo("dependency commitment does not open over the dependency list")
    }

    @Test
    fun approveRejectsADependencyCommitmentOverAnotherList() {
        val cD = dependencyCommitment(pre.actId(), pre.preCommitment(), DEPENDENCY_SALT, emptyList())
        assertThat(refusal(seal(pre, host, dependencyCommitment = cD)))
            .isEqualTo("dependency commitment does not open over the dependency list")
    }

    @Test
    fun aVerifiedActWhosePreCommitmentDiffersFromTheDevicesIsRefusedBeforeApproval() {
        assertThat(refusal(seal(pre, host, preCommitment = ByteArray(32) { 5 })))
            .isEqualTo("host returned a different pre-commitment than was formed")
    }

    // P under the one shared nonce of the earlier handshake: signed by
    // this very key, so only the recomputation catches it.
    @Test
    fun aOneNoncePreCommitmentIsRefused() {
        val actId = pre.actId().toString().toByteArray()
        val shared = pre.contentNonce
        val oneNonce = sha256Tagged(
            "cogra-l1:pre-commitment:v1",
            listOf(
                preCommitmentMsg(
                    pre.proposal.body,
                    preDigest("cogra-l1:pre-digest:content:v2", actId, shared, pre.proposal.payload),
                    preDigest("cogra-l1:pre-digest:deps:v2", actId, shared, canonicalDeps(pre.proposal.deps)),
                ),
            ),
        )
        assertThat(refusal(seal(pre, host, preCommitment = oneNonce)))
            .isEqualTo("host returned a different pre-commitment than was formed")
    }

    @Test
    fun aVerifiedActWithAnUnexpectedEditionIsRefusedBeforeApproval() {
        for ((content, dependency) in listOf(1UL to 1UL, 1UL to 2UL, 2UL to 2UL, 3UL to 1UL)) {
            assertThat(refusal(seal(pre, host, contentEdition = content, dependencyEdition = dependency)))
                .startsWith("unexpected editions (content $content, dependencies $dependency)")
        }
    }

    @Test
    fun theApprovalWitnessSignsTheVerifiedActAndItsHostSealTogether() {
        val sealed = seal(pre, host)
        val witness = actor.approve(pre, sealed, host.publicKeyBytes())
        val digest = sha256Tagged(Tags.APPROVAL, listOf(sealed.act.sealMsg(), sealed.hostSeal))
        assertThat(verifyDigest(actor.publicKeyBytes(), digest, witness.approvalSignature)).isTrue()
        val otherSeal = sha256Tagged(Tags.APPROVAL, listOf(sealed.act.sealMsg(), ByteArray(64)))
        assertThat(verifyDigest(actor.publicKeyBytes(), otherSeal, witness.approvalSignature)).isFalse()
    }

    @Test
    fun anApprovalOverTheVerifiedActWithoutItsSealDoesNotVerify() {
        val sealed = seal(pre, host)
        val unsealed = actor.signTagged(Tags.APPROVAL, sealed.act.sealMsg())
        assertThat(verifyDigest(actor.publicKeyBytes(), sealed.approvalDigest(), unsealed)).isFalse()
    }

    @Test
    fun thePreSignatureVerifiesOverTheNamedPreCommitment() {
        assertThat(verifyDigest(actor.publicKeyBytes(), pre.preCommitment(), pre.preSignature)).isTrue()
        val other = Proposal(pre.proposal.body, "another payload".toByteArray(), pre.proposal.deps)
        val otherP = preCommitment(
            other.body,
            contentPreDigest(pre.actId(), pre.contentNonce, other.payload),
            pre.dependencyPreDigest(),
        )
        assertThat(verifyDigest(actor.publicKeyBytes(), otherP, pre.preSignature)).isFalse()
    }

    @Test
    fun preSigningDrawsTwoFreshIndependentNonces() {
        val again = actor.preSign(pre.proposal)
        val nonces = listOf(pre.contentNonce, pre.dependencyNonce, again.contentNonce, again.dependencyNonce)
        for (n in nonces) assertThat(n).hasLength(SALT_LEN)
        assertThat(nonces.map { it.toHex() }.toSet()).hasSize(4)
        assertThat(again.preSignature).isNotEqualTo(pre.preSignature)
    }

    @Test
    fun eachPreDigestDependsOnItsOwnNonceAlone() {
        val p = pre.proposal
        val a = actor.preSignWith(p, ByteArray(SALT_LEN) { 1 }, ByteArray(SALT_LEN) { 2 })
        val otherContent = actor.preSignWith(p, ByteArray(SALT_LEN) { 3 }, ByteArray(SALT_LEN) { 2 })
        val otherDependency = actor.preSignWith(p, ByteArray(SALT_LEN) { 1 }, ByteArray(SALT_LEN) { 4 })
        assertThat(otherContent.contentPreDigest().bytes).isNotEqualTo(a.contentPreDigest().bytes)
        assertThat(otherContent.dependencyPreDigest()).isEqualTo(a.dependencyPreDigest())
        assertThat(otherDependency.dependencyPreDigest()).isNotEqualTo(a.dependencyPreDigest())
        assertThat(otherDependency.contentPreDigest().bytes).isEqualTo(a.contentPreDigest().bytes)
    }

    @Test
    fun preSignBindsTheNonces() {
        val p = pre.proposal
        val a = actor.preSignWith(p, ByteArray(SALT_LEN) { 5 }, ByteArray(SALT_LEN) { 6 })
        val b = actor.preSignWith(p, ByteArray(SALT_LEN) { 5 }, ByteArray(SALT_LEN) { 6 })
        // Same nonces → identical signature (Ed25519 is deterministic).
        assertThat(a.preSignature).isEqualTo(b.preSignature)
    }

    @Test
    fun preSignRefusesANoncePairTheApiWouldRefuse() {
        val p = pre.proposal
        val ok = ByteArray(SALT_LEN) { 1 }
        assertThrows(IllegalArgumentException::class.java) { actor.preSignWith(p, ByteArray(16), ok) }
        assertThrows(IllegalArgumentException::class.java) { actor.preSignWith(p, ok, ByteArray(33)) }
        assertThrows(IllegalArgumentException::class.java) { actor.preSignWith(p, ok, ok.copyOf()) }
    }

    @Test
    fun theSealedActCarriesNoPayloadAndNoNonce() {
        val wire = encodeSealedAct(seal(pre, host))
        assertThat(wire.contains(pre.proposal.payload)).isFalse()
        assertThat(wire.contains(pre.contentNonce)).isFalse()
        assertThat(wire.contains(pre.dependencyNonce)).isFalse()
        // The search finds what is there.
        assertThat(wire.contains(pre.preSignature)).isTrue()
    }

    @Test
    fun theContentPreDigestTypeRefusesAnythingButADigest() {
        assertThrows(IllegalArgumentException::class.java) { ContentPreDigest("hello".toByteArray()) }
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
    fun anEarlierFormulasCommitmentNeverVerifiesUnderTheCurrentOne() {
        val salt = ByteArray(SALT_LEN) { 7 }
        val bytes = "payload".toByteArray()
        val earlier = commitment("cogra-l1:commitment:content:v2", ACT, PRE, salt, bytes)
        assertThat(commitment(Tags.COMMIT_CONTENT, ACT, PRE, salt, bytes)).isNotEqualTo(earlier)
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
