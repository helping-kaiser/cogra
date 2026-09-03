package com.cogra.domain.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The schedule a dropped part is re-sent on.
 *
 * The point of the numbers is to outlast a blip: a ~90 MiB upload used
 * to die outright when one connection dropped anywhere in a single long
 * POST, and the whole retry budget has to cover Wi-Fi going away and
 * coming back without the author seeing an error.
 */
class UploadRetryTest {

    @Test
    fun theFirstTryDoesNotWait() {
        assertThat(UploadRetry.delayMs(attempt = 1, jitter = 0.0)).isEqualTo(0)
        assertThat(UploadRetry.delayMs(attempt = 1, jitter = 1.0)).isEqualTo(0)
    }

    @Test
    fun theWaitDoublesUntilItIsCapped() {
        // Midpoint roll, so the doubling itself is visible.
        val waits = (2..UploadRetry.MAX_ATTEMPTS).map { UploadRetry.delayMs(it, jitter = 1.0) }
        assertThat(waits).containsExactly(1_000L, 2_000L, 4_000L, 8_000L, 16_000L).inOrder()

        // And it stops there rather than growing without bound.
        assertThat(UploadRetry.delayMs(99, jitter = 1.0)).isEqualTo(UploadRetry.MAX_DELAY_MS)
    }

    @Test
    fun halfOfEachWaitIsRandomAndHalfIsNot() {
        // Equal jitter: full jitter can collapse to nearly zero, which
        // re-sends into a network that is still down.
        val lowest = UploadRetry.delayMs(attempt = 3, jitter = 0.0)
        val highest = UploadRetry.delayMs(attempt = 3, jitter = 1.0)

        assertThat(lowest).isEqualTo(1_000L)
        assertThat(highest).isEqualTo(2_000L)
        assertThat(UploadRetry.delayMs(attempt = 3, jitter = 0.5)).isIn(lowest..highest)
    }

    @Test
    fun aRollOutsideTheUnitRangeIsClamped() {
        assertThat(UploadRetry.delayMs(3, jitter = -5.0))
            .isEqualTo(UploadRetry.delayMs(3, jitter = 0.0))
        assertThat(UploadRetry.delayMs(3, jitter = 5.0))
            .isEqualTo(UploadRetry.delayMs(3, jitter = 1.0))
    }

    @Test
    fun thePartIsRetriedUntilTheBudgetIsSpent() {
        (1 until UploadRetry.MAX_ATTEMPTS).forEach {
            assertThat(UploadRetry.retryable(it)).isTrue()
        }
        assertThat(UploadRetry.retryable(UploadRetry.MAX_ATTEMPTS)).isFalse()
    }

    @Test
    fun theWholeBudgetOutlastsAWifiHandover() {
        // Worst case is the sum of the maximum waits; the point is that
        // it is tens of seconds, not hundreds of milliseconds.
        val worst = (1..UploadRetry.MAX_ATTEMPTS).sumOf { UploadRetry.delayMs(it, jitter = 1.0) }
        assertThat(worst).isAtLeast(30_000L)
    }
}
