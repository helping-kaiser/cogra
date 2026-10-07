// The new address's link, opened in the app (`ChangeEmailLinked.jsx`,
// `ChangeEmailLinkedSignedOut.jsx`, both sidecars; copy-voice "The new
// address's link, opened"). The App Link on `/email-change` lands here.
//
// Signed in, the landing applies the link's side with
// `confirmEmailChange(token)` and lands by the answer — it never calls the
// anonymous check. Signed out, it reads `emailChangeLinkCheck(token)` and
// applies nothing: the link counts once the reader signs in.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograMark
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.settings.EmailChangeLinkState
import com.cogra.domain.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What the landing says — one per answer the contract can give. */
sealed interface LinkedLanding {
    data object Loading : LinkedLanding

    /** The link's side applied; the code is still owed. */
    data class First(val currentEmail: String) : LinkedLanding

    /** Both sides landed: the address moved. */
    data class Last(val newEmail: String) : LinkedLanding

    data class Canceled(val currentEmail: String) : LinkedLanding

    data class AppliedAgain(val currentEmail: String) : LinkedLanding

    data class RanOut(val currentEmail: String) : LinkedLanding

    /** `EMAIL_IN_USE`: the member's way on is `Back to settings` (G4). */
    data object Taken : LinkedLanding

    /** `EMAIL_CHANGE_OTHER_ACCOUNT`: nothing changed here, and the session never switches. */
    data object OtherAccount : LinkedLanding

    /** Signed out, a live link: names the new address the check read. */
    data class SignedOut(val newEmail: String) : LinkedLanding

    /**
     * Signed out with a dead or unknown link — and, signed in, a token the
     * confirm does not know. G9 (ruled, DRAW ORDERED): VerifyExpired's
     * heading and `Sign in`, a body naming no address; the body's words are
     * jakob's at design exec, so none is drawn here yet. DRIFT until the
     * drawing registers.
     */
    data class Dead(val signedIn: Boolean) : LinkedLanding

    /** No answer reached the device: the read with nothing loaded, and Retry. */
    data object Unreachable : LinkedLanding
}

@HiltViewModel
class ChangeEmailLinkedViewModel @Inject constructor(
    private val settings: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow<LinkedLanding>(LinkedLanding.Loading)
    val state = _state.asStateFlow()

    private var started = false
    private var token: String = ""
    private var signedIn: Boolean = false

    fun start(token: String, signedIn: Boolean) {
        if (started) return
        started = true
        this.token = token
        this.signedIn = signedIn
        load()
    }

    fun onRetry() {
        _state.value = LinkedLanding.Loading
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.value = if (signedIn) applySide() else check()
        }
    }

    private suspend fun check(): LinkedLanding = when (val read = settings.emailChangeLinkCheck(token)) {
        is Outcome.Success ->
            read.value
                ?.takeIf { it.state == EmailChangeLinkState.PENDING }
                ?.let { LinkedLanding.SignedOut(it.newEmail) }
                ?: LinkedLanding.Dead(signedIn = false)
        is Outcome.Failed -> LinkedLanding.Unreachable
        is Outcome.Refused -> LinkedLanding.Dead(signedIn = false)
    }

    private suspend fun applySide(): LinkedLanding {
        val outcome = settings.confirmEmailChange(token)
        if (outcome is Outcome.Success) {
            val after = outcome.value
            return if (after.pending == null) {
                LinkedLanding.Last(after.email.orEmpty())
            } else {
                LinkedLanding.First(after.email.orEmpty())
            }
        }
        if (outcome is Outcome.Failed) return LinkedLanding.Unreachable
        // A dead link's body names the address the account still has.
        val current = (settings.settingsAccount() as? Outcome.Success)?.value?.email.orEmpty()
        return when {
            outcome.refusedWith(ErrorCode.EMAIL_CHANGE_CANCELED) -> LinkedLanding.Canceled(current)
            outcome.refusedWith(ErrorCode.EMAIL_CHANGE_ALREADY_APPLIED) -> LinkedLanding.AppliedAgain(current)
            outcome.refusedWith(ErrorCode.EMAIL_CHANGE_EXPIRED) -> LinkedLanding.RanOut(current)
            outcome.refusedWith(ErrorCode.EMAIL_IN_USE) -> LinkedLanding.Taken
            outcome.refusedWith(ErrorCode.EMAIL_CHANGE_OTHER_ACCOUNT) -> LinkedLanding.OtherAccount
            else -> LinkedLanding.Dead(signedIn = true)
        }
    }
}

private val Page = DataNode("changeEmail")

