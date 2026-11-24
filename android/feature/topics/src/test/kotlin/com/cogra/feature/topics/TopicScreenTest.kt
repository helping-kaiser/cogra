// THE TAG PAGE (TagPage.md, TagPageEmpty.md) compiled from its sidecars, the
// lines this module draws: the header, the topic's row, the claim above each
// row and the order the read hands them; the fault, the answer no and the
// emptied page. The cards themselves are the shell's (`HostedCardsTest`,
// `TagPageCommentMenusTest`), so here each is a marker wearing the node it is
// handed.

package com.cogra.feature.topics

import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.domain.AuthTokens
import com.cogra.domain.ProfileComment
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
import com.cogra.domain.TaggedNode
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testHashtag
import com.cogra.domain.testing.testPost
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.SavedHost
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The board's three rows (`TagPageBody`): @tobias's post, in flight; @sol's post; @ada's tagged comment. */
private const val TOBIAS_POST = "dd44f5de-d68c-4931-aabc-915cefadab7f"
private const val SOL_POST = "734cd530-6c98-4f22-9027-2ff4ff46b5b5"
private const val ADA_COMMENT = "c4d2e6f8-1a3b-4d5c-8e9f-6a7b8c9d0e1f"

/**
 * `TagPage`'s registered (path, key) pairs this module draws
 * (`r60/registered-paths.txt`): the page's own nodes and each row's claim. The
 * cards' parts are the shell's and are counted where it draws them.
 */
private val TAG_PAGE_PAGE_NODES = listOf(
    "tagPage.header" to "",
    "tagPage.header.back" to "",
    "tagPage.header.title" to "",
    "tagPage.actionRow" to "",
    "tagPage.actionRow.share" to "",
    "tagPage.actionRow.stance" to "",
    "tagPage.actionRow.stance.anchor" to "",
    "tagPage.actionRow.stance.anchor.face" to "",
    "tagPage.claim" to SOL_POST,
    "tagPage.claim" to ADA_COMMENT,
    "tagPage.claim" to TOBIAS_POST,
    "tagPage.claim.exact" to SOL_POST,
    "tagPage.claim.exact" to ADA_COMMENT,
    "tagPage.claim.exact" to TOBIAS_POST,
    "tagPage.claim.glyph" to SOL_POST,
    "tagPage.claim.glyph" to ADA_COMMENT,
    "tagPage.claim.glyph" to TOBIAS_POST,
    "tagPage.claim.pending" to TOBIAS_POST,
    // The cards' own roots, which this page hands the shell keyed by their ids.
    "tagPage.card" to SOL_POST,
    "tagPage.card" to TOBIAS_POST,
    "tagPage.commentCard" to ADA_COMMENT,
)

/** `TagPageHeldPad`'s rows of the same kind: the claims and the card roots (its pad is the stance's own census). */
private val HELD_PAD_PAGE_NODES = TAG_PAGE_PAGE_NODES.filter { (path, _) -> path.startsWith("tagPage.claim") } +
    listOf("tagPage.card" to SOL_POST, "tagPage.card" to TOBIAS_POST, "tagPage.commentCard" to ADA_COMMENT)

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h2000dp")
class TopicScreenTest {

    @get:Rule
    val compose = createComposeRule()

    /** What the host was handed, in the order the rows asked for their cards. */
    private val drawn = mutableListOf<String>()

    /**
     * A stand-in for the shell's host: this module never builds a card, so
     * each card the rows ask for is a marker wearing the node it was handed —
     * which is what proves the row asked for the feed's card, not a card of
     * its own.
     */
    private val cardsHost: TopicCardsHost = { _, content ->
        content(
            TopicCards(
                post = { post, node ->
                    drawn += "post:${post.id}"
                    Text(post.content.value.orEmpty(), modifier = Modifier.testTag(node.keyed(post.id).tag))
                },
                comment = { listed, node ->
                    drawn += "comment:${listed.comment.id}@${listed.threadPostId}"
                    Text(
                        listed.comment.content.value.orEmpty(),
                        modifier = Modifier.testTag(node.keyed(listed.comment.id).tag),
                    )
                },
            ),
        )
    }

