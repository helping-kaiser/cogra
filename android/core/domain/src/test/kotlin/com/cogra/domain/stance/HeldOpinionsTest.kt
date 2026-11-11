// The opinions page's fold (ProfileStances.md:19, :25; held-opinions.ts, the
// web's twin): records in, one row per person out, strongest first.

package com.cogra.domain.stance

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class HeldOpinionsTest {

    private fun holder(handle: String?) = OpinionHolder(
        actorId = handle?.let { "id-$it" },
        handle = handle,
        displayName = null,
        avatarUrl = null,
        redacted = false,
    )

    private fun record(
        holder: String,
        d: Double,
        i: Double,
        epoch: Int = 1,
        position: Int = 0,
        severed: Boolean? = false,
        marked: Boolean = false,
        handle: String? = holder,
    ) = OpinionRecord(
        holderId = "addr-$holder",
        holder = holder(handle),
        pDirected = d,
        pInterest = i,
        severed = severed,
        payloadMarked = marked,
        landingEpoch = epoch,
        position = position,
    )

    @Test
    fun `a person's several records are one bundle and one row`() {
        val rows = foldHeldOpinions(
            listOf(
                record("ada", 0.4, 0.2, epoch = 1),
                record("ada", 0.3, 0.1, epoch = 2),
                record("ada", -0.1, 0.0, epoch = 3),
            ),
        )
        assertThat(rows).hasSize(1)
        assertThat(rows.single().pair).isEqualTo(StancePair(0.6, 0.3))
    }

    @Test
    fun `the sum is exact decimal and clipped once at the end`() {
        // 1.1 − 1 − 0.1 is 8.3e-17 in floating point; the fold reads it as zero.
        val zero = foldHeldOpinions(listOf(record("a", 1.1, 0.0), record("a", -1.0, 0.0), record("a", -0.1, 0.0)))
        assertThat(zero.single().pair.pDirected).isEqualTo(0.0)
        val clipped = foldHeldOpinions(listOf(record("b", 0.8, 0.9), record("b", 0.7, 0.9)))
        assertThat(clipped.single().pair).isEqualTo(StancePair(1.0, 1.0))
    }

    @Test
    fun `rows stand strongest first, down past nothing into the ones held against`() {
        val rows = foldHeldOpinions(
            listOf(
                record("juno", -0.2, 0.1),
                record("kel", 0.0, 0.35),
                record("tobias", 0.7, 0.4),
                record("mira", 0.4, 0.5),
            ),
        )
        assertThat(rows.map { it.holder.handle }).containsExactly("tobias", "mira", "kel", "juno").inOrder()
    }

    @Test
    fun `equal values keep one fixed order, the reach then the address`() {
        val rows = foldHeldOpinions(listOf(record("b", 0.5, 0.1), record("c", 0.5, 0.1), record("a", 0.5, 0.3)))
        assertThat(rows.map { it.holderId }).containsExactly("addr-a", "addr-b", "addr-c").inOrder()
    }

    @Test
    fun `a payload-marked record folds into nothing`() {
        val rows = foldHeldOpinions(listOf(record("a", 0.5, 0.5), record("a", 0.3, 0.3, marked = true)))
        assertThat(rows.single().pair).isEqualTo(StancePair(0.5, 0.5))
        assertThat(foldHeldOpinions(listOf(record("x", 0.5, 0.5, marked = true)))).isEmpty()
    }

    @Test
    fun `which zero a row speaks is the newest record's severed, whatever the arrival order`() {
        val walkedBack = foldHeldOpinions(
            listOf(
                record("a", -0.4, -0.2, epoch = 2, severed = true),
                record("a", 0.4, 0.2, epoch = 1, severed = false),
            ),
        )
        assertThat(walkedBack.single().severed).isTrue()
        val saysNothing = foldHeldOpinions(listOf(record("b", 0.0, 0.0, severed = null)))
        assertThat(saysNothing.single().severed).isFalse()
    }

    @Test
    fun `the holder is drawn as the newest record served them`() {
        val rows = foldHeldOpinions(
            listOf(
                record("a", 0.1, 0.1, epoch = 1, handle = "old"),
                record("a", 0.1, 0.1, epoch = 1, position = 2, handle = "new"),
            ),
        )
        assertThat(rows.single().holder.handle).isEqualTo("new")
    }

    @Test
    fun `inside one epoch the later position is the newest record, wherever it sits in the page`() {
        val later = record("ada", 0.1, 0.1, epoch = 1, position = 2, severed = true, handle = "ada-new")
        val earlier = record("ada", 0.1, 0.1, epoch = 1, position = 1, severed = false, handle = "ada-old")
        listOf(listOf(later, earlier), listOf(earlier, later)).forEach { page ->
            val row = foldHeldOpinions(page).single()
            assertThat(row.severed).isTrue()
            assertThat(row.holder).isEqualTo(later.holder)
        }
    }
}
