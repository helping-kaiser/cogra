// THE FEED SCORE'S TRACE — four full screens (design/readme.md:1427-1434;
// FeedEntry, FeedEntryMoved, RankPath, RankHop, RankRecords; score-readout
// packet SR-1..SR-4). The score on a card or a detail opens it, and it answers
// why the thing reached the reader: the paths, strongest first, each stating
// what it adds, down to the signed records under every step. The web's twin is
// `web/src/app/trace/[id]/trace-view.tsx`.
//
// WHATEVER FIGURE THE FETCH FINDS — a number, or no paths at all — the reader's
// cards adopt it (`OpenTrace`), and no feed re-orders for it.
//
// THE VIEW SPEAKS ITS OWN PERSON. In the reader's own view the paths start with
// an opinion they gave; under a borrowed view every first person is the
// lender's handle, in the third person (FeedEntry.md:7-9; SR-G3).
//
// THE REGISTER IS GRAPH, PATHS, CONNECTIONS — never statistics: no chart, bar,
// meter, percentage or trend arrow anywhere here (FeedEntry.md:19).

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.ContentRowSecond
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SectionLabel
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.StanceValue
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.score.CLIPPED_RECORDS
import com.cogra.domain.score.PUBLIC_SUM_LINE
import com.cogra.domain.score.SCORE_DASH
import com.cogra.domain.score.TraceAnswer
import com.cogra.domain.score.TraceContext
import com.cogra.domain.score.TraceOrigin
import com.cogra.domain.score.TracePath
import com.cogra.domain.score.TraceStep
import com.cogra.domain.score.flagFigure
import com.cogra.domain.score.foldNote
import com.cogra.domain.score.hopNewest
import com.cogra.domain.score.levelOne
import com.cogra.domain.score.levelOneNote
import com.cogra.domain.score.memberPairs
import com.cogra.domain.score.memberSum
import com.cogra.domain.score.morePathsLabel
import com.cogra.domain.score.opinionsCount
import com.cogra.domain.score.pathNewest
import com.cogra.domain.score.pathPeople
import com.cogra.domain.score.pathValue
import com.cogra.domain.score.placeNote
import com.cogra.domain.score.recordAge
import com.cogra.domain.score.recordsNote
import com.cogra.domain.score.spokenPeople
import com.cogra.domain.score.spokenTrace
import com.cogra.domain.score.stepAge
import com.cogra.domain.score.stepPeople
import com.cogra.domain.score.stepSecondLine
import com.cogra.domain.score.stepTitle
import com.cogra.domain.score.steps
import com.cogra.domain.score.throughLine

/** The four levels' one prefix (nodes.json, round 7). */
internal val FEED_ENTRY = DataNode("feedEntry")

