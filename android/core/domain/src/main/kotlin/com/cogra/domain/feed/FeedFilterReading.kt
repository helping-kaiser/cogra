// THE TRIGGER'S READING (FeedFilter.jsx `feedFilterSummary`; copy-voice *The
// filter pill's state words*; FeedNarrowed.md, FeedTopic.md, FeedFar.md,
// FeedNothing.md, FeedSheet.md:65-73). web's twin is
// `web/src/lib/feed/feed-filter.ts`.
//
// The words are the master's own, so they live beside the filter they read
// rather than in one screen's resources: the feed's band trigger, the polite
// status a Done leaves and Settings' What your feed shows row all speak them,
// and they must never say different things.

package com.cogra.domain.feed

/** A kind's chip word (`FEED_KINDS`): `topics` keys the kind the graph carries, `Tags` is the reader's word. */
val FeedKind.label: String
    get() = when (this) {
        FeedKind.POST -> "Posts"
        FeedKind.COMMENT -> "Comments"
        FeedKind.PROFILE -> "Profiles"
        FeedKind.TAG -> "Tags"
    }

/** A form's chip word (`FEED_FORMS`). */
val FeedForm.label: String
    get() = when (this) {
        FeedForm.TEXT -> "Text"
        FeedForm.PHOTOS -> "Photos"
        FeedForm.VIDEO -> "Video"
    }

/** An order's word (`FILTER_ORDER`). */
val FeedOrder.label: String
    get() = when (this) {
        FeedOrder.RANKED -> "Ranked"
        FeedOrder.NEWEST -> "Newest"
    }

/** A sign's word (`FEED_PEOPLE_SIGN`). */
val PeopleSign.label: String
    get() = when (this) {
        PeopleSign.FOR -> "For"
        PeopleSign.AGAINST -> "Against"
        PeopleSign.EITHER -> "Either"
    }

/** The kinds in the sheet's order — the kinds V1.0 serves (FeedSheet.md:3). */
val FEED_KINDS: List<FeedKind> = listOf(FeedKind.POST, FeedKind.COMMENT, FeedKind.PROFILE, FeedKind.TAG)

/** What the `CograBand` leaves the pill's words (FeedFilter.jsx `BAND_CEILING_PX`). */
const val BAND_CEILING_PX = 154.0

// THE TRIGGER'S TYPE, MEASURED (FeedFilter.jsx `measureTriggerText`). What
// overflows the band is a width, so the summary measures itself in the type
// it renders in: Figtree's per-character advances at the wght=500 instance
// label-large paints at, in font units — the master's own table, copied
// character for character (its pipeline re-derives it from the font). The
// app sets the same face at the same 14 units, so the master's px are this
// trigger's dp at the default font scale; a larger scale ellipsizes the pill
// rather than re-wording it, as the master's `maxWidth` does.

private const val TRIGGER_FONT_SIZE = 14.0
private const val TRIGGER_UNITS_PER_EM = 1000.0
private const val TRIGGER_LETTER_SPACING = 0.1
private const val TRIGGER_ALPHABET =
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·"

private const val TRIGGER_ADVANCE_TABLE =
        "244.27 301.75 345.07 629.43 560.98 793.06 644.58 212.1 360.07 360.07 " +
        "482.59 625.73 234.64 414.27 218.95 400.67 642.87 415.73 564.19 547.03 " +
        "624.31 576.3 569.46 542.33 613.57 569.46 266.11 271.39 625.73 625.73 " +
        "625.73 506.31 989.72 686.94 611.15 721.87 691.03 590.99 546.17 755.53 " +
        "750.85 275.75 524.94 625.27 524.47 848.74 773.71 779.17 585.77 782.02 " +
        "630.9 612.13 561.22 706.42 700.78 966.63 632.0 616.1 638.27 329.19 " +
        "400.67 329.19 559.07 437.13 232.81 516.29 588.59 542.15 588.31 548.26 " +
        "375.77 591.17 561.45 240.07 274.62 499.69 227.2 856.76 560.88 580.15 " +
        "593.59 581.46 349.24 466.0 384.34 560.88 530.08 798.12 492.14 539.97 " +
        "487.54 387.73 257.14 387.73 594.94 256.01"

/** The table, one advance per [TRIGGER_ALPHABET] character, in its order. */
private val TRIGGER_ADVANCES: List<Double> = TRIGGER_ADVANCE_TABLE.split(' ').map(String::toDouble)

private val TRIGGER_WIDEST = TRIGGER_ADVANCES.max()

/**
 * The words' width at the trigger's type. A character the table does not
 * carry measures as its widest one: an unfamiliar glyph collapses the summary
 * a word early, never overflows the band.
 */
