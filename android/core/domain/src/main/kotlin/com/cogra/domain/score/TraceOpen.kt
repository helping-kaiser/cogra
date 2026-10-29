// ONE TRACE OPEN (score-readout packet CD-SR1, CD-SR2, CD-SR3; PR-39): the
// score's tap is one LIVE fetch, and the four levels read that one held
// answer — RankPath, RankHop and RankRecords make no call of their own, and
// back returns to the held state. Re-entering the trace from a card is a new
// open and a new fetch; nothing re-asks in the background. The web's twin is
// `web/src/lib/score/trace-session.ts` with `trace-view.tsx`'s `readTrace`.

package com.cogra.domain.score

import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedViewer
import javax.inject.Inject
import javax.inject.Singleton

/** Where a score was tapped: names the trace's first back arrow (graph.json's origin table). */
sealed interface TraceOrigin {
    data object Feed : TraceOrigin

    /** The post's own detail. */
    data class Post(val postId: String) : TraceOrigin

    data class Tag(val name: String) : TraceOrigin

    data object History : TraceOrigin

    data object Saved : TraceOrigin

    /** The reader's own profile's posts. */
    data object OwnProfile : TraceOrigin

    /** Another's profile's posts. */
    data class Profile(val handle: String) : TraceOrigin

    /** How a route carries it: `feed`, `post:<id>`, `tag:<name>`, `history`, `saved`, `profile`, `u:<handle>`. */
    val param: String
        get() = when (this) {
            Feed -> "feed"
            is Post -> "post:$postId"
            is Tag -> "tag:$name"
            History -> "history"
            Saved -> "saved"
            OwnProfile -> "profile"
            is Profile -> "u:$handle"
        }

    companion object {
        /** A route's [param] read back; anything unknown is the feed. */
        fun of(param: String?): TraceOrigin = when {
            param == null -> Feed
            param.startsWith("post:") -> Post(param.removePrefix("post:"))
            param.startsWith("tag:") -> Tag(param.removePrefix("tag:"))
            param.startsWith("u:") -> Profile(param.removePrefix("u:"))
            param == "history" -> History
            param == "saved" -> Saved
            param == "profile" -> OwnProfile
            else -> Feed
        }
    }
}

/** One open's held answer: the view it walked, the answer, and the things its steps name. */
data class TraceHeld(
    val viewer: String,
    val answer: TraceAnswer,
    val named: Map<String, TraceNamed>,
)

/** What one open's read came to. */
sealed interface TraceRead {
    data class Answered(val held: TraceHeld) : TraceRead

    /** No answer reached the device. */
    data object Offline : TraceRead

    /** The answer was an error, or no view could be ranked: the house's `didn't go through` (§5.6). */
    data object Fault : TraceRead
}

/**
 * The answers the opens fetched, by thing, for the deeper levels to read
 * without asking again (CD-SR2). The last few only: an open is a walk down and
 * back up, and a fresh open replaces its thing's answer.
 */
@Singleton
class TraceSession @Inject constructor() {
    private val held = LinkedHashMap<String, TraceHeld>()

    @Synchronized
    fun hold(targetId: String, answer: TraceHeld) {
        held.remove(targetId)
        held[targetId] = answer
        while (held.size > KEPT) held.remove(held.keys.first())
    }

    @Synchronized
    fun heldFor(targetId: String): TraceHeld? = held[targetId]

    private companion object {
        const val KEPT = 8
    }
}

/**
 * The open's one fetch: the view the tapped figure was computed in (or, with
 * none handed, the feed's own — the held ranking's, else the reader's view
 * read afresh), the live trace, then one batch naming the posts and comments
 * its steps pass through. WHAT THE FETCH FINDS IS ADOPTED, number or dash
 * (FeedKinds.md:11), on every surface that draws this thing — never moving a
 * row — and held for the deeper levels.
 *
 * A thing still settling never reaches here: its trace makes no fetch
 * (FeedEntryMoved.md:9; CD-SR3).
 */
class OpenTrace @Inject constructor(
    private val traces: TraceRepository,
    private val standings: FeedStandings,
    private val session: TraceSession,
    private val feedViewer: FeedViewer,
) {
    suspend operator fun invoke(targetId: String, viewer: String?): TraceRead {
        val view = viewer ?: standings.state.value.viewerFor(feedViewer.reader()) ?: when (val read = feedViewer.resolve()) {
            is Outcome.Success -> read.value ?: return TraceRead.Fault
            is Outcome.Refused -> return TraceRead.Fault
            is Outcome.Failed -> return TraceRead.Offline
        }
        val answer = when (val fetched = traces.trace(view, targetId)) {
            is TraceFetch.Answered -> fetched.answer ?: return TraceRead.Fault
            TraceFetch.Offline -> return TraceRead.Offline
            TraceFetch.Fault -> return TraceRead.Fault
        }
        standings.adopt(targetId, answer.score)
        val ids = answer.paths
            .flatMap { path -> path.nodes.dropLast(1) }
            .filter { it.kind == TraceNodeKind.POST || it.kind == TraceNodeKind.COMMENT }
            .mapNotNull { it.id }
            .distinct()
        val named = if (ids.isEmpty()) emptyMap() else traces.names(ids)
        return TraceHeld(view, answer, named).also { session.hold(targetId, it) }.let(TraceRead::Answered)
    }
}
