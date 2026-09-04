package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.repo.ReferenceRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The topics + citations editing surface, owned once.
 *
 * Four composers carry the same two sections — the post wizard, the
 * post edit, the reply wizard and the comment edit — and each used to
 * carry its own copy of the eighteen handlers over them, the finder's
 * debounce, and its own staleness check. The state side was already
 * shared ([TagSectionState], [ReferenceSectionState]); this is the
 * plumbing on top, so the debounced lookup and the rule that a late
 * answer to a stale query is dropped exist once and are tested once
 * (android/CLAUDE.md "Module discipline").
 *
 * A host supplies its own state flow plus the two lenses that read and
 * replace its sections, which is what lets four unrelated state types
 * share one editor without a common supertype.
 */
internal class SectionsEditor<S>(
    private val scope: CoroutineScope,
    private val references: ReferenceRepository,
    private val state: MutableStateFlow<S>,
    private val tagsOf: (S) -> TagSectionState,
    private val withTags: (S, TagSectionState) -> S,
    private val referencesOf: (S) -> ReferenceSectionState,
    private val withReferences: (S, ReferenceSectionState) -> S,
) {

    /** The pending lookup, so a keystroke cancels the one before it. */
    private var finderJob: Job? = null

    // -- Topics (hashtag.md §4) --

    fun onTagInputChange(value: String) = updateTags { it.withInput(value) }

    fun onAddTag() = updateTags { it.added() }

    fun onRemoveTag(name: String) = updateTags { it.removed(name) }

    /** Tapping a staged chip opens its parameters (F6). */
    fun onTuneTag(name: String) = updateTags { it.tuned(name) }

    fun onDoneTuningTag() = updateTags { it.tuned(null) }

    fun onTagRelevanceChange(name: String, value: Double) = updateTags { it.withRelevance(name, value) }

    fun onTagConfidenceChange(name: String, value: Double) = updateTags { it.withConfidence(name, value) }

    fun updateTags(block: (TagSectionState) -> TagSectionState) =
        state.update { withTags(it, block(tagsOf(it))) }

    // -- References (D10, D20) --

    fun onOpenFinder() = updateReferences { it.withFinder(ReferenceFinderState()) }

    fun onCloseFinder() {
        finderJob?.cancel()
        updateReferences { it.withFinder(null) }
    }

    fun onFinderQueryChange(query: String) {
        finderJob?.cancel()
        updateReferences { section ->
            section.withFinder(
                (section.finder ?: ReferenceFinderState()).copy(
                    query = query,
                    searching = query.isNotBlank(),
                    failed = false,
                ),
            )
        }
        finderJob = scope.launch {
            delay(FINDER_DEBOUNCE_MILLIS)
            when (val outcome = references.candidateRows(query)) {
                is Outcome.Success -> updateFinder(query) {
                    it.copy(candidates = outcome.value, searching = false, failed = false)
                }
                is Outcome.Refused, is Outcome.Failed -> updateFinder(query) {
                    it.copy(searching = false, failed = true)
                }
            }
        }
    }

    /** Picking a candidate stages it and closes the finder. */
    fun onPickReference(row: ReferenceCandidateRow) {
        finderJob?.cancel()
        updateReferences { it.added(row.targetId, row.target).withFinder(null) }
    }

    fun onRemoveReference(targetId: String) = updateReferences { it.removed(targetId) }

    fun onTuneReference(targetId: String) = updateReferences { it.tuned(targetId) }

    fun onDoneTuningReference() = updateReferences { it.tuned(null) }

    fun onReferenceRelevanceChange(targetId: String, value: Double) =
        updateReferences { it.withRelevance(targetId, value) }

    fun onReferenceSupportChange(targetId: String, value: Double) =
        updateReferences { it.withSupport(targetId, value) }

    fun updateReferences(block: (ReferenceSectionState) -> ReferenceSectionState) =
        state.update { withReferences(it, block(referencesOf(it))) }

    /**
     * Applies [block] to the finder only while it is still asking
     * [query]: an answer that arrived after the author typed on is
     * stale, and the current query's is the only one that lands.
     */
    private fun updateFinder(query: String, block: (ReferenceFinderState) -> ReferenceFinderState) =
        updateReferences { section ->
            section.finder?.takeIf { it.query == query }?.let { section.withFinder(block(it)) }
                ?: section
        }
}
