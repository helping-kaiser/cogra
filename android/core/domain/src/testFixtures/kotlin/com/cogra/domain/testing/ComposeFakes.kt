// The compose wizard's draft custody, in memory: the working draft and
// the sealed copies of staged posts (FC-G5), with the same seal-and-clear
// and restore-only-into-an-empty-slot semantics the real stores keep.

package com.cogra.domain.testing

import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.ComposeDraftStore
import com.cogra.domain.compose.SealVerdict
import com.cogra.domain.compose.SealedDraft
import com.cogra.domain.compose.SealedDraftStore
import com.cogra.domain.compose.StagedFate
import com.cogra.domain.compose.sealVerdict

/** The working draft, in memory. */
open class InMemoryComposeDraftStore : ComposeDraftStore {
    var held: ComposeDraft? = null

    override suspend fun draft(): ComposeDraft? = held

    override suspend fun save(draft: ComposeDraft) {
        held = draft
    }

    override suspend fun clear() {
        held = null
    }
}

/** The sealed copies, in memory, restoring into [drafts]. */
class InMemorySealedDraftStore(private val drafts: InMemoryComposeDraftStore) : SealedDraftStore {
    val copies = mutableListOf<SealedDraft>()

    override suspend fun seal(draft: ComposeDraft, node: String, writes: List<String>) {
        if (writes.isEmpty()) return
        copies += SealedDraft(node, writes, draft)
        drafts.held = null
    }

    override suspend fun sealed(): List<SealedDraft> = copies.toList()

    override suspend fun settle(fate: suspend (writeId: String) -> StagedFate) {
        for (copy in copies.toList()) {
            when (sealVerdict(copy.writes.map { fate(it) })) {
                SealVerdict.Purge -> copies -= copy
                SealVerdict.Restore -> if (drafts.held == null) {
                    drafts.held = copy.draft
                    copies -= copy
                }
                SealVerdict.Wait -> Unit
            }
        }
    }
}
