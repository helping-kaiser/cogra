package com.cogra.feature.topics

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.domain.ProfileComment
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
import com.cogra.domain.TaggedNode
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testHashtag
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
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
        stanceControl: (@Composable () -> Unit)? = null,
        onShare: () -> Unit = {},
        geek: Boolean = false,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides geek) {
                TopicScreen(
                    name = "rust",
                    state = state,
                    onRefresh = {},
                    onBack = {},
                    stanceControl = stanceControl,
                    onShare = onShare,
                    cardsHost = cardsHost,
                )
            }
        }
    }

    /** A stand-in for the shell's row: this module never builds one. */
    private val row: @Composable () -> Unit = {
        Text("row", modifier = Modifier.testTag("stance_row_content"))
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

    private fun shown(tag: String) =
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    @Test
    fun aLoadingTopicShowsTheSpinner() {
        render(TopicUiState(loading = true))
        compose.onNodeWithTag("topic_loading").assertExists()
    }

    @Test
    fun aNameTheSubstrateCannotCarryIsReportedNotFound() {
        render(TopicUiState(loading = false, notFound = true))
        compose.onNodeWithTag("topic_not_found").assertExists()
    }

    @Test
    fun theTitleNamesTheCanonicalTopic() {
        render(TopicUiState(loading = false, hashtag = testHashtag("rust")))
        compose.onNodeWithTag("topic_title").assertExists()
    }

    /**
     * Following a topic IS the stance gesture (jakob 2026-09-14): one
     * gesture, one ceremony, one face table. So there is no toggle, no
     * one-tap follow, and no second severance surface of this screen's
     * own — and the row itself is the shell's, never this module's.
     */
    @Test
    fun theScreenBuildsNoFollowControlOfItsOwn() {
        render(populated(taggedPost("p1")))
        compose.onNodeWithTag("topic_follow").assertDoesNotExist()
        compose.onNodeWithTag("topic_following").assertDoesNotExist()
        compose.onNodeWithTag("topic_severance").assertDoesNotExist()
        // Nothing was passed in, so nothing stands where the row goes.
        compose.onNodeWithTag("topic_stance_row").assertDoesNotExist()
    }

    @Test
    fun aPopulatedTopicCarriesTheStanceRowTheShellPassesIn() {
        render(populated(taggedPost("p1")), stanceControl = row)
        compose.onNodeWithTag("topic_stance_row").assertExists()
        compose.onNodeWithTag("stance_row_content").assertExists()
    }

    @Test
    fun theEmptyPageWiresNoFaceAtAll() {
        // Backlog item 81, ruled 2026-09-15: a page with nothing tagged
        // carries no stance control, which is why the row sits inside
        // the populated branch rather than under the title outright.
        render(TopicUiState(loading = false, hashtag = testHashtag("rust"), content = emptyList()), stanceControl = row)
        compose.onNodeWithTag("topic_stance_row").assertDoesNotExist()
        compose.onNodeWithTag("topic_content_empty").assertExists()
    }

    @Test
    fun emptyContentShowsTheEmptyCopy() {
        render(TopicUiState(loading = false, hashtag = testHashtag("rust"), content = emptyList()))
        compose.onNodeWithTag("topic_content_empty").assertExists()
    }

    // TagPage.md:15 — a tagged post stands as the feed's post card, wearing
    // `tagPage.card` keyed by its id, under the claim that put it there; no
    // short-form row of the page's own.
    @Test
    fun aTaggedPostStandsAsTheFeedsPostCardUnderItsClaim() {
        render(populated(taggedPost("p1")))
        assertThat(shown("tagPage.claim:p1")).isTrue()
        assertThat(shown("tagPage.card:p1")).isTrue()
        assertThat(drawn).containsExactly("post:p1")
        assertThat(shown("topic_content_POST_p1")).isFalse()
    }

    // TagPage.md:15 — a tagged comment stands as the comment card, handed what
    // it answers and its thread's post, which is where its doors land.
    @Test
    fun aTaggedCommentStandsAsTheCommentCardInReachOfItsThread() {
        render(populated(taggedComment("c1")))
        assertThat(shown("tagPage.claim:c1")).isTrue()
        assertThat(shown("tagPage.commentCard:c1")).isTrue()
        assertThat(drawn).containsExactly("comment:c1@p9")
    }

    // TagPage.md:11 — the rows stand in the order the read hands them,
    // newest claim first, posts and comments interleaved.
    @Test
    fun theRowsKeepTheReadsOrder() {
        render(populated(taggedComment("c1"), taggedPost("p1"), taggedPost("p2")))
        assertThat(drawn).containsExactly("comment:c1@p9", "post:p1", "post:p2").inOrder()
    }

    // TagPage.md:19 — the claim leads with the tag table's glyph and `Tagged`,
    // and speaks one reading, the exact pair included, in both modes.
    @Test
    fun theClaimLeadsWithItsGlyphAndSpeaksItsPair() {
        render(populated(taggedPost("p1", relevance = 0.1, confidence = 1.0)))
        compose.onNodeWithTag("tagPage.claim.glyph", useUnmergedTree = true).assertTextEquals("🔍")
        compose.onNodeWithContentDescription("Tagged: had to look, but it's in there, +0.10 / 1.00")
            .assertExists()
    }

    // TagPage.md:19 — the exact pair paints only in geek mode.
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

    // TagPage.md:21 — no count of people or of uses anywhere on the page.
    @Test
    fun thePageShowsNoCount() {
        render(populated(taggedPost("p1"), taggedPost("p2")))
        compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.Text))
            .fetchSemanticsNodes()
            .flatMap { it.config[SemanticsProperties.Text] }
            .forEach { assertThat(it.text).doesNotContainMatch("\\b(people|uses)\\b") }
    }

    // `TagPage`'s stance row: the tag's share, named for the tag, beside the anchor.
    @Test
    fun theStanceRowCarriesTheTagsShare() {
        var shared = 0
        render(populated(taggedPost("p1")), stanceControl = row, onShare = { shared++ })
        compose.onNodeWithContentDescription("Share #rust").performClick()
        assertThat(shared).isEqualTo(1)
        assertThat(shown("tagPage.share")).isTrue()
    }

    // TagPage.md:41 — from another tag's page the arrow reads `Back to` with
    // that tag's name.
    @Test
    fun fromAnotherTagsPageTheArrowNamesThatTag() {
        var label: String? = null
        compose.setContent { label = topicBack(topicFromTopic("fieldnotes")) }
        assertThat(label).isEqualTo("Back to #fieldnotes")
    }
}
