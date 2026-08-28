package com.cogra.feature.content

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The body region's two replacing states.
 *
 * D12 makes the veil whole-body and D15 makes the removal a calm
 * placeholder rather than a gap, so both are decided here — once, for
 * the feed card and the detail alike.
 */
@RunWith(RobolectricTestRunner::class)
class PostBodyTest {

    @get:Rule
    val compose = createComposeRule()

    private val words = ModeratedField("Salt maps", FieldStatus.NORMAL)
    private val picture = MediaAssetView("m1", "https://media/m1", "A crust", FieldStatus.NORMAL, 1f)

    // -- Removal (D15) --

    @Test
    fun aRedactedGalleryIsTheWholeBodyGone() {
        assertThat(
            isRemoved(words, listOf(picture), FieldStatus.REDACTED),
        ).isTrue()
    }

    @Test
    fun aGalleryOfRedactedAssetsIsAlsoGone() {
        assertThat(
            isRemoved(words, listOf(picture.copy(status = FieldStatus.REDACTED)), FieldStatus.NORMAL),
        ).isTrue()
    }

    @Test
    fun aWordsPostIsGoneWhenItsWordsAre() {
        assertThat(
            isRemoved(words.copy(status = FieldStatus.REDACTED), emptyList(), FieldStatus.NORMAL),
        ).isTrue()
    }

    @Test
    fun aStatusThisBuildCannotNameIsNeverShownAsFine() {
        // Degrade, never crash — and never leak: an unknown state hides
        // rather than rendering as normal.
        assertThat(
            isRemoved(words.copy(status = FieldStatus.UNKNOWN), emptyList(), FieldStatus.NORMAL),
        ).isTrue()
    }

    @Test
    fun anOrdinaryBodyIsNotRemoved() {
        assertThat(isRemoved(words, listOf(picture), FieldStatus.NORMAL)).isFalse()
        assertThat(isRemoved(words, emptyList(), FieldStatus.NORMAL)).isFalse()
    }

    // -- The veil (D12) --

    @Test
    fun anyMarkedFieldVeilsTheWholeBody() {
        assertThat(isSensitive(words, null, FieldStatus.SENSITIVE)).isTrue()
        assertThat(isSensitive(words.copy(status = FieldStatus.SENSITIVE), null, FieldStatus.NORMAL))
            .isTrue()
        assertThat(
            isSensitive(words, ModeratedField("note", FieldStatus.SENSITIVE), FieldStatus.NORMAL),
        ).isTrue()
    }

    @Test
    fun anUnmarkedBodyIsNotVeiled() {
        assertThat(isSensitive(words, ModeratedField("note", FieldStatus.NORMAL), FieldStatus.NORMAL))
            .isFalse()
    }

    // -- What the reader actually sees --

    @Test
    fun aRemovedBodyDrawsThePlaceholderInsteadOfTheGallery() {
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.REDACTED,
                testTagPrefix = "t",
            )
        }
        compose.onNodeWithTag("t_removed").assertIsDisplayed()
        compose.onNodeWithTag("t_gallery").assertDoesNotExist()
    }

    @Test
    fun aVeiledBodyRevealsInPlaceAndStaysRevealed() {
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.SENSITIVE,
                testTagPrefix = "t",
            )
        }
        compose.onNodeWithTag("t_veil_reveal").assertIsDisplayed().performClick()
        compose.onNodeWithTag("t_veil_reveal").assertDoesNotExist()
        compose.onNodeWithTag("t_gallery").assertIsDisplayed()
    }

    @Test
    fun anOrdinaryGalleryNeedsNoGesture() {
        compose.setContent {
            PostBody(
                content = ModeratedField(null, FieldStatus.NORMAL),
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.NORMAL,
                testTagPrefix = "t",
            )
        }
        compose.onNodeWithTag("t_gallery").assertIsDisplayed()
        compose.onNodeWithTag("t_veil_reveal").assertDoesNotExist()
    }
}
