// The citing-artifacts fold (CitedBy.md:7, :9): the web's own cases
// (`web/src/lib/references/citing-fold.test.ts`), same inputs, same expected
// values, so both clients draw one list.

package com.cogra.domain.references

import com.cogra.domain.stance.StancePair
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class CitingFoldTest {

    private var clock = 0

    private fun record(
        authorId: String,
        artifact: String,
        pDirected: Double,
        pInterest: Double,
        landingEpoch: Int = 1,
        payloadMarked: Boolean = false,
    ): CitingRecord<String> {
        clock += 1
        return CitingRecord(
            id = "r$clock",
            authorId = authorId,
            targetId = artifact,
            target = artifact,
            pDirected = pDirected,
            pInterest = pInterest,
            payloadMarked = payloadMarked,
            landingEpoch = landingEpoch,
            position = clock,
        )
    }

    @Test
    fun `draws a revised citation once, at the net of its records`() {
        val rows = foldCitingArtifacts(listOf(record("sol", "p1", 0.4, 0.2), record("sol", "p1", 0.3, 0.3)))
        assertThat(rows).hasSize(1)
        assertThat(rows.single().pair).isEqualTo(StancePair(0.7, 0.5))
    }

    @Test
    fun `drops a withdrawn citation — its records net to (0, 0)`() {
        val rows = foldCitingArtifacts(
            listOf(
                record("sol", "p1", 0.4, 0.2),
                record("sol", "p1", -0.4, -0.2),
                record("ada", "c1", 0.4, 0.65),
            ),
        )
        assertThat(rows.map { it.target }).containsExactly("c1")
    }

    @Test
    fun `keeps two artifacts by one author as two citations`() {
        val rows = foldCitingArtifacts(listOf(record("sol", "p1", 0.4, 0.2), record("sol", "p2", 0.1, 0.9)))
        assertThat(rows.map { it.target }).containsExactly("p2", "p1").inOrder()
    }

    @Test
    fun `stands newest first, by each citation's newest act`() {
        val rows = foldCitingArtifacts(
            listOf(
                record("sol", "p1", 0.4, 0.2, landingEpoch = 1),
                record("ada", "p2", 0.1, 0.9, landingEpoch = 2),
                record("sol", "p1", 0.1, 0.1, landingEpoch = 3),
            ),
        )
        assertThat(rows.map { it.target }).containsExactly("p1", "p2").inOrder()
    }

    @Test
    fun `leaves payload-marked records out`() {
        assertThat(foldCitingArtifacts(listOf(record("sol", "p1", 0.4, 0.2, payloadMarked = true)))).isEmpty()
    }
}
