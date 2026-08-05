// The nav-test DI graph: core:network's bindings replaced wholesale
// with core:domain's in-memory fakes, so the real destinations and
// their real Hilt ViewModels run against scriptable state. The
// dormant NetworkProvidesModule stays installed — its providers
// (Apollo, DataStore, Tink) are lazy and nothing in the fake graph
// requests them.

package com.cogra.app.di

import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import com.cogra.domain.testing.FakeIdentityStore
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

    override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)

    override suspend fun keyBackup(): Outcome<ByteArray?> = Outcome.Success(backupBlob)
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
    fun scriptedAccountRepository(): ScriptedAccountRepository = ScriptedAccountRepository()

    @Provides
    fun accountRepository(fake: ScriptedAccountRepository): AccountRepository = fake

    @Provides
    @Singleton
    fun onboardingRepository(): OnboardingRepository = ThrowingOnboardingRepository()

    @Provides
    @Singleton
    fun sessionRepository(): SessionRepository = ThrowingSessionRepository()

    @Provides
    @Singleton
    fun writeRepository(): WriteRepository = ThrowingWriteRepository()
}
