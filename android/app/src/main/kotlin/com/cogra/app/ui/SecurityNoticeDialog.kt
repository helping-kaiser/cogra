// The app-shell notices, rendered above the NavHost. The login security
// notice (auth.md "Reuse detection") rides the SecurityNotices holder —
// login navigates away the moment the tokens land, so it shows wherever
// the user lands. The storage-loss notice surfaces the StorageHealth
// mark: secure-store data was lost, never silently. Dialogs, not
// snackbars — a security warning is dismissed, never timed out.

package com.cogra.app.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.app.R
import com.cogra.domain.identity.SecurityNotices
import com.cogra.domain.store.StorageHealth
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@HiltViewModel
class SecurityNoticeViewModel @Inject constructor(
    private val notices: SecurityNotices,
    private val storageHealth: StorageHealth,
) : ViewModel() {
    val reuseDetectedAt: StateFlow<Instant?> = notices.reuseDetectedAt

    val storageLost: StateFlow<Boolean> = storageHealth.storageLost
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    fun dismiss() = notices.dismiss()

    fun acknowledgeStorageLoss() {
        viewModelScope.launch { storageHealth.acknowledge() }
    }
}

@Composable
fun SecurityNoticeHost() {
    val viewModel: SecurityNoticeViewModel = hiltViewModel()
    val detectedAt by viewModel.reuseDetectedAt.collectAsStateWithLifecycle()
    val storageLost by viewModel.storageLost.collectAsStateWithLifecycle()
    detectedAt?.let {
        SecurityNoticeDialog(detectedAt = it, onDismiss = viewModel::dismiss)
    }
    if (storageLost) {
        StorageLossDialog(onAcknowledge = viewModel::acknowledgeStorageLoss)
    }
}

@Composable
fun StorageLossDialog(onAcknowledge: () -> Unit) {
    AlertDialog(
        onDismissRequest = onAcknowledge,
        title = { Text(stringResource(R.string.storage_notice_title)) },
        text = { Text(stringResource(R.string.storage_notice_body)) },
        confirmButton = {
            TextButton(
                onClick = onAcknowledge,
                modifier = Modifier.testTag("storage_notice_dismiss"),
            ) {
                Text(stringResource(R.string.security_notice_confirm))
            }
        },
        modifier = Modifier.testTag("storage_notice"),
    )
}

@Composable
fun SecurityNoticeDialog(detectedAt: Instant, onDismiss: () -> Unit) {
    val formatted = remember(detectedAt) {
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM)
            .withZone(ZoneId.systemDefault())
            .format(detectedAt)
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.security_notice_title)) },
        text = { Text(stringResource(R.string.security_notice_reuse, formatted)) },
        confirmButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("security_notice_dismiss"),
            ) {
                Text(stringResource(R.string.security_notice_confirm))
            }
        },
        modifier = Modifier.testTag("security_notice"),
    )
}
