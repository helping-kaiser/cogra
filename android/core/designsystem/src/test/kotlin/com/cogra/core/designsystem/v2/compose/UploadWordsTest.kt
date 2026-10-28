package com.cogra.core.designsystem.v2.compose

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The upload notices' words, read off `UploadNotice.jsx` and copy-voice
 * (*A clip that didn't upload*; the edit's gate, `media="cover"`).
 */
class UploadWordsTest {

    @Test
    fun theGateNamesTheCoverAnEditSet() {
        assertThat(gateNoun(UploadMedia.Cover, total = 1)).isEqualTo("cover")
        assertThat(gateNoun(UploadMedia.Video, total = 1)).isEqualTo("video")
        assertThat(gateNoun(UploadMedia.Pictures, total = 1)).isEqualTo("picture")
        assertThat(gateNoun(UploadMedia.Pictures, total = 2)).isEqualTo("pictures")
    }

    @Test
    fun theFaultCountsItsPicturesFromTwoUp() {
        assertThat(failedPicturesLine(1)).isEqualTo("One picture didn't upload.")
        assertThat(failedPicturesLine(3)).isEqualTo("3 pictures didn't upload.")
        assertThat(removeFailedLabel(1)).isEqualTo("Remove it")
        assertThat(removeFailedLabel(3)).isEqualTo("Remove them")
    }

    @Test
    fun theGatesFaultReadingSaysWhatItWaitsFor() {
        assertThat(gateFaultLines(UploadMedia.Pictures, failed = 3))
            .isEqualTo("3 pictures didn't upload." to "Signing waits for them.")
        assertThat(gateFaultLines(UploadMedia.Pictures, failed = 1))
            .isEqualTo("One picture didn't upload." to "Signing waits for it.")
        // The cover being one picture, its fault keeps the one-picture line.
        assertThat(gateFaultLines(UploadMedia.Cover, failed = 1))
            .isEqualTo("One picture didn't upload." to "Signing waits for it.")
        assertThat(gateFaultLines(UploadMedia.Video, failed = 1))
            .isEqualTo("The video didn't upload." to "Signing waits for it.")
    }
}
