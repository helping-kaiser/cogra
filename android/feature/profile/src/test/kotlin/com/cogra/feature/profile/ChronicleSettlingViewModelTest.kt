// THE EVERYTHING TAB ACROSS THE LANDING (Profile.md:31, ProfileOther.md:27):
// a still-settling post or comment and the record it lands as are ONE row by
// key (`RecordRow.id` = the genesis record's id), so the list never stands
// both — a pull replaces the list with what the server serves now, and a
// further page that serves the record below a held settling copy keeps the
// copy it holds.

package com.cogra.feature.profile

import androidx.lifecycle.SavedStateHandle
import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostView
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordLink
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
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class ChronicleSettlingViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    /** The chronicle's pages, served in turn, one per read. */
    private class PagedChronicle : ThrowingProfileRepository() {
        val pages = ArrayDeque<Page<RecordRow>>()
        val cursors = mutableListOf<String?>()

        override suspend fun myProfile(): Outcome<ProfileView?> =
            Outcome.Success(testProfile(id = "u1", handle = "jakob"))

        override suspend fun profilePosts(authorId: String, after: String?): Outcome<Page<PostView>> =
            Outcome.Success(Page(emptyList(), endCursor = null, hasNextPage = false))

        override suspend fun chronicle(authorId: String, first: Int, after: String?): Outcome<Page<RecordRow>> {
            cursors += after
            return Outcome.Success(pages.removeFirst())
        }
    }

    private class Member : ThrowingAccountRepository() {
        override suspend fun me(): Outcome<UserProfile?> =
            Outcome.Success(UserProfile("u1", "jakob", null, AccountState.MEMBER, true, null))
    }

    private val chronicle = PagedChronicle()
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val seenTracker = TestScope(dispatcher).let { scope ->
        SeenTracker(RecordingViewHistoryRepository(), session, scope, testSeenRecord(session, scope))
    }

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    private val signed = Instant.parse("2026-11-24T10:00:00Z")

    /** A post still settling, keyed by the record it lands as. */
    private fun settling(record: String) = RecordRow(
        id = record,
        family = Family.PUBLISH,
        genesis = true,
        snippet = "Salt maps",
        link = RecordLink.ToPost("p-$record"),
        act = RecordAct.GENESIS,
        pending = true,
        signedAt = signed,
    )

    /** The landed genesis record of the same post. */
    private fun landed(record: String) = RecordRow(
        id = record,
        family = Family.PUBLISH,
        genesis = true,
        snippet = "Salt maps",
        link = RecordLink.ToPost("p-$record"),
        landedAt = signed.plusSeconds(30),
        act = RecordAct.GENESIS,
    )

    private fun page(vararg rows: RecordRow, next: String? = null) =
        Page(rows.toList(), endCursor = next, hasNextPage = next != null)

    private fun onEverything(): ProfileViewModel {
        val vm = ProfileViewModel(SavedStateHandle(), chronicle, Member(), seenTracker)
        vm.start(null)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTabChange(ProfileTab.EVERYTHING)
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    // The settling entries lead in the server's order; nothing is re-sorted.
    @Test
    fun theSettlingEntriesStandInTheServersOrder() = runTest(dispatcher) {
        chronicle.pages += page(settling("rec:b"), settling("rec:a"), landed("rec:z"))

        val vm = onEverything()

        assertThat(vm.state.value.rows.map { it.id }).containsExactly("rec:b", "rec:a", "rec:z").inOrder()
        assertThat(vm.state.value.rows.map { it.pending }).containsExactly(true, true, false).inOrder()
    }

    // One read serves it settling, the next (a pull) serves its landed
    // record: the list holds ONE row, the landed one, never both.
    @Test
    fun anEntryServedSettlingThenLandedIsOneRow() = runTest(dispatcher) {
        chronicle.pages += page(settling("rec:a"), landed("rec:z"))
        chronicle.pages += page(landed("rec:a"), landed("rec:z"))

        val vm = onEverything()
        assertThat(vm.state.value.rows.single { it.id == "rec:a" }.pending).isTrue()

        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()

        val rows = vm.state.value.rows
        assertThat(rows.map { it.id }).containsExactly("rec:a", "rec:z").inOrder()
        assertThat(rows[0].pending).isFalse()
        assertThat(rows[0].landedAt).isNotNull()
    }

    // Paging across the boundary: the entry landed between two fetches, so
    // the next page serves its record below the cursor; the held settling
    // copy stays the one row and the page's other rows join below it.
    @Test
    fun aRecordServedOnTheNextPageKeepsTheHeldSettlingCopy() = runTest(dispatcher) {
        chronicle.pages += page(settling("rec:a"), landed("rec:z"), next = "c1")
        chronicle.pages += page(landed("rec:a"), landed("rec:y"))

        val vm = onEverything()
        vm.onLoadMore()
        dispatcher.scheduler.advanceUntilIdle()

        val rows = vm.state.value.rows
        assertThat(chronicle.cursors).containsExactly(null, "c1").inOrder()
        assertThat(rows.map { it.id }).containsExactly("rec:a", "rec:z", "rec:y").inOrder()
        assertThat(rows.count { it.id == "rec:a" }).isEqualTo(1)
        assertThat(rows[0].pending).isTrue()
    }
}
