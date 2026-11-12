// AN APPLICANT'S FACE IS LOCKED, NOT GONE (ApplicantFeed.md:45-47,
// ApplicantWaiting.md:23-25, ApplicantLanding.md:25-27, ApplicantRejected.md:23-25,
// ApplicantFellThrough.md:25-27, ProfileOther.md:47-49; PR-103): the tap and the
// press-and-hold each answer `You can give your opinion once you're in.` on the
// snackbar the signing's confirmation uses, the pad never blooms and nothing is
// staged. A member's face and a guest's gate are unchanged. The one route every
// host draws (cards, post detail, comments, the profile's wide anchor, a topic's
// affinity), so one class covers every host.

package com.cogra.feature.stance

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReaderStanding
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private val POST = StanceTarget.Node("post-1")
private const val TAG = "card"
private const val LINE = "You can give your opinion once you're in."

@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StanceControlRouteLockTest {

    @get:Rule
    val compose = createComposeRule()

    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)
    private val standing = ReaderStanding()
    private val host = SnackbarHostState()

    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StancePair>()

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            staged += pick
            return writes.prepareStance((target as StanceTarget.Node).id, pick.pDirected, pick.pInterest)
        }

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> =
            Outcome.Success(StanceStanding(target, StancePair.Origin, StancePair.Origin, 0, includePending, false))

        override suspend fun kindOf(target: StanceTarget): StanceKind = StanceKind.POST
    }

    private val account = object : ThrowingAccountRepository() {
        override suspend fun borrowedView(): Outcome<ActorRef?> = Outcome.Success(null)
    }

    private fun render(state: AccountState?, onRequireAccount: (() -> Unit)? = null) {
        standing.record(state)
        val vm = StanceViewModel(
            stances,
            WriteSigner(writes, identity),
            identity,
            StanceSignals(),
            account,
            InMemoryKeptPickStore(),
            standing,
        )
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                StanceControlRoute(
                    target = POST,
                    testTagPrefix = TAG,
                    onRequireAccount = onRequireAccount,
                    viewModel = vm,
                )
            }
        }
        compose.waitForIdle()
    }

    private fun face() = compose.onNodeWithTag("${TAG}_stance")

    private fun said(): String? = host.currentSnackbarData?.visuals?.message

    // ApplicantFeed.md:45 — WHEN tap a stance face -> the snackbar reads … AND NEVER the pad blooms
    @Test
    fun anApplicantsTapSaysTheLineAndThePadNeverBlooms() {
        render(AccountState.APPLICANT)
        face().performClick()
        compose.waitForIdle()
        assertThat(said()).isEqualTo(LINE)
        compose.onNodeWithTag("${TAG}_stance_pad").assertDoesNotExist()
    }

    // ApplicantFeed.md:47 — WHEN press-and-hold a stance face -> the snackbar reads …
    // AND NEVER anything is signed or staged
    @Test
    fun anApplicantsHoldSaysTheLineAndStagesNothing() {
        render(AccountState.APPLICANT)
        face().performTouchInput { longClick() }
        compose.waitForIdle()
        assertThat(said()).isEqualTo(LINE)
        assertThat(stances.staged).isEmpty()
    }

    // A member's face is unchanged: the tap blooms the pad, and no line.
    @Test
    fun aMembersTapStillBloomsThePad() {
        render(AccountState.MEMBER)
        face().performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        assertThat(said()).isNull()
    }

    // A guest's face keeps its gate (the join prompt), never the applicant's line.
    @Test
    fun aGuestsTapStillRaisesTheGate() {
        var gated = 0
        render(state = null, onRequireAccount = { gated++ })
        face().performClick()
        compose.waitForIdle()
        assertThat(gated).isEqualTo(1)
        assertThat(said()).isNull()
    }
}
