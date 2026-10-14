// THE HIDE ACTION, STATED ONCE (hidden-actors packet §5.2) for every menu that
// carries it — the post menu on the feed and the detail, the two profile
// menus. It rides this module beside the save row because both are the
// reader's private comforts on the same hosts: one ambient host
// ([SavedHost]) carries the overlay, the hidden set, the host's snackbar and
// its guest gate to every menu under it. web's twin is
// `web/src/lib/hidden/hide-row.ts`.
//
// - the row reads `Hide @ada`, or `Hide this account` for a deleted account,
//   always — hiding is not a toggle (ReaderPostMenu.md:3; ProfileMenu.md:3);
// - a guest is asked to join, and nothing is sent (GuestGate.md:5);
// - otherwise the person joins the hidden set at the tap — no confirm, ever —
//   and the host's snackbar names them with `Undo`, which takes the hide back;
// - a hide of someone already hidden sends nothing and its Undo sends nothing:
//   Undo restores what was, and what was is hidden (packet §15 F1);
// - a failure reverts, and the row the gesture was made from says so — never
//   the snackbar, which [ClearHideSnackbarOnRevert] takes down.

package com.cogra.feature.saved

import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.domain.ActorRef
import com.cogra.domain.hidden.HiddenComfort
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.hidden.HiddenView
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Reaches the app's one hidden set from a route. */
@HiltViewModel
class HiddenHostViewModel @Inject constructor(val store: HiddenSet) : ViewModel()

/** The app's one hidden set, for a route to hand its screen. */
@Composable
fun rememberHiddenSet(): HiddenSet = hiltViewModel<HiddenHostViewModel>().store

/** The set as the screen reads it now; empty with no store. */
@Composable
fun HiddenSet?.viewState(): HiddenView {
    val flow = this?.view ?: remember { MutableStateFlow(HiddenView()) }
    val view by flow.collectAsState()
    return view
}

/** The snackbar cause a hide or unhide raised from [origin] wears, so its revert clears it. */
fun hideCause(origin: String): String = "hide:$origin"

/** The person a post's author names. */
fun ActorRef.asHiddenPerson(): HiddenPerson =
    HiddenPerson(id = id, handle = handle, displayName = displayName, avatarUrl = avatar?.url, redacted = false)

/** The words the hide row and its snackbars speak. */
data class HiddenWords(
    private val hideNamed: String,
    private val hideNameless: String,
    private val hiddenNamed: String,
    private val hiddenNameless: String,
    private val unhiddenNamed: String,
    private val unhiddenNameless: String,
    val undo: String,
) {
    /** `Hide @ada`, or `Hide this account` (`ActorChip.jsx:67`). */
    fun row(person: HiddenPerson): String = if (person.nameless) hideNameless else hideNamed.format("@${person.handle}")

    fun hidden(person: HiddenPerson): String =
        if (person.nameless) hiddenNameless else hiddenNamed.format("@${person.handle}")

    fun unhidden(person: HiddenPerson): String =
        if (person.nameless) unhiddenNameless else unhiddenNamed.format("@${person.handle}")
}

@Composable
fun rememberHiddenWords(): HiddenWords = HiddenWords(
    hideNamed = stringResource(R.string.hidden_menu_hide),
    hideNameless = stringResource(R.string.hidden_menu_hide_account),
    hiddenNamed = stringResource(R.string.hidden_snackbar_hidden),
    hiddenNameless = stringResource(R.string.hidden_snackbar_hidden_account),
    unhiddenNamed = stringResource(R.string.hidden_snackbar_unhidden),
    unhiddenNameless = stringResource(R.string.hidden_snackbar_unhidden_account),
    undo = stringResource(R.string.saved_snackbar_undo),
)

/** A host's snackbar, made to carry a hide's or an unhide's aftermath. */
class HiddenSnackbar(
    private val scope: CoroutineScope,
    private val host: SnackbarHostState?,
    private val node: DataNode?,
    val words: HiddenWords,
) {
    fun say(message: String, origin: String, onUndo: () -> Unit) {
        scope.launch {
            host?.currentSnackbarData?.dismiss()
            val result = host?.showSnackbar(
                NodeSnackbarVisuals(message, node, actionLabel = words.undo, cause = hideCause(origin)),
            )
            if (result == SnackbarResult.ActionPerformed) onUndo()
        }
    }
}

/** Takes down the snackbar a hide or unhide raised, once it reverts. */
@Composable
fun ClearHideSnackbarOnRevert(store: HiddenSet?, host: SnackbarHostState?) {
    LaunchedEffect(store, host) {
        store?.reverts?.collect { origin ->
            val standing = host?.currentSnackbarData
            if ((standing?.visuals as? NodeSnackbarVisuals)?.cause == hideCause(origin)) standing.dismiss()
        }
    }
}

/** Hides [person] from the row [origin], and says so on the host. */
fun hidePerson(store: HiddenSet, view: HiddenView, person: HiddenPerson, origin: String, snackbar: HiddenSnackbar) {
    val already = view.has(person.id)
    if (!already) store.hide(person, origin)
    snackbar.say(snackbar.words.hidden(person), origin) {
        val entry = store.view.value.entries.firstOrNull { it.person.id == person.id }
        if (!already && entry != null) store.unhide(entry, origin, HiddenComfort.UNDO_HIDE)
    }
}

/** Unhides [entry]'s person from their Hidden accounts row, and says so on the host. */
fun unhidePerson(store: HiddenSet, entry: HiddenEntry, snackbar: HiddenSnackbar) {
    val origin = entry.person.id
    store.unhide(entry, origin)
    snackbar.say(snackbar.words.unhidden(entry.person), origin) {
        store.hide(entry.person, origin, entry.hiddenAt, HiddenComfort.UNDO_UNHIDE)
    }
}
