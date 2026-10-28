// History as the reader sees it, compiled from the sidecars line by line:
// History.md (the cards, the day dividers, the field and the trigger, the
// doors and the back arrow), HistoryEmpty.md, HistoryNone.md,
// HistoryFilter.md and HistorySearch.md. web's twin is `history-view.test.tsx`.

package com.cogra.feature.content

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.ActorRef
import com.cogra.domain.ModerationState
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.history.TagCardTopic
import com.cogra.domain.history.TaggedGlimpse
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant
import java.time.ZoneId

// A tall window, so every row of the column is composed at once: a lazy list
// composes only what stands on screen.
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class HistoryScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val zone = ZoneId.systemDefault()
    private val now = Instant.now()
    private val today = now
    private val yesterday = now.atZone(zone).minusDays(1).toInstant()
    private val longAgo = now.atZone(zone).minusDays(3).toInstant()

    private val ada = ActorRef("u-ada", "ada")

    private val commentEntry = HistoryEntry(
        HistoryCard.Comment(
            comment = testComment("c1", author = ActorRef("u-t", "tobias")),
            target = CommentTarget.Post(
                id = "p1",
                title = testModeratedField("The long way home"),
                content = testModeratedField("words"),
                mimeTypes = emptyList(),
                coverUrl = null,
                authorHandle = "ada",
                moderation = ModerationState.NORMAL,
                removed = false,
            ),
            threadPostId = "p1",
        ),
        today,
    )
    private val postEntry = HistoryEntry(HistoryCard.Post(testPost("p1", author = ada)), today)
    private val personEntry = HistoryEntry(HistoryCard.Person(testProfile("u-mira", "mira", "Mira Voss")), yesterday)
    private val tagEntry = HistoryEntry(
        HistoryCard.Tag(
            TagCardTopic(
                "h1",
                testModeratedField("saltmaps"),
                listOf(TaggedGlimpse("p9", false, "Low tide", null, false, "tobias", yesterday)),
            ),
        ),
        yesterday,
    )
    private val oldPost = HistoryEntry(HistoryCard.Post(testPost("p3")), longAgo)

    private val calls = mutableListOf<String>()
    private val doors = HistoryDoors(
        cards = CardDoors(
            onOpenPost = { calls += "post:$it" },
            onOpenComment = { postId, commentId, aim ->
                calls += "comment:$postId/$commentId" + if (aim) "+reply" else ""
            },
            onOpenActor = { calls += "actor:$it" },
            onOpenTopic = { calls += "topic:$it" },
        ),
        onComposeWithTag = { calls += "compose:$it" },
    )
    private val callbacks = HistoryCallbacks(
        onSearch = { calls += "search:$it" },
        onApplyKinds = { calls += "kinds:${it.sorted()}" },
        onNarrowTo = { calls += "narrow:$it" },
        onShowEverything = { calls += "everything" },
        onBack = { calls += "back" },
    )

    private fun render(state: HistoryUiState) {
        compose.setContent {
            HistoryScreen(state = state, writes = null, callbacks = callbacks, doors = doors, now = now)
        }
    }

    private fun whole(vararg entries: HistoryEntry) = HistoryUiState(
        entries = entries.toList(),
        loading = false,
        answered = HistoryAsk(null, emptySet()),
    )

    private fun searched(
        query: String,
        vararg entries: HistoryEntry,
        kinds: Set<FeedKind> = emptySet(),
        morePeople: Boolean = false,
        moreTags: Boolean = false,
    ) = HistoryUiState(
        entries = entries.toList(),
        loading = false,
        query = query,
        kinds = kinds,
        hasMorePeople = morePeople,
        hasMoreTags = moreTags,
        answered = HistoryAsk(query, kinds),
    )

    private fun tagsInOrder(): List<String> =
        compose.onAllNodes(SemanticsMatcher("tagged") { it.config.contains(SemanticsProperties.TestTag) }, true)
            .fetchSemanticsNodes()
            .map { it.config[SemanticsProperties.TestTag] }

    // History.md:19-21 — every kind as its own feed card.
    @Test
    fun everyKindStandsAsItsOwnFeedCard() {
        render(whole(commentEntry, postEntry, personEntry, tagEntry))
        compose.onNodeWithTag("history.commentCard:c1").assertIsDisplayed()
        compose.onNodeWithTag("history.card:p1").assertIsDisplayed()
        compose.onNodeWithTag("history.profileCard:u-mira").assertIsDisplayed()
        compose.onNodeWithTag("history.tagCard:saltmaps").assertIsDisplayed()
    }

    // History.md:25-27 — a quiet divider above the first thing of each day.
    @Test
    fun aDayDividerStandsAboveTheFirstThingSeenOnEachDay() {
        render(whole(commentEntry, postEntry, personEntry, tagEntry, oldPost))
        compose.onNodeWithTag("history.day:today", useUnmergedTree = true).assertTextEquals("Today")
        compose.onNodeWithTag("history.day:yesterday", useUnmergedTree = true).assertTextEquals("Yesterday")
        compose.onAllNodesWithTag("history.day:today", useUnmergedTree = true).assertCountEquals(1)
        val order = tagsInOrder()
        assertThat(order.indexOf("history.day:yesterday")).isLessThan(order.indexOf("history.profileCard:u-mira"))
        assertThat(order.indexOf("history.card:p1")).isLessThan(order.indexOf("history.day:yesterday"))
        assertThat(order.count { it.startsWith("history.day:") }).isEqualTo(3)
    }

    // History.md:85, :105 — the field at rest, and the trigger reading Everything.
    @Test
    fun theFieldReadsSearchYourHistoryAndTheTriggerEverything() {
        render(whole(postEntry))
        compose.onNodeWithTag("history.searchField", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithContentDescription("Everything, what your history shows").assertIsDisplayed()
    }

    // HistoryFilter.md:31 — a narrowed trigger speaks the filter pill's state words.
    @Test
    fun aNarrowedTriggerReadsTheNarrowedKinds() {
        render(whole(postEntry).copy(kinds = setOf(FeedKind.TAG), answered = HistoryAsk(null, setOf(FeedKind.TAG))))
        compose.onNodeWithContentDescription("Tags, what your history shows").assertIsDisplayed()
    }

    // History.md:121-123 — the back arrow reads Back to your profile, and goes there.
    @Test
    fun theBackArrowReadsBackToYourProfile() {
        render(whole(postEntry))
        compose.onNodeWithContentDescription("Back to your profile").performClick()
        assertThat(calls).containsExactly("back")
    }

    // History.md:47-57 — every card's door, landing with History as the origin.
    @Test
    fun theCardsDoorsOpenTheirThings() {
        render(whole(commentEntry, postEntry, personEntry, tagEntry))
        compose.onNodeWithText("Mira Voss").performClick()
        compose.onNodeWithTag("history.tagCard:saltmaps").performClick()
        compose.onNodeWithTag("history_comment_c1_head", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("history_comment_c1_reply", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly(
            "actor:mira",
            "topic:saltmaps",
            "post:p1",
            "comment:p1/c1+reply",
        ).inOrder()
    }

    // History.md:63 — Tag a new post with it opens the composer with the tag staged.
    @Test
    fun theTagCardsActComposesWithTheTag() {
        render(whole(tagEntry))
        compose.onNodeWithTag("history.tagCard.actionRow.compose", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly("compose:saltmaps")
    }

    // History.md:45 — no way to clear the list and no way to remove one thing.
    @Test
    fun historyOffersNoClearAndNoRemove() {
        render(whole(postEntry))
        compose.onAllNodesWithTag("history.clear", useUnmergedTree = true).assertCountEquals(0)
        assertThat(tagsInOrder().none { it.contains("remove", ignoreCase = true) }).isTrue()
    }

    // HistoryEmpty.md:3-7 — words only, no field, no trigger, no action.
    @Test
    fun anEmptyHistoryReadsItsLineAndDrawsNoFieldAndNoTrigger() {
        render(whole())
        compose.onNodeWithTag("history.empty.title", useUnmergedTree = true)
            .assertTextEquals("Nothing here yet. Everything you see shows up here on its own, newest first.")
        compose.onAllNodesWithTag("history.searchField", useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodesWithTag("history.filterTrigger", useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodesWithTag("history.empty.action", useUnmergedTree = true).assertCountEquals(0)
    }

    // HistoryNone.md:3, :7, :9 — a query nothing seen carries.
    @Test
    fun aQueryNothingCarriesReadsItsLineKeepsTheFieldAndOffersShowEverything() {
        render(searched("brackish cartography"))
        compose.onNodeWithTag("history.empty.title", useUnmergedTree = true).assertTextEquals(
            "Nothing you've seen carries that name. " +
                "Search reads names and titles, never bodies — fewer words reach further.",
        )
        compose.onNodeWithTag("history.searchField", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithTag("history.empty.action", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly("everything")
    }

    // HistoryNone.md:5 — kinds that hold nothing seen, with no query.
    @Test
    fun kindsThatHoldNothingReadTheirOwnLine() {
        val tags = setOf(FeedKind.TAG)
        render(HistoryUiState(loading = false, kinds = tags, answered = HistoryAsk(null, tags)))
        compose.onNodeWithTag("history.empty.title", useUnmergedTree = true)
            .assertTextEquals("Nothing you've seen is of that kind.")
        compose.onNodeWithContentDescription("Tags, what your history shows").assertIsDisplayed()
    }

    // HistorySearch.md:3-23 — sections: people, then tags, then content; no day dividers.
    @Test
    fun aQueryStandsInSectionsPeopleThenTagsThenContent() {
        render(searched("m", postEntry, personEntry, tagEntry, morePeople = true, moreTags = true))
        val order = tagsInOrder()
        val profiles = order.indexOf("history.profilesLabel")
        val person = order.indexOf("history.profileCard:u-mira")
        val profilesDoor = order.indexOf("history.profilesDoor")
        val tags = order.indexOf("history.tagsLabel")
        val tag = order.indexOf("history.tagCard:saltmaps")
        val tagsDoor = order.indexOf("history.tagsDoor")
        val post = order.indexOf("history.card:p1")
        assertThat(listOf(profiles, person, profilesDoor, tags, tag, tagsDoor, post)).isInStrictOrder()
        assertThat(order.none { it.startsWith("history.day") }).isTrue()
        compose.onNodeWithTag("history.profilesLabel", useUnmergedTree = true).assertTextEquals("Profiles")
        compose.onNodeWithTag("history.tagsLabel", useUnmergedTree = true).assertTextEquals("Tags")
    }

    // HistorySearch.md:9, :17 — no door with three or fewer matches.
    @Test
    fun noDoorStandsWhenNoMoreMatch() {
        render(searched("m", personEntry, tagEntry))
        compose.onAllNodesWithTag("history.profilesDoor", useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodesWithTag("history.tagsDoor", useUnmergedTree = true).assertCountEquals(0)
    }

    // HistorySearch.md:19, :27 — a door narrows to its kind alone.
    @Test
    fun theDoorsNarrowToTheirKind() {
        render(searched("m", personEntry, tagEntry, morePeople = true, moreTags = true))
        compose.onNodeWithTag("history.profilesDoor", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("history.tagsDoor", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly("narrow:PROFILE", "narrow:TAG").inOrder()
    }

    // HistorySearch.md:21, :29 — a kind alone stands with no caption and no door.
    @Test
    fun aKindAloneStandsWithoutItsCaptionAndDoor() {
        render(searched("m", personEntry, kinds = setOf(FeedKind.PROFILE), morePeople = true))
        compose.onNodeWithTag("history.profileCard:u-mira").assertIsDisplayed()
        compose.onAllNodesWithTag("history.profilesLabel", useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodesWithTag("history.profilesDoor", useUnmergedTree = true).assertCountEquals(0)
    }

    // HistoryFilter.md:3-13, :25 — the sheet: its title, the four kinds, no "?",
    // a chip stages without History moving, Reset in the corner, Done at the end.
    @Test
    fun theFilterSheetStagesItsKindsAndDoneCommitsOnce() {
        render(whole(postEntry))
        compose.onNodeWithTag("history.filterTrigger", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("history.filterSheet").assertIsDisplayed()
        compose.onNodeWithText("What your history shows").assertIsDisplayed()
        listOf("postsChip", "commentsChip", "profilesChip", "topicsChip").forEach { chip ->
            compose.onNodeWithTag("history.filterSheet.kinds.$chip", useUnmergedTree = true).assertIsDisplayed()
        }
        compose.onAllNodesWithContentDescription("What this means").assertCountEquals(0)
        compose.onNodeWithTag("history.filterSheet.kinds.topicsChip", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("history.filterSheet.kinds.postsChip", useUnmergedTree = true).performClick()
        // A chip stages: History never moves behind the sheet.
        assertThat(calls).isEmpty()
        compose.onNodeWithTag("history.filterSheet.foot.done", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly("kinds:[POST, TAG]")
        compose.onAllNodesWithTag("history.filterSheet").assertCountEquals(0)
    }

    // HistoryFilter.md:29 — Reset stages the default, no kind narrowed, and reads nothing.
    @Test
    fun resetStagesTheDefaultAndReadsNothing() {
        render(whole(postEntry).copy(kinds = setOf(FeedKind.TAG), answered = HistoryAsk(null, setOf(FeedKind.TAG))))
        compose.onNodeWithTag("history.filterTrigger", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("history.filterSheet.kinds.topicsChip")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.ToggleableState, ToggleableState.On))
        compose.onNodeWithTag("history.filterSheet.foot.reset", useUnmergedTree = true).performClick()
        assertThat(calls).isEmpty()
        compose.onNodeWithTag("history.filterSheet.foot.done", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly("kinds:[]")
    }
}
