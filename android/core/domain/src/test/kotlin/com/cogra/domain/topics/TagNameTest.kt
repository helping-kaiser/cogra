package com.cogra.domain.topics

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class TagNameTest {

    @Test
    fun canonicalizationTrimsStripsTheHashAndLowercases() {
        assertThat(canonicalTagName("  #Rust ")).isEqualTo("rust")
        assertThat(canonicalTagName("SYSTEMS_pl-2.0")).isEqualTo("systems_pl-2.0")
    }

    @Test
    fun aLegalAtomHasNoProblem() {
        assertThat(tagNameProblem("rust")).isNull()
        assertThat(tagNameProblem("#Rust")).isNull()
        assertThat(tagNameProblem("a.b_c-1")).isNull()
        assertThat(isAddableTagName("rust")).isTrue()
    }

    @Test
    fun anEmptyNameReportsNothingButIsNotAddable() {
        assertThat(tagNameProblem("")).isNull()
        assertThat(tagNameProblem("  # ")).isNull()
        assertThat(isAddableTagName("")).isFalse()
        assertThat(isAddableTagName("#")).isFalse()
    }

    @Test
    fun interiorWhitespaceIsRefused() {
        assertThat(tagNameProblem("two words")).isEqualTo(TagNameProblem.WHITESPACE)
        assertThat(isAddableTagName("two words")).isFalse()
    }

    /** Surrounding whitespace is canonicalized away, so it is not a problem. */
    @Test
    fun surroundingWhitespaceIsNotAProblem() {
        assertThat(tagNameProblem("  rust  ")).isNull()
        assertThat(isAddableTagName("  rust  ")).isTrue()
    }

    @Test
    fun theByteCeilingIsTheAtomsNotTheStrings() {
        assertThat(tagNameProblem("a".repeat(MAX_TAG_NAME_BYTES))).isNull()
        assertThat(tagNameProblem("a".repeat(MAX_TAG_NAME_BYTES + 1)))
            .isEqualTo(TagNameProblem.TOO_LONG)
    }

    /**
     * D3, strictly: non-ASCII gets a refusal rather than an encoding.
     * Length is checked first, so an over-long ASCII name reports its
     * length; a short non-ASCII one reports the charset.
     */
    @Test
    fun nonAsciiIsRefusedOutright() {
        assertThat(tagNameProblem("café")).isEqualTo(TagNameProblem.ILLEGAL_CHARSET)
        assertThat(tagNameProblem("日本語")).isEqualTo(TagNameProblem.ILLEGAL_CHARSET)
        assertThat(tagNameProblem("emoji🎉")).isEqualTo(TagNameProblem.ILLEGAL_CHARSET)
        assertThat(isAddableTagName("café")).isFalse()
    }

    @Test
    fun asciiOutsideTheAtomIsRefused() {
        assertThat(tagNameProblem("a/b")).isEqualTo(TagNameProblem.ILLEGAL_CHARSET)
        assertThat(tagNameProblem("a+b")).isEqualTo(TagNameProblem.ILLEGAL_CHARSET)
        // A `#` only canonicalizes away at the front.
        assertThat(tagNameProblem("a#b")).isEqualTo(TagNameProblem.ILLEGAL_CHARSET)
    }

    @Test
    fun theDefaultsAreTheOnesTheServerWouldApply() {
        val claim = TagClaim("rust")
        assertThat(claim.relevance).isEqualTo(TAG_DEFAULT_RELEVANCE)
        assertThat(claim.confidence).isEqualTo(TAG_DEFAULT_CONFIDENCE)
        assertThat(TAG_DEFAULT_RELEVANCE).isEqualTo(0.1)
        assertThat(TAG_DEFAULT_CONFIDENCE).isEqualTo(1.0)
    }
}
