// The borrowed-view band's wiring (`design/readme.md` §13). The band
// itself is a design-system atom; what lives here is the one read behind
// it and the rule for which of its readings a given reader sees.

package com.cogra.feature.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.atom.BorrowedViewBand
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationProgress
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.cogra.core.designsystem.R as DesignSystemR

data class BorrowedViewUiState(
    val loading: Boolean = true,
    /** Whose view this reader browses from; null once their own exists. */
    val vantage: ActorRef? = null,
)

/**
 * The vantage behind the band. Its own holder rather than a corner of
 * `HomeViewModel`, because this is the one account-shaped read a
 * signed-out reader makes: the banner stack is gated on a session, and
 * the band is not.
 *
 * A transport failure leaves the vantage null and the band away. The band
 * is an honesty label over a feed the reader is already reading, so a
 * failed read must not put a name on screen that nothing answered for.
 */
@HiltViewModel
class BorrowedViewViewModel @Inject constructor(
    private val account: AccountRepository,
    registration: RegistrationFlow,
) : ViewModel() {

    private val _state = MutableStateFlow(BorrowedViewUiState())
    val state = _state.asStateFlow()

    init {
        refresh()
        // Landing is the moment the borrowing ends, and it can happen
        // while this feed is on screen — the flow reports it, so the band
        // leaves with the application instead of on the next app open.
        viewModelScope.launch {
            registration.progress.collect { progress ->
                if (progress is RegistrationProgress.Member) refresh()
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            val vantage = when (val outcome = account.borrowedView()) {
                is Outcome.Success -> outcome.value
                else -> null
            }
            _state.update { BorrowedViewUiState(loading = false, vantage = vantage) }
        }
    }
}

/**
 * The band as a read surface's collapsing top wears it.
 *
 * Which reading it shows follows the session rather than the vantage:
 * both borrow, but only the signed-out reader can do something about it,
 * so theirs invites ("join to build your own") and carries the one
 * sign-in-or-join entry, while the applicant's says what is already under
 * way and carries no action — the line changes, the vantage does not.
 */
@Composable
fun BorrowedViewBandRoute(
    signedIn: Boolean,
    onSignInOrJoin: () -> Unit,
    viewModel: BorrowedViewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BorrowedViewBanner(state, signedIn, onSignInOrJoin)
}

@Composable
fun BorrowedViewBanner(
    state: BorrowedViewUiState,
    signedIn: Boolean,
    onSignInOrJoin: () -> Unit,
) {
    if (state.loading) return
    val vantage = state.vantage ?: return
    BorrowedViewBand(
        handle = vantage.handle,
        displayName = vantage.displayName,
        avatarUrl = vantage.avatar?.url,
        // The three ruled readings live beside each other in the design
        // system, where the component is.
        line = stringResource(
            if (signedIn) {
                DesignSystemR.string.borrowed_view_applicant
            } else {
                DesignSystemR.string.borrowed_view_join
            },
            vantage.handle,
        ),
        actionLabel = if (signedIn) {
            null
        } else {
            stringResource(DesignSystemR.string.borrowed_view_sign_in_or_join)
        },
        onAction = if (signedIn) null else onSignInOrJoin,
        testTag = "home_borrowed_view",
    )
}
