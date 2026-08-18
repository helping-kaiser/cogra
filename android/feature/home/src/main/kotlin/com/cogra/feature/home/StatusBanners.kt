// The account-status banners — the application cards, the husk/restore
// card, the reciprocation prompt, and parked handshakes — shell-scoped:
// they ride above whichever tab is active until resolved (design.md §6;
// auth.md "Application": an applicant lands in the same shell as a
// member, the application riding along as cards, never a wall).

package com.cogra.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.StanceSlider
import com.cogra.domain.ErrorCode
import com.cogra.domain.signing.RegistrationProgress

@Composable
fun StatusBannersRoute(
    actorRestoredResult: Boolean,
    onActorRestoredResultConsumed: () -> Unit,
    onStartKeyCeremony: () -> Unit,
    snackbarHostState: SnackbarHostState,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(actorRestoredResult) {
        if (actorRestoredResult) {
            onActorRestoredResultConsumed()
            viewModel.onActorRestored()
        }
    }
    StatusBannerOneShots(
        state = state,
        snackbarHostState = snackbarHostState,
        onActorRestoredShown = viewModel::onActorRestoredShown,
        onApprovedShown = viewModel::onApprovedShown,
        onWelcomeShown = viewModel::onWelcomeShown,
    )
    StatusBanners(
        state = state,
        onTokenChange = viewModel::onTokenChange,
        onVerify = viewModel::onVerify,
        onResendEmailChange = viewModel::onResendEmailChange,
        onResend = viewModel::onResend,
        onRearmInputChange = viewModel::onRearmInputChange,
        onRearm = viewModel::onRearm,
        onDismissWaitingHint = viewModel::onDismissWaitingHint,
        onPDirectedChange = viewModel::onPDirectedChange,
        onPInterestChange = viewModel::onPInterestChange,
        onReciprocate = viewModel::onReciprocate,
        onDismissReciprocation = viewModel::onDismissReciprocation,
        onResumePending = viewModel::onResumePending,
        onStartKeyCeremony = onStartKeyCeremony,
    )
}

/**
 * The one-shot confirmations — restored, approved, landed — fired
 * once per event on the shell's snackbar host (design.md §6).
 * Consumed only after the snackbar is done: clearing first would flip
 * the LaunchedEffect key and cancel the showing coroutine.
 */
@Composable
fun StatusBannerOneShots(
    state: HomeUiState,
    snackbarHostState: SnackbarHostState,
    onActorRestoredShown: () -> Unit,
    onApprovedShown: () -> Unit,
    onWelcomeShown: () -> Unit,
) {
    val restoredMessage = stringResource(R.string.home_actor_restored)
    LaunchedEffect(state.actorRestored) {
        if (state.actorRestored) {
            snackbarHostState.showSnackbar(restoredMessage)
            onActorRestoredShown()
        }
    }
    val approvedMessage = stringResource(R.string.home_approved)
    LaunchedEffect(state.approved) {
        if (state.approved) {
            snackbarHostState.showSnackbar(approvedMessage)
            onApprovedShown()
        }
    }
    val welcomeMessage = stringResource(R.string.home_welcome)
    LaunchedEffect(state.welcome) {
        if (state.welcome) {
            snackbarHostState.showSnackbar(welcomeMessage)
            onWelcomeShown()
        }
    }
}

/**
 * The key-restore banner alone, for the screen's collapsing top: a
 * must-act card that follows the reader — away scrolling down, back
 * on any upward scroll — instead of living only at the top of the
 * list (design.md §6). It shows whenever the account's actor key is
 * attached but absent on this device: the member husk, and the
 * applicant whose key lives elsewhere.
 */
@Composable
fun KeyRestoreBannerRoute(
    onRestoreActor: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    KeyRestoreBanner(state, onRestoreActor)
}

@Composable
fun KeyRestoreBanner(state: HomeUiState, onRestoreActor: () -> Unit) {
    if (state.loading || !state.keyElsewhere) return
    RestoreCard(onRestoreActor)
}

/**
 * The banner stack. Ambient by design: nothing renders while the
 * account state loads, and a settled member with nothing pending
 * contributes no UI at all.
 */
