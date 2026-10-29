// The One topic chips (FeedTopic.md: "ALWAYS only a topic the reader holds an
// opinion for, with a netted Affinity that is not (0, 0) and associates
// positively, can be on"; "ALWAYS a topic the reader holds against never
// stands as the filter's topic"), read through Your topics' own held set.

package com.cogra.domain.feed

import com.cogra.domain.Outcome
import com.cogra.domain.topics.HeldTopic
import com.cogra.domain.topics.HeldTopicsPage
import com.cogra.domain.topics.HeldTopicsRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test

class FeedTopicsTest {

    private fun held(name: String, pDirected: Double) = HeldTopic(name, pDirected, 0.1, pending = false, id = "h-$name")

    @Test
    fun `only topics held for are chips, in the read's order`() {
        val (topics, more) = heldForOf(listOf(held("saltmaps", 0.6), held("rust", 0.1), held("spam", -0.4)))
        assertThat(topics).containsExactly(FeedTopic("h-saltmaps", "saltmaps"), FeedTopic("h-rust", "rust")).inOrder()
        assertThat(more).isFalse()
    }

    @Test
    fun `a topic held signless, associating nowhere, never narrows a feed`() {
        assertThat(heldForOf(listOf(held("saltmaps", 0.0))).first).isEmpty()
    }

    @Test
    fun `the read pages on only while the last topic is still held for`() = runTest {
        val pages = object : HeldTopicsRepository {
            val asked = mutableListOf<String?>()

            override suspend fun heldCount(): Outcome<Int?> = Outcome.Success(3)

            override suspend fun heldPage(after: String?): Outcome<HeldTopicsPage?> {
                asked += after
                return Outcome.Success(
                    when (after) {
                        null -> HeldTopicsPage(listOf(held("a", 0.9), held("b", 0.5)), "k1", hasNextPage = true)
                        else -> HeldTopicsPage(listOf(held("c", 0.2), held("d", -0.1)), "k2", hasNextPage = true)
                    },
                )
            }
        }
        val topics = (pages.heldFor() as Outcome.Success).value
        assertThat(topics.map { it.name }).containsExactly("a", "b", "c").inOrder()
        assertThat(pages.asked).containsExactly(null, "k1").inOrder()
    }

    @Test
    fun `no signed-in reader holds nothing`() = runTest {
        val none = object : HeldTopicsRepository {
            override suspend fun heldCount(): Outcome<Int?> = Outcome.Success(null)

            override suspend fun heldPage(after: String?): Outcome<HeldTopicsPage?> = Outcome.Success(null)
        }
        assertThat(none.heldFor()).isEqualTo(Outcome.Success(emptyList<FeedTopic>()))
    }
}
