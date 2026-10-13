package com.cogra.feature.settings

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.release.Release
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * What's new and its behind state, one test per sidecar line
 * (WhatsNew.md, WhatsNewBehind.md; `<board>_<line>_<slug>`).
 */
@RunWith(RobolectricTestRunner::class)
class WhatsNewScreenTest {

    @get:Rule
    val compose = createComposeRule()

    // Noon in the reader's own zone, so the drawn date holds wherever the test runs.
    private fun release(version: String, day: Int, notes: List<String> = listOf("What $version brings")) = Release(
        version = version,
        notes = notes,
        patchNotesUrl = "https://github.com/helping-kaiser/cogra/releases/tag/v$version",
        releasedAt = LocalDateTime.of(2026, 9, day, 12, 0).atZone(ZoneId.systemDefault()).toInstant(),
    )

    private val list = listOf(
        release("0.1.3", 30),
        release("0.1.2", 28, listOf("First line.", "Second line.")),
        release("0.1.1", 25),
    )

    private val opened = mutableListOf<String>()
    private var updates = 0
    private var backs = 0

    private fun open(running: String, releases: List<Release> = list) {
        compose.setContent {
            WhatsNewScreen(
                state = WhatsNewUiState.Ready(releases, running),
                onBack = { backs += 1 },
                onUpdateNow = { updates += 1 },
                onOpenRelease = { opened += it },
            )
        }
    }

    private fun keyed(path: String, key: String) = compose.onNodeWithTag("$path:$key", useUnmergedTree = true)

    private fun dateline(key: String): String =
        keyed("whatsNew.dateline", key).fetchSemanticsNode().config.getOrNull(SemanticsProperties.Text)
            .orEmpty()
            .joinToString("")

    private fun datelineTags() = listOf("0-1-3", "0-1-2", "0-1-1").map(::dateline)

    @Test
    fun whatsNew_3_whole_releases_newest_first_one_card_each_then_the_footnote() {
        open("0.1.3")
        listOf("0-1-3", "0-1-2", "0-1-1").forEach { keyed("whatsNew.release", it).assertExists() }
        compose.onNodeWithTag("whatsNew.footnote").performScrollTo().assertTextEquals("Newest first.")
        assertThat(datelineTags().map { it.substringBefore(" ·") })
            .containsExactly("Version 0.1.3", "Version 0.1.2", "Version 0.1.1")
            .inOrder()
    }

    @Test
    fun whatsNew_5_each_dateline_reads_version_and_date() {
        open("0.1.3")
        assertThat(datelineTags()[1]).isEqualTo("Version 0.1.2 · 28.09.2026")
    }

    @Test
    fun whatsNew_7_the_running_version_carries_installed() {
        open("0.1.3")
        assertThat(datelineTags()[0]).isEqualTo("Version 0.1.3 · installed · 30.09.2026")
    }

    @Test
    fun whatsNew_9_every_other_dateline_carries_no_word() {
        open("0.1.3")
        assertThat(datelineTags().drop(1))
            .containsExactly("Version 0.1.2 · 28.09.2026", "Version 0.1.1 · 25.09.2026")
            .inOrder()
    }

    @Test
    fun whatsNew_11_a_release_is_its_own_notes_never_a_difference() {
        open("0.1.3")
        compose.onNodeWithText("First line.").assertExists()
        compose.onNodeWithText("Second line.").assertExists()
    }

    @Test
    fun whatsNew_13_every_card_ends_in_its_door_named_for_its_release() {
        open("0.1.3")
        listOf("0.1.3", "0.1.2", "0.1.1").forEach { version ->
            keyed("whatsNew.release.door", version.replace('.', '-'))
                .assertTextEquals("See it on GitHub")
                .assertContentDescriptionEquals("See version $version on GitHub")
        }
    }

    @Test
    fun whatsNew_15_the_door_opens_the_releases_page_never_the_download() {
        open("0.1.3")
        keyed("whatsNew.release.door", "0-1-2").performScrollTo().performClick()
        assertThat(opened).containsExactly("https://github.com/helping-kaiser/cogra/releases/tag/v0.1.2")
        assertThat(updates).isEqualTo(0)
    }

    @Test
    fun whatsNew_17_no_newer_line_stands_when_the_running_version_is_the_newest() {
        open("0.1.3")
        compose.onNodeWithTag("whatsNew.newerLine").assertDoesNotExist()
    }

    @Test
    fun whatsNew_19_an_unlisted_running_version_wears_nothing_and_no_line_stands() {
        open("0.2.0-dev")
        assertThat(datelineTags()).containsExactly(
            "Version 0.1.3 · 30.09.2026",
            "Version 0.1.2 · 28.09.2026",
            "Version 0.1.1 · 25.09.2026",
        ).inOrder()
        compose.onNodeWithTag("whatsNew.newerLine").assertDoesNotExist()
    }

