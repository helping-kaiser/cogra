// The ranked feed's client side (ranked-feed-api packet §4.1, §4.12): one
// `feedRanking` answer held as the frozen order, and everything the device
// derives from it. The device CUTS and PLACES by what the pod emitted —
// its order, its two permutations and its per-row marks — and never scores
// or compares (PR-9/PR-10: no ranking runs on the client).

package com.cogra.domain.feed

import com.cogra.domain.Outcome
import com.cogra.domain.PostView

/** The kinds the feed ranks (FeedSheet's Kinds axis; `FeedRankFilter.kinds`). */
enum class FeedKind {
    POST,
    COMMENT,

    /** A person's profile — `NodeKind.USER` on the wire. */
    PROFILE,

    /** A topic — `NodeKind.HASHTAG` on the wire. */
    TAG,
}

/**
 * How the vantage holds the person behind a row (OS-18 S1): the sign of
 * the folded p̄_d of its own Opinion → Profile bundle toward them. A row
 * with no mark is a person held at (0, 0), or none, or a Tags row.
 */
enum class PeopleMark {
    FOR,
    AGAINST,

    /** Held, with no direction: p̄_d = 0, p̄_i ≠ 0. */
    SIGNLESS,
}

/** One landed target, in the pod's RANKED order by its place in [FeedRanking.entries]. */
data class RankedEntry(
    val targetId: String,
    val kind: FeedKind,
    /** S(u, target), the pod's figure; the device never orders by it. */
    val score: Double,
    val mark: PeopleMark?,
    /** This entry's 0-based place among the entries in NEWEST order. */
    val newestIndex: Int,
)

/** One settling row: unscored, placed by the pod in both woven orders. */
data class SettlingRow(
    val targetId: String,
    val kind: FeedKind,
    val mark: PeopleMark?,
    /** Its 0-based place in the woven RANKED list (entries and settling together). */
    val rankedPosition: Int,
    /** Its 0-based place in the woven NEWEST list. */
    val newestPosition: Int,
)

/**
 * One ranking snapshot, held uncut: the frozen order every derive reads,
 * and the off-feed lookup source (CD-9) — the device's cuts shrink what is
 * shown, never this.
 */
data class FeedRanking(
    val asOfEpoch: Int,
    val entries: List<RankedEntry>,
    val settling: List<SettlingRow>,
) {
    companion object {
        /** The answer to a fetch that ranks nothing (every kind off; no rankable viewer). */
        val EMPTY = FeedRanking(asOfEpoch = -1, entries = emptyList(), settling = emptyList())
    }
}

/** What the ranker is asked: the sheet's two pod-side axes, nothing else (§4.1). */
data class FeedRankArgs(
    val kinds: Set<FeedKind>,
    /** A Hashtag id, or null for no topic. */
    val topic: String?,
)

/** The feed's ranking and hydration over the contract. */
interface FeedRepository {
    /**
     * `feedRanking(viewer, filter: {kinds, topic})` at the newest epoch.
     * Success(null) when [viewer] resolves to no rankable actor. Rows of a
     * kind this build cannot name are dropped, never a crash.
     */
    suspend fun ranking(viewer: String, args: FeedRankArgs): Outcome<FeedRanking?>

    /**
     * `feed(orderedIds)`: the posts behind [ids], in the order given — at
     * most [MAX_FEED_WINDOW] ids. An id that hydrates to nothing (a pending
     * write that expired) or to a kind this surface does not render is
     * skipped.
     */
    suspend fun window(ids: List<String>): Outcome<List<PostView>>
}

/** The most ids one `feed` hydration carries (the page budget, CD-2). */
const val MAX_FEED_WINDOW = 100
