// Report a problem (`ReportProblem`, `ReportProblemEmpty`; the support stack,
// jakob 2026-10-01): one page whether Settings or a seal's bug notice opened
// it. The reader's words, the four facts that travel with them read back, and
// `Send by email`, which hands a prefilled draft to the system's own send and
// sends nothing itself.

package com.cogra.feature.settings

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.TaskPage

/** The page's root — UNREGISTERED in `nodes.json`; the board's evident path. */
private val Page = DataNode("reportProblem")

/** The field opens at four lines (ReportProblem.md:5, `rows={4}`). */
private const val FIELD_LINES = 4

@Composable
fun ReportProblemRoute(
    onBack: () -> Unit,
    /** The deletion band under the header, while a confirmed deletion runs its grace. */
    deletionBand: @Composable () -> Unit = {},
    viewModel: ReportProblemViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    // What Settings' own session row calls this device: the model the
    // sign-in sends as the session's label (LoginViewModel).
    val runningOn = Build.MODEL.orEmpty()
    val names = ReportFactNames(
        version = stringResource(R.string.report_version),
        runningOn = stringResource(R.string.report_running_on),
        time = stringResource(R.string.report_time),
    )
    // `Time` re-reads on every arrival — back from the mail app included —
    // and the press itself stamps the moment it was pressed (ReportProblem.md:21).
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.onTick() }
    ReportProblemScreen(
        state = state,
        runningOn = runningOn,
        onWords = viewModel::onWords,
        onSend = { openReportMail(context, viewModel.onSend(runningOn, names)) },
        onBack = onBack,
        deletionBand = deletionBand,
    )
}

/**
 * The stateless page (`ReportProblemBody` in `_shared.jsx`). A task page:
 * the back arrow and no bottom bar (ReportProblem.md:13); it scrolls when
 * its content outgrows the screen, so the commit stays within reach (:33).
 */
@Composable
fun ReportProblemScreen(
    state: ReportProblemUiState,
    runningOn: String,
    onWords: (String) -> Unit,
    onSend: () -> Unit,
    onBack: () -> Unit,
    deletionBand: @Composable () -> Unit = {},
) {
    TaskPage(
        node = Page,
        backLabel = stringResource(R.string.back),
        onBack = onBack,
        title = stringResource(R.string.report_title),
        lead = stringResource(R.string.report_lead),
        deletionBand = deletionBand,
    ) {
        Spacer(Modifier.height(24.dp))
        // One field, no category and no severity (ReportProblem.md:5, :7): it
        // opens at four lines and grows a line at a time with the words.
        CograTextField(
            value = state.words,
            onValueChange = onWords,
            label = stringResource(R.string.report_what_happened),
            singleLine = false,
            minLines = FIELD_LINES,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            node = Page / "whatHappened",
        )
        Spacer(Modifier.height(24.dp))
        // The four facts that travel, read back between the field and the
        // commit (ReportProblem.md:9) — the seal's list, its rules enclosing it.
        Column(Modifier.fillMaxWidth().dataNode(Page / "facts")) {
            Fact(R.string.report_to, REPORT_ADDRESS, "to")
            Fact(R.string.report_version, state.version, "version")
            Fact(R.string.report_running_on, runningOn, "runningOn")
            Fact(R.string.report_time, state.time, "time")
            Hairline()
        }
        Spacer(Modifier.height(12.dp))
        QuietNote(
            text = stringResource(R.string.report_note),
            modifier = Modifier.dataNode(Page / "note"),
        )
        Spacer(Modifier.height(24.dp))
        // Live whatever the field holds (ReportProblem.md:19, ReportProblemEmpty.md:38).
        CograButton(
            text = stringResource(R.string.report_send),
            onClick = onSend,
            modifier = Modifier.fillMaxWidth(),
            testTag = (Page / "commit").tag,
        )
    }
}

@Composable
private fun Fact(label: Int, value: String, name: String) {
    SettingRow(label = stringResource(label), value = value, node = Page / "facts" / name)
}

/**
 * Hands the draft to the system's own send (ReportProblem.md:25), the way
 * developer.android.com documents it (*Common intents* → *Compose an
 * email*): `ACTION_SENDTO` on a bare `mailto:` so only email apps answer,
 * the address in `EXTRA_EMAIL`, the body in `EXTRA_TEXT`.
 *
 * No `<queries>` entry and no `resolveActivity` check: the press never
 * needs to know beforehand whether a mail app exists — `Send by email` is
 * always live — so the package-visibility guide's own advice applies:
 * start the intent and handle `ActivityNotFoundException`. With no mail app
 * nothing opens, nothing is sent, and the words stay where they are.
 */
internal fun openReportMail(context: Context, mail: ReportMail) {
    val intent = Intent(Intent.ACTION_SENDTO).apply {
        data = Uri.parse("mailto:") // Only email apps handle this.
        putExtra(Intent.EXTRA_EMAIL, arrayOf(mail.to))
        putExtra(Intent.EXTRA_TEXT, mail.body)
    }
    try {
        context.startActivity(intent)
    } catch (ignored: ActivityNotFoundException) {
        // No mail app here: nothing opens, and nothing is forced.
    }
}
