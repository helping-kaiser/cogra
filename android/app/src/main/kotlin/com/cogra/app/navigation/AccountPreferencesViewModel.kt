// The account's cross-device preferences, read into the app whenever the
// signed-in account changes (settings packet §3.1a: "the apps read
// `me.preferences`, never a local copy that could disagree"). The shell
// holds this once, so every veil the app draws — the feed's cards, a
// post's detail and its pinned clip, the comments sheet — answers the
// account's sensitive-content choice without each screen asking for it.
// Signed out, it forgets: a guest reads veiled.

package com.cogra.app.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.settings.SensitiveContentChoice
import com.cogra.domain.store.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AccountPreferencesViewModel @Inject constructor(
    tokens: TokenStore,
    private val account: AccountRepository,
    private val sensitive: SensitiveContentChoice,
) : ViewModel() {

    /** Whether the signed-in account always unveils sensitive content. */
    val alwaysUnveil: StateFlow<Boolean> = sensitive.alwaysUnveil

    init {
        viewModelScope.launch {
            tokens.tokens.map { it?.accountId }.distinctUntilChanged().collectLatest { accountId ->
                // A new account (or none) starts veiled until its own read
                // answers; nothing of the previous account's choice carries.
                sensitive.record(null)
                if (accountId == null) return@collectLatest
                val read = account.me()
                if (read is Outcome.Success) sensitive.record(read.value?.contentFilteringSeverityLevel)
            }
        }
    }
}
