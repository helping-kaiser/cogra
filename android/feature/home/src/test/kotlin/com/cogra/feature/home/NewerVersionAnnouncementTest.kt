package com.cogra.feature.home

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.Outcome
import com.cogra.domain.release.NewerVersionAnnouncer
import com.cogra.domain.release.Release
import com.cogra.domain.release.RunningVersion
import com.cogra.domain.testing.InMemoryAnnouncedReleaseStore
import com.cogra.domain.testing.ScriptedReleaseRegistry
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

/**
 * The feed's newer-version snackbar, one test per sidecar line that binds
 * the app (FeedNewerVersion.md; `<board>_<line>_<slug>`). A cold open is a
 * fresh [NewerVersionAnnouncer] over the device's same flag store; a return
 * to the foreground or a navigation back to the feed is the same announcer.
 */
@RunWith(RobolectricTestRunner::class)
class NewerVersionAnnouncementTest {

    @get:Rule
    val compose = createComposeRule()

    private fun release(version: String) =
        Release(version, listOf("What $version brings"), "https://example.test/v$version", Instant.EPOCH)

    private val behind = listOf(release("0.1.3"), release("0.1.2"), release("0.1.1"))
    private val flag = InMemoryAnnouncedReleaseStore()
    private var updates = 0

    private fun announcer(
        answer: Outcome<List<Release>> = Outcome.Success(behind),
        running: String = "0.1.2",
    ) = NewerVersionAnnouncer(ScriptedReleaseRegistry(answer), flag, RunningVersion(running))

    /** The feed destination: mounted while [onFeed], over the shell's one host. */
    @Composable
    private fun Shell(announcer: NewerVersionAnnouncer, onFeed: Boolean, host: SnackbarHostState) {
        CompositionLocalProvider(LocalSnackbarHostState provides host) {
            if (onFeed) {
                key(announcer) {
                    val viewModel = remember { NewerVersionViewModel(announcer) }
                    NewerVersionAnnouncement(onUpdateNow = { updates += 1 }, viewModel = viewModel)
                }
            }
            CograSnackbarHost(host)
        }
    }

    private fun coldOpen(announcer: NewerVersionAnnouncer): SnackbarHostState {
        val host = SnackbarHostState()
        compose.setContent { Shell(announcer, onFeed = true, host = host) }
        return host
    }

    private fun snackbarShows() = compose.waitUntil(timeoutMillis = 2_000) {
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true).isDisplayedSafely()
    }

    private fun SemanticsNodeInteraction.isDisplayedSafely(): Boolean =
        runCatching { fetchSemanticsNode() }.isSuccess

    private fun nothingShows(host: SnackbarHostState) {
        compose.waitForIdle()
        assertThat(host.currentSnackbarData).isNull()
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun feedNewerVersion_3_a_cold_open_feed_announces_a_newer_release_and_marks_it() {
        coldOpen(announcer())
        snackbarShows()
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true)
            .assertTextEquals("A newer version of CoGra is out.")
        compose.onNodeWithTag("feed.snackbar.action").assertTextEquals("Update now")
        compose.waitUntil(timeoutMillis = 2_000) { flag.value == "0.1.3" }
    }

    @Test
    fun feedNewerVersion_7_announces_without_regard_to_who_is_reading() {
        // The announcer reads no viewer: guests, applicants and members land on
        // the one feed destination and hear the same release.
        coldOpen(announcer())
        snackbarShows()
    }

    @Test
    fun feedNewerVersion_9_an_unlisted_running_version_announces_nothing() {
        val host = coldOpen(announcer(running = "0.2.0-dev"))
        nothingShows(host)
        assertThat(flag.value).isNull()
    }

    @Test
    fun feedNewerVersion_11_a_return_to_the_feed_in_the_same_process_announces_nothing() {
        val subject = announcer()
        val host = SnackbarHostState()
        var onFeed by mutableStateOf(true)
        compose.setContent { Shell(subject, onFeed, host) }
        snackbarShows()
        compose.onNodeWithTag("feed.snackbar.action").performClick()
        compose.waitUntil(timeoutMillis = 2_000) { host.currentSnackbarData == null }
        flag.value = null
        onFeed = false
        compose.waitForIdle()
        onFeed = true
        nothingShows(host)
    }

    @Test
    fun feedNewerVersion_13_an_already_announced_release_is_not_announced_again() {
        flag.value = "0.1.3"
        nothingShows(coldOpen(announcer()))
    }

    @Test
    fun feedNewerVersion_15_a_dismissed_announcement_never_comes_back() {
        val host = SnackbarHostState()
        var process by mutableStateOf(announcer())
        compose.setContent { Shell(process, onFeed = true, host = host) }
        snackbarShows()
        compose.waitUntil(timeoutMillis = 2_000) { flag.value == "0.1.3" }
        host.currentSnackbarData?.dismiss()
        compose.waitUntil(timeoutMillis = 2_000) { host.currentSnackbarData == null }
        // The next cold open: a new process over the device's same flag.
        process = announcer()
        nothingShows(host)
    }

    @Test
    fun feedNewerVersion_17_each_release_is_announced_at_most_once_and_a_newer_one_again() {
        flag.value = "0.1.3"
        coldOpen(announcer(Outcome.Success(listOf(release("0.1.4")) + behind)))
        snackbarShows()
        compose.waitUntil(timeoutMillis = 2_000) { flag.value == "0.1.4" }
    }

    @Test
    fun feedNewerVersion_19_update_now_in_the_app_opens_the_store_listing() {
        coldOpen(announcer())
        snackbarShows()
        compose.onNodeWithTag("feed.snackbar.action").performClick()
        compose.waitUntil(timeoutMillis = 2_000) { updates == 1 }
    }

    @Test
    fun feedNewerVersion_25_update_now_is_one_string_with_no_platform_noun() {
        coldOpen(announcer())
        snackbarShows()
        compose.onNodeWithTag("feed.snackbar.action").assertTextEquals("Update now")
    }

    @Test
    fun feedNewerVersion_29_the_announcement_waits_its_turn_behind_the_feeds_own() {
        val host = SnackbarHostState()
        val subject = announcer()
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                // A feed confirmation already standing keeps its place.
                LaunchedEffect(Unit) { host.showSnackbar("Link copied.") }
                NewerVersionAnnouncement(onUpdateNow = {}, viewModel = remember { NewerVersionViewModel(subject) })
                CograSnackbarHost(host)
            }
        }
        compose.waitUntil(timeoutMillis = 2_000) { host.currentSnackbarData?.visuals?.message == "Link copied." }
        // Queued behind it, not yet shown, so not yet marked.
        assertThat(flag.value).isNull()
        host.currentSnackbarData?.dismiss()
        snackbarShows()
        compose.waitUntil(timeoutMillis = 2_000) { flag.value == "0.1.3" }
    }

    @Test
    fun aFailedReadIsSilentAndLeavesTheFlagForTheNextColdOpen() {
        nothingShows(coldOpen(announcer(Outcome.Failed(IllegalStateException("offline")))))
        assertThat(flag.value).isNull()
    }
}
