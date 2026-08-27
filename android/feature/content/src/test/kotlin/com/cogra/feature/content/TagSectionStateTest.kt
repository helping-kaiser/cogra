package com.cogra.feature.content

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The rules every tag section obeys, wherever it sits — the composer,
 * the post edit screen, the comment box, the reply box, the inline
 * comment editor. Pure state, so it tests as plain Kotlin.
 */
class TagSectionStateTest {

    @Test
    fun addingCanonicalizesTheEntryAndClearsTheField() {
        val section = TagSectionState(input = " #Rust ").added()
        assertThat(section.tags.map { it.name }).containsExactly("rust")
        assertThat(section.input).isEmpty()
    }

    /** The defaults are the server's own (D13), so an untouched chip says what omitting it would. */
    @Test
    fun aFreshChipCarriesTheDefaultParameters() {
        val row = TagSectionState(input = "rust").added().tags.single()
        assertThat(row.relevance).isEqualTo(0.1)
        assertThat(row.confidence).isEqualTo(1.0)
    }

    @Test
    fun anIllegalNameNeverBecomesAChip() {
        assertThat(TagSectionState(input = "two words").added().tags).isEmpty()
        assertThat(TagSectionState(input = "café").added().tags).isEmpty()
        assertThat(TagSectionState(input = "   ").added().tags).isEmpty()
    }

    /** An illegal entry stays in the field so the reader can fix it. */
    @Test
    fun aRefusedAddLeavesTheEntryInPlace() {
        assertThat(TagSectionState(input = "café").added().input).isEqualTo("café")
    }

    @Test
    fun aNameAlreadyStagedJustClearsTheField() {
        val section = TagSectionState(input = "rust").added().withInput("RUST").added()
        assertThat(section.tags.map { it.name }).containsExactly("rust")
        assertThat(section.input).isEmpty()
    }

    @Test
    fun theBatchCapBlocksTheEleventhChip() {
        var section = TagSectionState()
        repeat(11) { section = section.withInput("tag$it").added() }
        assertThat(section.tags).hasSize(MAX_TAGS)
        assertThat(section.capReached).isTrue()
        assertThat(section.input).isEqualTo("tag10")
    }

    @Test
    fun removingAChipClosesItsSliders() {
        val section = TagSectionState(tags = listOf(TagRow("rust")), tuning = "rust").removed("rust")
        assertThat(section.tags).isEmpty()
        assertThat(section.tuning).isNull()
    }

    // -- What a submit stages against content that already exists --

    /** Nothing loaded means everything staged is new. */
    @Test
    fun withNothingLoadedEveryChipIsAnAdd() {
        val section = TagSectionState(tags = listOf(TagRow("rust"), TagRow("kotlin")))
        assertThat(section.adds.map { it.name }).containsExactly("rust", "kotlin")
        assertThat(section.removes).isEmpty()
        assertThat(section.changeCount).isEqualTo(2)
    }

    @Test
    fun anUntouchedLoadedSectionStagesNothing() {
        val loaded = listOf(TagRow("rust"), TagRow("kotlin"))
        val section = TagSectionState(tags = loaded, loaded = loaded)
        assertThat(section.adds).isEmpty()
        assertThat(section.removes).isEmpty()
        assertThat(section.changeCount).isEqualTo(0)
    }

    /** Re-declaring a tag at a new relevance is its own Tag act, not a no-op. */
    @Test
    fun reTuningALoadedTagCountsAsAnAdd() {
        val loaded = listOf(TagRow("rust"))
        val section = TagSectionState(tags = loaded, loaded = loaded).withRelevance("rust", 0.8)
        assertThat(section.adds.map { it.name }).containsExactly("rust")
        assertThat(section.removes).isEmpty()
        assertThat(section.changeCount).isEqualTo(1)
    }

    @Test
    fun droppingALoadedTagBecomesARemove() {
        val loaded = listOf(TagRow("rust"), TagRow("kotlin"))
        val section = TagSectionState(tags = loaded, loaded = loaded).removed("kotlin")
        assertThat(section.adds).isEmpty()
        assertThat(section.removes).containsExactly("kotlin")
        assertThat(section.changeCount).isEqualTo(1)
    }

    // -- Where a refusal lands (F2) --

    @Test
    fun aRefusalLandsOnTheChipItNames() {
        val section = TagSectionState(tags = listOf(TagRow("rust"), TagRow("kotlin")))
        val (next, unplaced) = section.withError("kotlin", "no")
        assertThat(unplaced).isNull()
        assertThat(next.tags[1].error).isEqualTo("no")
        assertThat(next.tags[0].error).isNull()
    }

    /** A withdrawal has no chip left, so its message needs somewhere else to go. */
    @Test
    fun aRefusalForANameWithNoChipComesBackUnplaced() {
        val (next, unplaced) = TagSectionState(tags = listOf(TagRow("rust"))).withError("gone", "no")
        assertThat(unplaced).isEqualTo("no")
        assertThat(next.tags.single().error).isNull()
    }

    @Test
    fun anIndexedRefusalLandsOnThatChip() {
        val section = TagSectionState(tags = listOf(TagRow("rust"), TagRow("kotlin")))
        val (next, unplaced) = section.withErrorAt(1, "no")
        assertThat(unplaced).isNull()
        assertThat(next.tags[1].error).isEqualTo("no")
    }

    @Test
    fun anIndexPastTheChipsComesBackUnplaced() {
        val (_, unplaced) = TagSectionState(tags = listOf(TagRow("rust"))).withErrorAt(7, "no")
        assertThat(unplaced).isEqualTo("no")
    }

    @Test
    fun aFreshStagingPassClearsStaleRefusals() {
        val section = TagSectionState(tags = listOf(TagRow("rust", error = "no"))).withoutErrors()
        assertThat(section.tags.single().error).isNull()
    }

    @Test
    fun theServerFieldPathNamesTheChip() {
        assertThat(tagFieldIndex(listOf("tags", "2", "name"))).isEqualTo(2)
        assertThat(tagFieldIndex(listOf("content"))).isNull()
        assertThat(tagFieldIndex(null)).isNull()
        assertThat(tagFieldIndex(listOf("tags", "x", "name"))).isNull()
    }
}
