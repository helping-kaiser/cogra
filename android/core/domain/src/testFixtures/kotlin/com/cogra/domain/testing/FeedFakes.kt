package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.feed.CommittedFilterStore
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRepository
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.FeedTopicsRepository
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.RankedEntry
import com.cogra.domain.feed.ReaderDefaultStore
import com.cogra.domain.feed.SettlingRow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * The ranked feed over a scriptable pod: [answer] is what every
 * `feedRanking` returns until a test changes it, and [window] hydrates
 * from [posts] — an id with no post there is skipped, as the server skips
 * an expired pending write. Every call is recorded.
 */
open class ScriptedFeedRepository : FeedRepository {
    var answer: Outcome<FeedRanking?> = Outcome.Success(FeedRanking.EMPTY)

    /** The posts a window hydrates, by id. */
    val posts = mutableMapOf<String, PostView>()

    /** Every ranking asked for: the viewer and the arguments. */
    val rankings = mutableListOf<Pair<String, FeedRankArgs>>()

    /** Every window asked for, in call order. */
    val windows = mutableListOf<List<String>>()

    /** When set, every window answers this instead. */
    var windowAnswer: Outcome<List<PostView>>? = null

    /** The other kinds' cards a `FeedCards` read hydrates, by id. */
    val cardsById = mutableMapOf<String, FeedCard>()

    /** Every `FeedCards` read asked for, in call order. */
    val cardReads = mutableListOf<List<String>>()

    override suspend fun ranking(viewer: String, args: FeedRankArgs): Outcome<FeedRanking?> {
        rankings += viewer to args
        return answer
    }

    override suspend fun window(ids: List<String>): Outcome<List<PostView>> {
        windows += ids
        windowAnswer?.let { return it }
        return Outcome.Success(ids.mapNotNull { posts[it] ?: defaultPost(it) })
    }

    override suspend fun cards(ids: List<String>): Outcome<List<FeedCard>> {
        cardReads += ids
        return Outcome.Success(ids.mapNotNull { cardsById[it] })
    }

    /** What an id hydrates to when [posts] names nothing for it; a plain post by default. */
    protected open fun defaultPost(id: String): PostView? = testPost(id)
}

/** A landed entry for a scripted answer: ranked by its place, NEWEST by [newestIndex]. */
fun entry(
    id: String,
    newestIndex: Int,
    score: Double = 1.0,
    mark: PeopleMark? = null,
    kind: FeedKind = FeedKind.POST,
): RankedEntry = RankedEntry(id, kind, score, mark, newestIndex)

/** A settling row for a scripted answer, at its two woven positions. */
fun settling(
    id: String,
    ranked: Int,
    newest: Int,
    mark: PeopleMark? = null,
    kind: FeedKind = FeedKind.POST,
): SettlingRow = SettlingRow(id, kind, mark, ranked, newest)

/** An answer of landed entries only, whose NEWEST order is their ranked order reversed. */
fun rankingOf(vararg ids: String, asOfEpoch: Int = 7): FeedRanking = rankingOf(ids.asList(), asOfEpoch)

/** As the vararg form, for an answer built from a list. */
fun rankingOf(ids: List<String>, asOfEpoch: Int = 7): FeedRanking = FeedRanking(
    asOfEpoch = asOfEpoch,
    entries = ids.mapIndexed { i, id -> entry(id, newestIndex = ids.size - 1 - i) },
    settling = emptyList(),
)

/** The reader defaults on this device, in memory: one value per account. */
class InMemoryReaderDefaultStore : ReaderDefaultStore {
    val saved = MutableStateFlow<Map<String, FeedFilter>>(emptyMap())

    override fun watch(account: String): Flow<FeedFilter?> = saved.map { it[account] }

    override suspend fun save(account: String, filter: FeedFilter) {
        saved.update { it + (account to filter) }
    }
}

/** The held-for topics, scripted; every read is counted. */
class ScriptedFeedTopics : FeedTopicsRepository {
    var answer: Outcome<List<FeedTopic>> = Outcome.Success(emptyList())
    var reads = 0

    override suspend fun heldFor(): Outcome<List<FeedTopic>> {
        reads += 1
        return answer
    }
}

/** The committed feed filters on this device, in memory: one per account, the guest's under null. */
class InMemoryCommittedFilterStore : CommittedFilterStore {
    val stored = mutableMapOf<String?, FeedFilter>()

    override suspend fun committed(account: String?): FeedFilter? = stored[account]

    override suspend fun commit(account: String?, filter: FeedFilter) {
        stored[account] = filter
    }

    override suspend fun forget(account: String?) {
        stored.remove(account)
    }
}
