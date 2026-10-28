// History's list laws, each as a function (History.md:25, :105;
// HistoryFilter.md:5, :31; HistorySearch.md:3-23; History.md:41).

package com.cogra.domain.history

import com.cogra.domain.ActorRef
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class HistoryListTest {

    private val zone = ZoneId.of("Europe/Berlin")
    private val now = Instant.parse("2026-10-05T10:00:00Z")

    @Test
    fun `the filter kinds are the feed filter's own list in its order`() {
        assertThat(HISTORY_KINDS).containsExactly(FeedKind.POST, FeedKind.COMMENT, FeedKind.PROFILE, FeedKind.TAG)
            .inOrder()
    }

    @Test
    fun `the trigger reads Everything with no kind narrowed`() {
        assertThat(kindsReading(emptySet())).isEqualTo(KindsReading.Everything)
    }

    @Test
    fun `one narrowed kind reads its own name`() {
        assertThat(kindsReading(setOf(FeedKind.TAG))).isEqualTo(KindsReading.One(FeedKind.TAG))
    }

    @Test
    fun `some kinds read their count and every kind reads All kinds`() {
        assertThat(kindsReading(setOf(FeedKind.POST, FeedKind.PROFILE))).isEqualTo(KindsReading.Some(2))
        assertThat(kindsReading(HISTORY_KINDS.toSet())).isEqualTo(KindsReading.All)
    }

    @Test
    fun `a day divider reads Today, Yesterday, then the date`() {
        assertThat(historyDayLabel(Instant.parse("2026-10-05T07:00:00Z"), now, zone)).isEqualTo("Today")
        assertThat(historyDayLabel(Instant.parse("2026-10-04T12:00:00Z"), now, zone)).isEqualTo("Yesterday")
        assertThat(historyDayLabel(Instant.parse("2026-10-02T12:00:00Z"), now, zone)).isEqualTo("2 October")
    }

    @Test
    fun `the date carries its year only when it is not the current one`() {
        assertThat(historyDayLabel(Instant.parse("2025-12-31T12:00:00Z"), now, zone)).isEqualTo("31 December 2025")
    }

    @Test
    fun `days are the reader's own, in their zone`() {
        // 23:30 UTC on the 4th is already the 5th in Berlin.
        assertThat(historyDayLabel(Instant.parse("2026-10-04T23:30:00Z"), now, zone)).isEqualTo("Today")
    }

    @Test
    fun `a divider stands above the first thing of each day only`() {
        val seen = listOf(
            Instant.parse("2026-10-05T09:00:00Z"),
            Instant.parse("2026-10-05T08:00:00Z"),
            Instant.parse("2026-10-04T08:00:00Z"),
            Instant.parse("2026-10-02T08:00:00Z"),
            Instant.parse("2026-10-02T07:00:00Z"),
        )
        assertThat(historyDividers(seen, now, zone))
            .containsExactly("Today", null, "Yesterday", "2 October", null).inOrder()
    }

    @Test
    fun `the divider's key is its words, lowercased and dashed`() {
        assertThat(historyDayKey("Today")).isEqualTo("today")
        assertThat(historyDayKey("2 October")).isEqualTo("2-october")
        assertThat(historyDayKey("31 December 2025")).isEqualTo("31-december-2025")
    }

    @Test
    fun `every kind stands in its section`() {
        assertThat(HistoryCard.Person(testProfile()).section()).isEqualTo(HistorySection.PEOPLE)
        assertThat(HistoryCard.Tag(topic("saltmaps")).section()).isEqualTo(HistorySection.TAGS)
        assertThat(HistoryCard.Post(testPost("p")).section()).isEqualTo(HistorySection.CONTENT)
        assertThat(HistoryCard.Comment(testComment("c"), null, "p").section()).isEqualTo(HistorySection.CONTENT)
    }

    @Test
    fun `a hidden account's posts and comments leave and its profile card stays`() {
        val ada = ActorRef("u-ada", "ada")
        val entries = listOf(
            entry(HistoryCard.Post(testPost("p1", author = ada))),
            entry(HistoryCard.Comment(testComment("c1", author = ada), null, "p0")),
            entry(HistoryCard.Person(testProfile(id = "u-ada", handle = "ada"))),
            entry(HistoryCard.Tag(topic("saltmaps"))),
            entry(HistoryCard.Post(testPost("p2"))),
        )
        val shown = entries.unhidden { author, _ -> author == "u-ada" }
        assertThat(shown.map { it.id }).containsExactly("u-ada", "hashtag-saltmaps", "p2").inOrder()
    }

    @Test
    fun `a card whose hide did not go through stands`() {
        val ada = ActorRef("u-ada", "ada")
        val entries = listOf(entry(HistoryCard.Post(testPost("p1", author = ada))))
        // The hidden set answers per origin: the failed card is not hidden.
        val shown = entries.unhidden { author, origin -> author == "u-ada" && origin != "p1" }
        assertThat(shown.map { it.id }).containsExactly("p1")
    }

    @Test
    fun `a blank query narrows nothing`() {
        assertThat(historyNarrowing("  ")).isNull()
        assertThat(historyNarrowing(" mira ")).isEqualTo("mira")
    }

    @Test
    fun `a tagged post is named by its title, an untitled one by its first words`() {
        val at = Instant.EPOCH
        val titled = taggedPost(
            id = "p1",
            title = testModeratedField("Low tide"),
            content = testModeratedField("words"),
            mimeTypes = emptyList(),
            coverUrl = "c.jpg",
            authorHandle = "ada",
            createdAt = at,
        )
        assertThat(titled.title).isEqualTo("Low tide")
        assertThat(titled.coverUrl).isEqualTo("c.jpg")
        val words = testModeratedField("First\nsecond")
        val untitled = taggedPost("p2", testModeratedField(null), words, emptyList(), null, "ada", at)
        assertThat(untitled.title).isEqualTo("First")
    }

    @Test
    fun `a removed tagged thing reads the removal line with its tile emptied`() {
        val gone = ModeratedField(null, FieldStatus.REDACTED)
        val post = taggedPost("p1", gone, gone, emptyList(), "c.jpg", "ada", Instant.EPOCH)
        assertThat(post.title).isEqualTo("Removed by its author")
        assertThat(post.removed).isTrue()
        assertThat(post.coverUrl).isNull()
        val comment = taggedComment("c1", gone, "ada", Instant.EPOCH)
        assertThat(comment.title).isEqualTo("Removed by its author")
        assertThat(comment.comment).isTrue()
    }

    @Test
    fun `a tagged comment is named by its first line`() {
        val comment = taggedComment("c1", testModeratedField("Kinder at low tide\nthan noon"), "ada", Instant.EPOCH)
        assertThat(comment.title).isEqualTo("Kinder at low tide")
    }

    private fun entry(card: HistoryCard) = HistoryEntry(card, now)

    private fun topic(name: String) = TagCardTopic("hashtag-$name", testModeratedField(name), emptyList())
}
