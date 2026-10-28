// Saved as a feed (Saved.md, SavedUndo.md, SavedEmpty.md, SavedNone.md; round
// 12): every kept thing as its kind's own live card, newest by save time; the
// unsave as the first row of each card's ⋮, Undo in place, the comfort line on
// the returned card; the search field handing the query to the server's
// matcher and the narrowed list standing as served; hidden accounts' things
// staying. web's twin is `saved-view.test.tsx`.

package com.cogra.feature.content

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.HashtagView
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.ProfileView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.feature.saved.SavedUiState
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.time.Instant

// A tall window, so every card of the list is composed at once: a lazy list
// composes only what stands on screen.
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class SavedScreenTest {

    @get:Rule
    val compose = createComposeRule()

    // The cards read their ages against the clock, as they do on the feed.
    private val now = Instant.now()
    private val repository = RecordingSavedRepository()
    private val writes = SavedWrites(
        repository,
        FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") },
        CoroutineScope(Dispatchers.Unconfined),
    )

    private fun text(value: String?, status: FieldStatus = FieldStatus.NORMAL) = ModeratedField(value, status)

    private fun daysAgo(days: Long) = now.minusSeconds(days * 86_400)

    private fun tag(name: String) = TopicClaimView(HashtagView("t-$name", text(name)), 0.5, 1.0, false)

    private val ada = ActorRef("u1", "ada", "Ada")
    private val tobias = ActorRef("u2", "tobias", "Tobias")

    // Newest by when the reader saved each thing — the post written a week ago
    // leads the comment written an hour ago, because it was kept later.
    private val post = SavedEntry(
        SavedCard.Post(
            PostView(
                id = "p1",
                title = text("The long way home"),
                description = text(null),
                content = text("Took the coast road."),
                author = ada,
                createdAt = daysAgo(7),
                updatedAt = daysAgo(7),
                landing = Landing.landed(1),
                license = LicenseChoice.PublicDomain,
                topics = listOf(tag("coastroad")),
                viewerBookmarkedAt = daysAgo(2),
            ),
        ),
        daysAgo(2),
    )
    private val comment = SavedEntry(
        SavedCard.Comment(
            comment = CommentView(
                id = "c1",
                content = text("The third headland light is real"),
                author = tobias,
                createdAt = now.minusSeconds(3_600),
                updatedAt = now.minusSeconds(3_600),
                landing = Landing.landed(2),
                license = LicenseChoice.PublicDomain,
                topics = listOf(tag("glovebox")),
                viewerBookmarkedAt = daysAgo(3),
            ),
            target = CommentTarget.Post(
                id = "p1",
                title = text("The long way home"),
                content = text("words"),
                mimeTypes = emptyList(),
                coverUrl = null,
                authorHandle = "ada",
                moderation = ModerationState.NORMAL,
                removed = false,
            ),
            threadPostId = "p1",
            threadPostTitle = text("The long way home"),
        ),
        daysAgo(3),
    )

    private fun person(deleted: Boolean = false) = SavedEntry(
        SavedCard.Person(
            ProfileView(
                id = "u3",
                handle = "mira",
                displayName = if (deleted) text(null, FieldStatus.REDACTED) else text("Mira Voss"),
                bio = if (deleted) text(null, FieldStatus.REDACTED) else text("Runs the stand by the sea wall."),
                websiteUrl = text(null),
                viewerBookmarkedAt = daysAgo(5),
            ),
        ),
        daysAgo(5),
    )

    private val all get() = listOf(post, comment, person())

    private val opened = mutableListOf<String>()
    private val doors = CardDoors(
        onOpenPost = { opened += "post:$it" },
        onOpenComment = { postId, commentId, aim ->
            opened += "comment:$postId/$commentId" + if (aim) "+reply" else ""
        },
        onOpenActor = { opened += "actor:$it" },
        onOpenTopic = { opened += "topic:$it" },
    )

    /** Every query the field handed to the read, in order. */
    private val searched = mutableListOf<String>()

    /** [narrowedBy] is the search the held [entries] answer — the server's narrowing, as read. */
    private fun render(
        entries: List<SavedEntry>,
        hasNextPage: Boolean = false,
        typed: String = "",
        narrowedBy: String? = null,
    ) {
        val host = SnackbarHostState()
        compose.setContent {
            var query by mutableStateOf(typed)
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                SavedScreen(
                    state = SavedUiState(
                        entries = entries,
                        loading = false,
                        hasNextPage = hasNextPage,
                        query = query,
                        narrowedBy = narrowedBy,
                    ),
                    writes = writes,
                    onRefresh = {},
                    onLoadMore = {},
                    onRetryMore = {},
                    onSearch = {
                        searched += it
                        query = it
                    },
                    onBack = {},
                    doors = doors,
                )
                CograSnackbarHost(host)
            }
        }
    }

    private fun shown(tag: String): Boolean = compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()

    private fun search(query: String) {
        compose.onNodeWithTag("saved.searchField.input").performTextClearance()
        if (query.isNotEmpty()) compose.onNodeWithTag("saved.searchField.input").performTextInput(query)
        compose.waitForIdle()
    }

    private val postCard = "saved.card:p1"
    private val commentCard = "saved.commentCard:c1"
    private val personCard = "saved.profileCard:u3"

    // The suite's window is tall so every card composes; a phone's is not, and
    // the band's scroll behaviour has no TopAppBar here to bound it. The cards
    // must move under the reader's swipe, past the band that collapses.
    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun `a swipe on a phone sized window scrolls the cards past the collapsed band`() {
        val posts = (1..12).map { i ->
            val view = (post.card as SavedCard.Post).post.copy(id = "p$i")
            SavedEntry(SavedCard.Post(view), daysAgo(2))
        }
        render(posts)
        assertThat(shown("saved.card:p1")).isTrue()
        repeat(4) { compose.onNodeWithTag("saved_list").performTouchInput { swipeUp() } }
        compose.waitForIdle()
        assertThat(shown("saved.card:p1")).isFalse()
    }

    @Test
    fun `saved stands each kind as its own feed card`() {
        render(all)
        assertThat(shown(postCard)).isTrue()
        assertThat(shown(commentCard)).isTrue()
        assertThat(shown(personCard)).isTrue()
        // The comment card's head row names the post it answers, as one door.
        compose.onNodeWithContentDescription("On “The long way home” — @ada").assertIsDisplayed()
        compose.onNodeWithText("Mira Voss").assertIsDisplayed()
        compose.onNodeWithText("@mira").assertIsDisplayed()
    }

    @Test
    fun `no card carries a save age or an unsave control of its own`() {
        render(all)
        // The cards wear their own ages (7d, 1h), never the save's (2d, 3d, 5d).
        compose.onNodeWithText("7d").assertIsDisplayed()
        assertThat(compose.onAllNodesWithText("2d").fetchSemanticsNodes()).isEmpty()
        assertThat(compose.onAllNodesWithContentDescription("Unsave", substring = true).fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun `the first row of every card's menu reads unsave`() {
        render(all)
        compose.onNodeWithTag("saved.card.menu").performClick()
        compose.onNodeWithTag("saved_p1_menu_save").assertIsDisplayed()
        compose.onNodeWithText("Unsave").assertIsDisplayed()
    }

    @Test
    fun `unsave from a card's menu takes the card and undo puts it back where it was`() {
        render(all)
        compose.onNodeWithTag("saved_comment_c1_menu").performClick()
        compose.onNodeWithTag("comment_menu_save_c1").performClick()
        compose.waitForIdle()
        assertThat(shown(commentCard)).isFalse()
        assertThat(shown(postCard)).isTrue()
        assertThat(shown(personCard)).isTrue()
        assertThat(repository.removes).containsExactly("c1")
        compose.onNodeWithText("Removed from Saved.").assertIsDisplayed()
        compose.onNodeWithTag("saved.snackbar.action").performClick()
        compose.waitForIdle()
        assertThat(shown(commentCard)).isTrue()
        assertThat(repository.sets).containsExactly("c1" to comment.bookmarkedAt)
    }

    @Test
    fun `a failed unsave brings the card back with its line and unsave still first`() {
        repository.removeAnswers.addLast(Outcome.Failed(IOException("down")))
        render(all)
        compose.onNodeWithTag("saved.profileCard.menu").performClick()
        compose.onNodeWithTag("saved_person_u3_menu_save").performClick()
        compose.waitForIdle()
        assertThat(shown(personCard)).isTrue()
        compose.onNodeWithText("That didn't go through.").assertIsDisplayed()
        // Retry asks the unsave again, and the card leaves again at the tap.
        compose.onNodeWithTag("saved_person_u3_row_line_retry").performClick()
        compose.waitForIdle()
        assertThat(shown(personCard)).isFalse()
        assertThat(repository.removes).containsExactly("u3", "u3")
    }

    @Test
    fun `the last card's unsave stands the empty state`() {
        render(listOf(post))
        compose.onNodeWithTag("saved.card.menu").performClick()
        compose.onNodeWithTag("saved_p1_menu_save").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("saved.empty.title").assertIsDisplayed()
        compose.onNodeWithText("Removed from Saved.").assertIsDisplayed()
    }

    @Test
    fun `an unsave made elsewhere is applied on return`() {
        writes.drop("p1", post.bookmarkedAt)
        render(all)
        assertThat(shown(postCard)).isFalse()
        assertThat(shown(personCard)).isTrue()
    }

    @Test
    fun `a hidden account's things and profile stay in saved`() {
        // Nothing here reads the hidden set to narrow: the list is the read.
        render(all)
        assertThat(shown(postCard)).isTrue()
        assertThat(shown(personCard)).isTrue()
    }

    @Test
    fun `a deleted account's card stands redacted with no handle and no bio`() {
        render(listOf(person(deleted = true)))
        compose.onNodeWithText("Deleted account").assertIsDisplayed()
        assertThat(shown("saved.profileCard.handle")).isFalse()
        assertThat(shown("saved.profileCard.bio")).isFalse()
    }

    @Test
    fun `every card's doors land as the feed's do`() {
        render(all)
        compose.onNodeWithTag("saved_comment_c1_head").performClick()
        compose.onNodeWithTag("saved_comment_c1_reply").performClick()
        compose.onNodeWithText("Mira Voss").performClick()
        assertThat(opened).containsExactly("post:p1", "comment:p1/c1+reply", "actor:mira").inOrder()
    }

    private fun top(tag: String): Float = compose.onAllNodesWithTag(tag).fetchSemanticsNodes().first().boundsInRoot.top

    @Test
    fun `the field reads search what you saved and hands the query to the read`() {
        render(all)
        compose.onNodeWithText("Search what you saved").assertIsDisplayed()
        search("long way")
        assertThat(searched.last()).isEqualTo("long way")
        // The screen never narrows by itself: the server's matcher does, so
        // until its narrowed list is read, the held list stands whole.
        assertThat(shown(postCard)).isTrue()
        assertThat(shown(commentCard)).isTrue()
        assertThat(shown(personCard)).isTrue()
        assertThat(shown("saved.empty")).isFalse()
    }

    @Test
    fun `a narrowed list stands in the order served - people first, then content`() {
        // The person was kept before the post and the comment; served
        // sectioned, people lead anyway, and the screen does not re-sort.
        render(listOf(person(), post, comment), typed = "@ad", narrowedBy = "@ad")
        assertThat(top(personCard)).isLessThan(top(postCard))
        assertThat(top(postCard)).isLessThan(top(commentCard))
        compose.onNodeWithTag("saved.searchField.input").assertIsDisplayed()
    }

    @Test
    fun `saved none stands when the narrowed list holds nothing and show everything clears the query`() {
        render(emptyList(), typed = "brackish cartography", narrowedBy = "brackish cartography")
        compose.onNodeWithText("Nothing you've saved carries that name.", substring = true).assertIsDisplayed()
        compose.onNodeWithText("fewer words reach further.", substring = true).assertIsDisplayed()
        // The field keeps the reader's query.
        compose.onNodeWithTag("saved.searchField.input").assertIsDisplayed()
        compose.onNodeWithTag("saved.empty.action").performClick()
        compose.waitForIdle()
        assertThat(searched.last()).isEmpty()
    }

    @Test
    fun `unsaving the last card a query narrowed to stands saved none`() {
        render(listOf(post), typed = "long", narrowedBy = "long")
        compose.onNodeWithTag("saved.card.menu").performClick()
        compose.onNodeWithTag("saved_p1_menu_save").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("saved.empty.action").assertIsDisplayed()
        compose.onNodeWithText("Removed from Saved.").assertIsDisplayed()
    }

    @Test
    fun `a query typed but not yet read keeps the field over the list last read`() {
        render(all, typed = "lo")
        compose.onNodeWithTag("saved.searchField.input").assertIsDisplayed()
        assertThat(shown(postCard)).isTrue()
        assertThat(shown("saved.empty")).isFalse()
    }

    @Test
    fun `saved empty names the save in words and draws no field`() {
        render(emptyList())
        compose.onNodeWithText(
            "Nothing saved yet. A post, a comment or a person can be saved from its own menu, and it waits here.",
        ).assertIsDisplayed()
        assertThat(shown("saved.searchField")).isFalse()
        assertThat(shown("saved.empty.action")).isFalse()
    }
}
