// WHAT CITES THIS (`design/designs/canonical/screens/CitedBy.jsx`,
// `CommentCitedByEmpty.jsx`; CitedBy.md, CommentCitedByEmpty.md). The web's
// twin is `web/src/lib/ui2/cited-by-sheet.tsx`.
//
// IT IS NOT `RefsSheet` WITH MORE IN IT (CitedBy.md:11). That sheet holds the
// tags and citations the AUTHOR signed; these are other people's acts, by
// other authors, in a different order — folded together, neither number would
// be checkable.
//
// ONE ROW PER STANDING CITATION, NEWEST FIRST (CitedBy.md:7, :9): the rows are
// the fold over the records (`CitingFold.kt`), handed in whole. The opinions
// sheet is strongest-first; this one is a CHRONICLE of acts, where what a
// reader comes for is what has just arrived.
//
// THE ROWS ARE `ReferenceRow` in its citation family (CitedBy.md:13): the
// kind's own mark, the artifact's name, and the pair its author signed, its
// digits the geek reading. A sheet of rows: the surface pads nothing, and each
// row carries its own 24dp gutter, as the title and the empty line do.
//
// NOTHING READ HERE REACHES A FEED. Inbound records are public topology and
// display only; only viewer-rooted forward paths shape a rank.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.ReferenceRow
import com.cogra.core.designsystem.v2.atom.RowEdge
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.sheetCeilingHeight
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.Outcome
import com.cogra.domain.references.CitedByRepository
import com.cogra.domain.references.CitingArtifact
import com.cogra.domain.references.CitingKind
import com.cogra.domain.references.CitingView
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.NodeOpinionsRepository
import com.cogra.domain.valueOrNull
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** The default class: a sheet stacked over the thread (`CommentCitedByEmpty.jsx`, 62%). */
internal const val SHEET_DEFAULT_SHARE = 0.62f

/** The raised class: the lists that need the room (`CitedBy.jsx`, `BottomSheet.jsx`: 88%). */
internal const val SHEET_RAISED_SHARE = 0.88f

/** The registered sheet on the post detail (nodes.json CitedBy: `postDetail.citedBySheet`). */
internal val CITED_BY_SHEET = POST_DETAIL / "citedBySheet"

/**
 * The reads behind the two reading rows of every menu: what cites a node, and
 * who holds an opinion on it. Provided by [InboundReadsViewModel] in the app; a
 * test provides its own, and a read it does not script fails rather than
 * answering for it.
 */
@Stable
class InboundReads(
    val citedBy: suspend (nodeId: String) -> Outcome<List<CitingArtifact<CitingView>>> = { unscripted() },
    val opinionsOn: suspend (nodeId: String) -> Outcome<List<HeldOpinion>> = { unscripted() },
)

private fun unscripted(): Outcome<Nothing> = Outcome.Failed(UnsupportedOperationException("read not provided"))

/** The surface's reads; null falls back to the destination's [InboundReadsViewModel]. */
val LocalInboundReads = compositionLocalOf<InboundReads?> { null }

/** The process's inbound reads, for a sheet a menu row raises. */
@HiltViewModel
class InboundReadsViewModel @Inject constructor(
    citing: CitedByRepository,
    opinions: NodeOpinionsRepository,
) : ViewModel() {
    val reads = InboundReads(citedBy = citing::citedBy, opinionsOn = opinions::opinionsOn)
}

@Composable
internal fun inboundReads(): InboundReads = LocalInboundReads.current ?: hiltViewModel<InboundReadsViewModel>().reads

/** A sheet's height share of the window, held under the ceiling (`BottomSheet.jsx`'s `maxHeight`). */
@Composable
internal fun sheetShareHeight(share: Float): Dp {
    val window = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.height.toDp() }
    return (window * share).coerceAtMost(sheetCeilingHeight())
}

