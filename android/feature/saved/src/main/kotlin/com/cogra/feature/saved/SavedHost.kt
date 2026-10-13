// What a surface hosting menus hands the menus inside it: the one Saved
// overlay, the surface's own snackbar, and its guest gate — as an ambient,
// for the same reason `LocalSnackbarHostState` is one. A post's ⋮ sits inside
// a card inside a list, and threading Saved through every intermediate
// composable would put it in the API of components that have nothing to do
// with it (Compose's documented case for a CompositionLocal).
//
// The default is null: a surface rendered without a host — a preview, a test
// that does not care — draws its save rows standing and inert, as they stood
// before Saved was built.

package com.cogra.feature.saved

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.RowLineState
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.domain.saved.SavedOverlay
import com.cogra.domain.saved.SavedWrites
import java.time.Instant

class SavedHost(
    val writes: SavedWrites,
    val overlay: SavedOverlay,
    val snackbar: SavedSnackbar,
    /** The surface's join prompt; null means the reader is signed in. */
    val onGuest: (() -> Unit)?,
    private val words: SavedWords,
) {
    /** The menu's first row for [node]: `Save` or `Unsave`. */
    fun menuRow(node: String, server: Instant?, testTag: String): MenuRow =
        saveMenuRow(writes, overlay, node, server, snackbar, onGuest, words, testTag)

    /** The row line [node]'s own row carries, when a comfort on it did not go through. */
    fun comfortLine(node: String): RowLineState? = overlay.comfortLine(writes, node)
}

val LocalSavedHost = compositionLocalOf<SavedHost?> { null }

/**
 * The host a surface provides as [LocalSavedHost]: the menus under it save
 * through [writes], and their aftermath reads on [host] wearing [node]. Null
 * [writes] gives no host, so the rows stand inert.
 */
@Composable
fun rememberSavedHost(
    writes: SavedWrites?,
    host: SnackbarHostState?,
    node: DataNode?,
    onGuest: (() -> Unit)?,
): SavedHost? {
    val overlay = writes.overlayState()
    val snackbar = rememberSavedSnackbar(host, node)
    val words = rememberSavedWords()
    ClearSnackbarOnRevert(writes, host)
    return writes?.let { SavedHost(it, overlay, snackbar, onGuest, words) }
}
