package com.cogra.domain.content

import com.cogra.domain.FieldStatus
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The three properties of a reveal, each ruled by jakob on 2026-08-31
 * after the second hand test: per node and per session, shared across
 * surfaces, and reset when the node's sensitive state changes.
 */
class SensitiveRevealsTest {

    private val reveals = SensitiveReveals()

    private val sensitive = SensitiveMark(
        content = FieldStatus.SENSITIVE,
        description = FieldStatus.NORMAL,
        attachments = FieldStatus.NORMAL,
    )

    private fun revealed() = reveals.revealed.value

    // -- Per node --

    @Test
    fun revealingOneNodeLeavesEveryOtherVeiled() {
        reveals.reveal("post-1", sensitive)

        assertThat(revealed().isRevealed("post-1", sensitive)).isTrue()
        assertThat(revealed().isRevealed("post-2", sensitive)).isFalse()
    }

    @Test
    fun nothingIsRevealedUntilTheReaderChooses() {
        assertThat(revealed().isRevealed("post-1", sensitive)).isFalse()
    }

    // -- Shared across surfaces --

    /**
     * There is one holder for the whole app, so the feed's card and the
     * detail's body read the same answer. This is the bug jakob found:
     * a reveal made in the feed did not carry into the detail, and the
     * reader was asked twice about the same body.
     */
    @Test
    fun aRevealMadeOnOneSurfaceIsAlreadyMadeOnEveryOther() {
        // The feed's card reveals...
        reveals.reveal("post-1", sensitive)

        // ...and the detail reads the very same set, with no second
        // choice to make.
        assertThat(reveals.revealed.value.isRevealed("post-1", sensitive)).isTrue()
    }

    // -- Reset when the sensitive state changes --

    @Test
    fun anEditThatRemarksTheBodyVeilsItAgain() {
        reveals.reveal("post-1", sensitive)

        // The author edited and the description picked up the mark too:
        // a different body from the one consent was given about.
        val remarked = sensitive.copy(description = FieldStatus.SENSITIVE)

        assertThat(revealed().isRevealed("post-1", remarked)).isFalse()
    }

    @Test
    fun aMarkAppearingOnAGalleryVeilsAnAlreadyRevealedBody() {
        val plain = SensitiveMark(
            content = FieldStatus.SENSITIVE,
            description = FieldStatus.NORMAL,
            attachments = FieldStatus.NORMAL,
        )
        reveals.reveal("post-1", plain)

        val moderated = plain.copy(attachments = FieldStatus.SENSITIVE)

        assertThat(revealed().isRevealed("post-1", moderated)).isFalse()
    }

    @Test
    fun anEditThatLeavesTheSensitiveStateAloneKeepsTheReveal() {
        reveals.reveal("post-1", sensitive)

        // The words changed; the marks did not. Re-veiling here would
        // punish the reader for the author fixing a typo.
        assertThat(revealed().isRevealed("post-1", sensitive)).isTrue()
    }

    @Test
    fun revealingAgainUnderTheNewMarkRestoresTheChoice() {
        reveals.reveal("post-1", sensitive)
        val remarked = sensitive.copy(attachments = FieldStatus.SENSITIVE)
        assertThat(revealed().isRevealed("post-1", remarked)).isFalse()

        reveals.reveal("post-1", remarked)

        assertThat(revealed().isRevealed("post-1", remarked)).isTrue()
        // And the old mark is no longer what the reveal is against.
        assertThat(revealed().isRevealed("post-1", sensitive)).isFalse()
    }

    // -- What the mark itself says --

    @Test
    fun aMarkKnowsWhetherItVeilsAnythingAtAll() {
        val none = SensitiveMark(FieldStatus.NORMAL, FieldStatus.NORMAL, FieldStatus.NORMAL)

        assertThat(none.isSensitive).isFalse()
        assertThat(sensitive.isSensitive).isTrue()
        assertThat(none.copy(attachments = FieldStatus.SENSITIVE).isSensitive).isTrue()
        assertThat(none.copy(description = FieldStatus.SENSITIVE).isSensitive).isTrue()
    }
}
