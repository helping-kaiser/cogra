// The post edit's ViewModel — the EditCompose family's sidecars compiled to
// behavior (design/designs/canonical/behavior/EditCompose.md,
// EditComposeUnchanged.md, EditWords.md, EditPicked.md, EditActs.md). No
// Edit* board is registered yet (feed-card-rework §16), so these pin
// behavior; the structural diff waits on registration.

package com.cogra.feature.content.edit

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.cogra.feature.content.TagCall
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

@OptIn(ExperimentalCoroutinesApi::class)
class PostEditViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private val content = object : ThrowingContentRepository() {
        var editOutcome: Outcome<PreparedContentView>? = null
        var lastEdit: List<Any?> = emptyList()
        var lastEditAttachments: List<AttachmentClaim> = emptyList()
        var lastEditMark: Pair<Boolean, String?>? = null
        var editCalls = 0
        var editWrites = 1
        var loadedAttachments: List<MediaAssetView> = emptyList()
        var loadedDescription: String? = null
        var loadedLicense: LicenseChoice = LicenseChoice.PublicDomain
        var loadedTopics: List<TopicClaimView> = emptyList()
        var loadedReferences: List<ReferenceClaimView> = emptyList()
        var selfMarkOutcome: Outcome<SelfMarkView?> = Outcome.Success(SelfMarkView(sensitive = false, reason = null))
        var postOutcome: Outcome<PostDetail?>? = null

        override suspend fun post(
            id: String,
            commentsFirst: Int,
            commentsAfter: String?,
            includePending: Boolean,
        ): Outcome<PostDetail?> = postOutcome ?: Outcome.Success(
            PostDetail(
                post = testPost(
                    id,
                    title = "Loaded title",
                    body = if (loadedAttachments.isEmpty()) "Loaded body" else "",
                    license = loadedLicense,
                ).let { post ->
                    post.copy(
                        description = post.description.copy(value = loadedDescription),
                        topics = loadedTopics,
                        references = loadedReferences,
                        attachments = loadedAttachments,
                    )
                },
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )

        override suspend fun postSelfMark(id: String): Outcome<SelfMarkView?> = selfMarkOutcome

        override suspend fun preparePostEdit(
            id: String,
            title: String?,
            description: String?,
            content: String?,
            attachments: List<AttachmentClaim>,
            sensitive: Boolean,
            sensitiveReason: String?,
        ): Outcome<PreparedContentView> {
            editCalls += 1
            lastEdit = listOf(id, title, description, content)
            lastEditAttachments = attachments
            lastEditMark = sensitive to sensitiveReason
            return editOutcome ?: Outcome.Success(
                PreparedContentView(id, List(editWrites) { sealer.stage(Family.PUBLISH) }),
            )
        }
    }

    private val topics = object : ThrowingTopicRepository() {
        val calls = mutableListOf<TagCall>()

        override suspend fun prepareTag(
            target: String,
            name: String,
            pDirected: Double,
            pInterest: Double,
        ): Outcome<List<PreparedWriteView>> {
            calls += TagCall(target, name, pDirected, pInterest)
            return Outcome.Success(listOf(sealer.stage(Family.TAG)))
        }
    }

    private val references = object : ThrowingReferenceRepository() {
        val withdrawn = mutableListOf<String>()
        var withdrawalRecords = 1

        override suspend fun prepareReferenceWithdrawal(
            artifact: String,
            target: String,
        ): Outcome<List<PreparedWriteView>> {
            withdrawn += target
            return Outcome.Success(List(withdrawalRecords) { sealer.stage(Family.REFERENCE) })
        }
    }

    private fun picture(id: String, altText: String? = null) = MediaAssetView(
        id = id,
        url = "https://media/$id",
        altText = altText,
        status = FieldStatus.NORMAL,
        aspectRatio = 1f,
        mimeType = "image/webp",
    )

