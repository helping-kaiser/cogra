// WHERE THE APPLICANT'S STACK STANDS ITS ROWS (seam 464, 472): on the feed the
// drawn task cards are cards of the list — `ApplicantFeed.jsx:64-114` inside
// `FeedList` (`_shared.jsx:531-537`: no side padding, gap 8) — full width and
// 8dp apart, while every row that is not one of them keeps the list's 16dp
// gutter. On the own profile the host pads the stack and nothing moves.

package com.cogra.feature.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.UserProfile
import com.cogra.domain.invites.ApplicantApplication
import com.cogra.domain.invites.MyApplication
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ApplicantStackLayoutTest {

    @get:Rule
    val compose = createComposeRule()

    private fun applicant(progress: RegistrationProgress?, closed: Boolean = false) = HomeUiState(
        loading = false,
        applicant = true,
        profile = UserProfile("u", "noor", null, AccountState.APPLICANT, false, null),
        progress = progress,
        application = MyApplication(
            askLink = "5d9e7a41-b062-4c38-8e5f-1a4703cbd926",
            application = ApplicantApplication(
                id = "application-1",
                approvedAt = null,
                rejectedAt = if (closed) Instant.EPOCH else null,
                landedAt = null,
                approver = ActorRef("actor-mira", "mira"),
            ),
        ),
    )

    private val bothOwed = RegistrationProgress.AwaitingApproval(
        emailVerified = false,
        keyAttached = false,
        keyOnDevice = false,
    )

    /** The email still owed, the key done: the verify card over the application card. */
    private val verifyOwed = bothOwed.copy(keyAttached = true, keyOnDevice = true)

    /** The stack in a host [HOST] wide, as the feed's list or the profile's item hands it. */
    private fun render(state: HomeUiState, surface: ApplicationSurface = ApplicationSurface.FEED) {
        compose.setContent {
            Box(Modifier.width(HOST).testTag("host")) {
                StatusBanners(
                    state = state,
                    onResendEmailChange = {},
                    onResend = {},
                    onResumePending = {},
                    onStartKeyCeremony = {},
                    application = ApplicationCardActions(surface = surface),
                )
            }
        }
        compose.waitForIdle()
    }

    private fun bounds(tag: String): Rect =
        compose.onAllNodes(hasTestTag(tag), useUnmergedTree = true).fetchSemanticsNodes().single().boundsInRoot

    private fun px(dp: Dp): Float = with(compose.density) { dp.toPx() }

    @Test
    fun onTheFeedTheTaskCardsSpanTheListsWholeWidth() {
        render(applicant(bothOwed))
        val host = bounds("host")
        listOf("feed.verifyCard", "feed.keyCard").forEach { card ->
            val b = bounds(card)
            assertThat(b.left).isEqualTo(host.left)
            assertThat(b.width).isEqualTo(host.width)
        }
    }

    @Test
    fun onTheFeedTwoTaskCardsStandEightApartInTheirOrder() {
        render(applicant(bothOwed))
        val verify = bounds("feed.verifyCard")
        val key = bounds("feed.keyCard")
        // The verify card first, the key card under it (ApplicantFeed.jsx:65, :101).
        assertThat(verify.bottom).isAtMost(key.top)
        assertThat(key.top - verify.bottom).isWithin(0.5f).of(px(8.dp))
    }

    @Test
    fun onTheFeedTheLandingCardSpansTheWidthToo() {
        render(applicant(RegistrationProgress.AwaitingLanding))
        assertThat(bounds("feed.application").width).isEqualTo(bounds("host").width)
    }

    @Test
    fun onTheFeedALineThatIsNoCardKeepsTheGutter() {
        render(applicant(RegistrationProgress.Failed(IOException("lost"))))
        val line = bounds("home_application_offline")
        assertThat(line.left - bounds("host").left).isWithin(0.5f).of(px(16.dp))
        assertThat(bounds("host").right - line.right).isAtLeast(px(16.dp) - 0.5f)
    }

    @Test
    fun onTheFeedTheLoadingLineKeepsTheGutter() {
        render(applicant(progress = null))
        // The check's `Loading…` stands only once it is 200ms late (ApplicantChecking).
        compose.mainClock.advanceTimeBy(CHECKING_AFTER_MS + FRAME_MS)
        assertThat(bounds("home_status_loading").left - bounds("host").left).isWithin(0.5f).of(px(16.dp))
    }

    @Test
    fun onTheFeedTheClosedCardStandsEightUnderTheVerifyCard() {
        render(applicant(verifyOwed, closed = true))
        val verify = bounds("feed.verifyCard")
        val closed = bounds("feed.application")
        assertThat(closed.width).isEqualTo(bounds("host").width)
        assertThat(closed.top - verify.bottom).isWithin(0.5f).of(px(8.dp))
    }

    @Test
    fun onTheProfileTheStackIsTheHostsToPadAndNothingMoves() {
        render(applicant(verifyOwed, closed = true), ApplicationSurface.PROFILE)
        val host = bounds("host")
        // Unnamed there but for the profile's own card: the verify card by its container's tag.
        val verify = bounds("home_verify")
        val closed = bounds("profile.application:closed")
        assertThat(verify.left).isEqualTo(host.left)
        assertThat(verify.width).isEqualTo(host.width)
        assertThat(closed.top - verify.bottom).isWithin(0.5f).of(px(16.dp))
    }

    @Test
    fun onTheProfileALineStandsAtTheHostsEdge() {
        render(applicant(RegistrationProgress.Failed(IOException("lost"))), surface = ApplicationSurface.PROFILE)
        assertThat(bounds("home_application_offline").left).isEqualTo(bounds("host").left)
    }

    private companion object {
        val HOST = 400.dp
        const val FRAME_MS = 16L
    }
}
