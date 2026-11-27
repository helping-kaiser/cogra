package com.cogra.feature.profile

import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.v2.atom.ACTS_SLOW_LINE
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The drawn seal, state by state (ProfileEditSeal.jsx, ProfileEditSeal.md):
 * the board's words character for character and its registered nodes
 * (nodes.json `profileEditSeal`).
 */
@RunWith(RobolectricTestRunner::class)
class ProfileEditSealScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var signs = 0
    private var backs = 0
    private var leaves = 0
    private var notNows = 0

    private val atRest = ProfileEditUiState(
        loading = false,
        displayName = "Sol Ferreira",
        bio = "New bio",
        websiteUrl = "https://sol.example",
        staged = setOf(ProfileField.Bio, ProfileField.Website),
        stage = ProfileEditStage.Seal,
    )

    private fun render(state: ProfileEditUiState) {
        compose.setContent {
            ProfileEditSealStage(
                state = state,
                actions = ProfileSealActions(
                    onSign = { signs += 1 },
                    onBack = { backs += 1 },
                    onLeave = { leaves += 1 },
                    onNotNow = { notNows += 1 },
                ),
            )
        }
    }

    @Test
    fun theSealAtRestReadsTheBoard() {
        render(atRest)
        compose.onNodeWithTag("profileEditSeal.header").assertExists()
        compose.onNodeWithText("What you sign").assertExists()
        compose.onNodeWithTag("profileEditSeal.header.leave").assertContentDescriptionEquals("Leave")
        compose.onNodeWithTag("profileEditSeal.header.help").assertContentDescriptionEquals("Changing your profile")
        compose.onNodeWithText("Your profile").assertExists()
        compose.onNodeWithTag("profileEditSeal.acts.actRow.label").assertTextEquals("Profile")
        compose.onNodeWithText("A new bio and website").assertExists()
        compose.onNodeWithTag("profileEditSeal.acts.actRow.count")
            .assertContentDescriptionEquals("1 profile change")
        compose.onNodeWithTag("profileEditSeal.acts.total").assertTextEquals("1 thing, signed")
        // No all-or-nothing line on one act (:17).
        compose.onNodeWithTag("profileEditSeal.acts.note").assertDoesNotExist()
        compose.onNodeWithTag("profileEditSeal.note").assertTextEquals(
            "Every change to your profile is signed in your name and stays in your public record.",
        )
        compose.onNodeWithTag("profileEditSeal.foot:rest").assertExists()
        compose.onNodeWithTag("profileEditSeal.foot.sign").assert(hasText("Sign the change")).assertIsEnabled()
        compose.onNodeWithTag("profileEditSeal.foot.back").assert(hasText("Back"))
    }

    @Test
    fun theCommitSignsAndBackStepsBack() {
        render(atRest)
        compose.onNodeWithTag("profileEditSeal.foot.sign").performClick()
        compose.onNodeWithTag("profileEditSeal.foot.back").performClick()
        compose.onNodeWithTag("profileEditSeal.header.leave").performClick()
        assertThat(signs).isEqualTo(1)
        assertThat(backs).isEqualTo(1)
        assertThat(leaves).isEqualTo(1)
    }

    @Test
    fun fromThePressBackReadsCloseAndTheCommitIsInertNeverDimmed() {
        compose.mainClock.autoAdvance = false
        render(atRest.copy(signing = true))
        compose.mainClock.advanceTimeByFrame()
        compose.onNodeWithTag("profileEditSeal.foot:signing").assertExists()
        compose.onNodeWithTag("profileEditSeal.foot.back").assert(hasText("Close"))
        compose.onNodeWithTag("profileEditSeal.header.leave").assertContentDescriptionEquals("Close")
        compose.onNodeWithTag("profileEditSeal.header.back").assertContentDescriptionEquals("Close")
        // Within 200ms the commit keeps its words (:37).
        compose.onNodeWithTag("profileEditSeal.foot.sign").assert(hasText("Sign the change")).assertIsEnabled()
        compose.onNodeWithTag("profileEditSeal.foot.sign").performClick()
        assertThat(signs).isEqualTo(0)

        compose.mainClock.advanceTimeBy(PAST_PARTICIPLE)
        compose.onNodeWithTag("profileEditSeal.foot.sign").assert(hasText("Signing the change…"))
        compose.onNodeWithText(ACTS_SLOW_LINE).assertDoesNotExist()

        compose.mainClock.advanceTimeBy(PAST_SLOW)
        compose.onNodeWithText("Still signing — the network is slow right now.").assertExists()
    }

    @Test
    fun noAnswerIsTheFaultLineWithRetryAndBack() {
        render(atRest.copy(fault = ProfileSealFault.Offline))
        compose.onNodeWithTag("profile_edit_seal_offline").assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("profile_edit_seal_retry").assert(hasText("Retry")).performClick()
        compose.onNodeWithTag("profile_edit_seal_back").assert(hasText("Back")).performClick()
        compose.onNodeWithTag("profileEditSeal.foot.sign").assertDoesNotExist()
        // Everything above the foot stays as it was (:47).
        compose.onNodeWithTag("profileEditSeal.acts.total").assertTextEquals("1 thing, signed")
        assertThat(signs).isEqualTo(1)
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun theWriteRuleIsItsNoticeWithNotNowAndNoRetry() {
        render(atRest.copy(fault = ProfileSealFault.WriteRule))
        compose.onNodeWithText("You can't sign right now").assertExists()
        compose.onNodeWithText(
            "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent.",
        ).assertExists()
        compose.onNodeWithTag("profile_edit_seal_write_rule_help").assertExists()
        compose.onNodeWithTag("profile_edit_seal_retry").assertDoesNotExist()
        compose.onNodeWithTag("profile_edit_seal_not_now").assert(hasText("Not now")).performClick()
        assertThat(notNows).isEqualTo(1)
    }

    @Test
    fun theWriteRulesQuestionMarkOpensWhySigningWaits() {
        render(atRest.copy(fault = ProfileSealFault.WriteRule))
        compose.onNodeWithTag("profile_edit_seal_write_rule_help").performClick()
        compose.onNodeWithText("Nothing was signed or spent. Try again in a little while.").assertExists()
    }

    @Test
    fun theHeadersQuestionMarkOpensChangingYourProfile() {
        render(atRest)
        compose.onNodeWithTag("profileEditSeal.header.help").performClick()
        compose.onNodeWithTag("profile_edit_seal_help_dialog").assertExists()
        compose.onNodeWithText(
            "Your profile is a public record, and changes to it are signed actions in your name.",
        ).assertExists()
    }

    @Test
    fun theBugIsItsNoticeWithTryAgainReportAndNotNow() {
        render(atRest.copy(fault = ProfileSealFault.Bug))
        compose.onNodeWithText("This shouldn't have happened").assertExists()
        compose.onNodeWithTag("profile_edit_seal_try_again").assert(hasText("Try again")).performClick()
        compose.onNodeWithTag("profile_edit_seal_report").assert(hasText("Report a problem"))
        compose.onNodeWithTag("profile_edit_seal_not_now").performScrollTo().performClick()
        assertThat(signs).isEqualTo(1)
        assertThat(notNows).isEqualTo(1)
    }

    @Test
    fun aRemovedPictureReadsTheRemovalAndTheMonogram() {
        render(atRest.copy(bio = "", websiteUrl = "", staged = emptySet(), avatar = ProfileImageState.Cleared))
        compose.onNodeWithText("The picture removed").assertExists()
        compose.onNodeWithTag("profile_edit_seal_picture").assertExists()
    }

    @Test
    fun withoutTheKeyTheNoticeRestoresOrStepsBackAndNeverKeepsADraft() {
        var restores = 0
        compose.setContent {
            ProfileEditSealStage(
                state = atRest.copy(fault = ProfileSealFault.KeyAbsent),
                actions = ProfileSealActions(
                    onSign = { signs += 1 },
                    onBack = { backs += 1 },
                    onLeave = { leaves += 1 },
                    onNotNow = { notNows += 1 },
                    onRestoreKey = { restores += 1 },
                ),
            )
        }
        compose.onNodeWithText("Your key isn't in this app").assertExists()
        compose.onNodeWithTag("profileEditSeal.foot.sign").assertDoesNotExist()
        compose.onNodeWithText("Keep the draft, restore later").assertDoesNotExist()
        compose.onNodeWithTag("profile_edit_seal_restore").assert(hasText("Restore the key"))
            .performScrollTo().performClick()
        compose.onNodeWithTag("profile_edit_seal_not_now").assert(hasText("Not now"))
            .performScrollTo().performClick()
        assertThat(restores).isEqualTo(1)
        assertThat(notNows).isEqualTo(1)
        assertThat(signs).isEqualTo(0)

        compose.onNodeWithTag("profile_edit_seal_key_help").performClick()
        compose.onNodeWithTag("profile_edit_seal_key_dialog").assertExists()
    }

    // -- The line under the profile's head (Profile.md:99-101) --

    @Test
    fun theHeadReadsSigningOnceTwoHundredMillisecondsPass() {
        compose.mainClock.autoAdvance = false
        compose.setContent { ProfileChangeHeadLine(ProfileChangeLine.Signing) }
        compose.mainClock.advanceTimeByFrame()
        compose.onNodeWithTag(PROFILE_CHANGE_LINE).assertDoesNotExist()
        compose.mainClock.advanceTimeBy(PAST_PARTICIPLE)
        compose.onNodeWithTag(PROFILE_CHANGE_LINE).assertTextEquals("Signing…")
    }

    @Test
    fun theHeadReadsThatDidntSignWithRetry() {
        var retries = 0
        compose.setContent { ProfileChangeHeadLine(ProfileChangeLine.Failed { retries += 1 }) }
        compose.onNodeWithText("That didn't sign.").assertExists()
        compose.onNodeWithTag("${PROFILE_CHANGE_LINE}_retry").performClick()
        assertThat(retries).isEqualTo(1)
    }

    @Test
    fun nothingStandsUnderTheHeadOtherwise() {
        compose.setContent { ProfileChangeHeadLine(null) }
        compose.onNodeWithTag(PROFILE_CHANGE_LINE).assertDoesNotExist()
    }

    private companion object {
        const val PAST_PARTICIPLE = 250L
        const val PAST_SLOW = 5_000L
    }
}
