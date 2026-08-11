package com.cogra.feature.invites

import com.cogra.crypto.ActorKey
import com.cogra.domain.ErrorCode
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import java.time.Instant
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
class InvitesViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)

    private val account = object : ThrowingAccountRepository() {
        val links = mutableListOf<InviteLinkInfo>()
        var approveOutcome: Outcome<List<PreparedWriteView>>? = null
        var revokeOutcome: Outcome<Unit>? = null
        var approveCalls = 0

        override suspend fun inviteLinks(): Outcome<List<InviteLinkInfo>> = Outcome.Success(links.toList())

        override suspend fun createInviteLink(
            expiresAt: Instant,
            prefillPDirected: Double,
            prefillPInterest: Double,
            singleUse: Boolean,
        ): Outcome<InviteLinkInfo> {
            val link = InviteLinkInfo(
                "link-${links.size}",
                prefillPDirected,
                prefillPInterest,
                singleUse,
                Instant.EPOCH,
                expiresAt,
                null,
                emptyList(),
            )
            links += link
            return Outcome.Success(link)
        }

        override suspend fun revokeInviteLink(id: String): Outcome<Unit> {
            revokeOutcome?.let { return it }
            val index = links.indexOfFirst { it.id == id }
            links[index] = links[index].copy(revokedAt = Instant.EPOCH)
            return Outcome.Success(Unit)
        }

        override suspend fun approveApplication(
            applicationId: String,
            pDirected: Double,
            pInterest: Double,
        ): Outcome<List<PreparedWriteView>> {
            approveCalls += 1
            return approveOutcome ?: writes.prepareStance(applicationId, pDirected, pInterest)
        }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = InvitesViewModel(
        account,
        WriteSigner(writes, identity),
        identity,
        "https://cogra.example",
    )

    @Test
    fun createAndRevokeRefreshTheList() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSingleUseChange(true)
        vm.onCreate()
        dispatcher.scheduler.advanceUntilIdle()
        val link = vm.state.value.links.single()
        assertThat(link.singleUse).isTrue()
        assertThat(vm.shareUrl(link)).isEqualTo("https://cogra.example/join/${link.id}")

        vm.onRevoke(link.id)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.links.single().revokedAt).isNotNull()
    }

    @Test
    fun approvingSignsTheVouchOnDevice() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onApprove("application-1", 0.4, 0.2)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.vouchSigned).isTrue()
        assertThat(vm.state.value.approvingId).isNull()
        // The signed vouch reached the relay through the real chain.
        assertThat(writes.staged.values.single().state)
            .isEqualTo(com.cogra.domain.WriteState.RELAYING)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun aRefusedRevocationSurfaces() = runTest(dispatcher) {
        account.revokeOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.NOT_FOUND, "no such live invite link")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onRevoke("link-0")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.NOT_FOUND)
    }

    @Test
    fun aRefusedApprovalSurfaces() = runTest(dispatcher) {
        account.approveOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "already approved")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onApprove("application-1", 0.4, 0.2)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.BAD_INPUT)
        assertThat(vm.state.value.vouchSigned).isFalse()
    }

    @Test
    fun theHuskStateIsReflectedOnRefresh() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.seedOnDevice).isFalse()
    }

    @Test
    fun approvingWithoutTheActorKeyIsGatedBeforeThePricedAct() = runTest(dispatcher) {
        // The husk state (signed in, key not restored): the priced
        // approval must not land only to strand the unsigned vouch —
        // and the process must not die (audit android M3).
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        identity.seed = null
        vm.onApprove("application-1", 0.4, 0.2)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.approveCalls).isEqualTo(0)
        assertThat(writes.staged).isEmpty()
        assertThat(vm.state.value.approvingId).isNull()
        assertThat(vm.state.value.seedOnDevice).isFalse()
        assertThat(vm.state.value.vouchSigned).isFalse()
    }
}
