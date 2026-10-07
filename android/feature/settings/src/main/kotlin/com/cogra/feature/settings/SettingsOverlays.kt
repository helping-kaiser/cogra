// What opens over the settings page: the sign-out ask (`SignOutConfirm`)
// and the default license sheet (`SettingsLicense`). Both register under
// the page's own `settings` prefix.

package com.cogra.feature.settings

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.compose.AttributionTiers
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.LicenseAxis
import com.cogra.core.designsystem.v2.compose.LicenseAxisLabel
import com.cogra.core.designsystem.v2.compose.ProvenanceTiers
import com.cogra.core.designsystem.v2.compose.licenseSummary
import com.cogra.domain.LicenseChoice

private val Dialog = DataNode("settings") / "dialog"
private val LicenseSheet = DataNode("settings") / "licenseSheet"

/**
 * `SignOutConfirm` — asked only when the don't-remember switch is on and
 * this phone holds the only copy of an unbacked key. Focus lands on the
 * title and stays inside (the dialog window traps it); the scrim and
 * system Back close it, still signed in.
 *
 * `Sign out, keep them locked` is HELD: it is the sign-out custody
 * packet's slice S (`settings.dialog.lock`), and shipping its label
 * without the lock behind it would promise a seal that does not exist.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SignOutConfirm(
    onMakeRecoveryCode: () -> Unit,
    onErase: () -> Unit,
    onDismiss: () -> Unit,
) {
    val titleFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { titleFocus.requestFocus() } }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.dataNode(Dialog),
        title = {
            Text(
                text = stringResource(R.string.sign_out_confirm_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier
                    .semantics { heading() }
                    .focusRequester(titleFocus)
                    .focusable()
                    .dataNode(Dialog / "title"),
            )
        },
        text = {
            Text(
                text = stringResource(R.string.sign_out_confirm_body),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.dataNode(Dialog / "body"),
            )
        },
        // The board's order, which is the reading order: the filled answer
        // leads and the quiet one follows (SignOutConfirm.md :7).
        confirmButton = {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                CograButton(
                    text = stringResource(R.string.sign_out_confirm_recovery),
                    onClick = onMakeRecoveryCode,
                    modifier = Modifier.dataNode(Dialog / "recovery"),
                )
                CograButton(
                    text = stringResource(R.string.sign_out_confirm_erase),
                    onClick = onErase,
                    kind = ButtonKind.Text,
                    modifier = Modifier.dataNode(Dialog / "erase"),
                )
            }
        },
    )
}

/**
 * `SettingsLicense` — the account's default license, over the page. The
 * axes and readings are `ComposeLicense`'s ([LicenseAxis]); what differs is
 * the note, which says this sets where every new post STARTS and binds
 * nothing already signed. Taps stage; Done commits; the scrim, a swipe
 * down and system Back discard.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SettingsLicenseSheet(
    staged: LicenseChoice,
    onStage: (LicenseChoice) -> Unit,
    onDone: () -> Unit,
    onDismiss: () -> Unit,
) {
    var help by remember { mutableStateOf(false) }
    val titleFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { titleFocus.requestFocus() } }
    CograSheetHost(onDismissRequest = onDismiss) {
        CograSheetSurface(
            testTag = LicenseSheet.tag,
            handleTestTag = (LicenseSheet / "dragHandle").tag,
        ) {
            SheetTitle(
                text = stringResource(R.string.license_sheet_title),
                modifier = Modifier
                    .semantics { heading() }
                    .focusRequester(titleFocus)
                    .focusable()
                    .dataNode(LicenseSheet / "title"),
                trailing = {
                    HelpDot(
                        onHelp = { help = true },
                        contentDescription = stringResource(R.string.license_sheet_help),
                        testTag = (LicenseSheet / "title" / "help").tag,
                    )
                },
            )
            LicenseSheetBody(staged, onStage, onDone)
        }
    }
    if (help) {
        HelpDialog(
            title = HelpTopic.License.title,
            paragraphs = HelpTopic.License.paragraphs,
            onClose = { help = false },
        )
    }
}

/** The note, the two axes — `ComposeLicense`'s own — and the foot reading the staged pair beside Done. */
@Composable
private fun LicenseSheetBody(staged: LicenseChoice, onStage: (LicenseChoice) -> Unit, onDone: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        QuietNote(
            text = stringResource(R.string.license_sheet_note),
            modifier = Modifier.dataNode(LicenseSheet / "note"),
        )
        LicenseAxisLabel(
            text = stringResource(R.string.license_sheet_credit),
            modifier = Modifier.dataNode(LicenseSheet / "creditLabel"),
        )
        LicenseAxis(
            tiers = AttributionTiers,
            chosen = staged.attribution,
            onChoose = { onStage(staged.copy(attribution = it)) },
            node = LicenseSheet / "credit",
        )
        LicenseAxisLabel(
            text = stringResource(R.string.license_sheet_record),
            modifier = Modifier.dataNode(LicenseSheet / "recordLabel"),
        )
        LicenseAxis(
            tiers = ProvenanceTiers,
            chosen = staged.provenance,
            onChoose = { onStage(staged.copy(provenance = it)) },
            node = LicenseSheet / "record",
        )
        Column(Modifier.dataNode(LicenseSheet / "foot")) {
            Hairline()
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = licenseSummary(staged.attribution, staged.provenance),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .weight(1f)
                        .dataNode(LicenseSheet / "foot" / "summary"),
                )
                CograButton(
                    text = stringResource(R.string.done),
                    onClick = onDone,
                    modifier = Modifier.dataNode(LicenseSheet / "foot" / "done"),
                )
            }
        }
    }
}
