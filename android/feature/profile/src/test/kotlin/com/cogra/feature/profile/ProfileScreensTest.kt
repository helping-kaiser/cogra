package com.cogra.feature.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.crypto.Family
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ProfileComment
import com.cogra.domain.ProfileFigures
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordOpinion
import com.cogra.domain.RecordRow
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Duration
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ProfileScreensTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.parse("2026-10-22T12:00:00Z")

    /** One stance slot the screen filled: its target, the target's words, its node. */
    private data class Slot(val target: String, val label: String, val node: String)

    private fun render(
        state: ProfileUiState,
        onEdit: () -> Unit = {},
        onOpenInvites: () -> Unit = {},
        onOpenSettings: () -> Unit = {},
        onOpenPost: (String) -> Unit = {},
        onTabChange: (ProfileTab) -> Unit = {},
        onLoadMore: () -> Unit = {},
        cardsHost: ProfileCardsHost = cardsDrawn,
        onBack: (() -> Unit)? = null,
        onStance: (Slot) -> Unit = {},
        profileSavedResult: Boolean = false,
        onProfileSavedResultConsumed: () -> Unit = {},
        onRetry: () -> Unit = {},
        onChats: (() -> Unit)? = null,
        onMessage: () -> Unit = {},
        onRequireAccount: (() -> Unit)? = null,
        backDescription: String? = null,
        onOpenHistory: () -> Unit = {},
        onOpenOpinions: () -> Unit = {},
    ) {
        compose.setContent {
            ProfileScreen(
                stanceControl = { target, label, node -> onStance(Slot(target, label, node.tag)) },
                state = state,
                profileSavedResult = profileSavedResult,
                onProfileSavedResultConsumed = onProfileSavedResultConsumed,
                onTabChange = onTabChange,
                onLoadMore = onLoadMore,
                onRetry = onRetry,
                cardsHost = cardsHost,
                onEdit = onEdit,
                onOpenSettings = onOpenSettings,
                onOpenInvites = onOpenInvites,
                onOpenPost = onOpenPost,
                onBack = onBack,
                onChats = onChats,
                onMessage = onMessage,
                onRequireAccount = onRequireAccount,
                backDescription = backDescription,
                onOpenHistory = onOpenHistory,
                onOpenOpinions = onOpenOpinions,
                now = now,
            )
        }
    }

    private fun loaded(own: Boolean = false, applicant: Boolean = false) = ProfileUiState(
        loading = false,
        profile = testProfile(
            id = "u1",
            handle = "ada",
            displayName = "Ada L",
            bio = "Curious.",
            websiteUrl = "https://ada.example",
        ),
        own = own,
        applicant = applicant,
    )

    private fun deleted() = ProfileUiState(
        loading = false,
        profile = testProfile(id = "u9", handle = "x7q").copy(
            displayName = ModeratedField(null, FieldStatus.REDACTED),
            bio = ModeratedField(null, FieldStatus.REDACTED),
            websiteUrl = ModeratedField(null, FieldStatus.REDACTED),
        ),
    )

    private fun act(family: Family = Family.PUBLISH) = RecordRow("r", family, true, "x", null)

    /** Each locked Reply the comment slot was handed and tapped. */
    private var lockedTaps = 0

    /**
     * The shell's cards, stood in: each card a line wearing the node the
     * screen hands it, keyed by the thing's id — the card itself is the feed's
     * and is tested there. A comment's line answers a tap with its locked
     * Reply, when it was handed one.
     */
    private val cardsDrawn: ProfileCardsHost = { _, content ->
        content(
            ProfileCards(
                post = { post, node -> Text(post.id, Modifier.dataNode(node.keyed(post.id))) },
                comment = { listed, node, repliesNode, lockedReply ->
                    Column {
                        Text(
                            listed.comment.id,
                            Modifier
                                .dataNode(node.keyed(listed.comment.id))
                                .clickable {
                                    if (lockedReply != null) {
                                        lockedTaps++
                                        lockedReply()
                                    }
                                },
                        )
                        Text("replies", Modifier.dataNode(repliesNode.keyed(listed.comment.id)))
                    }
                },
            ),
        )
    }

    private fun posts(vararg ids: String) = ids.map { testPost(it) }

    private fun comments(vararg ids: String) =
        ids.map { ProfileComment(testComment(it), target = null, threadPostId = "p1") }

    private val id = DataNode("profile") / "identity"
    private val row = id / "actionRow"

    // ProfileOwnMenu.md: the own ⋮'s History row opens History — no longer
    // inert once History is built (H3).
    @Test
    fun theOwnMenusHistoryRowOpensHistory() {
        var opened = 0
        render(loaded(own = true), onOpenHistory = { opened++ })
        compose.onNodeWithTag((row / "menu").tag).performScrollTo().performClick()
        compose.onNodeWithTag("profile.menuSheet.history").performClick()
        assertThat(opened).isEqualTo(1)
    }

    @Test
    fun aSavedEditConfirmsOnTheProfilesOwnSnackbar() {
        render(loaded(own = true), profileSavedResult = true)
        compose.onNodeWithTag("profile.snackbar.message").assertTextEquals("Profile saved")
    }

    @Test
    fun theSavedResultIsConsumedOnlyAfterTheSnackbarHasRun() {
        // Consuming first flips the effect's key and cancels the
        // suspending show, so the confirmation died in the frame it was
        // posted (HT-8). The whole bug is the ordering, and only a
        // round-tripping consume can see it.
        var consumed = false
        render(
            loaded(own = true),
            profileSavedResult = true,
            onProfileSavedResultConsumed = { consumed = true },
        )
        assertThat(consumed).isFalse()
        compose.mainClock.advanceTimeBy(10_000)
        assertThat(consumed).isTrue()
    }

    // design/readme.md, "The pull-down lives on every full-screen
    // scrolling root" (ruled 2026-09-10): the loaded chronicle renders
    // underneath the PullToRefreshBox, and the pull is not fired by it.
    @Test
    fun theLoadedChronicleRendersUnderThePullToRefreshWrapper() {
        var retried = false
        render(loaded(), onRetry = { retried = true })
        compose.onNodeWithTag("profile.chronicle").assertExists()
        assertThat(retried).isFalse()
    }

    // ProfileHeader.jsx: the compact header, every part on its registered path.
    @Test
    fun theOwnHeaderRendersItsFieldsWithTheHandle() {
        render(loaded(own = true))
        compose.onNodeWithTag((id / "avatar").tag).assertExists()
        compose.onNodeWithTag((id / "name").tag).assertTextEquals("Ada L")
        compose.onNodeWithTag((id / "handle").tag).assertTextEquals("@ada")
        compose.onNodeWithTag((id / "bio").tag).assertTextEquals("Curious.")
        compose.onNodeWithTag((id / "website").tag).assertTextEquals("https://ada.example")
    }

    // `showHandle={false}` on a drill-in: its bar is already titled @handle.
    @Test
    fun aDrillInsHeaderLeavesTheHandleToItsBar() {
        render(loaded(), onBack = {})
        compose.onNodeWithTag((id / "handle").tag).assertDoesNotExist()
        compose.onNodeWithTag("profile.header.title").assertTextEquals("@ada")
    }

    // ProfileOther.md:75: an entry with no history behind it reads `Back to feed`.
    @Test
    fun theWayBackReadsBackToFeedWhenNoOriginIsKnown() {
        render(loaded(), onBack = {})
        compose.onNode(hasContentDescription("Back to feed")).assertExists()
    }

    @Test
    fun theWayBackNamesTheOriginItIsGiven() {
        render(loaded(), onBack = {}, backDescription = "Back to the post")
        compose.onNode(hasContentDescription("Back to the post")).assertExists()
    }

    @Test
    fun anotherActorsProfileCarriesNoOwnAffordances() {
        render(loaded(own = false), onBack = {})
        compose.onNodeWithTag((row / "edit").tag).assertDoesNotExist()
        compose.onNodeWithTag((row / "invites").tag).assertDoesNotExist()
        compose.onNodeWithTag("profile.band.gear").assertDoesNotExist()
    }

    // ProfileOther.md:11: the opinion on the person, worn wide, named by the
    // person's handle (impl debt item 5) — then Message, then the ⋮.
    @Test
    fun anotherActorsRowCarriesTheWideOpinionMessageAndTheMenu() {
        val slots = mutableListOf<Slot>()
        render(loaded(own = false), onBack = {}, onStance = { slots += it })
        assertThat(slots.distinct()).containsExactly(Slot("u1", "@ada", (row / "stance").tag))
        compose.onNodeWithTag((row / "message").tag).assertExists()
        compose.onNodeWithTag((row / "menu").tag).assertExists()
    }

    @Test
    fun messageOpensTheChatsComingSoon() {
        var messaged = false
        render(loaded(own = false), onBack = {}, onMessage = { messaged = true })
        compose.onNodeWithTag((row / "message").tag).performClick()
        assertThat(messaged).isTrue()
    }

    // ProfileOther.md:53: a guest's Message opens the gate, never the chats.
    @Test
    fun aGuestsMessageOpensTheGate() {
        var messaged = false
        var gated = false
        render(
            loaded(own = false),
            onBack = {},
            onMessage = { messaged = true },
            onRequireAccount = { gated = true },
        )
        compose.onNodeWithTag((row / "message").tag).performClick()
        assertThat(gated).isTrue()
        assertThat(messaged).isFalse()
    }

    @Test
    fun theOwnProfileCarriesNoStanceControl() {
        val slots = mutableListOf<Slot>()
        render(loaded(own = true), onStance = { slots += it })
        assertThat(slots).isEmpty()
    }

    // Profile.md:3, :37, :39: the band's gear, then chats.
    @Test
    fun theOwnRootsBandOffersTheGearAndChats() {
        var settings = false
        var chats = false
        render(loaded(own = true), onOpenSettings = { settings = true }, onChats = { chats = true })
        compose.onNodeWithTag("profile.band.gear").performClick()
        compose.onNodeWithTag("profile.band.chats").performClick()
        assertThat(settings).isTrue()
        assertThat(chats).isTrue()
    }

    @Test
    fun theOwnProfileOffersEditAndInvites() {
        var edited = false
        var invites = false
        render(loaded(own = true), onEdit = { edited = true }, onOpenInvites = { invites = true })
        compose.onNodeWithTag((row / "edit").tag).performScrollTo().performClick()
        assertThat(edited).isTrue()
        compose.onNodeWithTag((row / "invites").tag).performScrollTo().performClick()
        assertThat(invites).isTrue()
        compose.onNodeWithTag((row / "message").tag).assertDoesNotExist()
    }

    // ProfileApplicant.md:16-18: locked, still tappable, and the tap says so.
    @Test
    fun anApplicantsInvitesTapExplainsInsteadOfNavigating() {
        var invites = false
        render(loaded(own = true, applicant = true), onOpenInvites = { invites = true })
        compose.onNodeWithTag((row / "invites").tag).performScrollTo().performClick()
        assertThat(invites).isFalse()
        compose.onNodeWithTag("profile.snackbar.message").assertTextEquals("You can invite once you're in.")
    }

    // ProfileApplicant.md:22: the applicant's empty chronicle says what fills it.
    @Test
    fun anApplicantsEmptyChronicleSaysWhenItFills() {
        render(loaded(own = true, applicant = true))
        compose.onNodeWithTag("profile.chronicle.empty")
            .assert(hasText("Nothing here yet. Your posts and opinions show up here once you're in."))
    }

    // ProfileHeader (Q35 closed toward the drawn figures): three figures, each
    // labelled, never merged — another's `Opinions on them` · `Opinions by them`.
    @Test
    fun anothersHeaderCarriesItsThreeFiguresLabelled() {
        render(loaded().copy(figures = ProfileFigures(posts = 12, opinionsOn = 48, opinionsBy = 7)))
        val figures = DataNode("profile") / "identity" / "figures"
        for ((node, value, label) in listOf(
            Triple("posts", "12", "Posts"),
            Triple("stancesOn", "48", "Opinions on them"),
            Triple("stancesTaken", "7", "Opinions by them"),
        )) {
            compose.onNodeWithTag((figures / node / "value").tag, useUnmergedTree = true).assertTextEquals(value)
            compose.onNodeWithTag((figures / node / "label").tag, useUnmergedTree = true).assertTextEquals(label)
        }
    }

    @Test
    fun onesOwnFiguresReadYou() {
        render(loaded(own = true).copy(figures = ProfileFigures(posts = 5, opinionsOn = 9, opinionsBy = 4)))
        val figures = DataNode("profile") / "identity" / "figures"
        compose.onNodeWithTag((figures / "stancesOn" / "label").tag, useUnmergedTree = true)
            .assertTextEquals("Opinions on you")
        compose.onNodeWithTag((figures / "stancesTaken" / "label").tag, useUnmergedTree = true)
            .assertTextEquals("Opinions by you")
    }

    // ProfileOther.md:9, :57 — the figures are one tap target, spoken as each
    // figure's number and words, then opinions on and by the person's handle.
    @Test
    fun anothersFiguresAreOneDoorToTheOpinionsPage() {
        var opened = 0
        render(
            loaded().copy(figures = ProfileFigures(posts = 12, opinionsOn = 48, opinionsBy = 7)),
            onOpenOpinions = { opened++ },
        )
        compose.onNodeWithTag((id / "figures").tag)
            .assertContentDescriptionEquals(
                "12 Posts, 48 Opinions on them, 7 Opinions by them, opinions on and by @ada",
            )
            .performScrollTo()
            .performClick()
        assertThat(opened).isEqualTo(1)
    }

    // Profile.md:13, :49 — one's own: your opinions, both directions.
    @Test
    fun onesOwnFiguresAreOneDoorSpokenInTheSecondPerson() {
        var opened = 0
        render(
            loaded(own = true).copy(figures = ProfileFigures(posts = 5, opinionsOn = 9, opinionsBy = 4)),
            onOpenOpinions = { opened++ },
        )
        compose.onNodeWithTag((id / "figures").tag)
            .assertContentDescriptionEquals(
                "5 Posts, 9 Opinions on you, 4 Opinions by you, your opinions, both directions",
            )
            .performScrollTo()
            .performClick()
        assertThat(opened).isEqualTo(1)
    }

    // ProfileDeleted.md:21, :47 — a deleted account's: opinions on and by this account.
    @Test
    fun aDeletedAccountsFiguresAreOneDoorOnThisAccount() {
        var opened = 0
        render(
            deleted().copy(figures = ProfileFigures(posts = 2, opinionsOn = 3, opinionsBy = 1)),
            onBack = {},
            onOpenOpinions = { opened++ },
        )
        compose.onNodeWithTag((id / "figures").tag)
            .assertContentDescriptionEquals(
                "2 Posts, 3 Opinions on them, 1 Opinions by them, opinions on and by this account",
            )
            .performScrollTo()
            .performClick()
        assertThat(opened).isEqualTo(1)
    }

    // A count the server did not serve is no figure at all, never a false zero.
    @Test
    fun anUnservedFigureIsNotDrawn() {
        render(loaded().copy(figures = ProfileFigures(posts = 3, opinionsOn = null, opinionsBy = null)))
        val figures = DataNode("profile") / "identity" / "figures"
        compose.onNodeWithTag((figures / "posts" / "value").tag, useUnmergedTree = true).assertTextEquals("3")
        compose.onNodeWithTag((figures / "stancesOn").tag, useUnmergedTree = true).assertDoesNotExist()
    }

    // Profile.md (round 22): a tab with nothing in it reads Nothing here yet.
    // below the tab row, the line alone, at `EmptyState`.
    @Test
    fun aMembersEmptyChronicleReadsNothingHereYetAlone() {
        render(loaded())
        compose.onNodeWithTag("profile.chronicle.empty").assert(hasText("Nothing here yet."))
        compose.onNodeWithTag("profile.chronicle.empty.title", useUnmergedTree = true).assertExists()
    }

    // ProfileDeleted.md: the reserved disc, `Deleted account`, no handle
    // anywhere, the mark in the bio's place, no Message, and the anchor
    // names `this account`.
    @Test
    fun aDeletedAccountKeepsTheShellsAndDropsThePerson() {
        val slots = mutableListOf<Slot>()
        render(deleted(), onBack = {}, onStance = { slots += it })
        compose.onNodeWithTag((id / "name").tag).assertTextEquals("Deleted account")
        compose.onNodeWithTag((id / "handle").tag).assertDoesNotExist()
        compose.onNodeWithTag("profile.header.title").assertDoesNotExist()
        compose.onNodeWithTag((id / "removalMark" / "line").tag)
            .assertTextEquals("Deleted by the person whose account it was")
        compose.onNodeWithTag((row / "message").tag).assertDoesNotExist()
        assertThat(slots.distinct().map { it.label }).containsExactly("this account")
    }

    @Test
    fun theChronicleRendersActsAndOpensThePost() {
        var opened: String? = null
        render(
            loaded().copy(
                rows = listOf(
                    RecordRow(
                        id = "act:a:1:publish",
                        family = Family.PUBLISH,
                        genesis = true,
                        snippet = "Hello world",
                        link = RecordLink.ToPost("p1"),
                        landedAt = now.minus(Duration.ofDays(3)),
                    ),
                ),
            ),
            onOpenPost = { opened = it },
        )
        compose.onNodeWithTag("profile.chronicle.act.title", useUnmergedTree = true)
            .assertTextEquals("Published a post")
        compose.onNodeWithTag("profile.chronicle.act.trailing", useUnmergedTree = true).assertTextEquals("3d")
        compose.onNodeWithTag("chronicle_row_open", useUnmergedTree = true).performScrollTo().performClick()
        assertThat(opened).isEqualTo("p1")
    }

    // `Gave an opinion` with `on @mira` and the record's own face.
    @Test
    fun anOpinionActReadsItsVerbAndPerson() {
        render(
            loaded().copy(
                rows = listOf(
                    RecordRow(
                        id = "act:o",
                        family = Family.OPINION,
                        genesis = true,
                        snippet = null,
                        link = null,
                        opinion = RecordOpinion(0.4, 0.5, severed = false),
                        targetHandle = "mira",
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("profile.chronicle.act.title", useUnmergedTree = true)
            .assertTextEquals("Gave an opinion")
        compose.onNodeWithTag("profile.chronicle.act.aside", useUnmergedTree = true).assertTextEquals("on @mira")
    }

    // Profile.md:21 and every board: the row lands on Everything.
    @Test
    fun theTabRowLandsOnEverythingAndSwitches() {
        var picked: ProfileTab? = null
        render(loaded(), onTabChange = { picked = it })
        compose.onNodeWithTag("profile.tabRow.everythingTab").assertIsSelected()
        compose.onNodeWithTag("profile.tabRow.postsTab").performScrollTo().performClick()
        assertThat(picked).isEqualTo(ProfileTab.POSTS)
        compose.onNode(hasContentDescription("What the chronicle shows")).assertExists()
    }

    // ProfilePosts.md:3 — "the posts view lists the person's posts as post
    // cards, never as chronicle entries", the view named `profile.posts`.
    @Test
    fun thePostsTabListsPostCardsNeverChronicleActs() {
        render(loaded().copy(tab = ProfileTab.POSTS, posts = posts("p1", "p2"), rows = listOf(act())))
        compose.onNodeWithTag("profile.tabRow.postsTab").assertIsSelected()
        compose.onNodeWithTag("profile.posts").assertExists()
        compose.onNodeWithTag("profile.posts.card:p1").performScrollTo().assertExists()
        compose.onNodeWithTag("profile.posts.card:p2").performScrollTo().assertExists()
        compose.onAllNodesWithTag("profile.chronicle.act:1").assertCountEquals(0)
        compose.onAllNodesWithTag("chronicle_row").assertCountEquals(0)
    }

    // ProfileComments.md:3, :5 — the comments view lists comment cards, each
    // carrying its replies line beside it (`profile.comments.viewReplies`),
    // never chronicle entries.
    @Test
    fun theCommentsTabListsCommentCardsWithTheirRepliesLine() {
        render(loaded().copy(tab = ProfileTab.COMMENTS, comments = comments("c1"), rows = listOf(act())))
        compose.onNodeWithTag("profile.comments").assertExists()
        compose.onNodeWithTag("profile.comments.commentCard:c1").performScrollTo().assertExists()
        compose.onNodeWithTag("profile.comments.viewReplies:c1").assertExists()
        compose.onAllNodesWithTag("chronicle_row").assertCountEquals(0)
    }

    // Profile.md:23 — the chronicle stands on Everything, the right-most tab, alone.
    @Test
    fun theChronicleStandsOnEverythingAlone() {
        render(loaded().copy(posts = posts("p1"), rows = listOf(act())))
        compose.onNodeWithTag("profile.chronicle").assertExists()
        compose.onNodeWithTag("profile.chronicle.act:1").performScrollTo().assertExists()
        compose.onAllNodesWithTag("profile.posts.card:p1").assertCountEquals(0)
    }

    // ProfilePosts.md:5, ProfileComments.md:9 — a tab with nothing in it reads
    // `Nothing here yet.` below the tab row, the line alone; even the
    // applicant's own posts and comments tabs (only their chronicle says more).
    @Test
    fun anEmptyCardTabReadsTheLineAlone() {
        render(loaded(own = true, applicant = true).copy(tab = ProfileTab.POSTS))
        compose.onNodeWithTag("profile.posts.empty").performScrollTo().assert(hasText("Nothing here yet."))
        compose.onNodeWithTag("profile.posts.empty.title", useUnmergedTree = true).assertExists()
    }

    @Test
    fun anEmptyCommentsTabReadsTheLineAlone() {
        render(loaded().copy(tab = ProfileTab.COMMENTS))
        compose.onNodeWithTag("profile.comments.empty").performScrollTo().assert(hasText("Nothing here yet."))
    }

    // An empty line never stands while the tab's first page is on its way, nor over a fault.
    @Test
    fun noEmptyLineWhileTheFirstPageIsOnItsWay() {
        render(loaded().copy(tab = ProfileTab.POSTS, rowsLoading = true))
        compose.onAllNodesWithTag("profile.posts.empty").assertCountEquals(0)
    }

    // ProfileMoreFailed.md — a card tab's failed page stands the quiet row
    // with Retry under the cards already on screen, which stay.
    @Test
    fun aCardTabsFailedPageKeepsItsCardsAndOffersRetry() {
        var retried = 0
        compose.setContent {
            ProfileScreen(
                state = loaded().copy(tab = ProfileTab.POSTS, posts = posts("p1"), pageFailed = true),
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = {},
                onLoadMore = {},
                onRetryPage = { retried++ },
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = null,
                cardsHost = cardsDrawn,
                now = now,
            )
        }
        compose.onNodeWithTag("profile.posts.card:p1").performScrollTo().assertExists()
        compose.onNodeWithTag("profile_rows_failed").performScrollTo().assertTextEquals("Couldn't load more")
        compose.onNodeWithTag("profile_rows_retry").performClick()
        assertThat(retried).isEqualTo(1)
    }

    // ProfileComments.md:29 — an applicant's Reply answers in the snackbar,
    // `You can comment once you're in.`, and the thread never opens; a
    // member's is handed no lock.
    @Test
    fun anApplicantsReplyAnswersInTheSnackbar() {
        render(loaded(own = true, applicant = true).copy(tab = ProfileTab.COMMENTS, comments = comments("c1")))
        compose.onNodeWithTag("profile.comments.commentCard:c1").performScrollTo().performClick()
        assertThat(lockedTaps).isEqualTo(1)
        compose.onNodeWithTag("profile.snackbar.message").assertTextEquals("You can comment once you're in.")
    }

    @Test
    fun aMembersReplyIsHandedNoLock() {
        render(loaded().copy(tab = ProfileTab.COMMENTS, comments = comments("c1")))
        compose.onNodeWithTag("profile.comments.commentCard:c1").performScrollTo().performClick()
        assertThat(lockedTaps).isEqualTo(0)
    }

    // ProfilePosts.md:13 — the header block above the tab row stands
    // unchanged in every tab view.
    @Test
    fun theHeaderStandsInEveryTabView() {
        var shown by mutableStateOf(ProfileTab.EVERYTHING)
        compose.setContent {
            ProfileScreen(
                state = loaded().copy(tab = shown, posts = posts("p1"), comments = comments("c1")),
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = { shown = it },
                onLoadMore = {},
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = {},
                cardsHost = cardsDrawn,
                now = now,
            )
        }
        for (tab in listOf("postsTab", "commentsTab", "everythingTab")) {
            compose.onNodeWithTag("profile.tabRow.$tab").performClick()
            compose.onNodeWithTag((id / "name").tag).assertTextEquals("Ada L")
            compose.onNodeWithTag("profile.tabRow.$tab").assertIsSelected()
        }
    }

    // Profile.md:33: `Loading…` only once the next page is 200ms late.
    @Test
    fun theNextPagesLoadingLineWaits200ms() {
        compose.mainClock.autoAdvance = false
        render(loaded().copy(rowsLoading = true, rows = listOf(act())))
        compose.mainClock.advanceTimeBy(LOADING_AFTER_MS / 2)
        compose.onNodeWithTag("profile_rows_loading").assertDoesNotExist()
        compose.mainClock.advanceTimeBy(LOADING_AFTER_MS)
        compose.onNodeWithTag("profile_rows_loading").assertExists()
    }

    // Profile.md:35: the quiet line and Retry, which asks for the page again.
    @Test
    fun aFailedPageOffersRetry() {
        var asked = false
        render(loaded().copy(pageFailed = true, rows = listOf(act())), onLoadMore = { asked = true })
        compose.onNodeWithTag("profile_rows_failed").assertTextEquals("Couldn't load more")
        compose.onNodeWithTag("profile_rows_retry").performScrollTo().performClick()
        assertThat(asked).isTrue()
    }

    @Test
    fun anUnknownProfileShowsNotFound() {
        render(ProfileUiState(loading = false, notFound = true))
        compose.onNodeWithTag("profile_not_found").assertExists()
    }

    @Test
    fun aTransportFaultWithNothingLoadedOffersRetry() {
        render(ProfileUiState(loading = false, transportFailed = true))
        compose.onNodeWithTag("profile_transport_error").assertExists()
        compose.onNodeWithTag("profile_retry").assertExists()
    }

    @Test
    fun aDrillInProfileCarriesTheBackArrow() {
        render(loaded(), onBack = {})
        compose.onNodeWithTag("profile.header.back").assertExists()
    }

    // The verbs, as a matrix (copy-voice.md "Carried over").
    @Test
    fun theVerbsAreTheBlessedOnes() {
        fun verb(family: Family, genesis: Boolean = true, own: Boolean = false) =
            verbOf(RecordRow("r", family, genesis, null, null), own)
        assertThat(verb(Family.PUBLISH)).isEqualTo(R.string.chronicle_published)
        assertThat(verb(Family.PUBLISH, genesis = false)).isEqualTo(R.string.chronicle_edited_post)
        assertThat(verb(Family.REVIEW)).isEqualTo(R.string.chronicle_commented)
        assertThat(verb(Family.REGISTRATION, own = true)).isEqualTo(R.string.chronicle_profile_yours)
        assertThat(verb(Family.REGISTRATION, own = false)).isEqualTo(R.string.chronicle_profile_theirs)
        assertThat(verb(Family.OPINION)).isEqualTo(R.string.chronicle_opinion)
        assertThat(verb(Family.AFFINITY)).isEqualTo(R.string.chronicle_opinion)
    }

    // -- The edit form --

    private fun renderEdit(
        state: ProfileEditUiState,
        onSubmit: () -> Unit = {},
    ) {
        compose.setContent {
            ProfileEditScreen(
                state = state,
                onDisplayNameChange = {},
                onBioChange = {},
                onWebsiteChange = {},
                onPickAvatar = {},
                onClearAvatar = {},
                onSubmit = onSubmit,
                onRetry = {},
                onBack = {},
            )
        }
    }

    @Test
    fun theEditFormRendersItsFields() {
        renderEdit(ProfileEditUiState(loading = false, displayName = "Ada", bio = "Hi"))
        compose.onNodeWithTag("profile_edit_display_name").assertExists()
        compose.onNodeWithTag("profile_edit_bio").assertExists()
        compose.onNodeWithTag("profile_edit_website").assertExists()
        compose.onNodeWithTag("profile_edit_save").assertExists()
    }

    @Test
    fun theEmptyNameErrorRenders() {
        renderEdit(ProfileEditUiState(loading = false, emptyName = true))
        compose.onNodeWithTag("profile_edit_display_name").assertExists()
        // The supporting text rides the field's semantics; the save
        // still submits (the refusal is the ViewModel's).
    }

    @Test
    fun refusalAndSigningErrorsRender() {
        renderEdit(ProfileEditUiState(loading = false, refused = true, signingFailed = true))
        compose.onNodeWithTag("profile_edit_refused").assertExists()
        compose.onNodeWithTag("profile_edit_signing_failed").assertExists()
    }

    @Test
    fun theEditTransportFaultOffersRetry() {
        renderEdit(ProfileEditUiState(loading = false, transportFailed = true))
        compose.onNodeWithTag("profile_edit_transport_error").assertExists()
        compose.onNodeWithTag("profile_edit_retry").assertExists()
    }

    // -- The ruled field atom (CograTextField) the three fields now share --
    //
    // Each cap is the server's own (crates/api/src/profile.rs:27,30,35,
    // mirrored at core/domain/src/main/kotlin/com/cogra/domain/content/
    // TextLimits.kt:33-40): display name 50, bio 500, website URL 2048. The
    // late-counter window is `max(20, round(cap / 10))`
    // (design/components/forms/TextField.jsx:32-93).

    @Test
    fun theDisplayNameCounterAppearsNearItsCap() {
        // Cap 50, window max(20, 5) = 20 -> the counter appears at 30 chars.
        renderEdit(ProfileEditUiState(loading = false, displayName = "a".repeat(30)))
        compose.onNodeWithTag("profile_edit_display_name_count").assertTextEquals("20 left")
    }

    @Test
    fun aDisplayNameOverItsCapDisablesSave() {
        renderEdit(ProfileEditUiState(loading = false, displayName = "a".repeat(51)))
        compose.onNodeWithTag("profile_edit_display_name_count").assertTextEquals("1 over")
        compose.onNodeWithTag("profile_edit_display_name_error")
            .assertTextEquals("Too long — at most 50 characters.")
        compose.onNodeWithTag("profile_edit_save").assertIsNotEnabled()
    }

    @Test
    fun theBioCounterAppearsNearItsCap() {
        // Cap 500, window max(20, 50) = 50 -> the counter appears at 450 chars.
        renderEdit(ProfileEditUiState(loading = false, bio = "a".repeat(450)))
        compose.onNodeWithTag("profile_edit_bio_count").assertTextEquals("50 left")
    }

    @Test
    fun aBioOverItsCapDisablesSave() {
        renderEdit(ProfileEditUiState(loading = false, bio = "a".repeat(501)))
        compose.onNodeWithTag("profile_edit_bio_count").assertTextEquals("1 over")
        compose.onNodeWithTag("profile_edit_bio_error")
            .assertTextEquals("Too long — at most 500 characters.")
        compose.onNodeWithTag("profile_edit_save").assertIsNotEnabled()
    }

    @Test
    fun theWebsiteUrlCounterAppearsNearItsCap() {
        // Cap 2048, window max(20, 205) = 205 -> the counter appears at 1843.
        renderEdit(ProfileEditUiState(loading = false, websiteUrl = "a".repeat(1843)))
        compose.onNodeWithTag("profile_edit_website_count").assertTextEquals("205 left")
    }

    @Test
    fun aWebsiteUrlOverItsCapDisablesSave() {
        renderEdit(ProfileEditUiState(loading = false, websiteUrl = "a".repeat(2049)))
        compose.onNodeWithTag("profile_edit_website_count").assertTextEquals("1 over")
        compose.onNodeWithTag("profile_edit_website_error")
            .assertTextEquals("Too long — at most 2048 characters.")
        compose.onNodeWithTag("profile_edit_save").assertIsNotEnabled()
    }
}