/** The trace, wired: the level's own ViewModel and its one start. */
@Composable
fun TraceRoute(
    args: TraceArgs,
    onBack: () -> Unit,
    onOpen: (TraceLevel) -> Unit,
    viewModel: TraceViewModel = hiltViewModel(),
) {
    LaunchedEffect(args) { viewModel.start(args) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    TraceScreen(
        state = state,
        args = args,
        onBack = onBack,
        onOpen = onOpen,
        onRetry = viewModel::retry,
        onUnfold = viewModel::unfold,
    )
}

/** The level [args] names, if the held answer holds it; one it does not (a stale level) reads as level one. */
private fun shownLevel(args: TraceArgs, answer: TraceAnswer?): TraceLevel {
    val level = args.level
    val path = when (level) {
        TraceLevel.Entry -> return level
        is TraceLevel.Path -> level.path
        is TraceLevel.Step -> level.path
        is TraceLevel.Records -> level.path
    }
    val steps = answer?.paths?.getOrNull(path - 1)?.steps() ?: return TraceLevel.Entry
    val step = when (level) {
        is TraceLevel.Step -> level.step
        is TraceLevel.Records -> level.step
        else -> return level
    }
    return if (steps.getOrNull(step - 1) == null) TraceLevel.Path(path) else level
}

/** The first back arrow's words, by where the score was tapped (graph.json's origin table). */
@Composable
internal fun traceBackLabel(origin: TraceOrigin): String = when (origin) {
    TraceOrigin.Feed -> stringResource(R.string.content_trace_back_feed)
    is TraceOrigin.Post -> stringResource(R.string.content_trace_back_post)
    is TraceOrigin.Tag -> stringResource(R.string.content_trace_back_tag, origin.name)
    TraceOrigin.History -> stringResource(R.string.content_back_history)
    TraceOrigin.Saved -> stringResource(R.string.content_back_saved)
    TraceOrigin.OwnProfile -> stringResource(R.string.content_trace_back_own_profile)
    is TraceOrigin.Profile -> stringResource(R.string.content_trace_back_profile)
}

@Composable
fun TraceScreen(
    state: TraceUiState,
    args: TraceArgs,
    onBack: () -> Unit,
    onOpen: (TraceLevel) -> Unit,
    onRetry: () -> Unit,
    onUnfold: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val answered = state.view as? TraceView.Answered
    val shown = if (answered == null) TraceLevel.Entry else shownLevel(args, answered.held.answer)
    val title = levelTitle(shown)
    val back = levelBack(shown, args.origin)
    val figure = flagOf(state.view)
    val end = TraceEnd(args.kind, args.cover?.markSrc, args.cover?.title.orEmpty())
    Column(modifier.fillMaxSize().dataNodeSurface()) {
        PageHeader(title = title, onBack = onBack, backContentDescription = back, node = FEED_ENTRY / "header")
        ScoreColumn {
            ScoreOrigin(args.cover, args.kind, figure, FEED_ENTRY / "origin")
            when (val view = state.view) {
                TraceView.Settling -> QuietNote(
                    stringResource(R.string.content_trace_settling),
                    Modifier.dataNode(FEED_ENTRY / "note"),
                )
                TraceView.Offline, TraceView.Fault -> TraceFault(offline = view == TraceView.Offline, onRetry = onRetry)
                TraceView.Loading -> Text(
                    text = stringResource(R.string.content_trace_loading),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
                is TraceView.Answered -> Levels(
                    answer = view.held.answer,
                    context = view.context,
                    shown = shown,
                    unfolded = state.unfolded,
                    end = end,
                    onOpen = onOpen,
                    onUnfold = onUnfold,
                )
            }
        }
    }
}

@Composable
private fun levelTitle(shown: TraceLevel): String = stringResource(
    when (shown) {
        TraceLevel.Entry -> R.string.content_trace_title_entry
        is TraceLevel.Path -> R.string.content_trace_title_path
        is TraceLevel.Step -> R.string.content_trace_title_step
        is TraceLevel.Records -> R.string.content_trace_title_records
    },
)

/** The back arrow's words: the origin on level one, the level above on every other. */
@Composable
private fun levelBack(shown: TraceLevel, origin: TraceOrigin): String = when (shown) {
    TraceLevel.Entry -> traceBackLabel(origin)
    is TraceLevel.Path -> stringResource(R.string.content_trace_back_paths)
    is TraceLevel.Step -> stringResource(R.string.content_trace_back_path)
    is TraceLevel.Records -> stringResource(R.string.content_trace_back_step)
}

/**
 * THE FLAG: the signed figure the trace's own fetch found, the dash where it
 * found none or the thing still settles; bare while nothing has answered — a
 * failed read never substitutes a figure (score-readout §5.6).
 */
private fun flagOf(view: TraceView): String? = when (view) {
    TraceView.Settling -> SCORE_DASH
    is TraceView.Answered -> flagFigure(view.held.answer.score)
    else -> null
}

@Composable
private fun Levels(
    answer: TraceAnswer,
    context: TraceContext,
    shown: TraceLevel,
    unfolded: Boolean,
    end: TraceEnd,
    onOpen: (TraceLevel) -> Unit,
    onUnfold: () -> Unit,
) {
    // NO PATHS: the moved-on line, no action, no empty state (FeedEntryMoved.md:3, :11).
    if (answer.paths.isEmpty()) {
        QuietNote(stringResource(R.string.content_trace_moved), Modifier.dataNode(FEED_ENTRY / "note"))
        return
    }
    when (shown) {
        TraceLevel.Entry -> EntryLevel(answer, context, unfolded, end, onOpen, onUnfold)
        is TraceLevel.Path -> PathLevel(answer, shown.path, context, end, onOpen)
        is TraceLevel.Step -> {
            val path = answer.paths[shown.path - 1]
            StepLevel(path, path.steps(), shown.step, context, end) {
                onOpen(TraceLevel.Records(shown.path, shown.step))
            }
        }
        is TraceLevel.Records -> {
            val path = answer.paths[shown.path - 1]
            RecordsLevel(path, path.steps()[shown.step - 1], context)
        }
    }
}

/** Level one: the paths, strongest first, the handful drawn and the rest on one quiet row. */
@Composable
private fun EntryLevel(
    answer: TraceAnswer,
    context: TraceContext,
    unfolded: Boolean,
    end: TraceEnd,
    onOpen: (TraceLevel) -> Unit,
    onUnfold: () -> Unit,
) {
    val level = answer.levelOne(unfolded)
    val lender = answer.paths.firstOrNull()?.let(::pathPeople)?.firstOrNull()?.handle
    QuietNote(levelOneNote(context, lender), Modifier.dataNode(FEED_ENTRY / "note"))
    SectionLabel(stringResource(R.string.content_trace_strongest), node = FEED_ENTRY / "pathsLabel")
    Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        level.drawn.forEach { drawn ->
            val path = answer.paths[drawn.index]
            val row = (FEED_ENTRY / "path").keyed((drawn.index + 1).toString())
            PathRow(
                through = throughLine(path, context),
                value = drawn.value,
                onOpen = { onOpen(TraceLevel.Path(drawn.index + 1)) },
                node = row,
            ) {
                PathTrace(
                    people = pathPeople(path),
                    end = end,
                    spoken = spokenTrace(path, context),
                    onCard = true,
                    node = DataNode("feedEntry.path.trace"),
                )
            }
        }
        // THE QUIET ROW: a state change on this screen, not a fifth destination
        // — the weakest paths unfold in place, never on a second page.
        level.more?.let { more ->
            val label = morePathsLabel(more.count)
            MorePathsRow(
                label = label,
                value = more.value,
                name = stringResource(R.string.content_trace_show_more, label),
                onUnfold = onUnfold,
            )
        }
    }
}

/** Level two: one path — its facts before its steps; no step carries a number (RankPath.md:3-5). */
@Composable
private fun PathLevel(
    answer: TraceAnswer,
    place: Int,
    context: TraceContext,
    end: TraceEnd,
    onOpen: (TraceLevel) -> Unit,
) {
    val path = answer.paths[place - 1]
    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
        PathTrace(pathPeople(path), end, spokenTrace(path, context), size = 32.dp, node = FEED_ENTRY / "trace")
    }
    Column {
        SettingRow(
            label = stringResource(R.string.content_trace_adds),
            value = answer.pathValue(place - 1),
            node = FEED_ENTRY / "adds",
        )
        SettingRow(
            label = stringResource(R.string.content_trace_newest_on_it),
            value = pathNewest(path, context),
            node = FEED_ENTRY / "newest",
        )
        Hairline()
    }
    SectionLabel(stringResource(R.string.content_trace_steps), node = FEED_ENTRY / "stepsLabel")
    Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        path.steps().forEachIndexed { index, step ->
            val hop = step.carrying
            ContentRow(
                title = stepTitle(path, step, context),
                disc = ContentRowDisc.Face(hop.pDirected, hop.pInterest),
                testTag = "feedEntry_step_${index + 1}",
                second = { ContentRowSecond(stepSecondLine(path, step, context)) },
                trailing = stepAge(path, step, context),
                onOpen = { onOpen(TraceLevel.Step(place, index + 1)) },
                node = (FEED_ENTRY / "step").keyed((index + 1).toString()),
                chevron = true,
            )
        }
    }
}

