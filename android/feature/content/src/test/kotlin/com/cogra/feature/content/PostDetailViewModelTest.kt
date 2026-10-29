package com.cogra.feature.content

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.CommentView
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.UserError
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.NodeLanding
import com.cogra.domain.content.SeenPosts
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
import kotlinx.coroutines.CompletableDeferred
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
import java.io.IOException
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class PostDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val landings = LandingSignal()
    private val reveals = SensitiveReveals()
    private val seenPosts = SeenPosts()
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
            // The answer as it stood when the read was asked, held until the
            // gate opens when the test overtakes the first read.
            val answer = detail
            if (detailReads == 1) firstReadGate?.await()
            return answer
        }

        /** Holds the first read's answer until completed (an overtaken read). */
        var firstReadGate: CompletableDeferred<Unit>? = null

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
            pDirected: Double,
            pInterest: Double,
            sensitive: Boolean,
            sensitiveReason: String?,
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
            pDirected: Double,
            pInterest: Double,
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
            kinds: Set<com.cogra.domain.feed.FeedKind>,
        ): Outcome<List<ReferenceCandidateView>> = Outcome.Success(candidates)

        override suspend fun prepareReference(
            artifact: String,
            target: String,
            relevance: Double,
            support: Double,
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

    private fun viewModel() = PostDetailViewModel(content, landings, reveals, seenPosts, WEB_ORIGIN)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun startLoadsThePost() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.post?.id).isEqualTo("post-1")
    }

    @Test
    fun aPostTheDeviceHasAlreadyReadPaintsBeforeItsOwnReadReturns() = runTest(dispatcher) {
        // HT-10: opening from the feed used to show a spinner over
        // nothing for a round trip, so the forward slide had nothing to
        // carry. The held copy is the first frame, never the answer.
        seenPosts.saw(testPost("post-1"))
        val vm = viewModel()
        vm.start("post-1")

        // Before the read has had a chance to come back.
        assertThat(vm.state.value.post?.id).isEqualTo("post-1")
        assertThat(vm.state.value.loading).isFalse()
        // And the read that catches up behind says NOTHING: an indicator
        // over a post the reader can already see claims the screen is
        // still arriving when it has arrived (F2-9).
        assertThat(vm.state.value.refreshing).isFalse()

        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.detailReads).isEqualTo(1)
        assertThat(vm.state.value.refreshing).isFalse()
    }

    @Test
    fun aPostTheDeviceHasNotSeenStillOpensEmptyAndLoading() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        assertThat(vm.state.value.post).isNull()
        assertThat(vm.state.value.loading).isTrue()
        // Empty is not the same as refreshing: the surface says what it
        // is doing in its own loading state, and the pull indicator
        // stays for the gesture that owns it.
        assertThat(vm.state.value.refreshing).isFalse()
    }

    @Test
    fun aReadersOwnPullIsTheOneReadThatReportsItself() = runTest(dispatcher) {
        seenPosts.saw(testPost("post-1"))
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refreshing).isFalse()

        vm.refresh()
        assertThat(vm.state.value.refreshing).isTrue()

        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refreshing).isFalse()
    }

    @Test
    fun eachReadHoldsThePostForTheNextOpen() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(seenPosts.lastSeen("post-1")?.id).isEqualTo("post-1")
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
    fun theDetailAsksForPendingEntriesByDefault() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.includePending).isTrue()
        assertThat(content.includePendingAsked).containsExactly(true)

        vm.setIncludePending(false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.includePendingAsked).containsExactly(true, false).inOrder()
    }

    // ---- FC-7b · THE DETAIL HOLDS WHAT WAS OPENED (PostDetail.md:5-13) -----

    private fun answer(post: PostView) {
        content.detail = Outcome.Success(PostDetail(post = post, comments = Page(emptyList(), null, false)))
    }

    private val opened = testPost("post-1")
    private val edited = testPost("post-1", title = "Edited").copy(updatedAt = Instant.ofEpochSecond(3_600))

    /** Opens the detail on the device's own copy and lets the opening read land. */
    private fun openOnto(painted: PostView, fresh: PostView): PostDetailViewModel {
        seenPosts.saw(painted)
        answer(fresh)
        return viewModel().also {
            it.start("post-1")
            dispatcher.scheduler.advanceUntilIdle()
        }
    }

    @Test
    fun anEditFoundOnRefreshHoldsTheSnapshotAndOffersTheNewVersion() = runTest(dispatcher) {
        val vm = openOnto(opened, edited)

        assertThat(vm.state.value.post).isEqualTo(opened)
        assertThat(vm.state.value.newer).isEqualTo(edited)
        // The freshest word still reaches the next open.
        assertThat(seenPosts.lastSeen("post-1")).isEqualTo(edited)
    }

    @Test
    fun aTagOrCitationChangeIsHeldTheSameWay() = runTest(dispatcher) {
        val retagged = opened.copy(topics = listOf(testTopicClaim("rust")))
        val vm = openOnto(opened, retagged)
        assertThat(vm.state.value.post).isEqualTo(opened)
        assertThat(vm.state.value.newer).isEqualTo(retagged)
    }

    @Test
    fun tappingTheLineSwapsTheNewestInAndTheLineGoes() = runTest(dispatcher) {
        val vm = openOnto(opened, edited)
        vm.swapToNewer()
        assertThat(vm.state.value.post).isEqualTo(edited)
        assertThat(vm.state.value.newer).isNull()
    }

    @Test
    fun theSameVersionIsTakenSilently() = runTest(dispatcher) {
        val grown = opened.copy(commentCount = 3)
        val vm = openOnto(opened, grown)
        assertThat(vm.state.value.post).isEqualTo(grown)
        assertThat(vm.state.value.newer).isNull()
    }

    @Test
    fun anEditedPostTheDeviceNeverHeldPaintsWithNoLine() = runTest(dispatcher) {
        answer(edited)
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.post).isEqualTo(edited)
        assertThat(vm.state.value.newer).isNull()
    }

    @Test
    fun theReadersOwnPullLandsOverTheHeldVersion() = runTest(dispatcher) {
        val vm = openOnto(opened, edited)
        val twice = edited.copy(updatedAt = Instant.ofEpochSecond(7_200))
        answer(twice)
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.post).isEqualTo(twice)
        assertThat(vm.state.value.newer).isNull()
    }

    // A reply landing asked for a reply, not for the post's newest version.
    @Test
    fun aReplysRecountHoldsAnotherVersionLikeAnyRead() = runTest(dispatcher) {
        val vm = openOnto(opened, opened)
        answer(edited)
        vm.recount()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.post).isEqualTo(opened)
        assertThat(vm.state.value.newer).isEqualTo(edited)
    }

    // THE LATEST READ ANSWERS: an opening read the reader's pull overtook
    // lands nothing — never a line offering a version older than the one on
    // screen.
    @Test
    fun noOvertakenReadLandsBehindTheReadersPull() = runTest(dispatcher) {
        seenPosts.saw(opened)
        content.firstReadGate = CompletableDeferred()
        answer(edited)
        val vm = viewModel()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()

        val twice = edited.copy(updatedAt = Instant.ofEpochSecond(7_200))
        answer(twice)
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        content.firstReadGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.post).isEqualTo(twice)
        assertThat(vm.state.value.newer).isNull()
    }

    @Test
    fun aFailedReadKeepsTheHeldVersionOnOffer() = runTest(dispatcher) {
        val vm = openOnto(opened, edited)
        content.detail = Outcome.Failed(IOException("offline"))
        vm.recount()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.newer).isEqualTo(edited)
    }

    // ---- FC-7c · A REDACTION PATCHES THROUGH (PostDetail.md:15) -------------

    @Test
    fun aRedactionPatchesThroughThePaintedSnapshotAtOnce() = runTest(dispatcher) {
        val gone = ModeratedField(null, FieldStatus.REDACTED)
        val removed = edited.copy(title = gone, description = gone, content = gone)
        val vm = openOnto(opened, removed)
        assertThat(vm.state.value.post).isEqualTo(removed)
        assertThat(vm.state.value.newer).isNull()
    }

    @Test
    fun aRedactionNeverWaitsBehindTheNewerVersionLine() = runTest(dispatcher) {
        // ONE PART removed, in the same read as an edit that alone would wait.
        val picture = MediaAssetView("m1", "https://example.invalid/m1.webp", null, FieldStatus.NORMAL, 1f)
        val gallery = opened.copy(attachments = listOf(picture, picture.copy(id = "m2")))
        val partGone = gallery.copy(
            updatedAt = Instant.ofEpochSecond(3_600),
            attachments = listOf(picture, picture.copy(id = "m2", status = FieldStatus.REDACTED)),
        )
        val vm = openOnto(gallery, partGone)
        assertThat(vm.state.value.post).isEqualTo(partGone)
        assertThat(vm.state.value.newer).isNull()
    }
}

/** The build's web origin, as the share link is built from it. */
private const val WEB_ORIGIN = "https://cogra.example"
