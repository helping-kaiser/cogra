// Explore's view, compiled from the sidecars line by line where a line is a
// drawing: Explore.md (the order at rest, the door, the recents, guests),
// ExploreSearch.md (the trigger's reading and name, ranks and ages, the seam,
// the faults), ExplorePerson.md (the people section), ExploreNone.md,
// ExploreUnscoped.md and ExploreFilter.md (the sheet stages; Done commits).

package com.cogra.feature.explore

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.search.SearchFilter
import com.cogra.domain.search.SearchHit
import com.cogra.domain.search.SearchNode
import com.cogra.domain.search.SearchOrder
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant

// The harness's phone (411dp wide) at a tall height, so the rest view's
// lazy column composes every row the board draws.
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h914dp")
class ExploreScreenTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val now = Instant.parse("2026-10-28T12:00:00Z")

    private val opened = mutableListOf<String>()

    private val doors = ExploreDoors(
        onOpenPost = { opened += "post:$it" },
        onOpenComment = { post, comment -> opened += "comment:$post/$comment" },
        onOpenPerson = { opened += "person:$it" },
        onOpenOwnProfile = { opened += "own" },
        onOpenTopic = { opened += "topic:$it" },
        onOpenYourTopics = { opened += "yourTopics" },
    )

    private val member = ExploreUiState(resolved = true, reader = "me", heldCount = 5)
    private val guest = ExploreUiState(resolved = true, reader = null)

    private fun render(state: ExploreUiState, actions: ExploreActions = ExploreActions(), bell: BandBell? = null) {
        compose.setContent {
            ExploreScreen(state = state, doors = doors, actions = actions, bell = bell, onChats = {}, now = now)
        }
    }

    private fun results(query: String, filter: SearchFilter, vararg hits: SearchHit, hasMorePeople: Boolean = false) =
        ExploreResults(hits.toList(), null, false, hasMorePeople, query, filter)

    private fun post(id: String, title: String, score: Double? = null) =
        SearchHit(SearchNode.Post(id, title, now.minusSeconds(2 * 3600), null), score)

    private fun person(id: String, handle: String, name: String, score: Double? = null) =
        SearchHit(SearchNode.Person(id, handle, name, null), score)

    private fun top(tag: String): Float = compose.onNodeWithTag(tag, useUnmergedTree = true)
        .fetchSemanticsNode().boundsInRoot.top

    // -- Explore.md --

    @Test
    fun `at rest Explore reads the field, then the Sky's card, then Your topics, then Recent`() {
        render(member.copy(recents = listOf("@sol salt", "coast road")))
        val order = listOf("explore.searchField", "explore.skyCard", "explore.topics", "explore.recentLabel")
        val tops = order.map(::top)
        assertThat(tops).isInStrictOrder()
        compose.onNodeWithTag("explore.recent:sol-salt", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("explore.recent:coast-road", useUnmergedTree = true).assertExists()
    }

    @Test
    fun `the Sky's card reads coming soon and opens nothing`() {
        render(member)
        compose.onNodeWithText("The Sky — coming soon").assertIsDisplayed()
        compose.onNodeWithTag("explore.skyCard", useUnmergedTree = true)
            .assert(SemanticsMatcher.keyNotDefined(androidx.compose.ui.semantics.SemanticsActions.OnClick))
    }

    @Test
    fun `Your topics' second line counts the topics held and the door opens the list`() {
        render(member)
        compose.onNodeWithText("5 held", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("explore.topics_open").performClick()
        assertThat(opened).containsExactly("yourTopics")
    }

    @Test
    fun `a guest's Explore has the bare band and no door`() {
        render(guest)
        compose.onNodeWithTag("explore.topics", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("explore.band.bell", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("explore.band.chats", useUnmergedTree = true).assertExists()
    }

    @Test
    fun `a member's band carries the bell`() {
        render(member, bell = BandBell(lit = false, onOpen = {}))
        compose.onNodeWithTag("explore.band.bell", useUnmergedTree = true).assertExists()
    }

    @Test
    fun `tapping a recent runs its query again`() {
        val ran = mutableListOf<String>()
        render(member.copy(recents = listOf("coast road")), ExploreActions(onRecent = { ran += it }))
        compose.onNodeWithTag("explore.recent:coast-road", useUnmergedTree = true).performClick()
        assertThat(ran).containsExactly("coast road")
    }

    @Test
    fun `the field carries a trailing x while it holds text, and the x rests the root`() {
        var cleared = 0
        render(member.copy(query = "salt"), ExploreActions(onClear = { cleared += 1 }))
        compose.onNodeWithTag("explore.searchField.clear", useUnmergedTree = true).performClick()
        assertThat(cleared).isEqualTo(1)
    }

    @Test
    fun `at rest there is no trailing x`() {
        render(member)
        compose.onNodeWithTag("explore.searchField.clear", useUnmergedTree = true).assertDoesNotExist()
    }

    // -- ExploreSearch.md --

    @Test
    fun `typing takes the screen, the band and the Sky's card leave, the trigger reads Everything`() {
        render(member.copy(query = "salt"))
        compose.onNodeWithTag("explore.band.wordmark", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("explore.skyCard", useUnmergedTree = true).assertDoesNotExist()
        // The tag is the drawn pill; the control around it carries the name.
        compose.onNodeWithTag("explore.filterTrigger", useUnmergedTree = true).assertExists()
        compose.onNodeWithContentDescription("Everything, what the search shows").assertExists()
    }

    @Test
    fun `the trigger speaks only the deviations from the reader's default`() {
        val filter = SearchFilter(kinds = setOf(FeedKind.COMMENT), order = SearchOrder.NEWEST)
        render(member.copy(query = "salt", filter = filter))
        // The tag is the drawn pill; the control around it carries the name.
        compose.onNodeWithTag("explore.filterTrigger", useUnmergedTree = true).assertExists()
        compose.onNodeWithContentDescription("Comments · newest, what the search shows").assertExists()
    }

    @Test
    fun `a ranked row carries its rank, the seam stands, and the rows behind it their ages`() {
        val filter = SearchFilter()
        render(
            member.copy(
                query = "salt",
                results = results("salt", filter, post("p1", "Salt maps", 9.1), post("p2", "First try")),
            ),
        )
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("9.10", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("explore.seam:content", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Beyond your reach — newest first", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("2h", useUnmergedTree = true).assertExists()
        assertThat(top("explore.seam:content")).isLessThan(top("explore.result:2"))
    }

    @Test
    fun `a guest's results carry ages, no rank and no seam`() {
        val filter = SearchFilter(order = SearchOrder.NEWEST, seen = true)
        render(guest.copy(query = "salt", filter = filter, results = results("salt", filter, post("p1", "Salt maps"))))
        compose.onNodeWithTag("explore.seam:content", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText("2h", useUnmergedTree = true).assertExists()
    }

    @Test
    fun `opening a result writes the recent and opens its thing`() {
        var remembered = 0
        val filter = SearchFilter()
        render(
            member.copy(query = "salt", results = results("salt", filter, post("p1", "Salt maps", 9.1))),
            ExploreActions(onOpenResult = { remembered += 1 }),
        )
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).performClick()
        assertThat(remembered).isEqualTo(1)
        assertThat(opened).containsExactly("post:p1")
    }

    @Test
    fun `Loading shows in the rows' place once the refine outruns the ladder`() {
        val filter = SearchFilter()
        render(
            member.copy(
                query = "salty",
                pending = true,
                slow = true,
                results = results("salt", filter, post("p1", "Salt maps", 9.1)),
            ),
        )
        compose.onNodeWithTag("explore_loading").assertExists()
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun `under the ladder the stale rows stay readable`() {
        val filter = SearchFilter()
        render(
            member.copy(
                query = "salty",
                pending = true,
                results = results("salt", filter, post("p1", "Salt maps", 9.1)),
            ),
        )
        compose.onNodeWithTag("explore_loading").assertDoesNotExist()
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).assertExists()
    }

    @Test
    fun `a failed refine keeps the rows under Couldn't load more with Retry`() {
        var retried = 0
        val filter = SearchFilter()
        render(
            member.copy(query = "salty", failed = true, results = results("salt", filter, post("p1", "Salt maps"))),
            ExploreActions(onRetry = { retried += 1 }),
        )
        compose.onNodeWithText("Couldn't load more").assertExists()
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("explore_refine_failed_retry").performClick()
        assertThat(retried).isEqualTo(1)
    }

    @Test
    fun `a failed read with nothing loaded says the house line with Retry`() {
        render(member.copy(query = "salt", failed = true))
        compose.onNodeWithText("Can't reach the server. Check your connection and try again.", useUnmergedTree = true)
            .assertExists()
        compose.onNodeWithText("Retry", useUnmergedTree = true).assertExists()
    }

    // -- ExploreNone.md / ExploreUnscoped.md --

    @Test
    fun `a query that matches nothing reads the None line`() {
        val filter = SearchFilter()
        render(member.copy(query = "brackish cartography", results = results("brackish cartography", filter)))
        compose.onNodeWithTag("explore.empty.title", useUnmergedTree = true).assertExists()
        compose.onNodeWithText(
            "Nothing carries that name. Search reads names and titles, never bodies — fewer words reach further.",
            useUnmergedTree = true,
        ).assertExists()
    }

    @Test
    fun `Comments alone with no cue reads the scope line where results would stand and no row`() {
        val filter = SearchFilter(kinds = setOf(FeedKind.COMMENT))
        render(member.copy(query = "salt flats", filter = filter, results = results("salt flats", filter)))
        compose.onNodeWithText("Found through people and tags — start with @handle or #tag.", useUnmergedTree = true)
            .assertExists()
        compose.onAllNodesWithTag("explore.result:1", useUnmergedTree = true).fetchSemanticsNodes().let {
            assertThat(it).isEmpty()
        }
        compose.onNodeWithText(
            "Nothing carries that name. Search reads names and titles, never bodies — fewer words reach further.",
            useUnmergedTree = true,
        ).assertDoesNotExist()
    }

    @Test
    fun `Comments beside another kind keeps the rows and stands the line after the last`() {
        val filter = SearchFilter(kinds = setOf(FeedKind.COMMENT, FeedKind.POST))
        val rows = results("salt", filter, post("p1", "Salt maps", 1.0))
        render(member.copy(query = "salt", filter = filter, results = rows))
        assertThat(top("explore.result:1")).isLessThan(top("explore.empty"))
    }

    // -- ExplorePerson.md --

    @Test
    fun `the people stand first under Profiles and See all profiles closes the section`() {
        var all = 0
        val filter = SearchFilter()
        render(
            member.copy(
                query = "sal",
                results = results(
                    "sal",
                    filter,
                    person("u1", "saltorres", "Sal Torres", 4.2),
                    person("u2", "inesalas", "Ines Salas", 3.1),
                    person("u3", "salome", "Salome Ward", 2.6),
                    post("p1", "Salt maps", 9.1),
                    hasMorePeople = true,
                ),
            ),
            ExploreActions(onAllProfiles = { all += 1 }),
        )
        assertThat(top("explore.profilesLabel")).isLessThan(top("explore.result:1"))
        assertThat(top("explore.profilesDoor")).isLessThan(top("explore.result:4"))
        compose.onNodeWithText("@saltorres", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("explore.profilesDoor").performClick()
        assertThat(all).isEqualTo(1)
    }

    @Test
    fun `the reader's own row opens their own profile, another person's theirs`() {
        val filter = SearchFilter()
        render(
            member.copy(
                query = "ja",
                results = results("ja", filter, person("me", "jakob", "Jakob", 1.0), person("u2", "jade", "Jade", 1.0)),
            ),
        )
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("explore.result:2", useUnmergedTree = true).performClick()
        assertThat(opened).containsExactly("own", "person:jade").inOrder()
    }

    // -- ExploreFilter.md --

    @Test
    fun `a chip tap stages and nothing applies before Done, then Done commits once`() {
        val committed = mutableListOf<SearchFilter>()
        render(member.copy(query = "salt"), ExploreActions(onCommit = { committed += it }))
        compose.onNodeWithTag("explore.filterTrigger", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("explore.filterSheet.kinds.postsChip").performClick()
        assertThat(committed).isEmpty()
        compose.onNodeWithTag("explore.filterSheet.foot.done").performClick()
        assertThat(committed).containsExactly(SearchFilter(kinds = setOf(FeedKind.POST)))
    }

    @Test
    fun `Reset stages the default and asks nothing`() {
        val committed = mutableListOf<SearchFilter>()
        val narrowed = SearchFilter(kinds = setOf(FeedKind.TAG), order = SearchOrder.NEWEST)
        render(member.copy(query = "salt", filter = narrowed), ExploreActions(onCommit = { committed += it }))
        compose.onNodeWithTag("explore.filterTrigger", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("explore.filterSheet.foot.reset").performClick()
        assertThat(committed).isEmpty()
        compose.onNodeWithTag("explore.filterSheet.foot.done").performClick()
        assertThat(committed).containsExactly(SearchFilter())
    }

    @Test
    fun `the sheet carries the four kinds and the order section with the seen toggle`() {
        render(member.copy(query = "salt"))
        compose.onNodeWithTag("explore.filterTrigger", useUnmergedTree = true).performClick()
        listOf("postsChip", "commentsChip", "profilesChip", "topicsChip").forEach {
            compose.onNodeWithTag("explore.filterSheet.kinds.$it").assertExists()
        }
        compose.onNodeWithTag("explore.filterSheet.order.picker.rankedOption", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("explore.filterSheet.order.seen").assertExists()
        compose.onNodeWithContentDescription("How the filter works").assertExists()
    }

    @Test
    fun `a guest's sheet carries no order and no seen toggle`() {
        render(guest.copy(query = "salt", filter = SearchFilter(order = SearchOrder.NEWEST, seen = true)))
        compose.onNodeWithTag("explore.filterTrigger", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("explore.filterSheet.kinds.postsChip").assertExists()
        compose.onNodeWithTag("explore.filterSheet.order.seen", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("explore.filterSheet.order", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun `the results' help names its dialog`() {
        render(member.copy(query = "salt"))
        compose.onNodeWithTag("explore.help", useUnmergedTree = true)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf("How searching works")))
        compose.onNodeWithTag("explore.help", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("explore_help_dialog").assertExists()
    }
}
