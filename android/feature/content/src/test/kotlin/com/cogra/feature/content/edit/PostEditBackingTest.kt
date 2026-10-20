// The post edit's backing (round 15): the `Your backing` row under the License
// row (EditCompose.md, EditWords.md, EditComposeVideo.md) and the backing pad
// parked over the edit (EditPad.md, the `EditPad` board — compose canvas).

package com.cogra.feature.content.edit

import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.BACKING_UNREAD_MARK
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.PostBacking
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PostEditBackingTest {

    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()

    private val actions = PostEditActions(
        onOpenBackingPad = { calls += "open" },
        onBackingPickChange = { calls += "drag $it" },
        onWalkBack = { calls += "walk" },
        onSetBacking = { calls += "set" },
        onCancelBackingPad = { calls += "cancel" },
    )

    private val standing = PostBacking(net = 0.1, rawSum = 0.1)

    private fun render(state: PostEditUiState) {
        compose.setContent { PostEditScreen(state = state, actions = actions) }
    }

    @Test
    fun theBackingRowReadsOneNumberUnderTheLicense() {
        render(PostEditUiState(postId = "p1", body = "b", backing = standing))
        compose.onNodeWithTag("post_edit_backing").performScrollTo()
        compose.onNodeWithTag("post_edit_backing_label", useUnmergedTree = true).assertTextEquals("Your backing")
        compose.onNodeWithTag("post_edit_backing_value")
            .assertContentDescriptionEquals("Nice, For or against +0.10")
        compose.onNodeWithTag("post_edit_backing_action").assertTextEquals("Adjust").performClick()
        assertThat(calls).containsExactly("open")
    }

    @Test
    fun theRowReadsTheBackingAfterOnceAPickIsSet() {
        render(PostEditUiState(postId = "p1", body = "b", backing = standing, pick = 0.3))
        compose.onNodeWithTag("post_edit_backing_value")
            .assertContentDescriptionEquals("Like this, For or against +0.40")
    }

    @Test
    fun anUnservedBackingIsADashOnTheRow() {
        render(PostEditUiState(postId = "p1", body = "b"))
        compose.onNodeWithTag("post_edit_backing_unread").performScrollTo().assertTextEquals(BACKING_UNREAD_MARK)
        compose.onNodeWithTag("post_edit_backing_value").assertDoesNotExist()
    }

    @Test
    fun thePadReadsCurrentBackingYourPickAndBackingAfter() {
        render(
            PostEditUiState(postId = "p1", body = "b", backing = standing, backingPadOpen = true, stagedPick = 0.3),
        )
        compose.onNodeWithTag("post_edit_pad_wash").assertExists()
        compose.onNodeWithTag("post_edit_backing_current").assertContentDescriptionEquals(
            "Current backing: Nice, For or against +0.10",
        )
        compose.onNodeWithTag("post_edit_backing_pick").assertContentDescriptionEquals(
            "Your pick: Nice, For or against +0.30",
        )
        compose.onNodeWithTag("post_edit_backing_after")
            .assertContentDescriptionContains("Backing after:", substring = true)
        compose.onNodeWithTag("post_edit_backing_after")
            .assertContentDescriptionContains("For or against +0.40", substring = true)
        compose.onNodeWithTag("post_edit_backing_after_cap").assertDoesNotExist()
        compose.onNodeWithText("Less").assertDoesNotExist()
    }

    @Test
    fun theCapIsStatedHonestlyPastOne() {
        render(
            PostEditUiState(
                postId = "p1",
                body = "b",
                backing = PostBacking(net = 1.0, rawSum = 1.2),
                backingPadOpen = true,
                stagedPick = 0.2,
            ),
        )
        compose.onNodeWithTag("post_edit_backing_after_cap")
            .assertTextEquals("Adds up to +1.40; your feed reads it capped at +1.00.")
    }

    @Test
    fun aZeroPickThinks() {
        render(PostEditUiState(postId = "p1", body = "b", backing = standing, backingPadOpen = true))
        compose.onNodeWithTag("post_edit_backing_pick").assertContentDescriptionEquals(
            "Your pick: No side taken, For or against +0.00",
        )
    }

    @Test
    fun walkItAllBackStandsOnTheCommitRowAndAnswers() {
        render(PostEditUiState(postId = "p1", body = "b", backing = standing, backingPadOpen = true))
        compose.onNodeWithTag("post_edit_backing_walk_back").assertTextEquals("Walk it all back").assertIsEnabled()
            .performClick()
        compose.onNodeWithTag("post_edit_backing_set").performClick()
        compose.onNodeWithTag("post_edit_backing_cancel").performClick()
        assertThat(calls).containsExactly("walk", "set", "cancel").inOrder()
    }

    @Test
    fun walkItAllBackIsGreyedAtANetOfZero() {
        render(
            PostEditUiState(
                postId = "p1",
                body = "b",
                backing = PostBacking(net = 0.0, rawSum = 0.0),
                backingPadOpen = true,
            ),
        )
        compose.onNodeWithTag("post_edit_backing_walk_back").assertIsNotEnabled()
    }

    @Test
    fun anUnservedBackingReadsUnreadOnThePadAndGreysTheWalkBack() {
        render(PostEditUiState(postId = "p1", body = "b", backingPadOpen = true, stagedPick = 0.3))
        compose.onNodeWithTag("post_edit_backing_current_unread", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("post_edit_backing_after_unread", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("post_edit_backing_walk_back").assertIsNotEnabled()
    }

    @Test
    fun thePadsHelpIsTheBackingTopic() {
        render(PostEditUiState(postId = "p1", body = "b", backing = standing, backingPadOpen = true))
        compose.onNodeWithTag("post_edit_backing_help").performClick()
        compose.onNodeWithText(HelpTopic.YourBackingOnYourPost.title).assertExists()
    }

    @Test
    fun theWashStagesNothing() {
        render(PostEditUiState(postId = "p1", body = "b", backing = standing, backingPadOpen = true))
        compose.onNodeWithTag("post_edit_pad_wash").performClick()
        assertThat(calls).containsExactly("cancel")
    }
}
