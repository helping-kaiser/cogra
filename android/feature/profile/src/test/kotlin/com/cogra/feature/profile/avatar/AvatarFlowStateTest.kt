package com.cogra.feature.profile.avatar

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The profile-picture flow's own rules.
 *
 * The flow exists because **every profile change is a signed act**
 * (design/readme.md §13), so the interesting questions are all about what
 * may be signed and when.
 */
class AvatarFlowStateTest {

    private val picked = AvatarFlowState(uri = "content://a")

    @Test
    fun theCropIsTheFirstStageAndBackLeavesFromIt() {
        // The arrow steps a stage; only the first has nowhere to step to,
        // which is what makes it the one place back leaves.
        assertThat(picked.step).isEqualTo(AvatarStep.Crop)
        assertThat(picked.retreated()).isNull()
    }

    @Test
    fun theSealStepsBackToTheCrop() {
        val sealed = picked.advanced()!!

        assertThat(sealed.step).isEqualTo(AvatarStep.Seal)
        assertThat(sealed.retreated()?.step).isEqualTo(AvatarStep.Crop)
    }

    @Test
    fun thereIsNothingToFrameUntilAPictureIsPicked() {
        assertThat(AvatarFlowState().advanced()).isNull()
    }

    @Test
    fun aProfileUpdateIsOneActAndSaysSoInTheSingular() {
        // One act means the all-or-nothing subline is omitted: there is
        // nothing for "they land together" to be true of.
        assertThat(picked.signedActionCount).isEqualTo(1)
    }

    @Test
    fun nothingSignsUntilThePictureHasAnId() {
        val sealed = picked.advanced()!!
        assertThat(sealed.canSign).isFalse()

        assertThat(sealed.copy(upload = AvatarUpload.Running).canSign).isFalse()
        assertThat(sealed.copy(upload = AvatarUpload.Done("m1")).canSign).isTrue()
    }

    @Test
    fun aDeviceWithNoKeyCannotSign() {
        val ready = picked.advanced()!!.copy(upload = AvatarUpload.Done("m1"))

        assertThat(ready.copy(keyAbsent = true).canSign).isFalse()
        assertThat(ready.copy(submitting = true).canSign).isFalse()
    }

    @Test
    fun aFailedUploadSaysWhatWentWrongInTheServersOwnWords() {
        val failed = picked.copy(upload = AvatarUpload.Failed("That file is too big."))

        assertThat(failed.problem).isEqualTo("That file is too big.")
    }

    @Test
    fun anOrdinaryFlowHasNothingToComplainAbout() {
        assertThat(picked.problem).isNull()
    }
}
