package com.cogra.feature.topics

import com.cogra.crypto.ActorKey
import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testHashtag
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

private const val NAME = "rust"

@OptIn(ExperimentalCoroutinesApi::class)
class TopicViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)

    private val topics = object : ThrowingTopicRepository() {
        var hashtagOutcome: Outcome<HashtagView?> = Outcome.Success(testHashtag(NAME))
        var contentOutcome: Outcome<List<TaggedContentView>> = Outcome.Success(emptyList())
        var net = StancePair.Origin
        var records = 0
        var standingFails = false
        val followed = mutableListOf<StancePair>()
        var prepareFollowOutcome: Outcome<List<PreparedWriteView>>? = null
        var prepareUnfollowOutcome: Outcome<List<PreparedWriteView>>? = null
        var unfollowCalls = 0

        override suspend fun hashtag(name: String): Outcome<HashtagView?> = hashtagOutcome

        override suspend fun taggedContent(
            name: String,
            limit: Int?,
            includePending: Boolean,
        ): Outcome<List<TaggedContentView>> = contentOutcome

        override suspend fun followStanding(name: String, includePending: Boolean): Outcome<StanceStanding> {
            if (standingFails) return Outcome.Failed(IllegalStateException("no route to host"))
            return Outcome.Success(StanceStanding(name, net, net, records, includePending))
        }

        override suspend fun prepareFollow(name: String, pick: StancePair): Outcome<List<PreparedWriteView>> {
            followed += pick
            val result = prepareFollowOutcome ?: writes.prepareStance(name, pick.pDirected, pick.pInterest)
            // Mirrors the backend's fold well enough for the follow flag
            // to move: a successful follow leaves a record behind.
            if (result is Outcome.Success) {
                records += 1
                net = pick
            }
            return result
        }

        override suspend fun followSeveranceQuote(name: String, includePending: Boolean): Outcome<SeveranceQuote> =
            Outcome.Success(SeveranceQuote(name, net, net, records, alreadySevered = net == StancePair.Origin))

        override suspend fun prepareUnfollow(name: String): Outcome<List<PreparedWriteView>> {
            unfollowCalls += 1
            val result = prepareUnfollowOutcome ?: Outcome.Success(listOf(writes.stage()))
            if (result is Outcome.Success) {
                records = 0
                net = StancePair.Origin
            }
            return result
        }
    }

    private fun viewModel() = TopicViewModel(topics, WriteSigner(writes, identity))

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun startLoadsTheHashtagAndItsContent() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Success(
            listOf(taggedPost("p1"), taggedComment("c1")),
        )
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.state.value.hashtag?.name?.value).isEqualTo(NAME)
        assertThat(vm.state.value.content).hasSize(2)
    }

    @Test
    fun aNullHashtagIsNotFound() = runTest(dispatcher) {
        topics.hashtagOutcome = Outcome.Success(null)
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.notFound).isTrue()
    }

    @Test
    fun startIsIdempotentOnceEntered() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(NAME)
        vm.start("other-name")
        dispatcher.scheduler.advanceUntilIdle()

        // The second start is ignored — the route entry fires once.
        assertThat(vm.state.value.hashtag?.name?.value).isEqualTo(NAME)
    }

    @Test
    fun readingStandingReportsWhetherTheViewerFollows() = runTest(dispatcher) {
        topics.records = 2
        topics.net = StancePair(0.1, 0.1)
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.standingRead).isTrue()
        assertThat(vm.state.value.following).isTrue()
    }

    @Test
    fun notFollowingByDefault() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.following).isFalse()
    }

    @Test
    fun followStagesTheTapDefaultAndSigns() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onFollow()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.followed).containsExactly(StancePair.TapDefault)
        assertThat(vm.state.value.followBusy).isFalse()
        assertThat(vm.state.value.followFailed).isFalse()
        assertThat(vm.state.value.following).isTrue()
    }

    @Test
    fun aKeylessDeviceMarksTheFollowFailureAsNeedsKey() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onFollow()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.followFailed).isTrue()
        assertThat(vm.state.value.followNeedsKey).isTrue()
    }

    @Test
    fun unfollowOpensTheConfirmAndConfirmingSevers() = runTest(dispatcher) {
        topics.records = 1
        topics.net = StancePair(0.1, 0.1)
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenUnfollow()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.severance).isNotNull()

        vm.onConfirmUnfollow()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.unfollowCalls).isEqualTo(1)
        assertThat(vm.state.value.severance).isNull()
        assertThat(vm.state.value.following).isFalse()
    }

    @Test
    fun dismissingTheUnfollowConfirmStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenUnfollow()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissUnfollow()

        assertThat(vm.state.value.severance).isNull()
        assertThat(topics.unfollowCalls).isEqualTo(0)
    }

    private fun taggedPost(id: String) = TaggedContentView(
        kind = TaggedContentKind.POST,
        id = id,
        title = "Title $id",
        snippet = "Body $id",
        authorHandle = "author",
        authorDisplayName = "Author",
        relevance = 0.1,
        confidence = 1.0,
        pending = false,
    )

    private fun taggedComment(id: String) = TaggedContentView(
        kind = TaggedContentKind.COMMENT,
        id = id,
        title = null,
        snippet = "Comment $id",
        authorHandle = "author",
        authorDisplayName = "Author",
        relevance = 0.1,
        confidence = 1.0,
        pending = false,
    )
}
