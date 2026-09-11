// The unit is the whole test. A cap measured in UTF-16 code units would
// refuse a title the server takes, which is the one way a mirrored cap
// can be worse than none.

package com.cogra.domain.content

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class TextLimitsTest {

    @Test
    fun `a title at the cap is allowed and one past it is not`() {
        assertThat(isTitleTooLong("x".repeat(MAX_TITLE_CHARS))).isFalse()
        assertThat(isTitleTooLong("x".repeat(MAX_TITLE_CHARS + 1))).isTrue()
    }

    @Test
    fun `the count is scalar values, so an astral title fits its own hundred`() {
        val astral = "🧂".repeat(MAX_TITLE_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_TITLE_CHARS)
        assertThat(isTitleTooLong(astral)).isFalse()
        assertThat(isTitleTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the length`() {
        assertThat(isTitleTooLong("  " + "x".repeat(MAX_TITLE_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a description at the cap is allowed and one past it is not`() {
        assertThat(isDescriptionTooLong("x".repeat(MAX_DESCRIPTION_CHARS))).isFalse()
        assertThat(isDescriptionTooLong("x".repeat(MAX_DESCRIPTION_CHARS + 1))).isTrue()
    }

    @Test
    fun `the description count is scalar values, so an astral description fits its own cap`() {
        val astral = "🧂".repeat(MAX_DESCRIPTION_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_DESCRIPTION_CHARS)
        assertThat(isDescriptionTooLong(astral)).isFalse()
        assertThat(isDescriptionTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the description length`() {
        assertThat(isDescriptionTooLong("  " + "x".repeat(MAX_DESCRIPTION_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a post body at the cap is allowed and one past it is not`() {
        assertThat(isPostBodyTooLong("x".repeat(MAX_POST_BODY_CHARS))).isFalse()
        assertThat(isPostBodyTooLong("x".repeat(MAX_POST_BODY_CHARS + 1))).isTrue()
    }

    @Test
    fun `the post body count is scalar values, so an astral body fits its own cap`() {
        val astral = "🧂".repeat(MAX_POST_BODY_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_POST_BODY_CHARS)
        assertThat(isPostBodyTooLong(astral)).isFalse()
        assertThat(isPostBodyTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the post body length`() {
        assertThat(isPostBodyTooLong("  " + "x".repeat(MAX_POST_BODY_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a comment body at the cap is allowed and one past it is not`() {
        assertThat(isCommentBodyTooLong("x".repeat(MAX_COMMENT_BODY_CHARS))).isFalse()
        assertThat(isCommentBodyTooLong("x".repeat(MAX_COMMENT_BODY_CHARS + 1))).isTrue()
    }

    @Test
    fun `the comment body count is scalar values, so an astral comment fits its own cap`() {
        val astral = "🧂".repeat(MAX_COMMENT_BODY_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_COMMENT_BODY_CHARS)
        assertThat(isCommentBodyTooLong(astral)).isFalse()
        assertThat(isCommentBodyTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the comment body length`() {
        assertThat(isCommentBodyTooLong("  " + "x".repeat(MAX_COMMENT_BODY_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a sensitive reason at the cap is allowed and one past it is not`() {
        assertThat(isSensitiveReasonTooLong("x".repeat(MAX_SENSITIVE_REASON_CHARS))).isFalse()
        assertThat(isSensitiveReasonTooLong("x".repeat(MAX_SENSITIVE_REASON_CHARS + 1))).isTrue()
    }

    @Test
    fun `the sensitive reason count is scalar values, so an astral reason fits its own cap`() {
        val astral = "🧂".repeat(MAX_SENSITIVE_REASON_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_SENSITIVE_REASON_CHARS)
        assertThat(isSensitiveReasonTooLong(astral)).isFalse()
        assertThat(isSensitiveReasonTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the sensitive reason length`() {
        assertThat(isSensitiveReasonTooLong("  " + "x".repeat(MAX_SENSITIVE_REASON_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a display name at the cap is allowed and one past it is not`() {
        assertThat(isDisplayNameTooLong("x".repeat(MAX_DISPLAY_NAME_CHARS))).isFalse()
        assertThat(isDisplayNameTooLong("x".repeat(MAX_DISPLAY_NAME_CHARS + 1))).isTrue()
    }

    @Test
    fun `the display name count is scalar values, so an astral name fits its own cap`() {
        val astral = "🧂".repeat(MAX_DISPLAY_NAME_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_DISPLAY_NAME_CHARS)
        assertThat(isDisplayNameTooLong(astral)).isFalse()
        assertThat(isDisplayNameTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the display name length`() {
        assertThat(isDisplayNameTooLong("  " + "x".repeat(MAX_DISPLAY_NAME_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a bio at the cap is allowed and one past it is not`() {
        assertThat(isBioTooLong("x".repeat(MAX_BIO_CHARS))).isFalse()
        assertThat(isBioTooLong("x".repeat(MAX_BIO_CHARS + 1))).isTrue()
    }

    @Test
    fun `the bio count is scalar values, so an astral bio fits its own cap`() {
        val astral = "🧂".repeat(MAX_BIO_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_BIO_CHARS)
        assertThat(isBioTooLong(astral)).isFalse()
        assertThat(isBioTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the bio length`() {
        assertThat(isBioTooLong("  " + "x".repeat(MAX_BIO_CHARS) + "  ")).isFalse()
    }

    @Test
    fun `a website url at the cap is allowed and one past it is not`() {
        assertThat(isWebsiteUrlTooLong("x".repeat(MAX_WEBSITE_URL_CHARS))).isFalse()
        assertThat(isWebsiteUrlTooLong("x".repeat(MAX_WEBSITE_URL_CHARS + 1))).isTrue()
    }

    @Test
    fun `the website url count is scalar values, so an astral url fits its own cap`() {
        val astral = "🧂".repeat(MAX_WEBSITE_URL_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_WEBSITE_URL_CHARS)
        assertThat(isWebsiteUrlTooLong(astral)).isFalse()
        assertThat(isWebsiteUrlTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the website url length`() {
        assertThat(isWebsiteUrlTooLong("  " + "x".repeat(MAX_WEBSITE_URL_CHARS) + "  ")).isFalse()
    }
}
