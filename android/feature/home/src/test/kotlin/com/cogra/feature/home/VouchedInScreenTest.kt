package com.cogra.feature.home

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.cogra.core.designsystem.v2.token.Duration
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The ceremony (VouchedIn.md); the web's twin is `vouched-in-view.test.tsx`. */
// The drawn frame: a phone tall enough for the sky and the words both.
@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class VouchedInScreenTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var toFeed = 0

    private fun render(still: Boolean = false) {
        compose.setContent {
            VouchedInScreen(
                handle = "mira",
                name = "Mira Voss",
                avatarUrl = null,
                onGoToFeed = { toFeed++ },
                still = still,
            )
        }
    }

    private fun stage(name: CeremonyStage) =
        SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, name.name)

    // VouchedIn.md:7, :9 — one control, the drawn words.
    @Test
    fun theCeremonyHasOneControlAndNoBackOrBar() {
        render(still = true)
        compose.onNodeWithTag("vouchedIn.title").assertTextEquals("You're part of the sky now.")
        compose.onNodeWithTag("vouchedIn.body").assertTextEquals(
            "Your opinion on @mira is signed, and the way is open both ways. " +
                "The feed you see from here is your own.",
        )
        compose.onNodeWithTag("vouchedIn.onward").assertTextEquals("Go to your feed")
        compose.onNodeWithTag("vouchedIn.sky").assertExists()
        compose.onNodeWithTag("page_header_back").assertDoesNotExist()
    }

    // VouchedIn.md:11-23 — offsets are sums of the motion tokens.
    @Test
    fun theCeremonyPhasesRunOnTheirTokens() {
        assertThat(CeremonyTimeline.POINT).isEqualTo(Duration.NAV_FORWARD)
        assertThat(CeremonyTimeline.HALO).isEqualTo(Duration.NAV_FORWARD + Duration.MEDIUM_2)
        assertThat(CeremonyTimeline.EDGE).isEqualTo(Duration.NAV_FORWARD + 2 * Duration.MEDIUM_2)
        assertThat(CeremonyTimeline.WORDS).isEqualTo(Duration.NAV_FORWARD + Duration.MEDIUM_2 + Duration.LONG_2)
        assertThat(CeremonyTimeline.LANDED).isEqualTo(CeremonyTimeline.WORDS + Duration.MEDIUM_4)
        assertThat(listOf(CeremonyTimeline.POINT, CeremonyTimeline.HALO, CeremonyTimeline.EDGE))
            .containsExactly(300, 600, 900).inOrder()
        assertThat(CeremonyTimeline.WORDS).isEqualTo(1100)
        assertThat(CeremonyTimeline.LANDED).isEqualTo(1500)
    }

    // VouchedIn.md:27, :33 — inert until the words land, then the own feed.
    @Test
    fun goToYourFeedIsInertUntilTheWordsLand() {
        compose.mainClock.autoAdvance = false
        render()
        compose.mainClock.advanceTimeBy(CeremonyTimeline.WORDS.toLong() + 50)
        compose.onNodeWithTag("vouchedIn").assert(stage(CeremonyStage.WORDS))
        // A press in the motion completes it and is spent there.
        compose.onNodeWithTag("vouchedIn.onward").performClick()
        assertThat(toFeed).isEqualTo(0)
        compose.onNodeWithTag("vouchedIn").assert(stage(CeremonyStage.LANDED))
        compose.onNodeWithTag("vouchedIn.onward").performClick()
        assertThat(toFeed).isEqualTo(1)
    }

    @Test
    fun theWordsLandOnTheirOwnAt1500ms() {
        compose.mainClock.autoAdvance = false
        render()
        compose.mainClock.advanceTimeBy(CeremonyTimeline.LANDED.toLong() + 50)
        compose.onNodeWithTag("vouchedIn").assert(stage(CeremonyStage.LANDED))
        compose.onNodeWithTag("vouchedIn.onward").performClick()
        assertThat(toFeed).isEqualTo(1)
    }

    // VouchedIn.md:29 — a tap completes the ceremony at once.
    @Test
    fun aTapCompletesTheCeremonyAtOnce() {
        compose.mainClock.autoAdvance = false
        render()
        compose.mainClock.advanceTimeBy(16)
        compose.onNodeWithTag("vouchedIn").assert(stage(CeremonyStage.ARRIVING))
        compose.onNodeWithTag("vouchedIn.sky").performTouchInput { click() }
        compose.mainClock.advanceTimeBy(16)
        compose.onNodeWithTag("vouchedIn").assert(stage(CeremonyStage.LANDED))
        compose.onNodeWithTag("vouchedIn.onward").performClick()
        assertThat(toFeed).isEqualTo(1)
    }

    // VouchedIn.md:31 — reduced motion arrives whole.
    @Test
    fun reducedMotionArrivesWhole() {
        render(still = true)
        compose.onNodeWithTag("vouchedIn").assert(stage(CeremonyStage.LANDED))
        compose.onNodeWithTag("vouchedIn.onward").performClick()
        assertThat(toFeed).isEqualTo(1)
    }

    // VouchedIn.md:35 — Android Back is Go to your feed.
    @Test
    fun androidBackOnTheCeremonyGoesToTheFeed() {
        render(still = true)
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        assertThat(toFeed).isEqualTo(1)
    }
}
