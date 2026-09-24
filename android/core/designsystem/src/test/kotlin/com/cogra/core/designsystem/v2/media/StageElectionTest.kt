package com.cogra.core.designsystem.v2.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * THE STAGE LAW, clause by clause (`design/readme.md`, "The feed-video
 * rulings — 2026-09-23"), asked of the pure decision with no composition in
 * the way. `ScrollStageTest` asks the same questions of a real scrolling
 * list.
 */
class StageElectionTest {

    private fun at(top: Float, visible: Float, page: Int = 0, veiled: Boolean = false) =
        StagePlace(top = top, page = page, visible = visible, veiled = veiled)

    // (a) Incumbency.

    @Test
    fun anIncumbentThatStillQualifiesKeepsTheStageAgainstAClipAboveIt() {
        val places = mapOf(ABOVE to at(top = 0f, visible = 1f), INCUMBENT to at(top = 500f, visible = 0.8f))

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(INCUMBENT)
    }

    @Test
    fun aSecondClipArrivingFullyInViewChangesNothing() {
        val places = mapOf(INCUMBENT to at(top = 0f, visible = 0.7f), BELOW to at(top = 600f, visible = 1f))

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(INCUMBENT)
    }

    @Test
    fun theGateItselfStillQualifies() {
        val places = mapOf(
            ABOVE to at(top = 0f, visible = 1f),
            INCUMBENT to at(top = 500f, visible = StageElection.GATE),
        )

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(INCUMBENT)
    }

    // (b) Instant succession.

    @Test
    fun anIncumbentBelowTheGateHandsTheStageToTheTopmostQualifyingClip() {
        val places = mapOf(
            INCUMBENT to at(top = -400f, visible = 0.69f),
            BELOW to at(top = 300f, visible = 1f),
            FURTHER to at(top = 900f, visible = 0.9f),
        )

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(BELOW)
    }

    @Test
    fun anIncumbentThatLeftTheListHandsTheStageOn() {
        val places = mapOf(BELOW to at(top = 300f, visible = 1f))

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(BELOW)
    }

    @Test
    fun anIncumbentBelowTheGateWithNoSuccessorLeavesTheStageEmpty() {
        val places = mapOf(INCUMBENT to at(top = -400f, visible = 0.3f), BELOW to at(top = 900f, visible = 0.5f))

        assertThat(StageElection.elect(INCUMBENT, places)).isNull()
    }

    // (c) Topmost when empty.

    @Test
    fun anEmptyStageGoesToTheTopmostQualifyingClipNotTheMostVisible() {
        val places = mapOf(
            BELOW to at(top = 700f, visible = 1f),
            ABOVE to at(top = 0f, visible = 0.75f),
            FURTHER to at(top = 1400f, visible = 0.2f),
        )

        assertThat(StageElection.elect(null, places)).isEqualTo(ABOVE)
    }

    @Test
    fun clipsSideBySideInOneGalleryRankByTheirPage() {
        val places = mapOf(
            BELOW to at(top = 100f, visible = 1f, page = 1),
            ABOVE to at(top = 100f, visible = 1f, page = 0),
        )

        assertThat(StageElection.elect(null, places)).isEqualTo(ABOVE)
    }

    @Test
    fun aClipAboveTheTopOfTheScreenIsStillTopmostWhileItQualifies() {
        val places = mapOf(ABOVE to at(top = -50f, visible = 0.9f), BELOW to at(top = 600f, visible = 1f))

        assertThat(StageElection.elect(null, places)).isEqualTo(ABOVE)
    }

    // (d) Nothing qualifies, nothing plays.

    @Test
    fun nothingQualifyingMeansNothingPlays() {
        val places = mapOf(ABOVE to at(top = -300f, visible = 0.4f), BELOW to at(top = 900f, visible = 0.69f))

        assertThat(StageElection.elect(null, places)).isNull()
    }

    @Test
    fun aSurfaceWithoutClipsHasNobodyOnStage() {
        assertThat(StageElection.elect<String>(null, emptyMap())).isNull()
        assertThat(StageElection.elect(INCUMBENT, emptyMap())).isNull()
    }

    // The veil (jakob 2026-09-24, backlog item 103): a veiled clip is out of
    // the rotation. The unveil is an eligibility change, not a re-election
    // (jakob 2026-09-24, correcting a first build that decided the stage from
    // empty on unveil, as a sheet's dismissal does): an unveiled clip joins
    // the rotation exactly as a clip scrolling into view, covered by the
    // ordinary incumbency clause (a) above.

    @Test
    fun aVeiledClipIsNeverElectedHoweverMuchOfItShows() {
        val places = mapOf(
            ABOVE to at(top = 0f, visible = 1f, veiled = true),
            BELOW to at(top = 600f, visible = 0.8f),
        )

        assertThat(StageElection.elect(null, places)).isEqualTo(BELOW)
        assertThat(StageElection.elect(null, places - BELOW)).isNull()
    }

    @Test
    fun anIncumbentTheVeilFallsOverSurrendersTheStage() {
        val places = mapOf(
            INCUMBENT to at(top = 0f, visible = 1f, veiled = true),
            BELOW to at(top = 600f, visible = 0.8f),
        )

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(BELOW)
    }

    /**
     * NOT A SUSPENSION LIFT: unlike a sheet's dismissal, an unveil never
     * decides the stage from empty — even a topmost, freshly-unveiled clip
     * changes nothing while the incumbent still qualifies. `VeiledStageTest`
     * pins the same law through the real veil composables.
     */
    @Test
    fun anUnveiledClipChangesNothingWhileTheIncumbentQualifies() {
        val places = mapOf(
            ABOVE to at(top = 0f, visible = 0.8f),
            INCUMBENT to at(top = 400f, visible = 0.9f),
            BELOW to at(top = 900f, visible = 0.3f),
        )

        assertThat(StageElection.elect(INCUMBENT, places)).isEqualTo(INCUMBENT)
    }

    private companion object {
        const val ABOVE = "above"
        const val INCUMBENT = "incumbent"
        const val BELOW = "below"
        const val FURTHER = "further"
    }
}
