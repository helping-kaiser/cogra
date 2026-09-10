// The borrowed-view band's wiring (`design/readme.md` §13). The band
// itself is a design-system atom; what lives here is the one read behind
// it and the rule for which of its readings a given reader sees.

package com.cogra.feature.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.atom.BorrowedViewBand
import com.cogra.domain.AccountState
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

/**
 * Which of the three ruled readings the band wears (`design/readme.md`
 * §13). All three name the same borrowed vantage; they differ in what the
 * reader can do about it, which is a fact about the reader and not about
 * the vantage — so the server says WHOSE view it is and this says how to
 * put it.
 */
enum class BorrowedViewReading {
    /** Signed out: the one reader who can act on it, so it invites. */
    JOIN,

    /** Mid-application: nothing to do but wait, so it explains. */
    APPLICANT,

    /** Landed, not yet pointed back: the act that ends it is named. */
    VOUCH_BACK,
}

data class BorrowedViewUiState(
    val loading: Boolean = true,
    /** Whose view this reader browses from; null once their own exists. */
    val vantage: ActorRef? = null,
    val reading: BorrowedViewReading = BorrowedViewReading.JOIN,
)

/**
 * The vantage behind the band. Its own holder rather than a corner of
 * `HomeViewModel`, because this is the one account-shaped read a
 * signed-out reader makes: the banner stack is gated on a session, and
 * the band is not.
 *
 * WHETHER a band shows is the server's call — `borrowedView` answers null
 * the moment the reader's own view exists — and this asks the account
 * state only to pick the wording. Keeping the rule on one side is what
 * stopped the applicant band from existing on one platform and not the
 * other, so the account read is deliberately downstream of the vantage:
 * no vantage, no second question.
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

    private var signedIn = false

    init {
        // Landing does not end the borrowing — the vouch-back does — but it
        // does change the reading, and it can happen while this feed is on
        // screen. The flow reports it, so the line changes with the landing
        // instead of on the next app open.
        viewModelScope.launch {
            registration.progress.collect { progress ->
                if (progress is RegistrationProgress.Member) refresh()
            }
        }
    }

    /** The session the shell resolved; drives the read and the wording. */
    fun onSession(signedIn: Boolean) {
        this.signedIn = signedIn
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val vantage = account.borrowedView().valueOrNull()
            // Only a reader who has a vantage is shown a line at all, and a
            // signed-out one needs no account read to know their reading.
            val accountState = if (vantage != null && signedIn) {
                account.me().valueOrNull()?.accountState
            } else {
                null
            }
            _state.update {
                BorrowedViewUiState(
                    loading = false,
                    vantage = vantage,
                    reading = readingFor(signedIn, accountState),
                )
            }
        }
    }
}

/**
 * An unknown account state reads as the applicant's line rather than the
 * member's: it is the weaker claim of the two — it says the application is
 * under way, where the vouch-back line asks for an act the reader may not
 * be able to perform yet.
 */
internal fun readingFor(signedIn: Boolean, accountState: AccountState?): BorrowedViewReading = when {
    !signedIn -> BorrowedViewReading.JOIN
    accountState == AccountState.MEMBER -> BorrowedViewReading.VOUCH_BACK
    else -> BorrowedViewReading.APPLICANT
}

private fun <T> Outcome<T>.valueOrNull(): T? = (this as? Outcome.Success)?.value

/**
 * The band as a read surface's collapsing top wears it.
 *
 * The action rides the guest's reading alone. The other two name an act
 * the reader performs elsewhere — the application runs itself, and the
 * vouch-back has its own card in the banner stack below — and one act
 * offered by two controls on one screen is the ambiguity §2.4 refuses.
 */
@Composable
fun BorrowedViewBandRoute(
    signedIn: Boolean,
    onSignInOrJoin: () -> Unit,
    viewModel: BorrowedViewViewModel = hiltViewModel(),
) {
    LaunchedEffect(signedIn) { viewModel.onSession(signedIn) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    BorrowedViewBanner(state, onSignInOrJoin)
}

@Composable
fun BorrowedViewBanner(
    state: BorrowedViewUiState,
    onSignInOrJoin: () -> Unit,
) {
    if (state.loading) return
    val vantage = state.vantage ?: return
    val guest = state.reading == BorrowedViewReading.JOIN
    BorrowedViewBand(
        handle = vantage.handle,
        displayName = vantage.displayName,
        avatarUrl = vantage.avatar?.url,
        // The three ruled readings live beside each other in the design
        // system, where the component is.
        line = stringResource(
            when (state.reading) {
                BorrowedViewReading.JOIN -> DesignSystemR.string.borrowed_view_join
                BorrowedViewReading.APPLICANT -> DesignSystemR.string.borrowed_view_applicant
                BorrowedViewReading.VOUCH_BACK -> DesignSystemR.string.borrowed_view_vouch_back
            },
            vantage.handle,
        ),
        actionLabel = if (guest) {
            stringResource(DesignSystemR.string.borrowed_view_sign_in_or_join)
        } else {
            null
        },
        onAction = if (guest) onSignInOrJoin else null,
        testTag = "home_borrowed_view",
    )
}
