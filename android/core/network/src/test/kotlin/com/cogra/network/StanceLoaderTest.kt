// The coalescing loader alone, over a scripted dispatch: the reads one window
// holds leave as one dispatch of their distinct ids; a read after the batch
// left joins the next one; a lane is its own batch; a dispatch that throws
// answers every read with the fault; an asker that stops waiting stops no one.

package com.cogra.network

import com.cogra.network.repo.COALESCE_WINDOW_MS
import com.cogra.network.repo.StanceLane
import com.cogra.network.repo.StanceLoader
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test

class StanceLoaderTest {

    private val lane = StanceLane(owner = "account-a", includePending = true)

    /** Every dispatch's ids, in order. */
    private val dispatched = mutableListOf<List<String>>()

    private fun TestScope.loader(
        answer: suspend (List<String>) -> Map<String, String> = { ids -> ids.associateWith { "face of $it" } },
    ) = StanceLoader(
        backgroundScope,
        dispatch = { _, ids ->
            dispatched += ids
            answer(ids)
        },
        fault = { "fault: ${it.message}" },
    )

    @Test
    fun theReadsOneWindowHoldsLeaveAsOneDispatchOfTheirDistinctIds() = runTest {
        val loader = loader()

        val faces = listOf("a", "b", "a", "c").map { async { loader.load(lane, it) } }.awaitAll()

        assertThat(dispatched).containsExactly(listOf("a", "b", "c"))
        assertThat(faces).containsExactly("face of a", "face of b", "face of a", "face of c").inOrder()
    }

    @Test
    fun theBatchWaitsTheWindowForReadsArrivingAMomentLater() = runTest {
        val loader = loader()
        val first = async { loader.load(lane, "a") }
        advanceTimeBy(COALESCE_WINDOW_MS - 1)
        val second = async { loader.load(lane, "b") }

        listOf(first, second).awaitAll()

        assertThat(dispatched).containsExactly(listOf("a", "b"))
    }

    @Test
    fun aReadAskedAfterTheBatchLeftJoinsTheNextOne() = runTest {
        val gate = CompletableDeferred<Unit>()
        val loader = loader { ids ->
            if (ids == listOf("a")) gate.await()
            ids.associateWith { "face of $it" }
        }
        val first = async { loader.load(lane, "a") }
        advanceTimeBy(COALESCE_WINDOW_MS + 1)
        runCurrent()

        // The first batch is in flight: a re-read after an act asks after it.
        val again = async { loader.load(lane, "a") }
        gate.complete(Unit)

        assertThat(listOf(first, again).awaitAll()).containsExactly("face of a", "face of a")
        assertThat(dispatched).containsExactly(listOf("a"), listOf("a")).inOrder()
    }

    @Test
    fun eachLaneIsItsOwnBatch() = runTest {
        val loader = loader()

        listOf(
            async { loader.load(lane, "a") },
            async { loader.load(lane.copy(owner = "account-b"), "b") },
            async { loader.load(lane.copy(includePending = false), "c") },
        ).awaitAll()

        assertThat(dispatched).containsExactly(listOf("a"), listOf("b"), listOf("c"))
    }

    @Test
    fun aDispatchThatThrowsAnswersEveryReadWithTheFault() = runTest {
        val loader = loader { error("the batch broke") }

        val faces = listOf("a", "b").map { async { loader.load(lane, it) } }.awaitAll()

        assertThat(faces).containsExactly("fault: the batch broke", "fault: the batch broke")
    }

    @Test
    fun anIdTheDispatchLeftOutIsAFaultNotAHang() = runTest {
        val loader = loader { ids -> mapOf(ids.first() to "face") }

        val faces = listOf("a", "b").map { async { loader.load(lane, it) } }.awaitAll()

        assertThat(faces).containsExactly("face", "fault: the batch did not answer b").inOrder()
    }

    @Test
    fun anAskerThatStopsWaitingStopsNoOtherRead() = runTest {
        val loader = loader()
        val leaving = async { loader.load(lane, "a") }
        val staying = async { loader.load(lane, "b") }
        runCurrent()

        // The first card's screen closed.
        leaving.cancel()

        assertThat(staying.await()).isEqualTo("face of b")
        assertThat(dispatched).containsExactly(listOf("a", "b"))
    }
}
