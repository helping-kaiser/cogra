package com.cogra.domain.history

import com.cogra.domain.CograLog
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The seen tracker: what the surfaces report as seen, carried to the
 * reader's seen-list (History.md "a content joins History the first time
 * it was fully in the viewport", "NEVER the reader has to act for it").
 *
 * The surfaces decide WHAT was seen and say so through [saw] — or, for a
 * card taller than the viewport, through [sawEdges]. This holds
 * the reports and sends them, and four properties make it what it is:
 *
 * - **Signed-in only.** No session, no seen-list (history packet F6): with
 *   no account a report is dropped on arrival, and nothing is ever sent.
 * - **Once per session.** An id reported once is never queued again while
 *   the same account is signed in. The server already ignores a re-seeing
 *   (History.md "NEVER the seeing is counted"); this only spares it the
 *   call. The memory belongs to one account: a session that ends or
 *   changes account drops it whole, queue included, so nothing one
 *   account saw is ever sent, or suppressed, as another's — the custody
 *   rule auth.md "Multi-account device custody" sets for every per-account
 *   value, and `RegistrationFlow`'s session watch before this.
 * - **Batched at checkpoints.** Reports queue in the order they arrived,
 *   and [flush] — called where the reading pauses: the list stops
 *   scrolling, the reader leaves it, the app goes to the background —
 *   sends them a page ([MAX_SEEN_BATCH]) per call, oldest first, so the
 *   server writes them in the order they were seen.
 * - **Nothing is lost to a delay, and no session stalls on a dead batch.**
 *   A batch the server cannot take now — the per-account budget's
 *   RATE_LIMITED, a dead network, any refusal not known to be final —
 *   stays at the head of the queue, in order, and goes again at the next
 *   checkpoint, however often that comes. A batch refused for good
 *   ([FINAL_REFUSALS]: BAD_INPUT) can never succeed by resending, so it is
 *   halved and the head sent again, down to the one id at fault; that id
 *   alone is dropped. It stays in the session's memory, so it is never
 *   queued or sent again, and its batch-mates are delivered. The halving
 *   survives a retry in between. Neither case is surfaced to the reader
 *   (seeing has no UI; history packet, "Rate-limiter scopes"); a dropped id
 *   is written to [CograLog], which only the debug app listens to.
 *
 * In memory and process-wide, on the `SensitiveReveals` pattern; flushes
 * run on the app-lifetime scope, because the checkpoint that matters most
 * — the reader leaving — is exactly when the screen's own scope ends.
 */
@Singleton
class SeenTracker @Inject constructor(
    private val history: ViewHistoryRepository,
    tokens: TokenStore,
    @ApplicationScope private val scope: CoroutineScope,
) {
    private val lock = Any()

    /** The signed-in account's reports; null with no session. Guarded by [lock]. */
    private var book: SeenBook? = null

    /** One drain at a time, so batches leave in queue order. */
    private val draining = Mutex()

    init {
        // A token refresh rotates the pair but keeps the account, so only
        // a change of account — sign-out included — starts a new book.
        scope.launch {
            tokens.tokens
                .map { it?.accountId }
                .distinctUntilChanged()
                .collect { account -> synchronized(lock) { book = account?.let(::SeenBook) } }
        }
    }

    /**
     * The surface's report: these nodes were just seen, in this order.
     * Ids already reported this session are ignored.
     */
    fun saw(nodeIds: List<String>) {
        if (nodeIds.isEmpty()) return
        synchronized(lock) { book?.saw(nodeIds) }
    }

    /**
     * The surface's report for a card taller than the viewport: its [top]
     * edge, its [bottom] edge, or both, stood on screen this frame. The
     * card is seen once both have — "not necessarily at once"
     * (History.md:13) — so its first edge is remembered for the session,
     * in the same book as everything else and dropped with it, and the
     * other one queues the card like any first seeing.
     */
    fun sawEdges(nodeId: String, top: Boolean, bottom: Boolean) {
        if (!top && !bottom) return
        synchronized(lock) { book?.sawEdges(nodeId, top, bottom) }
    }

    /** A checkpoint: send what is queued, a page per call. */
    fun flush() {
        scope.launch { drain() }
    }

    /** What is queued for the signed-in account, oldest first. */
    internal fun queued(): List<String> = synchronized(lock) { book?.queued.orEmpty() }

    /** The ids given up on this session: refused alone, for good. */
    internal fun dropped(): List<String> = synchronized(lock) { book?.dropped.orEmpty().toList() }

    internal suspend fun drain() {
        draining.withLock {
            while (true) {
                val (sending, batch) = synchronized(lock) {
                    val current = book ?: return
                    current to current.nextBatch()
                }
                if (batch.isEmpty()) return
                val outcome = history.markSeen(batch)
                // Anything not known to be final keeps the batch where it is;
                // the next checkpoint sends it again, ahead of everything newer.
                if (outcome !is Outcome.Success && !outcome.isFinalRefusal()) return
                // The book may have been dropped while the call was out —
                // the session ended — and its successor owes nothing.
                val gone = synchronized(lock) {
                    when {
                        book !== sending -> emptyList()
                        outcome is Outcome.Success -> {
                            sending.sent(batch.size)
                            emptyList()
                        }
                        else -> sending.refusedForGood(batch.size)
                    }
                }
                if (gone.isNotEmpty()) {
                    CograLog.w(TAG) { "the server refused $gone for good; dropped, not retried" }
                }
            }
        }
    }
}

