package com.cogra.feature.content

import com.cogra.domain.ReferenceClaimView
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

    // -- Which claims an authoring section may carry --

    /**
     * A claim's own `targetId` is the raw L1 identifier and addresses
     * no mutation; the row must carry the L2 id, which only the typed
     * target holds.
     */
    @Test
    fun anEditableRowCarriesTheL2IdRatherThanTheClaimsL1Identifier() {
        val claim = ReferenceClaimView(
            target = profile("u1", "ada"),
            targetId = "l1-identifier-not-a-uuid",
            relevance = 0.4,
            support = 0.6,
            withdrawalCost = 2,
            pending = false,
        )
        val row = claim.editableRow()!!
        assertThat(row.targetId).isEqualTo("u1")
        assertThat(row.relevance).isEqualTo(0.4)
        assertThat(row.support).isEqualTo(0.6)
    }

    /**
     * The served cost rides onto the row, because the clipped pair
     * beside it cannot imply it: a claim folded to `1.0` may cost one
     * counter-record to withdraw or five (B4).
     */
    @Test
    fun anEditableRowCarriesTheServedWithdrawalCost() {
        val claim = ReferenceClaimView(
            target = profile("u1", "ada"),
            targetId = "l1-a",
            relevance = 1.0,
            support = 1.0,
            withdrawalCost = 4,
            pending = false,
        )
        assertThat(claim.editableRow()!!.withdrawalCost).isEqualTo(4)
    }

    /**
     * A removal costs its whole batch, so the section's own count is
     * the sum of what the claims quoted — never one per gesture.
     */
    @Test
    fun aRemovalCostsTheServedBatchRatherThanOneAct() {
        val heavy = ReferenceRow("u1", profile("u1", "ada"), withdrawalCost = 3)
        val light = ReferenceRow("u2", profile("u2", "bob"), withdrawalCost = 1)
        val state = ReferenceSectionState(references = emptyList(), loaded = listOf(heavy, light))
        assertThat(state.removes).hasSize(2)
        assertThat(state.withdrawalActs).isEqualTo(4)
        assertThat(state.changeCount).isEqualTo(4)
    }

    /** A chip staged in this session nets in one record if ever removed. */
    @Test
    fun aFreshChipQuotesASingleActWithdrawal() {
        val state = ReferenceSectionState().added("p1", post("p1", "One"))
        assertThat(state.references.single().withdrawalCost).isEqualTo(1)
    }

    /**
     * An untypeable claim is unaddressable — no withdrawal could name
     * it — so it never reaches an authoring section at all, and its
     * absence there is never read as a removal.
     */
    @Test
    fun anUntypeableClaimIsNotEditableAtAll() {
        val claim = ReferenceClaimView(
            target = null,
            targetId = "l1-identifier-only",
            relevance = 0.1,
            support = 0.1,
            withdrawalCost = 1,
            pending = false,
        )
        assertThat(claim.editableRow()).isNull()
    }

    /** Left out of both baseline and draft, it stages nothing either way. */
    @Test
    fun aSectionBuiltWithoutUntypeableClaimsStagesNoWithdrawalForThem() {
        val claims = listOf(
            ReferenceClaimView(profile("u1", "ada"), "l1-a", 0.1, 0.1, 1, pending = false),
            ReferenceClaimView(null, "l1-b", 0.1, 0.1, 1, pending = false),
        )
        val rows = claims.mapNotNull { it.editableRow() }
        val state = ReferenceSectionState(references = rows, loaded = rows)
        assertThat(state.references.map { it.targetId }).containsExactly("u1")
        assertThat(state.removes).isEmpty()
        assertThat(state.changeCount).isEqualTo(0)
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
