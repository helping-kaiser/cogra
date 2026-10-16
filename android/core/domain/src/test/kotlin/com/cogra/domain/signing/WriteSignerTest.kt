package com.cogra.domain.signing

import com.cogra.crypto.ActId
import com.cogra.crypto.ActorKey
import com.cogra.crypto.Proposal
import com.cogra.crypto.StructuralBody
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.encodeProposal
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.TestHost
import com.cogra.domain.testing.testProposalBytes
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException
import java.util.Base64

/**
 * A scriptable WriteRepository over the real crypto chain: submit seals
 * through the TestHost, approve flips to RELAYING. Failure modes are
 * switched per test.
 */
private class FakeWriteRepository(val actor: ActorKey) : WriteRepository {
    val host = TestHost()
    val staged = mutableMapOf<String, StagedWriteView>()
    var refuseSubmit: List<UserError>? = null
    var refuseApprove: List<UserError>? = null
    var refuseRead: List<UserError>? = null
    var failSubmit = false
    var failApprove = false
    var sealLater = false
    var tamperSeal: ((ByteArray) -> ByteArray)? = null
    var approveCount = 0

    /** What the host seals; [testProposalBytes] unless a test serves another. */
    var sealedProposal: ByteArray? = null

    override suspend fun hostPublicKey(): Outcome<ByteArray> = Outcome.Success(host.key.publicKeyBytes())

    override suspend fun prepareStance(targetId: String, pDirected: Double, pInterest: Double) =
        throw UnsupportedOperationException()

    override suspend fun prepareTopicStance(topicName: String, pDirected: Double, pInterest: Double) =
        throw UnsupportedOperationException()

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        refuseSubmit?.let { return Outcome.Refused(it) }
        if (failSubmit) return Outcome.Failed(IOException("submit lost"))
        val proposal = sealedProposal ?: testProposalBytes(actor)
        val sealed = host.seal(proposal, Base64.getDecoder().decode(signatureBase64), actor.publicKeyBytes())
        val act = tamperSeal?.invoke(sealed) ?: sealed
        val view = StagedWriteView(
            id = stagedWriteId,
            state = if (sealLater) WriteState.SEALING else WriteState.AWAITING_APPROVAL,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = proposal,
            verifiedAct = if (sealLater) null else act,
            recordId = null,
        )
        staged[stagedWriteId] = if (sealLater) view else view
        // When sealing is deferred, the next observation serves the act.
        if (sealLater) {
            staged[stagedWriteId] = view.copy(state = WriteState.AWAITING_APPROVAL, verifiedAct = act)
            return Outcome.Success(view)
        }
        return Outcome.Success(view)
    }

    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        refuseApprove?.let { return Outcome.Refused(it) }
        if (failApprove) return Outcome.Failed(IOException("approve lost"))
        approveCount += 1
        val current = staged.getValue(stagedWriteId).copy(state = WriteState.RELAYING)
        staged[stagedWriteId] = current
        return Outcome.Success(current)
    }

    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> {
        refuseRead?.let { return Outcome.Refused(it) }
        return Outcome.Success(staged[id])
    }
}

