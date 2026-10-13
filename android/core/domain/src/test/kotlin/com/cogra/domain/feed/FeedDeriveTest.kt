// The device derive's half of ranked-feed-api §14.3 (CD-7, CD-8, CD-10,
// CD-11): composition by the pod's indices under both orders, and the
// three device cuts — which delete, never re-order, and commute with the
// weave. The packet's underscore names render here in this module's
// backtick-sentence idiom.

package com.cogra.domain.feed

import com.cogra.domain.testing.entry
import com.cogra.domain.testing.rankingOf
import com.cogra.domain.testing.settling
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import kotlin.random.Random

class FeedDeriveTest {

    /**
     * Landed a, b, c in RANKED order with NEWEST c, a, b; settling s at
     * ranked 1 / newest 0 and t at ranked 4 / newest 2.
     */
    private val answer = FeedRanking(
        asOfEpoch = 9,
        entries = listOf(
            entry("a", newestIndex = 1, score = 3.0, mark = PeopleMark.FOR),
            entry("b", newestIndex = 2, score = 2.0, mark = PeopleMark.AGAINST),
            entry("c", newestIndex = 0, score = 1.0),
        ),
        settling = listOf(
            settling("s", ranked = 1, newest = 0, mark = PeopleMark.SIGNLESS),
            settling("t", ranked = 4, newest = 2),
        ),
    )

    private fun FeedRanking.ids(filter: FeedFilter = FeedFilter(), seen: Set<String> = emptySet()) =
        derive(filter, seen).map { it.targetId }

    @Test
    fun `settling rows stand at their woven positions under both orders`() {
        assertThat(answer.woven(FeedOrder.RANKED).map { it.targetId })
            .containsExactly("a", "s", "b", "c", "t").inOrder()
        assertThat(answer.woven(FeedOrder.NEWEST).map { it.targetId })
            .containsExactly("s", "c", "t", "a", "b").inOrder()
    }

    @Test
    fun `ranked and newest compose from one answer`() {
        val ranked = answer.woven(FeedOrder.RANKED)
        val newest = answer.woven(FeedOrder.NEWEST)
        assertThat(newest).containsExactlyElementsIn(ranked)
    }

    /**
     * The fixture's NEWEST indices disagree with every key the device could
     * see — score, and id — and the device follows the indices: it compares
     * nothing.
     */
    @Test
    fun `the client applies the pods permutations and never compares`() {
        val contrary = FeedRanking(
            asOfEpoch = 1,
            entries = listOf(
                entry("m", newestIndex = 2, score = 0.5),
                entry("z", newestIndex = 0, score = 0.1),
                entry("a", newestIndex = 1, score = 0.9),
            ),
            settling = emptyList(),
        )
        assertThat(contrary.ids()).containsExactly("m", "z", "a").inOrder()
        assertThat(contrary.ids(FeedFilter(order = FeedOrder.NEWEST))).containsExactly("z", "a", "m").inOrder()
    }

    @Test
    fun `a settling row wears a bare score slot`() {
        val rows = answer.woven(FeedOrder.RANKED).associateBy { it.targetId }
        assertThat(rows.getValue("s").score).isNull()
        assertThat(rows.getValue("s").settling).isTrue()
        assertThat(rows.getValue("a").score).isEqualTo(3.0)
    }

    @Test
    fun `still settling off drops settling rows and leaves the landed order`() {
        val off = FeedFilter(stillSettling = false)
        assertThat(answer.ids(off)).containsExactly("a", "b", "c").inOrder()
        assertThat(answer.ids(off.copy(order = FeedOrder.NEWEST))).containsExactly("c", "a", "b").inOrder()
    }

    @Test
    fun `the seen cut deletes the records ids and never reorders`() {
        assertThat(answer.ids(seen = setOf("b", "s"))).containsExactly("a", "c", "t").inOrder()
    }

    @Test
    fun `show seen on keeps seen rows`() {
        assertThat(answer.ids(FeedFilter(showSeen = true), seen = setOf("b", "s")))
            .containsExactly("a", "s", "b", "c", "t").inOrder()
    }

