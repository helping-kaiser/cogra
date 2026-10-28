// The reader's feed default (SettingsReading.md: "ALWAYS the reader's saved
// default stays on this device") over the one sealed store every device value
// rides — so Settings' erase takes it with the rest (EraseConfirm.md:21) and
// nothing here ever reaches the wire. Each account's default sits under its
// own name. A value this build cannot read back is no default at all, never a
// fault: the feed opens on CoGra's instead.

package com.cogra.network.store

import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedForm
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.feed.ReaderDefaultStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReaderDefaultStoreImpl @Inject constructor(
    private val store: EncryptedStore,
) : ReaderDefaultStore {

    override fun watch(account: String): Flow<FeedFilter?> =
        store.watch(nameOf(account)).map { decode(it) }.distinctUntilChanged()

    override suspend fun save(account: String, filter: FeedFilter) {
        val stored = StoredDefault(
            kinds = filter.kinds.map { it.name },
            forms = filter.forms.map { it.name },
            order = filter.order.name,
            seen = filter.showSeen,
            sensitive = filter.showSensitive,
            removed = filter.showRemoved,
            settling = filter.stillSettling,
            people = filter.people.name,
            peopleSign = filter.peopleSign.name,
        )
        store.put(nameOf(account), Json.encodeToString(stored).encodeToByteArray())
    }

    private fun decode(bytes: ByteArray?): FeedFilter? {
        if (bytes == null) return null
        val stored = try {
            Json.decodeFromString<StoredDefault>(bytes.decodeToString())
        } catch (_: SerializationException) {
            return null
        } catch (_: IllegalArgumentException) {
            return null
        }
        return FeedFilter(
            kinds = stored.kinds.mapNotNull { name -> FeedKind.entries.firstOrNull { it.name == name } }.toSet(),
            topic = null,
            forms = stored.forms.mapNotNull { name -> FeedForm.entries.firstOrNull { it.name == name } }.toSet(),
            order = FeedOrder.entries.firstOrNull { it.name == stored.order } ?: return null,
            people = PeopleScope.entries.firstOrNull { it.name == stored.people } ?: return null,
            peopleSign = PeopleSign.entries.firstOrNull { it.name == stored.peopleSign } ?: return null,
            showSeen = stored.seen,
            showSensitive = stored.sensitive,
            showRemoved = stored.removed,
            stillSettling = stored.settling,
        )
    }

    @Serializable
    private data class StoredDefault(
        val kinds: List<String>,
        val forms: List<String>,
        val order: String,
        val seen: Boolean,
        val sensitive: Boolean,
        val removed: Boolean,
        val settling: Boolean,
        val people: String,
        val peopleSign: String,
    )

    private companion object {
        fun nameOf(account: String) = "feed_default:$account"
    }
}
