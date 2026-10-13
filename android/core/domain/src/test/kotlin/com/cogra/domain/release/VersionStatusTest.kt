package com.cogra.domain.release

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneOffset

class VersionStatusTest {

    private fun release(version: String, day: Int) = Release(
        version = version,
        notes = listOf("What $version brings"),
        patchNotesUrl = "https://github.com/helping-kaiser/cogra/releases/tag/v$version",
        releasedAt = LocalDateTime.of(2026, 9, day, 12, 0).toInstant(ZoneOffset.UTC),
    )

    // Newest first, as the registry serves them.
    private val list = listOf(release("0.1.3", 30), release("0.1.2", 28), release("0.1.1", 25), release("0.1.0", 20))

    private fun words(running: String) = versionStatus(list, running).let { status ->
        list.indices.map { datelineWord(status, it) }
    }

    @Test
    fun theNewestRunningVersionIsNotBehind() {
        assertThat(versionStatus(list, "0.1.3")).isEqualTo(VersionStatus(false, null, 0))
        assertThat(words("0.1.3")).containsExactly(DatelineWord.INSTALLED, null, null, null).inOrder()
    }

    @Test
    fun aNewerReleaseAboveTheRunningOneIsBehind() {
        val status = versionStatus(list, "0.1.2")
        assertThat(status.behind).isTrue()
        assertThat(status.newest?.version).isEqualTo("0.1.3")
        assertThat(words("0.1.2")).containsExactly(DatelineWord.NEWEST, DatelineWord.INSTALLED, null, null).inOrder()
    }

    @Test
    fun moreThanOneBehindOnlyTheHeadReadsNewest() {
        assertThat(versionStatus(list, "0.1.0").newest?.version).isEqualTo("0.1.3")
        assertThat(words("0.1.0")).containsExactly(DatelineWord.NEWEST, null, null, DatelineWord.INSTALLED).inOrder()
    }

    @Test
    fun anUnlistedRunningVersionIsNotBehindAndWearsNothing() {
        for (running in listOf("0.2.0-dev", "")) {
            assertThat(versionStatus(list, running)).isEqualTo(VersionStatus(false, null, -1))
            assertThat(words(running)).containsExactly(null, null, null, null)
        }
    }

    @Test
    fun theRegistryOrderDecidesNeverTheVersionString() {
        val shipped = listOf(release("0.9.0", 29), release("0.10.0", 28))
        assertThat(versionStatus(shipped, "0.10.0").newest?.version).isEqualTo("0.9.0")
    }

    @Test
    fun theDatelineIsTheVersionItsWordAndItsDate() {
        val r = release("0.1.2", 30)
        val installed = datelineText(r, DatelineWord.INSTALLED, ZoneOffset.UTC)
        assertThat(installed).isEqualTo("Version 0.1.2 · installed · 30.09.2026")
        assertThat(datelineText(r, null, ZoneOffset.UTC)).isEqualTo("Version 0.1.2 · 30.09.2026")
        assertThat(DatelineWord.entries.map { it.spoken }).doesNotContain("current")
    }

    @Test
    fun aReleaseIsKeyedByItsNormalizedVersion() {
        assertThat(releaseKey("0.1.2")).isEqualTo("0-1-2")
        assertThat(releaseKey("1.0.0-RC.1")).isEqualTo("1-0-0-rc-1")
    }

    @Test
    fun theAnnouncedReleaseIsTheNewestNotYetAnnounced() {
        assertThat(releaseToAnnounce(list, "0.1.2", null)?.version).isEqualTo("0.1.3")
        assertThat(releaseToAnnounce(list, "0.1.2", "0.1.3")).isNull()
        assertThat(releaseToAnnounce(list, "0.1.3", null)).isNull()
        assertThat(releaseToAnnounce(list, "0.2.0-dev", null)).isNull()
    }
}
