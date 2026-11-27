package com.cogra.feature.profile

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.cogra.domain.Outcome
import com.cogra.domain.signing.SentProfile
import com.cogra.domain.testing.TEST_PROFILE_ID
import com.cogra.domain.testing.faithfulProfileUpdate
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * "A refusal the signer on the device makes itself, no server answer at all,
 * reads as an answered refusal: `That didn't go through. Try again.`"
 * (design/guidelines/copy-voice.md:1611-1613). The bug notice is for a refusal
 * nobody can name; this one the device names. Driven end to end: the device
 * refuses bytes that are not what the form sent, and the seal reads the line.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ProfileDeviceRefusalTest : ProfileEditHarness() {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theSealReadsTheDevicesRefusalAsNotThroughAndSignsNothing() = runTest(dispatcher) {
        // The prepare hands back another name than the form sent: the device refuses it.
        profiles.prepareOutcome = Outcome.Success(
            sealer.stageFaithful(faithfulProfileUpdate(TEST_PROFILE_ID, SentProfile("Mallory", "Old bio", null))),
        )
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange("Noa")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        val answered = vm.state.value
        assertThat(answered.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(signedProfile.laid.value).isNull()

        compose.setContent {
            ProfileEditSealStage(
                state = answered,
                actions = ProfileSealActions(onSign = {}, onBack = {}, onLeave = {}, onNotNow = {}),
            )
        }
        compose.onNodeWithText("That didn't go through. Try again.").assertExists()
        compose.onNodeWithText("This shouldn't have happened").assertDoesNotExist()
    }
}
