package com.cogra.feature.content

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.OversightChoice
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ComposePostViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private val content = object : ThrowingContentRepository() {
        var prepareOutcome: Outcome<PreparedContentView>? = null
        var editOutcome: Outcome<PreparedContentView>? = null
        var lastCreate: List<Any?> = emptyList()
        var lastEdit: List<Any?> = emptyList()

        override suspend fun post(
            id: String,
            commentsFirst: Int,
            commentsAfter: String?,
        ): Outcome<PostDetail?> = Outcome.Success(
            PostDetail(
                post = testPost(id, title = "Loaded title", body = "Loaded body"),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )

        override suspend fun preparePost(
            title: String?,
            description: String?,
            content: String,
            license: LicenseChoice,
        ): Outcome<PreparedContentView> {
            lastCreate = listOf(title, description, content, license)
            return prepareOutcome ?: Outcome.Success(
                PreparedContentView("node-1", listOf(sealer.stage(Family.PUBLISH))),
            )
        }

        override suspend fun preparePostEdit(
            id: String,
            title: String?,
            description: String?,
            content: String,
        ): Outcome<PreparedContentView> {
            lastEdit = listOf(id, title, description, content)
            return editOutcome ?: Outcome.Success(
                PreparedContentView(id, listOf(sealer.stage(Family.PUBLISH))),
            )
        }
    }

    private fun viewModel() = ComposePostViewModel(content, WriteSigner(sealer, identity))

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun aCreateSignsAndReportsSaved() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTitleChange("A title")
        vm.onBodyChange("The body")
        vm.onAttributionChange(true)
        vm.onOversightChange(OversightChoice.CONDITIONAL)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        assertThat(content.lastCreate).containsExactly(
            "A title",
            null,
            "The body",
            LicenseChoice(attributionRequired = true, oversight = OversightChoice.CONDITIONAL),
        ).inOrder()
    }

    @Test
    fun anEmptyBodyRefusesLocallyWithoutPreparing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.emptyBody).isTrue()
        assertThat(vm.state.value.saved).isFalse()
        assertThat(content.lastCreate).isEmpty()
    }

    @Test
    fun editModePrefillsAndSubmitsTheFullFieldSet() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.title).isEqualTo("Loaded title")
        assertThat(vm.state.value.body).isEqualTo("Loaded body")

        vm.onTitleChange("")
        vm.onBodyChange("Edited body")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        // A blanked title rides as null — the clear (post.md §4).
        assertThat(content.lastEdit).containsExactly("post-9", null, null, "Edited body").inOrder()
    }

    @Test
    fun aRefusalAndATransportFaultRenderDistinctly() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("body")
        content.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.FORBIDDEN, "not a member")))
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refused).isTrue()

        content.prepareOutcome = Outcome.Failed(IOException("offline"))
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aSigningFailureIsNotSaved() = runTest(dispatcher) {
        // A prepared write the sealer never staged: the signer's submit
        // leg throws, the result is not Done.
        content.prepareOutcome = Outcome.Success(
            PreparedContentView(
                "node-1",
                listOf(
                    com.cogra.domain.PreparedWriteView(
                        id = "unknown",
                        family = Family.PUBLISH,
                        canonicalProposal = ByteArray(4),
                        gcAfterEpochs = 8,
                    ),
                ),
            ),
        )
        val vm = viewModel()
        vm.onBodyChange("body")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.signingFailed).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }
}
