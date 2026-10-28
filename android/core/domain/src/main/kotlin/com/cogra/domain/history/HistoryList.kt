// HISTORY'S LIST LAWS, as plain functions (History.md, HistoryFilter.md,
// HistorySearch.md): the kinds the filter narrows to and the state its
// trigger reads, the day dividers, and how a narrowed read stands in
// sections. No Compose in it, so each law is tested as a function. web's
// twin is `web/src/lib/history/history-list.ts`.

package com.cogra.domain.history

import com.cogra.domain.feed.FeedKind
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

/**
 * THE HISTORY'S FILTER KINDS ARE THE FEED FILTER'S OWN LIST, in its order
 * (HistoryFilter.md:5; `FeedFilter.jsx` `FEED_KINDS`): Posts, Comments,
 * Profiles, Tags.
 */
val HISTORY_KINDS: List<FeedKind> = listOf(FeedKind.POST, FeedKind.COMMENT, FeedKind.PROFILE, FeedKind.TAG)

/** What the filter trigger reads, before it is put in words (copy-voice, *The filter pill's state words*). */
sealed interface KindsReading {
    /** No kind narrowed — `Everything` (History.md:105). */
    data object Everything : KindsReading

    /** One kind narrowed — its own name. */
    data class One(val kind: FeedKind) : KindsReading

    /** Some kinds narrowed — `2 kinds`. */
    data class Some(val count: Int) : KindsReading

    /** Every kind chip on — `All kinds`. */
    data object All : KindsReading
}

/**
 * The trigger's reading (History.md:105; HistoryFilter.md:31): `Everything`
 * at the default, else the narrowed kinds in the filter pill's state words.
 * The order of the chips never changes the words.
 */
fun kindsReading(kinds: Set<FeedKind>): KindsReading {
    val narrowed = kinds.filter { it in HISTORY_KINDS }
    return when {
        narrowed.isEmpty() -> KindsReading.Everything
        narrowed.size == 1 -> KindsReading.One(narrowed.single())
        narrowed.size == HISTORY_KINDS.size -> KindsReading.All
        else -> KindsReading.Some(narrowed.size)
    }
}

/** The words of `Today` and `Yesterday` (History.md:25; copy-voice *Ages*, History's exception). */
private const val TODAY = "Today"
private const val YESTERDAY = "Yesterday"

/**
 * THE DAY DIVIDER'S WORDS (History.md:25): `Today`, `Yesterday`, then the
 * dateline's date — `2 October`, the year added only when it is not the
 * current one. Days are the reader's own, in [zone]. The words are English,
 * as every age word is (`ageLadder`).
 */
fun historyDayLabel(at: Instant, now: Instant, zone: ZoneId = ZoneId.systemDefault()): String {
    val day = at.atZone(zone).toLocalDate()
    val today = now.atZone(zone).toLocalDate()
    return when (day) {
        today -> TODAY
        today.minusDays(1) -> YESTERDAY
        else -> dateWords(day, today)
    }
}

private fun dateWords(day: LocalDate, today: LocalDate): String {
    val date = "${day.dayOfMonth} ${day.month.getDisplayName(TextStyle.FULL, Locale.ENGLISH)}"
    return if (day.year == today.year) date else "$date ${day.year}"
}

/** The divider's registered key (nodes.json `history.day`): its words lowercased, other runs one `-`. */
fun historyDayKey(label: String): String = label.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "-").trim('-')

/**
 * A divider above the first thing first seen on each day (History.md:25);
 * null between two of one day. One entry per seeing, in the list's order.
 */
fun historyDividers(seenAt: List<Instant>, now: Instant, zone: ZoneId = ZoneId.systemDefault()): List<String?> {
    var last: String? = null
    return seenAt.map { at ->
        val label = historyDayLabel(at, now, zone)
        if (label == last) {
            null
        } else {
            last = label
            label
        }
    }
}

/** Which section of a narrowed History a thing stands in (HistorySearch.md:3-23). */
enum class HistorySection { PEOPLE, TAGS, CONTENT }

fun HistoryCard.section(): HistorySection = when (this) {
    is HistoryCard.Person -> HistorySection.PEOPLE
    is HistoryCard.Tag -> HistorySection.TAGS
    is HistoryCard.Post, is HistoryCard.Comment -> HistorySection.CONTENT
}

/**
 * What a fresh read stands, by the device's hidden set (History.md:41;
 * HistoryHidden.md:7): a hidden account's posts and comments leave; their
 * own profile card and every topic stay. [hides] answers for an author and
 * the card the hide was made from — a card whose hide or Undo did not go
 * through stands, carrying its line (HistoryHidden.md:11).
 */
fun List<HistoryEntry>.unhidden(hides: (author: String?, origin: String) -> Boolean): List<HistoryEntry> =
    filterNot { entry -> hides(entry.card.authorId, entry.id) }

/** The search a typed query sends: trimmed, and null when it narrows nothing. */
fun historyNarrowing(query: String): String? = query.trim().ifEmpty { null }
