// The login security notice (auth.md "Reuse detection"), rendered at
// the app shell above the NavHost: login navigates away the moment the
// tokens land, so the notice rides the SecurityNotices holder instead
// of the login surface, and shows wherever the user lands. A dialog,
// not a snackbar — a security warning is dismissed, never timed out.

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
import com.cogra.app.R
import com.cogra.domain.identity.SecurityNotices
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import javax.inject.Inject
import kotlinx.coroutines.flow.StateFlow

@HiltViewModel
class SecurityNoticeViewModel @Inject constructor(
    private val notices: SecurityNotices,
) : ViewModel() {
    val reuseDetectedAt: StateFlow<Instant?> = notices.reuseDetectedAt

    fun dismiss() = notices.dismiss()
}

@Composable
fun SecurityNoticeHost() {
    val viewModel: SecurityNoticeViewModel = hiltViewModel()
    val detectedAt by viewModel.reuseDetectedAt.collectAsStateWithLifecycle()
    detectedAt?.let {
        SecurityNoticeDialog(detectedAt = it, onDismiss = viewModel::dismiss)
    }
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