@Composable
fun StatusBanners(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
    onRearmInputChange: (String) -> Unit,
    onRearm: () -> Unit,
    onDismissWaitingHint: () -> Unit,
    onPDirectedChange: (Double) -> Unit,
    onPInterestChange: (Double) -> Unit,
    onReciprocate: () -> Unit,
    onDismissReciprocation: () -> Unit,
    onResumePending: () -> Unit,
    onStartKeyCeremony: () -> Unit,
) {
    if (state.loading) return
    // The host pads horizontally — the feed's list padding, the
    // profile's item wrap — so the cards line up with its content.
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (state.applicant) {
            ApplicantStatus(
                state = state,
                onTokenChange = onTokenChange,
                onVerify = onVerify,
                onResendEmailChange = onResendEmailChange,
                onResend = onResend,
                onRearmInputChange = onRearmInputChange,
                onRearm = onRearm,
                onDismissWaitingHint = onDismissWaitingHint,
                onStartKeyCeremony = onStartKeyCeremony,
            )
        } else {
            // The member husk warning rides the screen's collapsing top
            // (KeyRestoreBannerRoute), not this stack — it must follow
            // the reader.
            state.reciprocationTarget?.let { inviter ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = stringResource(R.string.home_reciprocate_title, inviter.handle),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.testTag("home_reciprocation"),
                        )
                        Text(stringResource(R.string.home_reciprocate_body))
                        StanceSlider(
                            label = stringResource(R.string.stance_p_directed),
                            value = state.pDirected,
                            onChange = onPDirectedChange,
                            testTag = "home_p_directed",
                        )
                        StanceSlider(
                            label = stringResource(R.string.stance_p_interest),
                            value = state.pInterest,
                            onChange = onPInterestChange,
                            testTag = "home_p_interest",
                        )
                        if (state.signingFailed) {
                            Text(
                                text = stringResource(R.string.home_signing_failed),
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.testTag("home_signing_failed"),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = onReciprocate,
                                enabled = !state.signing,
                                modifier = Modifier.testTag("home_reciprocate"),
                            ) {
                                Text(stringResource(R.string.home_reciprocate_sign))
                            }
                            TextButton(
                                onClick = onDismissReciprocation,
                                modifier = Modifier.testTag("home_reciprocate_skip"),
                            ) {
                                Text(stringResource(R.string.home_reciprocate_skip))
                            }
                        }
                    }
                }
            }
            if (state.reciprocated) {
                Text(
                    text = stringResource(R.string.home_reciprocated),
                    modifier = Modifier.testTag("home_reciprocated"),
                )
            }
            if (state.pendingHandshakes > 0) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            stringResource(R.string.home_pending, state.pendingHandshakes),
                            modifier = Modifier.testTag("home_pending"),
                        )
                        OutlinedButton(
                            onClick = onResumePending,
                            modifier = Modifier.testTag("home_resume"),
                        ) {
                            Text(stringResource(R.string.home_resume))
                        }
                    }
                }
            }
        }
    }
}

/**
 * The application riding along in the shell (auth.md "Application"): an
 * applicant already browses; these cards are the only trace of the flow
 * — the actionable proofs (email, key), then a dismissible waiting
 * hint, then the landing status — never a wall.
 */
@Composable
private fun ApplicantStatus(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
    onRearmInputChange: (String) -> Unit,
    onRearm: () -> Unit,
    onDismissWaitingHint: () -> Unit,
    onStartKeyCeremony: () -> Unit,
) {
    when (val progress = state.progress) {
        null -> CircularProgressIndicator(modifier = Modifier.testTag("home_status_loading"))
        is RegistrationProgress.AwaitingApproval -> {
            if (!progress.emailVerified) {
                VerifyCard(state, onTokenChange, onVerify, onResendEmailChange, onResend)
            }
            when {
                // The two proofs are independent — both cards can show.
                !progress.keyAttached && !progress.keyOnDevice -> CeremonyCard(onStartKeyCeremony)
                // A key sits on the device but the attach was refused —
                // it belongs to another account (ACTOR_KEY_IN_USE).
                !progress.keyAttached && progress.keyOnDevice -> KeyElsewhereCard(onStartKeyCeremony)
                // keyAttached && !keyOnDevice: the restore ask rides the
                // screen's collapsing top (KeyRestoreBanner), not this
                // stack.
                progress.keyAttached && progress.keyOnDevice ->
                    if (progress.emailVerified && !state.waitingHintDismissed) {
                        WaitingHint(onDismissWaitingHint)
                    }
            }
        }
        RegistrationProgress.AwaitingLanding ->
            Text(
                text = stringResource(R.string.home_approved),
                modifier = Modifier.testTag("home_landing"),
            )
        // The restore ask rides the screen's collapsing top.
        RegistrationProgress.AwaitingSigningKey -> Unit
        RegistrationProgress.NeedsInvite -> RearmCard(state, onRearmInputChange, onRearm)
        RegistrationProgress.Member ->
            // Momentary: the refresh re-reads the member shape.
            Text(
                text = stringResource(R.string.home_welcome),
                modifier = Modifier.testTag("home_landed"),
            )
        is RegistrationProgress.RejectedByDevice ->
            ErrorLine(R.string.home_application_rejected, testTag = "home_application_rejected")
        is RegistrationProgress.Refused ->
            ErrorLine(R.string.error_generic, testTag = "home_application_refused")
        is RegistrationProgress.Failed ->
            ErrorLine(R.string.error_transport, testTag = "home_application_offline")
    }
}

