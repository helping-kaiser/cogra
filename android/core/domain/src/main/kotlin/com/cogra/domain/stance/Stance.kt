// The stance control's data model (design.md §8). The write is already
// generic — `WriteRepository.prepareStance` carries the picked values
// verbatim — so what lives here is the read side the control surfaces:
// the viewer's current standing toward a target, where a candidate pick
// would land it, and what reaching severance would take.
//
// Every number in this file is the backend's fold. The client shows them
// and never derives them: a stance record carries exactly the two values
// the author picked, never a delta against the bundle (api-spec.md
// "Stance prepares write the picked values"; design.md §8.1).

package com.cogra.domain.stance

/**
 * The two user parameters every record carries, each a continuous value
 * on the closed `[-1, +1]` ([edges.md §1]; design.md §8.1):
 * [pDirected] is valence — how you stand on it — and [pInterest] is
 * connection — how much you want it in your world.
 */
data class StancePair(val pDirected: Double, val pInterest: Double) {
    companion object {
        /** Where the pad opens, untilted toward either direction (design.md §8.3). */
        val Origin = StancePair(0.0, 0.0)

        /**
         * What a plain tap commits: the modest positive of the repo-wide
         * low-defaults policy, so stronger stances stay expressible
         * (design.md §8.3, invitations.md §3).
         */
        val TapDefault = StancePair(0.1, 0.1)
    }
}

/**
 * Which surface the stance control offers for picking a value
 * (design.md §8.6). The pad is the default, not the only way; the two
 * alternates are the same machinery on a different surface, and they
 * are also the accessible path — the pad is a drag gesture, and
 * design.md §10 requires a drag to always have a non-drag equivalent.
 *
 * The choice replaces the pad EVERYWHERE, not per-screen, which is why
 * it is a stored preference rather than a control's own state.
 */
enum class StanceInputMode {
    PAD,

    /** One slider per parameter. */
    SLIDERS,

    /** Typed values, for people who want exact control. */
    ENTRY,
    ;

    companion object {
        val Default = PAD
    }
}

/**
 * The viewer's own bundle toward one target, folded — "everything about
 * the bundle is read-side" (design.md §8.1).
 */
data class StanceStanding(
    val target: String,
    /** Where the bundle sits now; the origin when nothing is authored. */
    val net: StancePair,
    /**
     * The raw sums behind [net], before the clip at `±1`. A bundle whose
     * raw sum lies beyond the clip still carries that history, and the
     * two numbers are kept apart because they answer different questions:
     * [net] is what the graph reads, [raw] is what a walk back to zero
     * actually walks (design.md §8.3, §8.5).
     */
    val raw: StancePair,
    /** How many of the viewer's own records the fold covers. */
    val records: Int,
    /**
     * Whether records that have not landed on L1 counted. True is the
     * default everywhere a reader is shown their own standing — a stance
     * still settling is one the author already made (design.md §9).
     */
    val includePending: Boolean,
)

/**
 * Where a candidate pick lands the bundle. This is the second number the
 * control has to show: the value being written and the place it lands
 * are different, and only the first is what the record carries
 * (design.md §8.2).
 */
data class StanceProjection(
    val pick: StancePair,
    /** Where the bundle lands once [pick] folds in. */
    val net: StancePair,
    /** The fold reads valence as carrying nothing — the stance is inert there. */
    val inertDirected: Boolean,
    /** The fold reads connection as carrying nothing. */
    val inertInterest: Boolean,
    /**
     * The landing is severance — a bundle netted to `(0, 0)`, which
     * carries consequences ordinary stances do not. A single pick can
     * reach it against a short history; the control explains rather than
     * refuses (design.md §8.2).
     */
    val severance: Boolean,
)

/**
 * Where [pick] lands the bundle whose raw sums are [raw] — the fold, run
 * locally, for display only (design.md §8.3).
 *
 * This is the one place the client does the graph's arithmetic, and it
 * is allowed precisely because it is not authoritative: the staged
 * record still carries the picked values verbatim, and the backend's
 * answer remains the authority once a record is signed. What it buys is
 * a landing line that moves with the thumb, since a round trip per pick
 * makes the second number arrive about a second after the first — long
 * enough that the two stop reading as one control.
 *
 * The sum is taken on the RAW numbers and clipped once, at the end.
 * Folding the clipped standing instead would be wrong wherever the
 * bundle already runs past `±1`: a history summing to `+6` does not
 * become `+1` the moment a `−1` is added to it.
 */
fun localLanding(raw: StancePair, pick: StancePair): StanceProjection {
    val net = StancePair(
        pDirected = clipDimension(raw.pDirected + pick.pDirected),
        pInterest = clipDimension(raw.pInterest + pick.pInterest),
    )
    return StanceProjection(
        pick = pick,
        net = net,
        inertDirected = net.pDirected == 0.0,
        inertInterest = net.pInterest == 0.0,
        severance = net.pDirected == 0.0 && net.pInterest == 0.0,
    )
}

/**
 * The clip the graph reads a folded parameter through: every dimension
 * is a continuous value on the closed `[-1, +1]` ([edges.md §1]).
 *
 * A sum that lands on zero is normalised away from `-0.0`, which is a
 * real Double and would otherwise print as "-0.00" and fail an exact
 * zero test the severance rules depend on.
 */
private fun clipDimension(sum: Double): Double =
    sum.coerceIn(-1.0, 1.0).let { if (it == 0.0) 0.0 else it }

/**
 * What netting the bundle to `(0, 0)` would actually take (design.md
 * §8.5). Severance stages a batch of counter-records, and **each record
 * in a batch is its own priced act** (api-spec.md "The write flow"), so
 * [records] is the cost the reader is asked to accept before signing.
 */
data class SeveranceQuote(
    val target: String,
    /** The standing the batch would cancel, as the graph reads it. */
    val standing: StancePair,
    /**
     * The RAW sums the batch actually has to walk back. This is the
     * number the confirmation states: a bundle clipped at `+1.00` whose
     * raw sum is `+6.00` costs a batch sized by the six, and quoting the
     * clipped fold beside that count makes the price unexplainable
     * (design.md §8.3 "Clipped is not hidden").
     */
    val raw: StancePair,
    /** How many counter-records the batch stages — each its own priced act. */
    val records: Int,
    /** The bundle already nets to `(0, 0)`; there is nothing to sever. */
    val alreadySevered: Boolean,
)
