package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The tag table is a cross-client contract (design/readme.md §13), so it is
 * pinned here value by value rather than trusted to review — and its
 * disjointness from the stance faces is a rule, not a coincidence.
 */
class TagAnchorsTest {

    @Test
    fun theTableIsTheThirteenObjectsOfTheDoc() {
        val expected = listOf(
            0.15 to 0.90, 0.45 to 0.90, 0.72 to 0.90, 0.95 to 0.90,
            0.15 to 0.55, 0.45 to 0.55, 0.72 to 0.55, 0.95 to 0.55,
            0.15 to 0.15, 0.45 to 0.15, 0.72 to 0.15, 0.95 to 0.15,
            0.86 to 0.95,
        )
        assertThat(TAG_ANCHORS.map { it.at.relevance to it.at.confidence })
            .containsExactlyElementsIn(expected)
            .inOrder()
    }

    @Test
    fun noGlyphIsInBothTables() {
        val faces = STANCE_ANCHORS.map { it.emoji }.toSet()
        assertThat(TAG_ANCHORS.map { it.emoji }.filter { it in faces }).isEmpty()
    }

    @Test
    fun everyAnchorHasItsOwnObjectAndWords() {
        assertThat(TAG_ANCHORS.map { it.emoji }.toSet()).hasSize(TAG_ANCHORS.size)
        assertThat(TAG_ANCHORS.map { it.label }.toSet()).hasSize(TAG_ANCHORS.size)
    }

    @Test
    fun everyAnchorReadsAsItself() {
        for (anchor in TAG_ANCHORS) {
            assertThat(nearestTagAnchor(anchor.at)).isEqualTo(anchor)
        }
    }

    @Test
    fun theBoardsTwoTagRowsReadAsTheirObjects() {
        // `RefsSheet.jsx:44-45`: photography at +0.40 / 0.90, coastroad at
        // +0.10 / 1.00 — the two pairs the drawn sheet carries.
        assertThat(nearestTagAnchor(TagPoint(0.4, 0.9)).emoji).isEqualTo("🔗")
        assertThat(nearestTagAnchor(TagPoint(0.1, 1.0)).emoji).isEqualTo("🔍")
    }

    // -- A tag's pair follows the same law (`tagReadout`, jakob 2026-10-21) --

    @Test
    fun aTagAtZeroOnBothNumbersIsTheWithdrawalAndShrugs() {
        val face = tagReadout(TagPoint(0.0, 0.0))
        assertThat(face.emoji).isEqualTo("🤷")
        assertThat(face.label).isEqualTo(R.string.tag_withdrawn)
    }

    @Test
    fun aTagAtZeroOnOneNumberThinksInTheTagFamilysWords() {
        // The table alone would hand these an object (❔ for both).
        assertThat(nearestTagAnchor(TagPoint(0.0, 0.2)).emoji).isEqualTo("❔")
        assertThat(nearestTagAnchor(TagPoint(0.2, 0.0)).emoji).isEqualTo("❔")
        val notAbout = tagReadout(TagPoint(0.0, 0.2))
        assertThat(notAbout.emoji).isEqualTo("🤔")
        assertThat(notAbout.label).isEqualTo(R.string.tag_unreachable_not_about)
        val noCertainty = tagReadout(TagPoint(0.2, 0.0))
        assertThat(noCertainty.emoji).isEqualTo("🤔")
        assertThat(noCertainty.label).isEqualTo(R.string.tag_unreachable_no_certainty)
    }

    @Test
    fun theThirteenReadOnlyAPairWithBothNumbersNonZero() {
        for (anchor in TAG_ANCHORS) {
            assertThat(tagReadout(anchor.at)).isEqualTo(anchor)
        }
        assertThat(tagReadout(TagPoint(0.4, 0.9)).emoji).isEqualTo("🔗")
    }

    @Test
    fun theTagTwinIsTheMasters() {
        val master = java.io.File("../../../design/components/stance/StanceReadout.jsx").readText()
        assertThat(master).contains("export const TAG_WITHDRAWN_LABEL = \"withdrawn\";")
        assertThat(master).contains("return pair.pDirected === 0 ? \"not about it at all\" : \"no certainty at all\";")
    }

    @Test
    fun confidenceIsWrittenWithoutAForcedSign() {
        // The whole difference between a tag's pair and a citation's: the
        // second axis has no negative half to sign.
        assertThat(twoPlacesUnsigned(0.9)).isEqualTo("0.90")
        assertThat(twoPlacesUnsigned(1.0)).isEqualTo("1.00")
    }
}
