package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.search.SearchHit
import com.cogra.domain.search.SearchNode
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.SearchPage
import com.cogra.domain.testing.ScriptedSearchRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException

/**
 * The two pickers' plumbing, driven over a stand-in host (TagPicker.md,
 * TagPickerTyping.md, ReferencePicker.md): what a pick stages, what each read
 * asks, and that an answer stands only for what it was asked.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PickerEditorsTest {

    private data class Host(
        val tagSection: TagSectionState = TagSectionState(),
        val referenceSection: ReferenceSectionState = ReferenceSectionState(),
    )

    private val search = ScriptedSearchRepository()

    private fun tagsPage(vararg names: String) = Outcome.Success(
        SearchPage(
            hits = names.map { SearchHit(SearchNode.Tag(id = it, name = it), score = null) },
            endCursor = null,
            hasNextPage = false,
            hasMorePeople = false,
        ),
    )

    private class Candidates : ThrowingReferenceRepository() {
        val asked = mutableListOf<Pair<String, Set<FeedKind>>>()
        var answer: Outcome<List<ReferenceCandidateView>> = Outcome.Success(emptyList())

        override suspend fun referenceCandidates(
            query: String,
            limit: Int?,
            kinds: Set<FeedKind>,
        ): Outcome<List<ReferenceCandidateView>> {
            asked += query to kinds
            return answer
        }
    }

    private fun TestScope.tagPicker(state: MutableStateFlow<Host>) = TagPickerEditor(
        scope = this,
        search = search,
        state = state,
        tagsOf = { it.tagSection },
        withTags = { host, tags -> host.copy(tagSection = tags) },
    )

    private fun TestScope.referencePicker(state: MutableStateFlow<Host>, candidates: Candidates) =
        ReferencePickerEditor(
            scope = this,
            references = candidates,
            state = state,
            referencesOf = { it.referenceSection },
            withReferences = { host, refs -> host.copy(referenceSection = refs) },
        )

    private fun person(id: String) = ReferenceCandidateView(ReferenceTargetView.Profile(id, id, null), id)

    // -- The tag picker --

    /** The index rides the one search read: `#prefix` over the topic kind alone. */
    @Test
    fun theIndexAsksTheSearchWithTheHashCueOverTopicsOnce() = runTest {
        val state = MutableStateFlow(Host())
        val picker = tagPicker(state)
        search.respond = { _, _ -> tagsPage("salt", "saltmaps", "saltcrust") }

        picker.onOpenTagPicker()
        picker.onTagPickerQueryChange("#Sal")
        picker.onTagPickerQueryChange("#Salt")
        advanceUntilIdle()

        val read = search.reads.single()
        assertThat(read.ask.query).isEqualTo("#salt")
        assertThat(read.ask.kinds).containsExactly(FeedKind.TAG)
        assertThat(read.ask.order).isEqualTo(SearchOrder.NEWEST)
        // TagPickerTyping.md: a name in use that is the typed name is the first row alone.
        val open = state.value.tagSection.picker!!
        assertThat(open.firstRow(emptyList())).isEqualTo("salt")
        assertThat(open.indexed(emptyList())).containsExactly("saltmaps", "saltcrust").inOrder()
    }

    /** An answer stands only for the name it answered: one typed past is never read. */
    @Test
    fun anAnswerForANameTypedPastIsNeverRead() = runTest {
        val state = MutableStateFlow(Host())
        val picker = tagPicker(state)
        search.respond = { _, _ -> tagsPage("saltmaps") }
        picker.onOpenTagPicker()
        picker.onTagPickerQueryChange("salt")
        advanceUntilIdle()

        state.value = state.value.copy(
            tagSection = state.value.tagSection.withPicker(state.value.tagSection.picker!!.copy(query = "sea")),
        )
        assertThat(state.value.tagSection.picker!!.indexed(emptyList())).isEmpty()
    }

    /** TagPicker.md: no answer -> the fault; Retry reads again for the typed name. */
    @Test
    fun aReadWithNoAnswerFaultsAndRetryReadsAgain() = runTest {
        val state = MutableStateFlow(Host())
        val picker = tagPicker(state)
        search.respond = { _, _ -> Outcome.Failed(IOException("down")) }
        picker.onOpenTagPicker()
        picker.onTagPickerQueryChange("salt")
        advanceUntilIdle()
        assertThat(state.value.tagSection.picker!!.faulted).isTrue()
        // The typed name's row still stands first.
        assertThat(state.value.tagSection.picker!!.firstRow(emptyList())).isEqualTo("salt")

        search.respond = { _, _ -> tagsPage("saltmaps") }
        picker.onRetryTagIndex()
        advanceUntilIdle()
        assertThat(search.reads.map { it.ask.query }).containsExactly("#salt", "#salt").inOrder()
        assertThat(state.value.tagSection.picker!!.faulted).isFalse()
        assertThat(state.value.tagSection.picker!!.indexed(emptyList())).containsExactly("saltmaps")
    }

    /** TagPickerRefused.md: a refused name asks nothing and offers nothing. */
    @Test
    fun aRefusedNameAsksNothing() = runTest {
        val state = MutableStateFlow(Host())
        val picker = tagPicker(state)
        picker.onOpenTagPicker()
        picker.onTagPickerQueryChange("#salt maps")
        advanceUntilIdle()
        assertThat(search.reads).isEmpty()
        assertThat(state.value.tagSection.picker!!.firstRow(emptyList())).isNull()
    }

    /** A pick stages at once and the picker stays open; the × un-stages; Done keeps every stage. */
    @Test
    fun aPickStagesAndThePickerStaysOpenUntilTheLeaveKeepsEveryStage() = runTest {
        val state = MutableStateFlow(Host())
        val picker = tagPicker(state)
        picker.onOpenTagPicker()
        picker.onStageTag("saltmarsh")
        picker.onStageTag("saltflats")
        picker.onStageTag("saltflats")
        assertThat(state.value.tagSection.tags.map { it.name }).containsExactly("saltmarsh", "saltflats").inOrder()
        assertThat(state.value.tagSection.picker).isNotNull()

        picker.onUnstageTag("saltmarsh")
        picker.onCloseTagPicker()
        assertThat(state.value.tagSection.picker).isNull()
        assertThat(state.value.tagSection.tags.map { it.name }).containsExactly("saltflats")
    }

    /** TagPicker.md: at ten tags NEVER a tag is staged. */
    @Test
    fun atTenTagsNothingStages() = runTest {
        val ten = (1..10).map { TagRow("t$it") }
        val state = MutableStateFlow(Host(TagSectionState(tags = ten)))
        val picker = tagPicker(state)
        picker.onOpenTagPicker()
        picker.onStageTag("eleven")
        assertThat(state.value.tagSection.tags).hasSize(10)
    }

    /** TagPicker.md: a row whose name the edit withdrew unstages the withdrawal — never a second record. */
    @Test
    fun pickingAWithdrawnNameRestoresItAsItStood() = runTest {
        val loaded = TagRow("fieldnotes", relevance = 0.6, confidence = 0.4)
        val state = MutableStateFlow(Host(TagSectionState(tags = emptyList(), loaded = listOf(loaded))))
        val picker = tagPicker(state)
        assertThat(state.value.tagSection.changeCount).isEqualTo(1)

        picker.onOpenTagPicker()
        picker.onStageTag("fieldnotes")

        assertThat(state.value.tagSection.tags).containsExactly(loaded)
        assertThat(state.value.tagSection.changeCount).isEqualTo(0)
    }

    // -- The citation picker --

    /** ReferencePicker.md: the results read for the query, with no narrowing at the filter's default. */
    @Test
    fun theResultsReadForTheQueryAndDropStagedTargets() = runTest {
        val state = MutableStateFlow(Host())
        val candidates = Candidates().apply { answer = Outcome.Success(listOf(person("u1"), person("u2"))) }
        val picker = referencePicker(state, candidates)

        picker.onOpenReferencePicker()
        picker.onReferencePickerQueryChange("sal")
        advanceUntilIdle()
        assertThat(candidates.asked).containsExactly("sal" to emptySet<FeedKind>())

        val row = state.value.referenceSection.picker!!.results(emptyList()).first()
        picker.onStageReference(row)
        assertThat(state.value.referenceSection.references.map { it.targetId }).containsExactly("u1")
        // ALWAYS a staged citation stands only in the staged section above the results.
        assertThat(state.value.referenceSection.picker!!.results(listOf("u1")).map { it.targetId })
            .containsExactly("u2")
    }

    /** ReferencePicker.md: the sheet's Done re-queries ONCE with the staged kinds; an unchanged filter asks nothing. */
    @Test
    fun committedKindsReQueryOnceAndAnUnchangedFilterAsksNothing() = runTest {
        val state = MutableStateFlow(Host())
        val candidates = Candidates()
        val picker = referencePicker(state, candidates)
        picker.onOpenReferencePicker()
        picker.onReferencePickerQueryChange("sal")
        advanceUntilIdle()

        picker.onReferenceKindsChange(setOf(FeedKind.POST))
        advanceUntilIdle()
        picker.onReferenceKindsChange(setOf(FeedKind.POST))
        advanceUntilIdle()

        assertThat(candidates.asked).containsExactly(
            "sal" to emptySet<FeedKind>(),
            "sal" to setOf(FeedKind.POST),
        ).inOrder()
    }

    /** ReferencePicker.md: no answer and nothing loaded -> the fault; Retry and a changed query read again. */
    @Test
    fun aReadWithNoAnswerFaultsAndRetryOrANewQueryReadsAgain() = runTest {
        val state = MutableStateFlow(Host())
        val candidates = Candidates().apply { answer = Outcome.Failed(IOException("down")) }
        val picker = referencePicker(state, candidates)
        picker.onOpenReferencePicker()
        picker.onReferencePickerQueryChange("sal")
        advanceUntilIdle()
        assertThat(state.value.referenceSection.picker!!.faulted).isTrue()

        picker.onRetryCandidates()
        advanceUntilIdle()
        picker.onReferencePickerQueryChange("salt")
        advanceUntilIdle()
        assertThat(candidates.asked.map { it.first }).containsExactly("sal", "sal", "salt").inOrder()
    }

    /** A `#` query is a topic, which a citation never names: nothing is asked. */
    @Test
    fun aHashQueryAsksNothing() = runTest {
        val state = MutableStateFlow(Host())
        val candidates = Candidates()
        val picker = referencePicker(state, candidates)
        picker.onOpenReferencePicker()
        picker.onReferencePickerQueryChange("#salt")
        picker.onReferencePickerQueryChange("@")
        advanceUntilIdle()
        assertThat(candidates.asked).isEmpty()
    }

    /** ReferencePicker.md: at ten citations no result stages; a withdrawn target comes back as it stood. */
    @Test
    fun theCapHoldsAndAWithdrawnTargetComesBackAsItStood() = runTest {
        val ten = (1..10).map { ReferenceRow("r$it", null) }
        val state = MutableStateFlow(Host(referenceSection = ReferenceSectionState(references = ten)))
        val candidates = Candidates()
        val picker = referencePicker(state, candidates)
        picker.onOpenReferencePicker()
        picker.onStageReference(ReferenceCandidateRow("u1", ReferenceTargetView.Profile("u1", "u1", null)))
        assertThat(state.value.referenceSection.references).hasSize(10)

        val standing = ReferenceRow("u1", null, relevance = 0.5, support = 0.2, withdrawalCost = 2)
        state.value = Host(referenceSection = ReferenceSectionState(loaded = listOf(standing)))
        picker.onStageReference(ReferenceCandidateRow("u1", ReferenceTargetView.Profile("u1", "u1", null)))
        assertThat(state.value.referenceSection.references).containsExactly(standing)
        assertThat(state.value.referenceSection.changeCount).isEqualTo(0)
    }
}