@Composable
private fun WaitingHint(onDismiss: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_waiting_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("home_waiting"),
            )
            Text(stringResource(R.string.home_waiting_body))
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("home_waiting_dismiss"),
            ) {
                Text(stringResource(R.string.home_waiting_dismiss))
            }
        }
    }
}

/** The key proof: mint and attach on this device (auth.md step 3). */
@Composable
private fun CeremonyCard(onStartKeyCeremony: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_create_key_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(stringResource(R.string.home_create_key_body))
            Button(
                onClick = onStartKeyCeremony,
                modifier = Modifier.testTag("home_create_key"),
            ) {
                Text(stringResource(R.string.home_create_key_button))
            }
        }
    }
}

/**
 * The device's key backs another account, so this account needs its own
 * — the ceremony's fresh mint replaces the stored key (the other
 * account's stays restorable with its recovery code).
 */
@Composable
private fun KeyElsewhereCard(onStartKeyCeremony: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_key_elsewhere_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = stringResource(R.string.home_key_elsewhere_body),
                modifier = Modifier.testTag("home_key_elsewhere"),
            )
            Button(
                onClick = onStartKeyCeremony,
                modifier = Modifier.testTag("home_fresh_key"),
            ) {
                Text(stringResource(R.string.home_key_elsewhere_button))
            }
        }
    }
}

/** The actor key lives elsewhere — restore brings it to this device. */
@Composable
private fun RestoreCard(onRestoreActor: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_husk_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(stringResource(R.string.home_husk_body))
            Button(
                onClick = onRestoreActor,
                modifier = Modifier.testTag("home_restore"),
            ) {
                Text(stringResource(R.string.home_husk_restore))
            }
        }
    }
}

/** A dead application re-arms with a fresh invite (auth.md "Expiry"). */
@Composable
private fun RearmCard(
    state: HomeUiState,
    onRearmInputChange: (String) -> Unit,
    onRearm: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_rearm_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("home_rearm"),
            )
            Text(stringResource(R.string.home_rearm_body))
            OutlinedTextField(
                value = state.rearmInput,
                onValueChange = onRearmInputChange,
                label = { Text(stringResource(R.string.home_rearm_input)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("rearm_input"),
            )
            when {
                state.rearmMalformed -> ErrorLine(R.string.home_rearm_invalid, testTag = "rearm_error")
                state.rearmError != null -> ErrorLine(state.rearmError.rearmMessage(), testTag = "rearm_error")
            }
            Button(
                onClick = onRearm,
                enabled = state.rearmInput.isNotBlank() && !state.rearming,
                modifier = Modifier.testTag("rearm_submit"),
            ) {
                Text(stringResource(R.string.home_rearm_submit))
            }
        }
    }
}

private fun ErrorCode.rearmMessage(): Int = when (this) {
    ErrorCode.INVITE_UNUSABLE -> R.string.home_rearm_unusable
    ErrorCode.BAD_INPUT -> R.string.home_rearm_live
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}

@Composable
private fun VerifyCard(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_verify_explainer),
                modifier = Modifier.testTag("home_verify"),
            )
            OutlinedTextField(
                value = state.verificationToken,
                onValueChange = onTokenChange,
                label = { Text(stringResource(R.string.home_verify_token)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("verify_token"),
            )
            state.verifyError?.let {
                ErrorLine(it.verifyMessage(), testTag = "verify_error")
            }
            Button(
                onClick = onVerify,
                enabled = state.verificationToken.isNotBlank() && !state.verifying,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("verify_submit"),
            ) {
                Text(stringResource(R.string.home_verify_submit))
            }
            OutlinedTextField(
                value = state.resendEmail,
                onValueChange = onResendEmailChange,
                label = { Text(stringResource(R.string.home_verify_email)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("resend_email"),
            )
            TextButton(
                onClick = onResend,
                enabled = state.resendEmail.isNotBlank() && !state.resending,
                modifier = Modifier.testTag("verify_resend"),
            ) {
                Text(stringResource(R.string.home_verify_resend))
            }
            if (state.resent) {
                Text(
                    text = stringResource(R.string.home_verify_resent),
                    modifier = Modifier.testTag("verify_resent"),
                )
            }
            state.resendError?.let {
                ErrorLine(it.resendMessage(), testTag = "resend_error")
            }
        }
    }
}

private fun ErrorCode.verifyMessage(): Int = when (this) {
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.home_verify_failed
}

private fun ErrorCode.resendMessage(): Int = when (this) {
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}
