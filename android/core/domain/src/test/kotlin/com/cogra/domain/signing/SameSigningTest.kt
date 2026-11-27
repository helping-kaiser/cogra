package com.cogra.domain.signing

import com.cogra.crypto.Family
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException

/**
 * [SameSigning.askAgain]: the rule a Retry follows, over scripted legs. web's
 * twin: `same-signing.test.ts`.
 */
class SameSigningTest {

    private val attempt = SigningAttempt(owner = "acct-a", node = "n1", writes = listOf("w1", "w2"), intent = "i")
    private val ordered = Expectation(listOf(stanceRecord("prof:bob", 0.5, 0.1)))

    private var signed: List<WriteResult> = emptyList()
    private val asked = mutableListOf<List<String>>()
    private val states = mutableMapOf<String, Outcome<StagedWriteView?>>()
    private val reads = mutableListOf<String>()
    private val retired = mutableListOf<String>()
    private var pressing = true

    private val sameSigning = SameSigning(
        signAgain = { ids, _ ->
            asked += ids
            signed
        },
        read = { id ->
            reads += id
            states.getValue(id)
        },
        retire = { id -> retired += id },
    )

    private suspend fun ask(intent: String = "i", expected: Expectation? = ordered) =
        sameSigning.askAgain(attempt, intent, { expected }, { pressing })

    private fun state(state: WriteState): Outcome<StagedWriteView?> = Outcome.Success(
        StagedWriteView("w", state, Family.OPINION, ByteArray(0), verifiedAct = null, recordId = null),
    )

    private fun refused(code: ErrorCode) = WriteResult.Refused("w", listOf(UserError(code, "no")))

    @Test
    fun theSameGestureAsksTheSameIdsAgain() = runTest {
        signed = listOf(WriteResult.Done("w1", WriteState.RELAYING), WriteResult.Done("w2", WriteState.RELAYING))

        assertThat(ask()).isEqualTo(AskedAgain.Signed(signed))
        assertThat(asked).containsExactly(listOf("w1", "w2"))
        assertThat(retired).isEmpty()
    }

    @Test
    fun anUndecidedWriteKeepsTheAttemptEvenBesideAnEndedOne() = runTest {
        // A lost approve answer beside a terminal refusal: a second post could still land.
        signed = listOf(WriteResult.Failed("w1", IOException("lost")), refused(ErrorCode.NOT_FOUND))

        assertThat(ask()).isEqualTo(AskedAgain.Signed(signed))
        assertThat(retired).isEmpty()
    }

    @Test
    fun aKeptRefusalIsUndecided() = runTest {
        signed = listOf(refused(ErrorCode.RATE_LIMITED), refused(ErrorCode.STAGED_WRITE_EXPIRED))

        assertThat(ask()).isEqualTo(AskedAgain.Signed(signed))
        assertThat(retired).isEmpty()
    }

    @Test
    fun everyWriteEndedRetiresTheAttemptForAFreshPrepare() = runTest {
        signed = listOf(refused(ErrorCode.STAGED_WRITE_EXPIRED), WriteResult.RejectedByDevice("w2", "tampered"))
        states["w1"] = state(WriteState.EXPIRED)
        states["w2"] = state(WriteState.AWAITING_APPROVAL)

        assertThat(ask()).isEqualTo(AskedAgain.Fresh)
        // The device's refusal is read first: nothing of the attempt was approved.
        assertThat(reads).containsExactly("w1", "w2").inOrder()
        assertThat(retired).containsExactly("w1", "w2")
    }

    @Test
    fun everyWriteExpiredRetiresWithoutAReadWhenTheDeviceRefusedNothing() = runTest {
        signed = listOf(refused(ErrorCode.STAGED_WRITE_EXPIRED), refused(ErrorCode.STAGED_WRITE_EXPIRED))

        assertThat(ask()).isEqualTo(AskedAgain.Fresh)
        assertThat(reads).isEmpty()
        assertThat(retired).containsExactly("w1", "w2")
    }

    @Test
    fun aDeviceRefusalOverALandedAttemptIsLanding() = runTest {
        // The first press's approval went out and its answer was lost; the re-ask's
        // intent check then refused the whole batch. Retiring it would be a second post.
        signed = listOf(WriteResult.RejectedByDevice("w1", "moved"), WriteResult.RejectedByDevice("w2", "moved"))
        states["w1"] = state(WriteState.LANDED)
        states["w2"] = state(WriteState.LANDED)

        assertThat(ask()).isEqualTo(AskedAgain.Landing)
        assertThat(retired).isEmpty()
    }

    @Test
    fun aDeviceRefusalOverARelayingWriteIsLanding() = runTest {
        signed = listOf(WriteResult.RejectedByDevice("w1", "moved"), WriteResult.RejectedByDevice("w2", "moved"))
        states["w1"] = state(WriteState.AWAITING_APPROVAL)
        states["w2"] = state(WriteState.RELAYING)

        assertThat(ask()).isEqualTo(AskedAgain.Landing)
        assertThat(retired).isEmpty()
    }

    @Test
    fun aDeviceRefusalWhoseReadDoesNotAnswerDecidesNothing() = runTest {
        signed = listOf(WriteResult.RejectedByDevice("w1", "moved"), WriteResult.RejectedByDevice("w2", "moved"))
        val down: Outcome<StagedWriteView?> = Outcome.Failed(IOException("down"))
        states["w1"] = down

        assertThat(ask()).isEqualTo(AskedAgain.Unread(down))
        assertThat(retired).isEmpty()
    }

