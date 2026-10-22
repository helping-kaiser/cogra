package com.cogra.core.designsystem.v2.compose

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** The "?" texts are copy-voice's own (copy-voice.md, *The "?" dialogs*). */
class HelpTopicTest {

    @Test
    fun theSealsTopicIsHowSigningWorksInItsPayerNeutralWords() {
        assertThat(HelpTopic.HowSigningWorks.title).isEqualTo("How signing works")
        assertThat(HelpTopic.HowSigningWorks.paragraphs.last())
            .isEqualTo("Each signing is paid for — the cost is real, so each one still counts.")
    }

    @Test
    fun anExactTailPaintsOnlyInGeekModeAndIsAlwaysSpoken() {
        val paragraph = HelpTopic.YourBackingOnYourPost.paragraphs.first()

        val (glyphs, spoken) = exactSpans(paragraph, showExact = false)
        assertThat(glyphs).contains("from a gentle 🙂 by default")
        assertThat(spoken).contains("from a gentle 🙂 (+0.10) by default")

        val (geek, _) = exactSpans(paragraph, showExact = true)
        assertThat(geek).isEqualTo(spoken)
    }

    @Test
    fun aParagraphWithoutATailReadsTheSameBothWays() {
        val paragraph = HelpTopic.Key.paragraphs.first()
        assertThat(exactSpans(paragraph, showExact = false)).isEqualTo(paragraph to paragraph)
    }
}
