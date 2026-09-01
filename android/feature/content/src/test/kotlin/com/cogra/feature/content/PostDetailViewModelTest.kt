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

        /** The self-mark the standing comment carries, for the edit to re-state. */
        var selfMark: SelfMarkView = SelfMarkView(sensitive = false, reason = null)

        override suspend fun commentSelfMark(id: String): Outcome<SelfMarkView?> =
            Outcome.Success(selfMark)

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

    private fun viewModel() = PostDetailViewModel(
        content,
        topics,
        references,
        WriteSigner(sealer, identity),
        landings,
        identity,
        reveals,
    )

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

    @Test
    fun aCommentDeclaresItsTopicsOnTheCreationInput() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.onTagInputChange(TagTarget.COMMENT, "#Rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onTagRelevanceChange(TagTarget.COMMENT, "rust", 0.7)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastCommentTags).containsExactly(TagClaim("rust", 0.7, 1.0))
        assertThat(vm.state.value.commentSigned).isTrue()
        // The tags rode the mutation, so no standalone Tag was staged.
        assertThat(topics.calls).isEmpty()
    }

    /** The whole batch — the Review and every Tag beside it — signs in one pass. */
    @Test
    fun everyWriteInACommentBatchIsSigned() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onTagInputChange(TagTarget.COMMENT, "kotlin")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        // Three staged writes, three completed handshakes.
        assertThat(sealer.staged).hasSize(3)
        assertThat(vm.state.value.commentSigned).isTrue()
        assertThat(vm.state.value.commentTags.tags).isEmpty()
    }

    @Test
    fun theCommentIndicatorCountsTheMintingWriteAndEachTopic() = runTest(dispatcher) {
        val vm = startedVm()
        assertThat(vm.state.value.commentSignedActions).isEqualTo(1)
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        assertThat(vm.state.value.commentSignedActions).isEqualTo(2)
    }

    @Test
    fun aReplyDeclaresItsOwnTopics() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartReply("c1")
        vm.onReplyDraftChange("me too")
        vm.onTagInputChange(TagTarget.REPLY, "kotlin")
        vm.onAddTag(TagTarget.REPLY)
        vm.onSubmitReply()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastCommentTags.map { it.name }).containsExactly("kotlin")
        assertThat(vm.state.value.replyTags.tags).isEmpty()
    }

    /** Each box holds its own chips: a reply's topics are not the comment box's. */
    @Test
    fun theCommentAndReplySectionsStaySeparate() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onStartReply("c1")
        vm.onTagInputChange(TagTarget.REPLY, "kotlin")
        vm.onAddTag(TagTarget.REPLY)

        assertThat(vm.state.value.commentTags.tags.map { it.name }).containsExactly("rust")
        assertThat(vm.state.value.replyTags.tags.map { it.name }).containsExactly("kotlin")
    }

    @Test
    fun openingAFreshReplyBoxStartsWithNoChips() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartReply("c1")
        vm.onTagInputChange(TagTarget.REPLY, "rust")
        vm.onAddTag(TagTarget.REPLY)
        vm.onStartReply("c2")
        assertThat(vm.state.value.replyTags.tags).isEmpty()
    }

    /** F2: the server's own words land on the chip its path names. */
    @Test
    fun aRefusedTopicLandsOnItsChip() = runTest(dispatcher) {
        content.commentRefusal = listOf(
            UserError(ErrorCode.BAD_INPUT, "`x` is not a legal topic name", listOf("tags", "0", "name")),
        )
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.commentTags.tags.single().error)
            .isEqualTo("`x` is not a legal topic name")
        // Nothing was staged, so nothing may claim the write was refused
        // without saying why — the chip carries it.
        assertThat(vm.state.value.refused).isFalse()
        assertThat(vm.state.value.signingFailed).isFalse()
    }

    @Test
    fun aRefusalNamingNoChipStillSurfaces() = runTest(dispatcher) {
        content.commentRefusal = listOf(UserError(ErrorCode.FORBIDDEN, "not a member", null))
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refused).isTrue()
    }

    // -- The multi-action confirm on the comment surfaces (F4) --

    @Test
    fun aSingleActionCommentNeverAsks() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDraftChange("Great post")
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmPending).isNull()
        assertThat(vm.state.value.commentSigned).isTrue()
    }

    @Test
    fun aTaggedCommentAsksBeforeSigning() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDraftChange("Great post")
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmPending).isEqualTo(TagTarget.COMMENT)
        assertThat(content.commentPrepared).isEqualTo(0)

        vm.onConfirmSubmit(dontAskAgain = false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmPending).isNull()
        assertThat(vm.state.value.commentSigned).isTrue()
    }

    @Test
    fun dismissingTheConfirmStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDraftChange("Great post")
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissConfirm()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmPending).isNull()
        assertThat(content.commentPrepared).isEqualTo(0)
        assertThat(vm.state.value.draft).isEqualTo("Great post")
    }

    @Test
    fun theDontAskAgainCheckboxIsRememberedOnTheDevice() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDraftChange("Great post")
        vm.onTagInputChange(TagTarget.COMMENT, "rust")
        vm.onAddTag(TagTarget.COMMENT)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onConfirmSubmit(dontAskAgain = true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.confirmMultiAction.value).isFalse()
    }

    // -- Comment tags editable (F10) --

    private fun taggedComment() = testComment("c1").copy(
        topics = listOf(testTopicClaim("rust", relevance = 0.4, confidence = 0.9)),
    )

    @Test
    fun theEditorOpensOnTheCommentsRealStoredValues() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        val row = vm.state.value.editTags.tags.single()
        assertThat(row.name).isEqualTo("rust")
        assertThat(row.relevance).isEqualTo(0.4)
        assertThat(row.confidence).isEqualTo(0.9)
        // Loaded at those values, so leaving them alone declares nothing.
        assertThat(vm.state.value.editTags.changeCount).isEqualTo(0)
        assertThat(vm.state.value.editSignedActions).isEqualTo(0)
    }

    /** The post-edit precedent: an edit that changed nothing stages no record. */
    @Test
    fun anUnchangedEditStagesNothing() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.editPrepared).isEqualTo(0)
        assertThat(topics.calls).isEmpty()
    }

    /** Tags change, text does not: Tag acts only, no edit record. */
    @Test
    fun aTagOnlyEditStagesNoEditRecord() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onTagInputChange(TagTarget.EDIT, "kotlin")
        vm.onAddTag(TagTarget.EDIT)
        assertThat(vm.state.value.editSignedActions).isEqualTo(1)

        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.editPrepared).isEqualTo(0)
        assertThat(topics.calls.map { it.name }).containsExactly("kotlin")
        assertThat(vm.state.value.commentSigned).isTrue()
    }

    /** Text change plus tag change: the edit record and each Tag act. */
    @Test
    fun aTextAndTagEditStagesBothKindsOfRecord() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onEditDraftChange("reworded")
        vm.onTagInputChange(TagTarget.EDIT, "kotlin")
        vm.onAddTag(TagTarget.EDIT)
        assertThat(vm.state.value.editSignedActions).isEqualTo(2)

        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.editPrepared).isEqualTo(1)
        assertThat(topics.calls.map { it.name }).containsExactly("kotlin")
    }

    /** A withdrawal is a Tag act at relevance 0 (hashtag.md §4). */
    @Test
    fun unTaggingStagesARelevanceZeroAct() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onRemoveTag(TagTarget.EDIT, "rust")
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()

        val call = topics.calls.single()
        assertThat(call.target).isEqualTo("c1")
        assertThat(call.name).isEqualTo("rust")
        assertThat(call.pDirected).isEqualTo(0.0)
    }

    /** Re-declaring at new parameters is its own act, not a no-op. */
    @Test
    fun reTuningALoadedTagStagesItsOwnAct() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onTagRelevanceChange(TagTarget.EDIT, "rust", 0.8)
        assertThat(vm.state.value.editSignedActions).isEqualTo(1)

        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        val call = topics.calls.single()
        assertThat(call.name).isEqualTo("rust")
        assertThat(call.pDirected).isEqualTo(0.8)
        assertThat(call.pInterest).isEqualTo(0.9)
    }

    /**
     * Every record is prepared before anything is signed, so a refusal
     * partway through leaves no half-signed batch (F10).
     */
    @Test
    fun aRefusedTagStopsTheEditBeforeAnySigning() = runTest(dispatcher) {
        topics.outcomeFor = { name ->
            if (name == "kotlin") {
                Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no", null)))
            } else {
                null
            }
        }
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onEditDraftChange("reworded")
        vm.onTagInputChange(TagTarget.EDIT, "kotlin")
        vm.onAddTag(TagTarget.EDIT)
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.editTags.tags.single { it.name == "kotlin" }.error).isEqualTo("no")
        // Nothing was signed, so nothing claims signing failed (F2).
        assertThat(vm.state.value.editSigningFailed).isFalse()
        assertThat(sealer.staged).isEmpty()
        assertThat(vm.state.value.editingCommentId).isEqualTo("c1")
    }

    @Test
    fun cancellingTheEditDropsItsStagedTags() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartEditComment(taggedComment())
        vm.onTagInputChange(TagTarget.EDIT, "kotlin")
        vm.onAddTag(TagTarget.EDIT)
        vm.onCancelEditComment()
        assertThat(vm.state.value.editTags.tags).isEmpty()
        assertThat(vm.state.value.editingCommentId).isNull()
    }

    @Test
    fun aMultiActionEditAsksBeforeSigning() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onStartEditComment(taggedComment())
        vm.onEditDraftChange("reworded")
        vm.onTagInputChange(TagTarget.EDIT, "kotlin")
        vm.onAddTag(TagTarget.EDIT)
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmPending).isEqualTo(TagTarget.EDIT)
        assertThat(content.editPrepared).isEqualTo(0)

        vm.onConfirmSubmit(dontAskAgain = false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.editPrepared).isEqualTo(1)
        assertThat(vm.state.value.commentSigned).isTrue()
    }

    // -- Comment references (D10, D11, D20) --

    private fun PostDetailViewModel.stageReferenceOn(
        target: TagTarget,
        targetId: String = "u1",
    ) {
        references.candidates = listOf(ReferenceCandidateView(testMentionTarget("ada"), targetId))
        onOpenFinder(target)
        onFinderQueryChange(target, "@ada")
        dispatcher.scheduler.advanceUntilIdle()
        onPickReference(target, state.value.referenceSection(target).finder!!.candidates.single())
    }

    @Test
    fun aCommentDeclaresItsReferencesOnTheCreationInput() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.stageReferenceOn(TagTarget.COMMENT)
        vm.onReferenceSupportChange(TagTarget.COMMENT, "u1", -0.5)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastCommentReferences)
            .containsExactly(ReferenceClaim("u1", relevance = 0.1, support = -0.5))
        // The references rode the mutation, so no standalone act was staged.
        assertThat(references.added).isEmpty()
    }

    @Test
    fun aReplyDeclaresItsOwnReferences() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onStartReply("c1")
        vm.onReplyDraftChange("Replying")
        vm.stageReferenceOn(TagTarget.REPLY, "u2")
        vm.onSubmitReply()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.lastCommentReferences.map { it.targetId }).containsExactly("u2")
    }

    /** Each section holds its own citations; one does not leak into another. */
    @Test
    fun theCommentAndReplyReferenceSectionsStaySeparate() = runTest(dispatcher) {
        val vm = startedVm()
        vm.stageReferenceOn(TagTarget.COMMENT, "u1")
        vm.onStartReply("c1")
        vm.stageReferenceOn(TagTarget.REPLY, "u2")
        assertThat(vm.state.value.commentReferences.references.map { it.targetId })
            .containsExactly("u1")
        assertThat(vm.state.value.replyReferences.references.map { it.targetId })
            .containsExactly("u2")
    }

    @Test
    fun theCommentIndicatorCountsTheMintingWriteEachTopicAndEachReference() =
        runTest(dispatcher) {
            val vm = startedVm()
            vm.onTagInputChange(TagTarget.COMMENT, "rust")
            vm.onAddTag(TagTarget.COMMENT)
            vm.stageReferenceOn(TagTarget.COMMENT)
            assertThat(vm.state.value.commentSignedActions).isEqualTo(3)
        }

    @Test
    fun everyWriteInAReferencedCommentBatchIsSigned() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.stageReferenceOn(TagTarget.COMMENT)
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.commentSigned).isTrue()
        assertThat(vm.state.value.signingFailed).isFalse()
    }

    @Test
    fun aRefusedReferenceLandsOnItsChip() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.stageReferenceOn(TagTarget.COMMENT)
        content.commentRefusal = listOf(
            UserError(
                code = ErrorCode.UNKNOWN,
                message = "An artifact cannot cite itself.",
                field = listOf("references", "0", "target"),
            ),
        )
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.commentReferences.references.single().error)
            .isEqualTo("An artifact cannot cite itself.")
        assertThat(vm.state.value.refused).isFalse()
    }

    /** A whole-batch refusal names no field and says its piece once (D19). */
    @Test
    fun aWholeBatchRefusalOnACommentMarksNoReferenceChip() = runTest(dispatcher) {
        val vm = startedVm()
        vm.onDraftChange("Great post")
        vm.stageReferenceOn(TagTarget.COMMENT)
        content.commentRefusal = listOf(
            UserError(ErrorCode.UNKNOWN, "Your balance cannot carry all 2 actions.", null),
        )
        vm.onSubmitComment()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refused).isTrue()
        assertThat(vm.state.value.commentReferences.references.single().error).isNull()
    }

    // -- The inline editor manages citations after publication (F10, D11) --

    private fun editingComment(claims: List<ReferenceClaimView>): CommentView {
        val comment = testComment("c1").copy(references = claims)
        content.detail = Outcome.Success(
            PostDetail(
                post = testPost("post-1"),
                comments = Page(listOf(comment), "cc1", hasNextPage = false),
            ),
        )
        return comment
    }

    private fun startedVmEditing(vararg claims: ReferenceClaimView): PostDetailViewModel {
        val comment = editingComment(claims.toList())
        return startedVm().also {
            it.onStartEditComment(comment)
            dispatcher.scheduler.advanceUntilIdle()
        }
    }

    /** The confirm left on, for the batches that have to ask (D11). */
    private fun viewModelWithConfirm(vararg claims: ReferenceClaimView): PostDetailViewModel {
        val comment = editingComment(claims.toList())
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onStartEditComment(comment)
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    @Test
    fun theEditorOpensOnTheCommentsStoredCitations() = runTest(dispatcher) {
        val vm = startedVmEditing(
            testReferenceClaim(testMentionTarget("ada"), relevance = 0.7, support = -0.2),
        )
        val row = vm.state.value.editReferences.references.single()
        assertThat(row.targetId).isEqualTo("user-ada")
        assertThat(row.relevance).isEqualTo(0.7)
        assertThat(row.support).isEqualTo(-0.2)
        // Opened and left alone: nothing staged.
        assertThat(vm.state.value.editSignedActions).isEqualTo(0)
    }

    @Test
    fun aReferenceOnlyCommentEditStagesNoEditRecord() = runTest(dispatcher) {
        val vm = startedVmEditing()
        vm.stageReferenceOn(TagTarget.EDIT)
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.editPrepared).isEqualTo(0)
        assertThat(references.added).containsExactly(ReferenceCall("c1", "u1", 0.1, 0.1))
    }

    @Test
    fun unReferencingACommentStagesAWithdrawal() = runTest(dispatcher) {
        val vm = startedVmEditing(testReferenceClaim(testMentionTarget("ada")))
        vm.onRemoveReference(TagTarget.EDIT, "user-ada")
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(references.withdrawn).containsExactly("c1" to "user-ada")
    }

    /**
     * The count the editor shows is the claim's own served cost, so an
     * edit carrying a withdrawal asks before it stages anything — the
     * same order every other multi-act submit follows (B4).
     */
    @Test
    fun aCommentWithdrawalAsksBeforeItStages() = runTest(dispatcher) {
        references.withdrawalRecords = 3
        val vm = viewModelWithConfirm(
            testReferenceClaim(testMentionTarget("ada"), withdrawalCost = 3),
        )
        vm.onRemoveReference(TagTarget.EDIT, "user-ada")
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmPending).isEqualTo(TagTarget.EDIT)
        assertThat(vm.state.value.editWithdrawalCost).isEqualTo(3)
        assertThat(vm.state.value.commentSigned).isFalse()
        assertThat(references.withdrawn).isEmpty()

        vm.onConfirmSubmit(dontAskAgain = false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.commentSigned).isTrue()
        assertThat(references.withdrawn).hasSize(1)
    }

    @Test
    fun dismissingACommentWithdrawalConfirmStagesNothing() = runTest(dispatcher) {
        references.withdrawalRecords = 2
        val vm = viewModelWithConfirm(
            testReferenceClaim(testMentionTarget("ada"), withdrawalCost = 2),
        )
        vm.onRemoveReference(TagTarget.EDIT, "user-ada")
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.commentSigned).isFalse()
        assertThat(vm.state.value.confirmPending).isNull()
        assertThat(vm.state.value.editSubmitting).isFalse()
        assertThat(references.withdrawn).isEmpty()
    }

    @Test
    fun cancellingTheCommentEditDropsItsStagedReferences() = runTest(dispatcher) {
        val vm = startedVmEditing()
        vm.stageReferenceOn(TagTarget.EDIT)
        vm.onCancelEditComment()
        assertThat(vm.state.value.editReferences.references).isEmpty()
        assertThat(vm.state.value.editWithdrawalCost).isNull()
    }

    /**
     * An untypeable citation carries no L2 id, so no write could name
     * it — it never enters the editor, and its absence there must not
     * be read as a removal.
     */
    @Test
    fun anUntypeableCitationNeverEntersTheCommentEditor() = runTest(dispatcher) {
        val vm = startedVmEditing(
            testReferenceClaim(testMentionTarget("ada")),
            testReferenceClaim(target = null),
        )
        assertThat(vm.state.value.editReferences.references.map { it.targetId })
            .containsExactly("user-ada")
        vm.onSubmitCommentEdit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(references.withdrawn).isEmpty()
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
