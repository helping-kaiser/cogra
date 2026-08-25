package com.cogra.core.designsystem

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val TAG = "post"

@RunWith(RobolectricTestRunner::class)
class SeveranceConfirmTest {

    @get:Rule
    val compose = createComposeRule()

    private var confirmed = 0
    private var dismissed = 0

    private fun show(prompt: SeverancePrompt) {
        compose.setContent {
            SeveranceConfirm(
                prompt = prompt,
                onConfirm = { confirmed++ },
                onDismiss = { dismissed++ },
                testTagPrefix = TAG,
            )
        }
    }

    private fun prompt(
        records: Int = 3,
        alreadySevered: Boolean = false,
        fromPick: Boolean = false,
        working: Boolean = false,
        failed: Boolean = false,
    ) = SeverancePrompt(
        standing = StancePoint(0.6, 0.4),
        records = records,
        alreadySevered = alreadySevered,
        fromPick = fromPick,
        working = working,
        failed = failed,
    )

    @Test
    fun theCostIsLegibleBeforeSigning() {
        // Severance stages a batch and every record in it is its own
        // priced act, so the count is what the reader is asked to accept.
        show(prompt(records = 3))

        compose.onNodeWithTag("${TAG}_severance_cost")
            .assertTextContains("3 signed actions", substring = true)
    }

    @Test
    fun aSingleCounterRecordIsCountedInTheSingular() {
        show(prompt(records = 1))

        compose.onNodeWithTag("${TAG}_severance_cost")
            .assertTextContains("1 signed action", substring = true)
    }

    @Test
    fun theConfirmCarriesTheReadSideGuidance() {
        show(prompt())

        compose.onNodeWithTag("${TAG}_severance_standing")
            .assertTextContains("Where you stand now", substring = true)
    }

    @Test
    fun aPickThatReachedZeroIsNamedAsSuchOnTheSameConfirmation() {
        show(prompt(fromPick = true))

        compose.onNodeWithTag("${TAG}_severance_from_pick").assertExists()
        compose.onNodeWithTag("${TAG}_severance_confirm").assertIsEnabled()
    }

    @Test
    fun theRouteAloneShowsNoPickLine() {
        show(prompt(fromPick = false))

        compose.onNodeWithTag("${TAG}_severance_from_pick").assertDoesNotExist()
    }

    @Test
    fun aBundleAlreadyAtZeroIsSaidSoAndCannotBeSeveredAgain() {
        show(prompt(records = 0, alreadySevered = true))

        compose.onNodeWithTag("${TAG}_severance_already").assertExists()
        compose.onNodeWithTag("${TAG}_severance_cost").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_severance_confirm").assertIsNotEnabled()
    }

    @Test
    fun aBatchInFlightCannotBeFiredTwice() {
        show(prompt(working = true))

        compose.onNodeWithTag("${TAG}_severance_confirm").assertIsNotEnabled()
    }

    @Test
    fun aFailedBatchIsReportedOnTheConfirmation() {
        show(prompt(failed = true))

        compose.onNodeWithTag("${TAG}_severance_failed").assertExists()
    }

    @Test
    fun bothAnswersAreOffered() {
        show(prompt())

        compose.onNodeWithTag("${TAG}_severance_confirm").performClick()
        assertThat(confirmed).isEqualTo(1)

        compose.onNodeWithTag("${TAG}_severance_keep").performClick()
        assertThat(dismissed).isEqualTo(1)
    }
}
