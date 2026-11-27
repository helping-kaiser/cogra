package com.cogra.feature.stance.kept

import com.cogra.crypto.ActorKey
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.StanceAttempts
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.stance.opinions
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.ScriptedKeptPreviewRepository
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.cogra.domain.testing.signedInSession
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

private val POST = StanceTarget.Node("post-1")
private val PERSON = StanceTarget.Node("user-mira")
private val TOPIC = StanceTarget.Topic("saltmaps")
private val NEW = StanceTarget.Node("post-new")

/**
 * A changed kept batch over a first batch that is landing: the FIRST batch is
 * what lands (KeptPicksSeal.md:31, SigningAfterClose.md:27), so only the picks
 * it signed are counted and dropped. A pick it never held, or a target whose
 * kept pick changed since, was never signed and stays kept (repo rule "never
 * erase silently"). web's twin: `kept-batch-landing.test.ts` (#720).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class KeptBatchLandingTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)
    private val host = AnswerLosingWriteRepository(sealer)
    private val session = signedInSession()
    private val kept = InMemoryKeptPickStore()
    private val signals = StanceSignals()

    /** A faithful prepare that counts itself: every call stages a NEW record. */
    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StanceTarget>()

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            staged += target
            return when (target) {
                is StanceTarget.Node -> sealer.prepareStance(target.id, pick.pDirected, pick.pInterest)
                is StanceTarget.Topic -> sealer.prepareTopicStance(target.name, pick.pDirected, pick.pInterest)
            }
        }

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> =
            Outcome.Success(StanceStanding(target, StancePair.Origin, StancePair.Origin, 0, includePending, false))
    }

    private fun viewModel() = KeptPicksViewModel(
        kept = kept,
        previews = ScriptedKeptPreviewRepository(),
        stances = stances,
        signer = WriteSigner(host, identity),
        identity = identity,
        signals = signals,
        tokens = session,
        stagedWrites = host,
        attempts = StanceAttempts(),
    )

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    /** The batch's first signing: the three records staged once, as w1, w2, w3. */
    private val firstBatch = listOf("w1", "w2", "w3")

    /**
     * Three picks kept and signed once; the approval's answer is lost, so the
     * server took the first batch while the seal shows its fault.
     */
    private suspend fun firstBatchTaken(): KeptPicksViewModel {
        kept.keep(POST, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.POST)
        kept.keep(PERSON, StancePair(0.55, 0.2), KeptFamily.OPINION, StanceKind.PERSON)
        kept.keep(TOPIC, StancePair(0.6, 0.35), KeptFamily.OPINION, StanceKind.TOPIC)
        host.loseApproves = 1
        return viewModel().apply {
            settle()
            onSignThem()
            onSign()
            settle()
            assertThat(state.value.fault).isEqualTo(KeptSealFault.OFFLINE)
            // KeptPicksSeal.md:31 — back to the review, where the batch changes.
            onBackToReview()
        }
    }

    /** The changed batch's seal, signed: it finds the first batch landing. */
    private fun KeptPicksViewModel.signChanged() {
        settle()
        onSignThem()
        onSign()
        settle()
    }

    /** The kept opinions, by target and pair. */
    private suspend fun keptNow(): List<Pair<StanceTarget, StancePair>> =
        kept.list().opinions().map { it.target to it.pick }

    @Test
    fun aPickTheFirstBatchNeverHeldStaysKeptAndOnlyTheFirstBatchIsCounted() = runTest(dispatcher) {
        val vm = firstBatchTaken()
        kept.keep(NEW, StancePair(0.9, 0.1), KeptFamily.OPINION, StanceKind.POST)

        vm.signChanged()

        assertThat(stances.staged).containsExactly(POST, PERSON, TOPIC).inOrder()
        assertThat(host.approved).containsExactlyElementsIn(firstBatch)
        assertThat(keptNow()).containsExactly(NEW to StancePair(0.9, 0.1))
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
        assertThat(signals.settling.value).containsExactly(POST, PERSON, TOPIC)
    }

    @Test
    fun aPickRemovedSinceLandedWithTheFirstBatchAndIsCounted() = runTest(dispatcher) {
        val vm = firstBatchTaken()
        vm.onRemove(2)

        vm.signChanged()

        assertThat(stances.staged).hasSize(3)
        assertThat(keptNow()).isEmpty()
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
        assertThat(signals.settling.value).containsExactly(POST, PERSON, TOPIC)
    }

    @Test
    fun aTargetsPickChangedSinceStaysKeptTheFirstBatchSignedTheOldPair() = runTest(dispatcher) {
        val vm = firstBatchTaken()
        kept.keep(PERSON, StancePair(-0.3, 0.2), KeptFamily.OPINION, StanceKind.PERSON)

        vm.signChanged()

        assertThat(stances.staged).hasSize(3)
        assertThat(host.approved).containsExactlyElementsIn(firstBatch)
        assertThat(keptNow()).containsExactly(PERSON to StancePair(-0.3, 0.2))
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
    }
}
