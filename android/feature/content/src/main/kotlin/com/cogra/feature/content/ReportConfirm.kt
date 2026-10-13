// REPORT, CONFIRMED BEFORE IT GOES (design/designs/canonical/screens/
// ReportConfirm.jsx; ruling 75). What a menu's tail row opens: one sheet
// naming the thing, one body line saying what happens, and the pair
// Report / Cancel.
//
// A SHEET, NOT A THINK-TWICE DIALOG. Reporting destroys nothing, so it takes
// the sheet's grammar: the menu closes and this rises in its place, the
// scrim, the swipe and Back drop it with nothing sent, `Report` is the filled
// commit and `Cancel` the quiet way out — the inverse of `RemoveConfirm`'s
// pair, because a removal destroys and a report does not.
//
// IT NEVER CONNECTS TO REPORT-A-PROBLEM: reporting content must not read as
// reporting the app, so nothing here names or opens it.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.Outcome
import com.cogra.domain.report.ReportRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** How a report came out, for the thing it named. */
data class ReportOutcome(val target: String, val sent: Boolean)

data class ReportUiState(
    /** The report in flight, if any: the commit stands down so one tap sends one mail. */
    val sending: String? = null,
    /** The answer not yet acted on — the UI consumes it (UI events as state). */
    val outcome: ReportOutcome? = null,
)

/**
 * THE COMMIT SENDS THE MAIL (ruling 75). The send runs in this view model's
 * scope rather than the sheet's, so a report the reader asked for is not
 * cancelled by the sheet that asked going away.
 */
@HiltViewModel
class ReportViewModel @Inject constructor(
    private val reports: ReportRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ReportUiState())
    val state = _state.asStateFlow()

    fun send(target: String) {
        if (_state.value.sending != null) return
        _state.update { it.copy(sending = target) }
        viewModelScope.launch {
            val sent = reports.sendReport(target) is Outcome.Success
            _state.update { ReportUiState(sending = null, outcome = ReportOutcome(target, sent)) }
        }
    }

    /** The UI acted on [ReportUiState.outcome]. */
    fun outcomeConsumed() = _state.update { it.copy(outcome = null) }
}

/** What a screen raises when its menu's Report row is tapped, for one post. */
typealias ReportSheetSlot = @Composable (postId: String, onDismiss: () -> Unit, notify: (String) -> Unit) -> Unit

/**
 * THE REPORT ROW'S DOOR, as a screen's slot: a signed-out reader is asked to
 * join over the read and no confirm rises (ReportConfirm.md:21) —
 * [onRequireAccount] non-null means signed out — and anyone else gets the
 * confirm, wearing [node] where its host's board registers one.
 */
fun reportDoor(onRequireAccount: (() -> Unit)?, testTag: String, node: DataNode? = null): ReportSheetSlot =
    { postId, onDismiss, notify ->
        if (onRequireAccount != null) {
            GuestReport(onRequireAccount = onRequireAccount, onDismiss = onDismiss)
        } else {
            ReportSheetRoute(postId = postId, onDismiss = onDismiss, notify = notify, testTag = testTag, node = node)
        }
    }

/** A guest's tap: the join prompt rises in the confirm's place, once. */
@Composable
private fun GuestReport(onRequireAccount: () -> Unit, onDismiss: () -> Unit) {
    LaunchedEffect(Unit) {
        onRequireAccount()
        onDismiss()
    }
}

/**
 * The confirm for one post, over the surface the menu was opened from, with
 * its aftermath on that surface's snackbar through [notify].
 *
 * Gone through: the sheet closes and the snackbar says `Reported.`
 * (ReportConfirm.md:11). Refused — the day's reports spent, the thing gone —
 * or unanswered: the sheet stays so the reader can try again, and the
 * snackbar reads the shared no-answer line and NEVER `Reported.` (:13-15).
 *
 * [notify] belongs to the host, not to this sheet: a snackbar raised in the
 * sheet's own scope would be cancelled by the sheet closing on success.
 */
@Composable
fun ReportSheetRoute(
    postId: String,
    onDismiss: () -> Unit,
    notify: (String) -> Unit,
    testTag: String,
    node: DataNode? = null,
    viewModel: ReportViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sentLine = stringResource(R.string.content_report_sent)
    val notSentLine = stringResource(R.string.content_report_not_sent)
    LaunchedEffect(state.outcome) {
        val outcome = state.outcome ?: return@LaunchedEffect
        viewModel.outcomeConsumed()
        // An answer about another thing — a report this sheet did not send —
        // is not this sheet's to tell.
        if (outcome.target != postId) return@LaunchedEffect
        if (outcome.sent) {
            notify(sentLine)
            onDismiss()
        } else {
            notify(notSentLine)
        }
    }
    ReportConfirmSheet(
        sending = state.sending != null,
        onReport = { viewModel.send(postId) },
        onDismiss = onDismiss,
        testTag = testTag,
        node = node,
    )
}

/**
 * The sheet itself: the heading naming the thing (ReportConfirm.md:5), the
 * one body line (:7), and the pair. It covers the surface beneath, whose
 * stage stops until it drops (Feed.md:31).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReportConfirmSheet(
    sending: Boolean,
    onReport: () -> Unit,
    onDismiss: () -> Unit,
    testTag: String,
    node: DataNode? = null,
) {
    CoversSurface(open = true, kind = CoverKind.Suspend)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = Modifier.testTag(node?.tag ?: testTag),
        dragHandle = {
            BottomSheetDefaults.DragHandle(modifier = Modifier.dataNode(node?.div("dragHandle")))
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = Space.x6),
        ) {
            Text(
                text = stringResource(R.string.content_report_title_post),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .padding(horizontal = Space.x6)
                    .padding(top = Space.x4, bottom = Space.x2)
                    .testTag(node?.div("title")?.tag ?: "${testTag}_title"),
            )
            Text(
                text = stringResource(R.string.content_report_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(horizontal = Space.x6)
                    .padding(bottom = Space.x2)
                    .testTag(node?.div("body")?.tag ?: "${testTag}_body"),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Space.x6)
                    .padding(top = Space.x2),
                horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
            ) {
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.testTag(node?.div("cancel")?.tag ?: "${testTag}_cancel"),
                ) {
                    Text(stringResource(R.string.content_report_cancel))
                }
                Button(
                    onClick = onReport,
                    enabled = !sending,
                    modifier = Modifier.testTag(node?.div("report")?.tag ?: "${testTag}_report"),
                ) {
                    Text(stringResource(R.string.content_report_report))
                }
            }
        }
    }
}
