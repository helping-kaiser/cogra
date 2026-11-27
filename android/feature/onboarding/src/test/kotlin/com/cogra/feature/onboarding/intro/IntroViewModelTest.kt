// The intro's view models against a scripted repository: the flag sets on
// the first show and never waits for a button (OnboardingSteps.md:29), a
// re-watch writes nothing, Next and Back walk the five cards in the boards'
// order, and the gate opens the intro only while the flag is unset
// (OnboardingSteps.md:3-5).

package com.cogra.feature.onboarding.intro

import androidx.lifecycle.SavedStateHandle
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.intro.IntroAccount
import com.cogra.domain.intro.IntroRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

private class ScriptedIntro(var account: Outcome<IntroAccount?>) : IntroRepository {
    var marks = 0

    override suspend fun introAccount(): Outcome<IntroAccount?> = account

    override suspend fun markIntroSeen(): Outcome<Unit> {
        marks += 1
        return Outcome.Success(Unit)
    }
}

private val MIRA = ActorRef("u2", "mira", "Mira Voss")

@OptIn(ExperimentalCoroutinesApi::class)
class IntroViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun intro(
        repo: ScriptedIntro,
        fromSettings: Boolean = false,
        saved: SavedStateHandle = SavedStateHandle(mapOf("fromSettings" to fromSettings)),
    ) = IntroViewModel(saved, repo)

    @Test
    fun theFirstShowSetsTheFlagAtOnceWithNoButtonPressed() {
        val repo = ScriptedIntro(Outcome.Success(IntroAccount(hasSeen = false, inviter = MIRA)))
        intro(repo)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(repo.marks).isEqualTo(1)
    }

    @Test
    fun aReWatchFromSettingsWritesNothing() {
        val repo = ScriptedIntro(Outcome.Success(IntroAccount(hasSeen = true, inviter = MIRA)))
        intro(repo, fromSettings = true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(repo.marks).isEqualTo(0)
    }

    @Test
    fun aRecreatedIntroDoesNotWriteTheFlagTwice() {
        val repo = ScriptedIntro(Outcome.Success(IntroAccount(hasSeen = false, inviter = MIRA)))
        val saved = SavedStateHandle(mapOf("fromSettings" to false))
        intro(repo, saved = saved)
        dispatcher.scheduler.advanceUntilIdle()
        intro(repo, saved = saved)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(repo.marks).isEqualTo(1)
    }

    @Test
    fun theFifthCardWearsTheReadersActualInviter() {
        val repo = ScriptedIntro(Outcome.Success(IntroAccount(hasSeen = false, inviter = MIRA)))
        val vm = intro(repo)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.inviter).isEqualTo(MIRA)
    }

    @Test
    fun aFailedReadLeavesTheCardsStanding() {
        val repo = ScriptedIntro(Outcome.Failed(IOException("offline")))
        val vm = intro(repo)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.card).isEqualTo(IntroCard.Steps)
        assertThat(vm.state.value.inviter).isNull()
    }

    @Test
    fun nextWalksTheFiveCardsInTheBoardsOrder() {
        val vm = intro(ScriptedIntro(Outcome.Success(null)))
        val seen = mutableListOf(vm.state.value.card)
        repeat(INTRO_STEPS - 1) {
            vm.next()
            seen += vm.state.value.card
        }
        assertThat(seen).containsExactly(
            IntroCard.Steps,
            IntroCard.Shape,
            IntroCard.Public,
            IntroCard.Layers,
            IntroCard.Vouch,
        ).inOrder()
        assertThat(vm.state.value.step).isEqualTo(5)
        assertThat(vm.state.value.isLast).isTrue()
    }

    @Test
    fun backOpensTheCardBeforeAndOnTheFirstCardLeaves() {
        val vm = intro(ScriptedIntro(Outcome.Success(null)))
        vm.next()
        vm.next()
        // OnboardingPublic.md:19 — Back on the third card opens the second.
        assertThat(vm.back()).isTrue()
        assertThat(vm.state.value.card).isEqualTo(IntroCard.Shape)
        assertThat(vm.back()).isTrue()
        assertThat(vm.state.value.card).isEqualTo(IntroCard.Steps)
        // OnboardingSteps.md:25 — on the first card Back leaves the way Skip does.
        assertThat(vm.back()).isFalse()
        assertThat(vm.state.value.card).isEqualTo(IntroCard.Steps)
    }

    @Test
    fun theCardSurvivesRecreation() {
        val saved = SavedStateHandle(mapOf("fromSettings" to true))
        val repo = ScriptedIntro(Outcome.Success(null))
        intro(repo, saved = saved).apply {
            next()
            next()
        }
        assertThat(intro(repo, saved = saved).state.value.card).isEqualTo(IntroCard.Public)
    }

    @Test
    fun theGateOpensWhileTheFlagIsUnset() {
        val gate = IntroGateViewModel(ScriptedIntro(Outcome.Success(IntroAccount(hasSeen = false, inviter = null))))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(gate.due.value).isTrue()
        gate.opened()
        assertThat(gate.due.value).isFalse()
    }

    @Test
    fun theGateNeverOpensOnceTheFlagIsSet() {
        val gate = IntroGateViewModel(ScriptedIntro(Outcome.Success(IntroAccount(hasSeen = true, inviter = null))))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(gate.due.value).isFalse()
    }

    @Test
    fun theGateOpensNothingWhenItCannotRead() {
        val gate = IntroGateViewModel(ScriptedIntro(Outcome.Failed(IOException("offline"))))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(gate.due.value).isFalse()
        val guest = IntroGateViewModel(ScriptedIntro(Outcome.Success(null)))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(guest.due.value).isFalse()
    }
}
