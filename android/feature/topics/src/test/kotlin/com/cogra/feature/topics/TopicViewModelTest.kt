package com.cogra.feature.topics

import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
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

    private fun viewModel() = TopicViewModel(topics)

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
