package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.search.ExploreDeviceStore
import com.cogra.domain.search.SearchAsk
import com.cogra.domain.search.SearchFilter
import com.cogra.domain.search.SearchPage
import com.cogra.domain.search.SearchRepository
import com.cogra.domain.search.withRecent
import com.cogra.domain.topics.HeldTopic
import com.cogra.domain.topics.HeldTopicsPage
import com.cogra.domain.topics.HeldTopicsRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map

/** One search read: what was asked and the cursor it asked after. */
data class SearchRead(val ask: SearchAsk, val after: String?)

/**
 * The search, scripted: every read is recorded in call order and answered by
 * [respond] — an empty last page unless a test says otherwise. A test that
 * needs a slow or out-of-order answer suspends inside [respond].
 */
class ScriptedSearchRepository : SearchRepository {
    val reads = mutableListOf<SearchRead>()

    var respond: suspend (SearchAsk, String?) -> Outcome<SearchPage> = { _, _ -> Outcome.Success(EMPTY_SEARCH) }

    override suspend fun searchPage(ask: SearchAsk, after: String?): Outcome<SearchPage> {
        reads += SearchRead(ask, after)
        return respond(ask, after)
    }

    companion object {
        val EMPTY_SEARCH = SearchPage(emptyList(), endCursor = null, hasNextPage = false, hasMorePeople = false)
    }
}

/** The held set, scripted: no topics held unless a test seeds [topics]. */
class ScriptedHeldTopicsRepository : HeldTopicsRepository {
    var topics: List<HeldTopic> = emptyList()

    /** A failure the next reads answer with, or null to answer [topics]. */
    var failure: Outcome.Failed? = null

    var countReads = 0

    override suspend fun heldCount(): Outcome<Int?> {
        countReads += 1
        return failure ?: Outcome.Success(topics.size)
    }

    override suspend fun heldPage(after: String?): Outcome<HeldTopicsPage?> =
        failure ?: Outcome.Success(HeldTopicsPage(topics, endCursor = null, hasNextPage = false))
}

/** Explore's device memory, in memory; null keys are the guest's. */
class FakeExploreDeviceStore : ExploreDeviceStore {
    private val lists = MutableStateFlow<Map<String?, List<String>>>(emptyMap())
    val filters = mutableMapOf<String?, SearchFilter>()

    override fun recents(account: String?): Flow<List<String>> = lists.map { it[account].orEmpty() }

    override suspend fun rememberSearch(account: String?, query: String) {
        lists.value = lists.value + (account to withRecent(lists.value[account].orEmpty(), query))
    }

    override suspend fun forgetRecents(account: String?) {
        lists.value = lists.value - account
    }

    /** [account]'s list as it stands. */
    fun recentsNow(account: String?): List<String> = lists.value[account].orEmpty()

    override suspend fun committedFilter(account: String?): SearchFilter? = filters[account]

    override suspend fun commitFilter(account: String?, filter: SearchFilter) {
        filters[account] = filter
    }
}
