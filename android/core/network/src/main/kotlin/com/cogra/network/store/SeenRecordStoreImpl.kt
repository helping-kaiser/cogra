// The device's seen record, at rest (ranked-feed-api §4.3; PR-51).
//
// It rides the same Tink-sealed store the tokens, the identity and the
// compose draft do, one record per account under a name of its own — so the
// custody rule (auth.md "Multi-account device custody") keeps accounts
// apart, and a purge by account prefix can find it. What the reader has
// seen is private reading behaviour: never left in cleartext for any
// process with the app's storage.

package com.cogra.network.store

import com.cogra.domain.history.SeenRecordStore
import com.cogra.domain.history.SeenWatermark
import com.cogra.domain.history.StoredSeenRecord
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.format.DateTimeParseException
import javax.inject.Inject
import javax.inject.Singleton

@kotlinx.serialization.Serializable
private data class StoredMark(val nodeId: String, val firstSeenAt: String)

/** The ids and the sync watermark in ONE value, so they are written — and wiped — together. */
@kotlinx.serialization.Serializable
private data class StoredRecord(val ids: List<String> = emptyList(), val watermark: StoredMark? = null)

@Singleton
class SeenRecordStoreImpl @Inject constructor(
    private val store: EncryptedStore,
) : SeenRecordStore {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun load(account: String): StoredSeenRecord? {
        val bytes = store.get(seenRecordKey(account)) ?: return null
        val stored = try {
            json.decodeFromString(StoredRecord.serializer(), bytes.decodeToString())
        } catch (_: SerializationException) {
            // A record that will not decode is no record. It is only a
            // cache of the server's seen-list: the next sync, with no
            // watermark, pulls the whole list again. Not storage loss.
            return null
        }
        return StoredSeenRecord(stored.ids.toSet(), stored.watermark?.toDomain())
    }

    override suspend fun save(account: String, record: StoredSeenRecord) {
        val stored = StoredRecord(
            ids = record.ids.toList(),
            watermark = record.watermark?.let { StoredMark(it.nodeId, it.firstSeenAt.toString()) },
        )
        store.put(seenRecordKey(account), json.encodeToString(StoredRecord.serializer(), stored).encodeToByteArray())
    }
}

/** A watermark that will not parse is no watermark: the next sync re-reads from the top. */
private fun StoredMark.toDomain(): SeenWatermark? = try {
    SeenWatermark(nodeId, Instant.parse(firstSeenAt))
} catch (_: DateTimeParseException) {
    null
}

/**
 * Where an account's seen record lives. Named once, so a wipe of the
 * account's custody set (sign-out, a Settings reset) can find it.
 */
internal fun seenRecordKey(account: String): String = "seen_record:$account"
