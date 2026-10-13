// The device derive (ranked-feed-api §4.12; CD-1, CD-7, CD-8, CD-10, CD-11):
// compose both woven lists from the held answer by the pod's indices, pick
// the sheet's order, then cut. Cutting deletes and never re-orders, so the
// cuts commute with each other and with the weave (§4.10 W-2).

package com.cogra.domain.feed

import com.cogra.domain.CograLog

/** The sheet's Order axis. Both orders are the pod's; the device only applies them (CD-7). */
enum class FeedOrder {
    RANKED,
    NEWEST,
}

/** The sheet's People axis (FeedSheet.md:13-27). */
enum class PeopleScope {
    EVERYONE,
    YOUR_PEOPLE,
}

/** The sign row under Your people (FeedSheet.md:19-23). */
enum class PeopleSign {
    FOR,
    AGAINST,
    EITHER,
}

/**
 * The feed filter's axes this client applies (FeedSheet.md:5-51; defaults
 * `FEED_FILTER_DEFAULT`, FeedFilter.jsx:96). [kinds] and [topic] are the
 * ranker's arguments; every other axis is a device cut over the held answer.
 */
data class FeedFilter(
    val kinds: Set<FeedKind> = setOf(FeedKind.POST),
    val topic: String? = null,
    val order: FeedOrder = FeedOrder.RANKED,
    val people: PeopleScope = PeopleScope.EVERYONE,
    /** Kept while Everyone is on, for Your people's return (FeedSheet.md:27) — client state, never sent. */
    val peopleSign: PeopleSign = PeopleSign.EITHER,
    /** Show what you've already seen: off cuts the device's seen record. */
    val showSeen: Boolean = false,
    /** Also show: Still settling — on by default, final (PR-35). */
    val stillSettling: Boolean = true,
) {
    val rankArgs: FeedRankArgs get() = FeedRankArgs(kinds, topic)
}

/** What a Done does with the staged filter (CD-1). */
enum class FilterChange {
    /** Nothing changed: no call, no derive (FeedSheet.md:83). */
    NONE,

    /** Only device-side axes changed: a local re-derive — no call, no new pin. */
    DERIVE,

    /** Kinds or topic changed (alone or mixed): one `feedRanking`, then the derive. */
    FETCH,
}

/** How [staged] differs from the filter in force, [this]. */
fun FeedFilter.changeTo(staged: FeedFilter): FilterChange = when {
    staged == this -> FilterChange.NONE
    staged.rankArgs != rankArgs -> FilterChange.FETCH
    else -> FilterChange.DERIVE
}

/** One row of a woven list. A settling row carries no score: its slot stays bare. */
data class FeedRow(
    val targetId: String,
    val kind: FeedKind,
    val mark: PeopleMark?,
    /** The pod's figure for a landed row; null for a settling row (FeedSheet.md:49). */
    val score: Double?,
) {
    val settling: Boolean get() = score == null
}

/**
 * The woven list for [order]: each settling row at the position the pod
 * gave it for that order, and the landed entries filling the remaining
 * slots — in their array order under RANKED, in `newestIndex` order under
 * NEWEST. Placement by the pod's indices: no key is read, nothing is
 * compared (CD-7, CD-8).
 *
 * The relay refuses an answer whose indices are not permutations (§4.2
 * step 5), so a malformed one never arrives; were it to, this degrades
 * rather than crashes — a colliding or out-of-range settling row is
 * dropped, and a broken `newestIndex` set falls back to the array order —
 * and says so in the debug log.
 */
fun FeedRanking.woven(order: FeedOrder): List<FeedRow> {
    val landed = when (order) {
        FeedOrder.RANKED -> entries
        FeedOrder.NEWEST -> newestOrder()
    }
    val size = entries.size + settling.size
    val slots = arrayOfNulls<FeedRow>(size)
    for (row in settling) {
        val at = when (order) {
            FeedOrder.RANKED -> row.rankedPosition
            FeedOrder.NEWEST -> row.newestPosition
        }
        if (at !in 0 until size || slots[at] != null) {
            CograLog.w(TAG) { "settling ${row.targetId} has no free slot $at under $order; dropped" }
            continue
        }
        slots[at] = FeedRow(row.targetId, row.kind, row.mark, score = null)
    }
    val fill = landed.iterator()
    for (i in slots.indices) {
        if (slots[i] == null && fill.hasNext()) {
            val entry = fill.next()
            slots[i] = FeedRow(entry.targetId, entry.kind, entry.mark, entry.score)
        }
    }
    // A dropped settling row leaves its slot to the landed rows; any landed
    // row still unplaced (only possible on a malformed answer) goes last.
    return slots.filterNotNull() + fill.asSequence().map { FeedRow(it.targetId, it.kind, it.mark, it.score) }
}

/** The entries in the pod's NEWEST permutation, or in array order if it is not one. */
private fun FeedRanking.newestOrder(): List<RankedEntry> {
    val placed = arrayOfNulls<RankedEntry>(entries.size)
    for (entry in entries) {
        val at = entry.newestIndex
        if (at !in placed.indices || placed[at] != null) {
            CograLog.w(TAG) { "newestIndex is not a permutation; the ranked order stands in" }
            return entries
        }
        placed[at] = entry
    }
    return placed.filterNotNull()
}

/** Whether the People axis admits a row of this mark (CD-11; OS-18 S1, PR-44). */
fun FeedFilter.admitsMark(mark: PeopleMark?): Boolean = when (people) {
    PeopleScope.EVERYONE -> true
    PeopleScope.YOUR_PEOPLE -> when (peopleSign) {
        PeopleSign.FOR -> mark == PeopleMark.FOR
        PeopleSign.AGAINST -> mark == PeopleMark.AGAINST
        PeopleSign.EITHER -> mark != null
    }
}

/** Whether the device-side cuts keep [row]: Still settling, seen, people (§4.12 step 3). */
fun FeedFilter.keeps(row: FeedRow, seen: Set<String>): Boolean =
    (stillSettling || !row.settling) &&
        (showSeen || row.targetId !in seen) &&
        admitsMark(row.mark)

/**
 * THE DERIVE: the held answer composed in the filter's order, then cut by
 * the device-side axes against [seen] — the device's seen record as it
 * stands at THIS derive (CD-10). The result is frozen until the next
 * derive: rows seen while it is on screen stay (W-6).
 */
fun FeedRanking.derive(filter: FeedFilter, seen: Set<String>): List<FeedRow> =
    woven(filter.order).filter { filter.keeps(it, seen) }

private const val TAG = "FeedDerive"
