// The card's score slot (FeedKinds.md:3-15; PostDetail.md:19; ComposeLanded.md:5;
// ExplainableNumber.prompt.md): the figure the latest fetch of its thing found,
// the dash where none was computed, the bare glyph for a thing still settling —
// a door on every face, handing the trace the cover and the view its figure
// came from. The web's twin is `score-slot.test.tsx`.

package com.cogra.feature.content

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.history.TagCardTopic
import com.cogra.domain.score.FeedStandings
import com.cogra.domain.score.TraceThingKind
import com.cogra.domain.testing.entry
import com.cogra.domain.testing.settling
import com.cogra.domain.testing.testModeratedField
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ScoreSlotTest {

    @get:Rule
    val compose = createComposeRule()

    private val store = FeedStandings().apply {
        hold(
            reader = "u1",
            ranking = FeedRanking(
                asOfEpoch = 2,
                entries = listOf(
                    entry("p1", newestIndex = 0, score = 15.2),
                    entry("p2", newestIndex = 1, score = -0.5),
                ),
                settling = listOf(settling("s1", ranked = 2, newest = 2)),
            ),
            viewer = "lender",
        )
    }
    private val taps = mutableListOf<ScoreTap>()
    private val slot = DataNode("feed.card.actionRow.score")
    private val cover = topicCover("saltmaps")

    private fun render(targetId: String, pending: Boolean = false, dashWhileSettling: Boolean = false) {
        compose.setContent {
            CompositionLocalProvider(LocalScoreDoor provides ScoreDoor(store.state.value, "u1") { taps += it }) {
                ScoreSlot(
                    targetId = targetId,
                    kind = TraceThingKind.POST,
                    pending = pending,
                    cover = cover,
                    node = slot,
                    testTag = "slot",
                    dashWhileSettling = dashWhileSettling,
                )
            }
        }
    }

    @Test
    fun aCardsScoreIsTheFigureItsReadersLastFeedFetchComputed() {
        render("p1")
        compose.onNodeWithTag("feed.card.actionRow.score.value", useUnmergedTree = true).assertTextEquals("15.20")
        compose.onNodeWithTag(slot.tag).assertContentDescriptionEquals("Feed score 15.20")
    }

    @Test
    fun aNegativeScoreKeepsItsMinus() {
        render("p2")
        compose.onNodeWithTag(slot.tag).assertContentDescriptionEquals("Feed score −0.50")
    }

    @Test
    fun aThingTheFetchDidNotReachReadsTheDashNever0_00() {
        render("elsewhere")
        compose.onNodeWithTag(slot.tag).assertContentDescriptionEquals("Feed score —")
    }

    @Test
    fun aThingStillSettlingStandsBareOnTheCard() {
        render("s1")
        compose.onAllNodesWithTag("feed.card.actionRow.score.value", useUnmergedTree = true).assertCountEquals(0)
        compose.onNodeWithTag(slot.tag).assertContentDescriptionEquals("Feed score")
    }

    @Test
    fun theDetailsSettlingScoreReadsTheDash() {
        render("p9", pending = true, dashWhileSettling = true)
        compose.onNodeWithTag(slot.tag).assertContentDescriptionEquals("Feed score —")
    }

    @Test
    fun theTapHandsTheTraceTheCoverAndTheViewTheFigureCameFrom() {
        render("p1")
        compose.onNodeWithTag(slot.tag).performClick()
        assertThat(taps)
            .containsExactly(ScoreTap("p1", TraceThingKind.POST, settling = false, viewer = "lender", cover = cover))
    }

    @Test
    fun theSettlingSlotIsADoorToTheTraceThatMakesNoFetch() {
        render("s1")
        compose.onNodeWithTag(slot.tag).performClick()
        assertThat(taps.single().settling).isTrue()
        assertThat(taps.single().viewer).isNull()
    }

    @Test
    fun aTraceAdoptionIsWhatTheSlotReadsNext() {
        store.adopt("p1", null)
        render("p1")
        compose.onNodeWithTag(slot.tag).assertContentDescriptionEquals("Feed score —")
    }

    @Test
    fun aSurfaceWithNoDoorDrawsNoScore() {
        compose.setContent {
            TagFeedCard(
                topic = TagCardTopic("h1", testModeratedField("saltmaps"), emptyList()),
                node = DataNode("history") / "tagCard",
                actions = TagCardActions(onOpen = {}, onCompose = {}, onShare = {}, stance = { _, _ -> }),
            )
        }
        compose.onAllNodesWithTag("history.tagCard.actionRow.score").assertCountEquals(0)
    }

    @Test
    fun aTagCardWearsItsTopicsOwnStanding() {
        val topics = FeedStandings().apply {
            hold("u1", FeedRanking(1, listOf(entry("h1", newestIndex = 0, score = 3.4)), emptyList()), viewer = "u1")
        }
        compose.setContent {
            CompositionLocalProvider(LocalScoreDoor provides ScoreDoor(topics.state.value, "u1") { taps += it }) {
                TagFeedCard(
                    topic = TagCardTopic("h1", testModeratedField("saltmaps"), emptyList()),
                    node = DataNode("history") / "tagCard",
                    actions = TagCardActions(onOpen = {}, onCompose = {}, onShare = {}, stance = { _, _ -> }),
                )
            }
        }
        compose.onNodeWithTag("history.tagCard.actionRow.score").assertContentDescriptionEquals("Feed score 3.40")
        compose.onNodeWithTag("history.tagCard.actionRow.score").performClick()
        assertThat(taps.single().cover).isEqualTo(topicCover("saltmaps"))
        assertThat(taps.single().kind).isEqualTo(TraceThingKind.TOPIC)
    }
}
