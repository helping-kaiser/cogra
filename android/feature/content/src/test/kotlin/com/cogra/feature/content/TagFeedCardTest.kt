// The tag feed card (FeedTagShapes.md; History.md:59, :63): the `#` tile and
// name, the why-line only where the tag reaches the reader through someone,
// the glimpse's newest thing over its author and how many more, the empty
// tag's one line with no age, and the row's doors. web's twin is
// `tag-feed-card.test.tsx`.

package com.cogra.feature.content

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.history.TagCardTopic
import com.cogra.domain.history.TaggedGlimpse
import com.cogra.domain.testing.testModeratedField
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class TagFeedCardTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.parse("2026-10-05T10:00:00Z")
    private val node = DataNode("history") / "tagCard"
    private val card = "history.tagCard:saltmaps"
    private val calls = mutableListOf<String>()

    private fun thing(id: String, title: String, handle: String, hoursAgo: Long, comment: Boolean = false) =
        TaggedGlimpse(id, comment, title, null, false, handle, now.minusSeconds(hoursAgo * 3_600))

    private fun render(tagged: List<TaggedGlimpse>, through: List<String> = emptyList()) {
        compose.setContent {
            TagFeedCard(
                topic = TagCardTopic("h1", testModeratedField("saltmaps"), tagged),
                node = node,
                actions = TagCardActions(
                    onOpen = { calls += "open:$it" },
                    onCompose = { calls += "compose:$it" },
                    onShare = { calls += "share:$it" },
                    stance = { _, _ -> },
                ),
                through = through,
                now = now,
            )
        }
    }

    private val three = listOf(
        thing("p1", "Low tide at six tomorrow", "tobias", 1),
        thing("p2", "Salt maps of the coast road", "sol", 72),
        thing("c1", "Low tide is kinder to the rubbings", "ada", 96, comment = true),
    )

    @Test
    fun theLeadReadsTheTagsNameBesideItsTileAndTheNewestThingsAge() {
        render(three)
        compose.onNodeIn(card, "history.tagCard.name", useUnmergedTree = true).assertTextEquals("#saltmaps")
        compose.onAllNodesWithTag("history.tagCard.mark", useUnmergedTree = true).assertCountEquals(1)
        compose.onNodeIn(card, "history.tagCard.timestamp", useUnmergedTree = true).assertTextEquals("1h")
    }

    @Test
    fun theGlimpseNamesTheNewestOverItsAuthorAndCountsTheRest() {
        render(three)
        compose.onNodeIn(card, "history.tagCard.glimpse.newest", useUnmergedTree = true)
            .assertTextEquals("Low tide at six tomorrow")
        compose.onNodeIn(card, "history.tagCard.glimpse.by", useUnmergedTree = true)
            .assertTextEquals("@tobias · and 2 more")
    }

    @Test
    fun oneThingReadsItsAuthorAlone() {
        render(three.take(1))
        compose.onNodeIn(card, "history.tagCard.glimpse.by", useUnmergedTree = true).assertTextEquals("@tobias")
    }

    @Test
    fun noWhyLineStandsWhenTheTagReachesTheReaderThroughNoOne() {
        render(three)
        compose.onAllNodesWithTag("history.tagCard.through", useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun theWhyLineNamesThePeopleItReachesThrough() {
        render(three, through = listOf("ada", "tobias"))
        compose.onNodeIn(card, "history.tagCard.through", useUnmergedTree = true)
            .assertTextEquals("Reaches you through @ada and @tobias")
    }

    @Test
    fun anEmptyTagKeepsItsCardReadsItsOneLineAndShowsNoAge() {
        render(emptyList())
        compose.onNodeIn(card, "history.tagCard.nothing", useUnmergedTree = true)
            .assertTextEquals("Nothing carries this tag right now.")
        compose.onAllNodesWithTag("history.tagCard.timestamp", useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodesWithTag("history.tagCard.glimpse", useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun theCardOpensTheTagsPageAndTheActComposesWithTheTagStaged() {
        render(three)
        compose.onNodeWithTag(card).performClick()
        compose.onNodeWithTag("history.tagCard.actionRow.compose", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("history.tagCard.actionRow.share", useUnmergedTree = true).performClick()
        assertThat(calls).containsExactly("open:saltmaps", "compose:saltmaps", "share:saltmaps").inOrder()
    }

    @Test
    fun theWhyLineCountsPastTwoAndCompressesWhereItWouldNotFit() {
        assertThat(reachesThrough(listOf("ada"))).isEqualTo("Reaches you through @ada")
        assertThat(reachesThrough(listOf("ada", "tobias", "mira", "sol")))
            .isEqualTo("Reaches you through @ada and 3 others")
        assertThat(reachesThrough(listOf("a_very_long_handle_indeed", "tobias")))
            .isEqualTo("Through @a_very_long_handle_indeed")
    }
}
