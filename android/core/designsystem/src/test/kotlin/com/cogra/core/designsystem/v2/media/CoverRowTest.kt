package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * NEW-2 (video-cover round, 2026-09-10; `ComposeCoverNoFrames.jsx:44`): the
 * row's caption names the reason once frame extraction is done and came back
 * with nothing, rather than offering four tiles for pictures that do not
 * exist.
 */
@RunWith(RobolectricTestRunner::class)
class CoverRowTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun namesTheReasonWhenExtractionFoundNoFrames() {
        compose.setContent {
            Cogra2PreviewTheme {
                CoverRow(
                    frames = emptyList(),
                    picked = CoverPick.OwnPicture,
                    onPickFrame = {},
                    onPickOwnPicture = {},
                    testTagPrefix = "test",
                )
            }
        }

        compose.onNodeWithTag("test_note").assertTextEquals(
            "This clip gave no frames — choose a picture of your own, or leave it without one.",
        )
    }

    @Test
    fun keepsTheDefaultCaptionWhenFramesExist() {
        compose.setContent {
            Cogra2PreviewTheme {
                CoverRow(
                    frames = listOf(null, null),
                    picked = CoverPick.Frame(0),
                    onPickFrame = {},
                    onPickOwnPicture = {},
                    testTagPrefix = "test",
                )
            }
        }

        compose.onNodeWithTag("test_note").assertTextEquals("A frame, or a picture of your own.")
    }

    // Design #781: `selected` (here, `CoverPick`) defaults to a rest
    // state that rings and dims NOTHING — "choosing a cover is always a
    // willing act" (CoverRow.jsx:20-24; CoverRow.d.ts:21-24). `ringsFrame`
    // / `dimsFrame` / `dimsOwnPicture` are the exact booleans `CoverRow`
    // feeds each tile's `selected`/`dimmed`, pulled out so this is a plain
    // JVM assertion rather than a Compose tree — no test anywhere in this
    // module reads `MediaThumb`'s ring border or its alpha modifier back
    // out of the semantics tree (MediaThumb.kt:118,133,174 set neither as
    // a semantics property), so this is the level the null-rest rule is
    // actually checkable at.
    @Test
    fun nothingChosenRingsAndDimsNoTile() {
        val picked = CoverPick.None

        assertThat(picked.ringsFrame(0)).isFalse()
        assertThat(picked.ringsFrame(1)).isFalse()
        assertThat(picked.dimsFrame(0)).isFalse()
        assertThat(picked.dimsFrame(1)).isFalse()
        assertThat(picked.dimsOwnPicture()).isFalse()
    }

    @Test
    fun choosingAFrameRingsItAloneAndDimsEveryOtherTile() {
        val picked = CoverPick.Frame(1)

        assertThat(picked.ringsFrame(1)).isTrue()
        assertThat(picked.dimsFrame(1)).isFalse()
        assertThat(picked.ringsFrame(0)).isFalse()
        assertThat(picked.dimsFrame(0)).isTrue()
        assertThat(picked.dimsOwnPicture()).isTrue()
    }

    @Test
    fun choosingTheOwnPictureDimsEveryFrameAndNotItself() {
        val picked = CoverPick.OwnPicture

        assertThat(picked.dimsOwnPicture()).isFalse()
        assertThat(picked.dimsFrame(0)).isTrue()
        assertThat(picked.ringsFrame(0)).isFalse()
    }
}
