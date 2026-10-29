package com.cogra.feature.content.wizard

import com.cogra.domain.Outcome
import com.cogra.domain.media.MediaRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * THE ALREADY-PUBLISHED MARKER (ComposeDetails.md, ComposeDetailsReused.md;
 * web's `findPublishedMatch`). Reusing media never blocks: whenever the
 * stage's landed uploads change, one read (`ownPublishedPlacement`) asks
 * whether any already stands in one of the author's own published posts —
 * the server matching each by asset id or rendition digest, earliest post
 * first — and the details stage marks it. The answer is tagged with the ids
 * it was asked for ([ComposeWizardState.publishedMarker]); a failed read draws
 * the stage at rest, since the marker is a hint, never a gate.
 */
internal fun CoroutineScope.markPublished(state: MutableStateFlow<ComposeWizardState>, media: MediaRepository): Job =
    launch {
        state.map { if (it.mode == BodyMode.Media) it.uploadedIds else emptyList() }
            .distinctUntilChanged()
            .collectLatest { ids ->
                if (ids.isEmpty()) return@collectLatest
                val answer = media.ownPublishedPlacement(ids) as? Outcome.Success ?: return@collectLatest
                val marker = answer.value?.let { PublishedMarker(ids, it.postId, it.createdAt) }
                state.update { it.copy(published = marker) }
            }
    }
