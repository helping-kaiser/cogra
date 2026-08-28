package com.cogra.feature.content

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.UserError
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testContentTarget
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.cogra.domain.topics.TAG_DEFAULT_CONFIDENCE
import com.cogra.domain.topics.TAG_DEFAULT_RELEVANCE
import com.cogra.domain.topics.TagClaim
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
        var lastCreateReferences: List<ReferenceClaim> = emptyList()
        var lastEdit: List<Any?> = emptyList()
        var editCalls = 0

        /** The topics the edited post already carries. */
        var loadedTopics: List<TopicClaimView> = emptyList()

        /** The references the edited post already carries. */
        var loadedReferences: List<ReferenceClaimView> = emptyList()

        override suspend fun post(
            id: String,
            commentsFirst: Int,
            commentsAfter: String?,
            includePending: Boolean,
        ): Outcome<PostDetail?> = Outcome.Success(
            PostDetail(
                post = testPost(id, title = "Loaded title", body = "Loaded body")
                    .copy(topics = loadedTopics, references = loadedReferences),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )

        override suspend fun preparePost(
            title: String?,
            description: String?,
            content: String,
            license: LicenseChoice,
            tags: List<TagClaim>,
            references: List<ReferenceClaim>,
        ): Outcome<PreparedContentView> {
            lastCreate = listOf(title, description, content, license, tags)
            lastCreateReferences = references
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
            editCalls += 1
            lastEdit = listOf(id, title, description, content)
            return editOutcome ?: Outcome.Success(
                PreparedContentView(id, listOf(sealer.stage(Family.PUBLISH))),
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
        var candidatesFail = false
        var lastQuery: String? = null

        /** How many counter-records a withdrawal costs; the batch length is the quote (D11). */
        var withdrawalRecords = 1
        var addOutcomeFor: (String) -> Outcome<List<PreparedWriteView>>? = { null }
        var withdrawOutcomeFor: (String) -> Outcome<List<PreparedWriteView>>? = { null }

        override suspend fun referenceCandidates(
            query: String,
            limit: Int?,
        ): Outcome<List<ReferenceCandidateView>> {
            lastQuery = query
            return if (candidatesFail) {
                Outcome.Failed(IOException("offline"))
            } else {
                Outcome.Success(candidates)
            }
        }

        override suspend fun prepareReference(
            artifact: String,
            target: String,
            relevance: Double?,
            support: Double?,
        ): Outcome<List<PreparedWriteView>> {
            added += ReferenceCall(artifact, target, relevance, support)
            return addOutcomeFor(target) ?: Outcome.Success(listOf(sealer.stage(Family.REFERENCE)))
        }

        override suspend fun prepareReferenceWithdrawal(
            artifact: String,
            target: String,
        ): Outcome<List<PreparedWriteView>> {
            withdrawn += artifact to target
            return withdrawOutcomeFor(target)
                ?: Outcome.Success(List(withdrawalRecords) { sealer.stage(Family.REFERENCE) })
        }
    }

    private fun viewModel() =
        ComposePostViewModel(content, topics, references, WriteSigner(sealer, identity), identity)

    /**
     * Most tests exercise the staging, not the confirm (F4): the device
     * has already said "don't ask", and the collector has read that
     * before the first submit.
     */
    private fun viewModelWithoutConfirm(): ComposePostViewModel {
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
    fun aKeylessDeviceMarksTheFailureAsNeedsKey() = runTest(dispatcher) {
        // The real signer with no seed: the genuine husk path, so the
        // screen can say "restore your key" instead of "stays pending".
        identity.seed = null
        val vm = viewModel()
        vm.onTitleChange("A title")
        vm.onBodyChange("The body")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.signingFailed).isTrue()
        assertThat(vm.state.value.signingNeedsKey).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }

    // The saved flag is a one-shot: the caller navigates once, and a
    // consumed flag must not re-fire on the next recomposition.
    @Test
    fun consumingTheSavedFlagLeavesTheComposerAtRest() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("The body")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()

        vm.onSavedConsumed()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aCreateSignsAndReportsSaved() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTitleChange("A title")
        vm.onBodyChange("The body")
        vm.onLicenseChange(LicenseChoice(attribution = 1.0, provenance = 0.5))
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        assertThat(content.lastCreate).containsExactly(
            "A title",
            null,
            "The body",
            LicenseChoice(attribution = 1.0, provenance = 0.5),
            emptyList<TagClaim>(),
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
    fun aTransportFaultRendersDistinctlyFromARefusal() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("body")
        content.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.FORBIDDEN, "not a member")))
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refusal).isEqualTo("not a member")

        content.prepareOutcome = Outcome.Failed(IOException("offline"))
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }

    // -- Topics (D15: no autocomplete; D18: cap at 10; F1 gating) --

    @Test
    fun addingATagCanonicalizesAndStagesAChip() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTagInputChange("  #Rust  ")
        vm.onAddTag()
        assertThat(vm.state.value.tagSection.tags.map { it.name }).containsExactly("rust")
        assertThat(vm.state.value.tagSection.input).isEmpty()
    }

    @Test
    fun aFreshChipCarriesTheDefaultParameters() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTagInputChange("rust")
        vm.onAddTag()
        val row = vm.state.value.tagSection.tags.single()
        assertThat(row.relevance).isEqualTo(TAG_DEFAULT_RELEVANCE)
        assertThat(row.confidence).isEqualTo(TAG_DEFAULT_CONFIDENCE)
    }

    @Test
    fun addingBlankOrHashOnlyTextStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTagInputChange("   ")
        vm.onAddTag()
        vm.onTagInputChange("#")
        vm.onAddTag()
        assertThat(vm.state.value.tagSection.tags).isEmpty()
    }

    /** F1: the atom rule refuses before anything is staged. */
    @Test
    fun anIllegalNameIsNeverStaged() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTagInputChange("two words")
        vm.onAddTag()
        vm.onTagInputChange("café")
        vm.onAddTag()
        assertThat(vm.state.value.tagSection.tags).isEmpty()
        // The text stays put, so the reader can fix it.
        assertThat(vm.state.value.tagSection.input).isEqualTo("café")
    }

    @Test
    fun reAddingACanonicalDuplicateDoesNotDoubleTheChip() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onTagInputChange("RUST")
        vm.onAddTag()
        assertThat(vm.state.value.tagSection.tags.map { it.name }).containsExactly("rust")
    }

    @Test
    fun removingATagTakesItOutOfTheBatch() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        vm.onRemoveTag("rust")
        assertThat(vm.state.value.tagSection.tags.map { it.name }).containsExactly("kotlin")
    }

    @Test
    fun theBatchCapsAtTenAndRefusesLocally() = runTest(dispatcher) {
        val vm = viewModel()
        repeat(11) { i ->
            vm.onTagInputChange("tag$i")
            vm.onAddTag()
        }
        assertThat(vm.state.value.tagSection.tags).hasSize(10)
        assertThat(vm.state.value.tagSection.capReached).isTrue()
        // The 11th entry's text is still sitting in the field, unconsumed.
        assertThat(vm.state.value.tagSection.input).isEqualTo("tag10")
    }

    /** F6: the sliders' values ride the create mutation. */
    @Test
    fun submittingSendsTheStagedTagsWithTheirParameters() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("The body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onTagRelevanceChange("rust", 0.75)
        vm.onTagConfidenceChange("rust", 0.5)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastCreate.last()).isEqualTo(listOf(TagClaim("rust", 0.75, 0.5)))
    }

    @Test
    fun aSigningFailureIsNotSaved() = runTest(dispatcher) {
        // A prepared write the sealer never staged: the signer's submit
        // leg throws, the result is not Done.
        content.prepareOutcome = Outcome.Success(
            PreparedContentView(
                "node-1",
                listOf(
                    PreparedWriteView(
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

    // -- The edit screen's tags section (F3) --

    @Test
    fun theEditScreenLoadsTheCurrentTags() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("rust", relevance = 0.4, confidence = 0.9))
        val vm = viewModel()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        val row = vm.state.value.tagSection.tags.single()
        assertThat(row.name).isEqualTo("rust")
        assertThat(row.relevance).isEqualTo(0.4)
        assertThat(row.confidence).isEqualTo(0.9)
    }

    @Test
    fun anAddedTagOnTheEditScreenStagesItsOwnTagAct() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("rust"))
        val vm = viewModelWithoutConfirm()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.calls).containsExactly(
            TagCall("post-9", "kotlin", TAG_DEFAULT_RELEVANCE, TAG_DEFAULT_CONFIDENCE),
        )
        // Content untouched: no edit record rides along.
        assertThat(content.editCalls).isEqualTo(0)
        assertThat(vm.state.value.saved).isTrue()
    }

    /** A withdrawal is a Tag at relevance 0 (hashtag.md §4). */
    @Test
    fun aRemovedTagStagesAWithdrawal() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("rust"))
        val vm = viewModelWithoutConfirm()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onRemoveTag("rust")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.calls).hasSize(1)
        assertThat(topics.calls.single().name).isEqualTo("rust")
        assertThat(topics.calls.single().pDirected).isEqualTo(0.0)
    }

    /** Re-declaring at a new relevance is its own act, not a no-op. */
    @Test
    fun retuningAnExistingTagStagesAFreshTagAct() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("rust", relevance = 0.1))
        val vm = viewModelWithoutConfirm()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTagRelevanceChange("rust", 0.8)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.calls.single().pDirected).isEqualTo(0.8)
        assertThat(topics.calls.single().name).isEqualTo("rust")
    }

    @Test
    fun anEditAndItsTagChangesRideOneSigningPass() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("rust"))
        val vm = viewModelWithoutConfirm()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onBodyChange("Edited body")
        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        vm.onRemoveTag("rust")
        assertThat(vm.state.value.signedActionCount).isEqualTo(3)

        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.editCalls).isEqualTo(1)
        assertThat(topics.calls.map { it.name }).containsExactly("kotlin", "rust")
        // One saved flag for the whole batch: one signing flow.
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun anUntouchedEditStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
        assertThat(vm.state.value.nothingToSign).isTrue()

        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.editCalls).isEqualTo(0)
        assertThat(vm.state.value.saved).isFalse()
    }

    // -- Error routing (F2) --

    @Test
    fun aFieldRefusalLandsOnTheChipTheServerNamed() = runTest(dispatcher) {
        content.prepareOutcome = Outcome.Refused(
            listOf(
                UserError(
                    ErrorCode.BAD_INPUT,
                    "`kotlin` is not a legal topic name: bad",
                    listOf("tags", "1", "name"),
                ),
            ),
        )
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.tagSection.tags[1].error).isEqualTo("`kotlin` is not a legal topic name: bad")
        assertThat(vm.state.value.tagSection.tags[0].error).isNull()
        // A pre-staging refusal never claims signing failed.
        assertThat(vm.state.value.signingFailed).isFalse()
        assertThat(vm.state.value.refusal).isNull()
    }

    @Test
    fun aRefusalNamingNoChipSurfacesOnItsOwn() = runTest(dispatcher) {
        content.prepareOutcome = Outcome.Refused(
            listOf(UserError(ErrorCode.BAD_INPUT, "the body is empty", listOf("content"))),
        )
        val vm = viewModel()
        vm.onBodyChange("body")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.refusal).isEqualTo("the body is empty")
        assertThat(vm.state.value.signingFailed).isFalse()
    }

    /** A standalone Tag names one chip by construction (F2). */
    @Test
    fun aStandaloneTagRefusalLandsOnItsOwnChipAndSignsNothing() = runTest(dispatcher) {
        topics.outcomeFor = { name ->
            if (name == "kotlin") {
                Outcome.Refused(
                    listOf(UserError(ErrorCode.BAD_INPUT, "`kotlin` is not a legal topic name", listOf("name"))),
                )
            } else {
                null
            }
        }
        val vm = viewModelWithoutConfirm()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.tagSection.tags.single().error)
            .isEqualTo("`kotlin` is not a legal topic name")
        assertThat(vm.state.value.signingFailed).isFalse()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aFreshSubmitClearsTheChipErrorsFirst() = runTest(dispatcher) {
        content.prepareOutcome = Outcome.Refused(
            listOf(UserError(ErrorCode.BAD_INPUT, "no", listOf("tags", "0", "name"))),
        )
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.tagSection.tags.single().error).isEqualTo("no")

        content.prepareOutcome = null
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()
        assertThat(vm.state.value.tagSection.tags.single().error).isNull()
    }

    // -- The signed-action count and its confirm (F4) --

    @Test
    fun aCreateCountsTheMintingRecordAndEachTag() = runTest(dispatcher) {
        val vm = viewModel()
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        assertThat(vm.state.value.signedActionCount).isEqualTo(3)
    }

    @Test
    fun anEditCountsOnlyWhatChanged() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("rust"))
        val vm = viewModel()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)

        vm.onBodyChange("Edited body")
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)

        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        assertThat(vm.state.value.signedActionCount).isEqualTo(2)

        vm.onRemoveTag("rust")
        assertThat(vm.state.value.signedActionCount).isEqualTo(3)
    }

    /** Typing the loaded body back in leaves nothing for the edit record to say. */
    @Test
    fun revertingAnEditDropsTheRecordFromTheCount() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("post-9")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onBodyChange("Edited body")
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.onBodyChange("Loaded body")
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    @Test
    fun oneSignedActionSubmitsWithoutAsking() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("body")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmPending).isFalse()
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun aBatchAsksBeforeItSigns() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmPending).isTrue()
        assertThat(content.lastCreate).isEmpty()
        assertThat(vm.state.value.saved).isFalse()

        vm.onConfirmSubmit(dontAskAgain = false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmPending).isFalse()
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun dismissingTheConfirmStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onDismissConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmPending).isFalse()
        assertThat(content.lastCreate).isEmpty()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun dontAskAgainPersistsAndTheNextBatchGoesStraightThrough() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onConfirmSubmit(dontAskAgain = true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.confirmMultiAction.value).isFalse()

        vm.onSavedConsumed()
        vm.onTagInputChange("kotlin")
        vm.onAddTag()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmPending).isFalse()
        assertThat(vm.state.value.saved).isTrue()
    }

    /** Settings turns the confirm back on, and a composer already open sees it. */
    @Test
    fun theSettingReachesAnOpenComposer() = runTest(dispatcher) {
        identity.setConfirmMultiActionSubmits(false)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmMultiActionSubmits).isFalse()

        identity.setConfirmMultiActionSubmits(true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmMultiActionSubmits).isTrue()
    }

    // -- References (D10, D11, D20) --

    private fun ComposePostViewModel.stageOneReference(targetId: String = "u1") {
        references.candidates = listOf(ReferenceCandidateView(testMentionTarget("ada"), targetId))
        onOpenFinder()
        onFinderQueryChange("@ada")
        dispatcher.scheduler.advanceUntilIdle()
        onPickReference(state.value.referenceSection.finder!!.candidates.single())
    }

    @Test
    fun theFinderResolvesAHandleAndPickingItStagesAChip() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.stageOneReference()
        assertThat(vm.state.value.referenceSection.references.map { it.targetId })
            .containsExactly("u1")
        // The finder closes behind a pick.
        assertThat(vm.state.value.referenceSection.finder).isNull()
        assertThat(references.lastQuery).isEqualTo("@ada")
    }

    /** A lookup that fell over is distinct from one that matched nothing. */
    @Test
    fun aFinderLookupThatFailedSaysSoRatherThanShowingAnEmptyList() = runTest(dispatcher) {
        references.candidatesFail = true
        val vm = viewModelWithoutConfirm()
        vm.onOpenFinder()
        vm.onFinderQueryChange("@ada")
        dispatcher.scheduler.advanceUntilIdle()
        val finder = vm.state.value.referenceSection.finder!!
        assertThat(finder.failed).isTrue()
        assertThat(finder.foundNothing).isFalse()
    }

    /** The finder runs per keystroke, so only the last query's answer lands. */
    @Test
    fun theFinderAsksOnceForAQueryTypedInOneBurst() = runTest(dispatcher) {
        references.candidates = listOf(ReferenceCandidateView(testMentionTarget("ada"), "u1"))
        val vm = viewModelWithoutConfirm()
        vm.onOpenFinder()
        vm.onFinderQueryChange("@a")
        vm.onFinderQueryChange("@ad")
        vm.onFinderQueryChange("@ada")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(references.lastQuery).isEqualTo("@ada")
        assertThat(vm.state.value.referenceSection.finder!!.candidates).hasSize(1)
    }

    @Test
    fun submittingSendsTheStagedReferencesWithTheirParameters() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("The body")
        vm.stageOneReference()
        vm.onReferenceRelevanceChange("u1", 0.8)
        vm.onReferenceSupportChange("u1", -0.3)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.lastCreateReferences)
            .containsExactly(ReferenceClaim("u1", relevance = 0.8, support = -0.3))
    }

    /** A creation prices the minting record, each tag, and each citation (D7, F4). */
    @Test
    fun aCreateCountsTheMintingRecordEachTagAndEachReference() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("The body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.stageOneReference()
        assertThat(vm.state.value.signedActionCount).isEqualTo(3)
    }

    @Test
    fun theReferenceCapRefusesTheEleventhLocally() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        repeat(11) { i ->
            references.candidates =
                listOf(ReferenceCandidateView(testContentTarget("p$i"), "p$i"))
            vm.onOpenFinder()
            vm.onFinderQueryChange("p$i")
            dispatcher.scheduler.advanceUntilIdle()
            vm.state.value.referenceSection.finder?.candidates?.singleOrNull()
                ?.let { vm.onPickReference(it) }
        }
        assertThat(vm.state.value.referenceSection.references).hasSize(10)
        assertThat(vm.state.value.referenceSection.capReached).isTrue()
    }

    @Test
    fun theEditScreenLoadsTheCurrentReferences() = runTest(dispatcher) {
        content.loadedReferences =
            listOf(testReferenceClaim(testMentionTarget("ada"), relevance = 0.4, support = 0.6))
        val vm = viewModelWithoutConfirm()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        val row = vm.state.value.referenceSection.references.single()
        // The L2 id the write names, not the claim's L1 identifier.
        assertThat(row.targetId).isEqualTo("user-ada")
        assertThat(row.relevance).isEqualTo(0.4)
        assertThat(row.support).isEqualTo(0.6)
        // Loaded and unchanged: the edit stages nothing.
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    /**
     * A citation this instance could not type carries no L2 id, so no
     * write could name it. It never reaches the editable section, and
     * its absence there must not be read as the author dropping it.
     */
    @Test
    fun anUntypeableCitationNeverEntersTheEditableSection() = runTest(dispatcher) {
        content.loadedReferences = listOf(
            testReferenceClaim(testMentionTarget("ada")),
            testReferenceClaim(target = null),
        )
        val vm = viewModelWithoutConfirm()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.referenceSection.references.map { it.targetId })
            .containsExactly("user-ada")
        assertThat(vm.state.value.referenceSection.removes).isEmpty()

        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(references.withdrawn).isEmpty()
    }

    @Test
    fun anAddedReferenceOnTheEditScreenStagesItsOwnReferenceAct() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.stageOneReference()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(references.added)
            .containsExactly(ReferenceCall("post-1", "u1", 0.1, 0.1))
        assertThat(content.editCalls).isEqualTo(0)
    }

    /**
     * Dropping a citation is a withdrawal, not a relevance-zero act: the
     * bundle nets to (0, 0), which may take several counter-records
     * (D11).
     */
    @Test
    fun aDroppedReferenceStagesAWithdrawal() = runTest(dispatcher) {
        content.loadedReferences = listOf(testReferenceClaim(testMentionTarget("ada")))
        val vm = viewModelWithoutConfirm()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onRemoveReference("user-ada")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(references.withdrawn).containsExactly("post-1" to "user-ada")
        assertThat(references.added).isEmpty()
    }

    /**
     * The count the author reads is the claim's own served cost, known
     * before a single act is staged (B4) — so the section quotes the
     * whole batch the moment the chip comes off.
     */
    @Test
    fun aWithdrawalQuotesTheServedCountBeforeAnythingIsStaged() = runTest(dispatcher) {
        content.loadedReferences =
            listOf(testReferenceClaim(testMentionTarget("ada"), withdrawalCost = 3))
        val vm = viewModelWithoutConfirm()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onRemoveReference("user-ada")
        assertThat(vm.state.value.signedActionCount).isEqualTo(3)
        assertThat(vm.state.value.withdrawalCost).isEqualTo(3)
        assertThat(references.withdrawn).isEmpty()
    }

    /**
     * Ask first, then stage: the served cost means a withdrawal needs
     * nothing prepared to name its price, so it follows the same order
     * as every other multi-act submit (B4).
     */
    @Test
    fun aWithdrawalAsksBeforeItStagesAndSignsOnlyOnConfirm() = runTest(dispatcher) {
        content.loadedReferences =
            listOf(testReferenceClaim(testMentionTarget("ada"), withdrawalCost = 4))
        references.withdrawalRecords = 4
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onRemoveReference("user-ada")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmPending).isTrue()
        assertThat(vm.state.value.withdrawalCost).isEqualTo(4)
        assertThat(vm.state.value.saved).isFalse()
        // Nothing is prepared, let alone signed, while the confirm stands.
        assertThat(references.withdrawn).isEmpty()

        vm.onConfirmSubmit(dontAskAgain = false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()
        assertThat(references.withdrawn).hasSize(1)
    }

    @Test
    fun dismissingAWithdrawalConfirmStagesNothing() = runTest(dispatcher) {
        content.loadedReferences =
            listOf(testReferenceClaim(testMentionTarget("ada"), withdrawalCost = 2))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onRemoveReference("user-ada")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isFalse()
        assertThat(vm.state.value.confirmPending).isFalse()
        assertThat(vm.state.value.submitting).isFalse()
        assertThat(references.withdrawn).isEmpty()
    }

    @Test
    fun aFieldRefusalLandsOnTheReferenceChipTheServerNamed() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("The body")
        vm.stageOneReference()
        content.prepareOutcome = Outcome.Refused(
            listOf(
                UserError(
                    message = "An artifact cannot cite itself.",
                    code = ErrorCode.UNKNOWN,
                    field = listOf("references", "0", "target"),
                ),
            ),
        )
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.referenceSection.references.single().error)
            .isEqualTo("An artifact cannot cite itself.")
        assertThat(vm.state.value.refusal).isNull()
    }

    /** A tag path and a reference path name different chips in one batch. */
    @Test
    fun refusalsSplitBetweenTheTagChipAndTheReferenceChip() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("The body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.stageOneReference()
        content.prepareOutcome = Outcome.Refused(
            listOf(
                UserError(ErrorCode.UNKNOWN, "bad tag", listOf("tags", "0", "name")),
                UserError(ErrorCode.UNKNOWN, "bad reference", listOf("references", "0", "target")),
            ),
        )
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.tagSection.tags.single().error).isEqualTo("bad tag")
        assertThat(vm.state.value.referenceSection.references.single().error)
            .isEqualTo("bad reference")
    }

    /**
     * A whole-batch refusal names no field — the balance could not carry
     * every act, so nothing was staged (D19). It says its piece once
     * rather than smearing across every chip.
     */
    @Test
    fun aWholeBatchRefusalSurfacesOnceAndMarksNoChip() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.onBodyChange("The body")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.stageOneReference()
        content.prepareOutcome = Outcome.Refused(
            listOf(
                UserError(
                    message = "Your balance cannot carry all 3 actions.",
                    code = ErrorCode.UNKNOWN,
                    field = null,
                ),
            ),
        )
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refusal).isEqualTo("Your balance cannot carry all 3 actions.")
        assertThat(vm.state.value.tagSection.tags.single().error).isNull()
        assertThat(vm.state.value.referenceSection.references.single().error).isNull()
    }

    /** A standalone Reference's refusal lands on the chip it was staged for. */
    @Test
    fun aStandaloneReferenceRefusalLandsOnItsOwnChipAndSignsNothing() = runTest(dispatcher) {
        val vm = viewModelWithoutConfirm()
        vm.start("post-1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.stageOneReference()
        references.addOutcomeFor = { target ->
            if (target == "u1") {
                Outcome.Refused(listOf(UserError(ErrorCode.UNKNOWN, "no such node", null)))
            } else {
                null
            }
        }
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.referenceSection.references.single().error)
            .isEqualTo("no such node")
        assertThat(vm.state.value.saved).isFalse()
        assertThat(vm.state.value.signingFailed).isFalse()
    }

    // -- The Reference affordance (D20) --

    /**
     * The affordance opens the composer with the node staged. Its typed
     * form comes from the finder's own lookup, so the chip reads the
     * same as a picked one.
     */
    @Test
    fun theReferenceAffordancePrefillsAChipAndResolvesItsLabel() = runTest(dispatcher) {
        references.candidates =
            listOf(ReferenceCandidateView(testContentTarget("p9"), "p9"))
        val vm = viewModelWithoutConfirm()
        vm.start(postId = null, referenceTargetId = "p9")
        dispatcher.scheduler.advanceUntilIdle()
        val row = vm.state.value.referenceSection.references.single()
        assertThat(row.targetId).isEqualTo("p9")
        assertThat(row.target).isEqualTo(testContentTarget("p9"))
    }

    /**
     * A prefill the lookup cannot type is still staged: the citation
     * names its target by id, and dropping the gesture silently would
     * be worse than a chip with no label.
     */
    @Test
    fun anUnresolvablePrefillIsStillStagedByItsId() = runTest(dispatcher) {
        references.candidates = emptyList()
        val vm = viewModelWithoutConfirm()
        vm.start(postId = null, referenceTargetId = "p9")
        dispatcher.scheduler.advanceUntilIdle()
        val row = vm.state.value.referenceSection.references.single()
        assertThat(row.targetId).isEqualTo("p9")
        assertThat(row.target).isNull()
    }

    @Test
    fun theAffordanceStagesTheSameNodeOnlyOnce() = runTest(dispatcher) {
        references.candidates = listOf(ReferenceCandidateView(testContentTarget("p9"), "p9"))
        val vm = viewModelWithoutConfirm()
        vm.start(postId = null, referenceTargetId = "p9")
        dispatcher.scheduler.advanceUntilIdle()
        vm.start(postId = null, referenceTargetId = "p9")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.referenceSection.references).hasSize(1)
    }
}
