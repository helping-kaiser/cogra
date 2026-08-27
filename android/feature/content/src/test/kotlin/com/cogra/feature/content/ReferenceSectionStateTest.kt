package com.cogra.feature.content

import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.references.MAX_REFERENCES
import com.cogra.domain.references.REFERENCE_DEFAULT_RELEVANCE
import com.cogra.domain.references.REFERENCE_DEFAULT_SUPPORT
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The reference section's rules, which every authoring surface shares.
 * Named apart from the tag section's suite deliberately: the two
 * holders answer the same questions about different families.
 */
class ReferenceSectionStateTest {

    private fun profile(id: String, handle: String) =
        ReferenceTargetView.Profile(id = id, handle = handle, displayName = handle.uppercase())

    private fun post(id: String, title: String) = ReferenceTargetView.Content(
        kind = ReferenceContentKind.POST,
        id = id,
        title = title,
        snippet = "body of $title",
        authorHandle = "ada",
        authorDisplayName = "Ada",
    )

    private fun sectionWith(vararg rows: ReferenceRow) =
        ReferenceSectionState(references = rows.toList(), loaded = rows.toList())

    @Test
    fun aPickedTargetBecomesAChip() {
        val state = ReferenceSectionState().added("p1", post("p1", "On latency"))
        assertThat(state.references.map { it.targetId }).containsExactly("p1")
    }

    /** Both parameters sit on the server's own defaults until a slider moves (D3). */
    @Test
    fun aFreshReferenceCarriesTheDefaultParameters() {
        val row = ReferenceSectionState().added("p1", post("p1", "On latency")).references.single()
        assertThat(row.relevance).isEqualTo(REFERENCE_DEFAULT_RELEVANCE)
        assertThat(row.support).isEqualTo(REFERENCE_DEFAULT_SUPPORT)
    }

    /** A default citation is strictly positive on both axes, so a default mention vouches. */
    @Test
    fun theDefaultsAreStrictlyPositiveOnBothAxes() {
        val row = ReferenceSectionState().added("u1", profile("u1", "ada")).references.single()
        assertThat(row.relevance).isGreaterThan(0.0)
        assertThat(row.support).isGreaterThan(0.0)
    }

