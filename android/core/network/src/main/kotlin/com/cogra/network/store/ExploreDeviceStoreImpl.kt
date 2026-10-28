// Explore's device-local memory (Explore.md:21-33; the search filter's "It
// lasts until you change it, on this device only") over the one sealed store
// every device value rides — so Settings' erase takes it with the rest
// (EraseConfirm.md:21) and nothing here ever reaches the wire. Each account's
// list and filter sit under their own names, a guest's under `guest`.

package com.cogra.network.store

import com.cogra.domain.feed.FeedKind
import com.cogra.domain.search.ExploreDeviceStore
import com.cogra.domain.search.RECENTS_KEPT
import com.cogra.domain.search.SearchFilter
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.withRecent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExploreDeviceStoreImpl @Inject constructor(
    private val store: EncryptedStore,
) : ExploreDeviceStore {

    override fun recents(account: String?): Flow<List<String>> =
        store.watch(recentsName(account)).map { decodeRecents(it) }.distinctUntilChanged()

    // One read-modify-write, so two quick writes never drop each other's query.
    override suspend fun rememberSearch(account: String?, query: String) {
        if (query.isBlank()) return
        val name = recentsName(account)
        store.edit {
            val next = withRecent(decodeRecents(get(name)), query)
            put(name, Json.encodeToString(next).encodeToByteArray())
        }
    }

    override suspend fun forgetRecents(account: String?) {
        store.remove(recentsName(account))
    }

    override suspend fun committedFilter(account: String?): SearchFilter? {
        val bytes = store.get(filterName(account)) ?: return null
        val stored = try {
            Json.decodeFromString<StoredFilter>(bytes.decodeToString())
        } catch (_: SerializationException) {
            return null
        } catch (_: IllegalArgumentException) {
            return null
        }
        return SearchFilter(
            kinds = stored.kinds.mapNotNull { name -> FeedKind.entries.firstOrNull { it.name == name } }.toSet(),
            order = SearchOrder.entries.firstOrNull { it.name == stored.order } ?: return null,
            seen = stored.seen,
        )
    }

    override suspend fun commitFilter(account: String?, filter: SearchFilter) {
        val stored = StoredFilter(filter.kinds.map { it.name }, filter.order.name, filter.seen)
        store.put(filterName(account), Json.encodeToString(stored).encodeToByteArray())
    }

    /** A damaged entry reads as no recents rather than as a fault: recents are a comfort. */
    private fun decodeRecents(bytes: ByteArray?): List<String> {
        if (bytes == null) return emptyList()
        return try {
            Json.decodeFromString<List<String>>(bytes.decodeToString()).take(RECENTS_KEPT)
        } catch (_: SerializationException) {
            emptyList()
        } catch (_: IllegalArgumentException) {
            emptyList()
        }
    }

    @Serializable
    private data class StoredFilter(val kinds: List<String>, val order: String, val seen: Boolean)

    private companion object {
        const val GUEST = "guest"

        fun recentsName(account: String?) = "explore_recents:${account ?: GUEST}"

        fun filterName(account: String?) = "explore_filter:${account ?: GUEST}"
    }
}
