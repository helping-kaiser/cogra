package com.cogra.feature.topics

import com.cogra.domain.AuthTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.HashtagView
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileComment
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
import com.cogra.domain.TaggedNode
import com.cogra.domain.feed.CommittedFeedFilter
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.InMemoryCommittedFilterStore
import com.cogra.domain.testing.InMemoryReaderDefaultStore
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testHashtag
import com.cogra.domain.testing.testPost
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

private const val NAME = "rust"

@OptIn(ExperimentalCoroutinesApi::class)
class TopicViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    private val topics = object : ThrowingTopicRepository() {
        var hashtagOutcome: Outcome<HashtagView?> = Outcome.Success(testHashtag(NAME))
        var contentOutcome: Outcome<List<TaggedContentView>> = Outcome.Success(emptyList())

        override suspend fun hashtag(name: String): Outcome<HashtagView?> = hashtagOutcome

        override suspend fun taggedContent(
            name: String,
            limit: Int?,
            includePending: Boolean,
        ): Outcome<List<TaggedContentView>> = contentOutcome
    }

    // Signed out: the tracker holds nothing and sends nothing, which no
    // test here is about.
    private val seenTracker = FakeTokenStore().let { signedOut ->
        val scope = TestScope(dispatcher)
        SeenTracker(RecordingViewHistoryRepository(), signedOut, scope, testSeenRecord(signedOut, scope))
    }

    // The reader whose feed filter the page reads: signed in as u1.
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val defaults = InMemoryReaderDefaultStore()
    private val committedFilters = InMemoryCommittedFilterStore()

    private fun viewModel() = TopicViewModel(
        topics,
        seenTracker,
        webOrigin = "https://cogra.test",
        readerDefaults = ReaderDefaults(defaults, session),
        committed = CommittedFeedFilter(committedFilters, session),
    )

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
    fun aTransportFaultOnTheFirstReadSurfaces() = runTest(dispatcher) {
        topics.hashtagOutcome = Outcome.Failed(IllegalStateException("no route to host"))
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFailed).isTrue()
    }

    // The stance row's share hands over the tag's own web address, the one a
    // tag card's share hands over (`TagPage`'s row).
    @Test
    fun theShareHandsOverTheTagsOwnAddress() {
        assertThat(viewModel().shareUrl(NAME)).isEqualTo("https://cogra.test/topics/rust")
    }

    // -- The feed's Removed switch (TagPage.md:19-21) --

    private val removedRow = taggedPost("p-removed", removed = true)
    private val liveRow = taggedPost("p-live", removed = false)
    private val comment = taggedComment("c1")

    private fun derived(): List<String> {
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()
        return vm.state.value.content.map { it.id }
    }

    // TagPage.md:21 — with the feed's filter keeping Removed off (CoGra's own
    // default), a removed tagged post is not listed; the rest stand.
    @Test
    fun aRemovedTaggedPostIsNotListedWithTheFeedsRemovedOff() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Success(listOf(removedRow, liveRow, comment))
        assertThat(derived()).containsExactly("p-live", "c1").inOrder()
    }

    // TagPage.md:19 — the filter a feed's Done committed on this device has
    // Removed on: the removed tagged post stands in its row.
    @Test
    fun aRemovedTaggedPostStandsWithTheFeedsCommittedRemovedOn() = runTest(dispatcher) {
        committedFilters.stored["u1"] = FeedFilter(showRemoved = true)
        topics.contentOutcome = Outcome.Success(listOf(removedRow, liveRow, comment))
        assertThat(derived()).containsExactly("p-removed", "p-live", "c1").inOrder()
    }

    // TagPage.md:19 — with nothing committed, the feed opens with the reader's
    // saved default, and so does the page.
    @Test
    fun withNothingCommittedThePageReadsTheReadersSavedDefault() = runTest(dispatcher) {
        defaults.saved.value = mapOf("u1" to FeedFilter(showRemoved = true))
        topics.contentOutcome = Outcome.Success(listOf(removedRow))
        assertThat(derived()).containsExactly("p-removed")
    }

    // The committed filter wins over the default, as the feed opens with it.
    @Test
    fun aCommittedRemovedOffWinsOverADefaultWithItOn() = runTest(dispatcher) {
        defaults.saved.value = mapOf("u1" to FeedFilter(showRemoved = true))
        committedFilters.stored["u1"] = FeedFilter(showRemoved = false)
        topics.contentOutcome = Outcome.Success(listOf(removedRow))
        assertThat(derived()).isEmpty()
    }

    // TagPage.md:19-21 "WHEN the tag page is next derived" — the switch is read
    // at each derivation, never held from the first.
    @Test
    fun theSwitchIsReadEachTimeThePageIsDerived() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Success(listOf(removedRow))
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.content).isEmpty()

        committedFilters.stored["u1"] = FeedFilter(showRemoved = true)
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.content.map { it.id }).containsExactly("p-removed")
    }

    // TagPage.md:25 — a removed tagged comment is cut as a removed post is,
    // with the feed's filter keeping Removed off.
    @Test
    fun aRemovedTaggedCommentIsNotListedWithTheFeedsRemovedOff() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Success(listOf(removedComment, liveRow))
        assertThat(derived()).containsExactly("p-live")
    }

    // TagPage.md:23 — with Removed on, the removed tagged comment stands in its row.
    @Test
    fun aRemovedTaggedCommentStandsWithTheFeedsRemovedOn() = runTest(dispatcher) {
        committedFilters.stored["u1"] = FeedFilter(showRemoved = true)
        topics.contentOutcome = Outcome.Success(listOf(removedComment, liveRow))
        assertThat(derived()).containsExactly("c-removed", "p-live").inOrder()
    }

    // TagPage.md:65, :73 — the first read of what carries the tag getting no
    // answer is the page's fault, never the empty tag's line.
    @Test
    fun aFirstContentReadWithNoAnswerIsTheFault() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Failed(IllegalStateException("no route to host"))
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
    }

    // TagPage.md:67 — Retry reads the page again and it answers as the read does.
    @Test
    fun retryReadsThePageAgainAndAnswersAsTheReadDoes() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Failed(IllegalStateException("no route to host"))
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()
        topics.contentOutcome = Outcome.Success(listOf(liveRow))
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isFalse()
        assertThat(vm.state.value.content.map { it.id }).containsExactly("p-live")
    }

    // A later read that gets no answer keeps the rows the page already drew.
    @Test
    fun aLaterReadWithNoAnswerKeepsTheRows() = runTest(dispatcher) {
        topics.contentOutcome = Outcome.Success(listOf(liveRow))
        val vm = viewModel()
        vm.start(NAME)
        dispatcher.scheduler.advanceUntilIdle()
        topics.contentOutcome = Outcome.Failed(IllegalStateException("no route to host"))
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isFalse()
        assertThat(vm.state.value.content.map { it.id }).containsExactly("p-live")
    }

    private val removedComment = taggedComment("c-removed").copy(
        node = TaggedNode.Comment(
            ProfileComment(
                comment = testComment("c-removed").copy(removal = Removal(Instant.now(), RemovalAgent.AUTHOR)),
                target = null,
                threadPostId = "p9",
            ),
        ),
    )

    private fun taggedPost(id: String, removed: Boolean) = taggedPost(id).copy(
        node = TaggedNode.Post(
            testPost(id).let { post ->
                if (removed) post.copy(content = ModeratedField(null, FieldStatus.REDACTED)) else post
            },
        ),
    )

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
