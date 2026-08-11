// The nav-test DI graph: core:network's bindings replaced wholesale
// with core:domain's in-memory fakes, so the real destinations and
// their real Hilt ViewModels run against scriptable state. The
// dormant NetworkProvidesModule stays installed — its providers
// (Apollo, DataStore, Tink) are lazy and nothing in the fake graph
// requests them.

package com.cogra.app.di

import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.InviteCheck
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.StorageHealth
import com.cogra.domain.store.TokenStore
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeStorageHealth
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingSessionRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.network.di.NetworkBindsModule
import dagger.Module
import dagger.Provides
import dagger.hilt.components.SingletonComponent
import dagger.hilt.testing.TestInstallIn
import javax.inject.Singleton

/** Scriptable account state: tests set the profile and backup blob. */
class ScriptedAccountRepository : ThrowingAccountRepository() {
    var profile: UserProfile? = null
    var backupBlob: ByteArray? = null
    var uploadedBackup: ByteArray? = null

    override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)

    override suspend fun keyBackup(): Outcome<ByteArray?> = Outcome.Success(backupBlob)

    override suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit> {
        uploadedBackup = blob
        return Outcome.Success(Unit)
    }

    override suspend fun changeHandle(handle: String): Outcome<Unit> {
        profile = profile?.copy(handle = handle)
        return Outcome.Success(Unit)
    }
}

/** Sessions enough for the Settings destination to render and sign out. */
class ScriptedSessionRepository : ThrowingSessionRepository() {
    override suspend fun sessions(): Outcome<List<SessionInfo>> = Outcome.Success(emptyList())

    override suspend fun revokeSession(id: String?): Outcome<Unit> = Outcome.Success(Unit)
}

/** Scriptable applicant state: tests set the me-driven status. */
class ScriptedOnboardingRepository : ThrowingOnboardingRepository() {
    var status: ApplicationStatus = ApplicationStatus(AccountState.APPLICANT, null, null, null)
    val attachedKeys = mutableListOf<String>()
    var inviteCheck: Outcome<InviteCheck?> = Outcome.Success(null)
    val checkedInviteIds = mutableListOf<String>()

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> = Outcome.Success(status)

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> {
        checkedInviteIds += id
        return inviteCheck
    }

    override suspend fun attachActorKey(actorPubkeyBase64: String, l0Address: String): Outcome<Unit> {
        attachedKeys += actorPubkeyBase64
        return Outcome.Success(Unit)
    }
}

@Module
@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [NetworkBindsModule::class],
)
object FakeBindingsModule {

    @Provides
    @Singleton
    fun fakeTokenStore(): FakeTokenStore = FakeTokenStore()

    @Provides
    fun tokenStore(fake: FakeTokenStore): TokenStore = fake

    @Provides
    @Singleton
    fun fakeIdentityStore(): FakeIdentityStore = FakeIdentityStore()

    @Provides
    fun identityStore(fake: FakeIdentityStore): IdentityStore = fake

    @Provides
    @Singleton
    fun fakeStorageHealth(): FakeStorageHealth = FakeStorageHealth()

    @Provides
    fun storageHealth(fake: FakeStorageHealth): StorageHealth = fake

    @Provides
    @Singleton
    fun scriptedAccountRepository(): ScriptedAccountRepository = ScriptedAccountRepository()

    @Provides
    fun accountRepository(fake: ScriptedAccountRepository): AccountRepository = fake

    @Provides
    @Singleton
    fun scriptedOnboardingRepository(): ScriptedOnboardingRepository = ScriptedOnboardingRepository()

    @Provides
    fun onboardingRepository(fake: ScriptedOnboardingRepository): OnboardingRepository = fake

    @Provides
    @Singleton
    fun sessionRepository(): SessionRepository = ScriptedSessionRepository()

    @Provides
    @Singleton
    fun writeRepository(): WriteRepository = ThrowingWriteRepository()
}
