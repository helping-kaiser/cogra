// The object readout of a TAG's pair (design/readme.md §13, "The tag pad —
// 2026-09-10"), drawn wherever a tag's two parameters are shown without the
// pad beside them — the tags-and-references sheet's rows above all.
//
// IT IS DISJOINT FROM THE STANCE FACES, deliberately: not one glyph appears in
// both tables. A face that means "Like this" about a post must never also mean
// "locked on" about a topic, or the one lossy readout the system has starts
// lying about which family a reader is looking at. A tag is a claim about what
// a post is about and has no mood to wear, so its table is objects.
//
// THE GRID IS FOUR BY THREE, plus a floating thirteenth. Aboutness runs
// Barely → Entirely across 0.15, 0.45, 0.72, 0.95; certainty runs Guessing →
// Certain up 0.15, 0.55, 0.90; the twelve sit at the band centres and 💯
// floats at 0.86 / 0.95, so the top of the field is reachable without taking
// the Entirely corner from the row that owns it.
//
// Like [STANCE_ANCHORS], the table is the contract: both clients read these
// values, and a change here changes both apps.

package com.cogra.core.designsystem

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.res.stringResource
import java.util.Locale

/**
 * A place in the tag field: relevance across, confidence up. Relevance is a
 * signed Dimension; confidence is census-bounded to `[0, 1]` (hashtag.md §4),
 * which is why the pair below is written with only one sign.
 */
@Immutable
data class TagPoint(val relevance: Double, val confidence: Double)

/** One readout anchor: a place in the tag field, its object, and its words. */
@Immutable
data class TagAnchor(val at: TagPoint, val emoji: String, @get:StringRes val label: Int)

/** The thirteen objects of design/readme.md §13, in the doc's own order. */
val TAG_ANCHORS: List<TagAnchor> = listOf(
    TagAnchor(TagPoint(0.15, 0.90), "🔍", R.string.tag_anchor_had_to_look),
    TagAnchor(TagPoint(0.45, 0.90), "🔗", R.string.tag_anchor_definitely_linked),
    TagAnchor(TagPoint(0.72, 0.90), "🔒", R.string.tag_anchor_locked_on),
    TagAnchor(TagPoint(0.95, 0.90), "🎯", R.string.tag_anchor_exactly_this),
    TagAnchor(TagPoint(0.15, 0.55), "💧", R.string.tag_anchor_a_drop_of_it),
    TagAnchor(TagPoint(0.45, 0.55), "🧩", R.string.tag_anchor_piece_of_the_picture),
    TagAnchor(TagPoint(0.72, 0.55), "🧲", R.string.tag_anchor_pulled_toward_it),
    TagAnchor(TagPoint(0.95, 0.55), "🗝️", R.string.tag_anchor_likely_the_key),
    TagAnchor(TagPoint(0.15, 0.15), "❔", R.string.tag_anchor_faint_maybe),
    TagAnchor(TagPoint(0.45, 0.15), "🎲", R.string.tag_anchor_either_way),
    TagAnchor(TagPoint(0.72, 0.15), "🎣", R.string.tag_anchor_fishing_for_it),
    TagAnchor(TagPoint(0.95, 0.15), "🔮", R.string.tag_anchor_big_claim_divined),
    TagAnchor(TagPoint(0.86, 0.95), "💯", R.string.tag_anchor_all_of_it),
)

/**
 * The readout for [point]: the nearest anchor by Euclidean distance, the same
 * walk [nearestStanceAnchor] takes over the twenty faces. Ties go to the
 * earlier anchor, so the result is a function of the table's order rather than
 * of iteration luck.
 */
fun nearestTagAnchor(point: TagPoint): TagAnchor =
    TAG_ANCHORS.minBy { anchor ->
        val dr = anchor.at.relevance - point.relevance
        val dc = anchor.at.confidence - point.confidence
        dr * dr + dc * dc
    }

/**
 * A TAG's pair, `+0.40 / 0.90`-style — and the shape is the point. Relevance
 * keeps its sign, which is the whole content of the value; confidence cannot
 * go negative, so a `+` on it would advertise a pole that does not exist. A
 * citation writes `+0.10 / +0.10` through [StancePoint.pair] instead, and a
 * reader who can tell the two apart at a glance is being told the truth about
 * which family they are looking at.
 */
@Composable
fun TagPoint.pair(): String =
    stringResource(R.string.stance_pair, twoPlaces(relevance), twoPlacesUnsigned(confidence))

/** Two decimals, no forced sign — the half of the pair that has no poles. */
fun twoPlacesUnsigned(value: Double): String =
    String.format(Locale.getDefault(), "%.2f", value)
