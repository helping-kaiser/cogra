// The device lock's start-time duties (sign-out-custody §3.4-§3.5), mounted
// once beside the shell's notices:
// - every app start: a lock a process death interrupted is finished, and a
//   locked slot's leftover plaintext draft is removed — for every account on
//   the device, signed in or not;
// - every signed-in start of a "don't remember" account that holds no lock:
//   the issue is retried (the holding invariant's fourth reconcile point — a
//   switch flipped offline, an issue that got no answer).
//
// Never in the way: both run behind the shell, and a store fault is left for
// the next start to try again.

package com.cogra.app.ui

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.identity.DeviceLock
import com.cogra.domain.store.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.io.IOException
import javax.inject.Inject

@HiltViewModel
class DeviceLockKeeperViewModel @Inject constructor(
    private val deviceLock: DeviceLock,
    private val tokens: TokenStore,
) : ViewModel() {
    init {
        viewModelScope.launch {
            quietly { deviceLock.recover() }
            tokens.tokens.map { it?.accountId }.distinctUntilChanged().collect { account ->
                if (account != null) quietly { deviceLock.retryHoldOnStart() }
            }
        }
    }

    private suspend fun quietly(block: suspend () -> Unit) {
        try {
            block()
        } catch (_: IOException) {
            // the next start tries again
        }
    }
}

@Composable
fun DeviceLockKeeper() {
    hiltViewModel<DeviceLockKeeperViewModel>()
}
