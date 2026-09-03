package com.cogra.domain.media

/**
 * How long to wait before trying a part again.
 *
 * **Why this and not WorkManager.** Android's own guidance draws the
 * line at persistence: "WorkManager is not intended for in-process
 * background work that can safely be terminated if the app process goes
 * away… For in-process work that doesn't require persistence, you should
 * use coroutines or other asynchronous mechanisms instead"
 * (developer.android.com/develop/background-work/background-tasks). An
 * upload here is exactly that — the composer holds the transcoded file
 * and the chosen cover in memory, the author is watching the progress,
 * and the server offers no way to ask what a lost session had already
 * received, so a killed process starts a fresh session regardless.
 * Handing the work to WorkManager would buy persistence the rest of the
 * flow cannot honour, and would move the retry out of the screen that
 * has to report it.
 *
 * So the retry is a coroutine loop, with the shape WorkManager itself
 * uses: exponential backoff, and jitter — "add randomness (jitter) to
 * any network requests" (developer.android.com/topic/performance/power/
 * network/action-app-traffic), the same reason WorkManager's own delays
 * are documented as inexact rather than exact.
 *
 * **Equal jitter rather than full.** Half the computed delay is always
 * waited and half is randomised: full jitter can collapse to nearly
 * zero, which re-sends a part into a network that is still down and
 * spends an attempt for nothing.
 */
object UploadRetry {

    /**
     * How many times one part may be sent before the upload gives up.
     *
     * Six attempts spend between 15 and 31 seconds waiting, which is
     * chosen to outlast the thing this exists for: a handover, a lift,
     * or Wi-Fi dropping and coming back. Anything longer is not a blip,
     * and the author would rather be told than watch a frozen bar.
     */
    const val MAX_ATTEMPTS = 6

    /** The first wait, doubling from there. */
    const val BASE_DELAY_MS = 1_000L

    /** Where the doubling stops. */
    const val MAX_DELAY_MS = 16_000L

    /**
     * The wait before [attempt], which is 1-based — the first try does
     * not wait at all.
     *
     * [jitter] is a 0..1 roll, taken by the caller so this stays a
     * function of its arguments and the schedule can be pinned in a
     * test.
     */
    fun delayMs(attempt: Int, jitter: Double): Long {
        if (attempt <= 1) return 0L
        var backoff = BASE_DELAY_MS
        repeat(attempt - 2) {
            if (backoff < MAX_DELAY_MS) backoff *= 2
        }
        val capped = backoff.coerceAtMost(MAX_DELAY_MS)
        val half = capped / 2
        return half + (jitter.coerceIn(0.0, 1.0) * half).toLong()
    }

    /** Whether another attempt is allowed after [attempt] just failed. */
    fun retryable(attempt: Int): Boolean = attempt < MAX_ATTEMPTS
}
