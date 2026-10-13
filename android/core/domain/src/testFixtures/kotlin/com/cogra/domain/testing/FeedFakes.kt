package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRepository
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.RankedEntry
import com.cogra.domain.feed.SettlingRow

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

    override suspend fun ranking(viewer: String, args: FeedRankArgs): Outcome<FeedRanking?> {
        rankings += viewer to args
        return answer
    }

    override suspend fun window(ids: List<String>): Outcome<List<PostView>> {
        windows += ids
        windowAnswer?.let { return it }
        return Outcome.Success(ids.mapNotNull { posts[it] ?: defaultPost(it) })
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
