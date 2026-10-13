// What a Saved row says (Saved.md; design digest items 49 and 50; B11) —
// web's twin is `row-content.test.ts`, rule for rule.

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
        description: String? = null,
        content: String? = "Took the coast road instead of the tunnel.",
        mimeTypes: List<String> = emptyList(),
        moderation: ModerationState = ModerationState.NORMAL,
        reason: String? = null,
        status: FieldStatus = FieldStatus.NORMAL,
    ) = SavedNode.Post(
        id = "p1",
        title = text(title, status),
        description = text(description),
        content = text(content, status),
        mimeTypes = mimeTypes,
        moderation = moderation,
        sensitiveReason = reason,
        authorHandle = "ada",
    )

    private val threadPost = ThreadPost("p1", text("The long way home"), text("words"), emptyList(), "ada")

    private fun comment(
        content: String? = "The third headland light is real\nI walked there.",
        mimeTypes: List<String> = emptyList(),
        status: FieldStatus = FieldStatus.NORMAL,
        post: ThreadPost? = threadPost,
    ) = SavedNode.Comment("c1", text(content, status), mimeTypes, ModerationState.NORMAL, null, "tobias", post)

    private fun person(
        name: String? = "Mira Voss",
        bio: String? = "Runs the stand by the sea wall.",
        avatar: String? = null,
        status: FieldStatus = FieldStatus.NORMAL,
    ) = SavedNode.Person("u3", "mira", text(name, status), text(bio), avatar)

    @Test
    fun `a titled words post reads its title handle and words`() {
        val row = savedRow(post())
        assertThat(row.title).isEqualTo("The long way home")
        assertThat(row.aside).isEqualTo("@ada")
        assertThat(row.second).isEqualTo("Took the coast road instead of the tunnel.")
        assertThat(row.disc).isEqualTo(SavedDisc.Glyph(comment = false))
        assertThat(row.key).isEqualTo("the-long-way-home")
        assertThat(row.target).isEqualTo(SavedTarget.Post("p1"))
    }

    @Test
    fun `a titled media post's second line is its description, else drops`() {
        val described = post(description = "All of it.", mimeTypes = listOf("image/webp"))
        assertThat(savedRow(described).second).isEqualTo("All of it.")
        assertThat(savedRow(post(mimeTypes = listOf("image/webp"))).second).isNull()
    }

    @Test
    fun `an untitled words post takes its first line and the rest below`() {
        val row = savedRow(post(title = null, content = "Hello there\nand more\nwords"))
        assertThat(row.title).isEqualTo("Hello there")
        assertThat(row.second).isEqualTo("and more words")
    }

    @Test
    fun `an untitled media post is named by B11 with no second line and no aside`() {
        val row = savedRow(post(title = null, content = null, mimeTypes = listOf("video/mp4")))
        assertThat(row.title).isEqualTo("A video by @ada")
        assertThat(row.second).isNull()
        assertThat(row.aside).isNull()
        assertThat(savedRow(post(title = null, content = null, mimeTypes = listOf("image/webp"))).title)
            .isEqualTo("Pictures by @ada")
    }

    @Test
    fun `a comment takes its first line and names its thread's post`() {
        val row = savedRow(comment())
        assertThat(row.title).isEqualTo("The third headland light is real")
        assertThat(row.aside).isEqualTo("@tobias")
        assertThat(row.second).isEqualTo("on The long way home")
        assertThat(row.disc).isEqualTo(SavedDisc.Glyph(comment = true))
        assertThat(row.target).isEqualTo(SavedTarget.Comment(postId = "p1", commentId = "c1"))
    }

    @Test
    fun `a wordless comment is named as a media post is`() {
        val row = savedRow(comment(content = null, mimeTypes = listOf("image/webp")))
        assertThat(row.title).isEqualTo("Pictures by @tobias")
        assertThat(row.aside).isNull()
    }

    @Test
    fun `a reply's on line names the thread's post by its stand-in when untitled`() {
        val untitled = ThreadPost("p9", text(null), text(null), listOf("video/mp4"), "ada")
        assertThat(savedRow(comment(post = untitled)).second).isEqualTo("on A video by @ada")
    }

    @Test
    fun `a removed post or comment stays reading Removed by its author`() {
        val removed = savedRow(post(status = FieldStatus.REDACTED))
        assertThat(removed.title).isEqualTo(REMOVED_BY_AUTHOR)
        assertThat(removed.titleQuiet).isTrue()
        assertThat(removed.second).isNull()
        val removedComment = savedRow(comment(status = FieldStatus.REDACTED))
        assertThat(removedComment.title).isEqualTo(REMOVED_BY_AUTHOR)
        assertThat(removedComment.disc).isEqualTo(SavedDisc.Glyph(comment = true))
    }

    @Test
    fun `a sensitive thing's second line gives way to its reason`() {
        val row = savedRow(post(moderation = ModerationState.SENSITIVE, reason = "spoilers"))
        assertThat(row.title).isEqualTo("The long way home")
        assertThat(row.second).isEqualTo("spoilers")
    }

    @Test
    fun `a person reads name, handle and bio, with their picture when they have one`() {
        val row = savedRow(person())
        assertThat(row.title).isEqualTo("Mira Voss")
        assertThat(row.aside).isEqualTo("@mira")
        assertThat(row.second).isEqualTo("Runs the stand by the sea wall.")
        assertThat(row.disc).isEqualTo(SavedDisc.Monogram("Mira Voss"))
        assertThat(row.key).isEqualTo("mira-voss")
        val pictured = savedRow(person(avatar = "https://m/a.webp"))
        assertThat(pictured.disc).isEqualTo(SavedDisc.Picture("https://m/a.webp", "Mira Voss"))
    }

    @Test
    fun `a nameless person takes the handle with no aside and no bio line`() {
        val row = savedRow(person(name = null, bio = null))
        assertThat(row.title).isEqualTo("@mira")
        assertThat(row.aside).isNull()
        assertThat(row.second).isNull()
    }

    @Test
    fun `a deleted account wears the reserved disc and no aside`() {
        val row = savedRow(person(name = null, status = FieldStatus.REDACTED))
        assertThat(row.title).isEqualTo(DELETED_ACCOUNT)
        assertThat(row.disc).isEqualTo(SavedDisc.Redacted)
        assertThat(row.aside).isNull()
        assertThat(row.key).isEqualTo("u3")
    }

    @Test
    fun `the key slugs the title`() {
        assertThat(slug("  Sunday at the tide market!! ")).isEqualTo("sunday-at-the-tide-market")
        assertThat(slug("Pictures by @ada")).isEqualTo("pictures-by-ada")
    }
}
