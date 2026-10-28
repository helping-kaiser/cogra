// The One topic chips (FeedTopic.md: "ALWAYS only a topic the reader holds an
// opinion for, with a netted Affinity that is not (0, 0) and associates
// positively, can be on"; "ALWAYS a topic the reader holds against never
// stands as the filter's topic").

package com.cogra.domain.feed

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class FeedTopicsTest {

    private val maps = FeedTopic("t1", "saltmaps")
    private val rust = FeedTopic("t2", "rust")

    @Test
    fun `only topics held for are chips, in the read's order`() {
        val (topics, more) = heldForOf(
            listOf(HeldEdge(maps, 0.6), HeldEdge(rust, 0.1), HeldEdge(FeedTopic("t3", "spam"), -0.4)),
        )
        assertThat(topics).containsExactly(maps, rust).inOrder()
        assertThat(more).isFalse()
    }

    @Test
    fun `a topic held signless, associating nowhere, never narrows a feed`() {
        assertThat(heldForOf(listOf(HeldEdge(maps, 0.0))).first).isEmpty()
    }

    @Test
    fun `the read pages on only while the last edge is still held for`() {
        assertThat(heldForOf(listOf(HeldEdge(maps, 0.6), HeldEdge(rust, 0.2))).second).isTrue()
        assertThat(heldForOf(emptyList()).second).isFalse()
    }

    @Test
    fun `an edge whose name does not read is never a chip`() {
        assertThat(heldForOf(listOf(HeldEdge(null, 0.6), HeldEdge(rust, 0.2))).first).containsExactly(rust)
    }
}