/**
 * One account's reports: every id it has reported this session, and those
 * still to send, in arrival order — and, for a tall card not yet seen, the
 * one edge it has shown so far. Not thread-safe; [SeenTracker] guards it.
 */
internal class SeenBook(val account: String) {
    private val reported = HashSet<String>()
    private val queue = ArrayDeque<String>()

    /** A tall card's first edge on screen: true for its top, false for its bottom. */
    private val firstEdge = HashMap<String, Boolean>()

    val queued: List<String> get() = queue.toList()

    fun saw(nodeIds: List<String>) {
        nodeIds.forEach { if (reported.add(it)) queue.addLast(it) }
    }

    fun sawEdges(nodeId: String, top: Boolean, bottom: Boolean) {
        if (nodeId in reported) return
        val earlier = firstEdge[nodeId]
        val both = (top && bottom) || (earlier == true && bottom) || (earlier == false && top)
        if (both) {
            firstEdge.remove(nodeId)
            saw(listOf(nodeId))
        } else if (earlier == null) {
            firstEdge[nodeId] = top
        }
    }

    /**
     * The most ids the next call carries: a page, until the server refuses
     * a batch for good and [refusedForGood] halves it to find the id at fault.
     */
    private var batchLimit = MAX_SEEN_BATCH

    /** Ids given up on: refused alone, for good. They stay in [reported]. */
    val dropped = mutableListOf<String>()

    /** The next call's ids: the oldest page (or halved page) of the queue. */
    fun nextBatch(): List<String> = queue.take(batchLimit)

    /**
     * The oldest [count] ids were written. Only appends happen while a
     * batch is out, so they are still the ones at the head.
     */
    fun sent(count: Int) {
        repeat(count) { queue.removeFirst() }
        if (queue.isEmpty()) batchLimit = MAX_SEEN_BATCH
    }

    /**
     * The batch of the oldest [count] ids was refused for good. More than one
     * id: halve the limit and let the head go again. One id: it is the cause,
     * so it leaves the queue for good and the limit resets. Returns the ids
     * dropped, empty when only the limit moved.
     */
    fun refusedForGood(count: Int): List<String> {
        if (count > 1) {
            batchLimit = (count + 1) / 2
            return emptyList()
        }
        val gone = queue.take(count)
        repeat(count) { queue.removeFirst() }
        dropped += gone
        batchLimit = MAX_SEEN_BATCH
        return gone
    }
}

/**
 * The refusal codes that end a batch for good. An allow-list: a code not
 * named here — one a future server adds included — is a retry, so an id is
 * only ever dropped for a code someone decided is final. `markSeen` answers
 * BAD_INPUT for a list the server will not take (api-spec.md `markSeen`).
 */
internal val FINAL_REFUSALS = setOf(ErrorCode.BAD_INPUT)

private fun Outcome<*>.isFinalRefusal(): Boolean =
    this is Outcome.Refused && errors.any { it.code in FINAL_REFUSALS }

private const val TAG = "SeenTracker"
