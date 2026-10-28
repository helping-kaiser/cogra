package com.cogra.feature.profile

import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.ProfileFigures
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.UserProfile
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testProfile
import com.cogra.domain.testing.testSeenRecord
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    private class ScriptedProfiles : ThrowingProfileRepository() {
        var mine: Outcome<ProfileView?> = Outcome.Success(testProfile(id = "u1", handle = "jakob"))
        var byHandle: MutableMap<String, Outcome<ProfileView?>> = mutableMapOf()
        var rows: Outcome<Page<RecordRow>> =
            Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))
        val rowRequests = mutableListOf<Family?>()
        var figures: Outcome<ProfileFigures> = Outcome.Failed(IOException("not scripted"))
        val figureRequests = mutableListOf<String>()

        override suspend fun figures(actorId: String): Outcome<ProfileFigures> {
            figureRequests += actorId
            return figures
        }

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

    private val history = RecordingViewHistoryRepository()
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val seenTracker = TestScope(dispatcher).let { scope ->
        SeenTracker(history, session, scope, testSeenRecord(session, scope))
    }

    private fun viewModel() = ProfileViewModel(profiles, account, seenTracker)

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    // ProfileHeader (Q35, closed toward the drawn figures): the header reads the
    // three record counts for the profile it shows, and a failed read keeps none.
    @Test
    fun theHeaderReadsItsFiguresForTheProfileItShows() = runTest(dispatcher) {
        profiles.figures = Outcome.Success(ProfileFigures(posts = 5, opinionsOn = 9, opinionsBy = 4))
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.figureRequests).containsExactly("u1")
        assertThat(vm.state.value.figures).isEqualTo(ProfileFigures(5, 9, 4))

        profiles.figures = Outcome.Failed(IOException("no route"))
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.figures).isEqualTo(ProfileFigures(5, 9, 4))
    }

    @Test
    fun theOwnProfileLoadsAndLandsOnEverything() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(s.loading).isFalse()
        assertThat(s.profile?.handle).isEqualTo("jakob")
        assertThat(s.own).isTrue()
        assertThat(s.filter).isEqualTo(ChronicleFilter.EVERYTHING)
        // Every visitor lands on Everything: every profile board draws the
        // tab row at `value="everything"` (Profile.md:21).
        assertThat(profiles.rowRequests).containsExactly(null)
    }

    /**
     * F2-8. A signed profile edit is served from its signature on —
     * pending until it lands (substrate.md §6) — so the one re-read the
     * saved edit fires already answers with the new version, and the
     * chronicle is read once with it. Nothing waits for the landing.
     */
    @Test
    fun aSavedEditShowsOnTheNextRead() = runTest(dispatcher) {
        val before = testProfile(id = "u1", handle = "jakob", bio = "old")
        profiles.mine = Outcome.Success(before)
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.profile?.bio?.value).isEqualTo("old")
        val rowReadsBefore = profiles.rowRequests.size

        // The edit is signed: the backend serves the new version at once.
        profiles.mine = Outcome.Success(before.copy(bio = testModeratedField("new")))
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.profile?.bio?.value).isEqualTo("new")
        assertThat(profiles.rowRequests.size).isEqualTo(rowReadsBefore + 1)
    }

    /**
     * ProfileOther.md:35 — the member who vouched the reader in, the pair
     * incomplete: the anchor opens the vouch-back, the card put away or
     * not (VouchBack.md:51). Anyone else, or a completed pair, is plain.
     */
    @Test
    fun theVouchersProfileOpensTheVouchBackWhileThePairIsIncomplete() = runTest(dispatcher) {
        profiles.byHandle["mira"] = Outcome.Success(testProfile(id = "u2", handle = "mira"))
        profiles.byHandle["sol"] = Outcome.Success(testProfile(id = "u3", handle = "sol"))
        account.profile = UserProfile(
            "u1",
            "noa",
            null,
            AccountState.MEMBER,
            false,
            ActorRef("u2", "mira"),
            vouchBackDismissed = true,
        )
        val vm = viewModel()
        vm.start("mira")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.vouchesBack).isTrue()

        val other = viewModel()
        other.start("sol")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(other.state.value.vouchesBack).isFalse()

        account.profile = account.profile?.copy(hasReciprocated = true)
        val done = viewModel()
        done.start("mira")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(done.state.value.vouchesBack).isFalse()
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
        vm.onFilterChange(ChronicleFilter.POSTS)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.rowRequests).containsExactly(null, Family.PUBLISH).inOrder()
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

    // PostDetailViewModel's twin case: pulling to refresh a profile
    // already on screen is what feeds the ProfileScreen's
    // PullToRefreshBox(isRefreshing = state.refreshing, onRefresh =
    // viewModel::refresh) — the design/readme.md rule that every
    // full-screen scrolling root answers pull-to-refresh (ruled
    // 2026-09-10).
    @Test
    fun pullingToRefreshShowsTheIndicatorWithoutBlankingTheProfile() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refreshing).isFalse()

        vm.refresh()
        // Before the read has had a chance to come back: the indicator
        // has something to say, but the already-drawn profile stays.
        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.state.value.refreshing).isTrue()
        assertThat(vm.state.value.profile?.handle).isEqualTo("jakob")

        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refreshing).isFalse()
    }

    // OPENING A PROFILE (History.md:11): another's profile joins the reader's
    // History the moment it is read, as the profile alone; the reader's own
    // does not, and with no session nothing does.

    @Test
    fun openingAnotherProfileAddsTheProfileToHistory() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        val vm = viewModel()
        vm.start("ada")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.own).isFalse()
        assertThat(history.calls).containsExactly(listOf("u2"))

        // A refresh reads it again; it is already in History.
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(history.calls).containsExactly(listOf("u2"))
    }

    @Test
    fun openingTheOwnProfileAddsNothingToHistory() = runTest(dispatcher) {
        profiles.byHandle["jakob"] = Outcome.Success(testProfile(id = "u1", handle = "jakob"))
        val tab = viewModel()
        tab.start(null)
        val byHandle = viewModel()
        byHandle.start("jakob")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(byHandle.state.value.own).isTrue()
        assertThat(history.calls).isEmpty()
    }

    @Test
    fun openingAProfileWithNoSessionAddsNothingToHistory() = runTest(dispatcher) {
        session.tokens.value = null
        account.profile = null
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        val vm = viewModel()
        vm.start("ada")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.profile?.id).isEqualTo("u2")
        assertThat(history.calls).isEmpty()
    }
}
