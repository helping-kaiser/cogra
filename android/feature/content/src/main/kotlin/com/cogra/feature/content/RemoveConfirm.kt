// REMOVE — THE THINK-TWICE DIALOG (design/designs/canonical/screens/
// RemoveConfirm.jsx, CommentRemoveConfirm.jsx; `_shared.jsx` `RemoveDialog`).
// ONE ANATOMY PER KIND: the nouns swap per kind and nothing else moves (jakob
// 2026-09-23, copy-voice) — the post's confirm and the comment's are this one
// composable. web's twin is `web/src/lib/ui2/remove-confirm.tsx`.
//
// THE SAFE ACTION IS THE FILLED ONE. `Keep it` carries the fill in the
// right-hand slot; `Remove` is a text button IN NO COLOUR (jakob 2026-09-15:
// "a removal is not an error no?"). What makes the dialog careful is the
// emphasis and the two sentences above the pair, not a red word.
//
// THE DIALOG IS THE REMOVAL'S OWN SURFACE (RemoveConfirm.md:7-13). Pressed,
// `Remove` refuses a second press and never dims; past 200ms unanswered it
// reads `Removing…`, never a spinner (K4.2, [rememberParticiple]). A removal
// that does not go through keeps the dialog up with its pair, the fault line
// above it — `That didn't send. Try again.`, SeveranceConfirm's placement — and
// `Remove` reading `Retry`. Any non-success is that one state: the client never
// sends a refusable removal of its own content, so a refusal and a lost answer
// are told apart by nothing a reader could act on (the packet's residual flag).
// The comment's confirm carries the line too — RM-G7's build word, the
// nouns-swap rule over its sidecar's silence.
//
// TAKEN, THE NODE NEVER STANDS UNMARKED (RemoveConfirm.md:11). The dialog holds
// `Removing…` through the node's own re-read; the mark reaches [RemovedMarks]
// before the dialog closes, so the surface beneath goes from the thing to its
// mark with no moment of either missing.

package com.cogra.feature.content

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.DialogSurface
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.Removal
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.RemoveContent
import com.cogra.domain.removal.RemovedMarks
import com.cogra.domain.removal.marked
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Where a removal stands, by node: in flight, not through, or taken and not yet acted on. */
data class RemoveUiState(
    /** The node whose removal is in flight — one at a time: a second press is refused. */
    val working: String? = null,
    /** Nodes whose last removal did not go through: their dialog reads the line and Retry. */
    val failed: Set<String> = emptySet(),
    /** The node whose removal was just taken — the UI consumes it (UI events as state). */
    val taken: String? = null,
)

/**
 * THE REMOVAL RUNS IN THIS VIEW MODEL'S SCOPE, not the dialog's, so a removal
 * the reader asked for is never cancelled by its dialog going away. One per
 * destination: every host on it — a card's ⋮, the detail's, a comment's in the
 * thread — removes through it, and every one draws its nodes through [marks].
 */
@HiltViewModel
class RemoveViewModel @Inject constructor(
    private val removeContent: RemoveContent,
    removedMarks: RemovedMarks,
) : ViewModel() {

    private val _state = MutableStateFlow(RemoveUiState())
    val state: StateFlow<RemoveUiState> = _state.asStateFlow()

    /** Every mark this device has seen taken, by node id. */
    val marks: StateFlow<Map<String, Removal>> = removedMarks.marks

    /**
     * Removes [nodeId] by its genesis [record]. A node read without one — no
     * surface that offers Remove reads it so — cannot be named, and reads as a
     * removal that did not go through rather than one pretended.
     */
    fun remove(kind: RemovalKind, nodeId: String, record: String?) {
        if (_state.value.working != null) return
        if (record == null) {
            _state.update { it.copy(failed = it.failed + nodeId) }
            return
        }
        _state.update { it.copy(working = nodeId, failed = it.failed - nodeId) }
        viewModelScope.launch {
            val taken = removeContent(kind, nodeId, record) is Outcome.Success
            _state.update {
                if (taken) {
                    it.copy(working = null, taken = nodeId)
                } else {
                    it.copy(working = null, failed = it.failed + nodeId)
                }
            }
        }
    }

    /** The dialog closed without removing: its failure line goes with it. */
    fun dismissed(nodeId: String) = _state.update { it.copy(failed = it.failed - nodeId) }

    /** The UI acted on [RemoveUiState.taken]. */
    fun takenConsumed() = _state.update { it.copy(taken = null) }
}

/**
 * The destination's removal, for every host beneath it. Null outside the app's
 * graph (previews): a host then draws no marks, and its confirm never claims a
 * removal it cannot send.
 */
val LocalRemoval = compositionLocalOf<RemoveViewModel?> { null }

/** Provides [LocalRemoval] — the destination's own [RemoveViewModel] — to [content]. */
@Composable
fun ProvideRemoval(viewModel: RemoveViewModel = hiltViewModel(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalRemoval provides viewModel, content = content)
}

/** The marks this device has seen taken, as the host reads them now. */
@Composable
internal fun rememberRemovedMarks(): Map<String, Removal> {
    val removal = LocalRemoval.current
    val marks: State<Map<String, Removal>> = removal?.marks?.collectAsState()
        ?: remember { MutableStateFlow(emptyMap<String, Removal>()) }.collectAsState()
    return marks.value
}

