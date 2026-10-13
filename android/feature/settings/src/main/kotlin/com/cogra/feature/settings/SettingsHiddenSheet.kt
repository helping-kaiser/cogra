// HIDDEN ACCOUNTS (design/designs/canonical/screens/SettingsHidden.jsx;
// behavior/SettingsHidden.md; hidden-actors packet §5.4, §6). Everyone the
// reader has hidden, most recently hidden first, over settings, and the way
// back: `Unhide` on each row, no confirm. The rows are the hidden set's own —
// the sheet reads the store and fetches nothing. web's twin is
// `web/src/app/(app)/settings/settings-hidden-sheet.tsx`.
//
// A ROW IS INERT APART FROM ITS UNHIDE (SettingsHidden.md:19-21). A DELETED
// ACCOUNT'S ROW (design digest item 56) wears the reserved disc and `Deleted
// account`, and is its own node, `redactedAccount`, keyed by the actor's id.
// A FAILURE TAKES THE ROW'S OWN SLOTS (item 55): the second line reads `That
// didn't go through.` and `Retry` stands where `Unhide` stood; an Undo of an
// unhide that did not go through puts the row back in its place carrying it.

package com.cogra.feature.settings

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.domain.ageLadder
import com.cogra.domain.hidden.HiddenComfort
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.hidden.HiddenView
import com.cogra.feature.saved.ClearHideSnackbarOnRevert
import com.cogra.feature.saved.HiddenSnackbar
import com.cogra.feature.saved.rememberHiddenWords
import com.cogra.feature.saved.unhidePerson
import com.cogra.feature.saved.viewState
import java.time.Instant

private val HiddenSheet = DataNode("settings") / "hiddenSheet"

/** What the People row and the sheet share: the set, its view, the page's snackbar and the row's focus. */
internal class HiddenAccounts(
    val store: HiddenSet?,
    val view: HiddenView,
    val snackbar: HiddenSnackbar,
    val rowFocus: FocusRequester,
    private val openState: MutableState<Boolean>,
) {
    val open: Boolean get() = openState.value

    /** An Undo of an unhide that did not go through, said on the settings row once the sheet closed. */
    val rowFailed: Boolean
        get() = !open && view.failures.values.any { it.kind == HiddenComfort.UNDO_UNHIDE }

    /** Retries the comfort the settings row carries; signs nothing. */
    fun retryRow() {
        val failed = view.failures.entries.firstOrNull { it.value.kind == HiddenComfort.UNDO_UNHIDE } ?: return
        store?.retry(failed.key)
    }

    fun show() {
        openState.value = true
    }

    fun close() {
        openState.value = false
        runCatching { rowFocus.requestFocus() }
    }
}

@Composable
internal fun rememberHiddenAccounts(store: HiddenSet?, host: SnackbarHostState): HiddenAccounts {
    val view = store.viewState()
    // Settings may open before the feed ever has: the count needs the set read.
    LaunchedEffect(store) { store?.ensure() }
    val scope = rememberCoroutineScope()
    val words = rememberHiddenWords()
    val snackbar = remember(scope, host, words) { HiddenSnackbar(scope, host, null, words) }
    ClearHideSnackbarOnRevert(store, host)
    val focus = remember { FocusRequester() }
    val open = rememberSaveable { mutableStateOf(false) }
    return HiddenAccounts(store, view, snackbar, focus, open)
}

/** The sheet, while it is open and there is someone to show. */
@Composable
internal fun HiddenAccountsSheet(accounts: HiddenAccounts) {
    val store = accounts.store ?: return
    if (!accounts.open) return
    SettingsHiddenSheet(store, accounts.view, accounts.snackbar, onDismiss = accounts::close)
}

/**
 * The rows the sheet stands: the hidden set, plus any row whose Undo of an
 * unhide did not go through — it comes back in its place, carrying the line.
 */
internal fun hiddenRows(view: HiddenView): List<HiddenEntry> {
    val rows = view.entries.toMutableList()
    view.failures.values
        .filter { it.kind == HiddenComfort.UNDO_UNHIDE && rows.none { row -> row.person.id == it.entry.person.id } }
        .forEach { rows += it.entry }
    return rows.sortedWith(compareByDescending<HiddenEntry> { it.hiddenAt }.thenByDescending { it.person.id })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SettingsHiddenSheet(
    store: HiddenSet,
    view: HiddenView,
    snackbar: HiddenSnackbar,
    /** Closes onto settings; focus returns to the Hidden accounts row. */
    onDismiss: () -> Unit,
    now: Instant = Instant.now(),
) {
    val rows = hiddenRows(view)
    // THE LAST ROW GONE CLOSES THE SHEET (SettingsHidden.md:27): never an
    // empty sheet; the settings row reads `None` and takes the focus.
    LaunchedEffect(rows.isEmpty()) { if (rows.isEmpty()) onDismiss() }
    if (rows.isEmpty()) return
    val titleFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { titleFocus.requestFocus() } }
    CograSheetHost(onDismissRequest = onDismiss) {
        CograSheetSurface(testTag = HiddenSheet.tag, handleTestTag = (HiddenSheet / "dragHandle").tag) {
            SheetTitle(
                text = stringResource(R.string.settings_people_hidden),
                modifier = Modifier
                    .semantics { heading() }
                    .focusRequester(titleFocus)
                    .focusable()
                    .dataNode(HiddenSheet / "title"),
            )
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(horizontal = 24.dp).dataNode(HiddenSheet / "list"),
            ) {
                rows.forEach { entry -> HiddenRow(entry, view, store, snackbar, now) }
            }
        }
    }
}

@Composable
private fun HiddenRow(entry: HiddenEntry, view: HiddenView, store: HiddenSet, snackbar: HiddenSnackbar, now: Instant) {
    val person = entry.person
    val node = if (person.nameless) {
        (HiddenSheet / "list" / "redactedAccount").keyed(person.id)
    } else {
        (HiddenSheet / "list" / "account").keyed(person.handle.orEmpty())
    }
    val failed = view.failure(person.id) != null
    val name = person.displayName ?: "@${person.handle}"
    val picture = person.avatarUrl
    ContentRow(
        title = name,
        titleAside = if (person.displayName != null && person.handle != null) "@${person.handle}" else null,
        disc = when {
            person.redacted -> ContentRowDisc.Redacted
            picture != null -> ContentRowDisc.Picture(picture, name)
            else -> ContentRowDisc.Monogram(name)
        },
        second = {
            if (failed) {
                Text(
                    stringResource(R.string.settings_save_failed),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            } else {
                Text(
                    stringResource(R.string.settings_hidden_age, ageLadder(entry.hiddenAt, now)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
        },
        testTag = "settings_hidden_${person.id}",
        node = node,
        action = {
            if (failed) {
                InlineAction(
                    text = stringResource(R.string.retry),
                    onClick = { store.retry(person.id) },
                    testTag = "settings_hidden_${person.id}_retry",
                )
            } else {
                // `Unhide` keeps its visible name and is described by its row's
                // title (design digest item 57, F2): the title precedes it in
                // traversal order.
                InlineAction(
                    text = stringResource(R.string.settings_hidden_unhide),
                    onClick = { unhidePerson(store, entry, snackbar) },
                    testTag = (node / "trailing" / "unhide").tag,
                )
            }
        },
    )
}
