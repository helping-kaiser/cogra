// What your feed shows, the ViewModel half (SettingsReading.md, compiled line
// by line): the sheet opens on the reader's own default or CoGra's, stages,
// Reset stages CoGra's, Done saves on this device, and every other way out
// leaves the default as it was. Nothing here is sent.

package com.cogra.feature.settings

import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.identity.DeviceLock
import com.cogra.domain.identity.SignOut
import com.cogra.domain.settings.SensitiveContentChoice
import com.cogra.domain.testing.FakeDeviceData
import com.cogra.domain.testing.FakeDeviceLockRepository
import com.cogra.domain.testing.FakeDevicePreferences
import com.cogra.domain.testing.FakeExploreDeviceStore
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.InMemoryReaderDefaultStore
import com.cogra.domain.testing.ScriptedAccountDeletionRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsReadingViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val identity = FakeIdentityStore().apply { seed = ActorKey.generate().seed() }
    private val tokens = FakeTokenStore()
    private val device = FakeDevicePreferences()
    private val sessions = ScriptedSessions()
    private val deviceData = FakeDeviceData(tokens, identity, device)
    private val locks = FakeDeviceLockRepository().apply { sessionAccount = "u1" }
    private val deviceLock = DeviceLock(FakeLockCustodyStore(), tokens, locks)
    private val readerDefaults = InMemoryReaderDefaultStore()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private suspend fun signedIn() = tokens.save(AuthTokens("a", "r", "u1"))

    private fun viewModel() = SettingsViewModel(
        ScriptedSettings(),
        sessions,
        SignOut(sessions, identity, tokens, deviceData, deviceLock, FakeExploreDeviceStore()),
        identity,
        device,
        SensitiveContentChoice(),
        AccountDeletionState(ScriptedAccountDeletionRepository()),
        deviceLock,
        ReaderDefaults(readerDefaults, tokens),
    ).also {
        it.clock = { NOW }
        it.refresh()
    }

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    @Test
    fun whatYourFeedShowsOpensOnCoGrasDefaultWhereTheReaderSetNone() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onOpenReading()
        assertThat(vm.state.value.readingSheet).isEqualTo(FeedFilter.DEFAULT)
    }

    @Test
    fun theSheetOpensOnTheReadersOwnDefault() = runTest(dispatcher) {
        signedIn()
        val own = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST, showSeen = true)
        readerDefaults.save("u1", own)
        val vm = viewModel()
        idle()
        vm.onOpenReading()
        assertThat(vm.state.value.readingSheet).isEqualTo(own)
    }

    @Test
    fun aTapStagesAndNeverChangesTheDefaultBeforeDone() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onOpenReading()
        vm.onStageReading(FeedFilter.DEFAULT.copy(people = PeopleScope.YOUR_PEOPLE, peopleSign = PeopleSign.FOR))
        idle()
        assertThat(vm.state.value.readerDefault).isEqualTo(FeedFilter.DEFAULT)
        assertThat(readerDefaults.saved.value).isEmpty()
    }

    @Test
    fun doneSavesTheStagedFilterAsTheReadersOwnDefaultOnThisDevice() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onOpenReading()
        val staged = FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.POST, FeedKind.TAG), stillSettling = false)
        vm.onStageReading(staged)
        vm.onReadingDone()
        idle()
        assertThat(vm.state.value.readingSheet).isNull()
        assertThat(vm.state.value.readerDefault).isEqualTo(staged)
        assertThat(readerDefaults.saved.value).containsExactly("u1", staged)
    }

    @Test
    fun resetStagesCoGrasOwnDefaultNeverTheReaders() = runTest(dispatcher) {
        signedIn()
        readerDefaults.save("u1", FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST))
        val vm = viewModel()
        idle()
        vm.onOpenReading()
        vm.onResetReading()
        assertThat(vm.state.value.readingSheet).isEqualTo(FeedFilter.DEFAULT)
    }

    @Test
    fun aDismissLeavesTheDefaultAsItWas() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onOpenReading()
        vm.onStageReading(FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST))
        vm.onDismissReading()
        idle()
        assertThat(vm.state.value.readingSheet).isNull()
        assertThat(vm.state.value.readerDefault).isEqualTo(FeedFilter.DEFAULT)
        assertThat(readerDefaults.saved.value).isEmpty()
    }
}
