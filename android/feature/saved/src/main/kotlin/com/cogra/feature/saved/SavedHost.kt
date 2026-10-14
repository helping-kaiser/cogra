// What a surface hosting menus hands the menus inside it: the one Saved
// overlay, the one hidden set, the surface's own snackbar, and its guest gate
// — as an ambient, for the same reason `LocalSnackbarHostState` is one. A
// post's ⋮ sits inside a card inside a list, and threading the reader's
// comforts through every intermediate composable would put them in the API of
// components that have nothing to do with them (Compose's documented case for
// a CompositionLocal).
//
// The default is null: a surface rendered without a host — a preview, a test
// that does not care — draws its save and hide rows standing and inert, as
// they stood before Saved and hiding were built.

package com.cogra.feature.saved

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.RowLineState
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.hidden.HiddenView
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
    /** The reader's hidden set; null stands the hide rows inert. */
    val hidden: HiddenSet? = null,
    val hiddenView: HiddenView = HiddenView(),
    private val hiddenSnackbar: HiddenSnackbar? = null,
) {
    /** The menu's first row for [node]: `Save` or `Unsave`. */
    fun menuRow(node: String, server: Instant?, testTag: String): MenuRow =
        saveMenuRow(writes, overlay, node, server, snackbar, onGuest, words, testTag)

    /** The hide row's act for [person], made from the row [origin]; null with no set. */
    fun hideAct(person: HiddenPerson, origin: String): (() -> Unit)? {
        val store = hidden ?: return null
        val say = hiddenSnackbar ?: return null
        val guest = onGuest
        return {
            when (guest) {
                null -> hidePerson(store, hiddenView, person, origin, say)
                else -> guest()
            }
        }
    }

    /**
     * The row line [node]'s own row carries: a save, unsave or Undo on it,
     * or a hide or its Undo made from it, that did not go through.
     */
    fun comfortLine(node: String): RowLineState? {
        overlay.comfortLine(writes, node)?.let { return it }
        val store = hidden ?: return null
        return if (hiddenView.failure(node) == null) null else RowLineState.DidntGoThrough { store.retry(node) }
    }

    /** Whether a row by [author] at [origin] leaves a list the hide reaches. */
    fun hides(author: String?, origin: String): Boolean = hiddenView.hides(author, origin)
}

val LocalSavedHost = compositionLocalOf<SavedHost?> { null }

/** [node]'s row line under its face, drawn only while a comfort on it did not go through. */
@Composable
fun ComfortRowLine(host: SavedHost?, node: String, testTag: String, modifier: Modifier = Modifier) {
    host?.comfortLine(node)?.let { RowLine(it, testTag, modifier) }
}

/**
 * The host a surface provides as [LocalSavedHost]: the menus under it save
 * through [writes] and hide through [hidden], and their aftermath reads on
 * [host] wearing [node]. Null [writes] gives no host, so the rows stand inert.
 */
@Composable
fun rememberSavedHost(
    writes: SavedWrites?,
    host: SnackbarHostState?,
    node: DataNode?,
    onGuest: (() -> Unit)?,
    hidden: HiddenSet? = null,
): SavedHost? {
    val overlay = writes.overlayState()
    val snackbar = rememberSavedSnackbar(host, node)
    val words = rememberSavedWords()
    ClearSnackbarOnRevert(writes, host)
    val view = hidden.viewState()
    val scope = rememberCoroutineScope()
    val hiddenWords = rememberHiddenWords()
    val hiddenSnackbar = remember(scope, host, node, hiddenWords) { HiddenSnackbar(scope, host, node, hiddenWords) }
    ClearHideSnackbarOnRevert(hidden, host)
    return writes?.let { SavedHost(it, overlay, snackbar, onGuest, words, hidden, view, hiddenSnackbar) }
}
