// THE ONE-AXIS TABLE — the face a pick that names no pair wears.
//
// An opinion on one's own post is ONE number (jakob's ruling,
// 2026-09-14: "the second number isn't yours to set on your own post").
// A post always reaches its author in full, so `pInterest` is not a
// value the author picks, and [nearestStanceAnchor] cannot answer for a
// value that names no pair: asked for the nearest of twenty points to a
// value with only a directed half, it would have to invent the other.
//
// So the six here are the twenty's pure-valence spine — the mild,
// middle and far face on each side, at ±0.15, ±0.55 and ±0.90. Glyph,
// word and position are READ from [STANCE_ANCHORS], so the six are six
// OF the twenty and cannot drift from them.
//
// THE BANDS ARE WRITTEN, NOT COMPUTED. They are the midpoints between
// neighbouring anchors — ±0.35 and ±0.725 — but derived at runtime the
// first of those comes out as −0.7250000000000001, and a band edge that
// depends on the order of a multiply is a face that depends on the
// platform. The edges are spelled, every comparison is a `<` or an
// `==`, and web's `valence.ts` spells the same six: the two clients
// answer identically for every value, the edges included.
//
// The master is `design/components/stance/StanceReadout.jsx`'s
// `VALENCE_SIX` / `nearestValenceAnchor`.

package com.cogra.core.designsystem

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.res.stringResource

/**
 * One band of the one-axis readout: the face it wears, the word that
 * face is read aloud as, the anchor it stands for, and the stretch of
 * the axis it owns.
 */
@Immutable
data class ValenceBand(
    val emoji: String,
    @get:StringRes val label: Int,
    /** Where the band's own anchor sits — the twenty's, not a new point. */
    val pDirected: Double,
    /** The band owns the axis up to here. */
    val to: Double,
    /** Whether the edge itself belongs to this band. */
    val toInclusive: Boolean,
)

/**
 * EACH ROW OWNS THE AXIS UP TO ITS [ValenceBand.to], and
 * [ValenceBand.toInclusive] says whether the edge itself belongs to it.
 * Away from the edges this is the nearest anchor by distance; the
 * asymmetry in `toInclusive` is where the two ruled tie-breaks live, and
 * it is the same rule stated twice:
 *
 *  - AT A MIDPOINT THE MILDER FACE WINS — the one nearer zero. On the
 *    negative side that is the band above, so a negative row stops short
 *    of its edge; on the positive side it is the band below, so a
 *    positive row keeps it.
 *  - EXACTLY 0.00 READS 🙂 — the 😕 row stops short of zero, so zero
 *    falls into the first band above it.
 *
 * Six monotone bands covering the closed axis, and the same face
 * everywhere.
 */
val VALENCE_SIX: List<ValenceBand> = listOf(
    valenceBand("😠", to = -0.725, toInclusive = false),
    valenceBand("🙁", to = -0.35, toInclusive = false),
    valenceBand("😕", to = 0.0, toInclusive = false),
    valenceBand("🙂", to = 0.35, toInclusive = true),
    valenceBand("😊", to = 0.725, toInclusive = true),
    valenceBand("😍", to = 1.0, toInclusive = true),
)

/**
 * The band for [pDirected]: the first one the value falls inside. The
 * bands cover the closed axis, so every value has exactly one; out of
 * range is clamped in rather than refused, the way the field clamps, and
 * a value that names no point on the axis at all folds to the origin —
 * the same normalisation web's `clampDimension` makes.
 *
 * Interval comparison only: no distance is computed, so there is no
 * float arithmetic here for two platforms to round differently.
 */
fun nearestValenceAnchor(pDirected: Double): ValenceBand {
    val value = if (pDirected.isNaN()) 0.0 else pDirected.coerceIn(-1.0, 1.0)
    return VALENCE_SIX.firstOrNull { value < it.to || (it.toInclusive && value == it.to) }
        ?: VALENCE_SIX.last()
}

/**
 * One signed dimension, two places — the pair's half, for the surfaces
 * that draw a single number because a single number is all the author
 * picked. The same formatter the pair itself is written with, so the two
 * shapes never disagree about how this system writes a value.
 */
fun valenceExact(pDirected: Double): String = twoPlaces(pDirected)

/**
 * The one-axis reading in words — `Nice, For or against +0.10`.
 *
 * A stance is always accompanied by words (design.md §10) and the face
 * rides on top of them, so every surface that draws the face announces
 * this instead: the band's own word, then the one axis there is and the
 * one number the author picked. Public because the pad and the seal row
 * that reads it back are in different modules, and a second copy of the
 * wording is exactly the drift a design system exists to prevent.
 */
@Composable
fun valenceReading(pDirected: Double): String = stringResource(
    R.string.valence_reading,
    stringResource(nearestValenceAnchor(pDirected).label),
    stringResource(R.string.valence_axis),
    valenceExact(pDirected),
)

/**
 * Read out of the twenty. A face the anchor table does not carry is the
 * contract having drifted, and the table says so at class-load rather
 * than standing up a band with no word and no position.
 */
private fun valenceBand(emoji: String, to: Double, toInclusive: Boolean): ValenceBand {
    val anchor = requireNotNull(STANCE_ANCHORS.firstOrNull { it.emoji == emoji }) {
        "the one-axis table names $emoji, which STANCE_ANCHORS no longer carries"
    }
    return ValenceBand(
        emoji = emoji,
        label = anchor.label,
        pDirected = anchor.at.directed,
        to = to,
        toInclusive = toInclusive,
    )
}
