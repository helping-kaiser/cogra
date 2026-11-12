package com.cogra.feature.onboarding

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.MAX_PASSWORD_LENGTH
import com.cogra.domain.MIN_PASSWORD_LENGTH
import com.cogra.domain.Outcome
import com.cogra.domain.emailValid
import com.cogra.domain.handleValid
import com.cogra.domain.identity.Register
import com.cogra.domain.sanitizedEmail
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * WHAT WAS TYPED OUTLIVES A WAY OUT (Join.md:29-31): leaving the form by
 * `Already have an account? Sign in` or the back arrow and coming back in
 * the same session finds the handle and the email as they were. The
 * password is never kept. Being held in memory only, a cold launch finds
 * nothing, as Join.md:31 asks.
 */
@Singleton
class JoinDraft @Inject constructor() {
    var handle: String = ""
    var email: String = ""

    fun forget() {
        handle = ""
        email = ""
    }
}

/** A line a field carries in place of its hint (copy-voice, the refusals). */
enum class JoinLine {
    HANDLE_SHAPE,
    HANDLE_TAKEN,
    EMAIL_SHAPE,
    EMAIL_IN_USE,
    PASSWORD_SHORT,
    PASSWORD_LONG,
    PASSWORD_BREACHED,

    /** Repeat password's one line: `The two passwords don't match.` */
    PASSWORDS_DIFFER,
}

/** The form's own fault, standing above the commit: the fields keep what was typed. */
enum class JoinFault { NO_ANSWER, NOT_THROUGH, RATE_LIMITED }

/** One line per field, or none. */
data class JoinLines(
    val handle: JoinLine? = null,
    val email: JoinLine? = null,
    val password: JoinLine? = null,
    val confirm: JoinLine? = null,
) {
    val any: Boolean get() = listOf(handle, email, password, confirm).any { it != null }
}

data class JoinUiState(
    val handle: String = "",
    val email: String = "",
    val password: String = "",
    /** Repeat password (seam 275-1: a new password is asked for twice). */
    val confirm: String = "",
    val inFlight: Boolean = false,
    /** Lines a press's own check said: they re-check as the text changes. */
    val local: JoinLines = JoinLines(),
    /** Lines the server answered: they stand until the next press (Join.md:85). */
    val answered: JoinLines = JoinLines(),
    val fault: JoinFault? = null,
    /** Handles and emails the server has refused as taken: a later press re-says them (JoinErrors.md:3). */
    val taken: Set<String> = emptySet(),
    val inUse: Set<String> = emptySet(),
    /** The registration said the link is spent: the door's unusable reading takes over. */
    val spent: Boolean = false,
    /** The account is made: the applicant days begin. */
    val created: Boolean = false,
) {
    /** Join.md:99 — Create account waits while any of the four fields is empty. */
    val waiting: Boolean get() = listOf(handle, email, password, confirm).any { it.isEmpty() }

    val handleLine: JoinLine? get() = answered.handle ?: local.handle
    val emailLine: JoinLine? get() = answered.email ?: local.email
    val passwordLine: JoinLine? get() = answered.password ?: local.password
    val confirmLine: JoinLine? get() = local.confirm
}

/**
 * The registration form (auth.md "Application" step 2; Join.md, JoinErrors.md).
 *
 * THE FIELDS ANSWER ON THE PRESS. Typing never marks a field before the
 * next press of Create account. A press checks each field's shape here and
 * only a well-formed form goes out. Once a local format line stands it
 * re-checks as the text changes; a line the server answered stands until
 * the next press.
 */