    @Test
    fun `everyone admits every row marked or not`() {
        assertThat(answer.ids(FeedFilter(people = PeopleScope.EVERYONE)))
            .containsExactly("a", "s", "b", "c", "t").inOrder()
    }

    @Test
    fun `for admits only for marks`() {
        assertThat(answer.ids(yourPeople(PeopleSign.FOR))).containsExactly("a")
    }

    @Test
    fun `against admits only against marks`() {
        assertThat(answer.ids(yourPeople(PeopleSign.AGAINST))).containsExactly("b")
    }

    @Test
    fun `either admits for against and signless marks`() {
        assertThat(answer.ids(yourPeople(PeopleSign.EITHER))).containsExactly("a", "s", "b").inOrder()
    }

    /** Null is never admitted under Your people — a person unheld, and every Tags row (PR-44). */
    @Test
    fun `your people never admits an unmarked row`() {
        val tags = FeedRanking(
            asOfEpoch = 1,
            entries = listOf(entry("topic", newestIndex = 0, kind = FeedKind.TAG), entry("p", newestIndex = 1)),
            settling = emptyList(),
        )
        PeopleSign.entries.forEach { sign -> assertThat(tags.ids(yourPeople(sign))).isEmpty() }
    }

    @Test
    fun `the sign kept for your peoples return is client state and admits all under everyone`() {
        val away = FeedFilter(people = PeopleScope.EVERYONE, peopleSign = PeopleSign.AGAINST)
        assertThat(answer.ids(away)).hasSize(5)
        assertThat(away.rankArgs).isEqualTo(FeedFilter().rankArgs)
    }

    @Test
    fun `a device cut never reorders the derived list`() {
        val full = answer.ids()
        val cut = answer.ids(FeedFilter(people = PeopleScope.YOUR_PEOPLE), seen = setOf("a"))
        assertThat(full.filter { it in cut }).containsExactlyElementsIn(cut).inOrder()
    }

    @Test
    fun `a filter change splits into fetch derive and none`() {
        val held = FeedFilter()
        assertThat(held.changeTo(held)).isEqualTo(FilterChange.NONE)
        assertThat(held.changeTo(held.copy(order = FeedOrder.NEWEST))).isEqualTo(FilterChange.DERIVE)
        assertThat(held.changeTo(held.copy(showSeen = true, stillSettling = false))).isEqualTo(FilterChange.DERIVE)
        assertThat(held.changeTo(held.copy(people = PeopleScope.YOUR_PEOPLE))).isEqualTo(FilterChange.DERIVE)
        assertThat(held.changeTo(held.copy(kinds = setOf(FeedKind.COMMENT)))).isEqualTo(FilterChange.FETCH)
        assertThat(held.changeTo(held.copy(topic = "t1"))).isEqualTo(FilterChange.FETCH)
        // Mixed: one fetch, then the derive.
        assertThat(held.changeTo(held.copy(topic = "t1", order = FeedOrder.NEWEST))).isEqualTo(FilterChange.FETCH)
    }

    /**
     * A malformed answer (the relay refuses one; this is the device's own
     * guard) degrades — a colliding settling row is dropped, a broken
     * NEWEST permutation falls back to the ranked order — and never throws.
     */
    @Test
    fun `a malformed answer degrades and never crashes`() {
        val broken = FeedRanking(
            asOfEpoch = 1,
            entries = listOf(entry("a", newestIndex = 0), entry("b", newestIndex = 0)),
            settling = listOf(settling("s", ranked = 0, newest = 9), settling("u", ranked = 0, newest = 0)),
        )
        assertThat(broken.ids()).containsExactly("s", "a", "b").inOrder()
        assertThat(broken.ids(FeedFilter(order = FeedOrder.NEWEST))).containsExactly("u", "a", "b").inOrder()
    }

