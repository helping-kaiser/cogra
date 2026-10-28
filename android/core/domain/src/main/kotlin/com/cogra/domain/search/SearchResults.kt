// HOW EXPLORE DRAWS THE SEARCH'S ANSWER — pure, so every sidecar line it
// carries is a function a test can state (ExploreSearch.md, ExplorePerson.md,
// ExploreUnscoped.md, ExploreNone.md). web's twin is
// `web/src/lib/search/results.ts`.
//
// THE ANSWER IS DRAWN IN THE ORDER SERVED, NEVER RE-SORTED. The server
// sections it — people, then topics, then content — and orders each section
// (api-spec.md "Search", *Order*); this only decides how each row reads and
// what stands between rows:
//
// - the people section's caption `Profiles` and its `See all profiles` door
//   (ExplorePerson.md:3-9), unless Profiles alone is the filter's kind (:15);
// - under RANKED, the seam before the first row the ranker could not score,
//   in each section — each section its ranked head, then its own rest;
// - each row's right edge: the viewer-relative rank while scored
//   (ExploreSearch.md:13), else the age in the one ladder for a post or a
//   comment (:9, :75), and nothing for a tag or a person (:11, :77).

package com.cogra.domain.search

import com.cogra.domain.ageLadder
import com.cogra.domain.feed.FeedKind
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

/** The result sections, in the order the server stands them. */
enum class SearchSection { PEOPLE, TOPICS, CONTENT }

/** A row's mark (`NodeMark`): the kind the leading tile or avatar says. */
enum class ResultKind { POST, COMMENT, PERSON, TOPIC }

/** The indirect line under a row's name (`ReferenceRow`'s `sub`). */
sealed interface ResultSub {
    /** A comment found through its thread's root post: `on <title>`. */
    data class On(val title: String) : ResultSub

    /** A tag reached through a person cue: `tagged by @sol`. */
    data class TaggedBy(val handle: String) : ResultSub

    /** A person's `@handle` under their display name. */
    data class Handle(val handle: String) : ResultSub
}

/** Where a row opens. */
sealed interface ResultDoor {
    data class Post(val postId: String) : ResultDoor

    /** Search-into-a-thread: the thread opens landed on the comment. */
    data class Comment(val postId: String, val commentId: String) : ResultDoor

    /** Another person's profile; [own] is the reader's own (ExplorePerson.md:25). */
    data class Person(val handle: String, val own: Boolean) : ResultDoor

    data class Topic(val name: String) : ResultDoor
}

/** One item of the results region, top to bottom. */
sealed interface ResultItem {
    data class Row(
        /** The row's position in the results, from 1 — the registry's key. */
        val position: Int,
        val id: String,
        val kind: ResultKind,
        val section: SearchSection,
        val name: String,
        val sub: ResultSub?,
        /** A post's cover or a person's picture; null draws the tile or monogram. */
        val src: String?,
        /** The viewer-relative rank, as drawn (`9.10`). */
        val rank: String?,
        /** The plain value edge: an age. */
        val value: String?,
        /** Null when the row can open nothing. */
        val door: ResultDoor?,
    ) : ResultItem

    data object ProfilesLabel : ResultItem

    data object ProfilesDoor : ResultItem

    data class Seam(val section: SearchSection) : ResultItem
}

/** A leading `@` or `#` and the word it names (api-spec "Cues"); elsewhere they are text. */
data class Cue(val sigil: Char, val name: String, val scoped: Boolean)

fun cueOf(query: String): Cue? {
    val asked = query.trim()
    val sigil = asked.firstOrNull() ?: return null
    if (sigil != '@' && sigil != '#') return null
    val words = asked.drop(1).split(WHITESPACE)
    return Cue(sigil, words.first(), words.drop(1).joinToString(" ").isNotBlank())
}

private val WHITESPACE = Regex("\\s+")

/**
 * Comments are served only under a cue (ExploreSearch.md:29), so with
 * Comments on and no `@handle` or `#tag` the search-scope line stands
 * (ExploreUnscoped.md:3-7).
 */
fun unscopedComments(query: String, kinds: Set<FeedKind>): Boolean =
    query.isNotBlank() && FeedKind.COMMENT in kinds && cueOf(query) == null

