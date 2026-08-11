package com.cogra.feature.invites

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.annotation.StringRes
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.domain.ApplicationInfo
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.ErrorCode

@Composable
fun InvitesRoute(
    onBack: () -> Unit,
    viewModel: InvitesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    InvitesScreen(
        state = state,
        onBack = onBack,
        onSingleUseChange = viewModel::onSingleUseChange,
        onPrefillPDirectedChange = viewModel::onPrefillPDirectedChange,
        onPrefillPInterestChange = viewModel::onPrefillPInterestChange,
        onCreate = viewModel::onCreate,
        onRevoke = viewModel::onRevoke,
        onApprove = viewModel::onApprove,
        onShare = { link ->
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, viewModel.shareUrl(link))
            }
            context.startActivity(Intent.createChooser(send, null))
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvitesScreen(
    state: InvitesUiState,
    onBack: () -> Unit,
    onSingleUseChange: (Boolean) -> Unit,
    onPrefillPDirectedChange: (Double) -> Unit,
    onPrefillPInterestChange: (Double) -> Unit,
    onCreate: () -> Unit,
    onRevoke: (String) -> Unit,
    onApprove: (String, Double, Double) -> Unit,
    onShare: (InviteLinkInfo) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.invites_title),
                        modifier = Modifier.semantics { heading() },
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("invites_back"),
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back),
                        )
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (state.error != null || state.transportFailed) {
                Text(
                    text = stringResource(
                        if (state.transportFailed) R.string.error_transport
                        else errorRes(state.error),
                    ),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("invites_error"),
                )
            }
            if (state.vouchSigned) {
                Text(
                    text = stringResource(R.string.invites_vouch_signed),
                    modifier = Modifier.testTag("invites_vouch_signed"),
                )
            }
            if (!state.seedOnDevice) {
                Text(
                    text = stringResource(R.string.invites_husk_hint),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("invites_husk_hint"),
                )
            }
            CreateCard(
                state,
                onSingleUseChange,
                onPrefillPDirectedChange,
                onPrefillPInterestChange,
                onCreate,
            )
            if (state.loading) {
                CircularProgressIndicator(modifier = Modifier.testTag("invites_loading"))
            }
            state.links.forEach { link ->
                LinkCard(link, state.approvingId, state.seedOnDevice, onRevoke, onApprove, onShare)
            }
        }
    }
}

@Composable
private fun CreateCard(
    state: InvitesUiState,
    onSingleUseChange: (Boolean) -> Unit,
    onPrefillPDirectedChange: (Double) -> Unit,
    onPrefillPInterestChange: (Double) -> Unit,
    onCreate: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.invites_create_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(stringResource(R.string.invites_create_body))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(
                    checked = state.singleUse,
                    onCheckedChange = onSingleUseChange,
                    modifier = Modifier
                        .testTag("invites_single_use")
                        .semantics { contentDescription = "single use" },
                )
                Text(
                    text = stringResource(R.string.invites_single_use),
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
            StanceSlider(
                stringResource(R.string.stance_p_directed),
                state.prefillPDirected,
                onPrefillPDirectedChange,
                "invites_p_directed",
            )
            StanceSlider(
                stringResource(R.string.stance_p_interest),
                state.prefillPInterest,
                onPrefillPInterestChange,
                "invites_p_interest",
            )
            Button(
                onClick = onCreate,
                enabled = !state.creating,
                modifier = Modifier.testTag("invites_create"),
            ) {
                Text(stringResource(R.string.invites_create))
            }
        }
    }
}

@StringRes
private fun errorRes(code: ErrorCode?): Int = when (code) {
    ErrorCode.WRITE_RULE_FAILED -> R.string.invites_cant_fund
    ErrorCode.BAD_INPUT -> R.string.invites_bad_input
    ErrorCode.NOT_FOUND -> R.string.invites_link_gone
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}

@Composable
private fun LinkCard(
    link: InviteLinkInfo,
    approvingId: String?,
    seedOnDevice: Boolean,
    onRevoke: (String) -> Unit,
    onApprove: (String, Double, Double) -> Unit,
    onShare: (InviteLinkInfo) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = link.id,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.testTag("link_${link.id}"),
            )
            val status = when {
                link.revokedAt != null -> stringResource(R.string.invites_revoked)
                link.singleUse -> stringResource(R.string.invites_single_use)
                else -> stringResource(R.string.invites_multi_use)
            }
            Text(status)
            if (link.revokedAt == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { onShare(link) },
                        modifier = Modifier.testTag("share_${link.id}"),
                    ) {
                        Text(stringResource(R.string.invites_share))
                    }
                    TextButton(
                        onClick = { onRevoke(link.id) },
                        modifier = Modifier.testTag("revoke_${link.id}"),
                    ) {
                        Text(stringResource(R.string.invites_revoke))
                    }
                }
            }
            link.applications.forEach { application ->
                ApplicationRow(application, link, approvingId, seedOnDevice, onApprove)
            }
        }
    }
}

@Composable
private fun ApplicationRow(
    application: ApplicationInfo,
    link: InviteLinkInfo,
    approvingId: String?,
    seedOnDevice: Boolean,
    onApprove: (String, Double, Double) -> Unit,
) {
    // The link's prefill seeds the form; the commitment happens at
    // approval (schema: ApplicationApprovalInput).
    var pDirected by remember { mutableStateOf(link.prefillPDirected) }
    var pInterest by remember { mutableStateOf(link.prefillPInterest) }
    // Approvable = both proofs (auth.md "Application"): email verified
    // and the device key attached; the server enforces both at approval.
    val approvable = application.emailVerified && application.keyAttached
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = when {
                application.landedAt != null -> stringResource(R.string.applicant_landed, application.handle)
                application.approvedAt != null -> stringResource(R.string.applicant_approved, application.handle)
                !application.emailVerified && !application.keyAttached ->
                    stringResource(R.string.applicant_incomplete, application.handle)
                !application.emailVerified -> stringResource(R.string.applicant_unverified, application.handle)
                !application.keyAttached -> stringResource(R.string.applicant_no_key, application.handle)
                else -> stringResource(R.string.applicant_ready, application.handle)
            },
            modifier = Modifier.testTag("application_${application.id}"),
        )
        if (application.approvedAt == null && approvable) {
            StanceSlider(
                stringResource(R.string.stance_p_directed),
                pDirected,
                { pDirected = it },
                "approve_p_directed_${application.id}",
            )
            StanceSlider(
                stringResource(R.string.stance_p_interest),
                pInterest,
                { pInterest = it },
                "approve_p_interest_${application.id}",
            )
            Button(
                onClick = { onApprove(application.id, pDirected, pInterest) },
                // Approving signs the vouch on THIS device — gated in the
                // husk state until the actor key is restored.
                enabled = approvingId == null && seedOnDevice,
                modifier = Modifier.testTag("approve_${application.id}"),
            ) {
                Text(stringResource(R.string.applicant_approve))
            }
        }
    }
}

@Composable
private fun StanceSlider(label: String, value: Double, onChange: (Double) -> Unit, tag: String) {
    Column {
        Text("$label: ${"%.2f".format(value)}")
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toDouble()) },
            valueRange = -1f..1f,
            modifier = Modifier
                .testTag(tag)
                .semantics { contentDescription = label },
        )
    }
}
