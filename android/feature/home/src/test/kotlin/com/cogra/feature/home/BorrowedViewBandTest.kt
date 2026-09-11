package com.cogra.feature.home

import android.content.Context
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import com.cogra.core.designsystem.R as DesignSystemR

/**
 * Which reading of the borrowed-view band a given reader sees
 * (`design/readme.md` §13). The copy is read out of the resources rather
 * than transcribed here: what these pin is which of the ruled readings
 * shows, not the words themselves — those are pinned once, in the design
 * system's own atom test.
 */
@RunWith(RobolectricTestRunner::class)
class BorrowedViewBandTest {

    @get:Rule
    val compose = createComposeRule()

    private val context: Context = ApplicationProvider.getApplicationContext()

    private val vantage = ActorRef(id = "a1", handle = "genesis_mod", displayName = "Genesis Moderator")

    private fun render(
        state: BorrowedViewUiState,
        onSignInOrJoin: () -> Unit = {},
    ) {
        compose.setContent { BorrowedViewBanner(state, onSignInOrJoin) }
    }

    /**
     * The guest reading invites and carries the shell's one
     * sign-in-or-join entry — the band subsumes the guest notice.
     */
    @Test
    fun aSignedOutReaderIsToldWhoseViewTheyBrowseFromAndOfferedTheWayIn() {
        var joining = false
        render(
            BorrowedViewUiState(
                loading = false,
                vantage = vantage,
                reading = BorrowedViewReading.JOIN,
            ),
            onSignInOrJoin = { joining = true },
        )

        compose.onNodeWithTag("home_borrowed_view_line").assertTextEquals(
            context.getString(DesignSystemR.string.borrowed_view_join, "genesis_mod"),
        )
        compose.onNodeWithTag("home_borrowed_view_action").performClick()
        assertThat(joining).isTrue()
    }

    /**
     * An applicant borrows the same way but can do nothing about it, so
     * their line says what is already under way and the action drops.
     * The band must be there from the moment the account exists — before
     * the email is verified, before the application lands — which is the
     * state a fresh account is in and the defect this pins.
     */
    @Test
    fun anApplicantSeesTheirInvitersViewNamedWithNoActionBeside() {
        render(
            BorrowedViewUiState(
                loading = false,
                vantage = ActorRef(id = "a2", handle = "mira", displayName = "Mira Voss"),
                reading = BorrowedViewReading.APPLICANT,
            ),
        )

        compose.onNodeWithTag("home_borrowed_view_line").assertTextEquals(
            context.getString(DesignSystemR.string.borrowed_view_applicant, "mira"),
        )
        compose.onNodeWithTag("home_borrowed_view_action").assertDoesNotExist()
    }

    /**
     * Landing grants membership; the vouch-back is what gives the reader a
     * view of their own (§13). Between them the band still names the
     * inviter, and its line names the act that ends the borrowing — the
     * control for which is the reciprocation card below, not a second
     * button up here.
     */
    @Test
    fun aLandedMemberWhoHasNotPointedBackIsAskedToVouchBack() {
        render(
            BorrowedViewUiState(
                loading = false,
                vantage = ActorRef(id = "a2", handle = "mira", displayName = "Mira Voss"),
                reading = BorrowedViewReading.VOUCH_BACK,
            ),
        )

        compose.onNodeWithTag("home_borrowed_view_line").assertTextEquals(
            context.getString(DesignSystemR.string.borrowed_view_vouch_back, "mira"),
        )
        compose.onNodeWithTag("home_borrowed_view_action").assertDoesNotExist()
    }

    /**
     * A null vantage is the contract saying this reader's view is their
     * own — the landed member — and the band leaving is the rule, not a
     * gap in the data.
     */
    @Test
    fun aReaderWithTheirOwnViewGetsNoBand() {
        render(
            BorrowedViewUiState(
                loading = false,
                vantage = null,
                reading = BorrowedViewReading.VOUCH_BACK,
            ),
        )

        compose.onNodeWithTag("home_borrowed_view").assertDoesNotExist()
    }

    /** Nothing is named while the read is still out. */
    @Test
    fun nothingShowsWhileTheVantageIsStillLoading() {
        render(BorrowedViewUiState(loading = true, vantage = vantage))

        compose.onNodeWithTag("home_borrowed_view").assertDoesNotExist()
    }

    // The wording follows the reader's own state; the vantage says only
    // whose view it is. An unknown state takes the weaker claim.
    @Test
    fun theReadingFollowsTheSessionAndTheAccountState() {
        assertThat(readingFor(signedIn = false, accountState = null))
            .isEqualTo(BorrowedViewReading.JOIN)
        assertThat(readingFor(signedIn = false, accountState = AccountState.MEMBER))
            .isEqualTo(BorrowedViewReading.JOIN)
        assertThat(readingFor(signedIn = true, accountState = AccountState.APPLICANT))
            .isEqualTo(BorrowedViewReading.APPLICANT)
        assertThat(readingFor(signedIn = true, accountState = AccountState.MEMBER))
            .isEqualTo(BorrowedViewReading.VOUCH_BACK)
        assertThat(readingFor(signedIn = true, accountState = null))
            .isEqualTo(BorrowedViewReading.APPLICANT)
        assertThat(readingFor(signedIn = true, accountState = AccountState.UNKNOWN))
            .isEqualTo(BorrowedViewReading.APPLICANT)
    }
}
