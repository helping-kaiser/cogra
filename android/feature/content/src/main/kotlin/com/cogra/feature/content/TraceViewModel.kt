// THE FEED SCORE'S TRACE, HELD (score-readout packet SR-1..SR-3; CD-SR2,
// CD-SR3; PR-39): each level is its own back-stack entry, so the system back
// steps up the levels; level one makes the open's one live fetch, and the
// deeper levels read the answer it held (`TraceSession`) — a back returns to
// the held state, and nothing re-asks in the background. A level reached cold
// (process death restored it) finds nothing held and makes its own one fetch.
//
// A THING STILL SETTLING MAKES NO FETCH (FeedEntryMoved.md:9): it has no figure
// by construction, so its trace is the cover, the dash and one line.

package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.score.OpenTrace
import com.cogra.domain.score.TraceContext
import com.cogra.domain.score.TraceHeld
import com.cogra.domain.score.TraceOrigin
import com.cogra.domain.score.TraceRead
import com.cogra.domain.score.TraceSession
import com.cogra.domain.score.TraceThingKind
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** How deep in the trace: level one, a path, a step on it, its records. Paths and steps count from 1. */
sealed interface TraceLevel {
    data object Entry : TraceLevel

    data class Path(val path: Int) : TraceLevel

    data class Step(val path: Int, val step: Int) : TraceLevel

    data class Records(val path: Int, val step: Int) : TraceLevel
}

/** What a trace route carries: the thing, where it was tapped, and how deep the reader is. */
data class TraceArgs(
    val targetId: String,
    val kind: TraceThingKind,
    val origin: TraceOrigin,
    /** The thing has not landed: the trace makes no fetch. */
    val settling: Boolean,
    /** The view the tapped figure was computed in (CD-SR1); null when none was held. */
    val viewer: String?,
    /** The thing as its card held it, read at the tap. */
    val cover: TraceCover?,
    val level: TraceLevel = TraceLevel.Entry,
)

/** What one level shows. */
sealed interface TraceView {
    data object Loading : TraceView

    /** The thing is still settling: no fetch, the dash and its one line. */
    data object Settling : TraceView

    /** The open's answer, and the words' context read against it. */
    data class Answered(val held: TraceHeld, val context: TraceContext) : TraceView

    /** No answer reached the device. */
    data object Offline : TraceView

    /** The answer was an error: the house's line, under a cover that stands. */
    data object Fault : TraceView
}

data class TraceUiState(
    val view: TraceView = TraceView.Loading,
    /** The quiet row unfolded its paths in place (FeedEntry.md:17). */
    val unfolded: Boolean = false,
)

@HiltViewModel
class TraceViewModel @Inject constructor(
    private val openTrace: OpenTrace,
    private val session: TraceSession,
    private val feedViewer: FeedViewer,
) : ViewModel() {

    private val _state = MutableStateFlow(TraceUiState())
    val state: StateFlow<TraceUiState> = _state.asStateFlow()

    private var args: TraceArgs? = null

    /** The clock the ages read, fixed for the open so a level never re-ages under the reader. */
    internal var now: () -> Instant = Instant::now

    /** The level arrived: once per entry, whatever recomposes. */
    fun start(arrived: TraceArgs) {
        if (args != null) return
        args = arrived
        if (arrived.settling) {
            _state.update { it.copy(view = TraceView.Settling) }
            return
        }
        val held = session.heldFor(arrived.targetId).takeIf { arrived.level != TraceLevel.Entry }
        viewModelScope.launch {
            if (held != null) show(arrived, held) else read(arrived)
        }
    }

    /** The fault's Retry: the open's fetch, again. */
    fun retry() {
        val open = args ?: return
        _state.update { it.copy(view = TraceView.Loading) }
        viewModelScope.launch { read(open) }
    }

    /** The quiet row: the weakest paths unfold in place, never a second page. */
    fun unfold() = _state.update { it.copy(unfolded = true) }

    private suspend fun read(open: TraceArgs) {
        when (val read = openTrace(open.targetId, open.viewer)) {
            is TraceRead.Answered -> show(open, read.held)
            TraceRead.Offline -> _state.update { it.copy(view = TraceView.Offline) }
            TraceRead.Fault -> _state.update { it.copy(view = TraceView.Fault) }
        }
    }

    private suspend fun show(open: TraceArgs, held: TraceHeld) {
        val context = TraceContext(
            viewer = held.viewer,
            // THE VIEW SPEAKS ITS OWN PERSON: a walk from anyone but the
            // reader is a borrowed view, spoken in the lender's third person.
            borrowed = held.viewer != feedViewer.reader(),
            named = held.named,
            targetKind = open.kind,
            targetCreatedAt = open.cover?.createdAt,
            now = now(),
        )
        _state.update { it.copy(view = TraceView.Answered(held, context)) }
    }
}
