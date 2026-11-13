// THE POST MENU ON EVERY HOST OFF THE FEED (round 36, 41): History, Saved,
// a profile's posts view and the post detail, compiled from their sidecars —
// each host's card raises its own registered sheet with the reader's rows in
// the drawn order, and the hide row TOGGLES: `Unhide @ada` while the author is
// hidden, the tap unhiding with Undo hiding again (ReaderPostMenu.md:21-25,
// HistoryPostMenu.md:5, :17-19, SavedPostMenu.md:5, :19, ProfilePostsMenu.md:5,
// ProfilePostsMenuOwn.md:5). Everything runs against fakes — no hide, unhide or
// save leaves the JVM.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.testPost
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.SavedUiState
import com.cogra.feature.saved.rememberSavedHost
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class PostMenuHostsTest {

    @get:Rule
    val compose = createComposeRule()

    private val ada = ActorRef("ada-id", "ada")
    private val adaHiddenAt: Instant = Instant.parse("2026-11-01T09:00:00Z")
    private val byAda: PostView = testPost("p1", author = ada)

    private val hiddenRepository = RecordingHiddenRepository()
    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "reader-id") }

    private fun hiddenSet(adaHidden: Boolean): HiddenSet {
        if (adaHidden) {
            val person = HiddenPerson(ada.id, ada.handle, null, null, redacted = false)
            hiddenRepository.served = Outcome.Success(listOf(HiddenEntry(person, adaHiddenAt)))
        }
        return HiddenSet(hiddenRepository, tokens, CoroutineScope(Dispatchers.Unconfined)).also {
            runBlocking { it.refetch() }
        }
    }

    private fun writes() = SavedWrites(RecordingSavedRepository(), tokens, CoroutineScope(Dispatchers.Unconfined))

    private val noDoors = CardDoors(onOpenPost = {}, onOpenComment = { _, _, _ -> }, onOpenActor = {}, onOpenTopic = {})

    private val host = SnackbarHostState()

    private fun renderHistory(adaHidden: Boolean, viewerId: String = "reader-id") {
        val store = hiddenSet(adaHidden)
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                HistoryScreen(
                    state = HistoryUiState(
                        entries = listOf(HistoryEntry(HistoryCard.Post(byAda), Instant.now())),
                        loading = false,
                        answered = HistoryAsk(null, emptySet()),
                    ),
                    writes = writes(),
                    callbacks = HistoryCallbacks(),
                    doors = HistoryDoors(cards = noDoors, onComposeWithTag = {}),
                    hidden = store,
                    hooks = CardHooks(viewerId = viewerId),
                )
            }
        }
    }

    private fun renderSaved(adaHidden: Boolean) {
        val store = hiddenSet(adaHidden)
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                Column {
                    SavedScreen(
                        state = SavedUiState(
                            entries = listOf(SavedEntry(SavedCard.Post(byAda.copy(viewerBookmarkedAt = Instant.now())), Instant.now())),
                            loading = false,
                        ),
                        writes = writes(),
                        onRefresh = {},
                        onLoadMore = {},
                        onRetryMore = {},
                        onSearch = {},
                        onBack = {},
                        doors = noDoors,
                        hidden = store,
                        hooks = CardHooks(viewerId = "reader-id"),
                    )
                    CograSnackbarHost(host)
                }
            }
        }
    }

    /** A profile's posts view, under the page's own saved host as the profile provides it. */
    private fun renderProfilePosts(adaHidden: Boolean, viewerId: String = "reader-id") {
        val store = hiddenSet(adaHidden)
        val writes = writes()
        compose.setContent {
            val saved = rememberSavedHost(writes, host, DataNode("profile") / "snackbar", null, store)
            CompositionLocalProvider(LocalSnackbarHostState provides host, LocalSavedHost provides saved) {
                HostedCardsScope(
                    doors = noDoors,
                    routes = HostedCardRoutes(
                        viewerId = viewerId,
                        signedIn = true,
                        onEditPost = {},
                        onCitePost = {},
                        onReply = {},
                        onEditComment = { _, _ -> },
                        onSignInOrJoin = {},
                    ),
                    hooks = CardHooks(viewerId = viewerId),
                    revealed = emptyMap(),
                    tag = "profile",
                    notify = {},
                ) { hosted -> Column { hosted.post(byAda, DataNode("profile") / "posts" / "card") } }
            }
        }
    }

    private fun renderDetail(adaHidden: Boolean, onRequireAccount: (() -> Unit)? = null) {
        val store = hiddenSet(adaHidden)
        compose.setContent {
            PostDetailScreen(
                state = PostDetailUiState(loading = false, post = byAda),
                viewerId = "reader-id",
                onRefresh = {},
                onReveal = { _, _ -> },
                onEdit = {},
                onOpenActor = {},
                onOpenPost = {},
                onOpenTopic = {},
                onReference = {},
                onShare = {},
                onBack = {},
                saved = writes(),
                hidden = store,
                onRequireAccount = onRequireAccount,
            )
        }
    }

    /** Asserts [rows] stand in the sheet top to bottom, each under its registered node. */
    private fun assertRowsInOrder(vararg rows: String) {
        val tops = rows.map { compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
    }

    private fun snackbarMessage(): String? = host.currentSnackbarData?.visuals?.message

    // -- History --

    /** HistoryPostMenu.md:3, :5 — `history.menuSheet` with the reader's rows, Report at the tail. */
    @Test
    fun historysPostMenuRaisesItsSheetWithTheReadersRowsInOrder() {
        renderHistory(adaHidden = false)
        compose.onNodeWithTag("history.card.menu").performClick()
        compose.onNodeWithTag("history.menuSheet").assertExists()
        assertRowsInOrder(
            "history.menuSheet.save",
            "history.menuSheet.cite",
            "history.menuSheet.hide",
            "history.menuSheet.license",
            "history.menuSheet.report",
        )
        compose.onNodeWithTag("history.menuSheet.hide").assertTextEquals("Hide @ada")
    }

    /** HistoryPostMenuOwn.md:5 — the own rows under `history.menuSheet`, no Hide and no Report. */
    @Test
    fun historysOwnPostMenuRaisesTheOwnRowsUnderItsSheet() {
        renderHistory(adaHidden = false, viewerId = ada.id)
        compose.onNodeWithTag("history.card.menu").performClick()
        assertRowsInOrder(
            "history.menuSheet.save",
            "history.menuSheet.cite",
            "history.menuSheet.edit",
            "history.menuSheet.markSensitive",
            "history.menuSheet.remove",
            "history.menuSheet.license",
        )
        compose.onNodeWithTag("history.menuSheet.hide").assertDoesNotExist()
        compose.onNodeWithTag("history.menuSheet.report").assertDoesNotExist()
    }

    /** HistoryPostMenu.md:13 — hiding leaves History as it stood and names the author with Undo. */
    @Test
    fun hidingFromHistoryKeepsTheCardAndSaysSoWithUndo() {
        renderHistory(adaHidden = false)
        compose.onNodeWithTag("history.card.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("history.card:p1").assertExists()
        assertThat(snackbarMessage()).isEqualTo("@ada is hidden — their posts stay out of your feed.")
    }

    /** HistoryPostMenu.md:17 — the row reads `Unhide @ada` while the author is hidden, under its one name. */
    @Test
    fun historysHideRowReadsUnhideWhileTheAuthorIsHidden() {
        renderHistory(adaHidden = true)
        compose.onNodeWithTag("history.card.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.hide").assertTextEquals("Unhide @ada")
    }

    /**
     * HistoryPostMenu.md:19 — the tap unhides with no confirm, History stands,
     * the snackbar says so with Undo; Undo hides again at the first moment.
     */
    @Test
    fun unhidingFromHistoryUnhidesAndUndoHidesAgainAtTheFirstMoment() {
        renderHistory(adaHidden = true)
        compose.onNodeWithTag("history.card.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
        assertThat(hiddenRepository.hides).isEmpty()
        compose.onNodeWithTag("history.card:p1").assertExists()
        assertThat(snackbarMessage()).isEqualTo("@ada is unhidden — their posts can reach your feed again.")
        assertThat(host.currentSnackbarData?.visuals?.actionLabel).isEqualTo("Undo")

        host.currentSnackbarData?.performAction()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to adaHiddenAt)
        // Hidden again, the row reads Unhide once more.
        compose.onNodeWithTag("history.card.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.hide").assertTextEquals("Unhide @ada")
    }

    // -- Saved --

    /** SavedPostMenu.md:3, :5 — `saved.menuSheet`: Unsave, Cite, Hide, License terms, Report. */
    @Test
    fun savedsPostMenuRaisesItsSheetWithUnsaveFirst() {
        renderSaved(adaHidden = false)
        compose.onNodeWithTag("saved.card.menu").performClick()
        compose.onNodeWithTag("saved.menuSheet").assertExists()
        compose.onNodeWithTag("saved.menuSheet.save").assertTextEquals("Unsave")
        assertRowsInOrder(
            "saved.menuSheet.save",
            "saved.menuSheet.cite",
            "saved.menuSheet.hide",
            "saved.menuSheet.license",
            "saved.menuSheet.report",
        )
    }

    /** SavedPostMenu.md:19 — a hidden author's post still standing in Saved reads `Unhide @ada`. */
    @Test
    fun savedsHideRowReadsUnhideWhileTheAuthorIsHidden() {
        renderSaved(adaHidden = true)
        compose.onNodeWithTag("saved.card.menu").performClick()
        compose.onNodeWithTag("saved.menuSheet.hide").assertTextEquals("Unhide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
        compose.onNodeWithText("@ada is unhidden — their posts can reach your feed again.").assertExists()
    }

    /**
     * ReaderPostMenu.md:25 — an unhide that does not go through reverts, and
     * the card it was made from says `That didn't go through.` with Retry,
     * which asks the unhide again.
     */
    @Test
    fun aFailedUnhideRevertsAndItsCardSaysRetry() {
        hiddenRepository.unhideAnswers.addLast(Outcome.Failed(IOException("down")))
        renderSaved(adaHidden = true)
        compose.onNodeWithTag("saved.card.menu").performClick()
        compose.onNodeWithTag("saved.menuSheet.hide").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("That didn't go through.").assertExists()
        compose.onNodeWithTag("saved_post_p1_row_line_retry").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id, ada.id)
    }

    // -- A profile's posts view --

    /** ProfilePostsMenu.md:3, :5, :7 — the card's menu is `profile.menuSheet`, Hide kept on the author's page. */
    @Test
    fun aProfilePostsMenuRaisesTheProfilesSheetWithTheReadersRows() {
        renderProfilePosts(adaHidden = false)
        compose.onNodeWithTag("profile.posts.card.menu").performClick()
        compose.onNodeWithTag("profile.menuSheet").assertExists()
        assertRowsInOrder(
            "profile.menuSheet.save",
            "profile.menuSheet.cite",
            "profile.menuSheet.hide",
            "profile.menuSheet.license",
            "profile.menuSheet.report",
        )
        compose.onNodeWithTag("profile.menuSheet.hide").assertTextEquals("Hide @ada")
    }

    /** ProfilePostsMenuOwn.md:5 — the own post's rows under `profile.menuSheet`, no Hide and no Report. */
    @Test
    fun theOwnProfilesPostMenuRaisesTheOwnRows() {
        renderProfilePosts(adaHidden = false, viewerId = ada.id)
        compose.onNodeWithTag("profile.posts.card.menu").performClick()
        assertRowsInOrder(
            "profile.menuSheet.save",
            "profile.menuSheet.cite",
            "profile.menuSheet.edit",
            "profile.menuSheet.markSensitive",
            "profile.menuSheet.remove",
            "profile.menuSheet.license",
        )
        compose.onNodeWithTag("profile.menuSheet.hide").assertDoesNotExist()
        compose.onNodeWithTag("profile.menuSheet.report").assertDoesNotExist()
    }

    /** ReaderPostMenu.md:21 — a hidden author's post on their page reached by a link reads `Unhide @ada`. */
    @Test
    fun aProfilePostsHideRowReadsUnhideWhileTheAuthorIsHidden() {
        renderProfilePosts(adaHidden = true)
        compose.onNodeWithTag("profile.posts.card.menu").performClick()
        compose.onNodeWithTag("profile.menuSheet.hide").assertTextEquals("Unhide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
        assertThat(snackbarMessage()).isEqualTo("@ada is unhidden — their posts can reach your feed again.")
    }

    // -- The post detail --

    /** ReaderPostMenu.md:21, :23 — the detail's row reads `Unhide @ada`; the tap unhides and the reader stays. */
    @Test
    fun theDetailsHideRowReadsUnhideAndTheTapUnhides() {
        renderDetail(adaHidden = true)
        compose.onNodeWithTag("postDetail.header.menu").performClick()
        compose.onNodeWithTag("postDetail.menuSheet.hide").assertTextEquals("Unhide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
        compose.onNodeWithText("@ada is unhidden — their posts can reach your feed again.").assertExists()
        compose.onNodeWithTag("postDetail.menuSheet").assertDoesNotExist()
    }

    /** ReaderPostMenu.md:5, :15 — not hidden, the row reads `Hide @ada` and hides with no confirm. */
    @Test
    fun theDetailsHideRowReadsHideWhileTheAuthorIsNotHidden() {
        renderDetail(adaHidden = false)
        compose.onNodeWithTag("postDetail.header.menu").performClick()
        compose.onNodeWithTag("postDetail.menuSheet.hide").assertTextEquals("Hide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
    }

    /**
     * ProfileDeletedMenu.md:9, :11 (seam 315: `Unhide this account` blessed) —
     * the shared hide row of a hidden deleted account reads `Unhide this
     * account`, names no handle, and its tap unhides with the nameless snackbar.
     */
    @Test
    fun aHiddenDeletedAccountsRowReadsUnhideThisAccount() {
        val deleted = HiddenPerson("del-id", handle = null, displayName = null, avatarUrl = null, redacted = true)
        hiddenRepository.served = Outcome.Success(listOf(HiddenEntry(deleted, adaHiddenAt)))
        val store = HiddenSet(hiddenRepository, tokens, CoroutineScope(Dispatchers.Unconfined)).also {
            runBlocking { it.refetch() }
        }
        val writes = writes()
        compose.setContent {
            val saved = rememberSavedHost(writes, host, null, null, store)
            val row = saved?.hideRow(deleted, "del-id", "hide_row")
            TextButton(
                onClick = { row?.onSelect?.invoke() },
                modifier = Modifier.testTag("hide_row"),
            ) { Text(row?.label.orEmpty()) }
        }
        compose.onNodeWithText("Unhide this account").assertExists()
        compose.onNodeWithTag("hide_row").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly("del-id")
        assertThat(snackbarMessage()).isEqualTo("This account is unhidden — its posts can reach your feed again.")
    }

    /** GuestGate.md:5 — a guest's tap on the hide row raises the join prompt and sends nothing. */
    @Test
    fun aGuestsHideRaisesTheJoinPromptAndSendsNothing() {
        var asked = 0
        renderDetail(adaHidden = false, onRequireAccount = { asked++ })
        compose.onNodeWithTag("postDetail.header.menu").performClick()
        compose.onNodeWithTag("postDetail.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(asked).isEqualTo(1)
        assertThat(hiddenRepository.hides).isEmpty()
    }
}
