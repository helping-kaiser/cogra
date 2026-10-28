// The topics the feed filter's One topic section offers (FeedSheet.md:29-35;
// FeedTopic.md: "only a topic the reader holds an opinion for, with a netted
// Affinity that is not (0, 0) and associates positively, can be on"): the
// reader's held topics (api-spec.md `User.heldTopics`) whose association — the
// folded `pDirected` — is positive. A topic held against stays a record, listed
// on Your topics; it never narrows a feed. web's twin is
// `web/src/lib/api/held-topics-api.ts`.

package com.cogra.domain.feed

import com.cogra.domain.Outcome

/** The topics the reader holds and is for, over the contract. Viewer-only. */
interface FeedTopicsRepository {
    /**
     * The held-for topics, strongest first by association. Success(empty)
     * with no signed-in reader: no one holds anything.
     */
    suspend fun heldFor(): Outcome<List<FeedTopic>>
}

/** One held edge as the read hands it: the topic, if it names one, and its folded association. */
data class HeldEdge(val topic: FeedTopic?, val pDirected: Double)

/**
 * The held-for topics among [edges], in their order — and whether the read
 * should page on: the list comes strongest first by association, so a page
 * whose last edge is held for may be followed by more held for, and the first
 * edge that is not ends it.
 */
fun heldForOf(edges: List<HeldEdge>): Pair<List<FeedTopic>, Boolean> {
    val topics = edges.filter { it.pDirected > 0 }.mapNotNull { it.topic }
    val more = edges.isNotEmpty() && edges.last().pDirected > 0
    return topics to more
}

/** Pages the read takes at most — 50 a page, so 200 topics held for (the web twin's bound). */
const val HELD_FOR_MAX_PAGES = 4