/** Level three: one step — its folded value, the records behind it, and the fold in the giver's word. */
@Composable
private fun StepLevel(
    path: TracePath,
    steps: List<TraceStep>,
    place: Int,
    context: TraceContext,
    end: TraceEnd,
    onRecords: () -> Unit,
) {
    val step = steps[place - 1]
    val hop = step.carrying
    val people = stepPeople(path, step)
    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
        PathTrace(people, end, spokenPeople(people, context), size = 32.dp, node = FEED_ENTRY / "trace")
    }
    QuietNote(placeNote(stepTitle(path, step, context), place, steps.size), Modifier.dataNode(FEED_ENTRY / "note"))
    Column {
        SettingRow(label = stringResource(R.string.content_trace_carries), node = FEED_ENTRY / "carries") {
            StanceValue(StancePoint(hop.pDirected, hop.pInterest), node = FEED_ENTRY / "carries" / "value")
        }
        SettingRow(
            label = stringResource(R.string.content_trace_behind),
            value = opinionsCount(hop.records.size),
            actionText = stringResource(R.string.content_trace_show_them),
            onAction = onRecords,
            node = FEED_ENTRY / "behind",
        )
        SettingRow(
            label = stringResource(R.string.content_trace_newest_of_them),
            value = hopNewest(hop, context.now),
            node = FEED_ENTRY / "newest",
        )
        Hairline()
    }
    QuietNote(foldNote(path, step, context), Modifier.dataNode(FEED_ENTRY / "foldNote"))
}