    @Test
    fun aDeviceRefusalWhoseReadIsRefusedDecidesNothing() = runTest {
        signed = listOf(WriteResult.RejectedByDevice("w1", "moved"), WriteResult.RejectedByDevice("w2", "moved"))
        val refusedRead: Outcome<StagedWriteView?> = Outcome.Refused(listOf(UserError(ErrorCode.RATE_LIMITED, "no")))
        states["w1"] = state(WriteState.AWAITING_APPROVAL)
        states["w2"] = refusedRead

        assertThat(ask()).isEqualTo(AskedAgain.Unread(refusedRead))
        assertThat(retired).isEmpty()
    }

    @Test
    fun anAccountChangeWhileADeviceRefusalIsReadRetiresNothing() = runTest {
        val switching = SameSigning(
            signAgain = { _, _ ->
                listOf(WriteResult.RejectedByDevice("w1", "moved"), WriteResult.RejectedByDevice("w2", "moved"))
            },
            read = { id ->
                reads += id
                pressing = false
                state(WriteState.AWAITING_APPROVAL)
            },
            retire = { id -> retired += id },
        )

        assertThat(switching.askAgain(attempt, "i", { ordered }, { pressing })).isEqualTo(AskedAgain.Foreign)
        assertThat(reads).containsExactly("w1")
        assertThat(retired).isEmpty()
    }

    @Test
    fun anAttemptOnlyWaitingOnItsSealIsAskedAgainNotReplaced() = runTest {
        signed = listOf(WriteResult.AwaitingSeal("w1"), WriteResult.AwaitingSeal("w2"))

        assertThat(ask()).isEqualTo(AskedAgain.Signed(signed))
        assertThat(retired).isEmpty()
    }

    @Test
    fun aSealWaitBesideAnEndedWriteRetires() = runTest {
        signed = listOf(WriteResult.AwaitingSeal("w1"), refused(ErrorCode.STAGED_WRITE_EXPIRED))

        assertThat(ask()).isEqualTo(AskedAgain.Fresh)
    }

    @Test
    fun anExpectationThatCannotBeBuiltSignsNothing() = runTest {
        assertThat(ask(expected = null)).isEqualTo(AskedAgain.Unchecked)
        assertThat(asked).isEmpty()
    }

    @Test
    fun aChangedGestureOverAnApprovedAttemptIsLanding() = runTest {
        states["w1"] = state(WriteState.AWAITING_APPROVAL)
        states["w2"] = state(WriteState.RELAYING)

        assertThat(ask(intent = "changed")).isEqualTo(AskedAgain.Landing)
        assertThat(asked).isEmpty()
        assertThat(retired).isEmpty()
    }

    @Test
    fun aChangedGestureOverAnUnapprovedAttemptRetiresIt() = runTest {
        states["w1"] = state(WriteState.AWAITING_APPROVAL)
        states["w2"] = Outcome.Success(null)

        assertThat(ask(intent = "changed")).isEqualTo(AskedAgain.Fresh)
        assertThat(retired).containsExactly("w1", "w2")
        assertThat(asked).isEmpty()
    }

    @Test
    fun aChangedGestureWhoseReadDoesNotAnswerDecidesNothing() = runTest {
        val down: Outcome<StagedWriteView?> = Outcome.Failed(IOException("down"))
        states["w1"] = down

        assertThat(ask(intent = "changed")).isEqualTo(AskedAgain.Unread(down))
        assertThat(retired).isEmpty()
    }

    @Test
    fun anotherAccountActiveRunsNothing() = runTest {
        pressing = false
        signed = listOf(refused(ErrorCode.STAGED_WRITE_EXPIRED), refused(ErrorCode.STAGED_WRITE_EXPIRED))

        assertThat(ask()).isEqualTo(AskedAgain.Foreign)
        assertThat(ask(intent = "changed")).isEqualTo(AskedAgain.Foreign)
        assertThat(asked).isEmpty()
        assertThat(reads).isEmpty()
        assertThat(retired).isEmpty()
    }

    @Test
    fun anAccountChangeDuringTheAskRetiresNothing() = runTest {
        // The switch lands while the batch is being asked: the answer is not retired under the other account.
        val switching = SameSigning(
            signAgain = { _, _ ->
                pressing = false
                listOf(refused(ErrorCode.STAGED_WRITE_EXPIRED), refused(ErrorCode.STAGED_WRITE_EXPIRED))
            },
            read = { error("not read") },
            retire = { id -> retired += id },
        )

        assertThat(switching.askAgain(attempt, "i", { ordered }, { pressing })).isEqualTo(AskedAgain.Foreign)
        assertThat(retired).isEmpty()
    }

    @Test
    fun theIntentKeyMovesWithAnyPartOfTheRequest() {
        val base = intentOf("words", LicenseChoice(0.0, 0.0), listOf(TagClaimPart("a")), 0.1)
        assertThat(intentOf("words", LicenseChoice(0.0, 0.0), listOf(TagClaimPart("a")), 0.1)).isEqualTo(base)
        assertThat(intentOf("words", LicenseChoice(1.0, 0.0), listOf(TagClaimPart("a")), 0.1)).isNotEqualTo(base)
        assertThat(intentOf("words", LicenseChoice(0.0, 0.0), listOf(TagClaimPart("b")), 0.1)).isNotEqualTo(base)
        assertThat(intentOf("words", LicenseChoice(0.0, 0.0), listOf(TagClaimPart("a")), 0.2)).isNotEqualTo(base)
    }

    private data class TagClaimPart(val name: String)
}
