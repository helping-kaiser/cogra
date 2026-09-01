package com.cogra.feature.content

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.CommentView
import com.cogra.domain.ErrorCode
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.UserError
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.NodeLanding
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testContentTarget
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.cogra.domain.topics.TagClaim
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
    private val reveals = SensitiveReveals()
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

        /** The gallery the last comment edit left standing. */
        var lastEditAttachments: List<AttachmentClaim> = emptyList()

        /** The self-mark the last comment edit left standing. */
        var lastEditSensitive: Boolean? = null

        override suspend fun prepareCommentEdit(
            id: String,
            content: String,
            attachments: List<AttachmentClaim>,
            sensitive: Boolean,
            sensitiveReason: String?,
        ): Outcome<PreparedContentView> {
            if (prepareFails) return Outcome.Failed(java.io.IOException("offline"))
            editPrepared += 1
            lastEditAttachments = attachments
            lastEditSensitive = sensitive
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

        /** The topics the last comment/reply creation declared (F9). */
        var lastCommentTags: List<TagClaim> = emptyList()

        /** A refusal the creation path hands back, when set (F2). */
        var commentRefusal: List<UserError>? = null

        /** The references the last comment/reply creation declared. */
        var lastCommentReferences: List<ReferenceClaim> = emptyList()

        /** The gallery the last comment/reply creation carried. */
        var lastCommentAttachments: List<AttachmentClaim> = emptyList()


        override suspend fun prepareComment(
            target: String,
            content: String,
            license: LicenseChoice,
            tags: List<TagClaim>,
            references: List<ReferenceClaim>,
            attachments: List<AttachmentClaim>,
            pDirected: Double?,
            pInterest: Double?,
        ): Outcome<PreparedContentView> {
            replyTargets += target
            commentPrepared += 1
            lastCommentTags = tags
            lastCommentReferences = references
            lastCommentAttachments = attachments
            if (prepareFails) return Outcome.Failed(IOException("offline"))
            commentRefusal?.let { return Outcome.Refused(it) }
            return Outcome.Success(
                PreparedContentView(
                    "comment-node",
                    // The server stages the minting Review, then one Tag
                    // record per declared topic and one Reference per
                    // declared citation — the whole batch signs in the
                    // one pass.
                    listOf(sealer.stage(Family.REVIEW)) +
                        tags.map { sealer.stage(Family.TAG) } +
                        references.map { sealer.stage(Family.REFERENCE) },
                ),
            )
        }
    }

    private val topics = object : ThrowingTopicRepository() {
        val calls = mutableListOf<TagCall>()
        var outcomeFor: (String) -> Outcome<List<PreparedWriteView>>? = { null }

        override suspend fun prepareTag(
            target: String,
            name: String,
            pDirected: Double?,
            pInterest: Double?,
        ): Outcome<List<PreparedWriteView>> {
            calls += TagCall(target, name, pDirected, pInterest)
            return outcomeFor(name) ?: Outcome.Success(listOf(sealer.stage(Family.TAG)))
        }
    }

    private val references = object : ThrowingReferenceRepository() {
        val added = mutableListOf<ReferenceCall>()
        val withdrawn = mutableListOf<Pair<String, String>>()
        var candidates: List<ReferenceCandidateView> = emptyList()

        /** How many counter-records a withdrawal costs; the batch length is the quote (D11). */
        var withdrawalRecords = 1

        override suspend fun referenceCandidates(
            query: String,
            limit: Int?,
        ): Outcome<List<ReferenceCandidateView>> = Outcome.Success(candidates)

        override suspend fun prepareReference(
            artifact: String,
            target: String,
            relevance: Double?,
            support: Double?,
        ): Outcome<List<PreparedWriteView>> {
            added += ReferenceCall(artifact, target, relevance, support)
            return Outcome.Success(listOf(sealer.stage(Family.REFERENCE)))
        }

        override suspend fun prepareReferenceWithdrawal(
            artifact: String,
            target: String,
        ): Outcome<List<PreparedWriteView>> {
            withdrawn += artifact to target
            return Outcome.Success(List(withdrawalRecords) { sealer.stage(Family.REFERENCE) })
        }
    }

    private fun viewModel() = PostDetailViewModel(content, landings, reveals)

    /**
     * Most tests exercise the staging, not the confirm (F4): the device
     * has already said "don't ask", and the collector has read that
     * before the first submit.
     */
    private fun viewModelWithoutConfirm(): PostDetailViewModel {
        identity.confirmMultiAction.value = false
        return viewModel().also { dispatcher.scheduler.advanceUntilIdle() }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
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

    /**
     * A comment signed on the wizard comes back as a signal, and the
     * thread re-reads rather than merging the new entry into the page it
     * already holds — the refetched page is what carries the pending
     * marker the fresh comment wears.
     */
    @Test
    fun aCommentSignedOnTheWizardRefetchesTheThreadAndSaysSoOnce() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val readsBefore = content.detailReads

        vm.onCommentSigned()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.detailReads).isGreaterThan(readsBefore)
        assertThat(vm.state.value.commentSigned).isTrue()

        // The one-shot fires once: a recomposition never re-announces it.
        vm.onCommentSignedShown()
        assertThat(vm.state.value.commentSigned).isFalse()
    }

    /**
     * Opening a branch fetches it (Q49): nothing is prefetched, so the
     * thread starts empty and the read is what fills it.
     */
    @Test
    fun expandingRepliesFetchesTheBranch() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val comment = testComment("c1").copy(replyCount = 1)
        vm.onLoadMoreReplies(comment)
        dispatcher.scheduler.advanceUntilIdle()
        val thread = vm.state.value.replyThreads["c1"]
        checkNotNull(thread)
        assertThat(thread.items.map { it.id }).containsExactly("r1")
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

    // -- The value reveal (F8) --

    /** Nobody sees how strongly a topic is claimed unasked. */
    @Test
    fun noChipRowStartsRevealed() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.revealedTagRows).isEmpty()
    }

    @Test
    fun theRevealTogglesPerRowAndBackAgain() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onToggleTagValues("post-1")
        assertThat(vm.state.value.revealedTagRows).containsExactly("post-1")

        vm.onToggleTagValues("c1")
        assertThat(vm.state.value.revealedTagRows).containsExactly("post-1", "c1")

        vm.onToggleTagValues("post-1")
        assertThat(vm.state.value.revealedTagRows).containsExactly("c1")
    }

    // -- Comment compose gains tags (F9) --

    private fun startedVm(): PostDetailViewModel = viewModelWithoutConfirm().also {
        it.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
    }

    /** The reference row's reveal is its own; the tag row's stays shut. */
    @Test
    fun theReferenceRevealTogglesApartFromTheTagReveal() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onToggleReferenceValues("post-1")
        assertThat(vm.state.value.revealedReferenceRows).containsExactly("post-1")
        assertThat(vm.state.value.revealedTagRows).isEmpty()

        vm.onToggleReferenceValues("post-1")
        assertThat(vm.state.value.revealedReferenceRows).isEmpty()
    }
}