    private fun render(
        state: TopicUiState,
        stanceControl: TopicStanceSlot? = null,
        onShare: () -> Unit = {},
        onRefresh: () -> Unit = {},
        onBack: () -> Unit = {},
        backDescription: String? = null,
        geek: Boolean = false,
        name: String = "rust",
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides geek) {
                TopicScreen(
                    name = name,
                    state = state,
                    onRefresh = onRefresh,
                    onBack = onBack,
                    stanceControl = stanceControl,
                    backDescription = backDescription,
                    onShare = onShare,
                    cardsHost = cardsHost,
                )
            }
        }
    }

    /** A stand-in for the shell's row: a marker wearing the node the page hands it. */
    private val row: TopicStanceSlot = { node ->
        Text("row", modifier = Modifier.testTag(node.tag))
    }

    /** The shell's row as it is drawn: the wide anchor, wearing the page's node, nothing held. */
    private val wideAnchor: TopicStanceSlot = { node ->
        StanceControl(
            state = StanceControlState(),
            onHoldDefault = {},
            onOpenPad = {},
            onPick = {},
            onCommit = {},
            onDismissPad = {},
            onOpenAlternates = {},
            onOpenSeverance = {},
            onConfirmSeverance = {},
            onDismissSeverance = {},
            onConfirmationShown = {},
            testTagPrefix = "topic_affinity",
            axes = StanceAxes.Affinity,
            targetLabel = "#rust",
            wide = true,
            node = node,
        )
    }

    private fun taggedPost(id: String, relevance: Double = 0.1, confidence: Double = 1.0, pending: Boolean = false) =
        TaggedContentView(
            kind = TaggedContentKind.POST,
            id = id,
            title = "A post",
            snippet = "body",
            authorHandle = "alice",
            authorDisplayName = "Alice",
            relevance = relevance,
            confidence = confidence,
            pending = pending,
            node = TaggedNode.Post(testPost(id)),
        )

    private fun taggedComment(id: String) = TaggedContentView(
        kind = TaggedContentKind.COMMENT,
        id = id,
        title = null,
        snippet = "a reply",
        authorHandle = "ada",
        authorDisplayName = "Ada",
        relevance = 0.4,
        confidence = 0.9,
        pending = false,
        node = TaggedNode.Comment(ProfileComment(testComment(id), target = null, threadPostId = "p9")),
    )

    private fun populated(vararg entries: TaggedContentView) =
        TopicUiState(loading = false, hashtag = testHashtag("rust"), content = entries.toList())

    private val emptied = TopicUiState(loading = false, hashtag = testHashtag("rust"), content = emptyList())

    /** The board's page, its three rows as `TagPageBody` lists them. */
    private val board = populated(
        taggedPost(TOBIAS_POST, relevance = 0.1, confidence = 1.0, pending = true),
        taggedPost(SOL_POST, relevance = 0.55, confidence = 1.0),
        taggedComment(ADA_COMMENT),
    )

    private fun shown(tag: String) =
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    private fun top(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode().boundsInRoot

    /** Every node of the tree, unmerged. */
    private fun everyNode(): List<SemanticsNode> {
        fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
        return walk(compose.onRoot(useUnmergedTree = true).fetchSemanticsNode())
    }

    private fun everyText(): List<String> = everyNode().flatMap { node ->
        node.config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text } +
            node.config.getOrNull(SemanticsProperties.ContentDescription).orEmpty()
    }

    /**
     * A registered (path, key) pair stands as the harness pairs it: an
     * instance root wears `path:key`; a part wears its bare path inside the
     * instance its key names; a nested key `outer/inner` is the inner instance
     * `path:inner` inside `…:outer`.
     */
    private fun registered(path: String, key: String): SemanticsMatcher {
        fun tagged(predicate: (String) -> Boolean) = SemanticsMatcher("tag") { node ->
            node.config.getOrNull(SemanticsProperties.TestTag)?.let(predicate) == true
        }
        if (key.isEmpty()) return tagged { it == path }
        val parts = key.split("/")
        val last = parts.last()
        val outer = parts.dropLast(1).lastOrNull()
        val root = tagged { it == "$path:$last" }
        val asRoot = if (outer == null) root else (root and hasAnyAncestor(tagged { it.endsWith(":$outer") }))
        val asPart = tagged { it == path } and hasAnyAncestor(tagged { it.endsWith(":$last") })
        return asRoot or asPart
    }

    private fun assertCensus(rows: List<Pair<String, String>>) {
        val missing = rows.filter { (path, key) ->
            compose.onAllNodes(registered(path, key), useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
        }
        assertThat(missing).isEmpty()
    }

    // -- The census --

    // TagPage (round 60): every registered (path, key) this module draws
    // stands, the share at round 48's `tagPage.actionRow.share`.
    @Test
    fun theTagPageBoardsRegisteredNodesStand() {
        render(board, stanceControl = wideAnchor, geek = true)
        assertCensus(TAG_PAGE_PAGE_NODES)
        assertThat(shown("tagPage.share")).isFalse()
    }

    // TagPageHeldPad (round 60): the same claims and card roots stand under the parked pad's page.
    @Test
    fun theHeldPadBoardsPageNodesStand() {
        render(board, stanceControl = wideAnchor, geek = true)
        assertCensus(HELD_PAD_PAGE_NODES)
    }

    // -- TagPage.md --

    // :3 — the page is titled by the tag, # and all.
    @Test
    fun thePageIsTitledByTheTagHashAndAll() {
        render(emptied)
        compose.onNodeWithTag("tagPage.header.title", useUnmergedTree = true).assertTextEquals("#rust")
    }

    // :5 — the tag page carries no bottom bar.
    @Test
    fun thePageCarriesNoBottomBar() {
        render(board, stanceControl = row)
        val tags = everyNode().mapNotNull { it.config.getOrNull(SemanticsProperties.TestTag) }
        assertThat(tags.filter { "bottomBar" in it }).isEmpty()
    }

    // :7 — the header carries no control but its arrow, and the topic's row
    // stands under the title above every post.
    @Test
    fun theHeaderCarriesNoControlAndTheRowStandsUnderTheTitleAboveEveryPost() {
        render(board, stanceControl = row)
        val header = compose.onNodeWithTag("tagPage.header", useUnmergedTree = true).fetchSemanticsNode()
        fun controls(node: SemanticsNode): List<SemanticsNode> =
            (if (node.config.contains(SemanticsActions.OnClick)) listOf(node) else emptyList()) +
                node.children.flatMap(::controls)
        assertThat(controls(header).map { it.config.getOrNull(SemanticsProperties.TestTag) })
            .containsExactly("tagPage.header.back")
        val rowBounds = top("tagPage.actionRow")
        assertThat(rowBounds.top).isAtLeast(top("tagPage.header").bottom)
        assertThat(rowBounds.bottom).isAtMost(top("tagPage.claim:$TOBIAS_POST").top)
    }

    // :9 — no order control, no pagination, no load-more: the list ends where its rows do.
    @Test
    fun thePageOffersNoOrderControlPaginationOrLoadMore() {
        render(board, stanceControl = row)
        val words = everyText().joinToString(" ").lowercase()
        listOf("newest", "ranked", "load more", "show more", "next page")
            .forEach { assertThat(words).doesNotContain(it) }
        compose.onNodeWithTag("topic_content_loading").assertDoesNotExist()
        assertThat(drawn).hasSize(3)
    }

    // :11 — the rows stand in the order the read hands them, newest claim
    // first, posts and comments interleaved.
    @Test
    fun theRowsKeepTheReadsOrder() {
        render(populated(taggedComment("c1"), taggedPost("p1"), taggedPost("p2")))
        assertThat(drawn).containsExactly("comment:c1@p9", "post:p1", "post:p2").inOrder()
    }

    // :15 — a tagged post stands as the feed's post card, wearing `tagPage.card`
    // keyed by its id, under the claim that put it there.
    @Test
    fun aTaggedPostStandsAsThePostCardUnderItsClaim() {
        render(populated(taggedPost("p1")))
        assertThat(shown("tagPage.claim:p1")).isTrue()
        assertThat(shown("tagPage.card:p1")).isTrue()
        assertThat(top("tagPage.claim:p1").bottom).isAtMost(top("tagPage.card:p1").top)
        assertThat(drawn).containsExactly("post:p1")
    }

    // :15 — a tagged comment stands as `tagPage.commentCard`, handed what it
    // answers and its thread's post, which is where its doors land.
    @Test
    fun aTaggedCommentStandsAsTheCommentCardInReachOfItsThread() {
        render(populated(taggedComment("c1")))
        assertThat(shown("tagPage.claim:c1")).isTrue()
        assertThat(shown("tagPage.commentCard:c1")).isTrue()
        assertThat(drawn).containsExactly("comment:c1@p9")
    }

    // :27 — every row carries the claim above it: the glyph, and one spoken
    // reading with the exact pair, in both modes.
    @Test
    fun everyRowCarriesTheClaimAboveIt() {
        render(board)
        compose.onAllNodesWithTag("tagPage.claim.glyph", useUnmergedTree = true).assertCountEquals(3)
        compose.onNodeWithContentDescription("Tagged: had to look, but it's in there, +0.10 / 1.00").assertExists()
    }

    // :27 — the exact pair paints only in geek mode.
    @Test
    fun theExactPairPaintsOnlyInGeekMode() {
        render(populated(taggedPost("p1", relevance = 0.4, confidence = 0.9)))
        assertThat(shown("tagPage.claim.exact")).isFalse()
    }

    @Test
    fun inGeekModeTheExactPairPaintsBesideTheGlyph() {
        render(populated(taggedPost("p1", relevance = 0.4, confidence = 0.9)), geek = true)
        compose.onNodeWithTag("tagPage.claim.exact", useUnmergedTree = true).assertTextEquals("+0.40 / 0.90")
    }

    // `TaggedRow`: a claim still in flight says so, with the marker every
    // unsettled record wears; a settled one wears none.
    @Test
    fun aClaimStillInFlightWearsTheSettlingMarker() {
        render(populated(taggedPost("p1", pending = true), taggedPost("p2")))
        compose.onAllNodesWithTag("tagPage.claim.pending", useUnmergedTree = true).assertCountEquals(1)
    }

    // :29 — no count of people or of uses anywhere on the page.
    @Test
    fun thePageShowsNoCount() {
        render(board, stanceControl = wideAnchor)
        everyText().forEach { assertThat(it).doesNotContainMatch("\\b(people|uses)\\b") }
    }

    // :45 — the word follow appears nowhere on the tag page.
    @Test
    fun theWordFollowAppearsNowhere() {
        render(board, stanceControl = wideAnchor)
        everyText().forEach { assertThat(it.lowercase()).doesNotContain("follow") }
        assertThat(shown("topic_follow")).isFalse()
    }

    // :47 — the back arrow returns where the reader came from, its label naming that origin.
    @Test
    fun theBackArrowReturnsAndNamesItsOrigin() {
        var back = 0
        render(board, onBack = { back++ }, backDescription = "Back to Saved")
        compose.onNodeWithContentDescription("Back to Saved").assertExists()
        compose.onNodeWithTag("tagPage.header.back").performClick()
        assertThat(back).isEqualTo(1)
    }

    // :49 — each origin's words.
    @Test
    fun theBackArrowReadsEachOriginsWords() {
        val labels = mutableMapOf<String?, String?>()
        val origins = listOf(
            TOPIC_FROM_SEARCH, TOPIC_FROM_YOUR_TOPICS, TOPIC_FROM_FEED, TOPIC_FROM_POST, TOPIC_FROM_PROFILE,
            TOPIC_FROM_OWN_PROFILE, TOPIC_FROM_SAVED, TOPIC_FROM_HISTORY, topicFromTopic("fieldnotes"),
        )
        compose.setContent { origins.forEach { labels[it] = topicBack(it) } }
        compose.waitForIdle()
        assertThat(origins.map { labels[it] }).containsExactly(
            "Back to the search", "Back to Your tags", "Back to feed", "Back to the post", "Back to the profile",
            "Back to your profile", "Back to Saved", "Back to History", "Back to #fieldnotes",
        ).inOrder()
    }

    // `TagPage`'s row: the tag's share, named for the tag, beside the anchor,
    // at round 48's `tagPage.actionRow.share`.
    @Test
    fun theStanceRowCarriesTheTagsShare() {
        var shared = 0
        render(populated(taggedPost("p1")), stanceControl = row, onShare = { shared++ })
        compose.onNodeWithContentDescription("Share #rust").performClick()
        assertThat(shared).isEqualTo(1)
        assertThat(shown("tagPage.actionRow.share")).isTrue()
    }

    // The row is the shell's: the page hands it the registered node and builds no follow control of its own.
    @Test
    fun theShellsRowWearsTheRegisteredStanceNode() {
        render(populated(taggedPost("p1")), stanceControl = row)
        assertThat(shown("tagPage.actionRow.stance")).isTrue()
        assertThat(shown("topic_following")).isFalse()
        assertThat(shown("topic_severance")).isFalse()
    }

    @Test
    fun aLoadingTopicShowsTheSpinner() {
        render(TopicUiState(loading = true))
        compose.onNodeWithTag("topic_loading").assertExists()
    }

    // :65 — the first read getting no answer: the header stands, the house
    // line in the page's place over an outlined Retry, and no row or card.
    @Test
    fun aFirstReadWithNoAnswerStandsTheLineOverRetry() {
        render(TopicUiState(loading = false, transportFailed = true), stanceControl = row)
        assertThat(shown("tagPage.header")).isTrue()
        compose.onNodeWithTag("topic_transport_error", useUnmergedTree = true)
            .assertTextEquals("Can't reach the server — this tag can't load right now.")
        compose.onNodeWithTag("topic_retry").assertTextEquals("Retry")
        assertThat(top("topic_transport_error").bottom).isAtMost(top("topic_retry").top)
        assertThat(shown("tagPage.actionRow")).isFalse()
        assertThat(drawn).isEmpty()
    }

    // :67 — Retry reads the page again.
    @Test
    fun retryReadsThePageAgain() {
        var reads = 0
        render(TopicUiState(loading = false, transportFailed = true), onRefresh = { reads++ })
        compose.onNodeWithTag("topic_retry").performClick()
        assertThat(reads).isEqualTo(1)
    }

    // :69 — a name that cannot be a tag: the header keeps the name asked for,
    // the page reads `This tag doesn't exist.`, and no row, card or Retry stands.
    @Test
    fun aNameThatCannotBeATagReadsThisTagDoesntExist() {
        render(TopicUiState(loading = false, notFound = true), stanceControl = row, name = "salt maps")
        compose.onNodeWithTag("tagPage.header.title", useUnmergedTree = true).assertTextEquals("#salt maps")
        compose.onNodeWithTag("topic_not_found").assertTextEquals("This tag doesn't exist.")
        assertThat(shown("tagPage.actionRow")).isFalse()
        assertThat(shown("topic_retry")).isFalse()
        assertThat(drawn).isEmpty()
    }

    // :71 — the answer no: never the failure voice or its colour (no alert), and nothing on it retries.
    @Test
    fun theAnswerNoIsNeverTheFailureVoice() {
        render(TopicUiState(loading = false, notFound = true))
        assertThat(shown("topic_transport_error")).isFalse()
        assertThat(everyNode().filter { it.config.contains(SemanticsProperties.LiveRegion) }).isEmpty()
        assertThat(clickablesUnder("topic_not_found")).isEmpty()
        assertThat(shown("topic_retry")).isFalse()
    }

    /** The nodes under [tag] (itself included) that answer a tap. */
    private fun clickablesUnder(tag: String): List<SemanticsNode> {
        fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
        return walk(compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode())
            .filter { it.config.contains(SemanticsActions.OnClick) }
    }

    // :73 — a legal name nothing carries opens empty, never `This tag doesn't exist.`.
    @Test
    fun aLegalNameNothingCarriesOpensEmptyNeverNotFound() {
        render(emptied)
        compose.onNodeWithTag("topic_content_empty").assertTextEquals("Nothing carries this tag right now.")
        assertThat(shown("topic_not_found")).isFalse()
    }

    // -- TagPageEmpty.md --

    // :3 — the empty page reads `Nothing carries this tag right now.`.
    @Test
    fun theEmptyPageReadsNothingCarriesThisTag() {
        render(emptied, stanceControl = row)
        compose.onNodeWithTag("topic_content_empty").assertTextEquals("Nothing carries this tag right now.")
    }

    // :5 — never says not found, never says first.
    @Test
    fun theEmptyPageNeverSaysNotFoundOrFirst() {
        render(emptied, stanceControl = row)
        everyText().forEach { text ->
            assertThat(text.lowercase()).doesNotContain("not found")
            assertThat(text.lowercase()).doesNotContainMatch("\\bfirst\\b")
        }
    }

    // :7 — no action, no error colour (no alert).
    @Test
    fun theEmptyPageOffersNoActionAndNoErrorColour() {
        render(emptied)
        assertThat(everyNode().filter { it.config.contains(SemanticsProperties.LiveRegion) }).isEmpty()
        assertThat(clickablesUnder("topic_content_empty")).isEmpty()
    }

    // :9 — the emptied page carries the topic's own row.
    @Test
    fun theEmptyPageCarriesTheTopicsOwnRow() {
        render(emptied, stanceControl = wideAnchor)
        assertThat(shown("tagPage.actionRow")).isTrue()
        assertThat(shown("tagPage.actionRow.stance.anchor.face")).isTrue()
        assertThat(top("tagPage.actionRow").bottom).isAtMost(top("topic_content_empty").top)
    }

    // TagPageMenu.md:7, TagPageCommentMenu.md:7 — the cards' menus hide and
    // save through the page's own host, their words on `tagPage.snackbar` with Undo.
    @Test
    fun theCardsMenusWriteThroughThePagesHostOnItsSnackbar() {
        val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "reader") }
        val hiddenRepository = RecordingHiddenRepository()
        val menus = TopicMenuWrites(
            saved = SavedWrites(RecordingSavedRepository(), tokens, CoroutineScope(Dispatchers.Unconfined)),
            hidden = HiddenSet(hiddenRepository, tokens, CoroutineScope(Dispatchers.Unconfined))
                .also { runBlocking { it.refetch() } },
        )
        var hosted: SavedHost? = null
        val reading: TopicCardsHost = { _, content ->
            hosted = LocalSavedHost.current
            content(TopicCards({ _, _ -> }, { _, _ -> }))
        }
        compose.setContent {
            TopicScreen(name = "rust", state = board, onRefresh = {}, onBack = {}, cardsHost = reading, menus = menus)
        }
        compose.waitForIdle()
        val hide = hosted?.hideAct(HiddenPerson("ada-id", "ada", null, null, redacted = false), "c1")
        assertThat(hide).isNotNull()
        compose.runOnIdle { hide?.invoke() }
        compose.waitForIdle()
        assertThat(hiddenRepository.hides.map { it.first }).containsExactly("ada-id")
        compose.onNodeWithTag("tagPage.snackbar", useUnmergedTree = true).assertExists()
    }

    // :11, :13 — the face on the emptied page is the shell's control: its tap
    // blooms the pad, or for a guest raises the gate (StanceControlRoute's own
    // tests); here, the page hands it the tap through the registered face.
    @Test
    fun theEmptyPagesFaceIsTheControlsOwnTap() {
        var taps = 0
        render(emptied, stanceControl = { node ->
            StanceControl(
                state = StanceControlState(),
                onHoldDefault = {},
                onOpenPad = { taps++ },
                onPick = {},
                onCommit = {},
                onDismissPad = {},
                onOpenAlternates = {},
                onOpenSeverance = {},
                onConfirmSeverance = {},
                onDismissSeverance = {},
                onConfirmationShown = {},
                testTagPrefix = "topic_affinity",
                axes = StanceAxes.Affinity,
                targetLabel = "#rust",
                wide = true,
                node = node,
            )
        })
        compose.onNodeWithTag("tagPage.actionRow.stance.anchor", useUnmergedTree = true).performClick()
        assertThat(taps).isEqualTo(1)
    }
}
