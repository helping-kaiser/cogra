package com.cogra.domain

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The signed-in reader's own account state, as this app last read it
 * (`Me.accountState`; auth.md "Application").
 *
 * One app-wide answer for every door that acts on it, so no card or menu
 * reads the account for itself: the reads that already happen record here —
 * the shell's read on each account change, and the feed's own re-reads, the
 * landing's included — and every door reads [applicant]. In memory only, on
 * the [com.cogra.domain.settings.SensitiveContentChoice] pattern: after a cold
 * start nothing is known until the shell's read answers, and a signed-out
 * reader has no standing.
 */
@Singleton
class ReaderStanding @Inject constructor() {

    private val _state = MutableStateFlow<AccountState?>(null)

    /** The account state last read; null when unread or signed out. */
    val state: StateFlow<AccountState?> = _state.asStateFlow()

    /**
     * The reader is an applicant: registered, not yet let in, and so unable
     * to post (ApplicantFeed.md:49, ProfileApplicant.md:26). False while the
     * read has not answered — a member never waits on it.
     */
    val applicant: Boolean
        get() = _state.value == AccountState.APPLICANT

    /** Records the state an account read answered; null on sign-out or an account change. */
    fun record(state: AccountState?) {
        _state.value = state
    }
}
