package com.cogra.core.designsystem

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val TAG = "profile"

/**
 * The empty sign's ask against its master (EmptySignConfirm.jsx;
 * empty-sign.card.html; copy-voice *The empty sign*).
 */
@RunWith(RobolectricTestRunner::class)
class EmptySignConfirmTest {

    @get:Rule
    val compose = createComposeRule()

    private var confirmed = 0
    private var dismissed = 0

    private fun show(
        prompt: EmptySignPrompt = EmptySignPrompt(),
        targetLabel: String? = "@ada",
        vouchIn: Boolean = false,
    ) {
        compose.setContent {
            EmptySignConfirm(
                prompt = prompt,
                onConfirm = { confirmed++ },
                onDismiss = { dismissed++ },
                testTagPrefix = TAG,
                targetLabel = targetLabel,
                vouchIn = vouchIn,
            )
        }
    }

    @Test
    fun itAsksWhetherAnEmptyOpinionWasMeantInTheMastersWords() {
        show()
        compose.onNodeWithTag("${TAG}_empty_sign_title").assertTextEquals("Sign an empty opinion?")
        compose.onNodeWithTag("${TAG}_empty_sign_body")
            .assertTextEquals("This says nothing about @ada, shapes no feed, and leaves you where you are.")
        compose.onNodeWithTag("${TAG}_empty_sign_cost").assertTextEquals("It signs 1 thing, paid on its own.")
        compose.onNodeWithTag("${TAG}_empty_sign_failed").assertDoesNotExist()
    }

    @Test
    fun itNeverBlocksSetItAnywayIsTheActAndKeepItTheSafeAnswerOnTheRight() {
        show()
        compose.onNodeWithTag("${TAG}_empty_sign_confirm").assertTextEquals("Set it anyway").assertIsEnabled()
            .performClick()
        assertThat(confirmed).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_empty_sign_keep").assertTextEquals("Keep it").performClick()
        assertThat(dismissed).isEqualTo(1)
        // The destructive-dialog rule, as SeveranceConfirm: the safe answer
        // holds the right-hand slot, the act a text button on the left.
        val act = compose.onNodeWithTag("${TAG}_empty_sign_confirm").fetchSemanticsNode().boundsInRoot
        val keep = compose.onNodeWithTag("${TAG}_empty_sign_keep").fetchSemanticsNode().boundsInRoot
        assertThat(keep.left).isAtLeast(act.right)
    }

    @Test
    fun whereTheOpinionVouchesSomeoneInTheFirstLineWarnsTheyStartCutOff() {
        show(targetLabel = "@rafa", vouchIn = true)
        compose.onNodeWithTag("${TAG}_empty_sign_body").assertTextEquals(
            "@rafa would be vouched in but start out cut off: no feed can carry them, and community funds " +
                "stay closed to them, until someone gives them an opinion that says something.",
        )
        // The cost line and the act are unchanged: Set it anyway still vouches them in.
        compose.onNodeWithTag("${TAG}_empty_sign_cost").assertTextEquals("It signs 1 thing, paid on its own.")
        compose.onNodeWithTag("${TAG}_empty_sign_confirm").assertTextEquals("Set it anyway").performClick()
        assertThat(confirmed).isEqualTo(1)
    }

    @Test
    fun aHostThatNamesNoTargetReadsThisPost() {
        show(targetLabel = null)
        compose.onNodeWithTag("${TAG}_empty_sign_body")
            .assertTextEquals("This says nothing about this post, shapes no feed, and leaves you where you are.")
    }

    @Test
    fun inFlightTheActReadsSettingAndTheWaysOutWaitWithoutDimming() {
        compose.mainClock.autoAdvance = false
        show(EmptySignPrompt(working = true))
        compose.mainClock.advanceTimeBy(SETTING_AFTER_MS + 50)
        compose.onNodeWithTag("${TAG}_empty_sign_confirm").assertTextEquals("Setting…").assertIsEnabled()
            .performClick()
        compose.onNodeWithTag("${TAG}_empty_sign_keep").assertIsEnabled().performClick()
        assertThat(confirmed).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
    }

    @Test
    fun aSigningAnsweredWithin200msNeverReadsSetting() {
        compose.mainClock.autoAdvance = false
        show(EmptySignPrompt(working = true))
        compose.mainClock.advanceTimeBy(SETTING_AFTER_MS - 50)
        compose.onNodeWithTag("${TAG}_empty_sign_confirm").assertTextEquals("Set it anyway")
    }

    @Test
    fun aFailedSigningKeepsTheAskWithTheFaultAndRetryInTheActsSlot() {
        show(EmptySignPrompt(failed = true))
        compose.onNodeWithTag("${TAG}_empty_sign_failed").assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("${TAG}_empty_sign_confirm").assertTextEquals("Retry").performClick()
        assertThat(confirmed).isEqualTo(1)
    }

    @Test
    fun theBodysParagraphsStandTheDialogSurfacesSixteenApart() {
        show()
        val body = compose.onNodeWithTag("${TAG}_empty_sign_body").fetchSemanticsNode().boundsInRoot
        val cost = compose.onNodeWithTag("${TAG}_empty_sign_cost").fetchSemanticsNode().boundsInRoot
        val gap = with(compose.density) { (cost.top - body.bottom).toDp() }
        assertThat(gap.value).isWithin(0.5f).of(16f)
    }

    @Test
    fun theWordsAreTheMasters() {
        val master = java.io.File("../../../design/components/stance/EmptySignConfirm.jsx").readText()
        assertThat(master).contains("title: \"Sign an empty opinion?\"")
        assertThat(master).contains(
            "`This says nothing about \${targetLabel}, shapes no feed, and leaves you where you are.`",
        )
        assertThat(master).contains(
            "`\${targetLabel} would be vouched in but start out cut off: no feed can carry them, and community " +
                "funds stay closed to them, until someone gives them an opinion that says something.`",
        )
        assertThat(master).contains("cost: \"It signs 1 thing, paid on its own.\"")
        assertThat(master).contains("confirm: \"Set it anyway\"")
        assertThat(master).contains("busy: \"Setting…\"")
        assertThat(master).contains("keep: \"Keep it\"")
        assertThat(master).contains("That didn&apos;t send. Try again.")
    }
}
