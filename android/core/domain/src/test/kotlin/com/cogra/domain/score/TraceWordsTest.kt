// The trace's words and figures, read off one answer (FeedEntry.md,
// RankPath.md, RankHop.md, RankRecords.md; copy-voice, *The score drill-down*).
// Names follow the packet's test list (score-readout §9); the web's twin is
// `trace-model.test.ts`, and both say the same words.

package com.cogra.domain.score

import com.cogra.domain.testing.TraceCast
import com.cogra.domain.testing.TraceCast.MIRA
import com.cogra.domain.testing.TraceCast.NOW
import com.cogra.domain.testing.TraceCast.POST_CREATED
import com.cogra.domain.testing.TraceCast.SOL
import com.cogra.domain.testing.TraceCast.borrowedAnswer
import com.cogra.domain.testing.TraceCast.clippedAnswer
import com.cogra.domain.testing.TraceCast.ownAnswer
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class TraceWordsTest {

    private val own = TraceContext(
        viewer = SOL.id,
        borrowed = false,
        named = TraceCast.NAMED,
        targetKind = TraceThingKind.POST,
        targetCreatedAt = POST_CREATED,
        now = NOW,
    )
    private val borrowed = own.copy(viewer = MIRA.id, borrowed = true)

    private fun cents(value: String): Long = roundCents(value.replace("−", "-").toDouble())

    private fun LevelOne.sum(): Long = drawn.sumOf { cents(it.value) } + (more?.let { cents(it.value) } ?: 0L)

    // ── Level one ────────────────────────────────────────────────────────

    @Test
    fun `the strongest four stand drawn and the rest ride one quiet row`() {
        val level = ownAnswer().levelOne(unfolded = false)
        assertThat(level.drawn.map { it.value }).containsExactly("+6.80", "+4.20", "+2.60", "+1.10").inOrder()
        assertThat(level.more).isEqualTo(MorePaths(2, "+0.50"))
        assertThat(morePathsLabel(2)).isEqualTo("2 more paths")
        assertThat(morePathsLabel(1)).isEqualTo("1 more path")
    }

    @Test
    fun `the drawn paths and the quiet row add up to the trace's own score, folded or not`() {
        assertThat(ownAnswer().levelOne(unfolded = false).sum()).isEqualTo(1520L)
        val unfolded = ownAnswer().levelOne(unfolded = true)
        assertThat(unfolded.more).isNull()
        assertThat(unfolded.drawn).hasSize(6)
        assertThat(unfolded.sum()).isEqualTo(1520L)
    }

    @Test
    fun `a trace whose figure differs from the card's sums to its own figure`() {
        // The card wore 15.20 from the feed fetch; the live paths sum to 14.70.
        val base = ownAnswer()
        val live = TraceAnswer(14.7, base.paths.mapIndexed { i, p -> if (i == 0) p.copy(contribution = 6.3) else p })
        assertThat(live.levelOne(unfolded = false).sum()).isEqualTo(1470L)
    }

    @Test
    fun `the paths stand in extraction order, never re-sorted`() {
        val base = ownAnswer().paths
        val answer = TraceAnswer(1.0, listOf(base[0].copy(contribution = -0.5), base[1].copy(contribution = 1.5)))
        assertThat(answer.levelOne(unfolded = false).drawn.map { it.value }).containsExactly("−0.50", "+1.50").inOrder()
    }

    @Test
    fun `a path reads the same value on the list and on its own level`() {
        assertThat(ownAnswer().pathValue(0)).isEqualTo("+6.80")
        assertThat(ownAnswer().pathValue(5)).isEqualTo("+0.20")
    }

    @Test
    fun `the note names the view the paths start from`() {
        assertThat(levelOneNote(own, null)).isEqualTo("Every path here starts with an opinion you gave.")
        assertThat(levelOneNote(borrowed, "mira")).isEqualTo("Every path here starts with an opinion @mira gave.")
    }

    // ── A path's trace ───────────────────────────────────────────────────

    @Test
    fun `the path trace speaks you, then the handle, then what reached you`() {
        val ada = ownAnswer().paths[0]
        assertThat(spokenTrace(ada, own)).isEqualTo("You, then @ada, then what reached you")
        assertThat(throughLine(ada, own)).isEqualTo("Through @ada")
        assertThat(pathPeople(ada).map { it?.handle }).containsExactly("sol", "ada").inOrder()
    }

    @Test
    fun `a multi-hop trace speaks several steps`() {
        val kelWren = ownAnswer().paths[3]
        assertThat(spokenTrace(kelWren, own)).isEqualTo("You, then several steps, then what reached you")
        assertThat(throughLine(kelWren, own)).isEqualTo("Through @kel and @wren")
    }

    @Test
    fun `a borrowed trace leads with the lender's handle, never You`() {
        assertThat(spokenTrace(borrowedAnswer().paths[0], borrowed))
            .isEqualTo("@mira, then @ada, then what reached you")
    }

    // ── Level two ────────────────────────────────────────────────────────

    @Test
    fun `each family reads its drawn step title — opinion and publish`() {
        val ada = ownAnswer().paths[0]
        val steps = ada.steps()
        assertThat(steps).hasSize(2)
        assertThat(stepTitle(ada, steps[0], own)).isEqualTo("Your opinion of @ada")
        assertThat(stepTitle(ada, steps[1], own)).isEqualTo("@ada published it")
    }

    @Test
    fun `a borrowed step reads in the third person`() {
        val lent = borrowedAnswer().paths[0]
        assertThat(stepTitle(lent, lent.steps()[0], borrowed)).isEqualTo("@mira's opinion of @ada")
    }

    @Test
    fun `the second line counts the opinions behind it, and the author's publish says whose rides the post`() {
        val ada = ownAnswer().paths[0]
        val steps = ada.steps()
        assertThat(stepSecondLine(ada, steps[0], own)).isEqualTo("2 opinions behind it")
        assertThat(stepSecondLine(ada, steps[1], own)).isEqualTo("@ada's own opinion rides the post")
    }

    @Test
    fun `the author's publish is a step aged as the post, and the path's newest age is its last step's`() {
        val ada = ownAnswer().paths[0]
        assertThat(stepAge(ada, ada.steps()[1], own)).isEqualTo("2h")
        assertThat(pathNewest(ada, own)).isEqualTo("2h")
        assertThat(stepAge(ada, ada.steps()[0], own)).isEqualTo("8d")
    }

    @Test
    fun `a two-legged record reads as one step naming what it passed`() {
        val review = TraceCast.reviewPath()
        val steps = review.steps()
        assertThat(steps).hasSize(2)
        assertThat(steps[1].through).containsExactly(2)
        assertThat(stepTitle(review, steps[1], own)).isEqualTo("@ada replied to it")
    }

    @Test
    fun `a T-leg hop shows the T leg's pair, not the actor's`() {
        val review = TraceCast.reviewPath()
        val pairs = memberPairs(review, review.steps()[1]).map { it.pDirected to it.pInterest }
        assertThat(pairs).containsExactly(0.3 to 0.1)
    }

    // ── Level three ──────────────────────────────────────────────────────

    @Test
    fun `the note names the step by its title and its place`() {
        assertThat(placeNote("Your opinion of @ada", 1, 2))
            .isEqualTo("Your opinion of @ada — the first of this path's two steps.")
        assertThat(placeNote("Your opinion of @ada", 1, 1)).isEqualTo("Your opinion of @ada — this path's one step.")
    }

    @Test
    fun `the fold's note reads in the reader's own word, with the pad`() {
        val ada = ownAnswer().paths[0]
        assertThat(foldNote(ada, ada.steps()[0], own)).isEqualTo(
            "You have given @ada two opinions. They add up to one, and that one is what carries — " +
                "the same adding up the pad shows you as your current opinion.",
        )
    }

    @Test
    fun `another person's fold note names them and leaves the pad out`() {
        val lent = borrowedAnswer().paths[0]
        assertThat(foldNote(lent, lent.steps()[0], borrowed))
            .isEqualTo("@mira has given @ada two opinions. They add up to one, and that one is what carries.")
    }

    @Test
    fun `a clipped step says it carries the limit`() {
        val clipped = clippedAnswer().paths[0]
        val step = clipped.steps()[0]
        assertThat(memberSum(clipped, step).clipped).isTrue()
        assertThat(foldNote(clipped, step, own))
            .endsWith(" Added up, they go past the limit an opinion can reach, so the step carries the limit.")
        val ada = ownAnswer().paths[0]
        assertThat(memberSum(ada, ada.steps()[0]).clipped).isFalse()
    }

    // ── Level four ───────────────────────────────────────────────────────

    @Test
    fun `the records open under the line naming their step`() {
        assertThat(recordsNote("Your opinion of @ada", 2)).isEqualTo("The two records behind your opinion of @ada.")
        assertThat(recordsNote("@mira's opinion of @ada", 2))
            .isEqualTo("The two records behind @mira's opinion of @ada.")
        assertThat(recordsNote("Your opinion of @ada", 1)).isEqualTo("The record behind your opinion of @ada.")
    }

    @Test
    fun `the records' pairs add up to the step's pair`() {
        val ada = ownAnswer().paths[0]
        val first = ada.steps()[0]
        val sum = memberSum(ada, first)
        assertThat(sum.pDirected).isWithin(1e-9).of(first.carrying.pDirected)
        assertThat(sum.pInterest).isWithin(1e-9).of(first.carrying.pInterest)
    }

    @Test
    fun `a record older than thirty days wears a date`() {
        val records = ownAnswer().paths[0].hops[0].records
        assertThat(recordAge(records[0], NOW)).isEqualTo("8d")
        assertThat(recordAge(records[1], NOW)).matches("\\d\\d\\.\\d\\d\\.\\d{4}")
    }

    @Test
    fun `the floor's lines are the drawn ones`() {
        assertThat(CLIPPED_RECORDS)
            .isEqualTo("Added up, these go past the limit an opinion can reach, so the step carries the limit.")
        assertThat(PUBLIC_SUM_LINE)
            .isEqualTo("These records are public. Anyone can run the same sum and land on the same number.")
    }
}
