// Where a profile lands and what the landing reads (ProfilePosts.md:5,
// ProfileOther.md:21, Profile.md:25, ProfilePostsOwn.md:3): every opening lands
// on Posts and reads the Posts page alone; Everything's chronicle is read when
// the tab is first chosen. The lit tab is the back-stack entry's saved state:
// a fresh entry lands on Posts, and an entry restored after the OS ended the
// process finds the tab it was left on (design/readme.md §4).

package com.cogra.feature.profile

import androidx.lifecycle.SavedStateHandle
import com.cogra.domain.AccountState
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
class ProfileLandingTest {

    private val dispatcher = StandardTestDispatcher()

    /** The profile reads, each list read logged by name: `posts`, `comments` or `records`. */
    private class RecordingProfiles : ThrowingProfileRepository() {
        val reads = mutableListOf<String>()

        override suspend fun myProfile(): Outcome<ProfileView?> =
            Outcome.Success(testProfile(id = "u1", handle = "jakob"))

        /** `jakob` is the reader; any other handle is another person. */
        override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> =
            Outcome.Success(testProfile(id = if (handle == "jakob") "u1" else "u2", handle = handle))

        override suspend fun figures(actorId: String): Outcome<ProfileFigures> =
            Outcome.Failed(IOException("unscripted"))

        override suspend fun profilePosts(authorId: String, after: String?): Outcome<Page<PostView>> {
            reads += "posts"
            return Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))
        }

        override suspend fun profileComments(authorId: String, after: String?): Outcome<Page<ProfileComment>> {
            reads += "comments"
            return Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))
        }

        override suspend fun authorRecords(authorId: String, first: Int, after: String?): Outcome<Page<RecordRow>> {
            reads += "records"
            return Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))
        }
    }

    private class Member : ThrowingAccountRepository() {
        override suspend fun me(): Outcome<UserProfile?> =
            Outcome.Success(UserProfile("u1", "jakob", null, AccountState.MEMBER, true, null))
    }

    private val profiles = RecordingProfiles()
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val seenTracker = TestScope(dispatcher).let { scope ->
        SeenTracker(RecordingViewHistoryRepository(), session, scope, testSeenRecord(session, scope))
    }

    private fun opened(handle: String?, saved: SavedStateHandle = SavedStateHandle()) =
        ProfileViewModel(saved, profiles, Member(), seenTracker).also {
            it.start(handle)
            dispatcher.scheduler.advanceUntilIdle()
        }

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    // ProfileOther.md:21, ProfilePosts.md:5 — another's profile lands on Posts,
    // and the landing reads the Posts page alone: no chronicle, no comments.
    @Test
    fun anothersProfileLandsOnPostsAndReadsOnlyThePostsPage() = runTest(dispatcher) {
        val vm = opened("ada")
        assertThat(vm.state.value.own).isFalse()
        assertThat(vm.state.value.tab).isEqualTo(ProfileTab.POSTS)
        assertThat(profiles.reads).containsExactly("posts")
    }

    // Profile.md:25, ProfilePostsOwn.md:3 — the reader's own profile, from the
    // bar's slot (no handle) or by its handle from a card, lands the same.
    @Test
    fun theOwnProfileLandsOnPostsFromEitherDoor() = runTest(dispatcher) {
        val root = opened(null)
        val byHandle = opened("jakob")
        for (vm in listOf(root, byHandle)) {
            assertThat(vm.state.value.own).isTrue()
            assertThat(vm.state.value.tab).isEqualTo(ProfileTab.POSTS)
        }
        assertThat(profiles.reads).containsExactly("posts", "posts")
    }

    // ProfileOther.md:23 — Everything's chronicle is read when Everything is
    // chosen, once; a second tap on the standing tab reads nothing (ProfilePosts.md:45).
    @Test
    fun choosingEverythingReadsTheChronicleOnce() = runTest(dispatcher) {
        val vm = opened("ada")
        vm.onTabChange(ProfileTab.EVERYTHING)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTabChange(ProfileTab.EVERYTHING)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.tab).isEqualTo(ProfileTab.EVERYTHING)
        assertThat(profiles.reads).containsExactly("posts", "records").inOrder()
    }

    // ProfileOther.md:21 "from any door" — a profile left on Everything and
    // opened again is a new back-stack entry with saved state of its own: it
    // lands on Posts.
    @Test
    fun aNewOpeningLandsOnPostsWhateverAnEarlierOneWasLeftOn() = runTest(dispatcher) {
        val earlier = opened("ada")
        earlier.onTabChange(ProfileTab.EVERYTHING)
        dispatcher.scheduler.advanceUntilIdle()

        val again = opened("ada")
        assertThat(again.state.value.tab).isEqualTo(ProfileTab.POSTS)
    }

    // design/readme.md §4 ("A process the OS ended in the background restores
    // by the platform's convention — Android's saved state"), ProfilePosts.md:77
    // ("in the state they left it"): the entry's saved state outlives the
    // ViewModel, and the restored one stands on the tab left, reading that tab alone.
    @Test
    fun theTabLeftComesBackWithTheEntrysSavedState() = runTest(dispatcher) {
        val saved = SavedStateHandle()
        val before = opened("ada", saved)
        before.onTabChange(ProfileTab.COMMENTS)
        dispatcher.scheduler.advanceUntilIdle()
        profiles.reads.clear()

        // What the platform writes to the Bundle and hands back on restore.
        val restored = SavedStateHandle(saved.keys().associateWith { saved.get<Any>(it) })
        val after = opened("ada", restored)
        assertThat(after.state.value.tab).isEqualTo(ProfileTab.COMMENTS)
        assertThat(profiles.reads).containsExactly("comments")
    }
}