    /**
     * THE PROPERTY (FP-1's commutation argument, §4.10 W-2): for random
     * answers and every combination of the people, seen and settling cuts,
     * under both orders, deleting rows from the composed list equals
     * composing over the answer with those rows deleted first — where an
     * answer is re-indexed exactly as a pod would emit it without them.
     */
    @Test
    fun `cut then compose equals compose then cut`() {
        val random = Random(20261013)
        repeat(200) {
            val (answer, ranked, newest) = randomAnswer(random)
            val seen = answer.allIds().filter { random.nextInt(4) == 0 }.toSet()
            for (filter in everyDeviceFilter()) {
                val composedThenCut = answer.derive(filter, seen)
                val kept = (ranked + newest).filter { filter.keeps(it, seen) }.map { it.targetId }.toSet()
                val keptRanked = ranked.filter { it.targetId in kept }
                val keptNewest = newest.filter { it.targetId in kept }
                val cutThenComposed = reemit(keptRanked, keptNewest).woven(filter.order)
                assertThat(composedThenCut).containsExactlyElementsIn(cutThenComposed).inOrder()
            }
        }
    }

    private fun yourPeople(sign: PeopleSign) = FeedFilter(people = PeopleScope.YOUR_PEOPLE, peopleSign = sign)

    private fun everyDeviceFilter(): List<FeedFilter> = buildList {
        for (order in FeedOrder.entries) {
            for (showSeen in listOf(true, false)) {
                for (stillSettling in listOf(true, false)) {
                    add(FeedFilter(order = order, showSeen = showSeen, stillSettling = stillSettling))
                    PeopleSign.entries.forEach { sign ->
                        add(
                            FeedFilter(
                                order = order,
                                showSeen = showSeen,
                                stillSettling = stillSettling,
                                people = PeopleScope.YOUR_PEOPLE,
                                peopleSign = sign,
                            ),
                        )
                    }
                }
            }
        }
    }

    private fun FeedRanking.allIds() = entries.map { it.targetId } + settling.map { it.targetId }

    /**
     * A random pod answer, built the way the pod builds one: a woven RANKED
     * list and a woven NEWEST list of the same rows, each its own shuffle,
     * then emitted as indices. Returns the answer and both woven lists.
     */
    private fun randomAnswer(random: Random): Triple<FeedRanking, List<FeedRow>, List<FeedRow>> {
        val marks = listOf(null, PeopleMark.FOR, PeopleMark.AGAINST, PeopleMark.SIGNLESS)
        val rows = (0 until random.nextInt(0, 12)).map { i ->
            val settled = random.nextInt(3) != 0
            FeedRow("n$i", FeedKind.POST, marks.random(random), score = if (settled) 10.0 - i else null)
        }
        val ranked = rows.shuffled(random)
        val newest = rows.shuffled(random)
        return Triple(reemit(ranked, newest), ranked, newest)
    }

    /** The answer a pod emits for these two woven lists of the same rows. */
    private fun reemit(ranked: List<FeedRow>, newest: List<FeedRow>): FeedRanking {
        val landedRanked = ranked.filterNot { it.settling }
        val landedNewest = newest.filterNot { it.settling }.map { it.targetId }
        return FeedRanking(
            asOfEpoch = 1,
            entries = landedRanked.map { row ->
                val newestIndex = landedNewest.indexOf(row.targetId)
                RankedEntry(row.targetId, row.kind, checkNotNull(row.score), row.mark, newestIndex)
            },
            settling = ranked.withIndex().filter { it.value.settling }.map { (at, row) ->
                SettlingRow(row.targetId, row.kind, row.mark, at, newest.indexOfFirst { it.targetId == row.targetId })
            },
        )
    }

    @Test
    fun `an answer of landed rows only reads in ranked order`() {
        assertThat(rankingOf("x", "y", "z").ids()).containsExactly("x", "y", "z").inOrder()
        assertThat(rankingOf("x", "y", "z").ids(FeedFilter(order = FeedOrder.NEWEST)))
            .containsExactly("z", "y", "x").inOrder()
    }
}
