package com.cogra.domain.history

import com.cogra.domain.Outcome
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.consumeEach
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * How far the record has pulled the server's seen-list: its newest entry
 * as of the last COMPLETED sync. The next sync pages down to here and no
 * further (PR-52).
 */
data class SeenWatermark(val nodeId: String, val firstSeenAt: Instant)

/**
 * One account's seen record at rest: the ids, and the sync watermark that
 * travels with them — so a later wipe of the record resets both together.
 */
data class StoredSeenRecord(val ids: Set<String>, val watermark: SeenWatermark?)

/** The seen record's at-rest home, one record per account (auth.md "Multi-account device custody"). */
interface SeenRecordStore {
    /** [account]'s record, or null when this device holds none for it. */
    suspend fun load(account: String): StoredSeenRecord?

    suspend fun save(account: String, record: StoredSeenRecord)
}

/**
 * THE DEVICE'S SEEN RECORD (ranked-feed-api §4.3; PR-49, PR-51, PR-52): the
 * set the feed's seen cut reads (CD-10) — every thing the READER has seen,
 * on this device or another.
 *
 * - **Persistent, per account (PR-51).** Every first seeing the
 *   [SeenTracker] takes is written through to the account's own record,
 *   so a restart keeps it, and an account switch loads the other account's
 *   record and never shows one account's seeing as another's (the custody
 *   rule).
 * - **A cache of the server's seen-list (PR-52).** `markSeen` already
 *   writes every device's seeing to the server; at app open and at sign-in
 *   (each time an account's record is loaded) the record lazily pages the
 *   reader's own `viewHistory` newest first down to its [SeenWatermark]
 *   and takes what it lacks. The first sync on an empty record is the
 *   whole seed; every later one is the delta, typically one page. The
 *   sync runs off the feed path — the feed never waits for it and never
 *   asks for it (OS-22: "never per fetch").
 * - **The reader's, never the viewer's.** Keyed by the session's account,
 *   so under a borrowed view the reader cuts their own seeing out of the
 *   lender's ranking (§4.3 "Reader, not viewer").
 * - **No session, no record.** Signed out it is empty, so the cut deletes
 *   nothing (history packet F6).
 * - **Never the own profile** (PR-50): History keeps it out, and so does
 *   this — whichever way it might arrive.
 */
