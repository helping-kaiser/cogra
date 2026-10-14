package com.cogra.domain.notifications

import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.saved.SavedNode
import com.cogra.domain.saved.ThreadPost
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Instant

/** What a notification row says and where it lands (Notifications.md:5-45); web's twin is `row-content.test.ts`. */
class NotificationRowsTest {
    private fun text(value: String?, status: FieldStatus = FieldStatus.NORMAL) = ModeratedField(value, status)

    private val thread = ThreadPost(
        id = "p1",
        title = text("Salt maps of the coast road"),
        content = text("words"),
        mimeTypes = emptyList(),
        authorHandle = "me",
    )

    private fun post(id: String, title: String?, content: String = "Some words") = SavedNode.Post(
        id = id,
        title = text(title),
        description = text(null),
        content = text(content),
        mimeTypes = emptyList(),
        moderation = ModerationState.NORMAL,
        sensitiveReason = null,
        authorHandle = "ada",
    )

    private fun comment(id: String, words: String) = SavedNode.Comment(
        id = id,
        content = text(words),
        mimeTypes = emptyList(),
        moderation = ModerationState.NORMAL,
        sensitiveReason = null,
        authorHandle = "tobias",
        post = thread,
    )

    private fun row(
        kind: NotificationKind,
        subject: NotificationSubject? = null,
        context: NotificationContext? = null,
        pair: NotificationPair? = null,
        actor: NotificationActor = NotificationActor("a1", "ada", text("Ada Okonkwo"), null),
    ) = Notification(
        id = "n1",
        kind = kind,
        createdAt = Instant.parse("2026-10-14T10:00:00Z"),
        readAt = null,
        actor = actor,
        subject = subject,
        context = context,
        pair = pair,
        applicationId = null,
    )

    @Test
    fun `each kind reads its drawn sentence`() {
        val sentences = mapOf(
            NotificationKind.COMMENT to "@ada commented on your post",
            NotificationKind.REPLY to "@ada replied to your comment",
            NotificationKind.PROFILE_OPINION to "@ada gave an opinion on you",
            NotificationKind.MENTION to "@ada mentioned you",
            NotificationKind.CITATION to "@ada cited your post",
            NotificationKind.APPLICATION_APPROVABLE to "@ada is ready for your approval",
            NotificationKind.INVITE_LANDED to "@ada landed through your invite",
            NotificationKind.APPLICATION_APPROVED to "@ada approved your application",
            NotificationKind.APPLICATION_REJECTED to "@ada closed your application",
        )
        sentences.forEach { (kind, sentence) -> assertThat(notificationRow(row(kind)).title).isEqualTo(sentence) }
        // NT-G3(b): a citation of the reader's comment.
        assertThat(notificationRow(row(NotificationKind.CITATION, context = NotificationContext.Comment("c9"))).title)
            .isEqualTo("@ada cited your comment")
    }

    @Test
    fun `comment and reply rows carry the words that arrived`() {
        val words = comment("c1", "The third headland light is real —\nI have a print.")
        val got = notificationRow(row(NotificationKind.REPLY, NotificationSubject.Content(words)))
        assertThat(got.second).isEqualTo("The third headland light is real — I have a print.")
        // NT-G3(c): a wordless comment carries no second line.
        val wordless = row(NotificationKind.COMMENT, NotificationSubject.Content(comment("c2", "")))
        assertThat(notificationRow(wordless).second).isNull()
    }

    @Test
    fun `mention and citation rows read in the carrying title`() {
        val carrying = NotificationSubject.Content(post("p2", "Salt maps of the coast road"))
        val titled = row(NotificationKind.MENTION, carrying)
        assertThat(notificationRow(titled).second).isEqualTo("in Salt maps of the coast road")
        val untitled = row(
            NotificationKind.CITATION,
            NotificationSubject.Content(post("p3", null, "Sunday at the tide market\nmore words")),
        )
        assertThat(notificationRow(untitled).second).isEqualTo("in Sunday at the tide market")
        // NT-G3(a): a comment carrying it reads its thread's post.
        val byComment = row(NotificationKind.MENTION, NotificationSubject.Content(comment("c2", "hey")))
        assertThat(notificationRow(byComment).second).isEqualTo("in Salt maps of the coast road")
    }

    @Test
    fun `the opinion row wears the face with no digits and no second line`() {
        val opinion = notificationRow(
            row(
                NotificationKind.PROFILE_OPINION,
                pair = NotificationPair(0.4, 0.5),
                actor = NotificationActor("a1", "sol", text("Sol"), "https://media/sol.jpg"),
            ),
        )
        assertThat(opinion.disc).isEqualTo(NotificationDisc.Face(0.4, 0.5))
        assertThat(opinion.second).isNull()
        assertThat(opinion.title).doesNotContainMatch("\\d")
    }

    @Test
    fun `the approvable row wears the monogram never a picture`() {
        val ready = notificationRow(
            row(
                NotificationKind.APPLICATION_APPROVABLE,
                actor = NotificationActor("a1", "rafa", text("Rafa"), "https://media/rafa.jpg"),
            ),
        )
        assertThat(ready.disc).isEqualTo(NotificationDisc.Monogram("rafa"))
    }

    @Test
    fun `a deleted actor reads a deleted account with the reserved disc`() {
        val gone = notificationRow(
            row(NotificationKind.COMMENT, actor = NotificationActor("a1", "", text(null, FieldStatus.REDACTED), null)),
        )
        assertThat(gone.title).isEqualTo("A deleted account commented on your post")
        assertThat(gone.disc).isEqualTo(NotificationDisc.Redacted)
        assertThat(gone.deleted).isTrue()
    }

    @Test
    fun `rows land where the board sends them`() {
        assertThat(notificationRow(row(NotificationKind.REPLY, NotificationSubject.Content(comment("c7", "x")))).target)
            .isEqualTo(NotificationTarget.Comment("p1", "c7"))
        assertThat(notificationRow(row(NotificationKind.MENTION, NotificationSubject.Content(post("p2", "A")))).target)
            .isEqualTo(NotificationTarget.Post("p2"))
        val people = listOf(
            NotificationKind.PROFILE_OPINION,
            NotificationKind.INVITE_LANDED,
            NotificationKind.APPLICATION_APPROVED,
        )
        people.forEach { kind ->
            assertThat(notificationRow(row(kind)).target).isEqualTo(NotificationTarget.Person("ada"))
        }
        assertThat(notificationRow(row(NotificationKind.APPLICATION_APPROVABLE)).target)
            .isEqualTo(NotificationTarget.Invites)
        // NT-G4 (a): the reader's own feed as it stands.
        assertThat(notificationRow(row(NotificationKind.APPLICATION_REJECTED)).target)
            .isEqualTo(NotificationTarget.OwnFeed)
    }

    @Test
    fun `back returns to the bells root with its label`() {
        assertThat(BellRoot.FEED.backLabel).isEqualTo("Back to feed")
        assertThat(BellRoot.EXPLORE.backLabel).isEqualTo("Back to Explore")
        assertThat(BellRoot.WALLET.backLabel).isEqualTo("Back to Wallet")
        assertThat(BellRoot.PROFILE.backLabel).isEqualTo("Back to your profile")
    }
}
