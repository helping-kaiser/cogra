package com.cogra.domain.stance

import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.SigningAttempt
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The slots a stance gesture's attempt is kept in. web's twin:
 * `stance-attempts.test.ts`.
 */
class StanceAttemptsTest {

    private val target = StanceTarget.Node("post-1")
    private val pick = StanceSlot.Pick(target)
    private val walkBack = StanceSlot.WalkBack(target)

    private fun attempt(owner: String = "acct-a") =
        StanceAttempt(SigningAttempt(owner, "n1", listOf("w1"), "i"), Expectation(emptyList()))

    @Test
    fun anAttemptInFlightIsNotAnsweredUntilItSettles() {
        val mine = StanceAttempts().of("acct-a")
        mine.begin(pick)
        mine.remember(pick, attempt())

        assertThat(mine.asking(pick)).isTrue()
        assertThat(mine.answered(pick)).isNull()

        mine.settle(pick)
        assertThat(mine.asking(pick)).isFalse()
        assertThat(mine.answered(pick)).isEqualTo(attempt())
    }

    @Test
    fun aGestureThatStagedNothingLeavesNothingBehind() {
        val mine = StanceAttempts().of("acct-a")
        mine.begin(pick)
        mine.settle(pick)

        assertThat(mine.asking(pick)).isFalse()
        assertThat(mine.answered(pick)).isNull()
    }

    @Test
    fun onlyAGestureHoldingTheSlotRemembers() {
        val mine = StanceAttempts().of("acct-a")
        mine.remember(pick, attempt())

        assertThat(mine.answered(pick)).isNull()
    }

    @Test
    fun aWalkBackKeepsASlotOfItsOwnBesideThePicks() {
        val mine = StanceAttempts().of("acct-a")
        mine.begin(pick)
        mine.remember(pick, attempt())
        mine.settle(pick)

        assertThat(mine.answered(walkBack)).isNull()
        assertThat(mine.answered(StanceSlot.KeptBatch)).isNull()
        mine.forget(walkBack)
        assertThat(mine.answered(pick)).isEqualTo(attempt())
    }

    @Test
    fun eachAccountsAttemptsAreApartAndKeptForItsReturn() {
        val attempts = StanceAttempts()
        attempts.of("acct-a").apply {
            begin(pick)
            remember(pick, attempt())
            settle(pick)
        }

        assertThat(attempts.of("acct-b").answered(pick)).isNull()
        assertThat(attempts.of("acct-a").answered(pick)).isEqualTo(attempt())
    }

    @Test
    fun theIntentsTellGesturesApart() {
        val other = StanceTarget.Node("post-2")
        assertThat(stanceIntent(target, StancePair(0.1, 0.2))).isEqualTo(stanceIntent(target, StancePair(0.1, 0.2)))
        assertThat(stanceIntent(target, StancePair(0.1, 0.2))).isNotEqualTo(stanceIntent(target, StancePair(0.2, 0.1)))
        assertThat(stanceIntent(target, StancePair(0.1, 0.2))).isNotEqualTo(stanceIntent(other, StancePair(0.1, 0.2)))
        assertThat(severanceIntent(target)).isNotEqualTo(severanceIntent(other))
        val batch = listOf(target to StancePair(0.1, 0.2), other to StancePair(0.3, 0.3))
        assertThat(keptBatchIntent(batch)).isEqualTo(keptBatchIntent(batch.toList()))
        assertThat(keptBatchIntent(batch)).isNotEqualTo(keptBatchIntent(batch.take(1)))
        assertThat(keptBatchIntent(batch)).isNotEqualTo(keptBatchIntent(batch.reversed()))
    }
}
