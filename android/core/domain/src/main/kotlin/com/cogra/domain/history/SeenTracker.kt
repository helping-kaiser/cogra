package com.cogra.domain.history

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
 * The surfaces decide WHAT was seen and say so through [saw]. This holds
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
 * - **Nothing is lost to a refusal.** A batch the server does not take —
 *   the per-account budget's RATE_LIMITED, a dead network, any outcome but
 *   success — stays at the head of the queue, in order, and goes again at
 *   the next checkpoint. It is never surfaced: seeing has no UI, so a
 *   refused batch has nothing to show (history packet, "Rate-limiter
 *   scopes").
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

    /** A checkpoint: send what is queued, a page per call. */
    fun flush() {
        scope.launch { drain() }
    }

    /** What is queued for the signed-in account, oldest first. */
    internal fun queued(): List<String> = synchronized(lock) { book?.queued.orEmpty() }

    internal suspend fun drain() {
        draining.withLock {
            while (true) {
                val (sending, batch) = synchronized(lock) {
                    val current = book ?: return
                    current to current.nextBatch()
                }
                if (batch.isEmpty()) return
                // Any outcome but success keeps the batch where it is; the
                // next checkpoint sends it again, ahead of everything newer.
                if (history.markSeen(batch) !is Outcome.Success) return
                // The book may have been dropped while the call was out —
                // the session ended — and its successor owes nothing.
                synchronized(lock) { if (book === sending) sending.sent(batch.size) }
            }
        }
    }
}

/**
 * One account's reports: every id it has reported this session, and those
 * still to send, in arrival order. Not thread-safe; [SeenTracker] guards it.
 */
internal class SeenBook(val account: String) {
    private val reported = HashSet<String>()
    private val queue = ArrayDeque<String>()

    val queued: List<String> get() = queue.toList()

    fun saw(nodeIds: List<String>) {
        nodeIds.forEach { if (reported.add(it)) queue.addLast(it) }
    }

    /** The next call's ids: the oldest page of the queue. */
    fun nextBatch(): List<String> = queue.take(MAX_SEEN_BATCH)

    /**
     * The oldest [count] ids were written. Only appends happen while a
     * batch is out, so they are still the ones at the head.
     */
    fun sent(count: Int) {
        repeat(count) { queue.removeFirst() }
    }
}
