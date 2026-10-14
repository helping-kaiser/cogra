// Saved (Saved.md, SavedUndo.md, SavedEmpty.md; design digest items 46-57):
// one mixed list, every row's own Unsave, Undo in place, the comfort line in
// the row's second slot, and the reader's own acts applied on return. web's
// twin is `saved-view.test.tsx`.

package com.cogra.feature.saved

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.AuthTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedNode
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.saved.ThreadPost
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingSavedRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class SavedScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.parse("2026-10-13T12:00:00Z")
    private val repository = RecordingSavedRepository()
    private val writes = SavedWrites(
        repository,
        FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") },
        CoroutineScope(Dispatchers.Unconfined),
    )

    private fun text(value: String?) = ModeratedField(value, FieldStatus.NORMAL)

    private val post = SavedEntry(
        SavedNode.Post(
            "p1",
            text("The long way home"),
            text(null),
            text("Took the coast road."),
            emptyList(),
            ModerationState.NORMAL,
            null,
            "ada",
        ),
        now.minusSeconds(2 * 86_400),
    )
    private val comment = SavedEntry(
        SavedNode.Comment(
            "c1",
            text("The third headland light is real"),
            emptyList(),
            ModerationState.NORMAL,
            null,
            "tobias",
            ThreadPost("p1", text("The long way home"), text("words"), emptyList(), "ada"),
        ),
        now.minusSeconds(3 * 86_400),
    )
    private val person = SavedEntry(
        SavedNode.Person("u3", "mira", text("Mira Voss"), text("Runs the stand by the sea wall."), null),
        now.minusSeconds(5 * 86_400),
    )

    private fun render(entries: List<SavedEntry>, hasNextPage: Boolean = false) {
        val host = SnackbarHostState()
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                SavedScreen(
                    state = SavedUiState(entries = entries, loading = false, hasNextPage = hasNextPage),
                    writes = writes,
                    onRefresh = {},
                    onLoadMore = {},
                    onBack = {},
                    onOpen = {},
                    now = now,
                )
                CograSnackbarHost(host)
            }
        }
    }

    private fun shown(key: String): Boolean =
        compose.onAllNodesWithTag("saved.list.entry:$key").fetchSemanticsNodes().isNotEmpty()

    @Test
    fun `reads one mixed list newest first with the save age`() {
        render(listOf(post, comment, person))
        assertThat(shown("the-long-way-home")).isTrue()
        assertThat(shown("the-third-headland-light-is-real")).isTrue()
        assertThat(shown("mira-voss")).isTrue()
        compose.onNodeWithText("on The long way home").assertIsDisplayed()
        compose.onNodeWithText("2d").assertIsDisplayed()
        compose.onNodeWithContentDescription("Unsave Mira Voss").assertIsDisplayed()
    }

    @Test
    fun `unsave takes the row and undo puts it back where it was`() {
        render(listOf(post, comment, person))
        compose.onNodeWithTag("saved_unsave_c1").performClick()
        compose.waitForIdle()
        assertThat(shown("the-third-headland-light-is-real")).isFalse()
        assertThat(repository.removes).containsExactly("c1")
        compose.onNodeWithText("Removed from Saved.").assertIsDisplayed()
        compose.onNodeWithTag("saved.snackbar.action").performClick()
        compose.waitForIdle()
        assertThat(shown("the-third-headland-light-is-real")).isTrue()
        assertThat(repository.sets).containsExactly("c1" to comment.bookmarkedAt)
    }

    @Test
    fun `a failed unsave brings the row back with its line on the second slot`() {
        repository.removeAnswers.addLast(Outcome.Failed(IOException("down")))
        render(listOf(post, comment, person))
        compose.onNodeWithTag("saved_unsave_p1").performClick()
        compose.waitForIdle()
        assertThat(shown("the-long-way-home")).isTrue()
        compose.onNodeWithText("That didn't go through.").assertIsDisplayed()
        compose.onNodeWithTag("saved_unsave_p1").assertIsDisplayed()
        // Retry asks the unsave again, and the row leaves again at the tap.
        compose.onNodeWithTag("saved_row_line_p1_retry").performClick()
        compose.waitForIdle()
        assertThat(shown("the-long-way-home")).isFalse()
        assertThat(repository.removes).containsExactly("p1", "p1")
    }

    @Test
    fun `the empty list names the save in words`() {
        render(emptyList())
        compose.onNodeWithTag("saved.empty.title")
            .assertIsDisplayed()
        compose.onNodeWithText(
            "Nothing saved yet. A post, a comment or a person can be saved from its own menu, and it waits here.",
        ).assertIsDisplayed()
    }

    @Test
    fun `an unsave made elsewhere is applied on return`() {
        writes.drop("p1", post.bookmarkedAt)
        render(listOf(post, comment, person))
        assertThat(shown("the-long-way-home")).isFalse()
        assertThat(shown("mira-voss")).isTrue()
    }
}
