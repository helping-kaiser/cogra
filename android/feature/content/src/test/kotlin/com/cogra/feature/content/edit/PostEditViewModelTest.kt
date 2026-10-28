// The post edit's ViewModel — the EditCompose family's sidecars compiled to
// behavior (design/designs/canonical/behavior/EditCompose.md,
// EditComposeUnchanged.md, EditWords.md, EditPicked.md, EditActs.md). No
// Edit* board is registered yet (feed-card-rework §16), so these pin
// behavior; the structural diff waits on registration.

package com.cogra.feature.content.edit

import com.cogra.core.designsystem.BackingValue
import com.cogra.crypto.ActorKey
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostBacking
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.UserError
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.node
import com.cogra.domain.signing.postEdit
import com.cogra.domain.signing.referenceWithdrawal
import com.cogra.domain.signing.tagClaim
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_POST_ID
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.faithfulContent
import com.cogra.domain.testing.testGraphId
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.cogra.feature.content.TagCall
import com.cogra.feature.content.editableRow
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
        var lastEditPick: Double? = null
        var backingOutcome: Outcome<PostBacking?> = Outcome.Success(null)

        override suspend fun postBacking(id: String): Outcome<PostBacking?> = backingOutcome

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
            pDirected: Double,
        ): Outcome<PreparedContentView> {
            editCalls += 1
            lastEditPick = pDirected
            lastEdit = listOf(id, title, description, content)
            lastEditAttachments = attachments
            lastEditMark = sensitive to sensitiveReason
            return editOutcome ?: Outcome.Success(
                PreparedContentView(
                    id,
                    List(editWrites) {
                        sealer.stageFaithful(
                            Expectation(
                                listOf(
                                    postEdit(
                                        testGraphId(id),
                                        faithfulContent(
                                            id,
                                            SentContent(
                                                title,
                                                description,
                                                content,
                                                attachments,
                                                sensitive,
                                                sensitiveReason,
                                            ),
                                            ContentShape.POST,
                                        ),
                                        pDirected,
                                    ),
                                ),
                            ),
                        )
                    }.flatten(),
                ),
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
            return Outcome.Success(
                sealer.stageFaithful(
                    Expectation(listOf(tagClaim(node(testGraphId(target)), name, pDirected, pInterest))),
                ),
            )
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
            // A faithful walk-back: the loaded claim's raw sums, netted in the
            // records the test scripts.
            val claim = content.loadedReferences.first { it.editableRow()?.targetId == target }
            val walkBack = referenceWithdrawal(
                testGraphId(artifact),
                testGraphId(target),
                claim.rawRelevance,
                claim.rawSupport,
                withdrawalRecords,
            )
            return Outcome.Success(sealer.stageFaithful(Expectation(emptyList(), listOf(walkBack))))
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

    private val media = GatedMedia()
    private val pictures = ScriptedPictures(media)

    private fun opened(): PostEditViewModel {
        val vm =
            PostEditViewModel(
                content,
                topics,
                references,
                WriteSigner(sealer, identity),
                identity,
                media,
                pictures,
                ScriptedClips(),
            )
        vm.start(TEST_POST_ID)
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
        assertThat(content.lastEdit).containsExactly(TEST_POST_ID, "Loaded title", null, "Loaded body").inOrder()
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
        // The un-tag signs (0,0) whatever the removed chip showed (hashtag.md §4)
        // — the wire fills nothing in.
        assertThat(topics.calls).containsExactly(TagCall(TEST_POST_ID, "wasm", 0.0, 0.0))
        assertThat(vm.state.value.saved).isTrue()
    }

    // -- The body (EditWords, EditPicked) --

    @Test
    fun theWordsEditSendsNoDescription() = runTest(dispatcher) {
        content.loadedDescription = "Left over"
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.signed()
        assertThat(content.lastEdit).containsExactly(TEST_POST_ID, "Loaded title", null, "Reworded").inOrder()
    }

    @Test
    fun aMediaEditSendsNoWordsAndReStatesTheGalleryInItsNewOrder() = runTest(dispatcher) {
        content.loadedAttachments = listOf(picture("m1", "A jetty"), picture("m2"))
        content.loadedDescription = "Beside the pictures"
        val vm = opened()
        vm.onMovePicture(1, 0)
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.signed()
        assertThat(
            content.lastEdit,
        ).containsExactly(TEST_POST_ID, "Loaded title", "Beside the pictures", null).inOrder()
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
        assertThat(content.lastEdit).containsExactly(TEST_POST_ID, "Loaded title", null, "Now it is words.").inOrder()
        assertThat(content.lastEditAttachments).isEmpty()
    }

    // EditPicked.md: NEVER the signed edit carries a description — not even one
    // the author retyped earlier in this same edit, before the last picture left.
    @Test
    fun aDescriptionStagedBeforeTheFlipIsDroppedWithTheLastPicture() = runTest(dispatcher) {
        content.loadedAttachments = listOf(picture("m1"), picture("m2"))
        content.loadedDescription = "Rubbings at low tide."
        val vm = opened()
        vm.onDescriptionChange("Typed in this edit.")
        vm.onRemovePicture(1)
        assertThat(vm.state.value.description).isEqualTo("Typed in this edit.")
        vm.onRemovePicture(0)

        assertThat(vm.state.value.mediaBody).isFalse()
        assertThat(vm.state.value.description).isEmpty()
        vm.onBodyChange("Now it is words.")
        vm.signed()
        assertThat(content.lastEdit).containsExactly(TEST_POST_ID, "Loaded title", null, "Now it is words.").inOrder()
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

    // -- Leaving (EditCompose.md, DiscardConfirm.md): the edit keeps no draft --

    @Test
    fun leavingAnEmptyBatchLeavesAtOnceAndNeverAsks() = runTest(dispatcher) {
        val vm = opened()
        assertThat(vm.onLeaveRequested()).isTrue()
        assertThat(vm.state.value.confirmingDiscard).isFalse()
    }

    @Test
    fun leavingWithAnActInTheBatchAsksAndKeepWritingClosesOntoTheEditAsItWas() = runTest(dispatcher) {
        val vm = opened()
        vm.onTitleChange("Retitled")
        assertThat(vm.onLeaveRequested()).isFalse()
        assertThat(vm.state.value.confirmingDiscard).isTrue()

        vm.onKeepWriting()
        assertThat(vm.state.value.confirmingDiscard).isFalse()
        assertThat(vm.state.value.title).isEqualTo("Retitled")
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
    }

    /** The ask reads the acts batch, never the bytes: a withdrawal alone is an act. */
    @Test
    fun aWithdrawalAloneIsAnActSoLeavingAsks() = runTest(dispatcher) {
        content.loadedTopics = listOf(testTopicClaim("coastroad"))
        val vm = opened()
        vm.onRemoveTag("coastroad")
        assertThat(vm.state.value.recordStaged).isFalse()
        assertThat(vm.onLeaveRequested()).isFalse()
        assertThat(vm.state.value.confirmingDiscard).isTrue()
    }

    /** The record stays staged once touched (EditComposeUnchanged.md), so typing it back still asks. */
    @Test
    fun aChangeTypedBackStillAsksBecauseTheStagedRecordStays() = runTest(dispatcher) {
        val vm = opened()
        vm.onTitleChange("Retitled")
        vm.onTitleChange("Loaded title")
        assertThat(vm.onLeaveRequested()).isFalse()
    }

    /** A pick taken back in the same edit leaves the batch empty, and the way out asks nothing. */
    @Test
    fun aPickTakenBackLeavesTheBatchEmptyAndLeavingNeverAsks() = runTest(dispatcher) {
        val vm = opened()
        vm.onTagInputChange("saltmaps")
        vm.onAddTag()
        vm.onRemoveTag("saltmaps")
        assertThat(vm.onLeaveRequested()).isTrue()
        assertThat(vm.state.value.confirmingDiscard).isFalse()
    }

    /**
     * Discard keeps nothing: the edit holds no draft store, so the next edit
     * opens on the post as it stands, never on the discarded changes.
     */
    @Test
    fun aDiscardedEditKeepsNothingAndTheNextEditOpensOnThePostAsItWas() = runTest(dispatcher) {
        val discarded = opened()
        discarded.onTitleChange("Retitled")
        discarded.onBodyChange("Reworded")
        assertThat(discarded.onLeaveRequested()).isFalse()

        val next = opened()
        assertThat(next.state.value.title).isEqualTo("Loaded title")
        assertThat(next.state.value.body).isEqualTo("Loaded body")
        assertThat(next.state.value.signedActionCount).isEqualTo(0)
        assertThat(content.editCalls).isEqualTo(0)
    }

    // -- The backing (EditPad.md, EditCompose.md; round 15) --

    @Test
    fun anUnmovedPickIsZeroAndRidesTheEditExplicitly() = runTest(dispatcher) {
        val vm = opened()
        assertThat(vm.state.value.pick).isEqualTo(0.0)
        vm.onTitleChange("Retitled")
        vm.signed()
        // The record carries 0.00 — the edit changes the backing by exactly
        // nothing — and the intent check held it to that.
        assertThat(content.lastEditPick).isEqualTo(0.0)
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun thePadOpensAtTheEditsPickAndStagesNothing() = runTest(dispatcher) {
        val vm = opened()
        vm.onOpenBackingPad()
        assertThat(vm.state.value.backingPadOpen).isTrue()
        assertThat(vm.state.value.stagedPick).isEqualTo(0.0)
        vm.onBackingPickChange(0.3)
        assertThat(vm.state.value.pick).isEqualTo(0.0)
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    // "a moved pick alone fills the batch, the edit signing a new version
    // whose words and media stand unchanged" — PICK-IS-THE-EDGE: the record
    // carries the pick itself, never a delta toward a target.
    @Test
    fun aMovedPickAloneSignsAContentIdenticalVersion() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Success(PostBacking(net = 0.1, rawSum = 0.1))
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.3)
        vm.onSetBacking()

        assertThat(vm.state.value.backingPadOpen).isFalse()
        assertThat(vm.state.value.pick).isEqualTo(0.3)
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        // EditPad.md (round 18): a pick alone filling the batch reads the
        // new version's one record.
        assertThat(actsFooterLine(vm.state.value.signedActionCount)).isEqualTo("You're signing 1 thing")
        vm.signed()
        assertThat(content.lastEditPick).isEqualTo(0.3)
        assertThat(content.lastEdit).containsExactly(TEST_POST_ID, "Loaded title", null, "Loaded body").inOrder()
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun thePickRidesTheEditsOwnRecordAndAddsNothingToTheCount() = runTest(dispatcher) {
        val vm = opened()
        vm.onTitleChange("Retitled")
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        vm.onOpenBackingPad()
        vm.onBackingPickChange(-0.5)
        vm.onSetBacking()
        assertThat(vm.state.value.signedActionCount).isEqualTo(1)
        assertThat(vm.state.value.actRows.map { it.count }.sum()).isEqualTo(1)
    }

    @Test
    fun setAtZeroAddsNoRecordAndAsksNothing() = runTest(dispatcher) {
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.0)
        vm.onSetBacking()
        assertThat(vm.state.value.backingPadOpen).isFalse()
        assertThat(vm.state.value.pick).isEqualTo(0.0)
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    // EditPad.md: the pick parks on a hundredth, so a pick that READS 0.00 is
    // 0 and adds no record. The bug this pins: 0.004 printed +0.00 and still
    // filled the batch with a record.
    @Test
    fun aSetThatReadsZeroIsZeroAndAddsNoGhostRecord() = runTest(dispatcher) {
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.004)
        vm.onSetBacking()
        assertThat(vm.state.value.pick).isEqualTo(0.0)
        assertThat(vm.state.value.recordStaged).isFalse()
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)

        vm.onOpenBackingPad()
        vm.onBackingPickChange(-0.0049)
        vm.onSetBacking()
        // Truth compares doubles by `equals`, which tells −0 from +0.
        assertThat(vm.state.value.pick).isEqualTo(0.0)
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    @Test
    fun aSetLandsThePickOnTheHundredthsGrid() = runTest(dispatcher) {
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.4371)
        vm.onSetBacking()
        assertThat(vm.state.value.pick).isEqualTo(0.44)
    }

    @Test
    fun cancelLeavesThePickAsItWas() = runTest(dispatcher) {
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.3)
        vm.onSetBacking()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(-0.9)
        vm.onCancelBackingPad()
        assertThat(vm.state.value.pick).isEqualTo(0.3)
        assertThat(vm.state.value.stagedPick).isEqualTo(0.3)
        assertThat(vm.state.value.backingPadOpen).isFalse()
    }

    @Test
    fun theRowReadsTheBackingAsItStandsThenAfterTheSetPick() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Success(PostBacking(net = 0.1, rawSum = 0.1))
        val vm = opened()
        assertThat(vm.state.value.backingWithEdit).isEqualTo(BackingValue.Read(0.1))
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.3)
        // Staged, not set: the row still reads the backing as it stands.
        assertThat(vm.state.value.backingWithEdit).isEqualTo(BackingValue.Read(0.1))
        vm.onSetBacking()
        val after = vm.state.value.backingWithEdit as BackingValue.Read
        assertThat(after.value).isWithin(1e-9).of(0.4)
    }

    @Test
    fun walkItAllBackParksTheRawSumsOppositeAndStagesNothing() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Success(PostBacking(net = 0.4, rawSum = 0.4))
        val vm = opened()
        vm.onOpenBackingPad()
        assertThat(vm.state.value.canWalkBack).isTrue()
        vm.onWalkBack()
        assertThat(vm.state.value.stagedPick).isEqualTo(-0.4)
        assertThat(vm.state.value.pick).isEqualTo(0.0)
        assertThat(vm.state.value.backingPadOpen).isTrue()
        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
    }

    @Test
    fun walkItAllBackPastTheAxisParksAsFarAsOneRecordReaches() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Success(PostBacking(net = 1.0, rawSum = 1.6))
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onWalkBack()
        assertThat(vm.state.value.stagedPick).isEqualTo(-1.0)
    }

    @Test
    fun walkItAllBackIsGreyedAtANetOfZero() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Success(PostBacking(net = 0.0, rawSum = 0.0))
        val vm = opened()
        vm.onOpenBackingPad()
        vm.onBackingPickChange(0.2)
        assertThat(vm.state.value.canWalkBack).isFalse()
        vm.onWalkBack()
        assertThat(vm.state.value.stagedPick).isEqualTo(0.2)
    }

    // Two +1.00 edits over the mint: the raw sum is past the axis, the net
    // clipped, and one walk-back reaches only as far as one record can.
    @Test
    fun aBackingPastTheAxisReadsClippedOverItsRawSum() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Success(PostBacking(net = 1.0, rawSum = 2.0))
        val vm = opened()
        assertThat(vm.state.value.backingCurrent).isEqualTo(BackingValue.Read(1.0))
        assertThat(vm.state.value.backingRaw).isEqualTo(BackingValue.Read(2.0))
        assertThat(vm.state.value.backingWithEdit).isEqualTo(BackingValue.Read(1.0))
        vm.onOpenBackingPad()
        vm.onWalkBack()
        vm.onSetBacking()
        assertThat(vm.state.value.pick).isEqualTo(-1.0)
        assertThat(vm.state.value.backingWithEdit).isEqualTo(BackingValue.Read(1.0))
    }

    // No backing served — the server answers only the post's creator. The
    // edit stands without it — unread readouts, a greyed walk-back — and
    // never guesses.
    @Test
    fun anUnservedBackingReadsUnreadAndGreysTheWalkBack() = runTest(dispatcher) {
        val vm = opened()
        assertThat(vm.state.value.backing).isNull()
        assertThat(vm.state.value.backingCurrent).isEqualTo(BackingValue.Unread)
        assertThat(vm.state.value.backingWithEdit).isEqualTo(BackingValue.Unread)
        assertThat(vm.state.value.canWalkBack).isFalse()
        assertThat(vm.state.value.loading).isFalse()
    }

    @Test
    fun aFailedBackingReadNeverBlocksTheEdit() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Failed(IOException("down"))
        val vm = opened()
        assertThat(vm.state.value.transportFailed).isFalse()
        assertThat(vm.state.value.backingCurrent).isEqualTo(BackingValue.Unread)
        vm.onTitleChange("Retitled")
        vm.signed()
        assertThat(vm.state.value.saved).isTrue()
    }

    // A refusal the guard could not replay away reads as unread too — never
    // as the post missing: the backing is beside the edit, not in its way.
    @Test
    fun aRefusedBackingReadNeverBlocksTheEdit() = runTest(dispatcher) {
        content.backingOutcome = Outcome.Refused(listOf(UserError(ErrorCode.UNAUTHENTICATED, "no viewer")))
        val vm = opened()
        assertThat(vm.state.value.notFound).isFalse()
        assertThat(vm.state.value.title).isEqualTo("Loaded title")
        assertThat(vm.state.value.backingCurrent).isEqualTo(BackingValue.Unread)
        assertThat(vm.state.value.canWalkBack).isFalse()
    }
}
