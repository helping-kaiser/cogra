// The feed's filter as the reader meets it, compiled from the sidecars' lines:
// the band's trigger (Feed.md / FeedCover.md `feed.band.filterTrigger`;
// FeedNarrowed.md, FeedTopic.md, FeedSheet.md:65-79), the sheet over the feed
// and its Done (FeedSheet.md:81-87), FeedNothing (FeedNothing.md), and the
// other kinds' cards in the list (FeedKinds.md). Mutations are the host's
// callbacks; the reader default is device-only, so nothing here is sent.

package com.cogra.feature.content

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.history.TagCardTopic
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

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class FeedFilterScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val applied = mutableListOf<FeedFilter>()
    private var postsAgain = 0
    private var opened = 0

    private fun render(state: FeedUiState) {
        compose.setContent {
            FeedScreen(
                state = state,
                onRefresh = {},
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
                filter = FeedFilterCallbacks(
                    onApply = { applied += it },
                    onShowPostsAgain = { postsAgain++ },
                    onSheetOpened = { opened++ },
                ),
            )
        }
    }

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    private val trigger get() = node("feed.band.filterTrigger")

    private fun spoken(name: String) =
        SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf(name))

    // ── THE TRIGGER (FeedNarrowed.md, FeedTopic.md, FeedSheet.md) ────────

    @Test
    fun theTriggerReadsPostsAtTheDefaultAndCarriesNoGlyph() {
        render(FeedUiState(loading = false))
        trigger.assertIsDisplayed()
        compose.onNodeWithText("Posts").assertIsDisplayed()
    }

    // FeedSheet.md:79 — "the trigger's spoken name is its reading followed by what your feed shows".
    @Test
    fun theTriggersSpokenNameIsItsReadingThenItsPurpose() {
        render(FeedUiState(loading = false))
        compose.onNode(spoken("Posts, what your feed shows")).assertIsDisplayed()
    }

    @Test
    fun theTriggerSpeaksTheDeviationsFromTheReadersDefault() {
        val readers = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST)
        render(FeedUiState(loading = false, filter = FeedFilter.DEFAULT, readerDefault = readers))
        // Back toward the app's default reads like any other deviation (FeedSheet.md:67).
        compose.onNodeWithText("Posts · ranked").assertIsDisplayed()
    }

    @Test
    fun theTriggerNamesTheTopicLeadingTheExtras() {
        render(FeedUiState(loading = false, filter = FeedFilter.DEFAULT.copy(topic = FeedTopic("t", "saltmaps"))))
        compose.onNodeWithText("Posts · #saltmaps").assertIsDisplayed()
    }

    @Test
    fun theTriggerReadsSettledOnlyAndTheBorrowedPeoplesName() {
        val narrowed = FeedFilter.DEFAULT.copy(people = PeopleScope.YOUR_PEOPLE, peopleSign = PeopleSign.FOR)
        render(FeedUiState(loading = false, filter = narrowed, borrowedHandle = "mira"))
        // `Posts · @mira's people, for` outgrows the 154 budget: the count (FeedSheet.md, borrowed view).
        compose.onNodeWithText("Posts · 1 change").assertIsDisplayed()
    }

    // ── THE SHEET OVER THE FEED (FeedSheet.md) ───────────────────────────

    @Test
    fun theTriggerOpensTheSheetStagedFromWhatTheFeedShows() {
        render(FeedUiState(loading = false, filter = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST)))
        trigger.performClick()
        node("feed.filterSheet").assertIsDisplayed()
        node("feed.filterSheet.order.picker.newestOption").assertIsSelected()
        assertThat(opened).isEqualTo(1)
    }

    // FeedSheet.md:37 + :81 — taps stage, the feed never moves before Done; Done
    // with changes hands the staged filter over once and says the new name.
    @Test
    fun doneWithChangesCommitsOnceSaysTheNewNameAndReturnsFocus() {
        render(FeedUiState(loading = false))
        trigger.performClick()
        node("feed.filterSheet.order.picker.newestOption").performClick()
        node("feed.filterSheet.also.settlingChip").performClick()
        assertThat(applied).isEmpty()

        node("feed.filterSheet.foot.done").performClick()

        assertThat(applied).containsExactly(FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST, stillSettling = false))
        compose.onAllNodesWithTag("feed.filterSheet", useUnmergedTree = true).assertCountEquals(0)
        node(FEED_FILTER_STATUS).assert(spoken("Posts · newest · settled only, what your feed shows"))
        trigger.assertIsFocused()
    }

    // FeedSheet.md:83 — "WHEN tap Done GIVEN … nothing changed -> … NEVER the feed re-queries".
    @Test
    fun doneUnchangedCommitsNothingAndSaysNothing() {
        render(FeedUiState(loading = false))
        trigger.performClick()
        node("feed.filterSheet.foot.done").performClick()
        assertThat(applied).isEmpty()
        node(FEED_FILTER_STATUS).assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
    }

    // FeedSheet.md:63 — "WHEN tap Reset -> the sheet stages the reader's default AND NEVER the feed re-queries".
    @Test
    fun resetStagesTheReadersDefaultNeverCoGras() {
        val readers = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST)
        val tagsOnly = FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.TAG))
        render(FeedUiState(loading = false, filter = tagsOnly, readerDefault = readers))
        trigger.performClick()
        node("feed.filterSheet.foot.reset").performClick()
        assertThat(applied).isEmpty()
        node("feed.filterSheet.foot.done").performClick()
        assertThat(applied).containsExactly(readers)
    }

    @Test
    fun theFeedsSheetCarriesTheHeldForTopicsLast() {
        render(FeedUiState(loading = false, heldTopics = listOf(FeedTopic("t1", "saltmaps"))))
        trigger.performClick()
        node("feed.filterSheet.topic.chip:saltmaps").assertIsDisplayed()
    }

    // ── FEEDNOTHING (FeedNothing.md) ─────────────────────────────────────

    @Test
    fun everyKindOffShowsTheEmptyStateAloneAndItsWayBack() {
        render(FeedUiState(loading = false, filter = FeedFilter.DEFAULT.copy(kinds = emptySet())))
        compose.onNodeWithText("Nothing").assertIsDisplayed()
        node("feed.nothing.title").assertTextEquals("Your feed is showing nothing — everything is switched off.")
        compose.onAllNodesWithTag(FEED_SEEN_SEPARATOR, useUnmergedTree = true).assertCountEquals(0)
        node("feed.nothing.action").performClick()
        assertThat(postsAgain).isEqualTo(1)
    }

    // ── EVERY KIND AS ITS OWN CARD (FeedKinds.md) ────────────────────────

    @Test
    fun theOtherKindsStandAsTheirOwnCardsInTheListsOrder() {
        render(
            FeedUiState(
                loading = false,
                filter = FeedFilter.DEFAULT.copy(kinds = FeedKind.entries.toSet()),
                cards = listOf(
                    FeedCard.Post(testPost("p1")),
                    FeedCard.Comment(testComment("c1"), target = null, threadPostId = "p1"),
                    FeedCard.Person(testProfile("u-mira", "mira", "Mira")),
                    FeedCard.Tag(TagCardTopic("h1", testModeratedField("saltmaps"), emptyList())),
                ),
            ),
        )
        node("feed.card:author").assertIsDisplayed()
        node("feed.commentCard:c1").assertIsDisplayed()
        node("feed.profileCard:u-mira").assertIsDisplayed()
        node("feed.tagCard:saltmaps").assertIsDisplayed()
        // FeedTagShapes.md — an empty tag keeps its card and says so.
        compose.onNodeWithText("Nothing carries this tag right now.").assertIsDisplayed()
    }
}
