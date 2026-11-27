// A GUEST'S FACE IS THE BORROWED VIEW'S, READ-ONLY (FeedBare.md:7, :9, :27;
// TagPage.md:73-81; GuestGate.md:11; ProfileOther.md:57-63): the route a
// signed-out reader's every stance face goes through — the view's own face
// and spoken name where it holds an opinion, the hollow face where it holds
// none, the gate on the tap and the hold, and NOTHING written: no member read,
// no staging, no kept pick, no node a signing would point at. A reader with a
// session never asks for a borrowed stance, and their face is their own.

package com.cogra.feature.stance

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.cogra.core.designsystem.LocalGuestGate
import com.cogra.core.designsystem.StancePadVariant
import com.cogra.crypto.ActorKey
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReaderStanding
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.BorrowedStance
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceAttempts
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeBorrowedStanceRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.cogra.domain.testing.signedInSession
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private val HELD = StanceTarget.Node("person-held")
private val UNHELD = StanceTarget.Node("post-unheld")
private const val TAG = "card"
private val LENT = BorrowedStance(StancePair(0.55, 0.2), records = 1, inert = false, severed = false)

@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StanceGuestFaceTest {

    @get:Rule
    val compose = createComposeRule()

    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)
    private val kept = InMemoryKeptPickStore()
    private val borrowed = FakeBorrowedStanceRepository(mapOf(HELD to LENT))

    /** Every member-seam call is recorded; a guest's control must make none. */
    private val stances = object : ThrowingStanceRepository() {
        val memberCalls = mutableListOf<String>()

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> {
            memberCalls += "standing"
            return Outcome.Success(
                StanceStanding(target, StancePair.Origin, StancePair.Origin, 0, includePending, false),
            )
        }

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            memberCalls += "prepareStance"
            return writes.prepareStance((target as StanceTarget.Node).id, pick.pDirected, pick.pInterest)
        }

        override suspend fun projection(
            target: StanceTarget,
            pick: StancePair,
            includePending: Boolean,
        ): Outcome<StanceProjection> {
            memberCalls += "projection"
            return super.projection(target, pick, includePending)
        }

        override suspend fun severanceQuote(target: StanceTarget, includePending: Boolean): Outcome<SeveranceQuote> {
            memberCalls += "severanceQuote"
            return super.severanceQuote(target, includePending)
        }

        override suspend fun prepareSeverance(target: StanceTarget): Outcome<List<PreparedWriteView>> {
            memberCalls += "prepareSeverance"
            return super.prepareSeverance(target)
        }

        override suspend fun targetGraphId(target: StanceTarget): Outcome<String> {
            memberCalls += "targetGraphId"
            return super.targetGraphId(target)
        }

        override suspend fun kindOf(target: StanceTarget): StanceKind = StanceKind.POST
    }

    private val account = object : ThrowingAccountRepository() {
        override suspend fun borrowedView(): Outcome<ActorRef?> =
            Outcome.Success(ActorRef("genesis-id", "genesis", "Genesis Moderator", null))
    }

    private fun model() = StanceViewModel(
        stances,
        WriteSigner(writes, identity),
        identity,
        StanceSignals(),
        account,
        kept,
        ReaderStanding(),
        borrowed,
        signedInSession(),
        writes,
        StanceAttempts(),
    )

    private var gated = 0

    /** The shell's gate, as CograNavGraph provides it to every face while signed out. */
    private fun renderAsGuest(
        target: StanceTarget,
        label: String? = null,
        vm: StanceViewModel = model(),
    ): StanceViewModel {
        compose.setContent {
            CompositionLocalProvider(LocalGuestGate provides { gated++ }) {
                StanceControlRoute(target = target, testTagPrefix = TAG, targetLabel = label, viewModel = vm)
            }
        }
        compose.waitForIdle()
        return vm
    }

    private fun face() = compose.onNodeWithTag("${TAG}_stance")

    // FeedBare.md:7 + :9 — the view's own face, spoken as the view's, with its reading.
    @Test
    fun aTargetTheLenderHoldsShowsThatFaceAndItsSpokenName() {
        renderAsGuest(HELD, label = "@pixeljoiner")
        compose.onNodeWithText("😊", useUnmergedTree = true).assertExists()
        face().assertContentDescriptionEquals("@genesis's opinion on @pixeljoiner: Like this, +0.55 / +0.20.")
    }

    // FeedBare.md:7 — the hollow face wherever the view holds none, still named as the view's.
    @Test
    fun aTargetTheLenderDoesNotHoldShowsTheHollowFace() {
        renderAsGuest(UNHELD)
        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertExists()
        face().assertContentDescriptionEquals("@genesis's opinion on this post")
    }

    // FeedBare.md:27 — WHEN tap a stance face GIVEN signed out -> the guest gate rises
    // AND NEVER the pad opens AND NEVER anything is staged; the hold likewise.
    @Test
    fun theTapAndTheHoldRaiseTheGateAndCallNothingOnTheMemberSeam() {
        renderAsGuest(HELD)
        face().performClick()
        compose.waitForIdle()
        face().performTouchInput { longClick() }
        compose.waitForIdle()
        assertThat(gated).isEqualTo(2)
        compose.onNodeWithTag("${TAG}_stance_pad").assertDoesNotExist()
        assertThat(stances.memberCalls).isEmpty()
        assertThat(writes.staged).isEmpty()
    }

    // DISPLAY ONLY: nothing a guest borrows reaches the member state — no
    // standing, no landing, no kept pick — and nothing is written anywhere.
    @Test
    fun nothingABorrowedFaceReadsIsWrittenIntoMemberState() {
        val vm = renderAsGuest(HELD)
        assertThat(vm.guest.value.faces).containsKey(HELD)
        val entry = vm.state.value.targets[HELD]
        assertThat(entry?.standing).isNull()
        assertThat(entry?.standingRaw).isNull()
        assertThat(entry?.landing).isNull()
        assertThat(entry?.standingRead ?: false).isFalse()
        assertThat(vm.state.value.kept).isEmpty()
        assertThat(kept.picks.value).isEmpty()
        assertThat(stances.memberCalls).isEmpty()
        assertThat(writes.staged).isEmpty()
    }

    // "Only a nobody borrows stances": a reader with a session never asks.
    @Test
    fun aSignedInReaderNeverAsksForABorrowedStance() {
        compose.setContent {
            StanceControlRoute(target = HELD, testTagPrefix = TAG, viewModel = model())
        }
        compose.waitForIdle()
        assertThat(borrowed.asked).isEmpty()
        assertThat(stances.memberCalls).contains("standing")
        face().assertContentDescriptionEquals("Give your opinion on this post")
    }

    // After sign-in the face is the member's own: the borrowed face is gone
    // from the same holder, and the anchor speaks as theirs.
    @Test
    fun afterSignInTheFaceIsTheMembersOwn() {
        val vm = model()
        var gate: (() -> Unit)? by mutableStateOf({ gated++ })
        compose.setContent {
            CompositionLocalProvider(LocalGuestGate provides gate) {
                StanceControlRoute(target = HELD, testTagPrefix = TAG, viewModel = vm)
            }
        }
        compose.waitForIdle()
        compose.onNodeWithText("😊", useUnmergedTree = true).assertExists()

        gate = null
        compose.waitForIdle()

        assertThat(vm.guest.value).isEqualTo(GuestFaces())
        compose.onNodeWithText("😊", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertExists()
        face().assertContentDescriptionEquals("Give your opinion on this post")
    }

    // A vouch-back's pad is the reader's own act, never the view's: not lent.
    @Test
    fun aVariantPadIsNeverLent() {
        compose.setContent {
            CompositionLocalProvider(LocalGuestGate provides { gated++ }) {
                StanceControlRoute(
                    target = HELD,
                    testTagPrefix = TAG,
                    variant = StancePadVariant("Vouch back", emptyList(), "note"),
                    viewModel = model(),
                )
            }
        }
        compose.waitForIdle()
        assertThat(borrowed.asked).isEmpty()
    }
}
