package com.cogra.feature.content

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.GraphicsMode

/**
 * The body region's two replacing states.
 *
 * D12 makes the veil whole-body and D15 makes the removal a calm
 * placeholder rather than a gap, so both are decided here — once, for
 * the feed card and the detail alike.
 */
// The clamp tests ask whether a paragraph overflowed, which needs real
// glyph metrics: Robolectric's legacy graphics measure every string at
// zero width, so nothing ever overflows. NATIVE draws through the real
// Skia stack and measures for real.
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
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
                moderation = ModerationState.NORMAL,
                testTagPrefix = "t",
            )
        }
        compose.onNodeWithTag("t_removed").assertIsDisplayed()
        compose.onNodeWithTag("t_gallery").assertDoesNotExist()
    }

    // The two removals have to stay distinguishable, or a verdict hides
    // behind an author's own decision. The wordings are asserted in full
    // for the same reason `RemovedPlaceholder`'s own test does it.

    @Test
    fun aRemovalWithNoVerdictOnItReadsAsTheAuthorsOwn() {
        showRemoved(ModerationState.NORMAL)

        compose.onNodeWithText("Removed by its author").assertIsDisplayed()
    }

    @Test
    fun aPlatformRemovalSaysSoRatherThanBorrowingTheAuthorsVoice() {
        showRemoved(ModerationState.ILLEGAL)

        compose.onNodeWithText("Removed under the platform's rules").assertIsDisplayed()
    }

    @Test
    fun aStateThisBuildCannotNameIsNotReadAsAVerdict() {
        showRemoved(ModerationState.UNKNOWN)

        compose.onNodeWithText("Removed by its author").assertIsDisplayed()
    }

    private fun showRemoved(moderation: ModerationState) {
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.REDACTED,
                moderation = moderation,
                testTagPrefix = "t",
            )
        }
    }

    @Test
    fun aVeiledBodyRevealsInPlaceAndStaysRevealed() {
        // The reveal is hoisted: it belongs to the node and the session,
        // not to this card, so the body reads it rather than holding it
        // (`SensitiveReveals`). The screen is what puts the answer back.
        var revealed by mutableStateOf(false)
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.SENSITIVE,
                moderation = ModerationState.SENSITIVE,
                testTagPrefix = "t",
                revealed = revealed,
                onReveal = { revealed = true },
            )
        }
        compose.onNodeWithTag("t_veil_reveal").assertIsDisplayed().performClick()
        compose.onNodeWithTag("t_veil_reveal").assertDoesNotExist()
        compose.onNodeWithTag("t_gallery").assertIsDisplayed()
    }

    /**
     * A COMMENT WEARS THE OTHER FACE (F2-11). A post's body blurs in
     * place; a comment's is two lines and an inset attachment, so the
     * whole body is replaced by one block naming the veil and whose mark
     * it is — the reveal is that block, not a button inside it.
     */
    @Test
    fun aVeiledCommentWearsTheCompactFaceAndNamesItsSource() {
        var revealed by mutableStateOf(false)
        compose.setContent {
            PostBody(
                content = words.copy(status = FieldStatus.SENSITIVE),
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.SENSITIVE,
                moderation = ModerationState.SENSITIVE,
                testTagPrefix = "c",
                surface = BodySurface.Comment,
                revealed = revealed,
                onReveal = { revealed = true },
                sensitiveSource = SensitiveSource.Author,
                sensitiveReason = "Shows an injury",
            )
        }

        // The compact face carries no reveal button of its own.
        compose.onNodeWithTag("c_veil_reveal").assertDoesNotExist()
        compose.onNodeWithText("Sensitive — tap to view").assertIsDisplayed()
        compose.onNodeWithText("The author's warning — Shows an injury").assertIsDisplayed()

        compose.onNodeWithTag("c_veil").performClick()

        compose.onNodeWithTag("c_gallery").assertIsDisplayed()
    }

    /** A body already revealed elsewhere opens unveiled — no second ask. */
    @Test
    fun aBodyRevealedElsewhereIsNotVeiledAgain() {
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.SENSITIVE,
                moderation = ModerationState.SENSITIVE,
                testTagPrefix = "t",
                revealed = true,
            )
        }
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
                moderation = ModerationState.NORMAL,
                testTagPrefix = "t",
            )
        }
        compose.onNodeWithTag("t_gallery").assertIsDisplayed()
        compose.onNodeWithTag("t_veil_reveal").assertDoesNotExist()
    }

    // -- Where a comment's pictures sit (CommentCard, 2026-08-31) --

    @Test
    fun aCommentsPicturesJoinItsWordsRatherThanLeadingThem() {
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture, picture.copy(id = "m2")),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                testTagPrefix = "c",
                surface = BodySurface.Comment,
            )
        }

        // A comment is words first; the gallery follows them.
        val wordsTop = compose.onNodeWithText("Salt maps").fetchSemanticsNode().positionInRoot.y
        val galleryTop = compose.onNodeWithTag("c_gallery").fetchSemanticsNode().positionInRoot.y
        assertThat(galleryTop).isGreaterThan(wordsTop)
    }

    // -- Words XOR media (D16) --

    /**
     * A post's body is words or media and never both, so the picture IS
     * the body: handed an impossible post carrying each, the card draws
     * the documented media reading and the words never appear.
     */
    @Test
    fun aPostsPictureReplacesItsWords() {
        compose.setContent {
            PostBody(
                content = words,
                description = ModeratedField("what it is", FieldStatus.NORMAL),
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                testTagPrefix = "p",
            )
        }

        compose.onNodeWithTag("p_gallery").assertIsDisplayed()
        compose.onNodeWithTag("p_words").assertDoesNotExist()
        compose.onNodeWithTag("p_description").assertIsDisplayed()
    }

    /** A comment is words PLUS pictures, and its words still lead them. */
    @Test
    fun aCommentsWordsLeadItsPictures() {
        compose.setContent {
            PostBody(
                content = words,
                description = null,
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                surface = BodySurface.Comment,
                testTagPrefix = "c",
            )
        }

        val wordsTop = compose.onNodeWithTag("c_words").fetchSemanticsNode().positionInRoot.y
        val galleryTop = compose.onNodeWithTag("c_gallery").fetchSemanticsNode().positionInRoot.y
        assertThat(wordsTop).isLessThan(galleryTop)
    }

    /** A words post keeps both, body first and the caption under it. */
    @Test
    fun aWordsPostDrawsItsBodyThenItsCaption() {
        compose.setContent {
            PostBody(
                content = words,
                description = ModeratedField("the caption", FieldStatus.NORMAL),
                attachments = emptyList(),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                testTagPrefix = "w",
            )
        }

        val bodyTop = compose.onNodeWithTag("w_words").fetchSemanticsNode().positionInRoot.y
        val captionTop = compose.onNodeWithTag("w_description").fetchSemanticsNode().positionInRoot.y
        assertThat(bodyTop).isLessThan(captionTop)
    }

    // -- The clamps and the opener --

    /** Nothing folded away, no opener — the rule is "only where there is". */
    @Test
    fun aShortBodyCarriesNoOpener() {
        showCollapsed(words)

        compose.onNodeWithTag("s_opener").assertDoesNotExist()
    }

    /** Past the ceiling the opener stands, and it unfolds in place. */
    @Test
    fun aFoldedBodyOpensAndClosesInPlace() {
        showCollapsed(ModeratedField(longBody, FieldStatus.NORMAL))

        compose.onNodeWithTag("s_opener").assertIsDisplayed()
        compose.onNodeWithText("More").assertIsDisplayed()
        compose.onNodeWithTag("s_opener").performClick()
        compose.onNodeWithText("Less").assertIsDisplayed()
        compose.onNodeWithTag("s_opener").performClick()
        compose.onNodeWithText("More").assertIsDisplayed()
    }

    /** The detail is the read surface: it clamps nothing and never opens. */
    @Test
    fun anUncollapsedBodyNeverOffersTheOpener() {
        compose.setContent {
            PostBody(
                content = ModeratedField(longBody, FieldStatus.NORMAL),
                description = null,
                attachments = emptyList(),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                testTagPrefix = "d",
            )
        }

        compose.onNodeWithTag("d_opener").assertDoesNotExist()
    }

    /** A caption past two lines opens the card even on a media post. */
    @Test
    fun aLongCaptionOpensTheCardToo() {
        compose.setContent {
            PostBody(
                content = ModeratedField(null, FieldStatus.NORMAL),
                description = ModeratedField(longBody, FieldStatus.NORMAL),
                attachments = listOf(picture),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                collapsed = true,
                testTagPrefix = "m",
            )
        }

        compose.onNodeWithTag("m_opener").assertIsDisplayed()
    }

    private fun showCollapsed(content: ModeratedField) {
        compose.setContent {
            PostBody(
                content = content,
                description = null,
                attachments = emptyList(),
                attachmentsStatus = FieldStatus.NORMAL,
                moderation = ModerationState.NORMAL,
                collapsed = true,
                testTagPrefix = "s",
            )
        }
    }

    /** Well past the 18-line ceiling at any plausible card width. */
    private val longBody = "Salt maps of the coast road, walked at low tide. ".repeat(80)
}
