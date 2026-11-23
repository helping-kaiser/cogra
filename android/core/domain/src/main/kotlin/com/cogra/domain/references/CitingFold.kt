// WHAT CITES THIS (CitedBy.md; CommentCitedByEmpty.md; the web's twin
// `web/src/lib/references/citing-fold.ts`): the reference records whose
// terminal leg lands on a node, folded into one row per standing citation.
//
// THE RECORDS ARE NOT THE ROWS. A citation is a bundle keyed by its full
// incidence — (author, citing artifact, target) — whose records NET: a
// citation revised twice folds to the sum of its three records, clipped, and
// one netting to (0, 0) is withdrawn and cites nothing (api-spec.md
// `ReferenceClaim`, "The read-side bundle fold"). The sheet holds exactly as
// many rows as the detail's `Cited by N` counts (CitedBy.md:9), so a revised
// citation is one row and a withdrawn one is none.
//
// NEWEST FIRST (CitedBy.md:7): a chronicle of acts, ordered by the newest act
// on each citation — a re-declared citation is what has just arrived.

package com.cogra.domain.references

import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.clipDimension
import com.cogra.domain.stance.exactSum
import com.cogra.domain.stance.netsToZero

/** One reference record as the fold reads it; [target] (the citing artifact) rides through. */
data class CitingRecord<T>(
    val id: String,
    val authorId: String,
    /** The citing artifact's raw L1 id — the middle node of the hyper act. */
    val targetId: String,
    val target: T,
    val pDirected: Double,
    val pInterest: Double,
    val payloadMarked: Boolean,
    val landingEpoch: Int,
    val position: Int,
)

/** One standing citation: a sheet row. */
data class CitingArtifact<T>(
    /** Stable across reads: the bundle's key. */
    val key: String,
    /** The citing artifact, as the newest record served it. */
    val target: T,
    val pair: StancePair,
)

/** The fold: one row per standing citation, newest first. */
fun <T> foldCitingArtifacts(records: List<CitingRecord<T>>): List<CitingArtifact<T>> = records
    .filterNot { it.payloadMarked }
    .groupBy { "${it.authorId} ${it.targetId}" }
    // Withdrawn: the sums net to exactly zero on both axes.
    .filterValues { bundle -> !(netsToZero(bundle.map { it.pDirected }) && netsToZero(bundle.map { it.pInterest })) }
    .map { (key, bundle) ->
        val newest = bundle.maxWith(PUBLISHED_ORDER)
        newest to CitingArtifact(
            key = key,
            target = newest.target,
            pair = StancePair(
                pDirected = clipDimension(exactSum(bundle.map { it.pDirected })),
                pInterest = clipDimension(exactSum(bundle.map { it.pInterest })),
            ),
        )
    }
    .sortedWith(compareByDescending(PUBLISHED_ORDER) { it.first })
    .map { it.second }

/** A record's place in the published order: the key of record, landing epoch then position. */
private val PUBLISHED_ORDER: Comparator<CitingRecord<*>> =
    compareBy<CitingRecord<*>> { it.landingEpoch }.thenBy { it.position }
