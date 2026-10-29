// The subpages' drawn lines under Robolectric, bound to the registered
// `changePassword.*`, `changeHandle.*`, `changeEmail.*` and `about.*`
// paths.

package com.cogra.feature.settings

import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SubpageScreensTest {

    @get:Rule
    val compose = createComposeRule()

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    /** The dialog body's paragraph [text] (`DialogSurface`'s body holds its paragraphs). */
    private fun dialogBody(tag: String, text: String) =
        compose.onNode(hasText(text) and hasAnyAncestor(hasTestTag(tag)), useUnmergedTree = true).assertExists()

    /** A button reads its label through its merged node. */
    private fun button(tag: String) = compose.onNodeWithTag(tag)

    private fun absent(tag: String) =
        assertThat(compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()

    // ---------------------------------------------------- ChangePassword

    private fun password(state: ChangePasswordUiState) = compose.setContent {
        ChangePasswordScreen(state, onBack = {}, onCurrent = {}, onNew = {}, onCommit = {})
    }

    @Test
    fun thePasswordPageReadsAsDrawn() {
        password(ChangePasswordUiState(account = "sol@solferreira.art"))
        node("changePassword.title").assertTextEquals("Change your password")
        node("changePassword.commit.reason").assertTextEquals("Waiting for both passwords")
        node("changePassword.commit.action").assertIsNotEnabled()
        node("changePassword.password.support").assertTextEquals("At least 12 characters.")
        // No title in the band, and back says where it goes.
        absent("changePassword.header.title")
    }

    @Test
    fun `changing_password_label_after_200ms`() {
        compose.mainClock.autoAdvance = false
        password(ChangePasswordUiState(current = "a", newPassword = "b".repeat(12), inFlight = true))
        compose.mainClock.advanceTimeByFrame()
        button("changePassword.commit.action").assertTextEquals("Change password")
        compose.mainClock.advanceTimeBy(250)
        button("changePassword.commit.action").assertTextEquals("Changing password…")
    }

    @Test
    fun theFaultStandsAboveTheCommit() {
        password(ChangePasswordUiState(current = "a", newPassword = "b".repeat(12), fault = R.string.rate_limited))
        node("change_password_fault").assertTextEquals("Too many tries. Wait a little, then try again.")
    }

    @Test
    fun theFieldsAskForPasswordsByKind() {
        password(ChangePasswordUiState())
        val current = node("changePassword.current.input").fetchSemanticsNode()
        val fresh = node("changePassword.password.input").fetchSemanticsNode()
        assertThat(current.config.getOrNull(SemanticsProperties.ContentType)).isEqualTo(ContentType.Password)
        assertThat(fresh.config.getOrNull(SemanticsProperties.ContentType)).isEqualTo(ContentType.NewPassword)
    }

    // ------------------------------------------------------ ChangeHandle

    private fun handle(state: ChangeHandleUiState) = compose.setContent {
        ChangeHandleScreen(state, onBack = {}, onHandle = {}, onCommit = {}, onChangeIt = {}, onKeep = {})
    }

    @Test
    fun theHandleLeadNamesTheCurrentHandle() {
        handle(ChangeHandleUiState(current = "sol"))
        node("changeHandle.body").assertTextEquals(
            "@sol is how people mention and find you. Everything you have published stays yours — the handle is a " +
                "name, not the account.",
        )
        node("changeHandle.commit.reason").assertTextEquals("Waiting for a new handle")
    }

    @Test
    fun `dialog_focus_moves_to_title_and_stays_inside`() {
        handle(ChangeHandleUiState(current = "sol", handle = "solferreira", dialogOpen = true))
        node("changeHandle.dialog.title").assertTextEquals("Change your handle to @solferreira?")
        dialogBody("changeHandle.dialog.body",
            "Links to @sol stop working the moment it changes, and anyone can claim @sol afterwards.",
        )
        node("changeHandle.dialog.title").assertIsFocused()
    }

    @Test
    fun `changing_handle_label_only_after_200ms`() {
        compose.mainClock.autoAdvance = false
        handle(ChangeHandleUiState(current = "sol", handle = "solferreira", dialogOpen = true, inFlight = true))
        compose.mainClock.advanceTimeByFrame()
        button("changeHandle.dialog.change").assertTextEquals("Change it")
        compose.mainClock.advanceTimeBy(250)
        button("changeHandle.dialog.change").assertTextEquals("Changing handle…")
    }

    @Test
    fun theOfflineDialogReadsRetry() {
        handle(ChangeHandleUiState(current = "sol", handle = "solferreira", dialogOpen = true, dialogFault = true))
        button("changeHandle.dialog.change").assertTextEquals("Retry")
        node("change_handle_dialog_fault").assertTextEquals("That didn't send. Try again.")
    }

    @Test
    fun theTakenLineStandsOnTheField() {
        handle(ChangeHandleUiState(current = "sol", handle = "solferreira", error = R.string.change_handle_taken))
        node("changeHandle.handle.support").assertTextEquals("That handle is taken.")
    }

    // ------------------------------------------------------- ChangeEmail

    private fun email(state: ChangeEmailUiState, applicant: Boolean = false) = compose.setContent {
        ChangeEmailScreen(state, applicant, onBack = {}, onNewEmail = {}, onPassword = {}, onCommit = {})
    }

    @Test
    fun `request_carries_no_code_field`() {
        email(ChangeEmailUiState(address = "sol@solferreira.art"))
        absent("changeEmail.code")
        node("changeEmail.note").assertTextEquals(
            "A code goes to sol@solferreira.art and a link to the new address. Your email is unchanged until both " +
                "have been answered.",
        )
        // The fault chip at rest keys the fields `none`.
        compose.onNode(hasTestTag("changeEmail.email:none"), useUnmergedTree = true).assertExists()
        node("changeEmail.commit:none").assertExists()
    }

    @Test
    fun theWrongPasswordChipKeysThePasswordFault() {
        email(
            ChangeEmailUiState(
                address = "sol@solferreira.art",
                newEmail = "a@b.c",
                password = "x",
                wrongPassword = true,
            ),
        )
        compose.onNode(hasTestTag("changeEmail.current:password"), useUnmergedTree = true).assertExists()
        node("changeEmail.current.support").assertTextEquals("That password isn't right.")
    }

    @Test
    fun theApplicantsPageNamesWhereTheStandingLinkWent() {
        email(ChangeEmailUiState(address = "noor@fieldmail.org"), applicant = true)
        node("changeEmail.body").assertTextEquals(
            "Your email isn't verified yet, so the new address is all a change needs. A fresh link goes there, and " +
                "the one sent to noor@fieldmail.org stops working.",
        )
        absent("changeEmail.note")
        node("changeEmail.email").assertExists()
    }

    // ------------------------------------------------ ChangeEmailConfirm

    private fun confirm(state: ConfirmEmailUiState) = compose.setContent {
        ChangeEmailConfirmScreen(state, onBack = {}, onCode = {}, onConfirm = {}, onResend = {}, onCancel = {})
    }

    @Test
    fun `commit_reads_confirm_the_code`() {
        confirm(ConfirmEmailUiState(email = "sol@solferreira.art", pending = pending()))
        button("changeEmail.commit.action").assertTextEquals("Confirm the code")
        node("changeEmail.commit.reason").assertTextEquals("Waiting for the code")
        node("changeEmail.code.support").assertTextEquals("From the message to sol@solferreira.art.")
    }

    @Test
    fun `pair_names_both_addresses_still_waiting`() {
        confirm(ConfirmEmailUiState(email = "sol@solferreira.art", pending = pending()))
        node("changeEmail.pair.label").assertTextEquals("Both have to land")
        node("changeEmail.pair.codeSide").assertTextEquals("sol@solferreira.art — still waiting")
        node("changeEmail.pair.linkSide").assertTextEquals("sol@ferreira.studio — still waiting")
    }

    @Test
    fun aLandedSideReadsConfirmedAndTheCodeFieldGoes() {
        confirm(ConfirmEmailUiState(email = "sol@solferreira.art", pending = pending(codeConfirmed = true)))
        node("changeEmail.pair.codeSide").assertTextEquals("sol@solferreira.art — confirmed")
        absent("changeEmail.code")
        absent("changeEmail.commit")
        node("changeEmail.cancel").assertTextEquals("Cancel the change")
    }

    @Test
    fun `code_confirmed_reads_the_interim_line_with_the_new_address`() {
        confirm(ConfirmEmailUiState(email = "sol@solferreira.art", pending = pending(codeConfirmed = true)))
        node("changeEmail.codeDone").assertTextEquals("Done on this side — now open the link at sol@ferreira.studio")
    }

    @Test
    fun `the interim line is absent while the code is still owed`() {
        confirm(ConfirmEmailUiState(email = "sol@solferreira.art", pending = pending()))
        absent("changeEmail.codeDone")
    }

    @Test
    fun `code_field_is_numeric_one_time_code`() {
        confirm(ConfirmEmailUiState(email = "sol@solferreira.art", pending = pending()))
        val code = node("changeEmail.code.input").fetchSemanticsNode()
        assertThat(code.config.getOrNull(SemanticsProperties.ContentType)).isEqualTo(ContentType.SmsOtpCode)
    }

    // ------------------------------------------------- ChangeEmailLinked

    /** Each Sign in tapped, by whether it held the link. */
    private val signIns = mutableListOf<Boolean>()

    private fun landing(landing: LinkedLanding) = compose.setContent {
        ChangeEmailLinkedScreen(landing, onEnterTheCode = {}, onBackToSettings = {}, onSignIn = { signIns += it })
    }

    @Test
    fun `landing_has_no_back_arrow`() {
        landing(LinkedLanding.First("sol@solferreira.art"))
        absent("changeEmail.header")
        absent("changeEmail.header.back")
        node("changeEmail.mark").assertExists()
        node("changeEmail.title").assertTextEquals("New address confirmed")
        button("changeEmail.onward").assertTextEquals("Enter the code")
    }

    @Test
    fun theOtherAccountLandingIsMarkless() {
        landing(LinkedLanding.OtherAccount)
        absent("changeEmail.mark")
        node("changeEmail.title").assertTextEquals("This link isn't for this account")
        button("changeEmail.onward").assertTextEquals("Back to settings")
    }

    @Test
    fun theSignedOutLandingNamesTheNewAddressAndSignsIn() {
        landing(LinkedLanding.SignedOut("sol@ferreira.studio"))
        absent("changeEmail.mark")
        node("changeEmail.body").assertTextEquals(
            "This link confirms sol@ferreira.studio as your new address. It counts once you're signed in.",
        )
        button("changeEmail.onward").assertTextEquals("Sign in")
        button("changeEmail.onward").performClick()
        // A live link's Sign in holds it.
        assertThat(signIns).containsExactly(true)
    }

    @Test
    fun `signed_out_dead_or_unknown_link_reads_the_drawn_dead_landing`() {
        landing(LinkedLanding.Dead(signedIn = false))
        absent("changeEmail.mark")
        node("changeEmail.title").assertTextEquals("This link doesn't work anymore")
        node("changeEmail.body").assertTextEquals(
            "The change it belonged to may have run out, been canceled or already happened — " +
                "this link can't move your email anymore.",
        )
        button("changeEmail.onward").assertTextEquals("Sign in")
    }

    @Test
    fun `signed_out_dead_link_sign_in_never_holds_the_link`() {
        landing(LinkedLanding.Dead(signedIn = false))
        button("changeEmail.onward").performClick()
        assertThat(signIns).containsExactly(false)
    }

    @Test
    fun `signed_in_unknown_link_reads_the_drawn_unknown_landing`() {
        landing(LinkedLanding.Dead(signedIn = true))
        node("changeEmail.mark").assertExists()
        node("changeEmail.title").assertTextEquals("This link doesn't work anymore")
        node("changeEmail.body").assertTextEquals(
            "It isn't a link CoGra knows — it may be mistyped, or from a change long gone. Your email stays as it is.",
        )
        button("changeEmail.onward").assertTextEquals("Back to settings")
    }

    // -------------------------------------------------------------- About

    @Test
    fun `opens_with_every_topic_closed`() {
        compose.setContent { AboutScreen(onBack = {}) }
        assertThat(AboutTopics.map { it.key }).containsExactly(
            "what-this-is",
            "your-feed-is-your-own-steps",
            "everything-here-is-public",
            "an-opinion-says-two-things",
            "nothing-is-lost",
            "money-follows-the-reach-you-made",
            "getting-in-and-being-let-in",
            "your-key-is-yours",
            "this-page-grows",
        ).inOrder()
        absent("about.topic.answer")
    }

    @Test
    fun `topics_open_and_fold_independently`() {
        compose.setContent { AboutScreen(onBack = {}) }
        val rows = compose.onAllNodesWithTag("about.topic.row", useUnmergedTree = true)
        rows[0].performClick()
        rows[2].performClick()
        assertThat(compose.onAllNodesWithTag("about.topic.answer", useUnmergedTree = true).fetchSemanticsNodes())
            .hasSize(2)
        compose.onAllNodesWithTag("about.topic.row", useUnmergedTree = true)[0].performClick()
        assertThat(compose.onAllNodesWithTag("about.topic.answer", useUnmergedTree = true).fetchSemanticsNodes())
            .hasSize(1)
    }

    @Test
    fun `back_reads_back_to_settings_from_settings`() {
        var back = 0
        compose.setContent { AboutScreen(onBack = { back++ }) }
        node("about.header.title").assertTextEquals("About CoGra")
        compose.onNode(hasContentDescription("Back to settings"), useUnmergedTree = true).assertExists()
        node("about.header.back").performClick()
        assertThat(back).isEqualTo(1)
    }
}
