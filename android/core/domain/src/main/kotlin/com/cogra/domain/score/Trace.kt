// THE SCORE'S TRACE — the data (api-spec.md `feedTrace`, `RankPath`, `RankHop`,
// `Record`; score-readout packet §5). One live `feedTrace` answer, carried
// field for field, and the trace's reads behind the contract. The web's twin
// is `web/src/lib/score/trace-model.ts` + `web/src/lib/api/trace-api.ts`.
//
// NOTHING HERE RANKS: every figure is the ranker's — the score, each path's
// contribution, each step's folded pair, each record's leg. `weight`,
// `magnitude` and `recency` are spot-check fields and never drawn (RankPath.md:
// no step carries a number), so the reads never ask for them.

package com.cogra.domain.score

import java.time.Instant

/** A node's kind as the slice names it (`SliceNode.kind`); [OTHER] for one this build draws no word for. */
enum class TraceNodeKind { USER, POST, COMMENT, HASHTAG, OTHER }

/** A record's family, as the step titles tell them apart (RankPath.md:17-27); [OTHER] reads as an opinion. */
enum class TraceFamily { OPINION, PUBLISH, REVIEW, REFERENCE, TAG, AFFINITY, OTHER }

/** A leg's role (`RecordLegRole`). */
enum class TraceLegRole { BINARY, A, T }

/** One node on a path, as the slice names it (`SliceNode`). */
data class TraceNode(
    val graphId: String,
    /** CoGra's row id; null for a node CoGra carries no row for. */
    val id: String?,
    val kind: TraceNodeKind?,
)

data class TraceLeg(
    val role: TraceLegRole,
    val sourceId: String,
    val targetId: String,
    val pDirected: Double,
    val pInterest: Double,
)

/** A person a trace draws: a face and a handle. */
data class TracePerson(
    val id: String,
    val handle: String,
    val displayName: String?,
    val avatarUrl: String?,
)

data class TraceRecord(
    val id: String,
    val family: TraceFamily,
    /** Null where no account fronts the author (a system actor, a deleted account). */
    val author: TracePerson?,
    /** When the record landed. */
    val landedAt: Instant,
    val legs: List<TraceLeg>,
)

data class TraceHop(
    val pDirected: Double,
    val pInterest: Double,
    /** Exactly the fold's member records, in the causal order. */
    val records: List<TraceRecord>,
)

data class TracePath(
    /** viewer → … → target, persons as one node under their profile identifier. */
    val nodes: List<TraceNode>,
    val sign: Int,
    val contribution: Double,
    /** Hop `i` crosses `nodes[i]` → `nodes[i + 1]`. */
    val hops: List<TraceHop>,
)

/** One `feedTrace` answer. [score] null: no live path reaches the thing — the moved-on state. */
data class TraceAnswer(
    val score: Double?,
    val paths: List<TracePath>,
)

/** A post or a comment a step names in passing (`TraceNodes`). */
sealed interface TraceNamed {
    data class Post(val id: String, val title: String?, val authorHandle: String?) : TraceNamed

    data class Comment(val id: String, val authorHandle: String?) : TraceNamed
}

/** What one open's trace read came to. */
sealed interface TraceFetch {
    /** The read answered; [answer] null where the viewer resolves to no rankable actor. */
    data class Answered(val answer: TraceAnswer?) : TraceFetch

    /** No answer reached the device (copy-voice: "Can't reach the server…"). */
    data object Offline : TraceFetch

    /** The answer was an error — the relay's INTERNAL, the ranker down (copy-voice: "That didn't go through."). */
    data object Fault : TraceFetch
}

/** The trace's reads over the contract. Both are public: guests open traces (Main.md:67). */
interface TraceRepository {
    /**
     * `feedTrace(viewer, target)`: a LIVE read, never cached (PR-39) — every
     * open is a real fetch, so a second open is never served a stale answer.
     */
    suspend fun trace(viewer: String, target: String): TraceFetch

    /**
     * The posts and comments behind [ids], batched once per open
     * (score-readout §7). People need no read: every person on a path is the
     * author of the records its hop carries. A failed read names nothing —
     * the steps fall back to what each node is ("a post").
     */
    suspend fun names(ids: List<String>): Map<String, TraceNamed>
}
