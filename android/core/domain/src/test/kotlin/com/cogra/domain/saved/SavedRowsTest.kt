// How a row names content with no title of its own (design digest item 50;
// B11), and what the comment card's head row names (FeedCommentShapes.md) —
// web's twins are `row-content.test.ts` and `comment-feed-card.test.ts`.

package com.cogra.domain.saved

import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SavedRowsTest {

    private fun text(value: String?, status: FieldStatus = FieldStatus.NORMAL) = ModeratedField(value, status)

    private fun post(
        title: String? = "The long way home",
        content: String? = "Took the coast road",
        mimeTypes: List<String> = emptyList(),
        cover: String? = null,
        status: FieldStatus = FieldStatus.NORMAL,
        moderation: ModerationState = ModerationState.NORMAL,
    ) = CommentTarget.Post(
        id = "p1",
        title = text(title, status),
        content = text(content, status),
        mimeTypes = mimeTypes,
        coverUrl = cover,
        authorHandle = "ada",
        moderation = moderation,
        removed = status == FieldStatus.REDACTED,
    )

    @Test
    fun a_titled_post_reads_its_title() {
        assertThat(postTitle(text("The long way home"), text("words"), emptyList(), "ada")).isEqualTo("The long way home")
    }

    @Test
    fun an_untitled_words_post_reads_its_first_line() {
        assertThat(postTitle(text(null), text("Hello there\nand more"), emptyList(), "ada")).isEqualTo("Hello there")
    }

    @Test
    fun an_untitled_media_post_is_named_by_b11() {
        assertThat(postTitle(text(null), text(null), listOf("video/mp4"), "ada")).isEqualTo("A video by @ada")
        assertThat(mediaStandIn(listOf("image/png"), "ada")).isEqualTo("Pictures by @ada")
    }

    @Test
    fun a_head_row_names_a_post_by_its_title_over_its_author() {
        val row = headRowOf(post())
        assertThat(row.title).isEqualTo("The long way home")
        assertThat(row.sub).isEqualTo("@ada")
        assertThat(row.comment).isFalse()
        assertThat(row.removed).isFalse()
        assertThat(row.label).isEqualTo("“The long way home” — @ada")
    }

    @Test
    fun a_head_row_names_an_untitled_post_by_its_first_words() {
        assertThat(headRowOf(post(title = null, content = "Low tide at six\nanyone?")).title).isEqualTo("Low tide at six")
    }

    @Test
    fun a_head_row_takes_the_posts_cover_as_its_mark() {
        assertThat(headRowOf(post(cover = "https://m/c.webp")).coverUrl).isEqualTo("https://m/c.webp")
    }

    @Test
    fun a_removed_post_keeps_its_head_row_reading_the_removal_line_with_an_empty_tile() {
        val row = headRowOf(post(status = FieldStatus.REDACTED, cover = "https://m/c.webp"))
        assertThat(row.title).isEqualTo(REMOVED_BY_AUTHOR)
        assertThat(row.sub).isEqualTo("@ada")
        assertThat(row.removed).isTrue()
        assertThat(row.coverUrl).isNull()
        val platform = headRowOf(post(status = FieldStatus.REDACTED, moderation = ModerationState.ILLEGAL))
        assertThat(platform.title).isEqualTo(REMOVED_BY_THE_PLATFORM)
    }

    @Test
    fun a_head_row_names_a_comment_by_its_author_over_its_first_words() {
        val row = headRowOf(CommentTarget.Comment("c0", text("The light is real\nI saw it."), "sol"))
        assertThat(row.title).isEqualTo("@sol")
        assertThat(row.sub).isEqualTo("The light is real")
        assertThat(row.comment).isTrue()
        assertThat(row.label).isEqualTo("@sol's comment")
    }
}
