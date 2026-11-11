package com.cogra.feature.profile

import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.ProfileFigures
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.UserProfile
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.cogra.domain.testing.testSeenRecord
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
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
        var posts: Outcome<Page<PostView>> =
            Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))
        var comments: Outcome<Page<ProfileComment>> =
            Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))

        /** Which list each read asked for — `records`, `posts` or `comments` — and from which cursor. */
        val rowRequests = mutableListOf<String>()
        val cursors = mutableListOf<String?>()

        /** A read that hangs until the test lets it through: a tab's page still on its way. */
        var gate: CompletableDeferred<Unit>? = null
        var figures: Outcome<ProfileFigures> = Outcome.Failed(IOException("not scripted"))
        val figureRequests = mutableListOf<String>()

        override suspend fun figures(actorId: String): Outcome<ProfileFigures> {
            figureRequests += actorId
            return figures
        }

        override suspend fun myProfile(): Outcome<ProfileView?> = mine

        override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> =
            byHandle[handle] ?: Outcome.Success(null)

        override suspend fun authorRecords(authorId: String, first: Int, after: String?): Outcome<Page<RecordRow>> {
            rowRequests += "records"
            cursors += after
            gate?.await()
            return rows
        }

        override suspend fun profilePosts(authorId: String, after: String?): Outcome<Page<PostView>> {
            rowRequests += "posts"
            cursors += after
            gate?.await()
            return posts
        }

        override suspend fun profileComments(authorId: String, after: String?): Outcome<Page<ProfileComment>> {
            rowRequests += "comments"
            cursors += after
            gate?.await()
            return comments
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
        assertThat(s.tab).isEqualTo(ProfileTab.EVERYTHING)
        // Every visitor lands on Everything: every profile board draws the
        // tab row at `value="everything"` (Profile.md:21) — the chronicle.
        assertThat(profiles.rowRequests).containsExactly("records")
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

    // ProfilePosts.md:3, ProfileComments.md:3 — the Posts tab reads the
    // person's posts as cards and the Comments tab their comments, each on a
    // read of its own; the chronicle is Everything's alone.
    @Test
    fun eachTabReadsItsOwnList() = runTest(dispatcher) {
        profiles.posts = postsPage("p1", "p2", next = "c1")
        profiles.comments = Outcome.Success(Page(listOf(listed("c1")), endCursor = null, hasNextPage = false))
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTabChange(ProfileTab.POSTS)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
        assertThat(vm.state.value.rows).isEmpty()
        assertThat(vm.state.value.hasMore).isTrue()

        vm.onTabChange(ProfileTab.COMMENTS)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.comments.map { it.comment.id }).containsExactly("c1")
        assertThat(vm.state.value.posts).isEmpty()
        assertThat(profiles.rowRequests).containsExactly("records", "posts", "comments").inOrder()
    }

    // ProfilePosts.md:21 — a tap on the standing tab changes nothing.
    @Test
    fun theStandingTabReadsNothingAgain() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTabChange(ProfileTab.EVERYTHING)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.rowRequests).containsExactly("records")
    }

    // ProfilePosts.md:13 — only the list below the tab row changes, and only
    // to the tab the reader stands on: an old tab's page, landing late, never
    // lands on the new one.
    @Test
    fun aLateOldTabsPageNeverLandsOnTheNewTab() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        profiles.posts = Outcome.Success(Page(listOf(testPost("p1")), endCursor = null, hasNextPage = false))
        profiles.gate = CompletableDeferred()
        vm.onTabChange(ProfileTab.POSTS)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTabChange(ProfileTab.COMMENTS)
        profiles.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        val s = vm.state.value
        assertThat(s.tab).isEqualTo(ProfileTab.COMMENTS)
        assertThat(s.posts).isEmpty()
        assertThat(s.rowsLoading).isFalse()
    }

    // Profile.md:31 — the next page arrives in place, below the cards already
    // on screen, from the cursor the last one ended on; a card the walk meets
    // twice stands once.
    @Test
    fun theNextPageJoinsBelowFromItsCursor() = runTest(dispatcher) {
        profiles.posts = postsPage("p1", "p2", next = "c1")
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTabChange(ProfileTab.POSTS)
        dispatcher.scheduler.advanceUntilIdle()

        profiles.posts = postsPage("p2", "p3")
        vm.onLoadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1", "p2", "p3").inOrder()
        assertThat(profiles.cursors.last()).isEqualTo("c1")
        assertThat(vm.state.value.hasMore).isFalse()

        // The end reached, nothing more is asked.
        vm.onLoadMore()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.rowRequests.count { it == "posts" }).isEqualTo(2)
    }

    @Test
    fun aFailedPageMarksTheRetrySlotNotTheScreen() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        profiles.comments = Outcome.Failed(IOException("offline"))
        vm.onTabChange(ProfileTab.COMMENTS)
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(s.pageFailed).isTrue()
        assertThat(s.transportFailed).isFalse()
        assertThat(s.profile).isNotNull()
    }

    // ProfileMoreFailed.md — Retry asks again for the page that did not
    // arrive: the first page when nothing has landed yet, else the next.
    @Test
    fun retryAsksAgainForThePageThatDidNotArrive() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        profiles.posts = Outcome.Failed(IOException("offline"))
        vm.onTabChange(ProfileTab.POSTS)
        dispatcher.scheduler.advanceUntilIdle()

        profiles.posts = Outcome.Success(Page(listOf(testPost("p1")), endCursor = "c1", hasNextPage = true))
        vm.onRetryPage()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.pageFailed).isFalse()
        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1")
        assertThat(profiles.cursors.last()).isNull()

        profiles.posts = Outcome.Failed(IOException("offline"))
        vm.onLoadMore()
        dispatcher.scheduler.advanceUntilIdle()
        profiles.posts = Outcome.Success(Page(listOf(testPost("p2")), endCursor = null, hasNextPage = false))
        vm.onRetryPage()
        dispatcher.scheduler.advanceUntilIdle()
        // The rows already on screen stayed; the retried page joined below them.
        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
        assertThat(profiles.cursors.last()).isEqualTo("c1")
    }

    // History.md:11 — a profile's cards join History only as the reader
    // scrolls each fully into view, and the reading's pause sends them.
    @Test
    fun aCardSeenOnTheProfileJoinsHistoryAtTheCheckpoint() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        vm.seen.onCardsSeen(listOf("p1", "c1"))
        vm.seen.onCheckpoint()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(history.calls).containsExactly(listOf("p1", "c1"))
    }

    private fun listed(id: String) = ProfileComment(testComment(id), target = null, threadPostId = "p1")

    /** One page of posts, ending on [next] when more follow. */
    private fun postsPage(vararg ids: String, next: String? = null): Outcome<Page<PostView>> =
        Outcome.Success(Page(ids.map { testPost(it) }, endCursor = next, hasNextPage = next != null))

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
