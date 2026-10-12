package com.cogra.domain.compose

import com.cogra.crypto.Family
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.WriteState
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.io.IOException

/** The sealed copy's decisions (FC-G5): what a write's fate is, and what a batch's fates ask. */
class SealedDraftTest {

    private fun read(state: WriteState): Outcome<StagedWriteView?> = Outcome.Success(
        StagedWriteView(
            id = "w1",
            state = state,
            family = Family.PUBLISH,
            canonicalProposal = ByteArray(0),
            verifiedAct = null,
            recordId = null,
        ),
    )

    @Test
    fun aWriteReadsLandedExpiredOrAliveByItsState() {
        assertThat(fateOf(read(WriteState.LANDED))).isEqualTo(StagedFate.Landed)
        assertThat(fateOf(read(WriteState.EXPIRED))).isEqualTo(StagedFate.Expired)
        assertThat(fateOf(read(WriteState.RELAYING))).isEqualTo(StagedFate.Alive)
        assertThat(fateOf(read(WriteState.UNKNOWN))).isEqualTo(StagedFate.Alive)
    }

    /** Only an expired row is ever deleted (the reap), so a vanished write was collected unlanded. */
    @Test
    fun aWriteTheServerNoLongerKnowsReadsExpired() {
        assertThat(fateOf(Outcome.Success(null))).isEqualTo(StagedFate.Expired)
    }

    @Test
    fun aReadThatDidNotAnswerDecidesNothing() {
        assertThat(fateOf(Outcome.Failed(IOException("offline")))).isEqualTo(StagedFate.Unknown)
    }

    @Test
    fun anyExpiredWriteRestoresEvenBesideALandedOne() {
        assertThat(sealVerdict(listOf(StagedFate.Landed, StagedFate.Expired))).isEqualTo(SealVerdict.Restore)
    }

    @Test
    fun onlyAWhollyLandedBatchPurges() {
        assertThat(sealVerdict(listOf(StagedFate.Landed, StagedFate.Landed))).isEqualTo(SealVerdict.Purge)
        assertThat(sealVerdict(listOf(StagedFate.Landed, StagedFate.Alive))).isEqualTo(SealVerdict.Wait)
        assertThat(sealVerdict(listOf(StagedFate.Landed, StagedFate.Unknown))).isEqualTo(SealVerdict.Wait)
        assertThat(sealVerdict(emptyList())).isEqualTo(SealVerdict.Wait)
    }
}
