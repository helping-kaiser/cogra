package com.cogra.domain

import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Test

/**
 * The log's gate. Silence with no sink is the release behaviour, so it
 * is the case worth pinning: a build that installs nothing must also
 * *build* nothing — the message lambda is the expensive half.
 */
class CograLogTest {

    @After
    fun tearDown() = CograLog.uninstall()

    @Test
    fun writesNothingAndBuildsNothingWithoutASink() {
        CograLog.uninstall()
        var built = 0

        CograLog.w("test", IllegalStateException("boom")) {
            built += 1
            "a message"
        }

        assertThat(CograLog.enabled).isFalse()
        assertThat(built).isEqualTo(0)
    }

    @Test
    fun handsTheSinkTheTagMessageAndCause() {
        val lines = mutableListOf<Triple<String, String, Throwable?>>()
        CograLog.install { tag, message, cause -> lines += Triple(tag, message, cause) }
        val cause = IllegalStateException("boom")

        CograLog.w("Apollo", cause) { "feed failed in transport" }
        CograLog.w("Apollo") { "no cause here" }

        assertThat(CograLog.enabled).isTrue()
        assertThat(lines).containsExactly(
            Triple("Apollo", "feed failed in transport", cause),
            Triple("Apollo", "no cause here", null),
        ).inOrder()
    }

    @Test
    fun uninstallPutsItBack() {
        CograLog.install { _, _, _ -> error("should not be reached") }
        CograLog.uninstall()

        CograLog.w("test") { "nothing listens" }

        assertThat(CograLog.enabled).isFalse()
    }
}