/** Comments alone and no cue: no row can stand, so nothing need be asked. */
fun onlyUnscopedComments(query: String, kinds: Set<FeedKind>): Boolean =
    unscopedComments(query, kinds) && kinds.size == 1

/** The rank as the row draws it — two places, the board's `9.10`. */
fun formatRank(score: Double): String = String.format(Locale.ROOT, "%.2f", score)

private fun SearchNode.section(): SearchSection = when (this) {
    is SearchNode.Person -> SearchSection.PEOPLE
    is SearchNode.Tag -> SearchSection.TOPICS
    is SearchNode.Post, is SearchNode.Comment -> SearchSection.CONTENT
}

/** What the layout reads its rows against. */
data class ResultsContext(
    val query: String,
    /** The signed-in reader's id; null for a guest. */
    val reader: String?,
    val order: SearchOrder,
    val now: Instant,
    val zone: ZoneId = ZoneId.systemDefault(),
)

private fun SearchHit.row(position: Int, context: ResultsContext): ResultItem.Row {
    val rank = score?.takeIf { context.order == SearchOrder.RANKED }?.let(::formatRank)
    fun dated(at: Instant) = if (rank != null) null else ageLadder(at, context.now, context.zone)
    val base = ResultItem.Row(
        position = position,
        id = node.id,
        kind = ResultKind.POST,
        section = node.section(),
        name = "",
        sub = null,
        src = null,
        rank = rank,
        value = null,
        door = null,
    )
    return when (val node = node) {
        is SearchNode.Post -> base.copy(
            kind = ResultKind.POST,
            name = node.title.orEmpty(),
            src = node.coverUrl,
            value = dated(node.createdAt),
            door = ResultDoor.Post(node.id),
        )
        is SearchNode.Comment -> base.copy(
            kind = ResultKind.COMMENT,
            name = node.content.orEmpty(),
            // The indirect line names the title it was found through (:31, :45).
            sub = node.threadPostTitle?.let(ResultSub::On),
            value = dated(node.createdAt),
            door = node.threadPostId?.let { ResultDoor.Comment(it, node.id) },
        )
        is SearchNode.Person -> base.copy(
            kind = ResultKind.PERSON,
            name = node.displayName?.takeIf { it.isNotBlank() } ?: "@${node.handle}",
            sub = ResultSub.Handle(node.handle),
            src = node.avatarUrl,
            door = ResultDoor.Person(node.handle, own = context.reader != null && node.id == context.reader),
        )
        is SearchNode.Tag -> {
            val cue = cueOf(context.query)
            val name = node.name.orEmpty()
            base.copy(
                kind = ResultKind.TOPIC,
                name = name,
                // Reached through a person cue, a tag says by whom (ExploreSearch.md:43).
                sub = cue?.takeIf { it.sigil == '@' && it.name.isNotEmpty() }?.let { ResultSub.TaggedBy(it.name) },
                door = name.takeIf { it.isNotEmpty() }?.let(ResultDoor::Topic),
            )
        }
    }
}

/** The results region, top to bottom: the hits as served, with the captions, doors and seams between. */
fun layoutResults(
    hits: List<SearchHit>,
    kinds: Set<FeedKind>,
    hasMorePeople: Boolean,
    context: ResultsContext,
): List<ResultItem> {
    val profilesAlone = kinds == setOf(FeedKind.PROFILE)
    val items = mutableListOf<ResultItem>()
    var previous: SearchSection? = null
    var seamed = false
    hits.forEachIndexed { index, hit ->
        val section = hit.node.section()
        if (section != previous) {
            // The people section closes with its door, where more match (:7).
            if (previous == SearchSection.PEOPLE && hasMorePeople && !profilesAlone) items += ResultItem.ProfilesDoor
            if (section == SearchSection.PEOPLE && !profilesAlone) items += ResultItem.ProfilesLabel
            previous = section
            seamed = false
        }
        if (context.order == SearchOrder.RANKED && hit.score == null && !seamed) {
            items += ResultItem.Seam(section)
            seamed = true
        }
        items += hit.row(index + 1, context)
    }
    if (previous == SearchSection.PEOPLE && hasMorePeople && !profilesAlone) items += ResultItem.ProfilesDoor
    return items
}
