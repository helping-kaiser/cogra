// Leaving the post edit (EditCompose.md, EditComposeVideo.md, EditWords.md,
// DiscardConfirm.md): the edit keeps no draft, so the back arrow, the X and
// the platform back leave at once with an empty batch and ask `Discard the
// changes?` with an act in it. Driven through the real route and ViewModel,
// so the ask is the acts batch's own signal, never a stand-in.

package com.cogra.feature.content.edit

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.crypto.ActorKey
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.SelfMarkView
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FaithfulMediaRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_POST_ID
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PostEditLeaveTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }

    private val content = object : ThrowingContentRepository() {
        override suspend fun post(
            id: String,
            commentsFirst: Int,
            commentsAfter: String?,
            includePending: Boolean,
        ): Outcome<PostDetail?> = Outcome.Success(
            PostDetail(
                post = testPost(id, title = "Loaded title", body = "Loaded body"),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )

        override suspend fun postSelfMark(id: String): Outcome<SelfMarkView?> =
            Outcome.Success(SelfMarkView(sensitive = false, reason = null))
    }

    private val viewModel = PostEditViewModel(
        content,
        ThrowingTopicRepository(),
        ThrowingReferenceRepository(),
        WriteSigner(SealingWriteRepository(actor), identity),
        identity,
        FaithfulMediaRepository(),
        ScriptedPictures(),
        ScriptedClips(),
    )

    private var leaves = 0

    private fun open() {
        compose.setContent {
            PostEditRoute(postId = TEST_POST_ID, onSaved = {}, onBack = { leaves += 1 }, viewModel = viewModel)
        }
        compose.waitForIdle()
    }

    private fun stage() {
        compose.runOnIdle { viewModel.onTitleChange("Retitled") }
    }

    private fun platformBack() {
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    @Test
    fun theXIsNamedLeaveTheEditIsDiscarded() {
        open()
        compose.onNodeWithContentDescription("Leave — the edit is discarded").assertIsDisplayed()
        compose.onNodeWithContentDescription("Leave — your draft is kept").assertDoesNotExist()
    }

    @Test
    fun anEmptyBatchLeavesAtOnceByTheXTheBackArrowAndThePlatformBack() {
        open()
        compose.onNodeWithTag("postEdit.header.leave").performClick()
        compose.onNodeWithTag("postEdit.header.back").performClick()
        platformBack()

        assertThat(leaves).isEqualTo(3)
        compose.onNodeWithTag("post_edit_discard_confirm").assertDoesNotExist()
    }

    @Test
    fun theXWithAnActInTheBatchAsksDiscardTheChangesAndLeavesNothingUnasked() {
        open()
        stage()
        compose.onNodeWithTag("postEdit.header.leave").performClick()

        assertThat(leaves).isEqualTo(0)
        compose.onNodeWithTag("post_edit_discard_confirm").assertIsDisplayed()
        compose.onNodeWithText("Discard the changes?").assertIsDisplayed()
        compose.onNodeWithText("Nothing is kept.").assertIsDisplayed()
    }

    @Test
    fun theBackArrowAndThePlatformBackAskTheSameWithAnActInTheBatch() {
        open()
        stage()
        compose.onNodeWithTag("postEdit.header.back").performClick()
        compose.onNodeWithTag("post_edit_discard_confirm").assertIsDisplayed()

        compose.onNodeWithTag("post_edit_discard_confirm_keep").performClick()
        compose.onNodeWithTag("post_edit_discard_confirm").assertDoesNotExist()

        platformBack()
        compose.onNodeWithTag("post_edit_discard_confirm").assertIsDisplayed()
        assertThat(leaves).isEqualTo(0)
    }

    @Test
    fun keepWritingClosesTheAskOntoTheEditAsItWas() {
        open()
        stage()
        compose.onNodeWithTag("postEdit.header.leave").performClick()
        compose.onNodeWithTag("post_edit_discard_confirm_keep").performClick()

        compose.onNodeWithTag("post_edit_discard_confirm").assertDoesNotExist()
        assertThat(leaves).isEqualTo(0)
        assertThat(viewModel.state.value.title).isEqualTo("Retitled")
        compose.onNodeWithTag("postEdit.acts.line").assertIsDisplayed()
    }

    /** EditCompose.md: 200ms into the signing, the back arrow and the X refuse a press. */
    @Test
    fun whileTheSigningHoldsTheXAndTheBackArrowRefuse() {
        compose.setContent {
            PostEditScreen(
                state = PostEditUiState(postId = TEST_POST_ID, body = "b", recordStaged = true, submitting = true),
                actions = PostEditActions(onLeave = { leaves += 1 }),
            )
        }
        compose.mainClock.advanceTimeBy(SLOW_ANSWER_MS + 100)
        compose.onNodeWithTag("postEdit.header.leave").performClick()
        compose.onNodeWithTag("postEdit.header.back").performClick()

        assertThat(leaves).isEqualTo(0)
    }

    @Test
    fun discardLeavesTheEditOnce() {
        open()
        stage()
        compose.onNodeWithTag("postEdit.header.leave").performClick()
        compose.onNodeWithTag("post_edit_discard_confirm_discard").performClick()

        assertThat(leaves).isEqualTo(1)
    }
}
