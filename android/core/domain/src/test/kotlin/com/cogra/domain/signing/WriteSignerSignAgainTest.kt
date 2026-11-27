package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.domain.ErrorCode
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.WriteState
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test

/**
 * [WriteSigner.signAgain]: one earlier signing asked again by its staged ids,
 * through the same checked steps [WriteSigner.sign] uses — nothing prepared,
 * nothing signed twice. web's twin: the `signAgain` cases of
 * `write-signer.retry.test.ts`.
 */
class WriteSignerSignAgainTest {

    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)
    private val host = AnswerLosingWriteRepository(sealer)
    private val signer = WriteSigner(host, identity)

    /** One Opinion, ordered and staged faithfully. */
    private val ordered = Expectation(listOf(stanceRecord("prof:bob", 0.5, 0.1)))

    private fun staged(): List<PreparedWriteView> = sealer.stageFaithful(ordered)

    @Test
    fun aPreCommittedWriteWhoseAnswerWasLostIsApprovedFromItsStoredMaterial() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        assertThat(signer.sign(batch, ordered).single()).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(identity.handshakes.keys).containsExactly(batch.single().id)

        val again = signer.signAgain(batch.map { it.id }, ordered)

        assertThat(again).containsExactly(WriteResult.Done(batch.single().id, WriteState.RELAYING))
        // The stored pre-commitment, never a second one: one submit, one approval.
        assertThat(host.read).containsExactly(batch.single().id)
        assertThat(host.submitted).containsExactly(batch.single().id)
        assertThat(host.approved).containsExactly(batch.single().id)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun anApprovedWriteWhoseAnswerWasLostAnswersDoneWithoutSigningAgain() = runTest {
        val batch = staged()
        host.loseApproves = 1
        signer.sign(batch, ordered)

        val again = signer.signAgain(batch.map { it.id }, ordered)

        assertThat(again).containsExactly(WriteResult.Done(batch.single().id, WriteState.RELAYING))
        assertThat(host.approved).hasSize(1)
        assertThat(host.submitted).hasSize(1)
    }

    @Test
    fun anUnsubmittedWriteReSendsTheStoredPreCommitment() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        signer.sign(batch, ordered)
        // The host took nothing after all: the write still awaits its pre-signature.
        host.hostSays(batch.single().id, WriteState.AWAITING_PRE_SIGN)

        val again = signer.signAgain(batch.map { it.id }, ordered)

        assertThat(again.single()).isInstanceOf(WriteResult.Done::class.java)
        // The same id re-sent from this device's stored material — no new staging.
        assertThat(host.submitted).containsExactly(batch.single().id, batch.single().id)
        assertThat(host.approved).containsExactly(batch.single().id)
    }

    @Test
    fun anExpiredWriteIsRefusedAsExpiredAndItsMaterialSpent() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        signer.sign(batch, ordered)
        host.hostSays(batch.single().id, WriteState.EXPIRED)

        val again = signer.signAgain(batch.map { it.id }, ordered).single()

        assertThat(again).isInstanceOf(WriteResult.Refused::class.java)
        assertThat((again as WriteResult.Refused).errors.single().code).isEqualTo(ErrorCode.STAGED_WRITE_EXPIRED)
        assertThat(identity.handshakes).isEmpty()
        assertThat(host.approved).isEmpty()
    }

    @Test
    fun aBatchNotReadWholeSignsNothingAndKeepsTheMaterial() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        signer.sign(batch, ordered)
        host.readsFail = true

        val again = signer.signAgain(batch.map { it.id }, ordered)

        assertThat(again.single()).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(host.approved).isEmpty()
        assertThat(identity.handshakes.keys).containsExactly(batch.single().id)
    }

    @Test
    fun oneIdGoneAnswersNotFoundAndTheRestSignNothing() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        signer.sign(batch, ordered)

        val again = signer.signAgain(listOf(batch.single().id, "w-gone"), ordered)

        assertThat(again[0]).isInstanceOf(WriteResult.Failed::class.java)
        assertThat((again[0] as WriteResult.Failed).cause).isInstanceOf(NotReadWholeException::class.java)
        assertThat((again[1] as WriteResult.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
        assertThat(host.approved).isEmpty()
        assertThat(identity.handshakes.keys).containsExactly(batch.single().id)
    }

    @Test
    fun aBatchThatIsNotTheGestureIsRefusedWholeBeforeAnythingSigns() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        signer.sign(batch, ordered)
        val other = Expectation(listOf(stanceRecord("prof:bob", -0.5, 0.1)))

        val again = signer.signAgain(batch.map { it.id }, other).single()

        assertThat(again).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(host.approved).isEmpty()
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun noKeyOnTheDeviceThrowsAsSignDoes() = runTest {
        val batch = staged()
        host.loseSubmits = 1
        signer.sign(batch, ordered)
        identity.seed = null

        val thrown = runCatching { signer.signAgain(batch.map { it.id }, ordered) }.exceptionOrNull()

        assertThat(thrown).isInstanceOf(NoActorKeyException::class.java)
        assertThat(host.approved).isEmpty()
    }

    @Test
    fun anEmptyBatchSignsNothing() = runTest {
        assertThat(signer.signAgain(emptyList(), ordered)).isEmpty()
        assertThat(host.read).isEmpty()
    }
}
