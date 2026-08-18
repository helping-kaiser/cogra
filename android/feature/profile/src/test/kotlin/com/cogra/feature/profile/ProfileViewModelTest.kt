package com.cogra.feature.profile

import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.UserProfile
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import java.io.IOException
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
class ProfileViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    private class ScriptedProfiles : ThrowingProfileRepository() {
        var mine: Outcome<ProfileView?> = Outcome.Success(testProfile(id = "u1", handle = "jakob"))
        var byHandle: MutableMap<String, Outcome<ProfileView?>> = mutableMapOf()
        var rows: Outcome<Page<RecordRow>> =
            Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))
        val rowRequests = mutableListOf<Family?>()

        override suspend fun myProfile(): Outcome<ProfileView?> = mine

        override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> =
            byHandle[handle] ?: Outcome.Success(null)

        override suspend fun authorRecords(
            authorId: String,
            family: Family?,
            first: Int,
            after: String?,
        ): Outcome<Page<RecordRow>> {
            rowRequests += family
            return rows
        }
    }

    private class ScriptedAccount : ThrowingAccountRepository() {
        var profile: UserProfile? =
            UserProfile("u1", "jakob", null, AccountState.MEMBER, true, null)

        override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)
    }

    private val profiles = ScriptedProfiles()
    private val account = ScriptedAccount()

    private fun viewModel() = ProfileViewModel(profiles, account)

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    @Test
    fun theOwnProfileLoadsAndLandsOnThePostsFilter() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(s.loading).isFalse()
        assertThat(s.profile?.handle).isEqualTo("jakob")
        assertThat(s.own).isTrue()
        assertThat(s.filter).isEqualTo(ChronicleFilter.POSTS)
        // Every visitor lands on Posts (decision D3).
        assertThat(profiles.rowRequests).containsExactly(Family.PUBLISH)
    }

    @Test
    fun anotherActorsProfileIsNotOwn() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        val vm = viewModel()
        vm.start("ada")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.own).isFalse()
        assertThat(vm.state.value.profile?.handle).isEqualTo("ada")
    }

    @Test
    fun anApplicantViewerMarksTheLock() = runTest(dispatcher) {
        account.profile = UserProfile("u1", "jakob", null, AccountState.APPLICANT, false, null)
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.applicant).isTrue()
    }

    @Test
    fun anUnknownHandleIsNotFound() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("nobody")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.notFound).isTrue()
    }

    @Test
    fun aTransportFaultOnFirstLoadGoesFullScreen() = runTest(dispatcher) {
        profiles.mine = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.profile).isNull()
    }

    @Test
    fun aFilterChangeReloadsTheChronicle() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onFilterChange(ChronicleFilter.EVERYTHING)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.rowRequests).containsExactly(Family.PUBLISH, null).inOrder()
    }

    @Test
    fun aFailedPageMarksTheRetrySlotNotTheScreen() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        profiles.rows = Outcome.Failed(IOException("offline"))
        vm.onFilterChange(ChronicleFilter.COMMENTS)
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(s.pageFailed).isTrue()
        assertThat(s.transportFailed).isFalse()
        assertThat(s.profile).isNotNull()
    }
}
