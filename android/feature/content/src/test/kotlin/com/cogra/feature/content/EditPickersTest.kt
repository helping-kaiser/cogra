// The edits open the pickers in place (web #341; EditCompose, CommentEdit
// boards draw `+ Add a tag` / `+ Cite something` as the `sm` doors): the door
// calls the picker, never an inline field, and an open picker stands where the
// edit stood with its arrow naming the composer it returns to (TagPicker.md,
// ReferencePicker.md: "Back to the post from a post's composer or its edit,
// and Back to the comment from a reply's composer or a comment's edit").

package com.cogra.feature.content

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.feature.content.edit.PostEditActions
import com.cogra.feature.content.edit.PostEditScreen
import com.cogra.feature.content.edit.PostEditUiState
import com.cogra.feature.content.reply.CommentEditActions
import com.cogra.feature.content.reply.CommentEditScreen
import com.cogra.feature.content.reply.CommentEditState
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class EditPickersTest {

    @get:Rule
    val compose = createComposeRule()

    private val tags = RecordingTagPicker()
    private val references = RecordingReferencePicker()

    private val post = PostEditUiState(postId = "p1", body = "Salt maps")
    private val postActions = PostEditActions(tagPicker = tags, referencePicker = references)

    private val comment = CommentEditState(
        commentId = "c1",
        parentTitle = "The long way home",
        body = "The glovebox camera earns its keep.",
        loadedBody = "The glovebox camera earns its keep.",
        loading = false,
    )
    private val commentActions = CommentEditActions(tagPicker = tags, referencePicker = references)

    @Test
    fun thePostEditsAddATagOpensThePicker() {
        compose.setContent { PostEditScreen(state = post, actions = postActions) }
        compose.onNodeWithTag("post_edit_tag_input").assertDoesNotExist()
        compose.onNodeWithTag("postEdit.tags.add").performScrollTo().performClick()
        assertThat(tags.calls).containsExactly("open")
    }

    @Test
    fun thePostEditsCiteSomethingOpensThePicker() {
        compose.setContent { PostEditScreen(state = post, actions = postActions) }
        compose.onNodeWithTag("postEdit.references.add").performScrollTo().performClick()
        assertThat(references.calls).containsExactly("open")
    }

    @Test
    fun anOpenPickerStandsInThePostEditsPlace() {
        val picking = post.copy(tagSection = TagSectionState(picker = TagPickerState()))
        compose.setContent { PostEditScreen(state = picking, actions = postActions) }
        compose.onNodeWithTag("tagPicker").assertExists()
        compose.onNodeWithContentDescription("Back to the post").assertExists()
        compose.onNodeWithTag("postEdit.references.add").assertDoesNotExist()
    }

    @Test
    fun theCommentEditsDoorsOpenThePickers() {
        compose.setContent { CommentEditScreen(state = comment, actions = commentActions) }
        compose.onNodeWithTag("comment_edit_tag_input").assertDoesNotExist()
        compose.onNodeWithTag("commentEdit.tags.add").performScrollTo().performClick()
        compose.onNodeWithTag("commentEdit.references.add").performScrollTo().performClick()
        assertThat(tags.calls).containsExactly("open")
        assertThat(references.calls).containsExactly("open")
    }

    @Test
    fun anOpenPickerStandsInTheCommentEditsPlaceNamingTheComment() {
        val picking = comment.copy(referenceSection = ReferenceSectionState(picker = ReferencePickerState()))
        compose.setContent { CommentEditScreen(state = picking, actions = commentActions) }
        compose.onNodeWithTag("referencePicker").assertExists()
        compose.onNodeWithContentDescription("Back to the comment").assertExists()
    }
}