@Singleton
class SeenRecord @Inject constructor(
    private val store: SeenRecordStore,
    private val source: SeenHistorySource,
    tokens: TokenStore,
    @ApplicationScope private val scope: CoroutineScope,
) {
    private sealed interface Slot {
        data object Loading : Slot

        data object None : Slot

        /** The loaded account's record. Its contents are guarded by [lock]. */
        class Held(val account: String, val ids: MutableSet<String>, var watermark: SeenWatermark?) : Slot {
            fun snapshot() = account to StoredSeenRecord(ids.toSet(), watermark)
        }
    }

    private val lock = Any()
    private val slot = MutableStateFlow<Slot>(Slot.Loading)

    /** First seeings reported while their account's record was still loading. Guarded by [lock]. */
    private val early = HashMap<String, MutableSet<String>>()

    /** One write at a time, each of a snapshot taken inside it — so no write is ever older than the last. */
    private val writes = Mutex()

    /** Write-through, coalesced: a burst of reports is one write of the latest set. */
    private val dirty = Channel<Unit>(Channel.CONFLATED)

    private val syncing = Mutex()

    init {
        scope.launch {
            tokens.tokens
                .map { it?.accountId }
                .distinctUntilChanged()
                .collect { account -> switchTo(account) }
        }
        scope.launch { dirty.consumeEach { persist() } }
    }

    /**
     * The ids the seen cut deletes, as the record stands NOW (CD-10: fresh
     * at every derive). Waits for the signed-in account's record to load,
     * so a derive never cuts by a record it has not read yet.
     */
    suspend fun seenIds(): Set<String> {
        val ready = slot.first { it != Slot.Loading }
        return synchronized(lock) { (ready as? Slot.Held)?.ids?.toSet().orEmpty() }
    }

    /**
     * [account]'s first seeings, from the tracker. Dropped when [account]
     * is no longer the one signed in — the custody rule's race, the same
     * the tracker's own book drops.
     */
    fun add(account: String, nodeIds: List<String>) {
        if (nodeIds.isEmpty()) return
        val changed = synchronized(lock) {
            when (val current = slot.value) {
                is Slot.Held -> current.account == account && current.ids.addAllExcept(nodeIds, account)
                Slot.Loading -> {
                    early.getOrPut(account) { LinkedHashSet() }.addAll(nodeIds)
                    false
                }
                Slot.None -> false
            }
        }
        if (changed) dirty.trySend(Unit)
    }

    /**
     * Pull the reader's seen-list down to the watermark (PR-52). Pages that
     * arrive are written through as they come, newest first, so a sync cut
     * short still leaves the most recent seeing in place; the watermark
     * moves only when a sync completes, so the next one re-reads whatever
     * this one did not reach.
     */
    suspend fun sync() = syncing.withLock {
        val (account, mark) = synchronized(lock) {
            (slot.value as? Slot.Held)?.let { it.account to it.watermark }
        } ?: return@withLock
        val newest = pull(account, mark) ?: return@withLock
        val moved = synchronized(lock) {
            (slot.value as? Slot.Held)?.takeIf { it.account == account }?.let { it.watermark = newest }
        }
        if (moved != null) dirty.trySend(Unit)
    }

    /**
     * Pages [account]'s seen-list down to [mark], writing each page through.
     * Returns the list's head once it got all the way, or null when it was
     * cut short — a fault, no reader, another reader's list, the account
     * gone — or the list is empty: the watermark stays where it was.
     */
    private suspend fun pull(account: String, mark: SeenWatermark?): SeenWatermark? {
        var after: String? = null
        var head: SeenWatermark? = null
        while (true) {
            val page = (source.seenPage(SYNC_PAGE_SIZE, after) as? Outcome.Success)?.value
            if (page == null || page.reader != account) return null
            if (head == null) head = page.entries.firstOrNull()?.let { SeenWatermark(it.nodeId, it.firstSeenAt) }
            val fresh = page.entries.takeWhile { mark == null || !it.reaches(mark) }
            if (!addSynced(account, fresh.map { it.nodeId })) return null
            if (fresh.size < page.entries.size || !page.hasNextPage || page.endCursor == null) return head
            after = page.endCursor
        }
    }

    /** The sync's write; false when the account changed under it. */
    private fun addSynced(account: String, nodeIds: List<String>): Boolean {
        val (still, changed) = synchronized(lock) {
            val held = (slot.value as? Slot.Held)?.takeIf { it.account == account }
            (held != null) to (held?.ids?.addAllExcept(nodeIds, account) == true)
        }
        if (changed) dirty.trySend(Unit)
        return still
    }

    private suspend fun switchTo(account: String?) {
        // The outgoing record is written whole before it is let go.
        val outgoing = synchronized(lock) {
            val current = slot.value as? Slot.Held
            slot.value = Slot.Loading
            current?.snapshot()
        }
        writes.withLock { outgoing?.let { (who, record) -> store.save(who, record) } }
        if (account == null) {
            synchronized(lock) {
                early.clear()
                slot.value = Slot.None
            }
            return
        }
        val stored = store.load(account)
        synchronized(lock) {
            val ids = LinkedHashSet<String>()
            ids.addAllExcept(stored?.ids.orEmpty(), account)
            ids.addAllExcept(early.remove(account).orEmpty(), account)
            early.clear()
            slot.value = Slot.Held(account, ids, stored?.watermark)
        }
        dirty.trySend(Unit)
        // App open or sign-in: the lazy sync, off the feed path.
        scope.launch { sync() }
    }

    private suspend fun persist() = writes.withLock {
        val snapshot = synchronized(lock) { (slot.value as? Slot.Held)?.snapshot() } ?: return@withLock
        store.save(snapshot.first, snapshot.second)
    }
}

/**
 * Whether the sync has come down to the watermark: the entry it names, or
 * anything first seen before it. Everything below the watermark's entry was
 * already pulled when that entry was the list's head, and new seeings only
 * ever sort above it ("re-seeing never moves an entry").
 */
private fun SeenEntry.reaches(mark: SeenWatermark): Boolean =
    nodeId == mark.nodeId || firstSeenAt.isBefore(mark.firstSeenAt)

/** Adds [ids] except the account's own profile (PR-50); true when anything was new. */
private fun MutableSet<String>.addAllExcept(ids: Collection<String>, own: String): Boolean {
    var changed = false
    for (id in ids) if (id != own && add(id)) changed = true
    return changed
}

/** A seen-list page per sync call: the page budget. */
internal const val SYNC_PAGE_SIZE = MAX_SEEN_BATCH
