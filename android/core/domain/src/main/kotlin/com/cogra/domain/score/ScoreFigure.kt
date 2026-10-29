// THE FEED SCORE AS IT IS WRITTEN (copy-voice, *The score drill-down*;
// design/readme.md §13, "The Feed score"; ExplainableNumber.prompt.md). The
// web's twin is `web/src/lib/score/figure.ts`.
//
// - Two decimals, uncapped, never normalised: the ranker's own figure.
// - A card keeps its PLAIN figure — `15.20` — and a negative keeps its `−`
//   everywhere, a zero none. The sign appears only on the trace's flag and its
//   paths: `+15.20`.
// - THE DASH IS NO COMPUTED FIGURE (FeedKinds.md:15; FeedEntryMoved.md:5):
//   never `0.00`, which is severance's alone.
//
// THE ARITHMETIC CLOSES ON THE DRAWN SURFACE (FeedEntry.md:15; the packet's
// SR-G8 reading). Rounding each path on its own lets the drawn rows miss the
// flag by a cent, so the displayed parts are apportioned by largest
// remainder: each stays within a cent of its exact value and they sum to the
// displayed flag. This renders the ranker's numbers; it never computes one.

package com.cogra.domain.score

import kotlin.math.abs
import kotlin.math.floor

/** The minus the house writes (copy-voice: "a negative keeping its `−`"), U+2212. */
private const val MINUS = "−"

/** The figure that is not computed (FeedEntryMoved.md:5). */
const val SCORE_DASH = "—"

private const val CENTS = 100

/** Rounds half away from zero, so a figure and its negation round alike. */
fun roundCents(value: Double): Long {
    val cents = floor(abs(value) * CENTS + 0.5).toLong()
    return if (value < 0) -cents else cents
}

private fun digits(cents: Long): String {
    val whole = abs(cents) / CENTS
    val part = (abs(cents) % CENTS).toString().padStart(2, '0')
    return "$whole.$part"
}

/** A card's figure from whole cents: plain, a negative wearing `−`, a zero none. */
fun cardFigureOfCents(cents: Long): String = if (cents < 0) "$MINUS${digits(cents)}" else digits(cents)

/** A card's figure from the ranker's exact score (`15.20`, `−0.50`). */
fun cardFigure(score: Double): String = cardFigureOfCents(roundCents(score))

/** A signed figure — the trace's flag and every path's value: `+6.80`, `−0.50`, `0.00`. */
fun signedOfCents(cents: Long): String = when {
    cents == 0L -> digits(0)
    cents > 0 -> "+${digits(cents)}"
    else -> "$MINUS${digits(cents)}"
}

/** The trace's flag: the signed figure, or the dash where none was computed. */
fun flagFigure(score: Double?): String = if (score == null) SCORE_DASH else signedOfCents(roundCents(score))

/**
 * Largest-remainder apportionment (SR-G8): [parts] in whole cents that sum to
 * the displayed [total], each within one cent of its exact value whenever the
 * exact parts add up to the total (the trace's own law: "their contributions
 * add up to it", `FeedTrace.paths`). A tie keeps the extraction order.
 */
fun apportionCents(parts: List<Double>, total: Double): List<Long> {
    if (parts.isEmpty()) return emptyList()
    val target = roundCents(total)
    val scaled = parts.map { it * CENTS }
    val cents = scaled.map { floor(it).toLong() }.toMutableList()
    var rest = target - cents.sum()
    val order = scaled.indices.sortedWith(
        compareByDescending<Int> { scaled[it] - floor(scaled[it]) }.thenBy { it },
    )
    var at = 0
    while (rest > 0) {
        cents[order[at]] += 1
        rest -= 1
        at = (at + 1) % order.size
    }
    // Only reachable when the exact parts overshoot the total (an answer that
    // breaks its own add-up law): the smallest fractions give a cent back.
    at = order.size - 1
    while (rest < 0) {
        cents[order[at]] -= 1
        rest += 1
        at = (at - 1 + order.size) % order.size
    }
    return cents
}