fun measureTriggerText(text: String): Double {
    var units = 0.0
    var characters = 0
    var at = 0
    while (at < text.length) {
        val point = text.codePointAt(at)
        val index = if (Character.charCount(point) == 1) TRIGGER_ALPHABET.indexOf(point.toChar()) else -1
        units += if (index >= 0) TRIGGER_ADVANCES[index] else TRIGGER_WIDEST
        characters += 1
        at += Character.charCount(point)
    }
    return units / TRIGGER_UNITS_PER_EM * TRIGGER_FONT_SIZE + characters * TRIGGER_LETTER_SPACING
}

/** The trigger's word for the one default-on chip switched off (FeedNarrowed.md:9). */
private const val SETTLED_ONLY = "settled only"

/**
 * Whose people the people extra names: the reader's own (`your people`), or
 * the borrowed view's account's (`@mira's people`, FeedSheet.md "GIVEN the
 * feed borrows a view").
 */
fun peopleWord(borrowedHandle: String?): String =
    if (borrowedHandle == null) "your people" else "@$borrowedHandle's people"

/**
 * THE TRIGGER'S READING. The head is the kinds, always: one kind's name,
 * `2 kinds`, `All kinds`, `Nothing`. Every other axis speaks only where it
 * departs from [against] — THE READER'S DEFAULT (CD-6), never the app's
 * constant — and speaks its STATE, never the direction, so a departure back
 * toward the app's default reads like any other: the topic first, then the
 * people, the forms, the order, the seen toggle, and the also-group. Spelled
 * while they fit the band's [budget]; past it, the extras collapse to a count
 * after the head, which never collapses (`Posts · 3 changes`).
 */
fun feedFilterSummary(
    value: FeedFilter,
    against: FeedFilter = FeedFilter.DEFAULT,
    borrowedHandle: String? = null,
    budget: Double = BAND_CEILING_PX,
): String {
    val kinds = FEED_KINDS.filter { it in value.kinds }
    val head = when (kinds.size) {
        0 -> "Nothing"
        1 -> kinds.single().label
        FEED_KINDS.size -> "All kinds"
        else -> "${kinds.size} kinds"
    }
    val extras = buildList {
        // The topic leads the extras (FeedTopic.md:3), by the tag's own name.
        value.topic?.let { add("#${it.name}") }
        addAll(peopleExtras(value, against, borrowedHandle))
        formsExtra(value, against)?.let { add(it) }
        if (value.order != against.order) add(value.order.label.lowercase())
        if (value.showSeen != against.showSeen) add(if (value.showSeen) "showing seen" else "hiding seen")
        addAll(alsoExtras(value, against))
    }
    if (extras.isEmpty()) return head
    val spelled = (listOf(head) + extras).joinToString(" · ")
    if (measureTriggerText(spelled) <= budget) return spelled
    return "$head · ${extras.size} ${if (extras.size == 1) "change" else "changes"}"
}

/**
 * The forms: the forms it holds, `text + photos`; every form, `all forms`.
 * Every form off has no word in the master's table — the head's kinds already
 * say what the feed admits.
 */
private fun formsExtra(value: FeedFilter, against: FeedFilter): String? = when {
    value.forms.isEmpty() || value.forms == against.forms -> null
    value.forms.size == FeedForm.entries.size -> "all forms"
    else -> FeedForm.entries.filter { it in value.forms }.joinToString(" + ") { it.label.lowercase() }
}

/**
 * The people: a state departs when the row or, under Your people, the sign
 * does. Either adds nothing to the word (FeedSheet.md:71); a departure back
 * to Everyone from a Your-people default reads `everyone`, the axis's state.
 */
private fun peopleExtras(value: FeedFilter, against: FeedFilter, borrowedHandle: String?): List<String> {
    val departs = value.people != against.people ||
        (value.people == PeopleScope.YOUR_PEOPLE && value.peopleSign != against.peopleSign)
    if (!departs) return emptyList()
    return when (value.people) {
        PeopleScope.EVERYONE -> listOf("everyone")
        PeopleScope.YOUR_PEOPLE -> {
            val word = peopleWord(borrowedHandle)
            listOf(if (value.peopleSign == PeopleSign.EITHER) word else "$word, ${value.peopleSign.label.lowercase()}")
        }
    }
}

/**
 * The also-group (`FEED_ALSO`, in its order: Sensitive, Removed, Still
 * settling): a chip on past [against] joins the `+` list; Sensitive or Removed
 * off under a default that admits it reads `hiding …`; Still settling off,
 * `settled only`.
 */
private fun alsoExtras(value: FeedFilter, against: FeedFilter): List<String> = buildList {
    val added = listOfNotNull(
        "sensitive".takeIf { value.showSensitive && !against.showSensitive },
        "removed".takeIf { value.showRemoved && !against.showRemoved },
        "still settling".takeIf { value.stillSettling && !against.stillSettling },
    )
    if (added.isNotEmpty()) add("+ ${added.joinToString(", ")}")
    if (against.showSensitive && !value.showSensitive) add("hiding sensitive")
    if (against.showRemoved && !value.showRemoved) add("hiding removed")
    if (against.stillSettling && !value.stillSettling) add(SETTLED_ONLY)
}
