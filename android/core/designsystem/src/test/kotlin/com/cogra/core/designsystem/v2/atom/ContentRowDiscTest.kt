package com.cogra.core.designsystem.v2.atom

import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.SEVERED_LABEL
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * `ContentRow`'s `face.severed` (round 20, seam 245 ask 19): a `(0, 0)` face
 * cannot say by its numbers which zero it is, so the row's data says — and
 * absent, it says nothing, the master's default.
 */
class ContentRowDiscTest {

    @Test
    fun aFaceWithNoSeveredFlagSaysNothing() {
        assertThat(ContentRowDisc.Face(0.0, 0.0).zeroLabel).isEqualTo(EMPTY_PICK_LABEL)
    }

    @Test
    fun aFaceTheBundleWalkedBackSpeaksWalkedBack() {
        assertThat(ContentRowDisc.Face(0.0, 0.0, severed = true).zeroLabel).isEqualTo(SEVERED_LABEL)
    }
}