@Composable
fun ChangeEmailLinkedRoute(
    token: String,
    signedIn: Boolean,
    onEnterTheCode: () -> Unit,
    onBackToSettings: () -> Unit,
    onSignIn: () -> Unit,
    viewModel: ChangeEmailLinkedViewModel = hiltViewModel(),
) {
    LaunchedEffect(token, signedIn) { viewModel.start(token, signedIn) }
    val landing by viewModel.state.collectAsStateWithLifecycle()
    ChangeEmailLinkedScreen(
        landing = landing,
        onEnterTheCode = onEnterTheCode,
        onBackToSettings = onBackToSettings,
        onSignIn = onSignIn,
        onRetry = viewModel::onRetry,
    )
}

/**
 * The landing's construction: a centred column, no header and no back
 * arrow; the mark at 56 in `primary` where something worked (every signed-in
 * landing but the other-account one, R2); the `h1` in `headlineSmall`; the
 * body at most 300 wide; one text button, never a commitment. It scrolls.
 */
@Composable
fun ChangeEmailLinkedScreen(
    landing: LinkedLanding,
    onEnterTheCode: () -> Unit,
    onBackToSettings: () -> Unit,
    onSignIn: () -> Unit,
    onRetry: () -> Unit = {},
) {
    val words = landing.words() ?: return
    Scaffold(modifier = Modifier.dataNodeSurface()) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (words.mark) {
                CograMark(size = 56.dp, modifier = Modifier.dataNode(Page / "mark"))
            }
            if (words.title != null) {
                Text(
                    text = stringResource(words.title),
                    style = MaterialTheme.typography.headlineSmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .padding(top = if (words.mark) 24.dp else 0.dp)
                        .semantics { heading() }
                        .dataNode(Page / "title"),
                )
            }
            if (words.body != null) {
                Text(
                    text = words.bodyArg?.let { stringResource(words.body, it) } ?: stringResource(words.body),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .widthIn(max = 300.dp)
                        .dataNode(Page / "body"),
                )
            }
            CograButton(
                text = stringResource(words.onward),
                onClick = when (words.way) {
                    Way.EnterTheCode -> onEnterTheCode
                    Way.BackToSettings -> onBackToSettings
                    Way.SignIn -> onSignIn
                    Way.Retry -> onRetry
                },
                kind = ButtonKind.Text,
                modifier = Modifier
                    .padding(top = 24.dp)
                    .dataNode(Page / "onward"),
            )
        }
    }
}

private enum class Way { EnterTheCode, BackToSettings, SignIn, Retry }

/** A landing's words as resources, resolved where they are drawn. */
private data class LandingWords(
    val mark: Boolean,
    @StringRes val title: Int?,
    @StringRes val body: Int?,
    val bodyArg: String?,
    @StringRes val onward: Int,
    val way: Way,
)

/** Every signed-in landing but the first goes back to settings, under the mark (R2). */
private fun toSettings(@StringRes title: Int, @StringRes body: Int?, arg: String? = null, mark: Boolean = true) =
    LandingWords(mark, title, body, arg, R.string.back_to_settings, Way.BackToSettings)

private fun toSignIn(@StringRes title: Int?, @StringRes body: Int?, arg: String? = null) =
    LandingWords(false, title, body, arg, R.string.linked_sign_in, Way.SignIn)

private fun LinkedLanding.words(): LandingWords? = when (this) {
    LinkedLanding.Loading -> null
    is LinkedLanding.First -> LandingWords(
        mark = true,
        title = R.string.linked_first_title,
        body = R.string.linked_first_body,
        bodyArg = currentEmail,
        onward = R.string.linked_first_onward,
        way = Way.EnterTheCode,
    )
    is LinkedLanding.Last -> toSettings(R.string.linked_last_title, R.string.linked_last_body, newEmail)
    is LinkedLanding.Canceled -> toSettings(R.string.linked_dead_title, R.string.linked_canceled_body, currentEmail)
    is LinkedLanding.AppliedAgain -> toSettings(R.string.linked_dead_title, R.string.linked_applied_body, currentEmail)
    is LinkedLanding.RanOut -> toSettings(R.string.linked_dead_title, R.string.linked_ran_out_body, currentEmail)
    LinkedLanding.Taken -> toSettings(R.string.linked_taken_title, R.string.confirm_email_taken)
    LinkedLanding.OtherAccount -> toSettings(R.string.linked_other_title, R.string.linked_other_body, mark = false)
    is LinkedLanding.SignedOut -> toSignIn(R.string.linked_signed_out_title, R.string.linked_signed_out_body, newEmail)
    // G9: heading and Sign in, no body until design draws one. Signed in,
    // the same construction says it with the way back to settings.
    is LinkedLanding.Dead ->
        if (signedIn) toSettings(R.string.linked_dead_title, null) else toSignIn(R.string.linked_dead_title, null)
    LinkedLanding.Unreachable -> LandingWords(false, null, R.string.error_transport, null, R.string.retry, Way.Retry)
}
