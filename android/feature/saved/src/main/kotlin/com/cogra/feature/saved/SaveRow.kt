// THE SAVE ROW, STATED ONCE (saved-surface packet, "The save action") for
// every menu that carries it — the post menu on the feed and the detail, the
// comment menus, the profile menus. Each host brings its own snackbar; the
// behaviour is this one (web's twin is `web/src/lib/saved/save-row.ts`):
//
// - the row reads `Save` while the thing is not kept and `Unsave` while it is,
//   from the server's `viewerBookmarkedAt` with the reader's own acts laid
//   over it — the row carries the state because nothing else does;
// - `Save` keeps it at the tap and the host's snackbar reads `Saved.`;
// - `Unsave` drops it at the tap and the snackbar reads `Removed from Saved.`
//   with `Undo` (design digest item 48), which keeps it again at the time it
//   was kept, so a Saved list read afterwards has it back in its place;
// - a guest is asked to join, and nothing is sent (GuestGate.md:5);
// - a failure reverts, and the target's row says so — never the snackbar,
//   which [ClearSnackbarOnRevert] takes down if it still stands.

package com.cogra.feature.saved

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.RowLineState
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.domain.saved.ComfortKind
import com.cogra.domain.saved.SavedOverlay
import com.cogra.domain.saved.SavedWrites
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Reaches the app's one Saved overlay from a route. */
@HiltViewModel
class SavedHostViewModel @Inject constructor(val writes: SavedWrites) : ViewModel()

/** The app's one Saved overlay, for a route to hand its screen. */
@Composable
fun rememberSavedWrites(): SavedWrites = hiltViewModel<SavedHostViewModel>().writes

/** The overlay as the screen reads it now; empty with no store. */
@Composable
fun SavedWrites?.overlayState(): SavedOverlay {
    val flow = this?.overlay ?: remember { kotlinx.coroutines.flow.MutableStateFlow(SavedOverlay()) }
    val overlay by flow.collectAsState()
    return overlay
}

/** The words the save row and its snackbars speak. */
data class SavedWords(
    val save: String,
    val unsave: String,
    val saved: String,
    val removed: String,
    val undo: String,
)

@Composable
fun rememberSavedWords(): SavedWords = SavedWords(
    save = stringResource(R.string.saved_menu_save),
    unsave = stringResource(R.string.saved_menu_unsave),
    saved = stringResource(R.string.saved_snackbar_saved),
    removed = stringResource(R.string.saved_snackbar_removed),
    undo = stringResource(R.string.saved_snackbar_undo),
)

/**
 * A host's snackbar, made to carry a save's aftermath. A renewed snackbar
 * takes the place of the one standing, so it stands its full time again
 * (SavedUndo.md: a second unsave "renews" it) rather than queueing behind it.
 */
class SavedSnackbar(
    private val scope: CoroutineScope,
    private val host: SnackbarHostState?,
    private val node: DataNode?,
    private val words: SavedWords,
) {
    fun saved(target: String) {
        scope.launch {
            host?.currentSnackbarData?.dismiss()
            host?.showSnackbar(NodeSnackbarVisuals(words.saved, node, cause = target))
        }
    }

    fun removed(target: String, onUndo: () -> Unit) {
        scope.launch {
            host?.currentSnackbarData?.dismiss()
            val result = host?.showSnackbar(
                NodeSnackbarVisuals(words.removed, node, actionLabel = words.undo, cause = target),
            )
            if (result == SnackbarResult.ActionPerformed) onUndo()
        }
    }
}

@Composable
fun rememberSavedSnackbar(host: SnackbarHostState?, node: DataNode?): SavedSnackbar {
    val scope = rememberCoroutineScope()
    val words = rememberSavedWords()
    return remember(scope, host, node, words) { SavedSnackbar(scope, host, node, words) }
}

/** Takes down the snackbar a comfort raised, once that comfort reverts (Saved.md; SG-9). */
@Composable
fun ClearSnackbarOnRevert(writes: SavedWrites?, host: SnackbarHostState?) {
    LaunchedEffect(writes, host) {
        writes?.reverts?.collect { (node, _) ->
            val standing = host?.currentSnackbarData
            if ((standing?.visuals as? NodeSnackbarVisuals)?.cause == node) standing.dismiss()
        }
    }
}

/** Keeps or drops [node] as the row's tap asks, and says so on the host. */
fun toggleSaved(writes: SavedWrites, overlay: SavedOverlay, node: String, server: Instant?, snackbar: SavedSnackbar) {
    val kept = overlay.kept(node, server)
    if (kept == null) {
        writes.keep(node, server)
        snackbar.saved(node)
    } else {
        writes.drop(node, server)
        snackbar.removed(node) { writes.keep(node, null, kept, ComfortKind.RESTORE) }
    }
}

/**
 * The menu's first row: `Save` or `Unsave`.
 *
 * With no [writes] — a screen rendered outside the app's graph — the row
 * stands and does nothing, the way it stood before Saved was built.
 * [onGuest] is the host's join prompt; null means the reader is signed in.
 */
fun saveMenuRow(
    writes: SavedWrites?,
    overlay: SavedOverlay,
    node: String,
    server: Instant?,
    snackbar: SavedSnackbar?,
    onGuest: (() -> Unit)?,
    words: SavedWords,
    testTag: String,
): MenuRow {
    val kept = overlay.kept(node, server) != null
    return MenuRow(if (kept) words.unsave else words.save, testTag) {
        when {
            onGuest != null -> onGuest()
            writes != null && snackbar != null -> toggleSaved(writes, overlay, node, server, snackbar)
        }
    }
}

/** The row line a target's row carries for the reader's own comforts on it. */
fun SavedOverlay.comfortLine(writes: SavedWrites?, node: String): RowLineState? =
    if (failure(node) == null || writes == null) null else RowLineState.DidntGoThrough { writes.retry(node) }
