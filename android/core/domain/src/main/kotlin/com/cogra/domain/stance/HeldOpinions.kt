// WHO HOLDS AN OPINION ON A PERSON, AND WHOM A PERSON HOLDS ONE ON
// (ProfileStances.md; the web's twin `web/src/lib/stance/held-opinions.ts`):
// opinion records folded into one row per person.
//
// THE RECORDS ARE NOT THE ROWS. The chronicle serves every record — a revised
// opinion is a parallel record in its author's bundle (api-spec.md "The graph
// is a chronicle") — while the page draws PEOPLE and their standing opinion. So
// the client replays the published fold: a bundle's sum-then-clip, payload-
// marked records excluded (api-spec.md "The read-side bundle fold";
// feed-ranking.md §3.2), the sum exact decimal ([exactSum]).
//
// THE ROW'S PERSON IS THE BUNDLE'S KEY. A stance bundle is one author toward
// one target, and each direction of the page holds one side fixed: the
// opinions ON a person fix the target, so each author is a row; the opinions
// BY a person fix the author, so each target is a row. The caller names which
// side is the row's holder.
//
// A BUNDLE AT (0, 0) IS STILL A STANDING (api-spec.md "Severed is the
// bundle's history, not its pair"): the row keeps its place and speaks which
// zero — `StanceRow`'s `severed`, read off the newest record's own `severed`.
//
// STRONGEST FIRST, by the for-or-against value, down past nothing into the
// ones held against (ProfileStances.md:19). Ties keep the web's fixed order —
// the reach, then the holder's address — so both clients draw one list.

package com.cogra.domain.stance

/**
 * The page's two directions (`ProfileStances`: `On them` · `By them`): the
 * Opinion records aimed at the person, and the ones they gave toward people.
 */
enum class OpinionDirection { ON, BY }

/** The person a row names, as `StanceRow` draws them. */
data class OpinionHolder(
    /** The account's id; null for an address no account fronts. */
    val actorId: String?,
    /**
     * The handle the row's door opens; null where there is none to open. A
     * deleted account keeps the handle its page still answers to
     * (ProfileDeleted, "reached by structure that still points at the
     * account"), which the row never prints.
     */
    val handle: String?,
    /** The written name, else null (the handle then names the row). */
    val displayName: String?,
    val avatarUrl: String?,
    /** A deleted account: the reserved disc, `Deleted account`, no handle line. */
    val redacted: Boolean,
)

/** One opinion record as the fold reads it. */
data class OpinionRecord(
    /** The address of the person the row is about: the author on On, the target on By. */
    val holderId: String,
    val holder: OpinionHolder,
    val pDirected: Double,
    val pInterest: Double,
    val severed: Boolean?,
    val payloadMarked: Boolean,
    val landingEpoch: Int,
    val position: Int,
)

/** One standing opinion: a row of the page. */
data class HeldOpinion(
    val holderId: String,
    /** The holder as the newest record served them. */
    val holder: OpinionHolder,
    val pair: StancePair,
    /** Walked back to nothing — `Walked back`, where a never-severed (0, 0) says nothing. */
    val severed: Boolean,
)

/** The fold: one row per holder, strongest first. */
fun foldHeldOpinions(records: List<OpinionRecord>): List<HeldOpinion> = records
    .filterNot { it.payloadMarked }
    .groupBy { it.holderId }
    .map { (holderId, bundle) ->
        val newest = bundle.maxWith(PUBLISHED_ORDER)
        HeldOpinion(
            holderId = holderId,
            holder = newest.holder,
            pair = StancePair(
                pDirected = clipDimension(exactSum(bundle.map { it.pDirected })),
                pInterest = clipDimension(exactSum(bundle.map { it.pInterest })),
            ),
            severed = newest.severed == true,
        )
    }
    .sortedWith(
        compareByDescending<HeldOpinion> { it.pair.pDirected }
            .thenByDescending { it.pair.pInterest }
            .thenBy { it.holderId },
    )

/** A record's place in the published order: the key of record, landing epoch then position. */
private val PUBLISHED_ORDER: Comparator<OpinionRecord> =
    compareBy<OpinionRecord> { it.landingEpoch }.thenBy { it.position }
