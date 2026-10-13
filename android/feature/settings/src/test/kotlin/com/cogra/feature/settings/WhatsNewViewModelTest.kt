package com.cogra.feature.settings

import com.cogra.domain.Outcome
import com.cogra.domain.release.Release
import com.cogra.domain.release.RunningVersion
import com.cogra.domain.testing.ScriptedReleaseRegistry
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class WhatsNewViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private val one = Release("0.1.0", listOf("First"), "https://example.test/v0.1.0", Instant.EPOCH)

    @Test
    fun theReadPlacesTheRunningVersion() = runTest {
        val vm = WhatsNewViewModel(ScriptedReleaseRegistry(Outcome.Success(listOf(one))), RunningVersion("0.1.0"))
        assertThat(vm.state.value).isEqualTo(WhatsNewUiState.Ready(listOf(one), "0.1.0"))
    }

    @Test
    fun aFailedReadIsTheTransportLine() = runTest {
        val offline = ScriptedReleaseRegistry(Outcome.Failed(IllegalStateException("offline")))
        val vm = WhatsNewViewModel(offline, RunningVersion("0.1.0"))
        assertThat(vm.state.value).isEqualTo(WhatsNewUiState.Failed)
    }
}
