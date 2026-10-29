package com.cogra.feature.stance

import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.localLanding
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The holder's state as the control reads it — the landing's `empty` is the
 * trigger split's own reading (round 20, seam 245 ask 20), so the line under
 * the pick and the ask Set raises can never disagree.
 */
class StanceControlStateTest {

    private fun landingOver(records: Int, severed: Boolean) = TargetStance(
        pad = PadMode.STICKY,
        pick = StancePair.Origin,
        standingRaw = StancePair.Origin,
        standingRecords = records,
        standingSevered = severed,
        landing = localLanding(StancePair.Origin, StancePair.Origin),
    ).toControlState(coaching = false, inputMode = StanceInputMode.PAD).landing

    @Test
    fun aZeroLandingWithNoRecordIsTheEmptySigns() {
        assertThat(landingOver(records = 0, severed = false)?.empty).isTrue()
    }

    @Test
    fun aZeroLandingOverAWalkedBackBundleIsTheEmptySigns() {
        assertThat(landingOver(records = 2, severed = true)?.empty).isTrue()
    }

    // PadStanding.md (round 21): over the standing an empty sign left, a (0, 0)
    // landing is the walk-back's again — that record stands.
    @Test
    fun aZeroLandingOverAnEmptySignsStandingIsTheWalkBacks() {
        val landing = landingOver(records = 1, severed = false)
        assertThat(landing?.empty).isFalse()
        assertThat(landing?.severance).isTrue()
    }
}
