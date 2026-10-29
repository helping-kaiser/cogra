// The filter sheet itself, compiled from its sidecars' lines (FeedSheet.md,
// SettingsReading.md): the sections and their chips, the people rows and the
// sign row, the one topic, staging, Reset and Done, the corner "?" against
// the titled one. What a Done DOES is the host's (the feed's and Settings'
// tests); here the sheet only hands its staged value over. web's twin is
// `web/src/lib/ui2/feed-filter-sheet.test.tsx` and the feed's filter tests.

package com.cogra.feature.feedfilter

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedForm
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class FeedFilterSheetTest {

    @get:Rule
    val compose = createComposeRule()

    private val feedSheet = DataNode("feed.filterSheet")
    private val settingsSheet = DataNode("settings.feedSheet")
    private val maps = FeedTopic("t1", "saltmaps")
    private val rust = FeedTopic("t2", "rust")

    /** What the host saw: the staged value, Reset, Done and the dismissal. */
    private var staged by mutableStateOf(FeedFilter.DEFAULT)
    private var resets = 0
    private var dones = 0
    private var dismissals = 0

    private fun show(
        start: FeedFilter = FeedFilter.DEFAULT,
        node: DataNode = feedSheet,
        titled: Boolean = false,
        topics: List<FeedTopic> = emptyList(),
        borrowedHandle: String? = null,
    ) {
        staged = start
        compose.setContent {
            FeedFilterSheet(
                staged = staged,
                onStage = { staged = it },
                onReset = { resets += 1 },
                onDone = { dones += 1 },
                onDismiss = { dismissals += 1 },
                node = node,
                titled = titled,
                topics = topics,
                borrowedHandle = borrowedHandle,
            )
        }
    }

    private fun tag(path: String) = compose.onNodeWithTag(path, useUnmergedTree = true)

    private fun toggled(state: ToggleableState) =
        SemanticsMatcher.expectValue(SemanticsProperties.ToggleableState, state)

    private fun on(path: String) = tag(path).assert(toggled(ToggleableState.On))

    private fun off(path: String) = tag(path).assert(toggled(ToggleableState.Off))

    // FeedSheet.md:3 — "ALWAYS the filter's kinds are the kinds V1.0 serves".
    @Test
    fun theKindsAreTheFourV10ServesInTheSheetsOrder() {
        show()
        listOf("postsChip", "commentsChip", "profilesChip", "topicsChip").forEach {
            tag("feed.filterSheet.kinds.$it").assertIsDisplayed()
        }
        compose.onNodeWithText("Tags").assertIsDisplayed()
    }

    // FeedSheet.md:43 — the default: Posts, Ranked, Everyone, Either, seen off,
    // Still settling on, Sensitive and Removed off.
    @Test
    fun theDefaultDrawsAsTheBoardDrawsIt() {
        show()
        on("feed.filterSheet.kinds.postsChip")
        off("feed.filterSheet.kinds.commentsChip")
        tag("feed.filterSheet.order.picker.rankedOption").assertIsSelected()
        off("feed.filterSheet.order.seen")
        on("feed.filterSheet.also.settlingChip")
        off("feed.filterSheet.also.sensitiveChip")
        off("feed.filterSheet.also.removedChip")
        tag("feed.filterSheet.people.everyone:everyone").assertIsSelected()
        // FeedSheet.md:21 — "ALWAYS no sign row stands GIVEN Everyone is on".
        compose.onAllNodesWithTag("feed.filterSheet.people.sign:your-people", useUnmergedTree = true)
            .assertCountEquals(0)
    }

    // FeedSheet.md:5-7, :37 — kinds and forms combine; a tap only stages.
    @Test
    fun kindAndFormChipsCombineAndOnlyStage() {
        show()
        tag("feed.filterSheet.kinds.commentsChip").performClick()
        tag("feed.filterSheet.forms.textChip").performClick()
        assertThat(staged.kinds).containsExactly(FeedKind.POST, FeedKind.COMMENT)
        assertThat(staged.forms).containsExactly(FeedForm.PHOTOS, FeedForm.VIDEO)
        assertThat(dones).isEqualTo(0)
    }

    // FeedSheet.md:75 — "WHEN the last kind chip is switched off -> NEVER the chip refuses the tap".
    @Test
    fun theLastKindChipNeverRefuses() {
        show()
        tag("feed.filterSheet.kinds.postsChip").performClick()
        assertThat(staged.kinds).isEmpty()
    }

    // FeedFilter.jsx `postsish` — the forms apply once posts or comments are in.
    @Test
    fun theFormsStandLockedWithNeitherPostsNorCommentsIn() {
        show(FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.PROFILE)))
        tag("feed.filterSheet.forms.textChip").assertIsNotEnabled()
        compose.onNodeWithText("Applies once posts or comments are in.").assertIsDisplayed()
    }

    // FeedSheet.md:11, :39-41 — one order; the seen toggle flips, staged.
    @Test
    fun theOrderIsOneAndTheSeenToggleFlipsStaged() {
        show()
        tag("feed.filterSheet.order.picker.newestOption").performClick()
        tag("feed.filterSheet.order.seen").performClick()
        assertThat(staged.order).isEqualTo(FeedOrder.NEWEST)
        assertThat(staged.showSeen).isTrue()
        tag("feed.filterSheet.order.picker.newestOption").assertIsSelected()
    }

    @Test
    fun theAlsoChipsStage() {
        show()
        tag("feed.filterSheet.also.settlingChip").performClick()
        tag("feed.filterSheet.also.sensitiveChip").performClick()
        assertThat(staged.stillSettling).isFalse()
        assertThat(staged.showSensitive).isTrue()
    }

    // FeedSheet.md:13-27 — the rows, the sign row under Your people, its word
    // kept across Everyone.
    @Test
    fun yourPeopleRaisesTheSignRowAndEveryoneLowersItKeepingItsWord() {
        show()
        tag("feed.filterSheet.people.yourPeople:everyone").performClick()
        assertThat(staged.people).isEqualTo(PeopleScope.YOUR_PEOPLE)
        tag("feed.filterSheet.people.sign:your-people").assertIsDisplayed()
        tag("feed.filterSheet.people.sign.either").assertIsSelected()
        compose.onNodeWithText("For").performClick()
        assertThat(staged.peopleSign).isEqualTo(PeopleSign.FOR)
        tag("feed.filterSheet.people.everyone:your-people").performClick()
        assertThat(staged.people).isEqualTo(PeopleScope.EVERYONE)
        assertThat(staged.peopleSign).isEqualTo(PeopleSign.FOR)
        compose.onAllNodesWithTag("feed.filterSheet.people.sign:everyone", useUnmergedTree = true)
            .assertCountEquals(0)
    }

    // FeedSheet.md:29-35, :53 — only the held-for topics, at most one on, last.
    @Test
    fun aTopicChipTurnsOnAloneAndItsTapClearsIt() {
        show(topics = listOf(maps, rust))
        tag("feed.filterSheet.topic.tag:saltmaps").performScrollTo().performClick()
        assertThat(staged.topic).isEqualTo(maps)
        tag("feed.filterSheet.topic.tag:rust").performClick()
        assertThat(staged.topic).isEqualTo(rust)
        tag("feed.filterSheet.topic.tag:rust").performClick()
        assertThat(staged.topic).isNull()
        tag("feed.filterSheet.topic.allTopics").assertIsDisplayed()
    }

    @Test
    fun noHeldTopicDrawsNoTopicSection() {
        show()
        compose.onAllNodesWithTag("feed.filterSheet.topic", useUnmergedTree = true).assertCountEquals(0)
    }

    // FeedSheet.md:55-63 — the foot: Reset and Done hand over, nothing else.
    @Test
    fun theFootsResetAndDoneHandOverToTheHost() {
        show()
        tag("feed.filterSheet.foot.reset").performClick()
        tag("feed.filterSheet.foot.done").performClick()
        assertThat(resets).isEqualTo(1)
        assertThat(dones).isEqualTo(1)
    }

    // FeedSheet.md:73 — the feed sheet's "?" sits in its corner and opens the filter's dialog.
    @Test
    fun theFeedSheetsHelpRidesTheCornerAndSaysWhatResetDoes() {
        show()
        compose.onAllNodesWithTag("feed.filterSheet.title", useUnmergedTree = true).assertCountEquals(0)
        tag("feed.filterSheet.help").performClick()
        compose.onNodeWithText("How the filter works").assertIsDisplayed()
        compose.onAllNodesWithText("Reset brings back your defaults, to change them go to settings.", substring = true)
            .assertCountEquals(1)
        compose.onAllNodesWithText("waits below the Already seen line", substring = true).assertCountEquals(1)
    }

    // SettingsReading.md:1-11 — titled, its "?" on the title's row, the note,
    // focus on the title, and no topic section (a default never holds one).
    @Test
    fun theSettingsSheetIsTitledWithItsHelpOnTheTitlesRowAndNoTopics() {
        show(node = settingsSheet, titled = true, topics = listOf(maps))
        tag("settings.feedSheet.title").assertIsDisplayed().assertIsFocused()
        tag("settings.feedSheet.title.help").assertIsDisplayed()
        tag("settings.feedSheet.note").assertIsDisplayed()
        compose.onAllNodesWithTag("settings.feedSheet.help", useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodesWithTag("settings.feedSheet.topic", useUnmergedTree = true).assertCountEquals(0)
        tag("settings.feedSheet.kinds.postsChip").assertIsDisplayed()
    }

    // FeedSheet.md, GIVEN the feed borrows a view — the vantage's name, the
    // reader's own first person elsewhere.
    @Test
    fun aBorrowedViewSpeaksTheVantagesName() {
        show(FeedFilter.DEFAULT.copy(people = PeopleScope.YOUR_PEOPLE), borrowedHandle = "mira")
        compose.onNodeWithText("@mira's people").assertIsDisplayed()
        compose.onNodeWithText("The whole feed, as far as @mira's eyes reach.").assertIsDisplayed()
        compose.onNodeWithText("Only the people @mira holds an opinion of — the same rank, narrowed to them.")
            .assertIsDisplayed()
        compose.onNodeWithText("Show what you've already seen").assertIsDisplayed()
    }
}