/**
 * The Cited by sheet for [nodeId], reading what cites it as it opens.
 *
 * The rows are null while the read is out — the sheet stands titled and
 * holds nothing until it answers, and a read that fails leaves it so (the
 * web's twin's behaviour): an empty line there would claim nothing cites a
 * node the read never reached.
 *
 * @param stacked the comment's door in the thread: raised over the thread's own
 *   sheet at the default class, the next rung up (CommentCitedByEmpty.md:3).
 *   Every other door draws it unstacked at the raised class.
 * @param onOpenPost a row's door: the citing post, or the post a citing comment
 *   answers (CitedBy.md:15). The sheet is the door, not the destination: it
 *   closes as the row is followed, so Back lands where the reader opened it.
 * @param node the registered sheet where a board draws one (the detail's,
 *   [CITED_BY_SHEET]); null keeps [testTag].
 */
@Composable
internal fun CitedBySheet(
    nodeId: String,
    onDismiss: () -> Unit,
    onOpenPost: (String) -> Unit,
    stacked: Boolean = false,
    node: DataNode? = null,
    testTag: String = "cited_by_sheet",
) {
    val reads = inboundReads()
    val rows by produceState<List<CitingArtifact<CitingView>>?>(null, nodeId) {
        value = reads.citedBy(nodeId).valueOrNull()
    }
    CitedBySheetContent(
        rows = rows,
        onDismiss = onDismiss,
        onOpenPost = onOpenPost,
        stacked = stacked,
        node = node,
        testTag = testTag,
    )
}

/** The sheet over [rows] as read: null while the read is out, empty when nothing cites the node. */
@Composable
internal fun CitedBySheetContent(
    rows: List<CitingArtifact<CitingView>>?,
    onDismiss: () -> Unit,
    onOpenPost: (String) -> Unit,
    stacked: Boolean = false,
    node: DataNode? = null,
    testTag: String = "cited_by_sheet",
) {
    CograSheetHost(onDismissRequest = onDismiss) {
        CograSheetSurface(
            modifier = Modifier.heightIn(
                max = sheetShareHeight(if (stacked) SHEET_DEFAULT_SHARE else SHEET_RAISED_SHARE),
            ),
            edgeToEdge = true,
            stacked = stacked,
            gap = 0.dp,
            testTag = node?.tag ?: testTag,
            handleTestTag = node?.div("dragHandle")?.tag,
        ) {
            // `SheetTitle`'s own `0 24 8`.
            SheetTitle(
                text = stringResource(R.string.content_cited_by_title),
                modifier = Modifier
                    .padding(start = Space.x6, end = Space.x6, bottom = Space.x2)
                    .dataNode(node?.div("title")),
            )
            when {
                rows == null -> Unit
                rows.isEmpty() -> Box(
                    Modifier.fillMaxWidth().padding(start = Space.x6, end = Space.x6, bottom = Space.x2),
                ) {
                    // CitedBy.md:19, CommentCitedByEmpty.md:7-9: the line alone, calm, never the error colour.
                    EmptyState(
                        testTag = "${testTag}_empty",
                        title = stringResource(R.string.content_cited_by_empty),
                        node = node?.div("empty")?.keyed("empty"),
                    )
                }
                else -> LazyColumn(Modifier.fillMaxWidth()) {
                    itemsIndexed(rows, key = { _, row -> row.key }) { index, row ->
                        CitationRow(row, index, onDismiss, onOpenPost, node, testTag)
                    }
                }
            }
        }
    }
}

/** One citation: keyed by its place, newest first, from 1 (nodes.json CitedBy's `citation`). */
@Composable
private fun CitationRow(
    row: CitingArtifact<CitingView>,
    index: Int,
    onDismiss: () -> Unit,
    onOpenPost: (String) -> Unit,
    node: DataNode?,
    testTag: String,
) {
    val view = row.target
    val opens = view.opensPost
    ReferenceRow(
        kind = if (view.kind == CitingKind.COMMENT) MarkKind.COMMENT else MarkKind.POST,
        name = view.name,
        src = view.cover,
        edge = RowEdge.Citation(StancePoint(directed = row.pair.pDirected, interest = row.pair.pInterest)),
        // The chronicle serves ordered fact only, so a row read from it has
        // landed: Cited by draws no settling row.
        pending = false,
        removed = view.name.takeIf { view.redacted },
        onOpen = opens?.let {
            {
                onDismiss()
                onOpenPost(it)
            }
        },
        node = node?.div("citation")?.keyed("${index + 1}"),
        testTag = "${testTag}_row_${index + 1}",
    )
}
