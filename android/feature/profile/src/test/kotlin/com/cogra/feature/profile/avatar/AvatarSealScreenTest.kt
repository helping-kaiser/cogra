package com.cogra.feature.profile.avatar

import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.feature.profile.ProfileSealFault
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The picture's seal, state by state (AvatarSeal.jsx, AvatarSeal.md): the
 * board's words character for character and its registered nodes (nodes.json
 * `avatarSeal`).
 */
@RunWith(RobolectricTestRunner::class)
class AvatarSealScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var signs = 0
    private var backs = 0
    private var leaves = 0
    private var retries = 0
    private var notNows = 0
    private var restores = 0

    private val atRest = AvatarFlowState(
        step = AvatarStep.Seal,
        uri = "content://pick/1",
        upload = AvatarUpload.Done("m1"),
    )

    private fun render(state: AvatarFlowState) {
        compose.setContent {
            AvatarFlowScreen(
                state = state,
                onNext = {},
                onBack = { backs += 1 },
                onLeave = { leaves += 1 },
                onCropCommitted = {},
                onSign = { signs += 1 },
                onRetryUpload = { retries += 1 },
                onNotNow = { notNows += 1 },
                onRestoreKey = { restores += 1 },
            )
        }
    }

    @Test
    fun theSealAtRestReadsTheBoard() {
        render(atRest)
        compose.onNodeWithTag("avatarSeal.header").assertExists()
        compose.onNodeWithText("What you sign").assertExists()
        compose.onNodeWithTag("avatarSeal.header.leave").assertContentDescriptionEquals("Leave")
        compose.onNodeWithText("Your profile picture").assertExists()
        compose.onNodeWithTag("avatarSeal.acts.actRow.label").assertTextEquals("Picture")
        compose.onNodeWithText("A new profile picture").assertExists()
        compose.onNodeWithTag("avatarSeal.acts.actRow.count").assertContentDescriptionEquals("1 picture")
        compose.onNodeWithTag("avatarSeal.acts.total").assertTextEquals("1 thing, signed")
        compose.onNodeWithTag("avatarSeal.acts.note").assertDoesNotExist()
        compose.onNodeWithTag("avatarSeal.note").assertTextEquals(
            "Every change to your profile is signed in your name and stays in your public record.",
        )
        compose.onNodeWithTag("avatarSeal.foot:rest").assertExists()
        compose.onNodeWithTag("avatarSeal.foot.sign").assert(hasText("Sign the change")).assertIsEnabled()
        compose.onNodeWithTag("avatarSeal.foot.back").assert(hasText("Back"))
        // Neither is on the board: no stage note, no subline under the head.
        compose.onNodeWithText("Last step").assertDoesNotExist()
        compose.onNodeWithText("Shown everywhere you appear.").assertDoesNotExist()
        compose.onNodeWithText("1 signed action").assertDoesNotExist()
    }

    @Test
    fun theHeadersQuestionMarkOpensChangingYourPicture() {
        render(atRest)
        compose.onNodeWithTag("avatarSeal.header.help").performClick()
        compose.onNodeWithText(
            "The signing is paid for, like your posts. The record that you changed it stays, like every signed action.",
        ).assertExists()
    }

    @Test
    fun whileTheUploadRunsTheGateWaitsAndTheCommitStaysEnabled() {
        render(atRest.copy(upload = AvatarUpload.Running))
        compose.onNodeWithTag("avatarSeal.gate:uploading").assertExists()
        compose.onNodeWithText("Uploading 0 of 1 — signing waits for the picture.").assertExists()
        compose.onNodeWithTag("avatarSeal.foot:uploading").assertExists()
        compose.onNodeWithTag("avatarSeal.foot.sign").assertIsEnabled().performClick()
        assertThat(signs).isEqualTo(1)
    }

    @Test
    fun aFailedUploadReadsTheGatesFaultWithRetryAndDisablesTheCommit() {
        render(atRest.copy(upload = AvatarUpload.Failed("down")))
        compose.onNodeWithTag("avatarSeal.gate:upload-failed")
            .assertTextEquals("One picture didn't upload. Signing waits for it. Retry")
        compose.onNodeWithTag("avatarSeal.foot:upload-failed").assertExists()
        compose.onNodeWithTag("avatarSeal.foot.sign").assertIsNotEnabled()
        compose.onNodeWithText("Remove it").assertDoesNotExist()
    }

    @Test
    fun aRefusedUploadReadsTheFactAloneAndDisablesTheCommit() {
        render(atRest.copy(upload = AvatarUpload.Refused("too large")))
        compose.onNodeWithTag("avatarSeal.gate:upload-refused").assertTextEquals("One picture didn't upload.")
        compose.onNodeWithText("Signing waits for it.", substring = true).assertDoesNotExist()
        compose.onNodeWithText("too large").assertDoesNotExist()
        compose.onNodeWithTag("avatarSeal.foot.sign").assertIsNotEnabled()
        compose.onNodeWithTag("avatarSeal.foot.back").performScrollTo().performClick()
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun fromThePressBackReadsCloseAndTheCommitIsInertNeverDimmed() {
        compose.mainClock.autoAdvance = false
        render(atRest.copy(signing = true))
        compose.mainClock.advanceTimeByFrame()
        compose.onNodeWithTag("avatarSeal.foot:signing").assertExists()
        compose.onNodeWithTag("avatarSeal.foot.back").assert(hasText("Close"))
        compose.onNodeWithTag("avatarSeal.header.leave").assertContentDescriptionEquals("Close")
        compose.onNodeWithTag("avatarSeal.header.back").assertContentDescriptionEquals("Close")
        compose.onNodeWithTag("avatarSeal.foot.sign").assert(hasText("Sign the change")).assertIsEnabled()
        compose.onNodeWithTag("avatarSeal.foot.sign").performClick()
        assertThat(signs).isEqualTo(0)

        compose.mainClock.advanceTimeBy(PAST_PARTICIPLE)
        compose.onNodeWithTag("avatarSeal.foot.sign").assert(hasText("Signing the change…"))

        compose.mainClock.advanceTimeBy(PAST_SLOW)
        compose.onNodeWithText("Still signing — the network is slow right now.").assertExists()
    }

    @Test
    fun noAnswerIsTheFaultLineWithRetry() {
        render(atRest.copy(fault = ProfileSealFault.Offline))
        compose.onNodeWithTag("avatar_seal_offline").assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("avatar_seal_retry").performScrollTo().performClick()
        assertThat(signs).isEqualTo(1)
    }

    @Test
    fun theWriteRuleIsItsNoticeWithNotNow() {
        render(atRest.copy(fault = ProfileSealFault.WriteRule))
        compose.onNodeWithText("You can't sign right now").assertExists()
        compose.onNodeWithTag("avatar_seal_write_rule_help").assertExists()
        compose.onNodeWithTag("avatar_seal_retry").assertDoesNotExist()
        compose.onNodeWithTag("avatar_seal_not_now").performScrollTo().performClick()
        assertThat(notNows).isEqualTo(1)
    }

    @Test
    fun theBugIsItsNoticeWithTryAgainReportAndNotNow() {
        render(atRest.copy(fault = ProfileSealFault.Bug))
        compose.onNodeWithText("This shouldn't have happened").assertExists()
        compose.onNodeWithTag("avatar_seal_try_again").performScrollTo().performClick()
        compose.onNodeWithTag("avatar_seal_report").assert(hasText("Report a problem"))
        compose.onNodeWithTag("avatar_seal_not_now").performScrollTo().performClick()
        assertThat(signs).isEqualTo(1)
        assertThat(notNows).isEqualTo(1)
    }

    @Test
    fun withoutTheKeyTheNoticeRestoresOrStepsBack() {
        render(atRest.copy(fault = ProfileSealFault.KeyAbsent))
        compose.onNodeWithText("Your key isn't in this app").assertExists()
        compose.onNodeWithTag("avatarSeal.foot.sign").assertDoesNotExist()
        compose.onNodeWithText("Keep the draft, restore later").assertDoesNotExist()
        compose.onNodeWithTag("avatar_seal_restore").assert(hasText("Restore the key"))
            .performScrollTo().performClick()
        compose.onNodeWithTag("avatar_seal_not_now").performScrollTo().performClick()
        assertThat(restores).isEqualTo(1)
        assertThat(notNows).isEqualTo(1)
    }

    private companion object {
        const val PAST_PARTICIPLE = 250L
        const val PAST_SLOW = 5_000L
    }
}