    @Test
    fun aTargetAlreadyStagedIsNotAddedTwice() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "On latency"))
            .added("p1", post("p1", "On latency"))
        assertThat(state.references).hasSize(1)
    }

    @Test
    fun theReferenceCapBlocksTheEleventhChip() {
        var state = ReferenceSectionState()
        repeat(MAX_REFERENCES) { i -> state = state.added("p$i", post("p$i", "Post $i")) }
        assertThat(state.capReached).isTrue()
        state = state.added("overflow", post("overflow", "One too many"))
        assertThat(state.references).hasSize(MAX_REFERENCES)
    }

    @Test
    fun removingAReferenceClosesItsSliders() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "On latency"))
            .tuned("p1")
            .removed("p1")
        assertThat(state.references).isEmpty()
        assertThat(state.tuning).isNull()
    }

    /** Removing one chip must not close another's sliders. */
    @Test
    fun removingAReferenceLeavesAnotherChipsSlidersOpen() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "One"))
            .added("p2", post("p2", "Two"))
            .tuned("p2")
            .removed("p1")
        assertThat(state.tuning).isEqualTo("p2")
    }

    @Test
    fun bothParametersRetuneIndependently() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "On latency"))
            .withRelevance("p1", 0.8)
            .withSupport("p1", -0.4)
        val row = state.references.single()
        assertThat(row.relevance).isEqualTo(0.8)
        assertThat(row.support).isEqualTo(-0.4)
    }

    @Test
    fun withNothingLoadedEveryReferenceIsAnAdd() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "One"))
            .added("p2", post("p2", "Two"))
        assertThat(state.adds).hasSize(2)
        assertThat(state.removes).isEmpty()
    }

    /** An edit screen opened and left alone stages nothing (F8). */
    @Test
    fun anUntouchedLoadedReferenceSectionStagesNothing() {
        val state = sectionWith(ReferenceRow("p1", post("p1", "One")))
        assertThat(state.adds).isEmpty()
        assertThat(state.removes).isEmpty()
        assertThat(state.changeCount).isEqualTo(0)
    }

    /** Re-declaring at new parameters is its own Reference act, not a no-op. */
    @Test
    fun reTuningALoadedReferenceCountsAsAnAdd() {
        val state = sectionWith(ReferenceRow("p1", post("p1", "One"))).withRelevance("p1", 0.9)
        assertThat(state.adds.map { it.targetId }).containsExactly("p1")
        assertThat(state.removes).isEmpty()
    }

    @Test
    fun droppingALoadedReferenceBecomesAWithdrawal() {
        val state = sectionWith(ReferenceRow("p1", post("p1", "One"))).removed("p1")
        assertThat(state.removes.map { it.targetId }).containsExactly("p1")
        assertThat(state.adds).isEmpty()
    }

    /** A withdrawal keeps its typed target, so the confirm can name what it drops. */
    @Test
    fun aWithdrawalRemembersWhatItIsDropping() {
        val state = sectionWith(ReferenceRow("u1", profile("u1", "ada"))).removed("u1")
        assertThat(state.removes.single().target).isEqualTo(profile("u1", "ada"))
    }

    /** A citation whose far end the display store never typed is still withdrawable. */
    @Test
    fun anUnresolvedLoadedReferenceCanStillBeDropped() {
        val state = sectionWith(ReferenceRow("unknown-id", target = null)).removed("unknown-id")
        assertThat(state.removes.map { it.targetId }).containsExactly("unknown-id")
    }

    @Test
    fun aReferenceRefusalLandsOnTheChipItNames() {
        val state = ReferenceSectionState().added("p1", post("p1", "One"))
        val (next, unplaced) = state.withError("p1", "cannot cite itself")
        assertThat(next.references.single().error).isEqualTo("cannot cite itself")
        assertThat(unplaced).isNull()
    }

    @Test
    fun aReferenceRefusalForATargetWithNoChipComesBackUnplaced() {
        val (next, unplaced) = ReferenceSectionState().withError("gone", "no such node")
        assertThat(next.references).isEmpty()
        assertThat(unplaced).isEqualTo("no such node")
    }

    @Test
    fun anIndexedReferenceRefusalLandsOnThatChip() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "One"))
            .added("p2", post("p2", "Two"))
        val (next, unplaced) = state.withErrorAt(1, "unreachable target")
        assertThat(next.references[0].error).isNull()
        assertThat(next.references[1].error).isEqualTo("unreachable target")
        assertThat(unplaced).isNull()
    }

    @Test
    fun aReferenceIndexPastTheChipsComesBackUnplaced() {
        val state = ReferenceSectionState().added("p1", post("p1", "One"))
        val (_, unplaced) = state.withErrorAt(4, "unreachable target")
        assertThat(unplaced).isEqualTo("unreachable target")
    }

    @Test
    fun aFreshReferenceStagingPassClearsStaleRefusals() {
        val state = ReferenceSectionState()
            .added("p1", post("p1", "One"))
            .withError("p1", "cannot cite itself").first
        assertThat(state.withoutErrors().references.single().error).isNull()
    }

    /** The server names the offending chip by its path into the input list. */
    @Test
    fun theServerFieldPathNamesTheReferenceChip() {
        assertThat(referenceFieldIndex(listOf("references", "2", "target"))).isEqualTo(2)
        assertThat(referenceFieldIndex(listOf("tags", "2", "name"))).isNull()
        assertThat(referenceFieldIndex(listOf("content"))).isNull()
        assertThat(referenceFieldIndex(null)).isNull()
    }

    // -- The finder (D20) --

    @Test
    fun theFinderOpensAndClosesOnTheSection() {
        val state = ReferenceSectionState().withFinder(ReferenceFinderState())
        assertThat(state.finder).isNotNull()
        assertThat(state.withFinder(null).finder).isNull()
    }

    /** Resolving nothing is the normal case mid-typing, never an error. */
    @Test
    fun aFinderQueryThatResolvedNothingReportsFoundNothing() {
        val finder = ReferenceFinderState(query = "ad", candidates = emptyList())
        assertThat(finder.foundNothing).isTrue()
        assertThat(finder.failed).isFalse()
    }

    @Test
    fun anEmptyFinderQueryIsNotAMiss() {
        assertThat(ReferenceFinderState(query = "").foundNothing).isFalse()
    }

    @Test
    fun aFinderStillSearchingIsNotAMiss() {
        assertThat(ReferenceFinderState(query = "ada", searching = true).foundNothing).isFalse()
    }

    /** A failed lookup is distinct from resolving nothing — the copy differs. */
    @Test
    fun aFailedFinderLookupIsNotAMiss() {
        assertThat(ReferenceFinderState(query = "ada", failed = true).foundNothing).isFalse()
    }
}
