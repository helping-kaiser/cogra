package com.cogra.feature.content

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class PagingTest {

    private data class Entry(val id: String, val marker: String = "held")

    @Test
    fun anEmptyHeldListTakesThePageWhole() {
        val appended = emptyList<Entry>().appendPage(listOf(Entry("a"), Entry("b"))) { it.id }
        assertThat(appended.map { it.id }).containsExactly("a", "b").inOrder()
    }

    @Test
    fun aFreshPageAppendsInOrder() {
        val held = listOf(Entry("a"), Entry("b"))
        val appended = held.appendPage(listOf(Entry("c"))) { it.id }
        assertThat(appended.map { it.id }).containsExactly("a", "b", "c").inOrder()
    }

    @Test
    fun anEntryThatLandedMidWalkIsNotServedTwice() {
        // The first page showed "a" while it was pending; it landed
        // before the second page was asked for, so the walk resumes
        // below its new position and offers it again.
        val held = listOf(Entry("a"), Entry("b"))
        val appended = held.appendPage(listOf(Entry("a", "refetched"), Entry("c"))) { it.id }
        assertThat(appended.map { it.id }).containsExactly("a", "b", "c").inOrder()
    }

    @Test
    fun theHeldCopyWinsOverTheRepeat() {
        // A page is a snapshot: the client neither merges nor reconciles
        // a held page against a newer one — the new state arrives with a
        // refetch, not by rewriting what is already on screen.
        val held = listOf(Entry("a"))
        val appended = held.appendPage(listOf(Entry("a", "refetched"))) { it.id }
        assertThat(appended.single().marker).isEqualTo("held")
    }

    @Test
    fun aPageOfNothingButRepeatsAddsNothing() {
        val held = listOf(Entry("a"), Entry("b"))
        val appended = held.appendPage(listOf(Entry("b"), Entry("a"))) { it.id }
        assertThat(appended.map { it.id }).containsExactly("a", "b").inOrder()
    }

    @Test
    fun anEmptyPageLeavesTheHeldListAlone() {
        val held = listOf(Entry("a"))
        assertThat(held.appendPage(emptyList()) { it.id }).isEqualTo(held)
    }
}
