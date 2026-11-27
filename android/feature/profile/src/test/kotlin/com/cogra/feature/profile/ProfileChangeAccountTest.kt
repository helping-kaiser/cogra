package com.cogra.feature.profile

import com.cogra.domain.Outcome
import com.cogra.domain.testing.TEST_PROFILE_ID
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException

/**
 * The account boundary and the key: an act prepares and signs only for the
 * account that pressed, its line bound to that account (Profile.md:101; auth.md
 * "Multi-account device custody"), and a device without the key signs nothing
 * (ProfileEditSeal.md:61).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ProfileChangeAccountTest : ProfileEditHarness() {

    @Test
    fun aSwitchBeforeThePrepareAnswersSignsNothingForTheOtherAccount() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()

        switchTo("account-b")
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        // The prepare answered, the signing never ran: nothing relays.
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(sealer.staged.values.map { it.state.name }).doesNotContain("RELAYING")
        assertThat(signedProfile.laid.value).isNull()
        // Nothing is drawn under B's head. Stopped by the owner guard, the act
        // signed nothing: it is A's failed line, standing under A's head again
        // (Profile.md:101, "until Retry or the next change" — a switch is neither).
        assertThat(line()).isNull()
        switchTo(TEST_PROFILE_ID)
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
    }

    @Test
    fun aPressWithAnotherAccountActiveNeverPrepares() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.onSubmit()
        switchTo(null)
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.signing).isFalse()
    }

    @Test
    fun aRetryHeldPastASwitchDoesNothing() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        val failed = line() as ProfileChangeLine.Failed
        assertThat(profiles.prepareCalls).isEqualTo(1)

        // The line goes at the switch; its Retry, held by a composition, is pressed under B.
        switchTo("account-b")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        profiles.prepareGate = null
        profiles.prepareOutcome = null
        failed.retry()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(signedProfile.laid.value).isNull()

        // Back on A the line stands again (Profile.md:101: a switch is neither Retry
        // nor the next change), and its Retry signs once, under A.
        switchTo(TEST_PROFILE_ID)
        dispatcher.scheduler.advanceUntilIdle()
        val again = line() as ProfileChangeLine.Failed
        again.retry()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(2)
        assertThat(line()).isNull()
        assertThat(signedProfile.laid.value).isNotNull()
    }

    @Test
    fun aFailedLineIsHiddenUnderAnotherAccountAndStandsAgainUnderItsOwn() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)

        switchTo("account-b")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        switchTo(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        switchTo(TEST_PROFILE_ID)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
    }

    @Test
    fun aSwitchAfterThePrepareConfirmsNothingToTheOtherAccount() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val landed = mutableListOf<Unit>()
        backgroundScope.launch { changes.landed.collect { landed += it } }
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        // The prepare already answered for A when B arrives: the act was stopped
        // before signing, so it is A's failed line, never B's snackbar.
        profiles.prepareGate?.complete(Unit)
        switchTo("account-b")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(landed).isEmpty()
        assertThat(line()).isNull()
    }

    // -- THE KEY NOT ON THIS DEVICE (ProfileEditSeal.md:61-:63) --

    @Test
    fun aPressWithoutTheKeyIsTheKeyNoticeAndPreparesNothing() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.KeyAbsent)
        assertThat(vm.state.value.signing).isFalse()
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(signedProfile.laid.value).isNull()

        // Not now: the seal as it stood before the press, nothing kept or signed.
        vm.seal.onNotNow()
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(vm.state.value.bio).isEqualTo("Hello")
    }

    /** The key goes while the prepare runs: the signer finds none, and nothing is signed. */
    @Test
    fun aKeyGoneBeforeTheSigningIsTheKeyNoticeNotACrash() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        identity.seed = null
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.KeyAbsent)
        assertThat(sealer.staged.values.map { it.state.name }).doesNotContain("RELAYING")
        assertThat(signedProfile.laid.value).isNull()
    }
}
