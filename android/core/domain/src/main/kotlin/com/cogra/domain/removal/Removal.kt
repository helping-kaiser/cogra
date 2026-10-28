// THE AUTHOR'S REMOVE (api-spec.md `removeContent`; erasure.md §1), and the
// mark it leaves on every surface that holds the node. web's twin is
// `web/src/lib/api/removal-api.ts`.
//
// IMMEDIATE AND UNSIGNED. Removal is pure L2 policy — nothing is prepared or
// signed — so it is one authenticated request, not a prepare-and-sign
// handshake. The client always names the node's GENESIS record with
// `includeRevisions: true`: the confirm promises "every earlier version's",
// and removing "the post" is the whole chain (erasure.md §1).
//
// TAKEN, THE NODE NEVER STANDS UNMARKED (RemoveConfirm.md:11). The node is
// re-read for its own mark (the packet's RM-G5 build word); where that read is
// lost, the removal's own answer stamps it — the server's `redactedAt` where a
// record had landed, this moment where none had (a still-settling node answers
// `records: []` and lands reduced).

package com.cogra.domain.removal

import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.valueOrNull
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** Which node class a removal names — what the re-read asks after. */
enum class RemovalKind { Post, Comment }

/** The removal over the contract. */
interface RemovalRepository {
    /**
     * Removes the chain [record] (a node's `genesisRecordId`) names. Success
     * carries the moment the server stamped on the first landed record, or
     * null — a still-settling node answers `records: []` with no error.
     */
    suspend fun removeContent(record: String): Outcome<Instant?>

    /** The node's own mark, read fresh; null where it answers none. */
    suspend fun removal(kind: RemovalKind, id: String): Outcome<Removal?>
}

/**
 * THE MARKS THIS DEVICE HAS SEEN TAKEN, by node id — the one place every
 * surface holding a node learns that it went.
 *
 * A surface that comes back from memory (the feed's frozen pages, a Saved
 * page, the thread a sheet keeps) holds the node as it was when it was read,
 * and a removal taken elsewhere in between reached this set, not that memory.
 * So each surface draws its nodes through [marks] — web reaches the same end
 * through its normalised cache (`withCachedRemoval`). A removal is a fact
 * about the node, not about a reader, so the set outlives an account switch.
 */
@Singleton
class RemovedMarks @Inject constructor() {
    private val _marks = MutableStateFlow<Map<String, Removal>>(emptyMap())
    val marks: StateFlow<Map<String, Removal>> = _marks.asStateFlow()

    fun record(nodeId: String, removal: Removal) = _marks.update { it + (nodeId to removal) }
}

/** Removes a node and returns the mark it now wears, recorded for every surface. */
class RemoveContent @Inject constructor(
    private val repository: RemovalRepository,
    private val marks: RemovedMarks,
) {
    /** The clock a mark is stamped at when neither the re-read nor the answer dates it; tests pin it. */
    internal var now: () -> Instant = Instant::now

    /**
     * Any non-success is passed through untouched: the confirm shows one
     * failure state for all of them (the packet's residual flag — the client
     * never sends a refusable removal of its own content).
     */
    suspend operator fun invoke(kind: RemovalKind, nodeId: String, record: String): Outcome<Removal> {
        val stamped = when (val removed = repository.removeContent(record)) {
            is Outcome.Success -> removed.value
            is Outcome.Refused -> return removed
            is Outcome.Failed -> return removed
        }
        val mark = repository.removal(kind, nodeId).valueOrNull()
            ?: Removal(at = stamped ?: now(), by = RemovalAgent.AUTHOR)
        marks.record(nodeId, mark)
        return Outcome.Success(mark)
    }
}

private val GONE = ModeratedField(value = null, status = FieldStatus.REDACTED)

/**
 * The post wearing [removal], as the server answers a removed node: every
 * authored field REDACTED and no gallery, topics or citations — redaction is
 * record-granular (PostCard.d.ts:137-144). A surface swaps it in for the post
 * it holds, so the card stands as its mark in place with no re-read of its own.
 */
fun PostView.withRemoval(removal: Removal): PostView = copy(
    removal = removal,
    title = GONE,
    description = GONE,
    content = GONE,
    attachments = emptyList(),
    attachmentsStatus = FieldStatus.REDACTED,
    topics = emptyList(),
    references = emptyList(),
)

/** The comment wearing [removal], as [PostView.withRemoval]; its replies are untouched. */
fun CommentView.withRemoval(removal: Removal): CommentView = copy(
    removal = removal,
    content = GONE,
    attachments = emptyList(),
    attachmentsStatus = FieldStatus.REDACTED,
    topics = emptyList(),
    references = emptyList(),
    sensitiveSelfMark = false,
    sensitiveReason = null,
)

/** The post as [marks] knows it now: wearing a mark taken since it was read, or as it was. */
fun PostView.marked(marks: Map<String, Removal>): PostView =
    if (removal != null) this else marks[id]?.let(::withRemoval) ?: this

/** The comment as [marks] knows it now. */
fun CommentView.marked(marks: Map<String, Removal>): CommentView =
    if (removal != null) this else marks[id]?.let(::withRemoval) ?: this
