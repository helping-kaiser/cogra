// A TAGGED COMMENT'S ⋮ ON THE TAG PAGE (round 60; TagPage.md:19), compiled
// from its four sidecars line by line — TagPageCommentMenu, TagPageCommentMenuOwn,
// TagPageCommentRemovedMenu and TagPageCommentRemovedMenuOwn. The comment's whole
// menu on `tagPage.menuSheet`: the reader's on someone else's, removed or not;
// the own one on the reader's, less Edit and Remove once removed. The same rows,
// by the same rule, as the thread's, History's, Saved's and the profile's —
// `CommentMenuPlacement` reused, no second menu. Fakes only: nothing leaves the JVM.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileComment
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.feature.saved.LocalSavedHost
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
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class TagPageCommentMenusTest {

    @get:Rule
    val compose = createComposeRule()

    private val reader = "reader-id"
    private val ada = ActorRef("ada-id", "ada", "Ada Okonkwo")
    private val adas: CommentView = testComment("c-ada", author = ada)
    private val mine: CommentView = testComment("c-mine", author = ActorRef(reader, "sol", "Sol Amari"))
    private val removal = Removal(Instant.now(), RemovalAgent.AUTHOR)
    private val passedProposal = Removal(Instant.now(), RemovalAgent.MODERATION)

    private val onPost = CommentTarget.Post(
        id = "p1",
        title = testModeratedField("Salt maps of the coast road"),
        content = testModeratedField("words"),
        mimeTypes = emptyList(),
        coverUrl = null,
        authorHandle = "sol",
        moderation = ModerationState.NORMAL,
        removed = false,
    )

    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", reader) }
    private val hiddenRepository = RecordingHiddenRepository()
    private val savedRepository = RecordingSavedRepository()
    private val host = SnackbarHostState()

    private val reports = mutableListOf<ReportAsk>()
    private val recordReport: ReportSheetSlot = { ask, onDismiss, _ ->
        reports += ask
        onDismiss()
    }
    private val edits = mutableListOf<Pair<String, String>>()
    private val cites = mutableListOf<String>()
    private val readFor = mutableListOf<String>()
    private val reads = InboundReads(
        citedBy = { id ->
            readFor += id
            Outcome.Success(emptyList())
        },
        opinionsOn = { id ->
            readFor += id
            Outcome.Success(emptyList())
        },
    )

    private val tagComment = DataNode("tagPage") / "commentCard"
    private val menu = "tagPage.commentCard.menu"
    private val sheet = "tagPage.menuSheet"
    private fun row(name: String) = "$sheet.$name"

    private fun render(comment: CommentView) {
        val hidden = HiddenSet(hiddenRepository, tokens, CoroutineScope(Dispatchers.Unconfined)).also {
            runBlocking { it.refetch() }
        }
        val writes = SavedWrites(savedRepository, tokens, CoroutineScope(Dispatchers.Unconfined))
        compose.setContent {
            // The tag page's own host (`TopicScreen`): its menus' words on `tagPage.snackbar`.
            val saved = rememberSavedHost(writes, host, DataNode("tagPage") / "snackbar", null, hidden)
            CompositionLocalProvider(
                LocalSnackbarHostState provides host,
                LocalSavedHost provides saved,
                LocalInboundReads provides reads,
            ) {
                HostedCardsScope(
                    doors = CardDoors(
                        onOpenPost = {},
                        onOpenComment = { _, _, _ -> },
                        onOpenActor = {},
                        onOpenTopic = {},
                    ),
                    routes = HostedCardRoutes(
                        viewerId = reader,
                        signedIn = true,
                        onEditPost = {},
                        onCitePost = {},
                        onReply = {},
                        onEditComment = { _, _ -> },
                        onSignInOrJoin = {},
                    ),
                    hooks = CardHooks(
                        viewerId = reader,
                        onCitePost = { cites += it },
                        onEditComment = { id, title -> edits += id to title },
                    ),
                    revealed = emptyMap(),
                    tag = "tagPage",
                    notify = {},
                    placement = HostedPlacement.TagPage,
                    reportSheet = recordReport,
                ) { hosted ->
                    Column {
                        hosted.comment(ProfileComment(comment, onPost, "p1"), tagComment, tagComment, null)
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    private fun openMenu(comment: CommentView) {
        render(comment)
        compose.onNodeWithTag(menu).performClick()
        compose.waitForIdle()
    }

    private fun assertRowsInOrder(vararg rows: String) {
        val tops = rows.map { compose.onNodeWithTag(row(it)).fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
    }

    private fun assertAbsent(vararg rows: String) = rows.forEach { compose.onNodeWithTag(row(it)).assertDoesNotExist() }

    /** The sheet rose over the page, unstacked: the card stands beneath it and no other sheet does. */
    private fun assertRisenOverThePage(commentId: String) {
        compose.onNodeWithTag(sheet).assertExists()
        compose.onNodeWithTag("tagPage.commentCard:$commentId").assertExists()
        compose.onNodeWithTag("postDetail.threadSheet").assertDoesNotExist()
    }

    private fun assertClosed() = compose.onNodeWithTag(sheet).assertDoesNotExist()

    /** The scrim: Material's own dismiss, which Back, the swipe and Escape reach alike. */
    private fun dismissByScrim() {
        compose.onNodeWithTag(sheet).assertExists()
        compose.onNodeWithContentDescription("Close sheet").performClick()
        compose.waitForIdle()
    }

    private fun assertNothingChanged(commentId: String) {
        assertClosed()
        compose.onNodeWithTag("tagPage.commentCard:$commentId").assertExists()
        assertThat(hiddenRepository.hides).isEmpty()
        assertThat(savedRepository.sets).isEmpty()
        assertThat(reports).isEmpty()
        assertThat(edits).isEmpty()
        assertThat(cites).isEmpty()
    }

    private fun snackbar(): NodeSnackbarVisuals? = host.currentSnackbarData?.visuals as? NodeSnackbarVisuals

    // -- TagPageCommentMenu.md: someone else's comment --

    // :3
    @Test
    fun tapATaggedCommentsMenuGivenSomeoneElsesRaisesTheSheetUnstackedOverThePage() {
        openMenu(adas)
        assertRisenOverThePage("c-ada")
    }

    // :5
    @Test
    fun theSheetReadsTheReadersCommentMenuReportAtTheTail() {
        openMenu(adas)
        assertRowsInOrder("save", "cite", "hide", "citedBy", "opinions", "license", "report")
        compose.onNodeWithTag(row("save")).assertTextEquals("Save")
        compose.onNodeWithTag(row("cite")).assertTextEquals("Cite in a new post")
        compose.onNodeWithTag(row("hide")).assertTextEquals("Hide @ada")
        compose.onNodeWithTag(row("opinions")).assertTextEquals("Opinions on this")
        compose.onNodeWithTag(row("license")).assertTextEquals("License terms")
        assertAbsent("edit", "remove")
    }

    // :7
    @Test
    fun tapHideClosesTheSheetKeepsThePageAndSaysSoWithUndoNoConfirm() {
        openMenu(adas)
        compose.onNodeWithTag(row("hide")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("tagPage.commentCard:c-ada").assertExists()
        assertThat(hiddenRepository.hides.map { it.first }).containsExactly("ada-id")
        assertThat(snackbar()?.message).isEqualTo("@ada is hidden.")
        assertThat(snackbar()?.actionLabel).isEqualTo("Undo")
        assertThat(snackbar()?.node?.tag).isEqualTo("tagPage.snackbar")
    }

    // :9
    @Test
    fun tapOpinionsClosesTheMenuAndRaisesTheCommentsOpinionsOverThePage() {
        openMenu(adas)
        compose.onNodeWithTag(row("opinions")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(readFor).containsExactly("c-ada")
        compose.onNodeWithText("No opinions yet").assertExists()
        compose.onNodeWithTag("tagPage.commentCard:c-ada").assertExists()
    }

    // :11
    @Test
    fun tapCitedByClosesTheMenuAndRaisesWhatCitesTheCommentOverThePage() {
        openMenu(adas)
        compose.onNodeWithTag(row("citedBy")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(readFor).containsExactly("c-ada")
        compose.onNodeWithText("Nothing cites this yet").assertExists()
    }

    // :13
    @Test
    fun tapLicenseClosesTheMenuAndRaisesTheCommentsTermsInASheet() {
        openMenu(adas)
        compose.onNodeWithTag(row("license")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("license_sheet").assertExists()
    }

    // :15
    @Test
    fun tapReportClosesTheMenuAndRaisesTheConfirmForTheCommentNothingSent() {
        openMenu(adas)
        compose.onNodeWithTag(row("report")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(reports).containsExactly(ReportAsk("c-ada", ReportKind.Comment))
    }

    // :15 — the confirm the report raises is the comment's: `Report this comment?`.
    @Test
    fun theReportConfirmForACommentReadsReportThisComment() {
        compose.setContent {
            ReportConfirmSheet(
                kind = ReportKind.Comment,
                sending = false,
                onReport = {},
                onDismiss = {},
                testTag = "t",
                node = DataNode("tagPage") / "reportSheet",
            )
        }
        compose.onNodeWithTag("tagPage.reportSheet.title").assertTextEquals("Report this comment?")
    }

    // :17
    @Test
    fun dismissingTheMenuClosesTheSheetAndNothingChanges() {
        openMenu(adas)
        dismissByScrim()
        assertNothingChanged("c-ada")
    }

    // -- TagPageCommentMenuOwn.md: the reader's own comment --

    // :3
    @Test
    fun tapATaggedCommentsMenuGivenTheReadersOwnRaisesTheSheetUnstackedOverThePage() {
        openMenu(mine)
        assertRisenOverThePage("c-mine")
    }

    // :5
    @Test
    fun theOwnSheetReadsTheOwnCommentMenuNoHideNoReport() {
        openMenu(mine)
        assertRowsInOrder("save", "cite", "edit", "remove", "citedBy", "opinions", "license")
        compose.onNodeWithTag(row("edit")).assertTextEquals("Edit")
        compose.onNodeWithTag(row("remove")).assertTextEquals("Remove")
        assertAbsent("hide", "report")
    }

    // :7
    @Test
    fun tapEditClosesTheMenuAndOpensTheCommentsEdit() {
        openMenu(mine)
        compose.onNodeWithTag(row("edit")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(edits).containsExactly("c-mine" to "Salt maps of the coast road")
    }

    // :9
    @Test
    fun tapRemoveClosesTheMenuAndRaisesTheThinkTwiceDialogOverThePage() {
        openMenu(mine)
        compose.onNodeWithTag(row("remove")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("tagPage_comment_c-mine_remove_confirm").assertExists()
        compose.onNodeWithTag("tagPage.commentCard:c-mine").assertExists()
    }

    // :11
    @Test
    fun tapOpinionsOnTheOwnMenuRaisesTheCommentsOpinionsOverThePage() {
        openMenu(mine)
        compose.onNodeWithTag(row("opinions")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(readFor).containsExactly("c-mine")
        compose.onNodeWithText("No opinions yet").assertExists()
    }

    // :13
    @Test
    fun tapCitedByOnTheOwnMenuRaisesWhatCitesTheCommentOverThePage() {
        openMenu(mine)
        compose.onNodeWithTag(row("citedBy")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(readFor).containsExactly("c-mine")
        compose.onNodeWithText("Nothing cites this yet").assertExists()
    }

    // :15
    @Test
    fun tapLicenseOnTheOwnMenuRaisesTheCommentsTermsInASheet() {
        openMenu(mine)
        compose.onNodeWithTag(row("license")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("license_sheet").assertExists()
    }

    // :17
    @Test
    fun dismissingTheOwnMenuClosesTheSheetAndNothingChanges() {
        openMenu(mine)
        dismissByScrim()
        assertNothingChanged("c-mine")
    }

    // -- TagPageCommentRemovedMenu.md: someone else's removed comment --

    // :3
    @Test
    fun tapARemovedTaggedCommentsMenuGivenSomeoneElsesRaisesTheSheetUnstackedOverThePage() {
        openMenu(adas.copy(removal = removal))
        assertRisenOverThePage("c-ada")
    }

    // :5
    @Test
    fun theRemovedSheetReadsTheReadersCommentMenuWhole() {
        openMenu(adas.copy(removal = removal))
        assertRowsInOrder("save", "cite", "hide", "citedBy", "opinions", "license", "report")
        compose.onNodeWithTag(row("hide")).assertTextEquals("Hide @ada")
        assertAbsent("edit", "remove")
    }

    // :7
    @Test
    fun theRowsReadTheSameWhicheverRemovedTheComment() {
        openMenu(adas.copy(removal = passedProposal))
        assertRowsInOrder("save", "cite", "hide", "citedBy", "opinions", "license", "report")
        assertAbsent("edit", "remove")
    }

    // :9
    @Test
    fun tapSaveKeepsTheRemovedCommentAsAnyCommentIsKeptAndClosesTheSheet() {
        openMenu(adas.copy(removal = removal))
        compose.onNodeWithTag(row("save")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(savedRepository.sets.map { it.first }).containsExactly("c-ada")
    }

    // :11
    @Test
    fun tapHideOnARemovedCommentKeepsItsMarkAndSaysSoWithUndo() {
        openMenu(adas.copy(removal = removal))
        compose.onNodeWithTag(row("hide")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("tagPage.commentCard:c-ada").assertExists()
        compose.onNodeWithTag("tagPage.commentCard.removalMark", useUnmergedTree = true).assertExists()
        assertThat(hiddenRepository.hides.map { it.first }).containsExactly("ada-id")
        assertThat(snackbar()?.message).isEqualTo("@ada is hidden.")
        assertThat(snackbar()?.actionLabel).isEqualTo("Undo")
    }

    // :13
    @Test
    fun tapLicenseOnARemovedCommentRaisesTheTermsItWasPublishedUnder() {
        openMenu(adas.copy(removal = removal))
        compose.onNodeWithTag(row("license")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("license_sheet").assertExists()
    }

    // :15
    @Test
    fun tapReportOnARemovedCommentRaisesTheConfirmNothingSent() {
        openMenu(adas.copy(removal = removal))
        compose.onNodeWithTag(row("report")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(reports).containsExactly(ReportAsk("c-ada", ReportKind.Comment))
    }

    // :17
    @Test
    fun dismissingTheRemovedMenuClosesTheSheetAndNothingChanges() {
        openMenu(adas.copy(removal = removal))
        dismissByScrim()
        assertNothingChanged("c-ada")
    }

    // -- TagPageCommentRemovedMenuOwn.md: the reader's own removed comment --

    // :3
    @Test
    fun tapARemovedTaggedCommentsMenuGivenTheReadersOwnRaisesTheSheetUnstackedOverThePage() {
        openMenu(mine.copy(removal = removal))
        assertRisenOverThePage("c-mine")
    }

    // :5
    @Test
    fun theOwnRemovedSheetReadsTheOwnMenuLessEditAndRemove() {
        openMenu(mine.copy(removal = removal))
        assertRowsInOrder("save", "cite", "citedBy", "opinions", "license")
        assertAbsent("edit", "remove", "hide", "report")
    }

    // :7
    @Test
    fun tapLicenseOnTheOwnRemovedCommentRaisesTheTermsItWasPublishedUnder() {
        openMenu(mine.copy(removal = removal))
        compose.onNodeWithTag(row("license")).performClick()
        compose.waitForIdle()
        assertClosed()
        compose.onNodeWithTag("license_sheet").assertExists()
    }

    // :9
    @Test
    fun tapOpinionsOnTheOwnRemovedCommentRaisesItsOpinionsOverThePage() {
        openMenu(mine.copy(removal = removal))
        compose.onNodeWithTag(row("opinions")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(readFor).containsExactly("c-mine")
    }

    // :11
    @Test
    fun tapCitedByOnTheOwnRemovedCommentRaisesWhatCitesItOverThePage() {
        openMenu(mine.copy(removal = removal))
        compose.onNodeWithTag(row("citedBy")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(readFor).containsExactly("c-mine")
    }

    // :13 — the cite opens the post wizard as New post does, the removed
    // comment riding along (the shell's `ComposePost(referenceTargetId)`).
    @Test
    fun tapCiteOnTheOwnRemovedCommentOpensTheWizardWithTheCommentRidingAlong() {
        openMenu(mine.copy(removal = removal))
        compose.onNodeWithTag(row("cite")).performClick()
        compose.waitForIdle()
        assertClosed()
        assertThat(cites).containsExactly("c-mine")
    }

    // :15
    @Test
    fun dismissingTheOwnRemovedMenuClosesTheSheetAndNothingChanges() {
        openMenu(mine.copy(removal = removal))
        dismissByScrim()
        assertNothingChanged("c-mine")
    }

    // -- The census: each board's registered rows (`r60/registered-paths.txt`) under the one sheet --

    private fun assertCensus(comment: CommentView, vararg rows: String) {
        openMenu(comment)
        compose.onNodeWithTag(sheet).assertExists()
        val missing = rows.filter { name ->
            compose.onAllNodesWithTag(row(name), useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
        }
        assertThat(missing).isEmpty()
    }

    @Test
    fun theTagPageCommentMenuBoardsRowsStand() =
        assertCensus(adas, "dragHandle", "save", "cite", "hide", "citedBy", "opinions", "license", "report")

    @Test
    fun theTagPageCommentMenuOwnBoardsRowsStand() =
        assertCensus(mine, "dragHandle", "save", "cite", "edit", "remove", "citedBy", "opinions", "license")

    @Test
    fun theTagPageCommentRemovedMenuBoardsRowsStand() = assertCensus(
        adas.copy(removal = removal),
        "dragHandle", "save", "cite", "hide", "citedBy", "opinions", "license", "report",
    )

    @Test
    fun theTagPageCommentRemovedMenuOwnBoardsRowsStand() =
        assertCensus(mine.copy(removal = removal), "dragHandle", "save", "cite", "citedBy", "opinions", "license")
}
