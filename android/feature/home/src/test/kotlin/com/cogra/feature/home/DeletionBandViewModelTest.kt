package com.cogra.feature.home

import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.deletion.DeletionStanding
import com.cogra.domain.testing.ScriptedAccountDeletionRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class DeletionBandViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val deletions = ScriptedAccountDeletionRepository()
    private val state = AccountDeletionState(deletions)
    private val now = Instant.parse("2026-10-07T12:00:00Z")
    private val grace = AccountDeletion(now.plusSeconds(6 * 86_400), includesContent = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    private fun viewModel() = DeletionBandViewModel(state).also { it.clock = { now } }

    @Test
    fun `a_signed_in_reader_in_the_grace_sees_the_band`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onSession(signedIn = true)
        idle()
        assertThat(vm.state.value.deletion).isEqualTo(grace)
        assertThat(vm.state.value.now).isEqualTo(now)
    }

    @Test
    fun `nothing_confirmed_draws_no_band`() = runTest(dispatcher) {
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, null))
        val vm = viewModel()
        vm.onSession(signedIn = true)
        idle()
        assertThat(vm.state.value.deletion).isNull()
    }

    @Test
    fun `a_signed_out_reader_reads_nothing_and_the_account_is_forgotten`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onSession(signedIn = true)
        idle()
        vm.onSession(signedIn = false)
        idle()
        assertThat(vm.state.value.deletion).isNull()
        assertThat(state.standing.value).isNull()
        val reads = deletions.standingReads
        vm.refresh()
        idle()
        assertThat(deletions.standingReads).isEqualTo(reads)
    }

    @Test
    fun `cancel_takes_the_band_away_and_says_the_canceled_line`() = runTest(dispatcher) {
        val vm = viewModel()
        val lines = mutableListOf<Int>()
        val collecting = launch { vm.snackbars.toList(lines) }
        vm.onSession(signedIn = true)
        idle()
        vm.onCancel()
        idle()
        assertThat(vm.state.value.deletion).isNull()
        assertThat(lines).containsExactly(R.string.deletion_canceled)
        collecting.cancel()
    }

    @Test
    fun `a_cancel_with_no_answer_keeps_the_band_and_says_the_network_error`() = runTest(dispatcher) {
        deletions.cancel = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        val lines = mutableListOf<Int>()
        val collecting = launch { vm.snackbars.toList(lines) }
        vm.onSession(signedIn = true)
        idle()
        vm.onCancel()
        idle()
        assertThat(vm.state.value.deletion).isEqualTo(grace)
        assertThat(lines).containsExactly(R.string.deletion_cancel_no_answer)
        collecting.cancel()
    }

    @Test
    fun `a_cancel_pressed_elsewhere_takes_this_band_away_too`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onSession(signedIn = true)
        idle()
        state.cancel()
        idle()
        assertThat(vm.state.value.deletion).isNull()
    }
}
