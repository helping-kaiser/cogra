package com.cogra.feature.content

import com.cogra.domain.CommentPage
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.testComment
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
import java.io.IOException

/**
 * The comments sheet's own state holder — the one comments surface, on
 * the feed as on the detail (jakob 2026-09-15).
 *
 * These assertions moved here from `PostDetailViewModelTest` with the
 * thread itself: they describe the sheet's behaviour, and the sheet is
 * no longer a projection of the detail.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CommentsViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val reveals = SensitiveReveals()

    private val content = object : ThrowingContentRepository() {
        /** The thread read's answer; the first page every `start` gets. */
        var thread: Outcome<CommentPage?> = Outcome.Success(
            CommentPage(
                page = Page(listOf(testComment("c1")), "cc1", hasNextPage = true),
                total = 3,
            ),
        )

        /** The answer to every read after the first — the append page. */
        var nextPage: Outcome<CommentPage?>? = null

        var repliesPage: Outcome<Page<CommentView>> =
            Outcome.Success(Page(listOf(testComment("r1")), "rc1", hasNextPage = false))

        var threadReads = 0
        val postsAsked = mutableListOf<String>()
        val cursorsAsked = mutableListOf<String?>()
        val includePendingAsked = mutableListOf<Boolean>()
        val repliesAsked = mutableListOf<String>()

        override suspend fun comments(
            postId: String,
            first: Int,
            after: String?,
            includePending: Boolean,
        ): Outcome<CommentPage?> {
            threadReads += 1
            postsAsked += postId
            cursorsAsked += after
            includePendingAsked += includePending
            return if (after == null) thread else (nextPage ?: thread)
        }

        override suspend fun commentReplies(
            commentId: String,
            first: Int,
            after: String?,
            includePending: Boolean,
        ): Outcome<Page<CommentView>> {
            repliesAsked += commentId
            return repliesPage
        }
    }

    private fun viewModel() = CommentsViewModel(content = content, reveals = reveals)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /**
     * THE THREAD IS READ ON ITS OWN, without the post: the sheet is
     * raised over the feed too, where the post is already on the device.
     */
    @Test
    fun startReadsTheThreadAloneAndCarriesTheWholeCount() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        val state = vm.state.value
        assertThat(content.postsAsked).containsExactly("post-1")
        assertThat(state.comments.map { it.id }).containsExactly("c1")
        assertThat(state.hasMore).isTrue()
        // Not the page's size: the count the reader tapped to get here.
        assertThat(state.total).isEqualTo(3)
        assertThat(state.loading).isFalse()
    }

    @Test
    fun theThreadAsksForPendingEntriesByDefault() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.includePending).isTrue()
        assertThat(content.includePendingAsked).containsExactly(true)
    }

    /** A second raise of the SAME thread keeps what is on screen. */
    @Test
    fun raisingTheSameThreadAgainDoesNotReadItAgain() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.threadReads).isEqualTo(1)
    }

    /** …and raising a different one rebinds rather than appending to it. */
    @Test
    fun raisingAnotherPostsThreadRebindsTheHolder() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.start("post-2")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.postsAsked).containsExactly("post-1", "post-2").inOrder()
        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1")
    }

    @Test
    fun loadMoreAppendsComments() = runTest(dispatcher) {
        content.nextPage = Outcome.Success(
            CommentPage(Page(listOf(testComment("c2")), null, hasNextPage = false), total = 3),
        )
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.cursorsAsked).containsExactly(null, "cc1").inOrder()
        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1", "c2").inOrder()
        assertThat(vm.state.value.hasMore).isFalse()
    }

    @Test
    fun aCommentThatLandedMidWalkIsNotAppendedTwice() = runTest(dispatcher) {
        content.nextPage = Outcome.Success(
            CommentPage(
                Page(listOf(testComment("c1"), testComment("c2")), null, hasNextPage = false),
                total = 3,
            ),
        )
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1", "c2").inOrder()
    }

    @Test
    fun aFailedThreadReadFaultsInTheSheet() = runTest(dispatcher) {
        content.thread = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.loading).isFalse()

        content.thread = Outcome.Success(
            CommentPage(Page(listOf(testComment("c1")), null, hasNextPage = false), total = 1),
        )
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isNull()
    }

    @Test
    fun aFailedCommentsPageFaultsAtTheAppendSlot() = runTest(dispatcher) {
        content.nextPage = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.APPEND)
        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1")
        assertThat(vm.state.value.hasMore).isTrue()

        // A later successful page clears the fault and appends.
        content.nextPage = Outcome.Success(
            CommentPage(Page(listOf(testComment("c2")), null, hasNextPage = false), total = 3),
        )
        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1", "c2").inOrder()
    }

    /**
     * Opening a branch fetches it (Q49): nothing is prefetched, so the
     * branch starts empty and the read is what fills it.
     */
    @Test
    fun expandingRepliesFetchesTheBranch() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onLoadMoreReplies(testComment("c1").copy(replyCount = 1))
        dispatcher.scheduler.advanceUntilIdle()

        val thread = vm.state.value.replyThreads["c1"]
        checkNotNull(thread)
        assertThat(thread.items.map { it.id }).containsExactly("r1")
        assertThat(thread.hasMore).isFalse()
    }

    @Test
    fun aFailedReplyPageOffersRetryInPlace() = runTest(dispatcher) {
        content.repliesPage = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onLoadMoreReplies(testComment("c1"))
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.replyThreads["c1"]?.failed).isTrue()
    }

    /**
     * A comment signed on the composer comes back as a landing, and the
     * thread re-reads rather than merging the new entry into the page it
     * already holds — the refetched page is what carries the pending
     * marker the fresh comment wears.
     */
    @Test
    fun aCommentLandingRefetchesTheThreadAndSaysSoOnce() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val readsBefore = content.threadReads

        vm.onCommentLanded(parentCommentId = null)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.threadReads).isGreaterThan(readsBefore)
        assertThat(vm.state.value.commentSigned).isTrue()

        // The one-shot fires once: a recomposition never re-announces it.
        vm.onCommentSignedShown()
        assertThat(vm.state.value.commentSigned).isFalse()
    }

    /**
     * SHOW THE CONTENT THEY JUST WROTE (jakob 2026-09-15). A reply lands
     * one level down, behind its parent's collapsed count — so the
     * landing names the parent and that branch unfolds as the refetched
     * page arrives, with the new reply on screen wearing its marker.
     */
    @Test
    fun aReplyLandingUnfoldsTheBranchItLandedIn() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        // Nothing is unfolded before the reply goes out.
        assertThat(vm.state.value.replyThreads).isEmpty()

        vm.onCommentLanded(parentCommentId = "c1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.repliesAsked).containsExactly("c1")
        assertThat(vm.state.value.replyThreads["c1"]?.items?.map { it.id })
            .containsExactly("r1")
    }

    /**
     * A refetch is a new set of nodes, so branches a reader had unfolded
     * start over — except the one the landing named, which is the point
     * of naming it.
     */
    @Test
    fun aLandingStartsTheOtherBranchesOverButKeepsTheOneItNamed() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onLoadMoreReplies(testComment("other"))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.replyThreads.keys).containsExactly("other")

        vm.onCommentLanded(parentCommentId = "c1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.replyThreads.keys).containsExactly("c1")
    }
}
