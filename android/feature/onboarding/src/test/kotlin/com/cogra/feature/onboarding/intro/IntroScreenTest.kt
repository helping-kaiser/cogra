// The intro's frame under Robolectric, its sidecars' lines bound to the
// registered names (nodes.json `OnboardingVouch`, prefix `onboarding`).

package com.cogra.feature.onboarding.intro

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeRight
import com.cogra.domain.ActorRef
import com.cogra.feature.onboarding.R
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class IntroScreenTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val mira = ActorRef("u2", "mira", "Mira Voss")

    private var skips = 0
    private var nexts = 0

    // A rule composes once per test, so the card shown is state the test moves.
    private val shown = mutableStateOf<IntroUiState?>(null)

    private fun show(card: IntroCard, inviter: ActorRef? = mira) {
        val first = shown.value == null
        shown.value = IntroUiState(card = card, inviter = inviter)
        if (first) {
            compose.setContent {
                shown.value?.let { state ->
                    IntroScreen(state = state, onSkip = { skips += 1 }, onNext = { nexts += 1 })
                }
            }
        }
        compose.waitForIdle()
    }

    private fun string(id: Int, vararg args: Any): String = compose.activity.getString(id, *args)

    @Test
    fun everyCardCarriesSkipTheWordsTheDotsAndItsButton() {
        IntroCard.entries.forEach { card ->
            show(card)
            listOf("skip", "title", "body", "dots", "next", "stage").forEach { part ->
                compose.onNodeWithTag("onboarding.$part").assertExists()
            }
        }
    }

    @Test
    fun theDotsAreAnIndicatorSpokenAsTheStep() {
        IntroCard.entries.forEach { card ->
            show(card)
            compose.onNodeWithTag("onboarding.dots")
                .assert(
                    SemanticsMatcher.expectValue(
                        SemanticsProperties.ContentDescription,
                        listOf(string(R.string.intro_step, card.ordinal + 1, INTRO_STEPS)),
                    ),
                )
                .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
        }
    }

    @Test
    fun skipAndNextAreTheCardsLiveControls() {
        show(IntroCard.Shape)
        compose.onNodeWithTag("onboarding.skip").performClick()
        compose.onNodeWithTag("onboarding.next").performClick()
        assertThat(skips).isEqualTo(1)
        assertThat(nexts).isEqualTo(1)
    }

    @Test
    fun aSwipeMovesNothing() {
        show(IntroCard.Public)
        compose.onRoot().performTouchInput { swipeLeft() }
        compose.onRoot().performTouchInput { swipeRight() }
        assertThat(nexts).isEqualTo(0)
        assertThat(skips).isEqualTo(0)
    }

    @Test
    fun theLastCardsButtonReadsStartReading() {
        show(IntroCard.Vouch)
        compose.onNodeWithTag("onboarding.next").assertTextEquals(string(R.string.intro_start_reading))
        show(IntroCard.Layers)
        compose.onNodeWithTag("onboarding.next").assertTextEquals(string(R.string.intro_next))
    }

    @Test
    fun theFifthCardNamesTheReadersOwnInviter() {
        show(IntroCard.Vouch)
        compose.onNodeWithTag("onboarding.stage.inviter").assertExists()
        compose.onNodeWithTag("onboarding.stage.inviterCaption").assertTextEquals("@mira")
        compose.onNodeWithTag("onboarding.body").assertTextEquals(string(R.string.intro_vouch_body, "mira"))
        listOf("you", "youRing", "youCaption").forEach {
            compose.onNodeWithTag("onboarding.stage.$it").assertExists()
        }
    }

    @Test
    fun withNoInviterTheFifthCardNamesNoOne() {
        show(IntroCard.Vouch, inviter = null)
        compose.onNodeWithTag("onboarding.stage.inviter").assertDoesNotExist()
        compose.onNodeWithTag("onboarding.body").assertDoesNotExist()
        compose.onNodeWithTag("onboarding.stage.you").assertExists()
    }
}
