package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.repo.ContentRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * THE THREAD OPENS LANDED ON THE COMMENT (jakob 2026-10-01; Saved.md). A
 * reply sits behind its parent's collapsed count, and its top-level ancestor
 * may be pages down the thread, so the landing walks the chain up, pages the
 * thread until the top of it arrives, and unfolds each branch on the way
 * down. Each step is bounded: a chain it cannot finish lands on the deepest
 * comment it could open. web's twin is the sheet's landing effect
 * (`comments-sheet.tsx`).
 *
 * It writes the [CommentsViewModel]'s own state, so the thread it pages and
 * the branches it unfolds are the ones the sheet shows.
 */
internal class CommentLanding(
    private val content: ContentRepository,
    private val state: MutableStateFlow<CommentsUiState>,
    private val postId: () -> String?,
    private val scope: CoroutineScope,
) {
    private var landedOn: String? = null

    fun landOn(commentId: String) {
        if (landedOn == commentId) return
        landedOn = commentId
        scope.launch {
            val chain = ancestry(commentId)
            // The thread's own first read lands before anything is paged on top of it.
            state.first { !it.loading }
            val top = chain.first()
            var pages = 0
            while (state.value.comments.none { it.id == top } && state.value.hasMore && pages < LANDING_PAGES) {
                pages++
                if (!nextPage()) break
            }
            if (state.value.comments.none { it.id == top }) return@launch
            for (at in 0 until chain.size - 1) {
                if (!unfoldTo(chain[at], chain[at + 1])) break
            }
            state.update { it.copy(landingAt = top) }
        }
    }

    /** The list scrolled to the landing. */
    fun done() = state.update { it.copy(landingAt = null) }

    /** The comment and its ancestors, top-level first, as far up as [LANDING_DEPTH]. */
    private suspend fun ancestry(commentId: String): List<String> {
        val chain = ArrayDeque(listOf(commentId))
        var parent = (content.commentParent(commentId) as? Outcome.Success)?.value
        while (parent != null && chain.size < LANDING_DEPTH) {
            chain.addFirst(parent)
            parent = (content.commentParent(parent) as? Outcome.Success)?.value
        }
        return chain
    }

    /** The thread's next page, read and appended; false when it did not arrive. */
    private suspend fun nextPage(): Boolean {
        val id = postId() ?: return false
        val s = state.value
        val outcome = content.comments(id, FEED_PAGE_SIZE, s.endCursor, s.includePending)
        val page = (outcome as? Outcome.Success)?.value?.page ?: return false
        state.update {
            it.copy(
                comments = it.comments.appendPage(page.items) { c -> c.id },
                endCursor = page.endCursor,
                hasMore = page.hasNextPage,
            )
        }
        return true
    }

    /** Unfolds [parentId]'s branch, paging until [childId] stands in it; false when it never does. */
    private suspend fun unfoldTo(parentId: String, childId: String): Boolean {
        val includePending = state.value.includePending
        var thread = ReplyThread()
        var pages = 0
        var more = true
        while (more && thread.items.none { it.id == childId } && pages < LANDING_PAGES) {
            pages++
            val outcome = content.commentReplies(parentId, FEED_PAGE_SIZE, thread.endCursor, includePending)
            val page = (outcome as? Outcome.Success)?.value ?: break
            thread = ReplyThread(
                items = thread.items.appendPage(page.items) { c -> c.id },
                endCursor = page.endCursor,
                hasMore = page.hasNextPage,
            )
            more = page.hasNextPage
        }
        val unfolded = thread
        state.update { it.copy(replyThreads = it.replyThreads + (parentId to unfolded)) }
        return unfolded.items.any { it.id == childId }
    }

    private companion object {
        /** How far up a chain the landing walks. */
        const val LANDING_DEPTH = 16

        /** How many pages a landing reads, of the thread or of one branch, before it settles. */
        const val LANDING_PAGES = 10
    }
}
