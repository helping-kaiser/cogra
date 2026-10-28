package com.cogra.domain.removal

import com.cogra.domain.ActorRef
import com.cogra.domain.CommentView
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LandingState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.UserError
import com.cogra.domain.testing.ScriptedRemovalRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.time.Instant

/** The author's Remove: the request, the re-read, and the mark it always leaves (RemoveConfirm.md:11). */
class RemoveContentTest {

    private val repo = ScriptedRemovalRepository()
    private val marks = RemovedMarks()
    private val remove = RemoveContent(repo, marks)
    private val at = Instant.parse("2026-10-28T09:30:00Z")

    @Test
    fun aTakenRemovalNamesTheGenesisRecordAndRecordsTheReReadMark() = runTest {
        repo.readAnswers += Outcome.Success(Removal(at, RemovalAgent.AUTHOR))

        val outcome = remove(RemovalKind.Post, "p1", "rec:genesis")

        assertThat(repo.records).containsExactly("rec:genesis")
        assertThat(repo.reads).containsExactly(RemovalKind.Post to "p1")
        assertThat(outcome).isEqualTo(Outcome.Success(Removal(at, RemovalAgent.AUTHOR)))
        assertThat(marks.marks.value).containsExactly("p1", Removal(at, RemovalAgent.AUTHOR))
    }

    @Test
    fun aLostReReadStampsTheMarkFromTheRemovalsOwnAnswer() = runTest {
        repo.answers += Outcome.Success(at)
        repo.readAnswers += Outcome.Failed(IOException("gone"))

        val outcome = remove(RemovalKind.Comment, "c1", "rec:c1")

        assertThat(outcome).isEqualTo(Outcome.Success(Removal(at, RemovalAgent.AUTHOR)))
        assertThat(marks.marks.value["c1"]).isEqualTo(Removal(at, RemovalAgent.AUTHOR))
    }

    /** `records: []` is success: a still-settling node lands reduced, and the mark is stamped now. */
    @Test
    fun aStillSettlingNodeIsTakenAndStampedNowWhenNothingDatesIt() = runTest {
        val now = Instant.parse("2026-10-28T10:00:00Z")
        remove.now = { now }
        repo.answers += Outcome.Success(null)
        repo.readAnswers += Outcome.Success(null)

        val outcome = remove(RemovalKind.Post, "p1", "rec:p1")

        assertThat(outcome).isEqualTo(Outcome.Success(Removal(now, RemovalAgent.AUTHOR)))
    }

    @Test
    fun aRemovalThatDoesNotGoThroughRecordsNoMarkAndReadsNothing() = runTest {
        repo.answers += Outcome.Failed(IOException("offline"))
        val failed = remove(RemovalKind.Post, "p1", "rec:p1")
        repo.answers += Outcome.Refused(listOf(UserError(ErrorCode.FORBIDDEN, "not yours")))
        val refused = remove(RemovalKind.Post, "p1", "rec:p1")

        assertThat(failed).isInstanceOf(Outcome.Failed::class.java)
        assertThat(refused).isInstanceOf(Outcome.Refused::class.java)
        assertThat(repo.reads).isEmpty()
        assertThat(marks.marks.value).isEmpty()
    }

    @Test
    fun aMarkedPostReadsEveryFieldGoneAndKeepsItsSkeleton() {
        val mark = Removal(at, RemovalAgent.AUTHOR)
        val marked = post().marked(mapOf("p1" to mark))

        assertThat(marked.removal).isEqualTo(mark)
        assertThat(marked.title.status).isEqualTo(FieldStatus.REDACTED)
        assertThat(marked.content.value).isNull()
        assertThat(marked.attachments).isEmpty()
        assertThat(marked.topics).isEmpty()
        assertThat(marked.author).isEqualTo(post().author)
        assertThat(marked.commentCount).isEqualTo(2)
        assertThat(post().marked(mapOf("other" to mark))).isEqualTo(post())
    }

    /** The server's own mark is the truth; a remembered one never overwrites it. */
    @Test
    fun aNodeAlreadyMarkedKeepsItsOwnMark() {
        val served = Removal(at, RemovalAgent.ACCOUNT)
        val held = comment().withRemoval(served)

        assertThat(held.marked(mapOf("c1" to Removal(Instant.EPOCH, RemovalAgent.AUTHOR))).removal).isEqualTo(served)
        assertThat(held.replyCount).isEqualTo(3)
        assertThat(held.sensitiveReason).isNull()
    }

    private fun post() = PostView(
        id = "p1",
        title = ModeratedField("A title", FieldStatus.NORMAL),
        description = ModeratedField(null, FieldStatus.NORMAL),
        content = ModeratedField("Words", FieldStatus.NORMAL),
        author = ActorRef("u1", "sol", "Sol"),
        createdAt = Instant.EPOCH,
        updatedAt = Instant.EPOCH,
        landing = Landing(LandingState.LANDED, 1),
        license = LicenseChoice(0.0, 0.0),
        commentCount = 2,
    )

    private fun comment() = CommentView(
        id = "c1",
        content = ModeratedField("Words", FieldStatus.NORMAL),
        author = ActorRef("u1", "sol", "Sol"),
        createdAt = Instant.EPOCH,
        updatedAt = Instant.EPOCH,
        landing = Landing(LandingState.LANDED, 1),
        license = LicenseChoice(0.0, 0.0),
        replyCount = 3,
        sensitiveReason = "spoilers",
    )
}
