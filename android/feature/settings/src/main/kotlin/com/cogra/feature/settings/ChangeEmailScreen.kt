// ChangeEmail and ApplicantEmail (`ChangeEmail.jsx`, `ApplicantEmail.jsx`,
// both sidecars; copy-voice "Change your email"). One request, two
// readings: a member's change is proved from both ends; an unverified
// applicant's carve-out needs only the new address's link.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograPasswordField
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Which fault the page is showing — `ChangeEmail`'s `fault` chip, keyed as registered. */
enum class EmailFault(val key: String) { NONE("none"), PASSWORD("password"), MALFORMED("malformed") }

data class ChangeEmailUiState(
    /** The address on file — the note's, the hidden username's, the applicant lead's. */
    val address: String? = null,
    val newEmail: String = "",
    val password: String = "",
    /** `That doesn't look like an email address.` — on the press, then live. */
    val malformed: Boolean = false,
    /** `That password isn't right.` — stands until the next press. */
    val wrongPassword: Boolean = false,
    @StringRes val fault: Int? = null,
    val inFlight: Boolean = false,
    /** The new address the request landed for — the route's cue to move on. */
    val sentTo: String? = null,
) {
    val waiting: Boolean get() = newEmail.isEmpty() || password.isEmpty()

    val chip: EmailFault
        get() = when {
            wrongPassword -> EmailFault.PASSWORD
            malformed -> EmailFault.MALFORMED
            else -> EmailFault.NONE
        }
}

@HiltViewModel
class ChangeEmailViewModel @Inject constructor(
    private val settings: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ChangeEmailUiState())
    val state = _state.asStateFlow()

    private var pressed = false

    init {
        viewModelScope.launch {
            val account = (settings.settingsAccount() as? Outcome.Success)?.value
            // The applicant's lead names where the standing link went: the
            // carve-out's pending address when one is in flight.
            val address = account?.pendingEmailChange?.takeIf { !it.requiresCode }?.newEmail ?: account?.email
            _state.update { it.copy(address = address) }
        }
    }

    fun onNewEmail(value: String) = _state.update {
        it.copy(newEmail = value, malformed = if (pressed && it.malformed) !looksLikeEmail(value) else it.malformed)
    }

    fun onPassword(value: String) = _state.update { it.copy(password = value) }

    /** A taken address is never said: the request answers the same either way. */
    fun onCommit() {
        val s = _state.value
        if (s.waiting || s.inFlight) return
        pressed = true
        if (!looksLikeEmail(s.newEmail)) {
            _state.update { it.copy(malformed = true, wrongPassword = false, fault = null) }
            return
        }
        _state.update { it.copy(malformed = false, wrongPassword = false, fault = null, inFlight = true) }
        viewModelScope.launch {
            val outcome = settings.requestEmailChange(s.newEmail.trim(), s.password)
            _state.update {
                when {
                    outcome is Outcome.Success -> it.copy(inFlight = false, sentTo = outcome.value.newEmail)
                    outcome is Outcome.Failed -> it.copy(inFlight = false, fault = R.string.network_error)
                    outcome.refusedWith(ErrorCode.INVALID_CREDENTIALS) ->
                        it.copy(inFlight = false, wrongPassword = true)
                    outcome.refusedWith(ErrorCode.BAD_INPUT) -> it.copy(inFlight = false, malformed = true)
                    outcome.refusedWith(ErrorCode.RATE_LIMITED) ->
                        it.copy(inFlight = false, fault = R.string.rate_limited)
                    else -> it.copy(inFlight = false, fault = R.string.settings_save_failed)
                }
            }
        }
    }
}

private val Page = DataNode("changeEmail")

/**
 * [applicant] picks the reading. A member's success opens the
 * confirmation; an applicant's returns to its origin — Settings, by G1 —
 * with the snackbar naming the new address.
 */
@Composable
fun ChangeEmailRoute(
    applicant: Boolean,
    onBack: () -> Unit,
    onRequested: (notice: String?) -> Unit,
    viewModel: ChangeEmailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sent = state.sentTo?.let { stringResource(R.string.applicant_email_sent, it) }
    LaunchedEffect(state.sentTo) {
        if (state.sentTo != null) onRequested(if (applicant) sent else null)
    }
    ChangeEmailScreen(
        state = state,
        applicant = applicant,
        onBack = onBack,
        onNewEmail = viewModel::onNewEmail,
        onPassword = viewModel::onPassword,
        onCommit = viewModel::onCommit,
    )
}

@Composable
fun ChangeEmailScreen(
    state: ChangeEmailUiState,
    applicant: Boolean,
    onBack: () -> Unit,
    onNewEmail: (String) -> Unit,
    onPassword: (String) -> Unit,
    onCommit: () -> Unit,
) {
    val address = state.address.orEmpty()

    // ChangeEmail's fields are drawn once per fault (the `fault` chip), so a
    // field's node carries the chip's current value as its key; the
    // applicant board draws them once, unkeyed.
    fun keyed(node: DataNode): DataNode = if (applicant) node else node.keyed(state.chip.key)
    TaskPage(
        node = Page,
        backLabel = stringResource(if (applicant) R.string.back else R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.change_email_title),
        lead = if (applicant) {
            stringResource(R.string.applicant_email_lead, address)
        } else {
            stringResource(R.string.change_email_lead)
        },
    ) {
        Spacer(Modifier.height(32.dp))
        CograTextField(
            value = state.newEmail,
            onValueChange = onNewEmail,
            label = stringResource(R.string.change_email_new),
            error = if (state.malformed) stringResource(R.string.change_email_malformed) else null,
            // The `email` kind: the email keyboard, no caps or correction.
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            contentType = ContentType.EmailAddress,
            node = keyed(Page / "email"),
        )
        Spacer(Modifier.height(24.dp))
        CograPasswordField(
            value = state.password,
            onValueChange = onPassword,
            label = stringResource(R.string.change_email_current),
            error = if (state.wrongPassword) stringResource(R.string.wrong_password) else null,
            account = state.address,
            imeAction = ImeAction.Go,
            onImeAction = { if (!state.waiting) onCommit() },
            node = keyed(Page / "current"),
        )
        Spacer(Modifier.height(24.dp))
        WaitingCommit(
            label = stringResource(R.string.change_email_commit),
            reason = stringResource(R.string.change_email_reason),
            waiting = state.waiting,
            onCommit = onCommit,
            inFlight = state.inFlight,
            inFlightLabel = stringResource(R.string.change_email_in_flight),
            fault = state.fault?.let { stringResource(it) },
            faultTestTag = "change_email_fault",
            node = keyed(Page / "commit"),
        )
        if (!applicant) {
            Spacer(Modifier.height(24.dp))
            QuietNote(
                text = stringResource(R.string.change_email_note, address),
                modifier = Modifier.dataNode(Page / "note"),
            )
        }
    }
}
