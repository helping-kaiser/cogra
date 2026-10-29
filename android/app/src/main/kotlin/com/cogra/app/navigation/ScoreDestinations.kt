// THE FEED SCORE'S TRACE IN THE GRAPH (FeedEntry, RankPath, RankHop,
// RankRecords; graph.json's `Feed score` edges): a read drill-in over the card's
// root — it stands in the stack of the tab it was opened from, so that tab's
// slot stays lit (design/readme.md §13, "a stack is where a screen was opened
// FROM") — and each level is its own entry, so the system back steps up the
// levels and the first back arrow returns to where the score was tapped.

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.cogra.domain.score.TraceOrigin
import com.cogra.domain.score.TraceThingKind
import com.cogra.feature.content.ProvideScoreDoor
import com.cogra.feature.content.ScoreTap
import com.cogra.feature.content.TraceArgs
import com.cogra.feature.content.TraceCover
import com.cogra.feature.content.TraceLevel
import com.cogra.feature.content.TraceRoute
import java.time.Instant

/** The trace's level for [route]'s `path`, `step` and `records` (counted from 1; 0 is none). */
private fun ScoreTrace.level(): TraceLevel = when {
    path < 1 -> TraceLevel.Entry
    step < 1 -> TraceLevel.Path(path)
    records -> TraceLevel.Records(path, step)
    else -> TraceLevel.Step(path, step)
}

/** The same trace, at [level]. */
private fun ScoreTrace.at(level: TraceLevel): ScoreTrace = when (level) {
    TraceLevel.Entry -> copy(path = 0, step = 0, records = false)
    is TraceLevel.Path -> copy(path = level.path, step = 0, records = false)
    is TraceLevel.Step -> copy(path = level.path, step = level.step, records = false)
    is TraceLevel.Records -> copy(path = level.path, step = level.step, records = true)
}

private fun ScoreTrace.args(): TraceArgs = TraceArgs(
    targetId = targetId,
    kind = TraceThingKind.entries.firstOrNull { it.name == kind } ?: TraceThingKind.POST,
    origin = TraceOrigin.of(from),
    settling = settling,
    viewer = viewer,
    cover = coverTitle?.let { title ->
        TraceCover(
            kind = TraceThingKind.entries.firstOrNull { it.name == kind } ?: TraceThingKind.POST,
            title = title,
            snippet = coverSnippet,
            discName = discName,
            discSrc = discSrc,
            markSrc = markSrc,
            createdAt = createdAt?.let(Instant::parse),
        )
    },
    level = level(),
)

/** The trace a score's [tap] opens, over [origin]. */
internal fun ScoreTap.route(origin: TraceOrigin) = ScoreTrace(
    targetId = targetId,
    kind = kind.name,
    from = origin.param,
    settling = settling,
    viewer = viewer,
    coverTitle = cover.title,
    coverSnippet = cover.snippet,
    discName = cover.discName,
    discSrc = cover.discSrc,
    markSrc = cover.markSrc,
    createdAt = cover.createdAt?.toString(),
)

/** The trace's levels: what every tab's stack can hold above a card that wears a score. */
internal fun NavGraphBuilder.scoreTrace(shell: ShellScope) {
    composable<ScoreTrace> { entry ->
        val route = entry.toRoute<ScoreTrace>()
        TraceRoute(
            args = route.args(),
            onBack = { shell.navController.navigateUp() },
            onOpen = { level -> shell.navController.navigate(route.at(level)) },
        )
    }
}

/**
 * Gives [content]'s score slots their door (FeedKinds.md:3; History.md:63;
 * Saved.md:39; PostDetail.md:19): [reader]'s figures, each tap opening the
 * trace over [origin], whose back arrow names it.
 */
@Composable
internal fun ShellScope.ScoresOpenOver(origin: TraceOrigin, reader: String?, content: @Composable () -> Unit) {
    ProvideScoreDoor(reader = reader, onOpen = { tap -> navController.navigate(tap.route(origin)) }, content = content)
}