/** The board's `REMOVE_CONFIRM_COPY`, per kind. */
private fun RemovalKind.titleRes() = when (this) {
    RemovalKind.Post -> R.string.content_remove_title
    RemovalKind.Comment -> R.string.content_remove_comment_title
}

private fun RemovalKind.bodyRes() = when (this) {
    RemovalKind.Post -> R.string.content_remove_body
    RemovalKind.Comment -> R.string.content_remove_comment_body
}

/**
 * THE DIALOG ITSELF, its states handed in — the board's `RemoveDialog`. Pure,
 * so every state the sidecars draw can be stood up on its own; the removal
 * that drives it is [RemoveConfirm]'s.
 *
 * @param busy the removal is in flight: Remove refuses a second press and,
 *   past 200ms, reads `Removing…`; the ways out — Keep it, the scrim, Back —
 *   hold, locked and never dimmed (the walk-back's rule, one family of confirm).
 * @param failed the last removal did not go through: the line stands above the
 *   pair and Remove reads Retry.
 * @param node the dialog's node: `postDetail.dialog` (RemoveConfirm and the
 *   thread's CommentRemoveConfirm) or `feed.dialog` (FeedRemoveConfirm), its
 *   `title`, `body`, `keep` and `remove`, and the failed state's `line`
 *   keyed `failed`.
 */
@Composable
internal fun RemoveDialog(
    kind: RemovalKind,
    busy: Boolean,
    failed: Boolean,
    onRemove: () -> Unit,
    onKeep: () -> Unit,
    testTag: String,
    node: DataNode? = null,
) {
    val slow = rememberParticiple(busy)
    // A dialog over a surface suspends its stage (Feed.md:31).
    CoversSurface(open = true, kind = CoverKind.Suspend)
    val keep = { if (!busy) onKeep() }
    DialogSurface(
        title = stringResource(kind.titleRes()),
        paragraphs = listOf(stringResource(kind.bodyRes()), stringResource(R.string.content_remove_permanent)),
        onScrimPress = keep,
        testTag = testTag,
        node = node,
        // ABOVE THE PAIR, where SeveranceConfirm stands its fault line — the
        // failure voice, announced.
        extra = {
            if (failed && !busy) {
                Text(
                    text = stringResource(R.string.content_remove_not_sent),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .semantics { liveRegion = LiveRegionMode.Assertive }
                        .then(partTag(node, "line", "${testTag}_failed", key = "failed")),
                )
            }
        },
        actions = {
            CograButton(
                text = stringResource(
                    when {
                        slow -> R.string.content_remove_removing
                        failed && !busy -> R.string.content_retry
                        else -> R.string.content_remove_confirm
                    },
                ),
                // Inert while in flight, never dimmed: the label says what is happening.
                onClick = { if (!busy) onRemove() },
                kind = ButtonKind.Text,
                modifier = partTag(node, "remove", "${testTag}_remove"),
            )
            CograButton(
                text = stringResource(R.string.content_remove_keep),
                onClick = keep,
                modifier = partTag(node, "keep", "${testTag}_keep"),
            )
        },
    )
}

/**
 * A part's registered tag inside a registered dialog, else the [fallback] the
 * tests bind to. A part the board draws once per state carries that state as
 * its [key] (`postDetail.dialog.line:failed`).
 */
private fun partTag(node: DataNode?, part: String, fallback: String, key: String? = null): Modifier = when {
    node == null -> Modifier.testTag(fallback)
    key != null -> Modifier.dataNode((node / part).keyed(key))
    else -> Modifier.dataNode(node / part)
}

/**
 * The dialog, driving the removal of one node through the destination's
 * [LocalRemoval]: `removeContent`, then the node's own re-read, then — the mark
 * recorded — [onClose].
 *
 * @param record the node's `genesisRecordId`: what `removeContent` names, the
 *   whole chain with it.
 * @param onClose Keep it, the scrim, Back — and the close after a taken removal.
 */
@Composable
internal fun RemoveConfirm(
    kind: RemovalKind,
    nodeId: String,
    record: String?,
    onClose: () -> Unit,
    testTag: String,
    node: DataNode? = null,
) {
    val removal = LocalRemoval.current
    val state by (removal?.state ?: remember { MutableStateFlow(RemoveUiState()) }).collectAsState()
    // A host outside the app's graph has no removal to send: a press there
    // reads as one that did not go through, never as one taken.
    var unsendable by remember { mutableStateOf(false) }
    LaunchedEffect(state.taken) {
        if (state.taken == nodeId) {
            removal?.takenConsumed()
            onClose()
        }
    }
    RemoveDialog(
        kind = kind,
        busy = state.working == nodeId,
        failed = unsendable || nodeId in state.failed,
        onRemove = {
            if (removal == null) unsendable = true else removal.remove(kind, nodeId, record)
        },
        onKeep = {
            removal?.dismissed(nodeId)
            onClose()
        },
        testTag = testTag,
        node = node,
    )
}

/** [post] as this device knows it now: wearing a mark taken since it was read, or as it was. */
@Composable
internal fun rememberMarked(post: PostView?): PostView? {
    val marks = rememberRemovedMarks()
    return post?.marked(marks)
}
