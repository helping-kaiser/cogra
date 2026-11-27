// The app-shell notices, rendered above the NavHost. The dead device lock's
// notice (PR-62) rides the SecurityNotices holder — login navigates away the
// moment the tokens land, so it shows wherever the user lands, to the account
// whose lock it was. The storage-loss notice surfaces the StorageHealth mark:
// secure-store data was lost, never silently. Dialogs, not snackbars — a
// security warning is dismissed, never timed out. The reuse notice is the
// feed's own first card (feature:home `SecurityNoticeCard`).

package com.cogra.app.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** How long a collected notice stays hot without a collector (a configuration change). */
private const val STOP_TIMEOUT_MS = 5_000L

@HiltViewModel
class SecurityNoticeViewModel @Inject constructor(
    private val notices: SecurityNotices,
    private val storageHealth: StorageHealth,
) : ViewModel() {
    /** PR-62: a dead device lock's ciphertext was deleted at sign-in — said once, to its account. */
    val lockLost: StateFlow<Boolean> = notices.lockLost
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), false)

    val storageLost: StateFlow<Boolean> = storageHealth.storageLost
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), false)

    fun dismissLockLost() {
        viewModelScope.launch { notices.dismissLockLost() }
    }

    fun acknowledgeStorageLoss() {
        viewModelScope.launch { storageHealth.acknowledge() }
    }
}

@Composable
fun SecurityNoticeHost() {
    val viewModel: SecurityNoticeViewModel = hiltViewModel()
    val storageLost by viewModel.storageLost.collectAsStateWithLifecycle()
    val lockLost by viewModel.lockLost.collectAsStateWithLifecycle()
    if (lockLost) {
        LockLostDialog(onDismiss = viewModel::dismissLockLost)
    }
    if (storageLost) {
        StorageLossDialog(onAcknowledge = viewModel::acknowledgeStorageLoss)
    }
}

/**
 * PR-62's one-time notice in the reuse notice's vehicle (seam 109 item 82):
 * the sign-in completed, and the locked copy the server could no longer open
 * was deleted — said, never silent.
 */
@Composable
fun LockLostDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.security_notice_title)) },
        text = { Text(stringResource(R.string.lock_lost_notice_body)) },
        confirmButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("lock_lost_notice_dismiss"),
            ) {
                Text(stringResource(R.string.security_notice_confirm))
            }
        },
        modifier = Modifier.testTag("lock_lost_notice"),
    )
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
