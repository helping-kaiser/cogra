// The topics the reader holds (api-spec.md `User.heldTopics`; YourTopics.md):
// every Type toward which the reader's netted Affinity is not (0, 0),
// strongest first by association. Explore's door counts them; Your topics
// lists them.

package com.cogra.domain.topics

import com.cogra.domain.Outcome

/** The held set over the contract. Viewer-only: Success(null) with no signed-in reader. */
interface HeldTopicsRepository {
    /** How many topics the reader holds — the length of the list the door opens. */
    suspend fun heldCount(): Outcome<Int?>

    /** The page of held topics after [after], strongest first. */
    suspend fun heldPage(after: String?): Outcome<HeldTopicsPage?>
}

data class HeldTopicsPage(
    val topics: List<HeldTopic>,
    val endCursor: String?,
    val hasNextPage: Boolean,
)

/** One held topic and the Affinity pair the reader signed toward it. */
data class HeldTopic(
    val name: String,
    val pDirected: Double,
    val pInterest: Double,
    /** An act toward it still settling (`PendingMarker`). */
    val pending: Boolean,
)
