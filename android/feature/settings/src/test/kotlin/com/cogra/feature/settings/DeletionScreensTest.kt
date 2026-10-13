// The account deletion's screens under Robolectric, bound to the registered
// `deleteAccount.*` paths (nodes.json "DeleteAccount", "DeleteAccountMail",
// "DeleteAccountPending", "DeleteAccountConfirmed").

package com.cogra.feature.settings

import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.deletion.AccountDeletion
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DeletionScreensTest {

    @get:Rule
    val compose = createComposeRule()

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    private fun request(state: DeleteAccountUiState, onSend: () -> Unit = {}, onDeleteNow: () -> Unit = {}) {
        compose.setContent {
            DeleteAccountScreen(state, onBack = {}, onToggleSweep = {}, onSend = onSend, onDeleteNow = onDeleteNow)
        }
    }

    // ------------------------------------------------------- the request

    @Test
    fun `the_members_request_says_what_goes_and_what_stays_and_sends_the_link`() {
        var sent = 0
        request(DeleteAccountUiState(case = DeleteAccountCase.MEMBER), onSend = { sent++ })
        node("deleteAccount.title").assertTextEquals("Delete account")
        node("deleteAccount.body").assertTextEquals(
            "This takes your name off CoGra. What you signed stays on the graph, because it is other " +
                "people's record as much as yours — what goes is everything that says it was you.",
        )
        node("deleteAccount.goes.label").assertTextEquals("What goes")
        node("deleteAccount.stays.label").assertTextEquals("What stays")
        node("deleteAccount.sweep").assertIsOff()
        node("deleteAccount.sweep.label").assertTextEquals("Also remove what I posted")
        node("deleteAccount.commit:member").performScrollTo().assertTextEquals("Send the confirmation link")
            .performClick()
        assertThat(sent).isEqualTo(1)
        node("deleteAccount.note").assertExists()
        node("deleteAccount.commit:applicant").assertDoesNotExist()
    }

    @Test
    fun `a_ticked_sweep_reads_ticked`() {
        request(DeleteAccountUiState(case = DeleteAccountCase.MEMBER, includeContent = true))
        node("deleteAccount.sweep").assertIsOn()
    }

    @Test
    fun `a_send_with_no_answer_stands_its_line_above_the_commit`() {
        request(DeleteAccountUiState(case = DeleteAccountCase.MEMBER, fault = R.string.network_error))
        node("deleteAccount.commit:member_fault").performScrollTo().assertTextEquals("That didn't send. Try again.")
        node("deleteAccount.commit:member").assertTextEquals("Send the confirmation link")
    }

    @Test
    fun `the_applicants_case_deletes_at_once_and_draws_none_of_the_members_parts`() {
        var deleted = 0
        request(DeleteAccountUiState(case = DeleteAccountCase.APPLICANT), onDeleteNow = { deleted++ })
        node("deleteAccount.body")
            .assertTextEquals("Nothing has landed yet — deleting removes your application and your account right away.")
        node("deleteAccount.commit:applicant").assertTextEquals("Delete my account").performClick()
        assertThat(deleted).isEqualTo(1)
        node("deleteAccount.goes").assertDoesNotExist()
        node("deleteAccount.stays").assertDoesNotExist()
        node("deleteAccount.sweep").assertDoesNotExist()
        node("deleteAccount.note").assertDoesNotExist()
        node("deleteAccount.commit:member").assertDoesNotExist()
    }

    @Test
    fun `no_case_is_drawn_before_the_path_is_read`() {
        request(DeleteAccountUiState())
        node("deleteAccount.commit:member").assertDoesNotExist()
        node("deleteAccount.commit:applicant").assertDoesNotExist()
    }

    // ----------------------------------------------------------- the mail

    @Test
    fun `the_mail_screen_names_the_address_and_offers_resend`() {
        var resent = 0
        compose.setContent {
            DeleteAccountMailScreen(
                DeleteAccountMailUiState(email = "sol@solferreira.art"),
                onBack = {},
                onResend = { resent++ },
            )
        }
        node("deleteAccount.title").assertTextEquals("Check your mail")
        node("deleteAccount.body").assertTextEquals(
            "We sent a link to sol@solferreira.art. Opening it confirms the deletion and starts the seven days.",
        )
        node("deleteAccount.note").assertExists()
        node("deleteAccount.resend").assertTextEquals("Resend the link").performClick()
        assertThat(resent).isEqualTo(1)
    }

    // -------------------------------------------------------- the grace

    @Test
    fun `the_grace_page_states_the_deadline_in_full_with_cancel`() {
        var canceled = 0
        compose.setContent {
            DeleteAccountPendingScreen(
                DeleteAccountPendingUiState(
                    deletion = AccountDeletion(NOW.plusSeconds(6 * 86_400), includesContent = false),
                    now = NOW,
                ),
                onBack = {},
                onCancel = { canceled++ },
            )
        }
        node("deleteAccount.title").assertTextEquals("Delete account")
        node("deleteAccount.body").assertTextEquals(
            "Your account is deleted in 6 days, on 13.10.2026. Until then nothing has changed, " +
                "and canceling keeps everything as it is.",
        )
        node("deleteAccount.cancel").assertTextEquals("Cancel").performClick()
        assertThat(canceled).isEqualTo(1)
    }

    // ------------------------------------------------------ the landing

    private fun landing(deletion: AccountDeletion, signedIn: Boolean, onward: () -> Unit = {}) {
        compose.setContent {
            DeleteAccountConfirmedScreen(
                DeleteAccountConfirmedUiState(landing = ConfirmedLanding.Confirmed(deletion), now = NOW),
                signedIn = signedIn,
                onToggleSweep = {},
                onAdd = {},
                onRetry = {},
                onGoToFeed = onward,
                onSignIn = onward,
            )
        }
    }

    @Test
    fun `the_landing_states_the_seven_days_and_offers_the_sweep_signed_in`() {
        var onward = 0
        landing(AccountDeletion(NOW.plusSeconds(7 * 86_400), includesContent = false), signedIn = true) { onward++ }
        node("deleteAccount.title").assertTextEquals("Your account is deleted in 7 days")
        node("deleteAccount.body")
            .assertTextEquals("That's 14.10.2026. Until then nothing changes, and you can cancel from any device.")
        node("deleteAccount.sweep").assertIsOff()
        node("deleteAccount.add").assertTextEquals("Add it to the deletion")
        node("deleteAccount.onward").performScrollTo().assertTextEquals("Go to the feed").performClick()
        assertThat(onward).isEqualTo(1)
        node("delete_confirmed_signed_out").assertDoesNotExist()
    }

    @Test
    fun `with_the_sweep_in_the_heading_names_it_and_nothing_is_offered`() {
        landing(AccountDeletion(NOW.plusSeconds(7 * 86_400), includesContent = true), signedIn = true)
        node("deleteAccount.title").assertTextEquals("Your account and everything you posted are deleted in 7 days")
        node("deleteAccount.sweep").assertDoesNotExist()
        node("deleteAccount.add").assertDoesNotExist()
    }

    @Test
    fun `signed_out_one_quiet_line_says_the_link_was_enough_and_the_way_on_is_sign_in`() {
        landing(AccountDeletion(NOW.plusSeconds(7 * 86_400), includesContent = false), signedIn = false)
        node("delete_confirmed_signed_out").performScrollTo()
            .assertTextEquals("You're not signed in here, and you don't need to be — the link was the proof.")
        node("deleteAccount.onward").assertTextEquals("Sign in")
    }
}
