package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.AccountState
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.identity.SignOut
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.settings.PendingEmailChange
import com.cogra.domain.settings.SettingsAccount
import com.cogra.domain.settings.SettingsRepository
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.store.DevicePreferences
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.ThemeChoice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Which door the Email row opens (Settings.md :91-103; G1/G2 ruled). */
enum class EmailDoor {
    /** No change in flight, or the last one ran out: the change request. */
    REQUEST,

    /** A side is still owed: the confirmation, on the owed side. */
    CONFIRM,

    /** An applicant whose address is not verified yet: their own change, even while pending (G2). */
    APPLICANT,
}

data class SettingsUiState(
    /** The one Settings read; null until it answers, and when it cannot. */
    val account: SettingsAccount? = null,
    /** Whether this phone holds the account's actor key. */
    val actorKeyHere: Boolean = false,
    /** The moment the ages read from — the read's own. */
    val now: Instant = Instant.EPOCH,
    val theme: ThemeChoice = ThemeChoice.AUTO,
    val stanceInputMode: StanceInputMode = StanceInputMode.Default,
    val confirmMultiActionSubmits: Boolean = true,
    val showExactValues: Boolean = false,
    val forgetOnSignOut: Boolean = false,
    /** The session whose revoke is in flight. */
    val revokingSessionId: String? = null,
    val revokingOthers: Boolean = false,
    val signingOut: Boolean = false,
    val signOutConfirmOpen: Boolean = false,
    /** The default license sheet's staged pair; null when the sheet is closed. */
    val licenseSheet: LicenseChoice? = null,
    /** The optimistic default while its save is in flight (K4.1). */
    val licenseSaving: LicenseChoice? = null,
    /** A save that did not go through — what Retry sends again. */
    val licenseFailed: LicenseChoice? = null,
) {
    /** This device first, then the rest in the read's order — keyed 1..n by position. */
    val sessions: List<SessionInfo>
        get() = account?.sessions.orEmpty().sortedByDescending { it.isCurrent }

    /** What the Default license row reads. Null in the account reads as public domain. */
    val defaultLicense: LicenseChoice
        get() = licenseSaving ?: account?.defaultLicense ?: LicenseChoice.PublicDomain

    /** A change with a side still owed; one past its window is no change at all. */
    val pendingEmailChange: PendingEmailChange?
        get() = account?.pendingEmailChange?.takeIf { it.expiresAt.isAfter(now) }

    /** The applicant before the key ceremony: no actor key is bound yet. */
    val beforeKeyCeremony: Boolean
        get() = account != null && account.actorPubkey == null

    val emailDoor: EmailDoor
        get() = when {
            account?.accountState == AccountState.APPLICANT && !account.emailVerified -> EmailDoor.APPLICANT
            pendingEmailChange != null -> EmailDoor.CONFIRM
            else -> EmailDoor.REQUEST
        }
}

/** One-shot answers the page says once (a consumed event, never a sticky flag). */
sealed interface SettingsEvent {
    /** A snackbar; [arg] fills the string's one placeholder when it has one. */
    data class Snackbar(@StringRes val text: Int, val arg: String? = null, val argRes: Int? = null) : SettingsEvent

    /** After a revoke, focus moves to this session's row (next, else previous). */
    data class FocusSession(val id: String) : SettingsEvent

