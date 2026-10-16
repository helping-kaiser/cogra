// The composer's pair sheets: TagPadCompose.md and RefPair.md, clause by
// clause where a JVM test can reach them (seam 218/219: the chip dialog with
// write-through sliders and a −1 relevance floor was drift).

package com.cogra.feature.content

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeUp
import com.cogra.domain.ReferenceTargetView
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PairSheetTest {

    @get:Rule
    val compose = createComposeRule()

    private val done = mutableListOf<Pair<Double, Double>>()
    private var dismissed = 0

    private fun tagSheet(row: TagRow = TagRow("coastroad")) {
        compose.setContent {
            TagPairSheet(
                row = row,
                testTagPrefix = "wizard",
                onDone = { r, c -> done += r to c },
                onDismiss = { dismissed += 1 },
            )
        }
    }

    @Test
    fun theTagSheetIsTitledByItsTagAndStartsAtTheContractsDefault() {
        tagSheet()
        compose.onNodeWithText("#coastroad").assertExists()
        compose.onNodeWithTag("wizard_tag_pair_readout_pair", useUnmergedTree = true).assertTextEquals("+0.10 / 1.00")
        compose.onNodeWithTag("wizard_tag_pair_readout").assertContentDescriptionEquals(
            "Your pick: had to look, but it's in there. How much it is about this +0.10, How sure you are 1.00",
        )
        compose.onNodeWithText(PAIR_SHEET_FOOT).assertExists()
        // No Un-tag on a composer: the chip's × is the whole of it.
        compose.onNodeWithText("Withdraw").assertDoesNotExist()
        compose.onNodeWithText("Un-tag").assertDoesNotExist()
    }

    @Test
    fun aDragStagesInTheSheetAndOnlyDoneHandsItOver() {
        tagSheet()
        compose.onNodeWithTag("wizard_tag_pair_field").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("wizard_tag_pair_field").performTouchInput { swipeLeft() }
        assertThat(done).isEmpty()
        // Never below the floor, however far the drag goes.
        compose.onNodeWithTag("wizard_tag_pair_readout_pair", useUnmergedTree = true).assertTextEquals("+0.01 / 1.00")
        compose.onNodeWithTag("wizard_tag_pair_done").performClick()
        assertThat(done).containsExactly(0.01 to 1.0)
        assertThat(dismissed).isEqualTo(0)
    }

    @Test
    fun aStagedTagsOwnPairIsWhereTheSheetOpens() {
        tagSheet(TagRow("coastroad", relevance = 0.72, confidence = 0.55))
        compose.onNodeWithTag("wizard_tag_pair_readout_pair", useUnmergedTree = true).assertTextEquals("+0.72 / 0.55")
    }

    @Test
    fun theFieldsNonDragRouteSwapsInTwoBoundedTracks() {
        tagSheet()
        compose.onNodeWithTag("wizard_tag_pair_field").assert(
            SemanticsMatcher.keyIsDefined(SemanticsActions.CustomActions),
        )
        compose.onNodeWithTag("wizard_tag_pair_field").performSemanticsAction(SemanticsActions.CustomActions) {
            it.single { action -> action.label == "Set exact values for #coastroad" }.action()
        }
        compose.onNodeWithTag("wizard_tag_pair_field").assertDoesNotExist()
        compose.onNodeWithTag("wizard_tag_pair_exact_directed").assertExists()
        compose.onNodeWithTag("wizard_tag_pair_exact_interest").assertExists()
    }

    @Test
    fun theCitationSheetIsTheSignedSquareWithTheFaceButNoWord() {
        compose.setContent {
            ReferencePairSheet(
                row = ReferenceRow(
                    targetId = "t1",
                    target = ReferenceTargetView.Profile(id = "a1", handle = "ada", displayName = null),
                ),
                testTagPrefix = "wizard",
                onDone = { r, s -> done += r to s },
                onDismiss = { dismissed += 1 },
            )
        }
        compose.onNodeWithText("@ada").assertExists()
        compose.onNodeWithTag("wizard_reference_pair_readout_pair", useUnmergedTree = true)
            .assertTextEquals("+0.10 / +0.10")
        compose.onNodeWithTag("wizard_reference_pair_readout").assertContentDescriptionEquals(
            "Your pick: How much it leans on this +0.10, For or against +0.10",
        )
        // Support runs up the signed square: a drag up raises it.
        compose.onNodeWithTag("wizard_reference_pair_field").performTouchInput { swipeUp() }
        compose.onNodeWithTag("wizard_reference_pair_done").performClick()
        assertThat(done.single().second).isGreaterThan(0.1)
    }
}
