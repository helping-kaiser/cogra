// THE CARD'S SCORE SLOT (FeedKinds.md:3-15; PostDetail.md:17-19; History.md:29,63;
// Saved.md:13,39): the Feed score every ranked card wears, between the opinion
// and the kind's own act, and the DOOR to its trace (ExplainableNumber). The
// web's twin is `web/src/lib/score/score-slot.tsx`.
//
// WHAT IT READS is the figure the latest fetch of its thing found — the
// reader's own last feed fetch, or its trace's fetch since (`Standings`):
// - a computed figure: the plain number (`15.20`, a negative's `−`);
// - none computed — a lookup miss, or a trace that found no paths: the dash,
//   still a door, since the tap is the one live fetch that can answer it;
// - a thing still settling: the compact slot stands BARE beside the card's
//   pending mark, and the detail reads the dash (FeedKinds.md:15;
//   ComposeLanded.md:5) — either way the door opens the trace that makes no
//   fetch (SR-G2(b): the settling slot is a door everywhere).
//
// THE TAP HANDS THE TRACE WHAT THE CARD HOLDS — the thing's cover and the view
// its figure was computed in (CD-SR1) — and the trace makes the one fetch.
//
// A SURFACE WEARS THE SLOT BY PROVIDING ITS DOOR ([LocalScoreDoor]): the shell
// gives each destination that draws ranked cards the door that opens the trace
// over it. A surface with none draws no slot, rather than a door to nowhere.

package com.cogra.feature.content

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.ExplainableNumber
import com.cogra.domain.score.FeedStandings
import com.cogra.domain.score.SCORE_DASH
import com.cogra.domain.score.Standing
import com.cogra.domain.score.Standings
import com.cogra.domain.score.TraceThingKind
import com.cogra.domain.score.cardFigure
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** A score's tap: the thing, how its card holds it, and the view its figure came from (CD-SR1). */
data class ScoreTap(
    val targetId: String,
    val kind: TraceThingKind,
    /** The thing has not landed: its trace makes no fetch (FeedEntryMoved.md:9). */
    val settling: Boolean,
    /** The view the tapped figure was computed in; null where none was held. */
    val viewer: String?,
    val cover: TraceCover,
)

/** What a surface's score slots read, and where their taps go. */
@Stable
class ScoreDoor(
    val standings: Standings,
    /** Whose figures they are: the signed-in account, or null for a guest. */
    val reader: String?,
    val onOpen: (ScoreTap) -> Unit,
)

/** The surface's door; null draws no score slot. */
val LocalScoreDoor = compositionLocalOf<ScoreDoor?> { null }

/** The process's standings, for a destination's score slots to read. */
@HiltViewModel
class ScoreDoorViewModel @Inject constructor(standings: FeedStandings) : ViewModel() {
    val standings = standings.state
}

/** Gives [content]'s score slots their door: [reader]'s figures, each tap handed to [onOpen]. */
@Composable
fun ProvideScoreDoor(
    reader: String?,
    onOpen: (ScoreTap) -> Unit,
    viewModel: ScoreDoorViewModel = hiltViewModel(),
    content: @Composable () -> Unit,
) {
    val standings by viewModel.standings.collectAsStateWithLifecycle()
    CompositionLocalProvider(LocalScoreDoor provides ScoreDoor(standings, reader, onOpen), content = content)
}

/**
 * One card's score. [pending] is the thing's own landing state as its row
 * carries it; [dashWhileSettling] is the detail's face for a thing still
 * settling (ComposeLanded.md:5), never a bare glyph.
 */
@Composable
internal fun ScoreSlot(
    targetId: String,
    kind: TraceThingKind,
    pending: Boolean,
    cover: TraceCover,
    node: DataNode?,
    testTag: String,
    modifier: Modifier = Modifier,
    dashWhileSettling: Boolean = false,
) {
    val door = LocalScoreDoor.current ?: return
    val standing = door.standings.of(door.reader, targetId, pending)
    val settling = standing == Standing.Settling
    val value = when (standing) {
        is Standing.Figure -> cardFigure(standing.score)
        Standing.Dash -> SCORE_DASH
        Standing.Settling -> SCORE_DASH.takeIf { dashWhileSettling }
    }
    ExplainableNumber(
        label = stringResource(R.string.content_feed_score),
        value = value,
        onOpen = {
            door.onOpen(
                ScoreTap(
                    targetId = targetId,
                    kind = kind,
                    settling = settling,
                    viewer = if (settling) null else door.standings.viewerFor(door.reader),
                    cover = cover,
                ),
            )
        },
        modifier = modifier,
        node = node,
        testTag = testTag,
    )
}