    /** The dialog closed without signing out: focus returns to the Sign out row. */
    data object FocusSignOut : SettingsEvent
}

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settings: SettingsRepository,
    private val sessions: SessionRepository,
    private val signOut: SignOut,
    private val identity: IdentityStore,
    private val device: DevicePreferences,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state = _state.asStateFlow()

    private val _events = Channel<SettingsEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    /** The clock the ages read; a test pins it. */
    internal var clock: () -> Instant = Instant::now

    init {
        viewModelScope.launch {
            identity.stanceInputMode.collect { mode -> _state.update { it.copy(stanceInputMode = mode) } }
        }
        viewModelScope.launch {
            identity.confirmMultiActionSubmits.collect { on ->
                _state.update { it.copy(confirmMultiActionSubmits = on) }
            }
        }
        viewModelScope.launch {
            device.theme.collect { theme -> _state.update { it.copy(theme = theme) } }
        }
        viewModelScope.launch {
            device.showExactValues.collect { on -> _state.update { it.copy(showExactValues = on) } }
        }
    }

    /** Re-reads the account — on every arrival, so a subpage's change shows on return. */
    fun refresh() {
        viewModelScope.launch {
            val keyHere = identity.actorSeed() != null
            val forget = identity.forgetOnSignOut()
            val read = settings.settingsAccount()
            _state.update {
                it.copy(
                    account = (read as? Outcome.Success)?.value ?: it.account,
                    actorKeyHere = keyHere,
                    forgetOnSignOut = forget,
                    now = clock(),
                )
            }
        }
    }

    // ------------------------------------------------------------ device

    /** Repaints at once; the device's choice, never the account's. */
    fun onTheme(choice: ThemeChoice) {
        viewModelScope.launch { device.setTheme(choice) }
    }

    fun onStanceInputMode(mode: StanceInputMode) {
        viewModelScope.launch { identity.setStanceInputMode(mode) }
    }

    /** Flips with no dialog (Settings.md "Confirm multi-action submits"). */
    fun onConfirmMultiActionSubmits() {
        val next = !_state.value.confirmMultiActionSubmits
        viewModelScope.launch { identity.setConfirmMultiActionSubmits(next) }
    }

    fun onShowExactValues() {
        val next = !_state.value.showExactValues
        viewModelScope.launch { device.setShowExactValues(next) }
    }

    /** Flips with no dialog and never signs out. */
    fun onForgetOnSignOut() {
        val next = !_state.value.forgetOnSignOut
        _state.update { it.copy(forgetOnSignOut = next) }
        viewModelScope.launch { identity.setForgetOnSignOut(next) }
    }

    // --------------------------------------------------- default license

    fun onOpenLicense() = _state.update { it.copy(licenseSheet = it.defaultLicense) }

    fun onStageLicense(choice: LicenseChoice) = _state.update {
        if (it.licenseSheet == null) it else it.copy(licenseSheet = choice)
    }

    /** Scrim, swipe, Back: discard — nothing staged applies. */
    fun onDismissLicense() = _state.update { it.copy(licenseSheet = null) }

    /** Done: the sheet closes, the row reads the pair at once, the save follows (K4.1). */
    fun onLicenseDone() {
        val staged = _state.value.licenseSheet ?: return
        _state.update { it.copy(licenseSheet = null) }
        saveLicense(staged)
    }

    fun onRetryLicense() {
        val failed = _state.value.licenseFailed ?: return
        saveLicense(failed)
    }

    private fun saveLicense(choice: LicenseChoice) {
        _state.update { it.copy(licenseSaving = choice, licenseFailed = null) }
        viewModelScope.launch {
            // Public domain is the default itself: the explicit null restores it.
            val outcome = settings.setDefaultLicense(choice.takeUnless { it == LicenseChoice.PublicDomain })
            _state.update { s ->
                when (outcome) {
                    is Outcome.Success -> s.copy(
                        licenseSaving = null,
                        account = s.account?.copy(defaultLicense = outcome.value),
                    )
                    // It reverts, and the row says so with Retry (the hold's row vehicle).
                    else -> s.copy(licenseSaving = null, licenseFailed = choice)
                }
            }
        }
    }

    // ---------------------------------------------------------- sessions

    fun onRevokeSession(id: String) {
        val s = _state.value
        if (s.revokingSessionId != null || s.revokingOthers) return
        val ordered = s.sessions
        val index = ordered.indexOfFirst { it.id == id }
        val session = ordered.getOrNull(index) ?: return
        _state.update { it.copy(revokingSessionId = id) }
        viewModelScope.launch {
            when (val outcome = sessions.revokeSession(id)) {
                is Outcome.Success -> {
                    _state.update {
                        it.copy(
                            revokingSessionId = null,
                            account = it.account?.copy(sessions = it.account.sessions.filterNot { x -> x.id == id }),
                        )
                    }
                    _events.send(
                        SettingsEvent.Snackbar(
                            R.string.settings_session_revoked,
                            arg = session.deviceLabel,
                            argRes = R.string.settings_session_unnamed,
                        ),
                    )
                    val next = ordered.getOrNull(index + 1) ?: ordered.getOrNull(index - 1)
                    next?.let { _events.send(SettingsEvent.FocusSession(it.id)) }
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(revokingSessionId = null) }
                    _events.send(SettingsEvent.Snackbar(R.string.network_error))
                }
                is Outcome.Refused -> {
                    // The session ended elsewhere meanwhile: the list re-reads.
                    _state.update { it.copy(revokingSessionId = null) }
                    if (outcome.errors.none { it.code == ErrorCode.UNAUTHENTICATED }) refresh()
                }
            }
        }
    }

    fun onRevokeOthers() {
        val s = _state.value
        if (s.revokingSessionId != null || s.revokingOthers) return
        _state.update { it.copy(revokingOthers = true) }
        viewModelScope.launch {
            when (sessions.revokeOtherSessions()) {
                is Outcome.Success -> {
                    _state.update {
                        it.copy(
                            revokingOthers = false,
                            account = it.account?.copy(sessions = it.account.sessions.filter { x -> x.isCurrent }),
                        )
                    }
                    _events.send(SettingsEvent.Snackbar(R.string.settings_sessions_elsewhere_done))
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(revokingOthers = false) }
                    _events.send(SettingsEvent.Snackbar(R.string.network_error))
                }
                is Outcome.Refused -> {
                    _state.update { it.copy(revokingOthers = false) }
                    refresh()
                }
            }
        }
    }

    // ---------------------------------------------------------- sign out

    /**
     * The three branches (Settings.md :123-127): remembered → the session
     * ends and the key stays; forgotten with a backup positively known,
     * or no key on this phone → the custody set is cleared, no dialog;
     * forgotten with the key here and no KNOWN backup → ask first. An
     * unknown backup state (the read did not answer) asks too: a
     * needless dialog costs a tap, a wrong erase costs the only key
     * (custody packet §8, "unknown → ask").
     */
    fun onSignOut() {
        if (_state.value.signingOut) return
        viewModelScope.launch {
            if (!identity.forgetOnSignOut()) {
                endSession()
                return@launch
            }
            val keyHere = identity.actorSeed() != null
            val backedUp = _state.value.account?.keyBackupCreatedAt != null
            if (!keyHere || backedUp) {
                endSession()
            } else {
                _state.update { it.copy(signOutConfirmOpen = true) }
            }
        }
    }

    /** Erase them and sign out: the custody set goes, and the session with it. */
    fun onEraseAndSignOut() {
        _state.update { it.copy(signOutConfirmOpen = false) }
        viewModelScope.launch { endSession() }
    }

    /** Scrim or Back: still signed in, nothing erased, focus back on Sign out. */
    fun onDismissSignOutConfirm() {
        _state.update { it.copy(signOutConfirmOpen = false) }
        viewModelScope.launch { _events.send(SettingsEvent.FocusSignOut) }
    }

    /** Make a recovery code: the dialog closes; the caller opens the backup, still signed in. */
    fun onMakeRecoveryCode() = _state.update { it.copy(signOutConfirmOpen = false) }

    private suspend fun endSession() {
        _state.update { it.copy(signingOut = true) }
        // The token clear flips the auth phase; the graph lands on
        // sign-in with the stack cleared.
        signOut.signOut()
    }
}
