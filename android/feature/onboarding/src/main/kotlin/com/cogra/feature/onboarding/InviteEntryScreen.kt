// THE INVITE DOOR (design/designs/canonical/screens/InviteEntry.jsx and
// JoinInvalid.jsx; behavior/InviteEntry.md, JoinInvalid.md): paste an
// invite link to start an application.
//
// ONE DOOR, TWO HEADS. A link read and refused as unusable brings the same
// field and the same ways out back under JoinInvalid's heading and
// paragraph, so a different link can be pasted right there.

package com.cogra.feature.onboarding

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.TaskPage
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.R as DesignR

/**
 * The door's two readings, each under its board's name. Neither board is
 * registered in `nodes.json` yet, so the paths are the boards' evident ones.
 */
val INVITE_ENTRY = DataNode("inviteEntry")
val JOIN_INVALID = DataNode("joinInvalid")

@Composable
fun InviteEntryRoute(
    /** A link opened from outside the app, its id already extracted. */
    arrivalInviteId: String?,
    /** The form found its link spent: the door opens in its unusable reading. */
    openedInvalid: Boolean,
    onJoin: (inviteId: String, inviterHandle: String) -> Unit,
    onDeadArrival: () -> Unit,
    onSignIn: () -> Unit,
    onBrowseFeed: () -> Unit,
    onBack: () -> Unit,
    viewModel: InviteEntryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(arrivalInviteId) {
        arrivalInviteId?.let(viewModel::onArrival)
    }
    LaunchedEffect(state.exit) {
        when (val exit = state.exit) {
            is InviteEntryExit.Join -> onJoin(exit.inviteId, exit.inviterHandle)
            InviteEntryExit.DeadArrival -> onDeadArrival()
            null -> return@LaunchedEffect
        }
        viewModel.onExitConsumed()
    }
    // System Back opens what the arrow links to, never the history
    // (InviteEntry.md, JoinInvalid.md:39).
    BackHandler(onBack = onBack)
    InviteEntryScreen(
        state = state.copy(invalid = state.invalid || openedInvalid),
        onInputChange = viewModel::onInputChange,
        onContinue = viewModel::onContinue,
        onSignIn = onSignIn,
        onBrowseFeed = onBrowseFeed,
        onBack = onBack,
    )
}

@Composable
fun InviteEntryScreen(
    state: InviteEntryUiState,
    onInputChange: (String) -> Unit,
    onContinue: () -> Unit,
    onSignIn: () -> Unit,
    onBrowseFeed: () -> Unit,
    onBack: () -> Unit = {},
) {
    val node = if (state.invalid) JOIN_INVALID else INVITE_ENTRY
    TaskPage(
        node = node,
        backLabel = stringResource(DesignR.string.page_header_back),
        onBack = onBack,
        title = stringResource(if (state.invalid) R.string.invite_invalid_title else R.string.invite_title),
        lead = stringResource(if (state.invalid) R.string.invite_invalid_lead else R.string.invite_lead),
    ) {
        Spacer(Modifier.height(32.dp))
        CograTextField(
            value = state.input,
            onValueChange = onInputChange,
            label = stringResource(R.string.invite_input),
            error = if (state.notALink) stringResource(R.string.invite_not_a_link) else null,
            // The `url` kind (TextField.prompt.md): the URL keyboard, no caps
            // or correction; the last field's return key submits.
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Uri,
                imeAction = ImeAction.Go,
            ),
            keyboardActions = KeyboardActions(onGo = { if (!state.waiting) onContinue() }),
            node = node / "link",
        )
        Spacer(Modifier.height(24.dp))
        WaitingCommit(
            label = stringResource(R.string.invite_continue),
            reason = stringResource(R.string.invite_waiting),
            waiting = state.waiting,
            onCommit = onContinue,
            inFlight = state.inFlight,
            inFlightLabel = stringResource(R.string.invite_continuing),
            fault = if (state.noAnswer) stringResource(R.string.entry_no_answer) else null,
            faultTestTag = "${node.path}.fault",
            node = node / "commit",
        )
        Spacer(Modifier.height(24.dp))
        // The ways out stay live while Continue waits (InviteEntry.md,
        // JoinInvalid.md:35).
        Column(modifier = Modifier.fillMaxWidth()) {
            DoorWayOut(stringResource(R.string.entry_sign_in), onSignIn, node / "signIn")
            DoorWayOut(stringResource(R.string.invite_browse), onBrowseFeed, node / "browse")
        }
    }
}

/**
 * A way out of the door: the board's text button laid full width with its
 * words at the start and no padding (`JoinInvalid.jsx`: `justifyContent:
 * flex-start, padding: 0`), in the text button's ink. Its drawn 40dp stays
 * in the layout and it answers at 48 (`cg-hit`, [hitTarget]), so the two
 * stand flush as the board stacks them instead of each growing to its
 * touch target.
 */
@Composable
private fun DoorWayOut(text: String, onClick: () -> Unit, node: DataNode) {
    Box(
        contentAlignment = Alignment.CenterStart,
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(node)
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onClick),
                drawnHeight = Layout.ButtonHeight,
            )
            .defaultMinSize(minHeight = Layout.ButtonHeight),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}