/** Level four, the floor: the signed records behind one step, inert, each with its key. */
@Composable
private fun RecordsLevel(path: TracePath, step: TraceStep, context: TraceContext) {
    val title = stepTitle(path, step, context)
    val pairs = memberPairs(path, step)
    val sum = memberSum(path, step)
    QuietNote(recordsNote(title, pairs.size), Modifier.dataNode(FEED_ENTRY / "note"))
    Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        pairs.forEach { member ->
            RecordRow(
                key = member.record.id,
                // A RECORD SAYS WHAT IT IS IN ITS STEP'S OWN TITLE (RankRecords.md:11).
                what = title,
                age = recordAge(member.record, context.now),
                pair = StancePoint(member.pDirected, member.pInterest),
            )
        }
    }
    if (sum.clipped) {
        QuietNote(CLIPPED_RECORDS, Modifier.dataNode(DataNode("feedEntry_clipped")))
        val carried = step.carrying
        UnclippedSum(StancePoint(sum.pDirected, sum.pInterest), StancePoint(carried.pDirected, carried.pInterest))
    }
    QuietNote(PUBLIC_SUM_LINE, Modifier.dataNode(FEED_ENTRY / "closingNote"))
}

/** The fault (SR-G16's build reading, §5.6): the house line and its way back, never a substituted figure. */
@Composable
private fun TraceFault(offline: Boolean, onRetry: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(Space.x3), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = stringResource(if (offline) R.string.content_trace_offline else R.string.content_trace_fault),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier
                .weight(1f)
                .dataNode(DataNode("feedEntry_fault"))
                .semantics { liveRegion = LiveRegionMode.Assertive },
        )
        CograButton(
            text = stringResource(R.string.content_trace_retry),
            onClick = onRetry,
            kind = ButtonKind.Outlined,
            size = ButtonSize.Compact,
            testTag = "feedEntry_retry",
        )
    }
}

/** The unclipped sum beside the step's pair, in exact values only (RankRecords.md:9). */
@Composable
private fun UnclippedSum(sum: StancePoint, carried: StancePoint) {
    if (!LocalShowExactValues.current) return
    Text(
        text = "${sum.pair()} → ${carried.pair()}",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.dataNode(DataNode("feedEntry_unclippedSum")),
    )
}
