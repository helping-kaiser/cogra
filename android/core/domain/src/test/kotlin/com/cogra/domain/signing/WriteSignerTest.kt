package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.domain.ErrorCode
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.StagedWriteView
import com.cogra.domain.testing.TestHost
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.testing.testProposalBytes
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import java.util.Base64
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * A scriptable WriteRepository over the real crypto chain: submit seals
 * through the TestHost, approve flips to RELAYING. Failure modes are
 * switched per test.
 */
private class FakeWriteRepository(val actor: ActorKey) : WriteRepository {
    val host = TestHost()
    val staged = mutableMapOf<String, StagedWriteView>()
    var refuseSubmit: List<UserError>? = null
    var failSubmit = false
    var failApprove = false
    var sealLater = false
    var tamperSeal: ((ByteArray) -> ByteArray)? = null
    var approveCount = 0

    override suspend fun hostPublicKey(): Outcome<ByteArray> = Outcome.Success(host.key.publicKeyBytes())

    override suspend fun prepareStance(targetId: String, pDirected: Double, pInterest: Double) =
        throw UnsupportedOperationException()

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        refuseSubmit?.let { return Outcome.Refused(it) }
        if (failSubmit) return Outcome.Failed(IOException("submit lost"))
        val proposal = testProposalBytes(actor)
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
        if (failApprove) return Outcome.Failed(IOException("approve lost"))
        approveCount += 1
        val current = staged.getValue(stagedWriteId).copy(state = WriteState.RELAYING)
        staged[stagedWriteId] = current
        return Outcome.Success(current)
    }

    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = Outcome.Success(staged[id])
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

    @Test
    fun signsEndToEndAndClearsMaterial() = runTest {
        val repo = FakeWriteRepository(actor)
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")))
        assertThat(results).containsExactly(WriteResult.Done("w1", WriteState.RELAYING))
        assertThat(identity.handshakes).isEmpty()
        assertThat(repo.approveCount).isEqualTo(1)
    }

    @Test
    fun awaitsAnAsynchronousSealThenApproves() = runTest {
        val repo = FakeWriteRepository(actor).apply { sealLater = true }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")))
        assertThat(results).containsExactly(WriteResult.Done("w1", WriteState.RELAYING))
    }

    @Test
    fun aRefusedSubmitEndsTheHandshake() = runTest {
        val repo = FakeWriteRepository(actor).apply {
            refuseSubmit = listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "wall"))
        }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")))
        val refused = results.single() as WriteResult.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.WRITE_RULE_FAILED)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aTamperedSealIsRejectedNotSigned() = runTest {
        val repo = FakeWriteRepository(actor).apply {
            // Flip a bit of the host seal: the device's verification fails.
            tamperSeal = { sealed ->
                sealed.copyOf().also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() }
            }
        }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")))
        assertThat(results.single()).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(repo.approveCount).isEqualTo(0)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aLostSubmitKeepsMaterialForResume() = runTest {
        val repo = FakeWriteRepository(actor).apply { failSubmit = true }
        val results = WriteSigner(repo, identity).sign(listOf(prepared("w1")))
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
        val first = signer.sign(listOf(prepared("w1")))
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
        signer.sign(listOf(prepared("w1")))

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
    fun signingWithoutAKeyThrows() = runTest {
        val bare = FakeIdentityStore()
        assertThrows(NoActorKeyException::class.java) {
            kotlinx.coroutines.runBlocking {
                WriteSigner(FakeWriteRepository(actor), bare).sign(listOf(prepared("w1")))
            }
        }
    }
}
