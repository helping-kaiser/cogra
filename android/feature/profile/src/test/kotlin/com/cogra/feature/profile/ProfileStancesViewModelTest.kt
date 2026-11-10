// The opinions page's reads (ProfileStances.md): the person, then the tab
// standing now; a tab switch reads the other set in place; the reader is
// never a row on their own page; a fault keeps what stands.

package com.cogra.feature.profile

import com.cogra.domain.AccountState
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileView
import com.cogra.domain.UserProfile
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionDirection
import com.cogra.domain.stance.OpinionHolder
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileStancesViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    private class ScriptedProfiles : ThrowingProfileRepository() {
        var mine: Outcome<ProfileView?> = Outcome.Success(testProfile(id = "u1", handle = "jakob"))
        val byHandle: MutableMap<String, Outcome<ProfileView?>> = mutableMapOf()
        val sets: MutableMap<OpinionDirection, Outcome<List<HeldOpinion>>> = mutableMapOf()
        val asked = mutableListOf<Pair<String, OpinionDirection>>()

        override suspend fun myProfile(): Outcome<ProfileView?> = mine

        override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> =
            byHandle[handle] ?: Outcome.Success(null)

        override suspend fun opinions(actorId: String, direction: OpinionDirection): Outcome<List<HeldOpinion>> {
            asked += actorId to direction
            return sets[direction] ?: Outcome.Success(emptyList())
        }
    }

    private class ScriptedAccount : ThrowingAccountRepository() {
        var profile: UserProfile? = UserProfile("u1", "jakob", null, AccountState.MEMBER, true, null)

        override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)
    }

    private val profiles = ScriptedProfiles()
    private val account = ScriptedAccount()

    private fun viewModel() = ProfileStancesViewModel(profiles, account)

    private fun held(handle: String, actorId: String = "id-$handle", d: Double = 0.5) = HeldOpinion(
        holderId = "addr-$handle",
        holder = OpinionHolder(actorId, handle, null, null, redacted = false),
        pair = StancePair(d, 0.2),
        severed = false,
    )

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    @Test
    fun `the page opens on the person's On set`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("tobias")))
        val vm = viewModel()
        vm.start("ada")
        advanceUntilIdle()

        val state = vm.state.value
        assertThat(profiles.asked).containsExactly("u2" to OpinionDirection.ON)
        assertThat(state.direction).isEqualTo(OpinionDirection.ON)
        assertThat(state.rows!!.map { it.holder.handle }).containsExactly("tobias")
        assertThat(state.whose).isEqualTo(StancesWhose.OTHER)
        assertThat(state.loading).isFalse()
    }

    @Test
    fun `a tab tap reads the other direction in place`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("tobias")))
        profiles.sets[OpinionDirection.BY] = Outcome.Success(listOf(held("mira")))
        val vm = viewModel()
        vm.start("ada")
        advanceUntilIdle()
        vm.onDirection(OpinionDirection.BY)
        assertThat(vm.state.value.rows).isNull()
        advanceUntilIdle()

        assertThat(vm.state.value.direction).isEqualTo(OpinionDirection.BY)
        assertThat(vm.state.value.rows!!.map { it.holder.handle }).containsExactly("mira")
        assertThat(profiles.asked.last()).isEqualTo("u2" to OpinionDirection.BY)
    }

    @Test
    fun `a read the reader moved past never lands on the tab standing now`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("tobias")))
        profiles.sets[OpinionDirection.BY] = Outcome.Success(listOf(held("mira")))
        val vm = viewModel()
        vm.start("ada")
        // The tab moves before the first read answers.
        vm.onDirection(OpinionDirection.BY)
        advanceUntilIdle()

        assertThat(vm.state.value.direction).isEqualTo(OpinionDirection.BY)
        assertThat(vm.state.value.rows!!.map { it.holder.handle }).containsExactly("mira")
    }

    @Test
    fun `the reader is never a row on their own page`() = runTest(dispatcher) {
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("jakob", actorId = "u1"), held("sol")))
        val vm = viewModel()
        vm.start(null)
        advanceUntilIdle()

        assertThat(vm.state.value.whose).isEqualTo(StancesWhose.OWN)
        assertThat(vm.state.value.rows!!.map { it.holder.handle }).containsExactly("sol")
    }

    @Test
    fun `the own page reached by handle is still the reader's own`() = runTest(dispatcher) {
        profiles.byHandle["jakob"] = Outcome.Success(testProfile(id = "u1", handle = "jakob"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("jakob", actorId = "u1")))
        val vm = viewModel()
        vm.start("jakob")
        advanceUntilIdle()

        assertThat(vm.state.value.whose).isEqualTo(StancesWhose.OWN)
        assertThat(vm.state.value.rows).isEmpty()
    }

    @Test
    fun `another's page keeps a row naming the reader`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("jakob", actorId = "u1")))
        val vm = viewModel()
        vm.start("ada")
        advanceUntilIdle()

        assertThat(vm.state.value.rows!!.map { it.holder.handle }).containsExactly("jakob")
    }

    @Test
    fun `a deleted account's page is the deleted reading`() = runTest(dispatcher) {
        val husk = testProfile(id = "u9", handle = "gone")
            .copy(displayName = ModeratedField(null, FieldStatus.REDACTED))
        profiles.byHandle["gone"] = Outcome.Success(husk)
        val vm = viewModel()
        vm.start("gone")
        advanceUntilIdle()

        assertThat(vm.state.value.whose).isEqualTo(StancesWhose.DELETED)
    }

    @Test
    fun `a failed first read stands the fault, and Retry reads again`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.start("ada")
        advanceUntilIdle()
        assertThat(vm.state.value.failed).isTrue()
        assertThat(vm.state.value.rows).isNull()

        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("tobias")))
        vm.refresh()
        advanceUntilIdle()
        assertThat(vm.state.value.failed).isFalse()
        assertThat(vm.state.value.rows!!.map { it.holder.handle }).containsExactly("tobias")
    }

    @Test
    fun `a failed set read stands the fault in the list's place`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.start("ada")
        advanceUntilIdle()

        assertThat(vm.state.value.profile).isNotNull()
        assertThat(vm.state.value.failed).isTrue()
    }

    @Test
    fun `a failed pull keeps the rows that stand`() = runTest(dispatcher) {
        profiles.byHandle["ada"] = Outcome.Success(testProfile(id = "u2", handle = "ada"))
        profiles.sets[OpinionDirection.ON] = Outcome.Success(listOf(held("tobias")))
        val vm = viewModel()
        vm.start("ada")
        advanceUntilIdle()
        profiles.sets[OpinionDirection.ON] = Outcome.Failed(IOException("down"))
        vm.refresh()
        assertThat(vm.state.value.refreshing).isTrue()
        advanceUntilIdle()

        assertThat(vm.state.value.failed).isFalse()
        assertThat(vm.state.value.refreshing).isFalse()
        assertThat(vm.state.value.rows!!.map { it.holder.handle }).containsExactly("tobias")
    }

    @Test
    fun `a handle that names no one is not found`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start("nobody")
        advanceUntilIdle()
        assertThat(vm.state.value.notFound).isTrue()
    }
}
