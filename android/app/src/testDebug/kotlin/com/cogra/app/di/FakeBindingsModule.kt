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
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.SessionInfo
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.StorageHealth
import com.cogra.domain.store.TokenStore
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeStorageHealth
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testModeratedField
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

    override suspend fun keyBackupChallenge(): Outcome<ByteArray> = Outcome.Success(ByteArray(32) { 0x71 })

    override suspend fun uploadKeyBackup(
        blob: ByteArray,
        challenge: ByteArray,
        signature: ByteArray,
    ): Outcome<Unit> {
        uploadedBackup = blob
        return Outcome.Success(Unit)
    }

    override suspend fun changeHandle(handle: String): Outcome<Unit> {
        profile = profile?.copy(handle = handle)
        return Outcome.Success(Unit)
    }
}

/**
 * Scriptable feed state: tests set the listing and detail pages.
 * `preparePost` answers with the node the post will serve under and no
 * writes — the signer completes trivially, which is the point:
 * navigation tests exercise the flow, not the crypto.
 */
class ScriptedContentRepository : ThrowingContentRepository() {
    var listing: List<PostView> = emptyList()
    var details: MutableMap<String, PostDetail> = mutableMapOf()
    var preparedNode: String = "p-new"

    /**
     * The entry the server starts serving once the write is prepared,
     * so a re-read of the listing differs from the one before it — how
     * a test tells a refreshed feed from a stale one.
     */
    var pendingAfterPrepare: PostView? = null

    override suspend fun preparePost(
        title: String?,
        description: String?,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView> {
        pendingAfterPrepare?.let { listing = listOf(it) + listing }
        return Outcome.Success(PreparedContentView(preparedNode, emptyList()))
    }

    override suspend fun posts(
        first: Int,
        after: String?,
        includePending: Boolean,
    ): Outcome<Page<PostView>> =
        Outcome.Success(Page(listing, endCursor = null, hasNextPage = false))

    override suspend fun post(
        id: String,
        commentsFirst: Int,
        commentsAfter: String?,
        includePending: Boolean,
    ): Outcome<PostDetail?> = Outcome.Success(details[id])
}

/** Scriptable profile surface: the viewer's own, others by handle,
 * and the chronicle rows. prepareProfileUpdate applies the edit and
 * returns no writes — the signer completes trivially, which is the
 * point: navigation tests exercise the flow, not the crypto. */
class ScriptedProfileRepository : ThrowingProfileRepository() {
    var profile: ProfileView? = null
    var others: MutableMap<String, ProfileView> = mutableMapOf()
    var records: List<RecordRow> = emptyList()
    val updates = mutableListOf<Triple<String, String?, String?>>()

    override suspend fun myProfile(): Outcome<ProfileView?> = Outcome.Success(profile)

    override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> =
        Outcome.Success(others[handle] ?: profile?.takeIf { it.handle == handle })

    override suspend fun authorRecords(
        authorId: String,
        family: com.cogra.crypto.Family?,
        first: Int,
        after: String?,
    ): Outcome<Page<RecordRow>> = Outcome.Success(Page(records, endCursor = null, hasNextPage = false))

    override suspend fun prepareProfileUpdate(
        displayName: String,
        bio: String?,
        websiteUrl: String?,
    ): Outcome<List<PreparedWriteView>> {
        updates += Triple(displayName, bio, websiteUrl)
        profile = profile?.copy(
            displayName = testModeratedField(displayName),
            bio = testModeratedField(bio),
            websiteUrl = testModeratedField(websiteUrl),
        )
        return Outcome.Success(emptyList())
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

    @Provides
    @Singleton
    fun scriptedContentRepository(): ScriptedContentRepository = ScriptedContentRepository()

    @Provides
    fun contentRepository(fake: ScriptedContentRepository): ContentRepository = fake

    @Provides
    @Singleton
    fun scriptedProfileRepository(): ScriptedProfileRepository = ScriptedProfileRepository()

    @Provides
    fun profileRepository(fake: ScriptedProfileRepository): ProfileRepository = fake
}
