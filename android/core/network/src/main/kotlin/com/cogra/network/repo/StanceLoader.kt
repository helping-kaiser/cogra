// THE STANDINGS ASKED TOGETHER GO TOGETHER (the app's twin of the web's
// `PageStances` seam, apollo-stance-data.ts). Every stance control reads its
// own standing when it comes into view, and a page brings its cards into view
// together, so the reads that arrive within one short window are held and
// answered from one dispatch — one `PageStances` request per view and account
// rather than one root read per card.
//
// A window, not "the same dispatch": a control's read passes two device-store
// reads before it reaches the repository (StanceViewModel.observe), so the
// cards one frame composes arrive a few milliseconds apart. The window is
// Apollo Kotlin's own documented batching interval (`batchIntervalMillis`,
// 10 ms — apollographql.com/docs/kotlin/advanced/query-batching). Apollo's
// HTTP batching itself does not fit: it sends N operations in one HTTP body,
// which the API refuses (`crates/api/src/lib.rs`, `BatchRequest::into_single`),
// and each would still be priced and resolved as its own root read rather than
// as one `nodes(ids:)` read.
//
// A read asked after a batch left joins the next one, never the one in
// flight, so a re-read after the reader's own act always asks after the act.
// Nothing is kept once a batch answers.

package com.cogra.network.repo

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How long the first read of a batch waits for the others (Apollo Kotlin's batching interval). */
internal const val COALESCE_WINDOW_MS = 10L

/**
 * The batch a read joins: the account it was asked under and the view it
 * asks. Two accounts never share a request — a batch formed under one leaves
 * under that one or not at all — and neither do the L1 and the L2 view.
 */
internal data class StanceLane(val owner: String?, val includePending: Boolean)

/**
 * Holds the reads asked within [windowMillis] of a lane's first and answers
 * every one of them from one [dispatch] of their distinct ids.
 *
 * The dispatch runs on [scope], the application's, not on any asker's: a
 * card whose screen closes stops waiting, and the batch still answers the
 * cards of every other screen that joined it.
 */
internal class StanceLoader<V>(
    private val scope: CoroutineScope,
    private val dispatch: suspend (lane: StanceLane, ids: List<String>) -> Map<String, V>,
    /** The answer each read of a batch whose dispatch threw gets. */
    private val fault: (Exception) -> V,
    private val windowMillis: Long = COALESCE_WINDOW_MS,
) {
    private val lock = Any()
    private val open = HashMap<StanceLane, LinkedHashMap<String, CompletableDeferred<V>>>()

    /** [id]'s answer from the batch [lane]'s window holds now. */
    suspend fun load(lane: StanceLane, id: String): V {
        val answer = synchronized(lock) {
            open.getOrPut(lane) { LinkedHashMap<String, CompletableDeferred<V>>().also { send(lane, it) } }
                .getOrPut(id) { CompletableDeferred() }
        }
        return answer.await()
    }

    private fun send(lane: StanceLane, batch: Map<String, CompletableDeferred<V>>) {
        scope.launch {
            delay(windowMillis)
            // Closed under the lock: a read from here on opens the next batch.
            val ids = synchronized(lock) {
                if (open[lane] === batch) open.remove(lane)
                batch.keys.toList()
            }
            val answers = runCatching { dispatch(lane, ids) }
            val thrown = answers.exceptionOrNull()?.let { it as? Exception ?: IllegalStateException(it) }
            for ((id, deferred) in batch) {
                val answer = answers.getOrNull()?.get(id)
                deferred.complete(answer ?: fault(thrown ?: IllegalStateException("the batch did not answer $id")))
            }
        }
    }
}
