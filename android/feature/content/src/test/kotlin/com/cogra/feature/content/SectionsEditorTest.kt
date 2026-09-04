package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Test

/**
 * The topics + citations surface, tested once for all four composers.
 *
 * Three of the four copies of the finder's staleness check used to be
 * unverified — two of the ViewModels carrying one have no test at all.
 * This suite drives the editor directly over a stand-in state, which is
 * what makes the debounce and the staleness rule cheap to pin.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SectionsEditorTest {

    private data class Host(
        val tagSection: TagSectionState = TagSectionState(),
        val referenceSection: ReferenceSectionState = ReferenceSectionState(),
    )

    private class Finder : ThrowingReferenceRepository() {
        /** Queries seen, in order. */
        val asked = mutableListOf<String>()

        /** Answers, keyed by query; an absent key answers nothing found. */
        val answers = mutableMapOf<String, Outcome<List<ReferenceCandidateView>>>()

        /** When set for a query, that lookup blocks until completed. */
        val gates = mutableMapOf<String, CompletableDeferred<Unit>>()

        override suspend fun referenceCandidates(
            query: String,
            limit: Int?,
        ): Outcome<List<ReferenceCandidateView>> {
            asked += query
            gates[query]?.await()
            return answers[query] ?: Outcome.Success(emptyList())
        }
    }

    private fun TestScope.editorOver(
        state: MutableStateFlow<Host>,
        finder: Finder,
    ) = SectionsEditor(
        scope = this,
        references = finder,
        state = state,
        tagsOf = { it.tagSection },
        withTags = { host, tags -> host.copy(tagSection = tags) },
        referencesOf = { it.referenceSection },
        withReferences = { host, refs -> host.copy(referenceSection = refs) },
    )

    private fun candidate(id: String) = ReferenceCandidateView(
        target = ReferenceTargetView.Profile(id = id, handle = id, displayName = id),
        targetId = id,
    )

    // -- Topics --

    @Test
    fun tagsAreStagedTunedAndRemovedThroughTheEditor() = runTest {
        val state = MutableStateFlow(Host())
        val editor = editorOver(state, Finder())

        editor.onTagInputChange("rust")
        assertThat(state.value.tagSection.input).isEqualTo("rust")

        editor.onAddTag()
        assertThat(state.value.tagSection.tags.map { it.name }).containsExactly("rust")
        assertThat(state.value.tagSection.input).isEmpty()

        editor.onTuneTag("rust")
        assertThat(state.value.tagSection.tuning).isEqualTo("rust")
        editor.onTagRelevanceChange("rust", 0.75)
        editor.onTagConfidenceChange("rust", 0.5)
        val tuned = state.value.tagSection.tags.single()
        assertThat(tuned.relevance).isEqualTo(0.75)
        assertThat(tuned.confidence).isEqualTo(0.5)

        editor.onDoneTuningTag()
        assertThat(state.value.tagSection.tuning).isNull()

        editor.onRemoveTag("rust")
        assertThat(state.value.tagSection.tags).isEmpty()
    }

    // -- The finder --

    @Test
    fun theFinderWaitsOutTheDebounceBeforeAsking() = runTest {
        val state = MutableStateFlow(Host())
        val finder = Finder()
        val editor = editorOver(state, finder)
        editor.onOpenFinder()

        editor.onFinderQueryChange("po")
        advanceTimeBy(FINDER_DEBOUNCE_MILLIS - 1)
        assertThat(finder.asked).isEmpty()

        advanceUntilIdle()
        assertThat(finder.asked).containsExactly("po")
    }

    @Test
    fun aKeystrokeDuringTheDebounceCancelsTheLookupBeforeIt() = runTest {
        val state = MutableStateFlow(Host())
        val finder = Finder()
        val editor = editorOver(state, finder)
        editor.onOpenFinder()

        editor.onFinderQueryChange("po")
        advanceTimeBy(FINDER_DEBOUNCE_MILLIS / 2)
        editor.onFinderQueryChange("post")
        advanceUntilIdle()

        // One round trip for the word, not one per letter.
        assertThat(finder.asked).containsExactly("post")
    }

    /** The rule three of the four copies carried and none of them tested. */
    @Test
    fun ananswerToAQueryTheAuthorHasTypedPastIsDropped() = runTest {
        val state = MutableStateFlow(Host())
        val finder = Finder()
        val slow = CompletableDeferred<Unit>()
        finder.gates["po"] = slow
        finder.answers["po"] = Outcome.Success(listOf(candidate("stale")))
        finder.answers["post"] = Outcome.Success(listOf(candidate("fresh")))
        val editor = editorOver(state, finder)
        editor.onOpenFinder()

        editor.onFinderQueryChange("po")
        advanceUntilIdle()
        // The author types on while the first lookup is still out.
        editor.onFinderQueryChange("post")
        advanceUntilIdle()
        slow.complete(Unit)
        advanceUntilIdle()

        val shown = state.value.referenceSection.finder
        assertThat(shown?.query).isEqualTo("post")
        assertThat(shown?.candidates?.map { it.targetId }).containsExactly("fresh")
        assertThat(shown?.searching).isFalse()
    }

    @Test
    fun aFailedLookupMarksTheFinderRatherThanEmptyingIt() = runTest {
        val state = MutableStateFlow(Host())
        val finder = Finder()
        finder.answers["post"] = Outcome.Failed(IllegalStateException("no route"))
        val editor = editorOver(state, finder)
        editor.onOpenFinder()

        editor.onFinderQueryChange("post")
        advanceUntilIdle()

        val shown = state.value.referenceSection.finder
        assertThat(shown?.failed).isTrue()
        assertThat(shown?.searching).isFalse()
        // Failing to look up is not the same as resolving nothing.
        assertThat(shown?.foundNothing).isFalse()
    }

    @Test
    fun pickingACandidateStagesItAndClosesTheFinder() = runTest {
        val state = MutableStateFlow(Host())
        val finder = Finder()
        finder.answers["post"] = Outcome.Success(listOf(candidate("p1")))
        val editor = editorOver(state, finder)
        editor.onOpenFinder()
        editor.onFinderQueryChange("post")
        advanceUntilIdle()

        val row = state.value.referenceSection.finder!!.candidates.single()
        editor.onPickReference(row)

        assertThat(state.value.referenceSection.finder).isNull()
        assertThat(state.value.referenceSection.references.map { it.targetId })
            .containsExactly("p1")
    }

    @Test
    fun referencesAreTunedAndRemovedThroughTheEditor() = runTest {
        val state = MutableStateFlow(Host())
        val editor = editorOver(state, Finder())
        editor.onPickReference(ReferenceCandidateRow("p1", candidate("p1").target))

        editor.onTuneReference("p1")
        assertThat(state.value.referenceSection.tuning).isEqualTo("p1")
        editor.onReferenceRelevanceChange("p1", 0.9)
        editor.onReferenceSupportChange("p1", -0.4)
        val tuned = state.value.referenceSection.references.single()
        assertThat(tuned.relevance).isEqualTo(0.9)
        assertThat(tuned.support).isEqualTo(-0.4)

        editor.onDoneTuningReference()
        assertThat(state.value.referenceSection.tuning).isNull()

        editor.onRemoveReference("p1")
        assertThat(state.value.referenceSection.references).isEmpty()
    }

    @Test
    fun closingTheFinderCancelsTheLookupItWasWaitingOn() = runTest {
        val state = MutableStateFlow(Host())
        val finder = Finder()
        val editor = editorOver(state, finder)
        editor.onOpenFinder()

        editor.onFinderQueryChange("post")
        editor.onCloseFinder()
        advanceUntilIdle()

        assertThat(finder.asked).isEmpty()
        assertThat(state.value.referenceSection.finder).isNull()
    }
}
