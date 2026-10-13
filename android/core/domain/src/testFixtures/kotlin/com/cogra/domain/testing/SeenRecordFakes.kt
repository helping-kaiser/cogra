package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.history.SeenEntry
import com.cogra.domain.history.SeenHistorySource
import com.cogra.domain.history.SeenPage
import com.cogra.domain.history.SeenRecord
import com.cogra.domain.history.SeenRecordStore
import com.cogra.domain.history.StoredSeenRecord
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CoroutineScope
import java.time.Instant

/** A seen record over in-memory fakes, for tests that only need one to exist. */
fun testSeenRecord(
    tokens: TokenStore,
    scope: CoroutineScope,
    store: SeenRecordStore = FakeSeenRecordStore(),
    source: SeenHistorySource = ScriptedSeenHistory(),
): SeenRecord = SeenRecord(store, source, tokens, scope)

/**
 * The seen record's at-rest home, in memory: a map that outlives any one
 * `SeenRecord` built over it — which is what a restart is, to the record.
 */
class FakeSeenRecordStore : SeenRecordStore {
    val records = mutableMapOf<String, StoredSeenRecord>()

    override suspend fun load(account: String): StoredSeenRecord? = records[account]

    override suspend fun save(account: String, record: StoredSeenRecord) {
        records[account] = record
    }
}

/**
 * The server's seen-list, scriptable per account: each account's things,
 * newest first, served in pages after an opaque cursor (the index of the
 * next entry). Reads as the account [reader] names — the session's — and
 * records every call.
 */
class ScriptedSeenHistory : SeenHistorySource {
    /** Each account's seen-list, newest first. */
    val lists = mutableMapOf<String, MutableList<SeenEntry>>()

    /** Whose session the reads go out under; null reads as no reader. */
    var reader: String? = null

    /** Every page asked for: the reader and the cursor. */
    val calls = mutableListOf<Pair<String?, String?>>()

    /** Answers that pre-empt the next calls, in order. */
    val faults = ArrayDeque<Outcome<SeenPage?>>()

    /** [account] saw [nodeId] at [at] on some device: it heads that account's list. */
    fun seenElsewhere(account: String, nodeId: String, at: Instant) {
        lists.getOrPut(account) { mutableListOf() }.add(0, SeenEntry(nodeId, at))
    }

    override suspend fun seenPage(first: Int, after: String?): Outcome<SeenPage?> {
        calls += reader to after
        faults.removeFirstOrNull()?.let { return it }
        val account = reader ?: return Outcome.Success(null)
        val list = lists[account].orEmpty()
        val from = after?.toInt() ?: 0
        val page = list.drop(from).take(first)
        val next = from + page.size
        return Outcome.Success(
            SeenPage(
                reader = account,
                entries = page,
                endCursor = next.toString(),
                hasNextPage = next < list.size,
            ),
        )
    }
}
