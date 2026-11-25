// The applicant's progress, not yet read (design/readme.md "Loading";
// EmptyState.prompt.md): nothing under 200ms, then `Loading…` in the
// stack's place, never a spinner; a read that starts again times its own.

package com.cogra.feature.home

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.AccountState
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.RegistrationProgress
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ApplicantCheckingTest {

    @get:Rule
    val compose = createComposeRule()

    private var state by mutableStateOf(checking())

    private fun checking(progress: RegistrationProgress? = null) = HomeUiState(
        loading = false,
        applicant = true,
        profile = UserProfile("u", "joiner", null, AccountState.APPLICANT, false, null),
        progress = progress,
    )

    private fun render() {
        compose.mainClock.autoAdvance = false
        compose.setContent {
            StatusBanners(
                state = state,
                onResendEmailChange = {},
                onResend = {},
                onResumePending = {},
                onStartKeyCeremony = {},
                application = ApplicationCardActions(surface = ApplicationSurface.FEED, onPutAway = {}),
            )
        }
    }

    /** Exactly [ms] of virtual time, never rounded up to a whole frame. */
    private fun upTo(ms: Long) {
        compose.mainClock.advanceTimeBy(ms, ignoreFrameDuration = true)
    }

    private fun frame() {
        compose.mainClock.advanceTimeByFrame()
    }

    /** Up to [ms] since the read's frame, the last frame drawn at exactly [ms]. */
    private fun drawnAt(ms: Long) {
        upTo(ms - FRAME_MS)
        frame()
    }

    private fun theWaitEnds() {
        upTo(1)
        frame()
    }

    private fun hand(next: HomeUiState) {
        state = next
        Snapshot.sendApplyNotifications()
        frame()
    }

    private val loading get() = compose.onAllNodesWithTag("home_status_loading")

    private val aSpinner = SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo)

    private fun noSpinner() {
        compose.onAllNodes(aSpinner, useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun nothingStandsUnder200msThenLoading() {
        render()
        drawnAt(CHECKING_AFTER_MS - 1)
        loading.assertCountEquals(0)
        noSpinner()
        theWaitEnds()
        compose.onNodeWithTag("home_status_loading").assertTextEquals("Loading…")
        noSpinner()
    }

    @Test
    fun anAnswerInsideTheWaitNeverShowsLoading() {
        render()
        drawnAt(CHECKING_AFTER_MS / 2)
        hand(checking(RegistrationProgress.AwaitingLanding))
        drawnAt(CHECKING_AFTER_MS)
        loading.assertCountEquals(0)
        noSpinner()
        compose.onAllNodesWithTag("feed.application").assertCountEquals(1)
    }

    @Test
    fun aReadThatStartsAgainTimesItsOwnWait() {
        render()
        drawnAt(CHECKING_AFTER_MS / 2)
        hand(checking(RegistrationProgress.AwaitingLanding))
        // The progress is asked again: its own 200ms from this frame, never
        // the first read's clock, which ran out 100ms ago.
        upTo(CHECKING_AFTER_MS - 50)
        hand(checking(null))
        drawnAt(CHECKING_AFTER_MS / 2)
        loading.assertCountEquals(0)
        compose.onAllNodesWithTag("feed.application").assertCountEquals(0)
        drawnAt(CHECKING_AFTER_MS / 2 + FRAME_MS)
        compose.onNodeWithTag("home_status_loading").assertTextEquals("Loading…")
        noSpinner()
    }

    private companion object {
        const val FRAME_MS = 16L
    }
}
