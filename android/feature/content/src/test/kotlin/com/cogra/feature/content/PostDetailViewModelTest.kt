package com.cogra.feature.content

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.CommentView
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.NodeLanding
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PostDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val landings = LandingSignal()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private val content = object : ThrowingContentRepository() {
        var detail: Outcome<PostDetail?> =
            Outcome.Success(
                PostDetail(
                    post = testPost("post-1"),
                    comments = Page(listOf(testComment("c1")), "cc1", hasNextPage = true),
                ),
            )
        var nextComments: Outcome<Page<CommentView>> =
            Outcome.Success(Page(listOf(testComment("c2")), null, hasNextPage = false))
        var commentPrepared = 0

        var detailReads = 0
        val includePendingAsked = mutableListOf<Boolean>()

        override suspend fun post(
            id: String,
            commentsFirst: Int,
            commentsAfter: String?,
            includePending: Boolean,
        ): Outcome<PostDetail?> {
            detailReads += 1
            includePendingAsked += includePending
            return detail
        }

        override suspend fun comments(
            postId: String,
            first: Int,
            after: String?,
            includePending: Boolean,
        ): Outcome<Page<CommentView>> {
            includePendingAsked += includePending
            return nextComments
        }

        var prepareFails = false
        var editPrepared = 0
        var replyTargets = mutableListOf<String>()
        var repliesPage: Outcome<Page<CommentView>> =
            Outcome.Success(Page(listOf(testComment("r1")), "rc1", hasNextPage = false))

        override suspend fun prepareCommentEdit(
            id: String,
            content: String,
        ): Outcome<PreparedContentView> {
            if (prepareFails) return Outcome.Failed(java.io.IOException("offline"))
            editPrepared += 1
            return Outcome.Success(
                PreparedContentView("node-e", listOf(sealer.stage(Family.REVIEW))),
            )
        }

        override suspend fun commentReplies(
            commentId: String,
            first: Int,
            after: String?,
            includePending: Boolean,
        ): Outcome<Page<CommentView>> = repliesPage

        override suspend fun prepareComment(
            target: String,
            content: String,
            license: LicenseChoice,
        ): Outcome<PreparedContentView> {
            replyTargets += target
            commentPrepared += 1
            if (prepareFails) return Outcome.Failed(IOException("offline"))
            return Outcome.Success(
                PreparedContentView("comment-node", listOf(sealer.stage(Family.REVIEW))),
            )
        }
    }

    private fun viewModel() = PostDetailViewModel(content, WriteSigner(sealer, identity), landings)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun aKeylessDeviceMarksTheCommentFailureAsNeedsKey() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.signingFailed).isTrue()
        assertThat(vm.state.value.signingNeedsKey).isTrue()
    }

    @Test
    fun startLoadsThePostAndItsThread() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        val state = vm.state.value
        assertThat(state.post?.id).isEqualTo("post-1")
        assertThat(state.comments.map { it.id }).containsExactly("c1")
        assertThat(state.commentsHaveMore).isTrue()
    }

    // Every read of the post is the device's freshest word on where it
    // stands, and the surfaces already carrying it are told.
    @Test
    fun eachReadPublishesWhereThePostStands() = runTest(dispatcher) {
        val seen = mutableListOf<NodeLanding>()
        // Unconfined so the collector is subscribed before the read
        // publishes — the documented recipe for collecting a hot flow
        // in a test.
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            landings.updates.collect { seen += it }
        }

        content.detail = Outcome.Success(
            PostDetail(
                post = testPost("post-1", landing = Landing.Pending),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(seen).containsExactly(
            NodeLanding("post-1", Landing.Pending, includePending = true),
        )

        content.detail = Outcome.Success(
            PostDetail(
                post = testPost("post-1", landing = Landing.landed(7)),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(seen.last())
            .isEqualTo(NodeLanding("post-1", Landing.landed(7), includePending = true))
    }

    @Test
    fun loadMoreAppendsComments() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMoreComments()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1", "c2").inOrder()
        assertThat(vm.state.value.commentsHaveMore).isFalse()
    }

    @Test
    fun anUnknownPostRendersNotFound() = runTest(dispatcher) {
        content.detail = Outcome.Success(null)
        val vm = viewModel()
        vm.start("gone")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.notFound).isTrue()
    }

    @Test
    fun aSignedCommentClearsTheDraftAndFiresTheOneShot() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        val state = vm.state.value
        assertThat(content.commentPrepared).isEqualTo(1)
        assertThat(state.commentSigned).isTrue()
        assertThat(state.draft).isEmpty()

        vm.onCommentSignedShown()
        assertThat(vm.state.value.commentSigned).isFalse()
    }

    @Test
    fun aBlankDraftNeverPrepares() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onDraftChange("   ")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.commentPrepared).isEqualTo(0)
    }

    @Test
    fun aTransportFaultOnLoadOffersRetry() = runTest(dispatcher) {
        content.detail = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)

        content.detail = Outcome.Success(
            PostDetail(
                post = testPost("post-1"),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.state.value.post).isNotNull()
    }

    @Test
    fun aFailedCommentsPageFaultsAtTheAppendSlot() = runTest(dispatcher) {
        content.nextComments = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMoreComments()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.APPEND)
        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1")
        assertThat(vm.state.value.commentsHaveMore).isTrue()

        // A later successful page clears the fault and appends.
        content.nextComments =
            Outcome.Success(Page(listOf(testComment("c2")), null, hasNextPage = false))
        vm.loadMoreComments()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1", "c2").inOrder()
    }

    @Test
    fun aFailedSubmitIsAComposerErrorNotAReadFault() = runTest(dispatcher) {
        content.prepareFails = true
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.submitTransportFailed).isTrue()
        assertThat(vm.state.value.transportFault).isNull()

        // The next submit clears the composer error before retrying.
        content.prepareFails = false
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.submitTransportFailed).isFalse()
        assertThat(vm.state.value.commentSigned).isTrue()
    }

    @Test
    fun aSignedCommentRefetchesTheThread() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val readsBeforeSubmit = content.detailReads

        // The signed comment is pending content, real from the moment
        // it is signed — it reaches the thread through a refetched
        // page, never by being merged into the held one.
        content.detail = Outcome.Success(
            PostDetail(
                post = testPost("post-1"),
                comments = Page(
                    listOf(testComment("c1"), testComment("c9", landing = Landing.Pending)),
                    "cc1",
                    hasNextPage = true,
                ),
            ),
        )
        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.detailReads).isEqualTo(readsBeforeSubmit + 1)
        val comments = vm.state.value.comments
        assertThat(comments.map { it.id }).containsExactly("c1", "c9").inOrder()
        assertThat(comments.last().landing.isPending).isTrue()
    }

    @Test
    fun aSignedReplyRefetchesTheThread() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val readsBeforeSubmit = content.detailReads

        vm.onStartReply("c1")
        vm.onReplyDraftChange("me too")
        vm.onSubmitReply()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.detailReads).isEqualTo(readsBeforeSubmit + 1)
    }

    @Test
    fun aFailedSubmitLeavesTheThreadUnread() = runTest(dispatcher) {
        content.prepareFails = true
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val readsBeforeSubmit = content.detailReads

        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.detailReads).isEqualTo(readsBeforeSubmit)
    }

    @Test
    fun aCommentThatLandedMidWalkIsNotAppendedTwice() = runTest(dispatcher) {
        content.nextComments =
            Outcome.Success(Page(listOf(testComment("c1"), testComment("c2")), null, hasNextPage = false))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMoreComments()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.comments.map { it.id }).containsExactly("c1", "c2").inOrder()
    }

    @Test
    fun theThreadAsksForPendingEntriesByDefault() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.includePending).isTrue()
        assertThat(content.includePendingAsked).containsExactly(true)

        vm.setIncludePending(false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.includePendingAsked).containsExactly(true, false).inOrder()
    }

    @Test
    fun aCommentEditSignsAndClearsTheEditor() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onStartEditComment(testComment("c1"))
        vm.onEditDraftChange("better words")
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(content.editPrepared).isEqualTo(1)
        assertThat(s.editingCommentId).isNull()
        assertThat(s.commentSigned).isTrue()
    }

    @Test
    fun aReplyTargetsItsCommentAndSigns() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onStartReply("c1")
        vm.onReplyDraftChange("me too")
        vm.onSubmitReply()
        dispatcher.scheduler.advanceUntilIdle()
        // The reply is a genesis Review targeting the comment, not the
        // post (comment.md §1).
        assertThat(content.replyTargets).containsExactly("c1")
        assertThat(vm.state.value.replyingToId).isNull()
        assertThat(vm.state.value.commentSigned).isTrue()
    }

    @Test
    fun aRefusedReplySurfacesWithoutClosingTheComposer() = runTest(dispatcher) {
        content.prepareFails = true
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onStartReply("c1")
        vm.onReplyDraftChange("me too")
        vm.onSubmitReply()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.replyTransportFailed).isTrue()
        assertThat(vm.state.value.replyingToId).isEqualTo("c1")
    }

    @Test
    fun expandingRepliesAppendsPastThePrefetch() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val comment = testComment("c1").copy(
            replies = Page(listOf(testComment("r0")), "rc0", hasNextPage = true),
        )
        vm.onLoadMoreReplies(comment)
        dispatcher.scheduler.advanceUntilIdle()
        val thread = vm.state.value.replyThreads["c1"]
        checkNotNull(thread)
        // Seeded from the prefetch, extended by the fetched page.
        assertThat(thread.items.map { it.id }).containsExactly("r0", "r1").inOrder()
        assertThat(thread.hasMore).isFalse()
    }

    @Test
    fun aFailedReplyPageOffersRetryInPlace() = runTest(dispatcher) {
        content.repliesPage = Outcome.Failed(java.io.IOException("offline"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onLoadMoreReplies(testComment("c1"))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.replyThreads["c1"]?.failed).isTrue()
    }
}