    @Test
    fun whatsNew_21_no_bottom_bar_and_the_back_arrow_stays() {
        open("0.1.3")
        compose.onNodeWithTag("whatsNew.header.back").assertExists()
        compose.onNodeWithTag("bottomBar").assertDoesNotExist()
    }

    @Test
    fun whatsNew_23_the_back_arrow_returns_to_settings() {
        open("0.1.3")
        compose.onNodeWithTag("whatsNew.header.back").assertContentDescriptionEquals("Back to settings").performClick()
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun whatsNewBehind_3_one_quiet_line_atop_the_list_with_newest_and_installed() {
        open("0.1.2")
        compose.onNodeWithTag("whatsNew.newerLine").assertExists()
        compose.onNodeWithText("A newer version exists. ").assertExists()
        assertThat(datelineTags()).containsExactly(
            "Version 0.1.3 · newest · 30.09.2026",
            "Version 0.1.2 · installed · 28.09.2026",
            "Version 0.1.1 · 25.09.2026",
        ).inOrder()
    }

    @Test
    fun whatsNewBehind_5_more_than_one_behind_only_the_head_reads_newest() {
        open("0.1.1")
        assertThat(datelineTags()).containsExactly(
            "Version 0.1.3 · newest · 30.09.2026",
            "Version 0.1.2 · 28.09.2026",
            "Version 0.1.1 · installed · 25.09.2026",
        ).inOrder()
        compose.onNodeWithTag("whatsNew.newerLine.update").assertContentDescriptionEquals("Update to version 0.1.3")
    }

    @Test
    fun whatsNewBehind_7_no_dateline_reads_current() {
        open("0.1.1")
        datelineTags().forEach { assertThat(it).doesNotContain("current") }
    }

    @Test
    fun whatsNewBehind_9_update_now_is_named_for_the_newer_version() {
        open("0.1.2")
        compose.onNodeWithTag("whatsNew.newerLine.update")
            .assertTextEquals("Update now")
            .assertContentDescriptionEquals("Update to version 0.1.3")
    }

    @Test
    fun whatsNewBehind_11_the_line_and_the_newer_release_are_the_only_changes() {
        open("0.1.2")
        listOf("0-1-3", "0-1-2", "0-1-1").forEach { keyed("whatsNew.release", it).assertExists() }
        compose.onNodeWithTag("whatsNew.footnote").performScrollTo().assertExists()
    }

    @Test
    fun whatsNewBehind_13_every_other_dateline_carries_no_word() {
        val longer = listOf(release("0.1.4", 30), release("0.1.3", 29), release("0.1.2", 28), release("0.1.1", 27))
        open("0.1.1", longer)
        val words = listOf("0-1-4", "0-1-3", "0-1-2", "0-1-1").map { key ->
            dateline(key).split(" · ").drop(1).dropLast(1)
        }
        assertThat(words)
            .containsExactly(listOf("newest"), emptyList<String>(), emptyList<String>(), listOf("installed"))
            .inOrder()
    }

    @Test
    fun whatsNewBehind_15_update_now_in_the_app_opens_the_store_and_never_github() {
        open("0.1.2")
        compose.onNodeWithTag("whatsNew.newerLine.update").performClick()
        assertThat(updates).isEqualTo(1)
        assertThat(opened).isEmpty()
    }

    @Test
    fun whatsNewBehind_19_every_card_keeps_its_door_the_newest_included() {
        open("0.1.2")
        listOf("0-1-3", "0-1-2", "0-1-1").forEach { keyed("whatsNew.release.door", it).assertExists() }
    }

    @Test
    fun whatsNewBehind_21_the_door_opens_the_releases_page_never_the_download() {
        open("0.1.2")
        keyed("whatsNew.release.door", "0-1-3").performClick()
        assertThat(opened).containsExactly("https://github.com/helping-kaiser/cogra/releases/tag/v0.1.3")
        assertThat(updates).isEqualTo(0)
    }

    @Test
    fun whatsNewBehind_23_the_back_arrow_returns_to_settings() {
        open("0.1.2")
        compose.onNodeWithTag("whatsNew.header.back").performClick()
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun aReadThatFailsSaysTheServerCannotBeReached() {
        compose.setContent {
            WhatsNewScreen(state = WhatsNewUiState.Failed, onBack = {}, onUpdateNow = {}, onOpenRelease = {})
        }
        compose.onNodeWithTag("whats_new_error")
            .assertTextEquals("Can't reach the server. Check your connection and try again.")
    }
}
