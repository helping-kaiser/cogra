// What a citation is on the client side, and what an author picks as
// one. Quoting, embedding and mentioning are all the same Reference
// record and the target's node class is the whole distinction (D2) —
// so there is one claim type here, not three, and the render decides
// what to call it.
//
// The user-facing word is Reference, never "cite" (D20); a reference
// whose target is a profile is a mention. Topics are not reference
// targets: tagging is what a topic is for (D21).

package com.cogra.domain.references

/**
 * How load-bearing the cited thing is to the citing artifact. The
 * census calls this **effort `f`** and it rides the `pDirected` slot —
 * the same slot relevance occupies on a tag, which is why authors meet
 * the same word here (D1).
 */
const val REFERENCE_DEFAULT_RELEVANCE = 0.1

/**
 * Endorsing versus refuting — the census's **enthusiasm `e`**, on the
 * `pInterest` slot. Strictly positive on both axes is what makes a
 * mention a vouch, so the default vouches weakly (D3).
 */
const val REFERENCE_DEFAULT_SUPPORT = 0.1

/** Mirrors the API's per-kind batch cap (D7) so a surface refuses locally. */
const val MAX_REFERENCES = 10

/**
 * One citation an author is declaring: the cited node's L2 id and the
 * two parameters its sliders carry. The id is what
 * `ReferenceInput.target` names — the finder hands back exactly what
 * the mutation consumes, so nothing here translates.
 */
data class ReferenceClaim(
    val targetId: String,
    val relevance: Double = REFERENCE_DEFAULT_RELEVANCE,
    val support: Double = REFERENCE_DEFAULT_SUPPORT,
)
