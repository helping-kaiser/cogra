// The nav-test DI graph: core:network's bindings replaced wholesale
// with core:domain's in-memory fakes, so the real destinations and
// their real Hilt ViewModels run against scriptable state. The
// dormant NetworkProvidesModule stays installed — its providers
// (Apollo, DataStore, Tink) are lazy and nothing in the fake graph
// requests them.

package com.cogra.app.di

import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.HashtagView
import com.cogra.domain.InviteCheck
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.crypto.ActorKey
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.SessionInfo
import com.cogra.domain.TaggedContentView
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
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
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.ThrowingSessionRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.cogra.domain.testing.SealingWriteRepository
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
        tags: List<String>,
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

/**
 * Every screen that renders content renders stance controls with it, so
 * the nav graph needs a stance read side that answers rather than
 * throws. It reports an unauthored bundle by default: the control shows,
 * and nothing about it is scripted unless a test asks.
 *
 * The staging leg goes through the real [WriteRepository], exactly as
 * the production repository does, so a test that commits a stance runs
 * the whole signing chain rather than a shortcut around it.
 */
class ScriptedStanceRepository(private val writes: WriteRepository) : ThrowingStanceRepository() {
    var net = StancePair.Origin
    var raw: StancePair? = null
    var records = 0

    override suspend fun prepareStance(
        target: String,
        pick: StancePair,
    ): Outcome<List<PreparedWriteView>> = writes.prepareStance(target, pick.pDirected, pick.pInterest)

    override suspend fun standing(target: String, includePending: Boolean): Outcome<StanceStanding> =
        Outcome.Success(
            StanceStanding(target, net, raw ?: net, records, includePending = includePending),
        )

    override suspend fun projection(
        target: String,
        pick: StancePair,
        includePending: Boolean,
    ): Outcome<StanceProjection> = Outcome.Success(
        StanceProjection(
            pick = pick,
            net = pick,
            inertDirected = pick.pDirected == 0.0,
            inertInterest = pick.pInterest == 0.0,
            severance = pick == StancePair.Origin,
        ),
    )

    override suspend fun severanceQuote(target: String, includePending: Boolean): Outcome<SeveranceQuote> =
        Outcome.Success(
            SeveranceQuote(
                target = target,
                standing = net,
                raw = raw ?: net,
                records = records,
                alreadySevered = net == StancePair.Origin,
            ),
        )
}

/**
 * A topic surface enough for the nav graph to render: an empty topic
 * (no content, unfollowed) unless a test scripts otherwise. The follow
 * leg goes through the real [WriteRepository], the same as
 * [ScriptedStanceRepository], so a test that commits a follow runs the
 * whole signing chain.
 */
class ScriptedTopicRepository(private val writes: WriteRepository) : ThrowingTopicRepository() {
    var hashtags: MutableMap<String, HashtagView> = mutableMapOf()
    var content: MutableMap<String, List<TaggedContentView>> = mutableMapOf()
    var net = StancePair.Origin
    var raw: StancePair? = null
    var records = 0

    override suspend fun hashtag(name: String): Outcome<HashtagView?> =
        Outcome.Success(hashtags[name] ?: HashtagView(id = "hashtag-$name", name = testModeratedField(name)))

    override suspend fun taggedContent(
        name: String,
        limit: Int?,
        includePending: Boolean,
    ): Outcome<List<TaggedContentView>> = Outcome.Success(content[name].orEmpty())

    override suspend fun prepareTag(
        target: String,
        name: String,
        pDirected: Double?,
        pInterest: Double?,
    ): Outcome<List<PreparedWriteView>> = writes.prepareStance(target, pDirected ?: 0.1, pInterest ?: 1.0)

    override suspend fun followStanding(name: String, includePending: Boolean): Outcome<StanceStanding> =
        Outcome.Success(StanceStanding(name, net, raw ?: net, records, includePending = includePending))

    override suspend fun prepareFollow(name: String, pick: StancePair): Outcome<List<PreparedWriteView>> =
        writes.prepareStance(name, pick.pDirected, pick.pInterest)

    override suspend fun followSeveranceQuote(name: String, includePending: Boolean): Outcome<SeveranceQuote> =
        Outcome.Success(
            SeveranceQuote(
                target = name,
                standing = net,
                raw = raw ?: net,
                records = records,
                alreadySevered = net == StancePair.Origin,
            ),
        )

    override suspend fun prepareUnfollow(name: String): Outcome<List<PreparedWriteView>> =
        Outcome.Success(emptyList())
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

    /**
     * The actor the sealing write repository signs as. A test that wants
     * a write to land seeds the identity store from this same key, so
     * the device's signature and the host's expectation agree.
     */
    @Provides
    @Singleton
    fun signingActor(): ActorKey = ActorKey.generate()

    @Provides
    @Singleton
    fun writeRepository(actor: ActorKey): WriteRepository = SealingWriteRepository(actor)

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

    @Provides
    @Singleton
    fun scriptedStanceRepository(writes: WriteRepository): ScriptedStanceRepository =
        ScriptedStanceRepository(writes)

    @Provides
    fun stanceRepository(fake: ScriptedStanceRepository): StanceRepository = fake

    @Provides
    @Singleton
    fun scriptedTopicRepository(writes: WriteRepository): ScriptedTopicRepository =
        ScriptedTopicRepository(writes)

    @Provides
    fun topicRepository(fake: ScriptedTopicRepository): TopicRepository = fake
}