    private fun opened(): PostEditViewModel {
        val vm = PostEditViewModel(content, topics, references, WriteSigner(sealer, identity), identity)
        vm.start("p1")
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    private fun PostEditViewModel.signed() {
        onSign()
        dispatcher.scheduler.advanceUntilIdle()
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // -- The guard is the acts batch (EditComposeUnchanged) --

    @Test
    fun anEmptyBatchLeavesSignInertAndStagesNothing() = runTest(dispatcher) {
        val vm = opened()
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
        assertThat(vm.state.value.canSign).isFalse()
        assertThat(actsFooterLine(vm.state.value.signedActionCount)).isEqualTo("Nothing to sign yet")
        vm.signed()
        assertThat(content.editCalls).isEqualTo(0)
    }

    @Test
    fun aTypedThenRevertedTitleStillSigns() = runTest(dispatcher) {
        val vm = opened()
        vm.onTitleChange("Loaded title, edited")
        vm.onTitleChange("Loaded title")

        assertThat(vm.state.value.title).isEqualTo("Loaded title")
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.signed()
        assertThat(content.lastEdit).containsExactly("p1", "Loaded title", null, "Loaded body").inOrder()
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun theEditOpensOnThePostAsItStandsWithItsLicenseShownLocked() = runTest(dispatcher) {
        content.loadedLicense = LicenseChoice(attribution = 1.0, provenance = 0.0)
        val vm = opened()
        assertThat(vm.state.value.body).isEqualTo("Loaded body")
        assertThat(vm.state.value.license).isEqualTo(LicenseChoice(attribution = 1.0, provenance = 0.0))
    }

    // -- One batch (EditCompose, EditActs) --

    @Test
    fun aStandingTagTakenOffIsAWithdrawalThatUndoUnstages() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("coastroad"))
        val vm = opened()
        vm.onRemoveTag("coastroad")
        assertThat(vm.state.value.tagSection.withdrawn()).containsExactly("coastroad")
        assertThat(vm.state.value.actRows.map { it.kind }).containsExactly(EditActKind.TagsWithdrawn)
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)

        vm.onUndoTagWithdrawal("coastroad")
        assertThat(vm.state.value.tagSection.withdrawn()).isEmpty()
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    @Test
    fun aTagPickedAndTakenBackInTheSameEditUnstagesAndNeverWithdraws() = runTest(dispatcher) {
        val vm = opened()
        vm.onTagInputChange("saltmaps")
        vm.onAddTag()
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.onRemoveTag("saltmaps")
        assertThat(vm.state.value.tagSection.withdrawn()).isEmpty()
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    @Test
    fun aCitationWithdrawalCountsItsCounterRecordsAndSignsThemAll() = runTest(dispatcher) {
        content.loadedReferences = listOf(testReferenceClaim(testMentionTarget("juno"), withdrawalCost = 2))
        references.withdrawalRecords = 2
        val vm = opened()
        vm.onRemoveReference("user-juno")
        assertThat(vm.state.value.signedActionCount).isEqualTo(2)
        vm.signed()
        assertThat(references.withdrawn).containsExactly("user-juno")
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun theEditRecordAndItsTagActsRideOneSigningPass() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("wasm", confidence = 0.6))
        val vm = opened()
        vm.onBodyChange("New body")
        vm.onRemoveTag("wasm")
        assertThat(actsSheetTitle(vm.state.value.signedActionCount)).isEqualTo("2 things, signed together")
        vm.signed()
        assertThat(content.editCalls).isEqualTo(1)
        // The un-tag signs the confidence the removed chip showed (0.6) —
        // relevance is the only value a removal moves; the wire fills nothing.
        assertThat(topics.calls).containsExactly(TagCall("p1", "wasm", PostEditViewModel.WITHDRAWN, 0.6))
        assertThat(vm.state.value.saved).isTrue()
    }

    // -- The body (EditWords, EditPicked) --

    @Test
    fun theWordsEditSendsNoDescription() = runTest(dispatcher) {
        content.loadedDescription = "Left over"
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.signed()
        assertThat(content.lastEdit).containsExactly("p1", "Loaded title", null, "Reworded").inOrder()
    }

    @Test
    fun aMediaEditSendsNoWordsAndReStatesTheGalleryInItsNewOrder() = runTest(dispatcher) {
        content.loadedAttachments = listOf(picture("m1", "A jetty"), picture("m2"))
        content.loadedDescription = "Beside the pictures"
        val vm = opened()
        vm.onMovePicture(1, 0)
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.signed()
        assertThat(content.lastEdit).containsExactly("p1", "Loaded title", "Beside the pictures", null).inOrder()
        assertThat(content.lastEditAttachments.map { it.mediaId }).containsExactly("m2", "m1").inOrder()
    }

    @Test
    fun theLastPictureLeavingDropsTheStandingDescription() = runTest(dispatcher) {
        content.loadedAttachments = listOf(picture("m1"))
        content.loadedDescription = "Rubbings at low tide."
        val vm = opened()
        vm.onOpenPicked()
        vm.onRemovePicture(0)

        val s = vm.state.value
        assertThat(s.mediaBody).isFalse()
        assertThat(s.body).isEmpty()
        assertThat(s.description).isEmpty()
        assertThat(s.pickedOpen).isFalse()
        vm.onBodyChange("Now it is words.")
        vm.signed()
        assertThat(content.lastEdit).containsExactly("p1", "Loaded title", null, "Now it is words.").inOrder()
        assertThat(content.lastEditAttachments).isEmpty()
    }

    @Test
    fun describingAPictureStagesTheRecordAndRidesItsPlacement() = runTest(dispatcher) {
        content.loadedAttachments = listOf(picture("m1"))
        val vm = opened()
        vm.onAltTextChange(0, "A salt crust")
        vm.signed()
        assertThat(content.lastEditAttachments.single().altText).isEqualTo("A salt crust")
    }

    // -- Signing --

    @Test
    fun aKeylessDeviceStandsTheSealAndStagesNothing() = runTest(dispatcher) {
        identity.seed = null
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.signed()
        assertThat(vm.state.value.keyAbsent).isTrue()
        assertThat(content.editCalls).isEqualTo(0)
    }

    @Test
    fun theWriteRuleRefusalTakesTheCommitsPlace() = runTest(dispatcher) {
        content.editOutcome = Outcome.Refused(listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "balance")))
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.signed()
        assertThat(vm.state.value.writeRuleRefused).isTrue()
        assertThat(vm.state.value.submitting).isFalse()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aCountThatChangedWhileEditingDropsTheHeldPress() = runTest(dispatcher) {
        content.editWrites = 2
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.signed()
        assertThat(vm.state.value.countChanged).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun markingThePostAloneStagesTheRecordWithTheAuthorsOwnMark() = runTest(dispatcher) {
        val vm = opened()
        vm.onSensitiveChange(true)
        vm.onSensitiveReasonChange("Depicts an injury")
        vm.signed()
        assertThat(content.lastEditMark).isEqualTo(true to "Depicts an injury")
    }

    @Test
    fun anUnreadableSelfMarkFailsTheLoadRatherThanUnmarking() = runTest(dispatcher) {
        content.selfMarkOutcome = Outcome.Failed(IOException("offline"))
        val vm = opened()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.canSign).isFalse()
    }

    @Test
    fun aTransportFaultAtPrepareIsNotARefusal() = runTest(dispatcher) {
        content.editOutcome = Outcome.Failed(IOException("offline"))
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.signed()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.refusal).isNull()
    }
}
