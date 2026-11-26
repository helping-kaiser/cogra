package com.cogra.feature.profile.avatar

import com.cogra.feature.profile.SealGate
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The profile-picture flow's own rules.
 *
 * The flow exists because **every profile change is a signed act**
 * (design/readme.md §13), so the interesting questions are all about what
 * may be signed and when (AvatarSeal.md:13-25).
 */
class AvatarFlowStateTest {

    private val picked = AvatarFlowState(uri = "content://a")
    private val sealed = picked.advanced()!!

    @Test
    fun theCropIsTheFirstStageAndBackLeavesFromIt() {
        // The arrow steps a stage; only the first has nowhere to step to,
        // which is what makes it the one place back leaves.
        assertThat(picked.step).isEqualTo(AvatarStep.Crop)
        assertThat(picked.retreated()).isNull()
    }

    @Test
    fun theSealStepsBackToTheCrop() {
        assertThat(sealed.step).isEqualTo(AvatarStep.Seal)
        assertThat(sealed.retreated()?.step).isEqualTo(AvatarStep.Crop)
    }

    @Test
    fun thereIsNothingToFrameUntilAPictureIsPicked() {
        assertThat(AvatarFlowState().advanced()).isNull()
    }

    /** The gate's three readings, and none once the picture is up. */
    @Test
    fun theGateReadsWhereTheUploadStands() {
        assertThat(sealed.copy(upload = AvatarUpload.Running).gate).isEqualTo(SealGate.Uploading)
        assertThat(sealed.copy(upload = AvatarUpload.Failed("down")).gate).isEqualTo(SealGate.Failed)
        assertThat(sealed.copy(upload = AvatarUpload.Refused("too big")).gate).isEqualTo(SealGate.Refused)
        assertThat(sealed.copy(upload = AvatarUpload.Done("m1")).gate).isNull()
    }

    /** A press while the upload runs is taken (:13); a failed or refused one takes none (:15, :17). */
    @Test
    fun theCommitTakesAPressUnlessTheUploadFailedOrWasRefused() {
        assertThat(sealed.copy(upload = AvatarUpload.Running).canSign).isTrue()
        assertThat(sealed.copy(upload = AvatarUpload.Done("m1")).canSign).isTrue()
        assertThat(sealed.copy(upload = AvatarUpload.Failed("down")).canSign).isFalse()
        assertThat(sealed.copy(upload = AvatarUpload.Refused("too big")).canSign).isFalse()
    }

    /** Refuses a second press until the signing answers (:25). */
    @Test
    fun aSigningSealTakesNoSecondPress() {
        assertThat(sealed.copy(upload = AvatarUpload.Done("m1"), signing = true).canSign).isFalse()
    }

    @Test
    fun theCropStageTakesNoPress() {
        assertThat(picked.copy(upload = AvatarUpload.Done("m1")).canSign).isFalse()
    }
}
