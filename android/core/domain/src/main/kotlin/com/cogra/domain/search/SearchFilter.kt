// THE SEARCH FILTER'S VALUE, and how the trigger reads it back
// (ExploreFilter.md; ExploreFilter.jsx; FeedFilter.jsx `FEED_KINDS`,
// OrderSection.jsx). web's twin is `web/src/lib/search/search-filter.ts`.
//
// THE KINDS ARE THE FEED FILTER'S OWN LIST (ExploreFilter.md:3) — Posts,
// Comments, Profiles, Tags — but their SEMANTICS ARE SEARCH'S: no chip on
// means every kind (:7), where the feed's empty set means nothing.
//
// THE ORDER AND THE SEEN TOGGLE ARE THE READER'S DEFAULT (:11-15, the one
// default object): set in Settings, the app's until the reader sets their own.
// Settings draws no Reading editor yet, so the reader's default IS the app's —
// Ranked, seen off — and [READER_SEARCH_DEFAULT] says so in one place.

package com.cogra.domain.search

import com.cogra.domain.feed.FeedKind

/** The search filter: what the search shows. */
data class SearchFilter(
    /** The kinds on; none on reads every kind. */
    val kinds: Set<FeedKind> = emptySet(),
    val order: SearchOrder = SearchOrder.RANKED,
    /** `Show what you've already seen`. */
    val seen: Boolean = false,
) {
    /** A kind chip's tap: on joins, off leaves. */
    fun toggle(kind: FeedKind): SearchFilter = copy(kinds = if (kind in kinds) kinds - kind else kinds + kind)

    /** Profiles alone (ExplorePerson.md:15): only the people stand, uncapped, uncaptioned. */
    val profilesAlone: Boolean get() = kinds == setOf(FeedKind.PROFILE)
}

/** The kinds in the list's own order (`FEED_KINDS`). */
val SEARCH_KINDS: List<FeedKind> = listOf(FeedKind.POST, FeedKind.COMMENT, FeedKind.PROFILE, FeedKind.TAG)

/** CoGra's own default for search's shared axes (ExploreFilter.md:15): Ranked, seen off. */
val READER_SEARCH_DEFAULT: SearchFilter = SearchFilter()

/**
 * A GUEST'S SEARCH (ExploreSearch.md:65; ExploreFilter.md:41): newest first,
 * no rank, no seen toggle — no viewpoint to rank from, no seen-list to keep
 * out. Only the kinds are the guest's to choose.
 */
fun guestSearchFilter(kinds: Set<FeedKind> = emptySet()): SearchFilter =
    SearchFilter(kinds = kinds, order = SearchOrder.NEWEST, seen = true)

/** The trigger's head: what the kinds read as. */
sealed interface KindsHead {
    /** None on — search's word for nothing narrowed. */
    data object Everything : KindsHead

    /** All four on. */
    data object All : KindsHead

    data class One(val kind: FeedKind) : KindsHead

    data class Some(val count: Int) : KindsHead
}

/**
 * The trigger's reading (ExploreFilter.md:17; ExploreSearch.md:17;
 * ExploreUnscoped.md:9): the kinds' head, then only the deviations from the
 * reader's default — [order] when the order differs (a deviation back toward
 * the app's default included), [seen] when the toggle does.
 */
data class SearchFilterReading(val head: KindsHead, val order: SearchOrder?, val seen: Boolean?)

fun SearchFilter.reading(against: SearchFilter): SearchFilterReading = SearchFilterReading(
    head = when (kinds.size) {
        0 -> KindsHead.Everything
        1 -> KindsHead.One(kinds.single())
        SEARCH_KINDS.size -> KindsHead.All
        else -> KindsHead.Some(kinds.size)
    },
    order = order.takeIf { it != against.order },
    seen = seen.takeIf { it != against.seen },
)
