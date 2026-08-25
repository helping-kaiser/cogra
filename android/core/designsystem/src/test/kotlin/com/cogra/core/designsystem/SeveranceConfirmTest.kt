package com.cogra.core.designsystem

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.semantics.SemanticsProperties
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
        standing: StancePoint = StancePoint(0.6, 0.4),
        raw: StancePoint = StancePoint(0.6, 0.4),
    ) = SeverancePrompt(
        standing = standing,
        raw = raw,
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
            .assertTextContains("adds up to", substring = true)
    }

    @Test
    fun theCostAndTheNumbersBesideItComeFromTheSameHistory() {
        // The incoherence this replaces: a bundle clipped at +1.00
        // quoted beside a count of six signed acts, which no reader can
        // make add up. The confirm states the RAW sums (design.md §8.3).
        show(
            prompt(
                records = 6,
                standing = StancePoint(1.0, 1.0),
                raw = StancePoint(6.0, 4.5),
            ),
        )

        compose.onNodeWithTag("${TAG}_severance_standing")
            .assertTextContains("+6.00", substring = true)
        compose.onNodeWithTag("${TAG}_severance_standing")
            .assertTextContains("+4.50", substring = true)
        compose.onNodeWithTag("${TAG}_severance_cost")
            .assertTextContains("6 signed actions", substring = true)
    }

    @Test
    fun aClippedFoldIsNeverTheNumberTheConfirmQuotes() {
        show(prompt(records = 6, standing = StancePoint(1.0, 1.0), raw = StancePoint(6.0, 4.5)))

        val quoted = compose.onNodeWithTag("${TAG}_severance_standing")
            .fetchSemanticsNode()
            .config[SemanticsProperties.Text]
            .joinToString(" ")

        assertThat(quoted).doesNotContain("+1.00")
    }

    @Test
    fun aBundleAlreadyAtZeroShrugsRatherThanReadingAsNice() {
        show(
            prompt(
                records = 0,
                alreadySevered = true,
                standing = StancePoint.Origin,
                raw = StancePoint.Origin,
            ),
        )

        compose.onNodeWithTag("${TAG}_severance_standing")
            .assertTextContains("🤷", substring = true)
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
