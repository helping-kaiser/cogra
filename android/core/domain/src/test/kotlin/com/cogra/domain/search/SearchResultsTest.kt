// The results' layout, compiled from the sidecars: ExploreSearch.md (rank,
// seam, ages, Newest), ExplorePerson.md (sections, the cap's door, Profiles
// alone, the own row), ExploreUnscoped.md (the scope line's two cases).

package com.cogra.domain.search

import com.cogra.domain.feed.FeedKind
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Instant
import java.time.ZoneOffset

class SearchResultsTest {

    private val now = Instant.parse("2026-10-28T12:00:00Z")

    private fun post(id: String, title: String?, agoHours: Long = 2, cover: String? = null) =
        SearchNode.Post(id, title, now.minusSeconds(agoHours * 3600), cover)

    private fun person(id: String, handle: String, name: String? = null) = SearchNode.Person(id, handle, name, null)

    private fun tag(id: String, name: String) = SearchNode.Tag(id, name)

    private fun context(order: SearchOrder = SearchOrder.RANKED, query: String = "sal", reader: String? = "me") =
        ResultsContext(query = query, reader = reader, order = order, now = now, zone = ZoneOffset.UTC)

    private fun rows(items: List<ResultItem>) = items.filterIsInstance<ResultItem.Row>()

    @Test
    fun `a ranked row carries its rank to two places and no age`() {
        val items = layoutResults(listOf(SearchHit(post("p1", "Salt maps"), 9.1)), emptySet(), false, context())
        val row = rows(items).single()
        assertThat(row.rank).isEqualTo("9.10")
        assertThat(row.value).isNull()
        assertThat(items.none { it is ResultItem.Seam }).isTrue()
    }

    @Test
    fun `under Ranked the seam stands before the first unscored row and the rest show their age`() {
        val items = layoutResults(
            listOf(
                SearchHit(post("p1", "Salt maps"), 9.1),
                SearchHit(post("p2", "First try", agoHours = 50), null),
                SearchHit(post("p3", "Older", agoHours = 24 * 40), null),
            ),
            emptySet(),
            false,
            context(),
        )
        assertThat(items.map { it::class.simpleName }).containsExactly("Row", "Seam", "Row", "Row").inOrder()
        assertThat(rows(items).map { it.value }).containsExactly(null, "2d", "18.09.2026").inOrder()
    }

    @Test
    fun `a tag or a person past the seam carries nothing on its right edge`() {
        val items = layoutResults(
            listOf(SearchHit(person("u1", "sal"), null), SearchHit(tag("t1", "saltmaps"), null)),
            emptySet(),
            false,
            context(),
        )
        rows(items).forEach {
            assertThat(it.rank).isNull()
            assertThat(it.value).isNull()
        }
    }

    @Test
    fun `under Newest there is no seam, no rank, and every row but a tag or a person carries its age`() {
        val items = layoutResults(
            listOf(
                SearchHit(post("p1", "Salt maps"), null),
                SearchHit(tag("t1", "saltmaps"), null),
            ),
            emptySet(),
            false,
            context(order = SearchOrder.NEWEST),
        )
        assertThat(items.none { it is ResultItem.Seam }).isTrue()
        assertThat(rows(items).map { it.value }).containsExactly("2h", null).inOrder()
        assertThat(rows(items).all { it.rank == null }).isTrue()
    }

    @Test
    fun `the people stand first under Profiles and the door closes the section when more match`() {
        val items = layoutResults(
            listOf(
                SearchHit(person("u1", "saltorres", "Sal Torres"), 4.2),
                SearchHit(person("u2", "inesalas", "Ines Salas"), 3.1),
                SearchHit(person("u3", "salome", "Salome Ward"), 2.6),
                SearchHit(post("p1", "Salt maps"), 9.1),
            ),
            emptySet(),
            hasMorePeople = true,
            context = context(),
        )
        assertThat(items[0]).isEqualTo(ResultItem.ProfilesLabel)
        assertThat(items[4]).isEqualTo(ResultItem.ProfilesDoor)
        assertThat(rows(items).map { it.position }).containsExactly(1, 2, 3, 4).inOrder()
        val sal = rows(items).first()
        assertThat(sal.name).isEqualTo("Sal Torres")
        assertThat(sal.sub).isEqualTo(ResultSub.Handle("saltorres"))
    }

