// The topics the feed filter's One topic section offers (FeedSheet.md:29-35;
// FeedTopic.md: "only a topic the reader holds an opinion for, with a netted
// Affinity that is not (0, 0) and associates positively, can be on"): the
// reader's held topics (api-spec.md `User.heldTopics`, the one read Explore's
// Your topics pages through) whose association — the folded `pDirected` — is
// positive. A topic held against stays a record, listed on Your topics; it
// never narrows a feed. web's twin is `web/src/lib/api/held-topics-api.ts`.

package com.cogra.domain.feed

import com.cogra.domain.Outcome
import com.cogra.domain.topics.HeldTopic
import com.cogra.domain.topics.HeldTopicsRepository

/**
 * The held-for topics among [held], in their order — and whether the read
 * should page on: the list comes strongest first by association, so a page
 * whose last topic is held for may be followed by more held for, and the
 * first that is not ends it.
 */
fun heldForOf(held: List<HeldTopic>): Pair<List<FeedTopic>, Boolean> {
    val topics = held.filter { it.pDirected > 0 }.map { FeedTopic(it.id, it.name) }
    val more = held.isNotEmpty() && held.last().pDirected > 0
    return topics to more
}

/** Pages the read takes at most — 50 a page, so 200 topics held for (the web twin's bound). */
const val HELD_FOR_MAX_PAGES = 4

/**
 * The topics the reader holds and is for, strongest first, paged through
 * [HeldTopicsRepository] only while the last one read is still held for.
 * Success(empty) with no signed-in reader: no one holds anything.
 */
suspend fun HeldTopicsRepository.heldFor(): Outcome<List<FeedTopic>> {
    val topics = mutableListOf<FeedTopic>()
    var after: String? = null
    repeat(HELD_FOR_MAX_PAGES) {
        val page = when (val read = heldPage(after)) {
            is Outcome.Success -> read.value ?: return Outcome.Success(topics)
            is Outcome.Refused -> return read
            is Outcome.Failed -> return read
        }
        val (held, more) = heldForOf(page.topics)
        topics += held
        after = page.endCursor
        if (!more || !page.hasNextPage || after == null) return Outcome.Success(topics)
    }
    return Outcome.Success(topics)
}