class WriteSignerTest {

    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }

    private fun prepared(id: String) = PreparedWriteView(
        id = id,
        family = com.cogra.crypto.Family.OPINION,
        canonicalProposal = testProposalBytes(actor),
        gcAfterEpochs = 8,
    )

    /** What the gesture behind [testProposalBytes] ordered: that Opinion, exactly. */
    private val ordered = Expectation(listOf(stanceRecord("prof:bob", 0.5, 0.1)))

    /** A prepare that serves an Opinion of its own making, authored by this device. */
    private fun served(id: String, body: (StructuralBody) -> StructuralBody, payload: ByteArray = ByteArray(0)) =
        PreparedWriteView(
            id = id,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = run {
                val faithful = decodeProposal(testProposalBytes(actor))
                encodeProposal(Proposal(body(faithful.body), payload, faithful.deps))
            },
            gcAfterEpochs = 8,
        )

    @Test
    fun signsEndToEndAndClearsMaterial() = runTest {
        val repo = FakeWriteRepository(actor)
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")), ordered)
        assertThat(results).containsExactly(WriteResult.Done("w1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
        assertThat(repo.approveCount).isEqualTo(1)
    }

    @Test
    fun awaitsAnAsynchronousSealThenApproves() = runTest {
        val repo = FakeWriteRepository(actor).apply { sealLater = true }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")), ordered)
        assertThat(results).containsExactly(WriteResult.Done("w1", WriteState.RELAYING))
    }

    @Test
    fun aRefusedSubmitEndsTheHandshake() = runTest {
        val repo = FakeWriteRepository(actor).apply {
            refuseSubmit = listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "wall"))
        }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")), ordered)
        val refused = results.single() as WriteResult.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.WRITE_RULE_FAILED)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aRateLimitedApproveKeepsMaterialForResume() = runTest {
        val repo = FakeWriteRepository(actor).apply {
            refuseApprove = listOf(UserError(ErrorCode.RATE_LIMITED, "slow down"))
        }
        val signer = WriteSigner(repo, identity)
        val first = signer.sign(listOf(prepared("w1")), ordered).single() as WriteResult.Refused
        assertThat(first.errors.single().code).isEqualTo(ErrorCode.RATE_LIMITED)
        assertThat(identity.handshakes.keys).containsExactly("w1")

        // The backoff passes; the same material finishes the handshake.
        repo.refuseApprove = null
        val resumed = signer.resume()
        assertThat(resumed).containsExactly(WriteResult.Done("w1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aRefusedReadLegKeepsMaterial() = runTest {
        val repo = FakeWriteRepository(actor).apply { failApprove = true }
        val signer = WriteSigner(repo, identity)
        signer.sign(listOf(prepared("w1")), ordered)
        assertThat(identity.handshakes.keys).containsExactly("w1")

        repo.failApprove = false
        repo.refuseRead = listOf(UserError(ErrorCode.RATE_LIMITED, "slow down"))
        val resumed = signer.resume().single() as WriteResult.Refused
        assertThat(resumed.errors.single().code).isEqualTo(ErrorCode.RATE_LIMITED)
        assertThat(identity.handshakes.keys).containsExactly("w1")
    }

    @Test
    fun aTamperedSealIsRejectedNotSigned() = runTest {
        val repo = FakeWriteRepository(actor).apply {
            // Flip a bit of the host seal: the device's verification fails.
            tamperSeal = { sealed ->
                sealed.copyOf().also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() }
            }
        }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")), ordered)
        assertThat(results.single()).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.approveCount).isEqualTo(0)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aLostSubmitKeepsMaterialForResume() = runTest {
        val repo = FakeWriteRepository(actor).apply { failSubmit = true }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")), ordered)
        assertThat(results.single()).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(identity.handshakes.keys).containsExactly("w1")

        // The network returns; resume finds the server never saw the
        // submit (no staged row) — the material is spent and cleared.
        repo.failSubmit = false
        val resumed = WriteSigner(repo, identity).resume()
        val refused = resumed.single() as WriteResult.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aLostApproveResumesFromAwaitingApproval() = runTest {
        val repo = FakeWriteRepository(actor).apply { failApprove = true }
        val signer = WriteSigner(repo, identity)
        val first = signer.sign(listOf(prepared("w1")), ordered)
        assertThat(first.single()).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(identity.handshakes.keys).containsExactly("w1")

        repo.failApprove = false
        val resumed = signer.resume()
        assertThat(resumed).containsExactly(WriteResult.Done("w1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun resumeClearsLandedAndExpiredWrites() = runTest {
        val repo = FakeWriteRepository(actor)
        val signer = WriteSigner(repo, identity)
        signer.sign(listOf(prepared("w1")), ordered)

        // Simulate stale material for a write that landed and one that expired.
        val pre = actor.preSign(com.cogra.crypto.decodeProposal(testProposalBytes(actor)))
        identity.saveHandshake("landed", pre)
        identity.saveHandshake("expired", pre)
        repo.staged["landed"] = repo.staged.getValue("w1").copy(state = WriteState.LANDED)
        repo.staged["expired"] = repo.staged.getValue("w1").copy(state = WriteState.EXPIRED)

        val results = signer.resume().associateBy { it.stagedWriteId }
        assertThat(results.getValue("landed")).isEqualTo(WriteResult.Done("landed", WriteState.LANDED))
        val expired = results.getValue("expired") as WriteResult.Refused
        assertThat(expired.errors.single().code).isEqualTo(ErrorCode.STAGED_WRITE_EXPIRED)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun signStagedSignsAFreshStagingEndToEnd() = runTest {
        // The staged-Registration path: the write arrives already staged
        // (AWAITING_PRE_SIGN) instead of prepared.
        val repo = FakeWriteRepository(actor)
        val staged = StagedWriteView(
            id = "reg-1",
            state = WriteState.AWAITING_PRE_SIGN,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = null,
            recordId = null,
        )
        val result = WriteSigner(repo, identity).signStaged(staged, ordered)
        assertThat(result).isEqualTo(WriteResult.Done("reg-1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun signStagedResendsPersistedMaterialInsteadOfReSigning() = runTest {
        // A lost submit response: the material exists, the staging still
        // says AWAITING_PRE_SIGN — the same nonce is re-sent.
        val repo = FakeWriteRepository(actor)
        val proposal = testProposalBytes(actor)
        val pre = actor.preSign(com.cogra.crypto.decodeProposal(proposal))
        identity.saveHandshake("reg-1", pre)
        val staged = StagedWriteView(
            id = "reg-1",
            state = WriteState.AWAITING_PRE_SIGN,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = proposal,
            verifiedAct = null,
            recordId = null,
        )
        val result = WriteSigner(repo, identity).signStaged(staged, ordered)
        assertThat(result).isEqualTo(WriteResult.Done("reg-1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun signStagedContinuesAMidHandshakeStagingWithMaterial() = runTest {
        val repo = FakeWriteRepository(actor).apply { failApprove = true }
        val signer = WriteSigner(repo, identity)
        val fresh = StagedWriteView(
            id = "reg-1",
            state = WriteState.AWAITING_PRE_SIGN,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = null,
            recordId = null,
        )
        assertThat(signer.signStaged(fresh, ordered)).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(identity.handshakes.keys).containsExactly("reg-1")

        repo.failApprove = false
        val result = signer.signStaged(repo.staged.getValue("reg-1"), ordered)
        assertThat(result).isEqualTo(WriteResult.Done("reg-1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun signStagedWithoutMaterialMidHandshakeRefuses() = runTest {
        // Pre-signed by another device (or the material is gone): only
        // the expiry re-stage recovers.
        val repo = FakeWriteRepository(actor)
        val staged = StagedWriteView(
            id = "reg-1",
            state = WriteState.AWAITING_APPROVAL,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = byteArrayOf(1),
            recordId = null,
        )
        val result = WriteSigner(repo, identity).signStaged(staged, ordered) as WriteResult.Refused
        assertThat(result.errors.single().code).isEqualTo(ErrorCode.INTERNAL)
    }

    @Test
    fun signStagedClearsFinishedAndExpiredStagings() = runTest {
        val repo = FakeWriteRepository(actor)
        val signer = WriteSigner(repo, identity)
        val pre = actor.preSign(com.cogra.crypto.decodeProposal(testProposalBytes(actor)))
        identity.saveHandshake("reg-1", pre)
        val relaying = StagedWriteView(
            id = "reg-1",
            state = WriteState.RELAYING,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = null,
            recordId = null,
        )
        assertThat(signer.signStaged(relaying, ordered)).isEqualTo(WriteResult.Done("reg-1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()

        identity.saveHandshake("reg-2", pre)
        val expired = relaying.copy(id = "reg-2", state = WriteState.EXPIRED)
        val refused = signer.signStaged(expired, ordered) as WriteResult.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.STAGED_WRITE_EXPIRED)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun anUnknownStagedStateIsRefusedWithMaterialKept() = runTest {
        // A server state this build does not know: refuse, but keep the
        // material — an updated build resumes it.
        val repo = FakeWriteRepository(actor)
        val signer = WriteSigner(repo, identity)
        val pre = actor.preSign(com.cogra.crypto.decodeProposal(testProposalBytes(actor)))
        identity.saveHandshake("reg-1", pre)
        val staged = StagedWriteView(
            id = "reg-1",
            state = WriteState.UNKNOWN,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = null,
            recordId = null,
        )
        val refused = signer.signStaged(staged, ordered) as WriteResult.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNKNOWN)
        assertThat(identity.handshakes.keys).containsExactly("reg-1")

        repo.staged["reg-1"] = staged
        val resumed = signer.resume().single() as WriteResult.Refused
        assertThat(resumed.errors.single().code).isEqualTo(ErrorCode.UNKNOWN)
        assertThat(identity.handshakes.keys).containsExactly("reg-1")
    }

    @Test
    fun anUnknownFamilyIsNeverSigned() = runTest {
        val repo = FakeWriteRepository(actor)
        val results = WriteSigner(repo, identity).sign(
            listOf(prepared("w1").copy(family = com.cogra.crypto.Family.UNKNOWN)),
            ordered,
        )
        val refused = results.single() as WriteResult.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNKNOWN)
        // Nothing was pre-signed, submitted, or persisted.
        assertThat(identity.handshakes).isEmpty()
        assertThat(repo.staged).isEmpty()
    }

    // ---- the intent check (Intent.kt), against a prepare that lies ----------

    @Test
    fun aWriteWhoseBodyDisagreesWithItsFormIsRefusedOnDevice() = runTest {
        // The pad picked (0.5, 0.1); the prepare served a subtly different
        // valence — the stance the user never chose.
        val repo = FakeWriteRepository(actor)
        val results = WriteSigner(repo, identity).sign(listOf(served("w1", { it.copy(pD = 0.55) })), ordered)
        assertThat(results.single()).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.staged).isEmpty()
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aBatchWithOneMismatchedWriteSignsNoneOfItsWrites() = runTest {
        // The intent check runs before the first pre-signature of the
        // batch: the faithful first write is not pre-signed either.
        val repo = FakeWriteRepository(actor)
        val results = WriteSigner(repo, identity).sign(
            listOf(prepared("w1"), served("w2", { it.copy(pI = -0.1) })),
            Expectation(listOf(stanceRecord("prof:bob", 0.5, 0.1), stanceRecord("prof:bob", 0.5, 0.1))),
        )
        assertThat(results.map { it::class }).containsExactly(
            WriteResult.RejectedByDevice::class,
            WriteResult.RejectedByDevice::class,
        )
        assertThat(repo.staged).isEmpty()
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aWriteCarryingAnInjectedFieldIsRefusedOnDevice() = runTest {
        val repo = FakeWriteRepository(actor)
        val injected = listOf(
            served("w1", { it }, payload = byteArrayOf(1)),
            served("w2", { it.copy(license = "a=1;o=1") }),
            served("w3", { it.copy(target = com.cogra.crypto.NodeId.parse("prof:eve")) }),
        )
        for (write in injected) {
            val result = WriteSigner(repo, identity).sign(listOf(write), ordered).single()
            assertThat(result).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        }
        assertThat(repo.staged).isEmpty()
    }

    @Test
    fun theStagedRegistrationIsTheOneNamedExemptionFromTheIntentCheck() = runTest {
        // An Opinion served where a Registration was expected: the
        // exemption holds for a Registration and nothing else.
        val repo = FakeWriteRepository(actor)
        val staged = StagedWriteView(
            id = "reg-1",
            state = WriteState.AWAITING_PRE_SIGN,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = null,
            recordId = null,
        )
        val result = WriteSigner(repo, identity).signStaged(staged, RegistrationExemption)
        assertThat(result).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.staged).isEmpty()
    }

    @Test
    fun aCarriedWriteThisDeviceNeverPreparedSignsUnderTheCarriedAtLandingExemption() = runTest {
        val repo = FakeWriteRepository(actor)
        val carried = StagedWriteView(
            id = "c1",
            state = WriteState.AWAITING_PRE_SIGN,
            family = com.cogra.crypto.Family.OPINION,
            canonicalProposal = testProposalBytes(actor),
            verifiedAct = null,
            recordId = null,
        )
        val results = WriteSigner(repo, identity).signCarriedAtLanding(listOf(carried))
        assertThat(results).containsExactly(WriteResult.Done("c1", WriteState.RELAYING))
    }

    // ---- the carried branch (PR-88: CI-G5 ruled (a)+(a1)) -----------------

    /** The ruled dependency completion the landing appends. */
    private val completion = listOf(
        ActId(actor.address(), 0u, com.cogra.crypto.Family.REGISTRATION),
        ActId(ActorKey.generate().address(), 4u, com.cogra.crypto.Family.OPINION),
    )

    /** The applicant's prepare served it: [testProposalBytes], carried. */
    private fun carriedAtPrepare(id: String = "c1") = prepared(id).copy(carried = true)

    /** The landing's release of [testProposalBytes] — [body] and [payload] as served, the completion appended. */
    private fun released(
        id: String = "c1",
        body: (StructuralBody) -> StructuralBody = { it },
        payload: ByteArray = ByteArray(0),
    ) = StagedWriteView(
        id = id,
        state = WriteState.AWAITING_PRE_SIGN,
        family = com.cogra.crypto.Family.OPINION,
        canonicalProposal = run {
            val faithful = decodeProposal(testProposalBytes(actor))
            encodeProposal(Proposal(body(faithful.body), payload, completion))
        },
        verifiedAct = null,
        recordId = null,
    )

    @Test
    fun aCarriedWriteIsIntentCheckedAtItsPrepareAndKeptNotSigned() = runTest {
        val repo = FakeWriteRepository(actor)
        val results = WriteSigner(repo, identity).sign(listOf(carriedAtPrepare()), ordered)
        assertThat(results).containsExactly(WriteResult.Carried("c1"))
        // Nothing pre-signed, nothing spent — and what was verified is kept.
        assertThat(repo.staged).isEmpty()
        assertThat(identity.handshakes).isEmpty()
        assertThat(identity.carriedExpectations.getValue("c1"))
            .isEqualTo(carriedDigest(decodeProposal(testProposalBytes(actor))))
    }

    @Test
    fun aCarriedWriteThatDisagreesWithItsFormIsRefusedAtItsPrepareAndNothingIsKept() = runTest {
        val repo = FakeWriteRepository(actor)
        val served = served("c1", { it.copy(pD = 0.55) }).copy(carried = true)
        val results = WriteSigner(repo, identity).sign(listOf(served), ordered)
        assertThat(results.single()).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.staged).isEmpty()
        assertThat(identity.carriedExpectations).isEmpty()
    }

    @Test
    fun theLandingSignsACarriedWriteEqualToItsKeptExpectationModuloTheDependencyCompletion() = runTest {
        val repo = FakeWriteRepository(actor)
        val signer = WriteSigner(repo, identity)
        signer.sign(listOf(carriedAtPrepare()), ordered)
        val release = released()
        repo.sealedProposal = release.canonicalProposal
        val results = signer.signCarriedAtLanding(listOf(release))
        assertThat(results).containsExactly(WriteResult.Done("c1", WriteState.RELAYING))
        // Pre-signed and handed to the backend: the expectation has done its job.
        assertThat(identity.carriedExpectations).isEmpty()
    }

    @Test
    fun aReleasedCarriedWriteThatDiffersFromItsKeptExpectationRefusesTheWholeBatch() = runTest {
        val repo = FakeWriteRepository(actor)
        val signer = WriteSigner(repo, identity)
        signer.sign(listOf(carriedAtPrepare()), ordered)
        val results = signer.signCarriedAtLanding(
            listOf(
                // Prepared on another device: it would sign under the exemption alone…
                released("other"),
                // …but the served value is not the one this device verified.
                released(body = { it.copy(pD = 0.9) }),
            ),
        )
        assertThat(results.map { it::class }).containsExactly(
            WriteResult.RejectedByDevice::class,
            WriteResult.RejectedByDevice::class,
        )
        assertThat(repo.staged).isEmpty()
        // KEPT through the refusal: the next poll must refuse again, never find
        // the expectation gone and sign under the exemption.
        assertThat(identity.carriedExpectations.keys).containsExactly("c1")
    }

    @Test
    fun aReleasedCarriedWriteWithAnInjectedPayloadIsRefused() = runTest {
        val repo = FakeWriteRepository(actor)
        val signer = WriteSigner(repo, identity)
        signer.sign(listOf(carriedAtPrepare()), ordered)
        val results = signer.signCarriedAtLanding(listOf(released(payload = byteArrayOf(1))))
        assertThat(results.single()).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.staged).isEmpty()
    }

    @Test
    fun theCarriedAtLandingExemptionStillRunsTheTransportCheck() = runTest {
        val repo = FakeWriteRepository(actor)
        val malformed = released().copy(canonicalProposal = byteArrayOf(1, 2))
        val results = WriteSigner(repo, identity).signCarriedAtLanding(listOf(malformed))
        assertThat(results.single()).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.staged).isEmpty()
    }

    @Test
    fun theLandingGateHoldsTheCarriedBatchBackWithoutSpendingAnything() = runTest {
        val repo = FakeWriteRepository(actor)
        WriteSigner(repo, identity).sign(listOf(carriedAtPrepare()), ordered)
        val asked = mutableListOf<List<String>>()
        val gate = CarriedLandingGate { batch ->
            asked += batch.map { it.id }
            CarriedLandingReadiness.NotReady("the media move is not confirmed yet")
        }
        val results = WriteSigner(repo, identity, gate).signCarriedAtLanding(listOf(released()))
        assertThat(asked).containsExactly(listOf("c1"))
        assertThat(results.single()).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(repo.staged).isEmpty()
        assertThat(identity.carriedExpectations.keys).containsExactly("c1")
    }

    @Test
    fun theLandingGateIsNeverAskedForABatchTheIntentCheckRefused() = runTest {
        val repo = FakeWriteRepository(actor)
        WriteSigner(repo, identity).sign(listOf(carriedAtPrepare()), ordered)
        var asked = 0
        val gate = CarriedLandingGate {
            asked += 1
            CarriedLandingReadiness.Ready
        }
        WriteSigner(repo, identity, gate).signCarriedAtLanding(listOf(released(body = { it.copy(pD = 0.9) })))
        assertThat(asked).isEqualTo(0)
    }

    @Test
    fun theDependencyCompletionNeverChangesTheCarriedDigest() {
        val faithful = decodeProposal(testProposalBytes(actor))
        val completed = Proposal(faithful.body, faithful.payload, completion)
        assertThat(carriedDigest(completed)).isEqualTo(carriedDigest(faithful))
        val changed = Proposal(faithful.body.copy(pI = 0.11), faithful.payload, faithful.deps)
        assertThat(carriedDigest(changed)).isNotEqualTo(carriedDigest(faithful))
    }

    @Test
    fun signingWithoutAKeyThrows() = runTest {
        val bare = FakeIdentityStore()
        assertThrows(NoActorKeyException::class.java) {
            kotlinx.coroutines.runBlocking {
                WriteSigner(FakeWriteRepository(actor), bare).sign(listOf(prepared("w1")), ordered)
            }
        }
    }
}