    @Test
    fun `no door stands when three people or fewer match`() {
        val items = layoutResults(listOf(SearchHit(person("u1", "sal"), 1.0)), emptySet(), false, context())
        assertThat(items).doesNotContain(ResultItem.ProfilesDoor)
        assertThat(items).contains(ResultItem.ProfilesLabel)
    }

    @Test
    fun `Profiles alone stands only the people with no caption and no door`() {
        val items = layoutResults(
            listOf(SearchHit(person("u1", "sal"), 1.0), SearchHit(person("u2", "sally"), 1.0)),
            setOf(FeedKind.PROFILE),
            hasMorePeople = true,
            context = context(),
        )
        assertThat(items.all { it is ResultItem.Row }).isTrue()
    }

    @Test
    fun `the reader's own row opens the own profile and another person's opens theirs`() {
        val items = layoutResults(
            listOf(SearchHit(person("me", "jakob"), 1.0), SearchHit(person("u2", "sal"), 1.0)),
            emptySet(),
            false,
            context(),
        )
        assertThat(rows(items).map { it.door }).containsExactly(
            ResultDoor.Person("jakob", own = true),
            ResultDoor.Person("sal", own = false),
        ).inOrder()
    }

    @Test
    fun `a comment reads on its root post's title and lands on itself in the thread`() {
        val comment = SearchNode.Comment(
            id = "c1",
            content = "The wax-stick ones",
            createdAt = now,
            threadPostId = "p9",
            threadPostTitle = "Salt flats",
        )
        val row = rows(layoutResults(listOf(SearchHit(comment, null)), emptySet(), false, context())).single()
        assertThat(row.sub).isEqualTo(ResultSub.On("Salt flats"))
        assertThat(row.door).isEqualTo(ResultDoor.Comment("p9", "c1"))
    }

    @Test
    fun `a tag reached through a person cue reads tagged by that handle`() {
        val hits = listOf(SearchHit(tag("t1", "saltmaps"), 3.4))
        val row = rows(layoutResults(hits, emptySet(), false, context(query = "@sol salt"))).single()
        assertThat(row.sub).isEqualTo(ResultSub.TaggedBy("sol"))
        assertThat(row.door).isEqualTo(ResultDoor.Topic("saltmaps"))
    }

    @Test
    fun `each section stands its own seam under Ranked`() {
        val items = layoutResults(
            listOf(SearchHit(person("u1", "sal"), null), SearchHit(post("p1", "Salt"), null)),
            emptySet(),
            false,
            context(),
        )
        assertThat(items.filterIsInstance<ResultItem.Seam>().map { it.section })
            .containsExactly(SearchSection.PEOPLE, SearchSection.CONTENT).inOrder()
    }

    @Test
    fun `comments with no cue take the scope line, alone or beside another kind`() {
        assertThat(onlyUnscopedComments("salt flats", setOf(FeedKind.COMMENT))).isTrue()
        assertThat(unscopedComments("salt flats", setOf(FeedKind.COMMENT, FeedKind.POST))).isTrue()
        assertThat(onlyUnscopedComments("salt flats", setOf(FeedKind.COMMENT, FeedKind.POST))).isFalse()
        assertThat(unscopedComments("@sol salt", setOf(FeedKind.COMMENT))).isFalse()
        assertThat(unscopedComments("#saltmaps", setOf(FeedKind.COMMENT))).isFalse()
        assertThat(unscopedComments("salt", emptySet())).isFalse()
    }

    @Test
    fun `only a leading cue scopes and the remainder makes it a content search`() {
        assertThat(cueOf("@sol")).isEqualTo(Cue('@', "sol", scoped = false))
        assertThat(cueOf("  #salt maps ")).isEqualTo(Cue('#', "salt", scoped = true))
        assertThat(cueOf("salt @sol")).isNull()
    }
}
