// WHO HOLDS AN OPINION ON THIS (`design/designs/canonical/screens/
// PostOpinions.jsx`, `CommentOpinionsEmpty.jsx`; PostOpinions.md,
// CommentOpinionsEmpty.md). The web's twin is `web/src/lib/ui2/opinions-sheet.tsx`.
//
// THE PROFILE'S "OPINIONS ON THEM", MIRRORED ONTO CONTENT — and ungated: every
// reader sees every row, the author no more than a stranger (PostOpinions.md:7).
//
// THE COUNT IS THE LIST'S LENGTH, ONE ROW PER PERSON (PostOpinions.md:11): the
// fold over their records (`HeldOpinions.kt`), handed in whole, so a revised
// opinion is one row at its standing value.
//
// THE ROWS ARE `StanceRow`, the master the profile's own opinions page uses:
// the person, and their public opinion, its face leading and its pair the geek
// reading — strongest first, down past nothing into the ones held against
// (PostOpinions.md:9), so the order means the same thing wherever a reader
// meets it. A deleted holder keeps its row where its value puts it: the
// reserved disc, `Deleted account`, no handle line (:13-15).

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.StanceRow
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.valueOrNull

/** The registered sheet on the post detail (nodes.json PostOpinions: `postDetail.opinionsSheet`). */
internal val OPINIONS_SHEET = POST_DETAIL / "opinionsSheet"

/** What the opinions are on — the title's noun (copy-voice, *The opinions list*). */
internal enum class OpinionsOn { Post, Comment }

/**
 * The opinions sheet for [nodeId], reading who holds an opinion on it as it
 * opens. The rows are null while the read is out — titled, nothing under it,
 * as the web's twin; a failed read leaves it so rather than claiming nobody
 * holds one.
 *
 * @param stacked the comment's door in the thread: over the thread's own sheet
 *   at the default class (CommentOpinionsEmpty.md:3); every other door draws it
 *   unstacked at the raised class.
 * @param onOpenPerson a row's door, the holder's handle: their profile, where
 *   acting on an opinion lives — a deleted holder's page too
 *   (PostOpinions.md:17). The sheet is the door, not the destination: it
 *   closes as the row is followed.
 * @param node the registered sheet where a board draws one ([OPINIONS_SHEET]);
 *   null keeps [testTag].
 */
@Composable
internal fun OpinionsSheet(
    nodeId: String,
    on: OpinionsOn,
    onDismiss: () -> Unit,
    onOpenPerson: (String) -> Unit,
    stacked: Boolean = false,
    node: DataNode? = null,
    testTag: String = "opinions_sheet",
) {
    val reads = inboundReads()
    val rows by produceState<List<HeldOpinion>?>(null, nodeId) {
        value = reads.opinionsOn(nodeId).valueOrNull()
    }
    OpinionsSheetContent(rows, on, onDismiss, onOpenPerson, stacked, node, testTag)
}

/** The sheet over [rows] as read: null while the read is out, empty when nobody holds an opinion. */
@Composable
internal fun OpinionsSheetContent(
    rows: List<HeldOpinion>?,
    on: OpinionsOn,
    onDismiss: () -> Unit,
    onOpenPerson: (String) -> Unit,
    stacked: Boolean = false,
    node: DataNode? = null,
    testTag: String = "opinions_sheet",
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
            SheetTitle(
                text = stringResource(
                    when (on) {
                        OpinionsOn.Post -> R.string.content_opinions_title_post
                        OpinionsOn.Comment -> R.string.content_opinions_title_comment
                    },
                ),
                modifier = Modifier
                    .padding(start = Space.x6, end = Space.x6, bottom = Space.x2)
                    .dataNode(node?.div("title")),
            )
            when {
                rows == null -> Unit
                rows.isEmpty() -> Box(
                    Modifier.fillMaxWidth().padding(start = Space.x6, end = Space.x6, bottom = Space.x2),
                ) {
                    // PostOpinions.md:25, CommentOpinionsEmpty.md:7-9: the line alone, calm, never the error colour.
                    EmptyState(
                        testTag = "${testTag}_empty",
                        title = stringResource(R.string.content_opinions_empty),
                        node = node?.div("empty")?.keyed("empty"),
                    )
                }
                else -> LazyColumn(Modifier.fillMaxWidth()) {
                    items(rows, key = { it.holderId }) { opinion ->
                        OpinionRow(opinion, onDismiss, onOpenPerson, node, testTag)
                    }
                }
            }
        }
    }
}

/**
 * One holder (`StanceRow`): `opinion` keyed by the holder's id, a deleted
 * holder `redactedOpinion` keyed by its actor id (nodes.json PostOpinions).
 * An address no account fronts keeps its row, named by its address, with
 * nothing to open.
 */
@Composable
private fun OpinionRow(
    opinion: HeldOpinion,
    onDismiss: () -> Unit,
    onOpenPerson: (String) -> Unit,
    node: DataNode?,
    testTag: String,
) {
    val holder = opinion.holder
    val key = holder.actorId ?: opinion.holderId
    val rowNode = node?.let { (it / if (holder.redacted) "redactedOpinion" else "opinion").keyed(key) }
    StanceRow(
        name = holder.displayName?.takeIf { it.isNotBlank() } ?: holder.handle ?: opinion.holderId,
        handle = holder.handle,
        avatarUrl = holder.avatarUrl,
        point = StancePoint(opinion.pair.pDirected, opinion.pair.pInterest),
        redacted = holder.redacted,
        severed = opinion.severed,
        onOpen = holder.handle?.let { handle ->
            {
                onDismiss()
                onOpenPerson(handle)
            }
        },
        node = rowNode ?: DataNode("${testTag}_row").keyed(key),
    )
}
