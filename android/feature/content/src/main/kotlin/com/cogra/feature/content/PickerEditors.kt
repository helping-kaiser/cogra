// The two pickers' plumbing, owned once — what `+ Add a tag` and `+ Cite
// something` open on the compose details stage, the post edit and the
// comment edit (TagPicker, ReferencePicker; behavior/*.md). A host supplies
// its own state flow and the lens over its section, exactly as it does for
// [SectionsEditor], so three unrelated state types share one picker each.
//
// A PICK STAGES AND THE PICKER STAYS OPEN (jakob 2026-10-01): a stage or an
// un-stage is applied to the host's section the moment it is made, so the
// staged section IS the composer's tags or citations; Done and the header
// back are one leave that keeps them all.
//
// EACH READ IS TAGGED WITH WHAT IT ASKED (`TagIndexAnswer`, `CandidateAnswer`):
// an answer that arrives after the reader typed on is never read as the rows
// for what is typed now, and a keystroke cancels the read before it.

package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.map
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.search.SearchAsk
import com.cogra.domain.search.SearchNode
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.SearchRepository
import com.cogra.domain.valueOrNull
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Every gesture the tag picker makes (TagPicker.md, TagPickerTyping.md, TagPickerRefused.md). */
interface TagPickerHandlers {
    fun onOpenTagPicker()

    /** Done and the header back: every staged tag kept, the typed name never staged. */
    fun onCloseTagPicker()

    fun onTagPickerQueryChange(query: String)

    /** `tagPicker.fault.retry`: the candidates are read again for the typed name. */
    fun onRetryTagIndex()

    /** A row's tap, or the action key on the typed name. */
    fun onStageTag(name: String)

    /** A staged row's ×. */
    fun onUnstageTag(name: String)
}

/** Every gesture the citation picker makes (ReferencePicker.md). */
interface ReferencePickerHandlers {
    fun onOpenReferencePicker()

    /** Done and the header back: every staged citation kept. */
    fun onCloseReferencePicker()

    fun onReferencePickerQueryChange(query: String)

    /** The filter sheet's Done: the results re-query once with the staged kinds. */
    fun onReferenceKindsChange(kinds: Set<FeedKind>)

    /** `referencePicker.fault.retry`: the results are read again for the query. */
    fun onRetryCandidates()

    fun onStageReference(row: ReferenceCandidateRow)

    fun onUnstageReference(targetId: String)
}

/** The tag picker over a host's [TagSectionState]. */
internal class TagPickerEditor<S>(
    private val scope: CoroutineScope,
    /** The one search read the index rides; null where no index is reachable (the first row alone picks). */
    private val search: SearchRepository?,
    private val state: MutableStateFlow<S>,
    private val tagsOf: (S) -> TagSectionState,
    private val withTags: (S, TagSectionState) -> S,
) : TagPickerHandlers {

    private var indexJob: Job? = null

    override fun onOpenTagPicker() = update { it.withPicker(TagPickerState()) }

    override fun onCloseTagPicker() {
        indexJob?.cancel()
        update { it.withPicker(null) }
    }

    /** The first row follows the name as it is typed; the index is asked once the typing settles. */
    override fun onTagPickerQueryChange(query: String) {
        indexJob?.cancel()
        update { section -> section.withPicker((section.picker ?: TagPickerState()).copy(query = query)) }
        read(debounce = true)
    }

    override fun onRetryTagIndex() {
        indexJob?.cancel()
        read(debounce = false)
    }

    override fun onStageTag(name: String) = update { it.staged(name) }

    override fun onUnstageTag(name: String) = update { it.removed(name) }

    private fun read(debounce: Boolean) {
        val name = tagsOf(state.value).picker?.canonical ?: return
        val index = search ?: return
        indexJob = scope.launch {
            if (debounce) delay(FINDER_DEBOUNCE_MILLIS)
            val answer = when (val outcome = index.tagNames(name)) {
                is Outcome.Success -> TagIndexAnswer(name, outcome.value)
                is Outcome.Refused, is Outcome.Failed -> TagIndexAnswer(name, failed = true)
            }
            update { section -> section.picker?.let { section.withPicker(it.copy(index = answer)) } ?: section }
        }
    }

    private fun update(block: (TagSectionState) -> TagSectionState) =
        state.update { withTags(it, block(tagsOf(it))) }
}