@HiltViewModel
class JoinViewModel @Inject constructor(
    private val register: Register,
    private val draft: JoinDraft,
) : ViewModel() {

    private val _state = MutableStateFlow(JoinUiState(handle = draft.handle, email = draft.email))
    val state = _state.asStateFlow()

    fun onHandleChange(value: String) {
        val next = value.lowercase()
        draft.handle = next
        _state.update {
            it.copy(handle = next, local = it.local.copy(handle = it.local.handle?.let { handleLine(next) }))
        }
    }

    fun onEmailChange(value: String) {
        draft.email = value
        _state.update {
            it.copy(email = value, local = it.local.copy(email = it.local.email?.let { emailLine(value) }))
        }
    }

    fun onPasswordChange(value: String) {
        _state.update {
            it.copy(
                password = value,
                local = it.local.copy(
                    password = it.local.password?.let { passwordLine(value) },
                    confirm = it.local.confirm?.let { _ -> confirmLine(value, it.confirm) },
                ),
            )
        }
    }

    /**
     * Repeat password's mismatch line re-checks as either password changes
     * and goes once the two match (Join.md:73); before a press it never shows.
     */
    fun onConfirmChange(value: String) {
        _state.update {
            val line = it.local.confirm?.let { _ -> confirmLine(it.password, value) }
            it.copy(confirm = value, local = it.local.copy(confirm = line))
        }
    }

    /** Leaving by Sign in: both passwords go, the handle and the email stay (Join.md:29). */
    fun onLeave() = _state.update { it.copy(password = "", confirm = "", local = it.local.copy(confirm = null)) }

    fun onSubmit(inviteId: String) {
        val current = _state.value
        if (current.inFlight || current.waiting) return
        val handle = current.handle.trim()
        val email = sanitizedEmail(current.email)
        // Each field is checked on its own (JoinErrors.md:5): the mismatch
        // line stands beside Password's own line.
        val lines = JoinLines(
            handleLine(handle),
            emailLine(email),
            passwordLine(current.password),
            confirmLine(current.password, current.confirm),
        )
        // A refusal the server already gave for this very value is said again
        // rather than asked again, so a press can show it beside a local line.
        val known = JoinLines(
            handle = JoinLine.HANDLE_TAKEN.takeIf { handle in current.taken },
            email = JoinLine.EMAIL_IN_USE.takeIf { email in current.inUse },
        )
        _state.update { it.copy(local = lines, answered = known, fault = null) }
        if (lines.any || known.any) return
        _state.update { it.copy(inFlight = true) }
        viewModelScope.launch {
            val outcome = register.register(
                inviteLink = inviteId,
                handle = handle,
                email = email,
                password = current.password,
                deviceLabel = Build.MODEL,
            )
            when (outcome) {
                is Outcome.Success -> {
                    draft.forget()
                    _state.update { it.copy(inFlight = false, created = true) }
                }
                is Outcome.Refused -> _state.update { refused(it.copy(inFlight = false), outcome, handle, email) }
                is Outcome.Failed -> _state.update { it.copy(inFlight = false, fault = JoinFault.NO_ANSWER) }
            }
        }
    }

    private fun refused(state: JoinUiState, outcome: Outcome.Refused, handle: String, email: String): JoinUiState {
        val error = outcome.errors.first()
        return when (error.code) {
            ErrorCode.HANDLE_TAKEN -> state.copy(
                answered = JoinLines(handle = JoinLine.HANDLE_TAKEN),
                taken = state.taken + handle,
            )
            ErrorCode.EMAIL_IN_USE -> state.copy(
                answered = JoinLines(email = JoinLine.EMAIL_IN_USE),
                inUse = state.inUse + email,
            )
            // The length half never reaches the server: the press checked it.
            ErrorCode.WEAK_PASSWORD -> state.copy(answered = JoinLines(password = JoinLine.PASSWORD_BREACHED))
            ErrorCode.INVITE_UNUSABLE -> state.copy(spent = true)
            ErrorCode.RATE_LIMITED -> state.copy(fault = JoinFault.RATE_LIMITED)
            // BAD_INPUT is said on the field it names, in the field's own words;
            // with no field named it is said in place (copy-voice, the refusals).
            ErrorCode.BAD_INPUT -> when (error.field?.lastOrNull()) {
                "handle" -> state.copy(answered = JoinLines(handle = JoinLine.HANDLE_SHAPE))
                "email" -> state.copy(answered = JoinLines(email = JoinLine.EMAIL_SHAPE))
                "password" -> passwordLine(state.password)
                    ?.let { state.copy(answered = JoinLines(password = it)) }
                    ?: state.copy(fault = JoinFault.NOT_THROUGH)
                else -> state.copy(fault = JoinFault.NOT_THROUGH)
            }
            else -> state.copy(fault = JoinFault.NOT_THROUGH)
        }
    }
}

private fun handleLine(handle: String): JoinLine? = if (handleValid(handle)) null else JoinLine.HANDLE_SHAPE

private fun confirmLine(password: String, confirm: String): JoinLine? =
    if (password == confirm) null else JoinLine.PASSWORDS_DIFFER

private fun emailLine(email: String): JoinLine? = if (emailValid(email)) null else JoinLine.EMAIL_SHAPE

/** Counted in Unicode scalar values, the unit every ruled length is stated in. */
private fun passwordLine(password: String): JoinLine? {
    val length = password.codePointCount(0, password.length)
    return when {
        length < MIN_PASSWORD_LENGTH -> JoinLine.PASSWORD_SHORT
        length > MAX_PASSWORD_LENGTH -> JoinLine.PASSWORD_LONG
        else -> null
    }
}
