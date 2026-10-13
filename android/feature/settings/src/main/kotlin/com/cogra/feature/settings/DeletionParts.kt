// The pieces the account-deletion screens share (`DeleteAccount.jsx`,
// `DeleteAccountMail.jsx`, `DeleteAccountPending.jsx`,
// `DeleteAccountConfirmed.jsx`): the one commitment with its fault line and
// its in-flight label, the content sweep's checkbox and its line, and the
// forward-ladder count in words.

package com.cogra.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.forwardCount
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ForwardCount
import com.cogra.domain.ForwardUnit

/** The deletion screens' registered root (`nodes.json` "DeleteAccount" and its siblings, prefix `deleteAccount`). */
internal val DeleteAccountPage = DataNode("deleteAccount")

/** A forward-ladder count in the words its sentence carries: `6 days`, `5 hours`. */
@Composable
internal fun ForwardCount.words(): String = forwardCount(count, inHours = unit == ForwardUnit.HOURS)

/**
 * A deletion screen's one commitment. Its fault — no answer, or a refusal
 * the boards draw no line of its own for — stands right above it in the
 * failure voice, announced, and the commitment stays as the retry
 * (`DeleteAccount.md:21`). While [inFlight] it refuses a second press and
 * never dims; past the participle delay it reads [inFlightLabel] in its own
 * place, never a spinner (`DeleteAccount.md:35`).
 */
@Composable
internal fun DeletionCommit(
    label: String,
    onCommit: () -> Unit,
    node: DataNode,
    modifier: Modifier = Modifier,
    inFlight: Boolean = false,
    inFlightLabel: String = label,
    fault: String? = null,
    kind: ButtonKind = ButtonKind.Filled,
) {
    val participle = rememberParticiple(inFlight)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (fault != null) {
            Text(
                text = fault,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .dataNode(DataNode("${node.path}_fault")),
            )
        }
        CograButton(
            text = if (participle) inFlightLabel else label,
            onClick = { if (!inFlight) onCommit() },
            kind = kind,
            modifier = Modifier
                .fillMaxWidth()
                .dataNode(node),
        )
    }
}

/**
 * `Also remove what I posted` and its line (`DeleteAccount.jsx`; the same
 * words on the landing). A checkbox, not a switch: nothing here takes effect
 * until it is committed. The documented checkbox-with-label pattern — the
 * ROW is the toggleable, announced as a checkbox, one target.
 */
@Composable
internal fun SweepChoice(checked: Boolean, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    val sweep = DeleteAccountPage / "sweep"
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .toggleable(value = checked, role = Role.Checkbox, onValueChange = { onToggle() })
                .dataNode(sweep),
        ) {
            Checkbox(checked = checked, onCheckedChange = null, modifier = Modifier.dataNode(sweep / "box"))
            Text(
                text = stringResource(R.string.delete_account_sweep),
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier
                    .padding(start = 8.dp)
                    .dataNode(sweep / "label"),
            )
        }
        // Under the label, not under the box: the non-interactive checkbox
        // draws 24dp wide and the label stands 8dp past it (the board's 30px).
        Text(
            text = stringResource(R.string.delete_account_sweep_hint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(start = 32.dp, top = Space.x1)
                .dataNode(DeleteAccountPage / "sweepHint"),
        )
    }
}