/** The citation picker over a host's [ReferenceSectionState]. */
internal class ReferencePickerEditor<S>(
    private val scope: CoroutineScope,
    private val references: ReferenceRepository,
    private val state: MutableStateFlow<S>,
    private val referencesOf: (S) -> ReferenceSectionState,
    private val withReferences: (S, ReferenceSectionState) -> S,
) : ReferencePickerHandlers {

    private var candidatesJob: Job? = null

    override fun onOpenReferencePicker() = update { it.withPicker(ReferencePickerState()) }

    override fun onCloseReferencePicker() {
        candidatesJob?.cancel()
        update { it.withPicker(null) }
    }

    /** ReferencePicker.md: "WHEN the query changes GIVEN referencePicker.fault stands -> the results read again". */
    override fun onReferencePickerQueryChange(query: String) {
        candidatesJob?.cancel()
        update { section -> section.withPicker((section.picker ?: ReferencePickerState()).copy(query = query)) }
        read(debounce = true)
    }

    override fun onReferenceKindsChange(kinds: Set<FeedKind>) {
        val picker = referencesOf(state.value).picker ?: return
        if (picker.kinds == kinds) return
        candidatesJob?.cancel()
        update { it.withPicker(picker.copy(kinds = kinds)) }
        read(debounce = false)
    }

    override fun onRetryCandidates() {
        candidatesJob?.cancel()
        read(debounce = false)
    }

    override fun onStageReference(row: ReferenceCandidateRow) = update { it.staged(row) }

    override fun onUnstageReference(targetId: String) = update { it.removed(targetId) }

    /**
     * A citation brought along by its id (`Cite in a new post`, ComposeCited.md):
     * staged at once without a name, then given its target as the lookup
     * resolves it — never doubled.
     */
    fun stageById(targetId: String) {
        if (referencesOf(state.value).references.any { it.targetId == targetId }) return
        update { it.added(targetId, target = null) }
        scope.launch {
            val resolved = references.candidateRows(targetId).valueOrNull()
                ?.firstOrNull { it.targetId == targetId }
                ?: return@launch
            update { section ->
                section.copy(
                    references = section.references.map { row ->
                        if (row.targetId == targetId) row.copy(target = resolved.target) else row
                    },
                )
            }
        }
    }

    private fun read(debounce: Boolean) {
        val picker = referencesOf(state.value).picker ?: return
        if (!isQueryable(picker.query)) return
        val query = picker.query.trim()
        val kinds = picker.kinds
        candidatesJob = scope.launch {
            if (debounce) delay(FINDER_DEBOUNCE_MILLIS)
            val answer = when (val outcome = references.referenceCandidates(query, PICKER_LIMIT, kinds)) {
                is Outcome.Success -> CandidateAnswer(
                    query = query,
                    kinds = kinds,
                    candidates = outcome.value.map { ReferenceCandidateRow(it.targetId, it.target) },
                )
                is Outcome.Refused, is Outcome.Failed -> CandidateAnswer(query, kinds, failed = true)
            }
            update { section -> section.picker?.let { section.withPicker(it.copy(answer = answer)) } ?: section }
        }
    }

    private fun update(block: (ReferenceSectionState) -> ReferenceSectionState) =
        state.update { withReferences(it, block(referencesOf(it))) }
}

/** How many candidates one picker read asks for (web's `CANDIDATE_LIMIT`). */
internal const val PICKER_LIMIT = 10

/**
 * The tag picker's index: names in use that start with [canonical] — the one
 * search read with the `#prefix` cue over the topic kind alone, so a bare cue
 * never lists what the matched topics reach (api-spec.md "Search"; web's
 * `TagNames`). A redacted name reads null and offers nothing.
 */
internal suspend fun SearchRepository.tagNames(canonical: String): Outcome<List<String>> =
    searchPage(
        SearchAsk(
            query = "#$canonical",
            kinds = setOf(FeedKind.TAG),
            includeSeen = true,
            order = SearchOrder.NEWEST,
            viewer = null,
        ),
        after = null,
    ).map { page -> page.hits.mapNotNull { (it.node as? SearchNode.Tag)?.name } }

/**
 * A tag picker that answers nothing: the default of a host's action bundle
 * (`PostEditActions`, `CommentEditActions`), whose route always hands the
 * view model's own.
 */
internal object InertTagPicker : TagPickerHandlers {
    override fun onOpenTagPicker() = Unit

    override fun onCloseTagPicker() = Unit

    override fun onTagPickerQueryChange(query: String) = Unit

    override fun onRetryTagIndex() = Unit

    override fun onStageTag(name: String) = Unit

    override fun onUnstageTag(name: String) = Unit
}

/** The citation picker's twin of [InertTagPicker]. */
internal object InertReferencePicker : ReferencePickerHandlers {
    override fun onOpenReferencePicker() = Unit

    override fun onCloseReferencePicker() = Unit

    override fun onReferencePickerQueryChange(query: String) = Unit

    override fun onReferenceKindsChange(kinds: Set<FeedKind>) = Unit

    override fun onRetryCandidates() = Unit

    override fun onStageReference(row: ReferenceCandidateRow) = Unit

    override fun onUnstageReference(targetId: String) = Unit
}
