// A THING'S STANDING ON EVERY SURFACE THAT WEARS ITS SCORE (score-readout
// packet CD-SR5, CD-9; FeedKinds.md:7-15; PostDetail.md:19; History.md:29;
// Saved.md:13; TagPage.md:23; Reel.md:21-29). The web's twin is
// `web/src/lib/score/standing.ts`.
//
// "The figure the latest fetch of its thing found — the reader's own last
// feed fetch, or its trace's fetch since — a dash only where that fetch found
// none." So one store holds both fetches:
//
// - THE HELD RANKING: the reader's last `feedRanking` answer, UNCUT (CD-9) —
//   the same answer the feed derives its list from, so a thing the derive cut
//   as seen or out of the reader's people still hits. Every off-feed slot looks
//   its thing up here (PR-40), and a miss is the dash.
// - THE ADOPTIONS: what each trace's live fetch found, per thing, whichever
//   surface it was opened from (PR-39). A figure the trace found replaces the
//   held one everywhere that thing is drawn — a number, or the dash where the
//   trace found no paths — and the old figure never shows again. Nothing ever
//   re-orders for it: the store is read for figures, and no list is sorted by
//   it.
//
// ONLY A FEED FETCH CLEARS AN ADOPTION (FeedKinds.md:13; CD-9): a new ranking
// replaces the held answer and every adoption with it; a local re-derive keeps
// the same answer and never reaches here. Nothing re-reads anything in the
// background (FeedKinds.md:9): the trace's tap is the only per-thing fetch.
//
// THE STORE IS ONE READER'S, like the feed's memory: a different reader is a
// ranking that has not been fetched yet, never someone else's figures. It lives
// as long as the process, as the feed's held answer does.

package com.cogra.domain.score

import com.cogra.domain.feed.FeedRanking
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

/** What a score slot shows for a thing. */
sealed interface Standing {
    /** A computed score, the ranker's exact value. */
    data class Figure(val score: Double) : Standing

    /** No figure is computed — a lookup miss, or a trace that found no paths (FeedEntryMoved.md:5). */
    data object Dash : Standing

    /** The thing has not landed: no figure by construction (item 90); its trace makes no fetch. */
    data object Settling : Standing
}

/**
 * One reader's figures: the held ranking ([viewer] is whose view it ranked —
 * the reader's own actor or the borrowed vantage, CD-5) and the trace
 * adoptions over it.
 */
class Standings internal constructor(
    val reader: String?,
    val viewer: String?,
    private val ranking: FeedRanking?,
    private val adopted: Map<String, Double?>,
) {
    private val scores: Map<String, Double> by lazy {
        ranking?.entries.orEmpty().associate { it.targetId to it.score }
    }
    private val settling: Set<String> by lazy {
        ranking?.settling.orEmpty().mapTo(HashSet()) { it.targetId }
    }

    /**
     * [targetId]'s standing for [forReader]. [pending] is the thing's own
     * landing state as its row carries it; a thing the held answer lists as
     * settling is settling too.
     */
    fun of(forReader: String?, targetId: String, pending: Boolean): Standing {
        val mine = forReader == reader
        if (pending || (mine && targetId in settling)) return Standing.Settling
        if (!mine) return Standing.Dash
        if (adopted.containsKey(targetId)) {
            return adopted[targetId]?.let(Standing::Figure) ?: Standing.Dash
        }
        return scores[targetId]?.let(Standing::Figure) ?: Standing.Dash
    }

    /**
     * The view [forReader]'s figures were computed in, or null with no ranking
     * held for them (CD-SR1: a trace keeps the view its figure came from, so an
     * adopted figure is the same view's).
     */
    fun viewerFor(forReader: String?): String? = viewer.takeIf { ranking != null && forReader == reader }

    internal fun adopting(targetId: String, score: Double?) =
        Standings(reader, viewer, ranking, adopted + (targetId to score))

    companion object {
        /** Nothing held: a cold start. */
        val NONE = Standings(reader = null, viewer = null, ranking = null, adopted = emptyMap())
    }
}

/** The process's one store of standings, read by every score slot and written by the feed and the trace. */
@Singleton
class FeedStandings @Inject constructor() {
    private val _state = MutableStateFlow(Standings.NONE)
    val state: StateFlow<Standings> = _state.asStateFlow()

    /**
     * A feed fetch landed: [ranking] becomes the lookup source for [reader] and
     * every adoption is dropped. A null ranking — no rankable view — holds
     * nothing.
     */
    fun hold(reader: String?, ranking: FeedRanking?, viewer: String?) {
        _state.value = if (ranking == null || viewer == null) {
            Standings(reader, null, null, emptyMap())
        } else {
            Standings(reader, viewer, ranking, emptyMap())
        }
    }

    /** A trace's live fetch found [score] for [targetId] (null: no paths). */
    fun adopt(targetId: String, score: Double?) = _state.update { it.adopting(targetId, score) }
}
