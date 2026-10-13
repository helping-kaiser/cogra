// The Settings page and what opens over it, under Robolectric, bound to
// the registered `settings.*` paths (nodes.json "Settings",
// "SettingsEmailPending", "SettingsLicense", "SignOutConfirm").

package com.cogra.feature.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.AccountState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.DeletionStanding
import com.cogra.domain.stance.StanceInputMode
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.MutableSharedFlow
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SettingsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        state: SettingsUiState = SettingsUiState(account = account(), actorKeyHere = true, now = NOW),
        actions: SettingsActions = SettingsActions(),
        doors: SettingsDoors = SettingsDoors(),
        events: MutableSharedFlow<SettingsEvent> = MutableSharedFlow(),
    ) {
        compose.setContent {
            SettingsScreen(state = state, versionName = "0.1.0", actions = actions, doors = doors, events = events)
        }
    }

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    /** A part inside the keyed session row [key]. */
    private fun sessionPart(key: Int, part: String) = compose.onNode(
        hasTestTag("settings.sessions.session.$part") and
            hasAnyAncestor(hasTestTag("settings.sessions.session:$key")),
        useUnmergedTree = true,
    )

    private fun top(tag: String): Float =
        node(tag).fetchSemanticsNode().positionInRoot.y

    @Test
    fun `groups_stand_in_the_ruled_order`() {
        render()
        val order = listOf(
            "theme", "stance", "writing", "reading", "people", "sensitive", "backup", "clearing", "sessions",
            "credentials", "about", "leaving", "ending",
        ).map { top("settings.$it") }
        assertThat(order).isInStrictOrder()
    }

    // ------------------------------------------------- sensitive content (B5)

    @Test
    fun `sensitive_group_stands_after_people`() {
        render()
        node("settings.sensitive").performScrollTo()
        node("settings.sensitive.label").assertTextEquals("Sensitive content")
        node("settings.sensitive.footnote").assertTextEquals("This choice follows your account to every device.")
        assertThat(top("settings.people")).isLessThan(top("settings.sensitive"))
        assertThat(top("settings.sensitive")).isLessThan(top("settings.backup"))
        // One switch, never a sheet or a pair of rows.
        assertThat(
            compose.onAllNodes(
                hasAnyAncestor(hasTestTag("settings.sensitive")) and
                    SemanticsMatcher.keyIsDefined(SemanticsProperties.ToggleableState),
            ).fetchSemanticsNodes(),
        ).hasSize(1)
    }

    @Test
    fun `unveil_switch_reads_off_by_default`() {
        render()
        node("settings.sensitive.unveil").performScrollTo().assertIsOff()
        node("settings.sensitive.unveil.label").assertTextEquals("Always unveil sensitive content")
        node("settings.sensitive.unveil.status").assertTextEquals("Off, the veil stays until you tap it.")
    }

    @Test
    fun `the unveil switch reads on and swaps in the On line`() {
        var flips = 0
        render(
            state = SettingsUiState(account = account(), actorKeyHere = true, now = NOW, alwaysUnveil = true),
            actions = SettingsActions(onAlwaysUnveil = { flips++ }),
        )
        node("settings.sensitive.unveil").performScrollTo().assertIsOn().performClick()
        node("settings.sensitive.unveil.status")
            .assertTextEquals("On, sensitive content stands unveiled wherever you read.")
        assertThat(flips).isEqualTo(1)
    }

    private fun deleting(path: AccountDeletionPath, deletion: AccountDeletion? = null) = SettingsUiState(
        account = account(),
        actorKeyHere = true,
        now = NOW,
        deletion = DeletionStanding(path, deletion),
    )

    @Test
    fun `delete_account_is_the_last_row_quiet_with_the_members_footnote`() {
        var taps = 0
        render(deleting(AccountDeletionPath.BY_LINK), actions = SettingsActions(onDeleteAccount = { taps++ }))
        node("settings.ending.delete").performScrollTo().assertHasClickAction()
        node("settings.ending.delete.label").assertTextEquals("Delete account")
        node("settings.ending.delete.chevron").assertExists()
        node("settings.ending.delete.status").assertDoesNotExist()
        node("settings.ending.footnote").assertTextEquals(
            "Nothing is deleted here. The next screen says what goes and what stays, " +
                "and the deletion is confirmed by a link we email you.",
        )
        node("settings.ending.delete").performClick()
        assertThat(taps).isEqualTo(1)
        node("settings.deletionBand").assertDoesNotExist()
    }

    @Test
    fun `the_immediate_paths_footnote_drops_the_mailed_link`() {
        render(deleting(AccountDeletionPath.IMMEDIATE))
        node("settings.ending.footnote").performScrollTo()
            .assertTextEquals("Nothing is deleted here. The next screen says what goes and what stays.")
    }

    @Test
    fun `the_footnote_keys_on_the_path_never_the_account_state`() {
        // An applicant whose registration landed reads BY_LINK: the mailed
        // path, and the member's footnote with it (OS-15).
        render(deleting(AccountDeletionPath.BY_LINK).copy(account = account(state = AccountState.APPLICANT)))
        node("settings.ending.footnote").performScrollTo().assertTextEquals(
            "Nothing is deleted here. The next screen says what goes and what stays, " +
                "and the deletion is confirmed by a link we email you.",
        )
    }

    @Test
    fun `no_footnote_stands_before_the_path_is_read`() {
        render()
        node("settings.ending.delete").performScrollTo()
        node("settings.ending.footnote").assertDoesNotExist()
    }

    @Test
    fun `a_locked_path_wears_the_disabled_look_and_still_answers_the_tap`() {
        var taps = 0
        render(deleting(AccountDeletionPath.LOCKED), actions = SettingsActions(onDeleteAccount = { taps++ }))
        node("settings.ending.delete").performScrollTo().assertHasClickAction().performClick()
        assertThat(taps).isEqualTo(1)
        node("settings.ending.delete.label").assertTextEquals("Delete account")
    }

    @Test
    fun `in_the_grace_the_band_stands_the_row_counts_down_and_the_footnote_goes`() {
        var cancels = 0
        render(
            deleting(
                AccountDeletionPath.BY_LINK,
                AccountDeletion(NOW.plusSeconds(6 * 86_400), includesContent = false),
            ),
            actions = SettingsActions(onCancelDeletion = { cancels++ }),
        )
        node("settings.deletionBand.line").assertTextEquals("Your account is deleted in 6 days.")
        node("settings.ending.delete").performScrollTo()
        node("settings.ending.delete.status").assertTextEquals("Deletion in 6 days")
        node("settings.ending.footnote").assertDoesNotExist()
        node("settings.deletionBand.cancel").performClick()
        assertThat(cancels).isEqualTo(1)
    }

    @Test
    fun `a_subpages_notice_outlives_its_own_consumption`() {
        // Consuming the notice flips it to null; the snackbar must still stand.
        val said = "Canceled — your account stays, and nothing was deleted."
        // The clock is driven by hand: half a second is many frames past the
        // consumption, and well inside the snackbar's own duration.
        compose.mainClock.autoAdvance = false
        compose.setContent {
            var notice by remember { mutableStateOf<String?>(said) }
            SettingsScreen(
                state = SettingsUiState(account = account(), actorKeyHere = true, now = NOW),
                versionName = "0.1.0",
                actions = SettingsActions(),
                doors = SettingsDoors(),
                notice = notice,
                onNoticeShown = { notice = null },
            )
        }
        compose.mainClock.advanceTimeBy(500)
        compose.onNode(hasText(said)).assertExists()
    }

    @Test
    fun `the_row_opens_the_door_the_page_is_told`() {
        var opened: DeletionDoor? = null
        val events = MutableSharedFlow<SettingsEvent>(extraBufferCapacity = 1)
        render(doors = SettingsDoors(onOpenDeletion = { opened = it }), events = events)
        compose.waitForIdle()
        events.tryEmit(SettingsEvent.OpenDeletion(DeletionDoor.PENDING))
        compose.waitForIdle()
        assertThat(opened).isEqualTo(DeletionDoor.PENDING)
    }

    @Test
    fun `header_stays_pinned_while_scrolling`() {
        render()
        val before = top("settings.header")
        node("settings.leaving.leave").performScrollTo()
        assertThat(top("settings.header")).isEqualTo(before)
        node("settings.header.title").assertTextEquals("Settings")
    }

    @Test
    fun `back_returns_to_the_own_profile`() {
        var back = 0
        render(doors = SettingsDoors(onBack = { back++ }))
        node("settings.header.back").performClick()
        assertThat(back).isEqualTo(1)
    }

    @Test
    fun theThemePickerSelectsTheDevicesChoice() {
        var picked: com.cogra.domain.store.ThemeChoice? = null
        render(actions = SettingsActions(onTheme = { picked = it }))
        node("settings.theme.picker.autoOption").assertIsSelected()
        node("settings.theme.picker.darkOption").performClick()
        assertThat(picked).isEqualTo(com.cogra.domain.store.ThemeChoice.DARK)
    }

    @Test
    fun theOpinionRowsAreOneChoiceWithTheHeldLines() {
        var picked: StanceInputMode? = null
        render(actions = SettingsActions(onStanceInputMode = { picked = it }))
        node("settings.stance.label").assertTextEquals("Giving an opinion")
        node("settings.stance.pad").assertIsSelected()
        // HELD (stance-pad packet): the shipped, true lines stand.
        node("settings.stance.pad.status").assertTextEquals("Press and hold, then drift to where you stand.")
        node("settings.stance.sliders.status").assertTextEquals("One slider per side of the opinion.")
        node("settings.stance.typed").performScrollTo().performClick()
        assertThat(picked).isEqualTo(StanceInputMode.ENTRY)
    }

    @Test
    fun theSwitchRowsAreTheirOwnSwitches() {
        var flips = 0
        render(actions = SettingsActions(onConfirmMultiActionSubmits = { flips++ }))
        node("settings.writing.confirm").performScrollTo().assertIsOn().performClick()
        assertThat(flips).isEqualTo(1)
        node("settings.reading.exact").performScrollTo().assertIsOff()
        node("settings.leaving.forget").performScrollTo().assertIsOff()
    }

    @Test
    fun theDefaultLicenseRowReadsTheLicenseBlocksWords() {
        render(
            SettingsUiState(
                account = account(defaultLicense = LicenseChoice(1.0, 0.0)),
                now = NOW,
            ),
        )
        node("settings.writing.license.value").assertTextEquals("Credit always · Not logged")
    }

    @Test
    fun theFailedSaveRowCarriesRetry() {
        var retried = 0
        render(
            SettingsUiState(account = account(), now = NOW, licenseFailed = LicenseChoice(1.0, 1.0)),
            actions = SettingsActions(onRetryLicense = { retried++ }),
        )
        node("settings.writing.license.status").assertTextEquals("That didn't go through.")
        // Reverted: the row reads the default it had.
        node("settings.writing.license.value").assertTextEquals("Public domain")
        node("settings_license_retry").performScrollTo().performClick()
        assertThat(retried).isEqualTo(1)
    }

    @Test
    fun `hidden_row_is_inert_and_reads_none_when_nobody_is_hidden`() {
        render()
        node("settings.people.hidden.value").assertTextEquals("None")
        node("settings.people.hidden").assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
    }

    @Test
    fun theReadingRowReadsPosts() {
        render()
        node("settings.reading.feed.value").assertTextEquals("Posts")
    }

    @Test
    fun theRecoveryRowReadsTheDateItWasMade() {
        render()
        node("settings.backup.recovery.status").assertTextEquals("Last created 12.08.2026")
        node("settings.backup.footnote")
            .assertTextContains("Your recovery code is the only way back.", substring = true)
    }

    @Test
    fun noBackupReadsNotMadeYetAndTheFootnoteSaysSo() {
        render(SettingsUiState(account = account(keyBackupCreatedAt = null), now = NOW))
        node("settings.backup.recovery.status").assertTextEquals("Not made yet")
        node("settings.backup.footnote").assertTextEquals(
            "Your key signs everything you publish and lives only in this app. " +
                "Until you make a recovery code, it can't be brought back.",
        )
    }

    @Test
    fun anApplicantBeforeTheCeremonyIsSentToTheCeremony() {
        var ceremony = 0
        render(
            SettingsUiState(account = account(state = AccountState.APPLICANT, actorPubkey = null), now = NOW),
            doors = SettingsDoors(onOpenKeyCeremony = { ceremony++ }),
        )
        node("settings.backup.recovery.status").assertTextEquals("Not made yet")
        node("settings.backup.key.status").assertTextEquals("Not made yet")
        node("settings.backup.key").performScrollTo().performClick()
        node("settings.backup.recovery").performScrollTo().performClick()
        assertThat(ceremony).isEqualTo(2)
    }

    @Test
    fun `current_session_reads_this_phone`() {
        render()
        // This device first, keyed 1.
        sessionPart(1, "label").assertTextEquals("Pixel 6")
        sessionPart(1, "status").assertTextEquals("This phone")
        assertThat(
            compose.onAllNodes(
                hasTestTag("settings.sessions.session.revoke") and
                    hasAnyAncestor(hasTestTag("settings.sessions.session:1")),
                useUnmergedTree = true,
            ).fetchSemanticsNodes(),
        ).isEmpty()
        sessionPart(2, "status").assertTextEquals("Last used 2d")
        sessionPart(3, "label").assertTextEquals("Unnamed device")
        // Past thirty days the age is the date.
        sessionPart(3, "status").assertTextEquals("Last used 08.08.2026")
    }

    @Test
    fun `revoke_reads_revoking_after_200ms_and_never_spins`() {
        compose.mainClock.autoAdvance = false
        render(SettingsUiState(account = account(), now = NOW, revokingSessionId = "s2"))
        compose.mainClock.advanceTimeByFrame()
        sessionPart(2, "revoke").assertTextEquals("Revoke")
        compose.mainClock.advanceTimeBy(150)
        sessionPart(2, "revoke").assertTextEquals("Revoke")
        compose.mainClock.advanceTimeBy(100)
        sessionPart(2, "revoke").assertTextEquals("Revoking…")
        // No progress indicator anywhere on the page.
        assertThat(
            compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
                .fetchSemanticsNodes(),
        ).isEmpty()
    }

    @Test
    fun revokeAsksTheViewModelForThatSession() {
        var revoked: String? = null
        render(actions = SettingsActions(onRevokeSession = { revoked = it }))
        sessionPart(3, "revoke").performScrollTo().performClick()
        assertThat(revoked).isEqualTo("s3")
    }

    @Test
    fun theRevokeEventMovesFocusToTheNamedRow() {
        val events = MutableSharedFlow<SettingsEvent>(extraBufferCapacity = 1)
        render(events = events)
        compose.waitForIdle()
        events.tryEmit(SettingsEvent.FocusSession("s3"))
        compose.waitForIdle()
        compose.onNodeWithTag("settings.sessions.session:3", useUnmergedTree = true).assertIsFocused()
    }

    @Test
    fun `password_row_reads_changed_and_its_age`() {
        render()
        node("settings.credentials.password.status").assertTextEquals("Changed 21d")
        node("settings.credentials.handle.value").assertTextEquals("@sol")
    }

    @Test
    fun `email_row_reads_change_pending_while_a_side_is_owed`() {
        render(SettingsUiState(account = account(pendingEmailChange = pending()), now = NOW))
        node("settings.credentials.email.status").assertTextEquals("Change pending")
    }

    @Test
    fun `email_row_never_reads_the_new_address_while_pending`() {
        var door: EmailDoor? = null
        render(
            SettingsUiState(account = account(pendingEmailChange = pending()), now = NOW),
            doors = SettingsDoors(onOpenEmail = { door = it }),
        )
        node("settings.credentials.email.value").assertTextEquals("sol@solferreira.art")
        node("settings.credentials.email").performScrollTo().performClick()
        assertThat(door).isEqualTo(EmailDoor.CONFIRM)
    }

    @Test
    fun noChangeInFlightReadsTheAddressAlone() {
        render()
        assertThat(
            compose.onAllNodesWithTag("settings.credentials.email.status", useUnmergedTree = true)
                .fetchSemanticsNodes(),
        ).isEmpty()
    }

    @Test
    fun theAboutGroupReadsTheRunningVersion() {
        var about = 0
        render(doors = SettingsDoors(onOpenAbout = { about++ }))
        node("settings.about.whatsNew.value").assertTextEquals("0.1.0")
        node("settings.about.aboutCogra").performScrollTo().performClick()
        assertThat(about).isEqualTo(1)
    }

    @Test
    fun `contact_opens_mail_not_the_report`() {
        var contact = 0
        render(doors = SettingsDoors(onContact = { contact++ }))
        node("settings.about.contact.value").assertTextEquals("hello@cogra.local")
        node("settings.about.contact").performScrollTo().performClick()
        assertThat(contact).isEqualTo(1)
    }

    @Test
    fun theForgetSwitchSaysWhatItClearsInThisApp() {
        render()
        node("settings.leaving.forget.status").assertTextEquals(
            "Your key, your draft, any kept picks and what you've seen are cleared from this app when you sign out.",
        )
    }

    @Test
    fun `sign_out_reads_signing_out_after_200ms`() {
        compose.mainClock.autoAdvance = false
        render(SettingsUiState(account = account(), now = NOW, signingOut = true))
        compose.mainClock.advanceTimeByFrame()
        node("settings.leaving.leave.label").assertTextEquals("Sign out")
        compose.mainClock.advanceTimeBy(250)
        node("settings.leaving.leave.label").assertTextEquals("Signing out…")
    }

    @Test
    fun theSignOutRowAsks() {
        var signOut = 0
        render(actions = SettingsActions(onSignOut = { signOut++ }))
        node("settings.leaving.leave").performScrollTo().assertHasClickAction().performClick()
        assertThat(signOut).isEqualTo(1)
    }

    // -------------------------------------------------------- SignOutConfirm

    @Test
    fun `dialog_names_key_draft_and_kept_picks`() {
        render(SettingsUiState(account = account(keyBackupCreatedAt = null), now = NOW, signOutConfirmOpen = true))
        node("settings.dialog.title").assertTextEquals("Sign out without a backup?")
        node("settings.dialog.body").assertTextEquals(
            "This app holds the only copy of your key. Signing out leaves your key, your draft and any opinions " +
                "you kept pending here, locked until you sign in again. Erase them instead, and no " +
                "one — including CoGra — can bring them back.",
        )
        node("settings.dialog.title").assertIsFocused()
        // HELD: the lock is the custody packet's slice S.
        assertThat(compose.onAllNodesWithTag("settings.dialog.lock").fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun theDialogsAnswersReachTheirActs() {
        var recovery = 0
        var erase = 0
        render(
            SettingsUiState(account = account(keyBackupCreatedAt = null), now = NOW, signOutConfirmOpen = true),
            actions = SettingsActions(onMakeRecoveryCode = { recovery++ }, onEraseAndSignOut = { erase++ }),
        )
        node("settings.dialog.recovery").performClick()
        node("settings.dialog.erase").performClick()
        assertThat(recovery).isEqualTo(1)
        assertThat(erase).isEqualTo(1)
    }

    // ------------------------------------------------- clearing data (B6)

    @Test
    fun `the_clearing_footnote_opens_on_the_key_with_a_code_made`() {
        render()
        node("settings.clearing.footnote").performScrollTo().assertTextEquals(
            "Your key lives only in this app. Clear the app's data, or uninstall it without keeping the data, " +
                "and the key is erased with it — without your recovery code, your account is gone for good. " +
                "Your draft, any kept picks and the choices kept on this device go too, and you're signed out. " +
                "What you've seen comes back when you sign in.",
        )
        node("settings.clearing.label").assertTextEquals("Clearing data")
        node("settings.clearing.erase.label").assertTextEquals("Erase everything from this app")
    }

    @Test
    fun `the_clearing_footnote_drops_its_condition_with_no_code`() {
        render(SettingsUiState(account = account(keyBackupCreatedAt = null), now = NOW))
        node("settings.clearing.footnote").performScrollTo().assertTextEquals(
            "Your key lives only in this app, and it has no recovery code yet. Clear the app's data, or " +
                "uninstall it without keeping the data, and the key is erased with it — your account is gone " +
                "for good. Your draft, any kept picks and the choices kept on this device go too, and you're " +
                "signed out. What you've seen comes back when you sign in.",
        )
    }

    @Test
    fun `the_erase_row_raises_the_dialog_and_nothing_else`() {
        var asked = 0
        render(actions = SettingsActions(onErase = { asked++ }))
        node("settings.clearing.erase").performScrollTo().performClick()
        assertThat(asked).isEqualTo(1)
    }

    @Test
    fun `with_no_code_the_erase_dialog_leads_with_the_code`() {
        var recovery = 0
        var erase = 0
        render(
            SettingsUiState(account = account(keyBackupCreatedAt = null), now = NOW, eraseConfirmOpen = true),
            actions = SettingsActions(
                onMakeRecoveryCodeFromErase = { recovery++ },
                onEraseEverything = { erase++ },
            ),
        )
        node("settings.dialog.title").assertTextEquals("Erase everything from this app?")
        node("settings.dialog.title").assertIsFocused()
        node("settings.dialog.body").assertTextEquals(
            "This app holds the only copy of your key, and it has no recovery code. Erase everything and your " +
                "account is gone for good — no one, including CoGra, can bring it back. Your draft, any kept " +
                "picks and the choices kept on this device go too, and you're signed out.",
        )
        assertThat(compose.onAllNodesWithTag("settings.dialog.cancel:none").fetchSemanticsNodes()).isEmpty()
        compose.onNodeWithTag("settings.dialog.recovery:none").assertTextEquals("Make a recovery code").performClick()
        compose.onNodeWithTag("settings.dialog.erase:none").assertTextEquals("Erase everything and sign out")
            .performClick()
        assertThat(recovery).isEqualTo(1)
        assertThat(erase).isEqualTo(1)
    }

    @Test
    fun `with_a_code_made_the_erase_is_quiet_and_cancel_is_filled`() {
        var erase = 0
        var cancel = 0
        render(
            SettingsUiState(account = account(), now = NOW, eraseConfirmOpen = true),
            actions = SettingsActions(onEraseEverything = { erase++ }, onDismissEraseConfirm = { cancel++ }),
        )
        node("settings.dialog.body").assertTextEquals(
            "Your key is erased with everything else, and only your recovery code can bring it back — without " +
                "the code, your account is gone for good. Your draft, any kept picks and the choices kept on " +
                "this device go too, and you're signed out. What you've seen comes back when you sign in.",
        )
        assertThat(compose.onAllNodesWithTag("settings.dialog.recovery:made").fetchSemanticsNodes()).isEmpty()
        compose.onNodeWithTag("settings.dialog.cancel:made").assertTextEquals("Cancel").performClick()
        compose.onNodeWithTag("settings.dialog.erase:made").assertTextEquals("Erase everything and sign out")
            .performClick()
        assertThat(cancel).isEqualTo(1)
        assertThat(erase).isEqualTo(1)
    }

    // ------------------------------------------------------- SettingsLicense

    @Test
    fun `opens_with_the_current_default_focus_on_title`() {
        render(
            SettingsUiState(
                account = account(defaultLicense = LicenseChoice(0.5, 0.0)),
                now = NOW,
                licenseSheet = LicenseChoice(0.5, 0.0),
            ),
        )
        compose.onNode(
            hasTestTag("settings.licenseSheet.credit.tier:2"),
            useUnmergedTree = true,
        ).assertIsSelected()
        compose.onNode(hasTestTag("settings.licenseSheet.record.tier:1"), useUnmergedTree = true).assertIsSelected()
        node("settings.licenseSheet.title").assertIsFocused()
        node("settings.licenseSheet.foot.summary").assertTextEquals(
            "Credit commercially · Not logged — commercial uses credit you; everything else is free, " +
                "and uses go unlogged.",
        )
    }

    @Test
    fun `taps_stage_until_done`() {
        var staged: LicenseChoice? = null
        var done = 0
        render(
            SettingsUiState(account = account(), now = NOW, licenseSheet = LicenseChoice.PublicDomain),
            actions = SettingsActions(onStageLicense = { staged = it }, onLicenseDone = { done++ }),
        )
        compose.onNode(hasTestTag("settings.licenseSheet.record.tier:3"), useUnmergedTree = true)
            .performSemanticsAction(SemanticsActions.OnClick)
        assertThat(staged).isEqualTo(LicenseChoice(0.0, 1.0))
        assertThat(done).isEqualTo(0)
        compose.onNodeWithTag("settings.licenseSheet.foot.done").performSemanticsAction(SemanticsActions.OnClick)
        assertThat(done).isEqualTo(1)
    }

    @Test
    fun theSheetsQuestionMarkIsNamedLicense() {
        render(SettingsUiState(account = account(), now = NOW, licenseSheet = LicenseChoice.PublicDomain))
        val help = node("settings.licenseSheet.title.help").fetchSemanticsNode()
        assertThat(help.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.OnClick)?.label)
            .isEqualTo("License")
    }
}
