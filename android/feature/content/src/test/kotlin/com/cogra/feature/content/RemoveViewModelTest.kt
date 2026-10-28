package com.cogra.feature.content

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.UserError
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.RemoveContent
import com.cogra.domain.removal.RemovedMarks
import com.cogra.domain.testing.ScriptedRemovalRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.time.Instant

/** The confirm's state holder: one removal in flight, its outcome per node (RemoveConfirm.md:7-13). */
@OptIn(ExperimentalCoroutinesApi::class)
class RemoveViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val repo = ScriptedRemovalRepository()
    private val marks = RemovedMarks()
    private lateinit var viewModel: RemoveViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        viewModel = RemoveViewModel(RemoveContent(repo, marks), marks)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun aTakenRemovalNamesTheGenesisRecordAndLeavesTheMarkBeforeItSaysTaken() = runTest(dispatcher) {
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        assertThat(viewModel.state.value.working).isEqualTo("p1")

        advanceUntilIdle()

        assertThat(repo.records).containsExactly("rec:p1")
        assertThat(viewModel.state.value).isEqualTo(RemoveUiState(taken = "p1"))
        assertThat(viewModel.marks.value["p1"]).isEqualTo(Removal(repo.removedAt, RemovalAgent.AUTHOR))
        viewModel.takenConsumed()
        assertThat(viewModel.state.value.taken).isNull()
    }

    /** WHEN press Remove -> Remove refuses a second press until the removal answers. */
    @Test
    fun aSecondPressWhileInFlightSendsNothing() = runTest(dispatcher) {
        val hold = CompletableDeferred<Unit>()
        repo.hold = hold
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        advanceUntilIdle()
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        viewModel.remove(RemovalKind.Comment, "c1", "rec:c1")
        hold.complete(Unit)
        advanceUntilIdle()

        assertThat(repo.records).containsExactly("rec:p1")
    }

    /** `records: []` is success: a still-settling node is taken, and marked. */
    @Test
    fun aStillSettlingNodesEmptyAnswerIsTaken() = runTest(dispatcher) {
        repo.answers += Outcome.Success(null)
        viewModel.remove(RemovalKind.Comment, "c1", "rec:c1")
        advanceUntilIdle()

        assertThat(viewModel.state.value.taken).isEqualTo("c1")
        assertThat(viewModel.marks.value).containsKey("c1")
    }

    /** WHEN the removal does not go through -> the node is not marked, and its dialog reads the failure. */
    @Test
    fun anyNonSuccessIsOneFailureAndNoMark() = runTest(dispatcher) {
        repo.answers += Outcome.Failed(IOException("offline"))
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        advanceUntilIdle()
        assertThat(viewModel.state.value).isEqualTo(RemoveUiState(failed = setOf("p1")))

        repo.answers += Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "carried")))
        viewModel.remove(RemovalKind.Comment, "c1", "rec:c1")
        advanceUntilIdle()

        assertThat(viewModel.state.value.failed).containsExactly("p1", "c1")
        assertThat(viewModel.marks.value).isEmpty()
    }

    /** Retry clears the line while it sends, and a taken retry leaves no failure behind. */
    @Test
    fun aRetryThatGoesThroughClearsTheFailure() = runTest(dispatcher) {
        repo.answers += Outcome.Failed(IOException("offline"))
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        advanceUntilIdle()

        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        assertThat(viewModel.state.value.failed).isEmpty()
        advanceUntilIdle()

        assertThat(viewModel.state.value).isEqualTo(RemoveUiState(taken = "p1"))
        assertThat(repo.records).hasSize(2)
    }

    /** A node read without its genesis record cannot be named: never a removal pretended. */
    @Test
    fun aNodeWithoutItsRecordReadsAsNotThrough() = runTest(dispatcher) {
        viewModel.remove(RemovalKind.Post, "p1", null)
        advanceUntilIdle()

        assertThat(repo.records).isEmpty()
        assertThat(viewModel.state.value.failed).containsExactly("p1")
    }

    @Test
    fun keepingTheDialogDropsItsFailureLine() = runTest(dispatcher) {
        repo.answers += Outcome.Failed(IOException("offline"))
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        advanceUntilIdle()
        viewModel.dismissed("p1")

        assertThat(viewModel.state.value.failed).isEmpty()
    }

    /** The re-read's answer is the mark; a lost re-read stamps it from the removal's own moment. */
    @Test
    fun theMarkIsTheReReadsOrTheRemovalsOwnMoment() = runTest(dispatcher) {
        val stamped = Instant.parse("2026-10-28T08:00:00Z")
        repo.answers += Outcome.Success(stamped)
        repo.readAnswers += Outcome.Failed(IOException("lost"))
        viewModel.remove(RemovalKind.Post, "p1", "rec:p1")
        advanceUntilIdle()

        assertThat(viewModel.marks.value["p1"]).isEqualTo(Removal(stamped, RemovalAgent.AUTHOR))
    }
}
