// Shared test doubles: in-memory stores, throwing repository bases to
// override per test, and a minimal in-test host sealer that mirrors
// what the backend's relay does — verify nothing, salt, commit, seal —
// so orchestration tests exercise the real crypto chain end to end.

package com.cogra.domain.testing

import com.cogra.crypto.ActId
import com.cogra.crypto.ActorKey
import com.cogra.crypto.EDITION
import com.cogra.crypto.Family
import com.cogra.crypto.NodeId
import com.cogra.crypto.PreSignedProposal
import com.cogra.crypto.Proposal
import com.cogra.crypto.SALT_LEN
import com.cogra.crypto.StructuralBody
import com.cogra.crypto.Tags
import com.cogra.crypto.VerifiedAct
import com.cogra.crypto.contentCommitment
import com.cogra.crypto.decodePreCommitment
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.depsCommitment
import com.cogra.crypto.encodeProposal
import com.cogra.crypto.encodeVerifiedAct
import com.cogra.crypto.preCommitment
import com.cogra.domain.ActorRef
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentForEdit
import com.cogra.domain.CommentPage
import com.cogra.domain.CommentView
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.HashtagView
import com.cogra.domain.InviteCheck
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.LoginGrant
import com.cogra.domain.MediaAssetView
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostBacking
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.StagedWriteView
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaDestination
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaReadiness
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.UploadProgress
import com.cogra.domain.media.VideoFrame
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.DeviceLockRepository
import com.cogra.domain.repo.IssuedLock
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.settings.AccountEmail
import com.cogra.domain.settings.EmailChangeLinkCheck
import com.cogra.domain.settings.PendingEmailChange
import com.cogra.domain.settings.SettingsAccount
import com.cogra.domain.settings.SettingsRepository
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.ExpectedNetting
import com.cogra.domain.signing.NodeExpectation
import com.cogra.domain.signing.Parents
import com.cogra.domain.signing.stanceRecord
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.store.DeviceData
import com.cogra.domain.store.DevicePreferences
import com.cogra.domain.store.HeldLock
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.LockCustodyStore
import com.cogra.domain.store.StorageHealth
import com.cogra.domain.store.ThemeChoice
import com.cogra.domain.store.TokenStore
import com.cogra.domain.topics.TagClaim
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import java.time.Instant

class FakeTokenStore : TokenStore {
    override val tokens = MutableStateFlow<AuthTokens?>(null)

    override suspend fun current(): AuthTokens? = tokens.value

    override suspend fun save(tokens: AuthTokens) {
        this.tokens.value = tokens
    }

    override suspend fun clear() {
        tokens.value = null
    }
}

/** Account-implicit like the interface: one active account's slot. */
class FakeIdentityStore : IdentityStore {
    var seed: ByteArray? = null
    var pendingBlob: ByteArray? = null
    var stancePadTaught = false
    var forgetOnSignOut = false
    val handshakes = mutableMapOf<String, PreSignedProposal>()

    override suspend fun actorSeed(): ByteArray? = seed

    override suspend fun saveActorSeed(seed: ByteArray) {
        this.seed = seed
    }

    override suspend fun pendingBackupBlob(): ByteArray? = pendingBlob

    override suspend fun savePendingBackupBlob(blob: ByteArray) {
        pendingBlob = blob
    }

    override suspend fun clearPendingBackupBlob() {
        pendingBlob = null
    }

    override suspend fun handshake(stagedWriteId: String): PreSignedProposal? = handshakes[stagedWriteId]

    override suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal) {
        handshakes[stagedWriteId] = pre
    }

    override suspend fun clearHandshake(stagedWriteId: String) {
        handshakes.remove(stagedWriteId)
    }

    override suspend fun handshakeIds(): Set<String> = handshakes.keys.toSet()

    val carriedExpectations = mutableMapOf<String, ByteArray>()

    override suspend fun carriedExpectation(stagedWriteId: String): ByteArray? = carriedExpectations[stagedWriteId]

    override suspend fun saveCarriedExpectation(stagedWriteId: String, digest: ByteArray) {
        carriedExpectations[stagedWriteId] = digest
    }

    override suspend fun clearCarriedExpectation(stagedWriteId: String) {
        carriedExpectations.remove(stagedWriteId)
    }

    override suspend fun stancePadTaught(): Boolean = stancePadTaught

    override suspend fun markStancePadTaught() {
        stancePadTaught = true
    }

    private val inputMode = MutableStateFlow(StanceInputMode.Default)

    override val stanceInputMode: Flow<StanceInputMode> = inputMode

    override suspend fun setStanceInputMode(mode: StanceInputMode) {
        inputMode.value = mode
    }

    val confirmMultiAction = MutableStateFlow(true)

    override val confirmMultiActionSubmits: Flow<Boolean> = confirmMultiAction

    override suspend fun setConfirmMultiActionSubmits(value: Boolean) {
        confirmMultiAction.value = value
    }

    override suspend fun forgetOnSignOut(): Boolean = forgetOnSignOut

    override suspend fun setForgetOnSignOut(value: Boolean) {
        forgetOnSignOut = value
    }

    var keyBacked = false

    override suspend fun setKeyBacked(value: Boolean) {
        keyBacked = value
    }

    /** How many times the explicit sign-out's custody-set purge ran. */
    var custodyPurges = 0

    override suspend fun purgeCustodySet() {
        custodyPurges++
        clearSlot()
    }

    private fun clearSlot() {
        seed = null
        pendingBlob = null
        stancePadTaught = false
        forgetOnSignOut = false
        inputMode.value = StanceInputMode.Default
        confirmMultiAction.value = true
        handshakes.clear()
    }
}

/**
 * The device lock's custody, in memory and per account: each account's
 * custody set is a map of named values, `draft` names among them. A lock
 * moves the set aside under the secret it was held with; the unlock gives it
 * back only for that same secret. The real store's encryption and atomicity
 * are `LockCustodyStoreImpl`'s own suite's (core:network).
 */
class FakeLockCustodyStore : LockCustodyStore {
    val forget = mutableSetOf<String>()
    val backed = mutableSetOf<String>()
    val custody = mutableMapOf<String, MutableMap<String, ByteArray>>()
    val held = mutableMapOf<String, HeldLock>()
    val lockIds = mutableMapOf<String, String>()
    val pending = mutableSetOf<String>()
    val locked = mutableMapOf<String, Pair<ByteArray, Map<String, ByteArray>>>()

    /** The draft's names in a fake set start with this. */
    val draftPrefix = "draft"

    fun custodyOf(account: String): MutableMap<String, ByteArray> = custody.getOrPut(account) { mutableMapOf() }

    override suspend fun forgetOnSignOut(account: String): Boolean = account in forget

    override suspend fun heldLock(account: String): HeldLock? = held[account]

    override suspend fun holdLock(account: String, lock: HeldLock): String? {
        val replaced = lockIds[account]?.takeIf { it != lock.id }
        held[account] = lock
        lockIds[account] = lock.id
        return replaced
    }

    override suspend fun lockId(account: String): String? = lockIds[account]

    override suspend fun dropLock(account: String) {
        held.remove(account)
        lockIds.remove(account)
    }

    override suspend fun setLockPending(account: String, pending: Boolean) {
        if (pending) {
            this.pending.add(account)
        } else {
            this.pending.remove(account)
        }
    }

    override suspend fun isLockPending(account: String): Boolean = account in pending

    override suspend fun lock(account: String): Boolean {
        val secret = held[account]?.secret ?: return false
        if (account in locked) return false
        val slot = custodyOf(account)
        if (account in backed) slot.keys.removeAll { it.startsWith(KEY_MATERIAL) }
        locked[account] = Pair(secret, slot.toMap())
        slot.clear()
        held.remove(account)
        return true
    }

    override suspend fun isLocked(account: String): Boolean = account in locked

    override suspend fun unlock(account: String, secret: ByteArray): Boolean {
        val (lockedWith, slot) = locked[account] ?: return false
        if (!lockedWith.contentEquals(secret)) return false
        custodyOf(account).putAll(slot)
        locked.remove(account)
        return true
    }

    override suspend fun deleteDeadLockedSet(account: String) {
        locked.remove(account)
        lockIds.remove(account)
        pending.remove(account)
    }

    override suspend fun purgeBackedKeyMaterial(account: String) {
        if (account in backed) custodyOf(account).keys.removeAll { it.startsWith(KEY_MATERIAL) }
    }

    override suspend fun removeLeftoverDraft(account: String) {
        if (account in locked) custodyOf(account).keys.removeAll { it.startsWith(draftPrefix) }
    }

    /** Accounts whose seen record was dropped. */
    val seenForgotten = mutableListOf<String>()

    override suspend fun forgetSeenRecord(account: String) {
        seenForgotten += account
    }

    override suspend fun lockSlots(): Set<String> = locked.keys + pending

    companion object {
        /** The key material's names in a fake set start with this. */
        const val KEY_MATERIAL = "key"
    }
}

/**
 * The server half, in memory: one row per issue, released behind the
 * account's CURRENT password, NOT_FOUND for an unknown or foreign lock —
 * `crates/api`'s device-lock verbs as `device_lock.rs` pins them. A token
 * names its account as `token-<account>`; a null token is [sessionAccount].
 */
class FakeDeviceLockRepository : DeviceLockRepository {
    val rows = mutableMapOf<String, Pair<String, ByteArray>>()
    val passwords = mutableMapOf<String, String>()
    var online = true
    var sessionAccount: String? = null
    var issues = 0
    var releases = 0
    var discards = 0
    private var next = 0

    private fun accountOf(token: String?): String? = token?.removePrefix("token-") ?: sessionAccount

    private val offline = Outcome.Failed(java.io.IOException("offline"))

    override suspend fun issue(accessToken: String?): Outcome<IssuedLock> {
        issues++
        if (!online) return offline
        val account = accountOf(accessToken) ?: return offline
        val id = "lock-${next++}"
        val secret = ByteArray(32) { (next * 7 + it).toByte() }
        rows[id] = account to secret
        return Outcome.Success(IssuedLock(id, secret.copyOf()))
    }

    override suspend fun release(lock: String, password: String, accessToken: String?): Outcome<ByteArray> {
        releases++
        if (!online) return offline
        val account = accountOf(accessToken)
        if (account == null || passwords[account] != password) {
            return Outcome.Refused(listOf(UserError(ErrorCode.INVALID_CREDENTIALS, "no", listOf("password"))))
        }
        val row = rows[lock]?.takeIf { it.first == account }
            ?: return Outcome.Refused(listOf(UserError(ErrorCode.NOT_FOUND, "no lock", listOf("lock"))))
        return Outcome.Success(row.second.copyOf())
    }

    override suspend fun discard(lock: String, accessToken: String?): Outcome<Unit> {
        discards++
        if (!online) return offline
        if (rows[lock]?.first == accountOf(accessToken)) rows.remove(lock)
        return Outcome.Success(Unit)
    }
}

class FakeDevicePreferences : DevicePreferences {
    override val theme = MutableStateFlow(ThemeChoice.AUTO)

    override suspend fun setTheme(choice: ThemeChoice) {
        theme.value = choice
    }

    override val showExactValues = MutableStateFlow(false)

    override suspend fun setShowExactValues(value: Boolean) {
        showExactValues.value = value
    }
}

/**
 * The device's whole store, as the fakes hold it: an erase empties every
 * fake it is handed, the way the one encrypted store's single edit does.
 */
class FakeDeviceData(
    private val tokens: FakeTokenStore? = null,
    private val identity: FakeIdentityStore? = null,
    private val preferences: FakeDevicePreferences? = null,
) : DeviceData {
    var erases = 0

    override suspend fun eraseEverything() {
        erases += 1
        tokens?.clear()
        identity?.purgeCustodySet()
        preferences?.theme?.value = ThemeChoice.AUTO
        preferences?.showExactValues?.value = false
    }
}

class FakeStorageHealth : StorageHealth {
    val lost = MutableStateFlow(false)

    override val storageLost = lost

    override suspend fun acknowledge() {
        lost.value = false
    }
}

/** The backend's relay side, minimally: salt, commit, seal. */
class TestHost {
    val key: ActorKey = ActorKey.generate()

    fun seal(canonicalProposal: ByteArray, preCommitmentBlob: ByteArray, authorPubkey: ByteArray): ByteArray {
        val proposal = decodeProposal(canonicalProposal)
        val pre = decodePreCommitment(preCommitmentBlob)
        val contentSalt = ByteArray(SALT_LEN) { 3 }
        val depsSalt = ByteArray(SALT_LEN) { 4 }
        val actId = proposal.body.actId()
        val formed = preCommitment(proposal, pre.nonce)
        val unsealed = VerifiedAct(
            proposal = proposal,
            authorPubkey = authorPubkey,
            nonce = pre.nonce,
            preSignature = pre.preSignature,
            preCommitment = formed,
            contentSalt = contentSalt,
            depsSalt = depsSalt,
            contentCommitment = contentCommitment(actId, formed, contentSalt, proposal.payload),
            depsCommitment = depsCommitment(actId, formed, depsSalt, proposal.deps),
            contentEdition = EDITION,
            depsEdition = EDITION,
            hostSeal = ByteArray(0),
        )
        val sealed = VerifiedAct(
            proposal = unsealed.proposal,
            authorPubkey = unsealed.authorPubkey,
            nonce = unsealed.nonce,
            preSignature = unsealed.preSignature,
            preCommitment = unsealed.preCommitment,
            contentSalt = unsealed.contentSalt,
            depsSalt = unsealed.depsSalt,
            contentCommitment = unsealed.contentCommitment,
            depsCommitment = unsealed.depsCommitment,
            contentEdition = unsealed.contentEdition,
            depsEdition = unsealed.depsEdition,
            hostSeal = key.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()),
        )
        return encodeVerifiedAct(sealed)
    }
}

/** A minimal Opinion proposal in its wire form. */
fun testProposalBytes(author: ActorKey, seq: ULong = 1u): ByteArray {
    val body = StructuralBody(
        author = author.address(),
        seq = seq,
        family = Family.OPINION,
        middle = null,
        target = NodeId.parse("prof:bob"),
        pD = 0.5,
        pI = 0.1,
        settlementRef = null,
        license = null,
        assertedParents = emptyList(),
    )
    return encodeProposal(Proposal(body, ByteArray(0), emptyList()))
}

/** The admission Registration the backend stages for [author], in its wire form. */
fun testRegistrationBytes(author: ActorKey): ByteArray {
    val body = StructuralBody(
        author = author.address(),
        seq = 0u,
        family = Family.REGISTRATION,
        middle = null,
        target = NodeId.Prof(author.address()),
        pD = 1.0,
        pI = 1.0,
        settlementRef = null,
        license = null,
        assertedParents = emptyList(),
    )
    return encodeProposal(Proposal(body, byteArrayOf(1), emptyList()))
}

/** Every method throws; tests override what they script. */
open class ThrowingAccountRepository : AccountRepository {
    override suspend fun me(): Outcome<UserProfile?> = throw UnsupportedOperationException()
    override suspend fun borrowedView(): Outcome<ActorRef?> = throw UnsupportedOperationException()
    override suspend fun keyBackup(): Outcome<ByteArray?> = throw UnsupportedOperationException()
    override suspend fun keyBackupChallenge(): Outcome<ByteArray> = throw UnsupportedOperationException()
    override suspend fun uploadKeyBackup(
        blob: ByteArray,
        challenge: ByteArray,
        signature: ByteArray,
    ): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun changePassword(currentPassword: String, newPassword: String): Outcome<Unit> =
        throw UnsupportedOperationException()
    override suspend fun changeHandle(handle: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun dismissVouchBack(): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun requestPasswordReset(email: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun confirmPasswordReset(resetToken: String, newPassword: String): Outcome<Unit> =
        throw UnsupportedOperationException()
}

open class ThrowingSessionRepository : SessionRepository {
    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<LoginGrant> =
        throw UnsupportedOperationException()
    override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> = throw UnsupportedOperationException()
    override suspend fun revokeSession(id: String?): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun revokeOtherSessions(): Outcome<Int> = throw UnsupportedOperationException()
}

open class ThrowingSettingsRepository : SettingsRepository {
    override suspend fun settingsAccount(): Outcome<SettingsAccount?> = throw UnsupportedOperationException()
    override suspend fun defaultLicense(): Outcome<LicenseChoice?> = throw UnsupportedOperationException()
    override suspend fun setDefaultLicense(license: LicenseChoice?): Outcome<LicenseChoice?> =
        throw UnsupportedOperationException()
    override suspend fun requestEmailChange(newEmail: String, currentPassword: String): Outcome<PendingEmailChange> =
        throw UnsupportedOperationException()
    override suspend fun confirmEmailChange(code: String): Outcome<AccountEmail> =
        throw UnsupportedOperationException()
    override suspend fun resendEmailChange(): Outcome<PendingEmailChange> = throw UnsupportedOperationException()
    override suspend fun cancelEmailChange(): Outcome<AccountEmail> = throw UnsupportedOperationException()
    override suspend fun emailChangeLinkCheck(token: String): Outcome<EmailChangeLinkCheck?> =
        throw UnsupportedOperationException()
    override suspend fun setAlwaysUnveil(on: Boolean): Outcome<Int?> = throw UnsupportedOperationException()
}

open class ThrowingOnboardingRepository : OnboardingRepository {
    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> = throw UnsupportedOperationException()
    override suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> = throw UnsupportedOperationException()
    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun attachActorKey(actorPubkeyBase64: String, realizationAddress: String): Outcome<Unit> =
        throw UnsupportedOperationException()
    override suspend fun applicationStatus(): Outcome<ApplicationStatus> = throw UnsupportedOperationException()
}

open class ThrowingWriteRepository : WriteRepository {
    override suspend fun hostPublicKey(): Outcome<ByteArray> = throw UnsupportedOperationException()
    override suspend fun prepareStance(
        targetId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
    override suspend fun prepareTopicStance(
        topicName: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        throw UnsupportedOperationException()
    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        throw UnsupportedOperationException()
    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = throw UnsupportedOperationException()
}

/**
 * A write repository over the real crypto chain: submit seals through
 * the TestHost, approve flips to RELAYING.
 */
class SealingWriteRepository(private val actor: ActorKey) : ThrowingWriteRepository() {
    val host = TestHost()
    val staged = mutableMapOf<String, StagedWriteView>()
    private var nextSeq = 1uL

    /** The proposal each staged id was served with, when it is not the canonical test one. */
    private val proposals = mutableMapOf<String, ByteArray>()

    /**
     * Stages the batch a FAITHFUL prepare would stage for [expected],
     * authored by this device: every value the expectation names, an edit
     * chained behind an own head, a payload where one is ordered, and each
     * walk-back as the server computes it (whole steps, remainder last). A
     * view-model test hands its fake prepare's answer through here so the
     * real signer's intent check passes exactly when the view model ordered
     * what the test says it did.
     */
    fun stageFaithful(expected: Expectation): List<PreparedWriteView> {
        val address = actor.address()
        val minted = arrayOfNulls<NodeId>(expected.writes.size)
        val views = mutableListOf<PreparedWriteView>()
        fun nodeOf(node: NodeExpectation, family: Family, seq: ULong): NodeId = when (node) {
            is NodeExpectation.Node -> NodeId.parse(node.id)
            NodeExpectation.OwnMint -> NodeId.Mint(ActId(address, seq, family))
            is NodeExpectation.MintedBy -> checkNotNull(minted[node.write]) { "mint ${node.write} not staged yet" }
            NodeExpectation.OwnProfile -> NodeId.Prof(address)
        }
        expected.writes.forEachIndexed { i, e ->
            val seq = nextSeq
            val body = StructuralBody(
                author = address,
                seq = seq,
                family = e.family,
                middle = e.middle?.let { nodeOf(it, e.family, seq) },
                target = nodeOf(e.target, e.family, seq),
                pD = e.pDirected,
                pI = e.pInterest,
                settlementRef = null,
                license = e.license,
                assertedParents = when (e.parents) {
                    Parents.NONE -> emptyList()
                    Parents.OWN_CHAIN_HEAD -> listOf(ActId(address, 0u, e.family))
                },
            )
            minted[i] = body.target
            views += stageProposal(e.family, Proposal(body, faithfulPayload(e.payload), emptyList()))
        }
        for (n in expected.netting) {
            // As many records as the cost the server quoted — a quote past
            // the walk-back's own reach pads with zero steps, which net.
            val count = maxOf(walkBackSteps(n), n.cost)
            for ((pD, pI) in walkBack(n.rawPDirected, count).zip(walkBack(n.rawPInterest, count))) {
                val body = StructuralBody(
                    author = address,
                    seq = nextSeq,
                    family = n.family,
                    middle = n.middle?.let { NodeId.parse(it) },
                    target = NodeId.parse(n.target),
                    pD = pD,
                    pI = pI,
                    settlementRef = null,
                    license = null,
                    assertedParents = emptyList(),
                )
                views += stageProposal(n.family, Proposal(body, ByteArray(0), emptyList()))
            }
        }
        return views
    }

    private fun walkBackSteps(n: ExpectedNetting): Int =
        kotlin.math.ceil(maxOf(kotlin.math.abs(n.rawPDirected), kotlin.math.abs(n.rawPInterest))).toInt()

    /** One axis walked back in whole steps, remainder last — `BundleSum::severance_batch`. */
    private fun walkBack(total: Double, steps: Int): List<Double> {
        val sign = if (total > 0.0) -1.0 else 1.0
        var remaining = kotlin.math.abs(total)
        return List(maxOf(steps, 0)) {
            val step = minOf(remaining, 1.0)
            remaining -= step
            sign * step
        }
    }

    private fun stageProposal(family: Family, proposal: Proposal): PreparedWriteView {
        val id = "w$nextSeq"
        val bytes = encodeProposal(proposal)
        proposals[id] = bytes
        nextSeq += 1u
        return PreparedWriteView(id = id, family = family, canonicalProposal = bytes, gcAfterEpochs = 8)
    }

    override suspend fun hostPublicKey(): Outcome<ByteArray> = Outcome.Success(host.key.publicKeyBytes())

    /** A faithful stance prepare: exactly the pick, toward the node [testGraphId] names. */
    override suspend fun prepareStance(
        targetId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> =
        Outcome.Success(stageFaithful(Expectation(listOf(stanceRecord(testGraphId(targetId), pDirected, pInterest)))))

    /** The topic leg: the same pick, toward the topic's Type. */
    override suspend fun prepareTopicStance(
        topicName: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> =
        Outcome.Success(stageFaithful(Expectation(listOf(stanceRecord("name:$topicName", pDirected, pInterest)))))

    /**
     * Stages one signable write — the generic entry content fakes
     * delegate to, so any prepare verb's result runs the real signing
     * chain. The family is display metadata; the proposal bytes are the
     * fixture's canonical test proposal either way.
     */
    fun stage(family: Family = Family.OPINION): PreparedWriteView {
        val id = "w$nextSeq"
        val view = PreparedWriteView(
            id = id,
            family = family,
            canonicalProposal = testProposalBytes(actor, nextSeq),
            gcAfterEpochs = 8,
        )
        nextSeq += 1u
        return view
    }

    /**
     * Makes the next submit come back already collected — the
     * garbage-collected-unlanded path a caller has to treat as "nothing
     * was spent" rather than as a failure.
     */
    var expireOnSubmit = false

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        val seq = stagedWriteId.removePrefix("w").toULong()
        val proposal = proposals[stagedWriteId] ?: testProposalBytes(actor, seq)
        if (expireOnSubmit) {
            // No verified act: the signer sees EXPIRED and stops before
            // any second signature, which is the real sequence.
            val expired = StagedWriteView(
                id = stagedWriteId,
                state = com.cogra.domain.WriteState.EXPIRED,
                family = Family.OPINION,
                canonicalProposal = proposal,
                verifiedAct = null,
                recordId = null,
            )
            staged[stagedWriteId] = expired
            return Outcome.Success(expired)
        }
        val sealed = host.seal(
            proposal,
            java.util.Base64.getDecoder().decode(signatureBase64),
            actor.publicKeyBytes(),
        )
        val view = StagedWriteView(
            id = stagedWriteId,
            state = com.cogra.domain.WriteState.AWAITING_APPROVAL,
            family = Family.OPINION,
            canonicalProposal = proposal,
            verifiedAct = sealed,
            recordId = null,
        )
        staged[stagedWriteId] = view
        return Outcome.Success(view)
    }

    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        val current = staged.getValue(stagedWriteId).copy(state = com.cogra.domain.WriteState.RELAYING)
        staged[stagedWriteId] = current
        return Outcome.Success(current)
    }

    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = Outcome.Success(staged[id])
}

/** Stance-repository base: every call throws until overridden. */
open class ThrowingStanceRepository : StanceRepository {
    override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> =
        throw UnsupportedOperationException()
    override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> =
        throw UnsupportedOperationException()
    override suspend fun projection(
        target: StanceTarget,
        pick: StancePair,
        includePending: Boolean,
    ): Outcome<StanceProjection> = throw UnsupportedOperationException()
    override suspend fun severanceQuote(target: StanceTarget, includePending: Boolean): Outcome<SeveranceQuote> =
        throw UnsupportedOperationException()
    override suspend fun prepareSeverance(target: StanceTarget): Outcome<List<PreparedWriteView>> =
        throw UnsupportedOperationException()

    /**
     * Answers rather than throws: every stance signing asks it, and a test
     * about something else need not know the intent check exists. A topic
     * is its Type; any other node is [testGraphId] of its id.
     */
    override suspend fun targetGraphId(target: StanceTarget): Outcome<String> = Outcome.Success(
        when (target) {
            is StanceTarget.Node -> testGraphId(target.id)
            is StanceTarget.Topic -> "name:${target.name}"
        },
    )
}

/**
 * The L1 identifier the fakes serve for an L2 id — a test pinning an
 * expectation computes the same. A parseable identifier, so a faithful
 * fake prepare ([SealingWriteRepository.stageFaithful]) can put it in a
 * proposal; the class says nothing about the node's.
 */
fun testGraphId(id: String): String = "prof:$id"

/** [testGraphId] of every id — what the fakes' graph-id read answers. */
fun testGraphIds(ids: List<String>): Map<String, String> = ids.associateWith { testGraphId(it) }

/** The node the fakes say a comment answers. */
fun testParentOf(commentId: String): String = "parent-of-$commentId"

/** Content-repository base: every call throws until overridden. */
open class ThrowingContentRepository : ContentRepository {
    /**
     * Answers rather than throws: every authoring gesture reads it before
     * it prepares, and a test about something else need not know the
     * intent check exists. Every id is [testGraphId] of itself.
     */
    override suspend fun graphIds(ids: List<String>): Outcome<Map<String, String>> =
        Outcome.Success(ids.associateWith { testGraphId(it) })

    /** Answers rather than throws, for the reason [graphIds] does: [testParentOf] the comment. */
    override suspend fun commentAnswers(commentId: String): Outcome<String?> =
        Outcome.Success(testParentOf(commentId))

    override suspend fun post(
        id: String,
        commentsFirst: Int,
        commentsAfter: String?,
        includePending: Boolean,
    ): Outcome<PostDetail?> = throw UnsupportedOperationException()
    override suspend fun comments(
        postId: String,
        first: Int,
        after: String?,
        includePending: Boolean,
    ): Outcome<CommentPage?> = throw UnsupportedOperationException()
    override suspend fun preparePost(
        title: String?,
        description: String?,
        content: String?,
        license: LicenseChoice,
        tags: List<TagClaim>,
        references: List<ReferenceClaim>,
        attachments: List<AttachmentClaim>,
        sensitive: Boolean,
        sensitiveReason: String?,
        pDirected: Double,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun postSelfMark(id: String): Outcome<SelfMarkView?> =
        throw UnsupportedOperationException()

    /**
     * Answers rather than throws, for the reason [graphIds] does: every edit
     * reads it as it opens, and a test about something else need not know
     * the backing exists. Null — no backing served — is the unread pad.
     */
    override suspend fun postBacking(id: String): Outcome<PostBacking?> = Outcome.Success(null)
    override suspend fun preparePostEdit(
        id: String,
        title: String?,
        description: String?,
        content: String?,
        attachments: List<AttachmentClaim>,
        sensitive: Boolean,
        sensitiveReason: String?,
        pDirected: Double,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun prepareComment(
        target: String,
        content: String,
        license: LicenseChoice,
        tags: List<TagClaim>,
        references: List<ReferenceClaim>,
        attachments: List<AttachmentClaim>,
        pDirected: Double,
        pInterest: Double,
        sensitive: Boolean,
        sensitiveReason: String?,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun commentForEdit(id: String): Outcome<CommentForEdit?> =
        throw UnsupportedOperationException()
    override suspend fun prepareCommentEdit(
        id: String,
        content: String,
        attachments: List<AttachmentClaim>,
        sensitive: Boolean,
        sensitiveReason: String?,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun commentReplies(
        commentId: String,
        first: Int,
        after: String?,
        includePending: Boolean,
    ): Outcome<Page<CommentView>> = throw UnsupportedOperationException()
}

/** Base fake for the profile surface — override what a test scripts. */
open class ThrowingProfileRepository : ProfileRepository {
    override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> =
        throw UnsupportedOperationException()
    override suspend fun myProfile(): Outcome<ProfileView?> =
        throw UnsupportedOperationException()
    override suspend fun authorRecords(
        authorId: String,
        family: Family?,
        first: Int,
        after: String?,
    ): Outcome<Page<RecordRow>> = throw UnsupportedOperationException()
    override suspend fun prepareProfileUpdate(
        displayName: String,
        bio: String?,
        websiteUrl: String?,
        avatar: MediaFieldUpdate,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
}

/** Media-repository base: the upload throws until a test scripts it. */
open class ThrowingMediaRepository : MediaRepository {
    override suspend fun uploadMedia(
        picture: ProcessedPicture,
    ): Outcome<MediaAssetView> = throw UnsupportedOperationException()

    override suspend fun uploadVideo(
        video: ProcessedVideo,
        destination: MediaDestination,
        onProgress: (UploadProgress) -> Unit,
    ): Outcome<MediaAssetView> = throw UnsupportedOperationException()

    /** Recorded rather than thrown: aborting is fire-and-forget. */
    val abortedUploads = mutableListOf<String>()

    override suspend fun abortUpload(uploadId: String) {
        abortedUploads += uploadId
    }

    override suspend fun mediaAttachment(id: String): Outcome<MediaReadiness?> =
        throw UnsupportedOperationException()
}

/** Media-processor base: the pipeline throws until a test scripts it. */
open class ThrowingMediaProcessor : MediaProcessor {
    override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? =
        throw UnsupportedOperationException()

    override suspend fun aspectRatio(uri: String): Float? = throw UnsupportedOperationException()
}

/** Video-pipeline base: every call throws until a test scripts it. */
open class ThrowingVideoProcessor : VideoProcessor {
    override suspend fun transcode(
        uri: String,
        capBytes: Long,
        onProgress: (Int) -> Unit,
    ): ProcessedVideo? = throw UnsupportedOperationException()

    override suspend fun coverFrames(uri: String, count: Int): List<VideoFrame> =
        throw UnsupportedOperationException()

    override suspend fun firstFrame(uri: String): ProcessedPicture? = throw UnsupportedOperationException()

    override suspend fun info(uri: String): VideoInfo? = throw UnsupportedOperationException()
}

/** Topic-repository base: every call throws until overridden. */
open class ThrowingTopicRepository : TopicRepository {
    override suspend fun hashtag(name: String): Outcome<HashtagView?> = throw UnsupportedOperationException()
    override suspend fun taggedContent(
        name: String,
        limit: Int?,
        includePending: Boolean,
    ): Outcome<List<TaggedContentView>> = throw UnsupportedOperationException()
    override suspend fun prepareTag(
        target: String,
        name: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
}

open class ThrowingReferenceRepository : ReferenceRepository {
    override suspend fun referenceCandidates(
        query: String,
        limit: Int?,
    ): Outcome<List<ReferenceCandidateView>> = throw UnsupportedOperationException()
    override suspend fun prepareReference(
        artifact: String,
        target: String,
        relevance: Double,
        support: Double,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
    override suspend fun prepareReferenceWithdrawal(
        artifact: String,
        target: String,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
}

fun testProfile(
    id: String = "author-1",
    handle: String = "author",
    displayName: String? = "Author",
    bio: String? = null,
    websiteUrl: String? = null,
    /** Which profile version this is — what a landing wait compares. */
    updatedAt: Instant = Instant.EPOCH,
): ProfileView = ProfileView(
    id = id,
    handle = handle,
    displayName = testModeratedField(displayName),
    bio = testModeratedField(bio),
    websiteUrl = testModeratedField(websiteUrl),
    updatedAt = updatedAt,
)

fun testModeratedField(value: String?) = ModeratedField(value, FieldStatus.NORMAL)

fun testPost(
    id: String,
    title: String? = "Title $id",
    body: String = "Body $id",
    author: ActorRef? = ActorRef("author-1", "author"),
    license: LicenseChoice = LicenseChoice.PublicDomain,
    landing: Landing = Landing.landed(1),
): PostView = PostView(
    id = id,
    title = testModeratedField(title),
    description = testModeratedField(null),
    content = testModeratedField(body),
    author = author,
    createdAt = Instant.EPOCH,
    updatedAt = Instant.EPOCH,
    landing = landing,
    license = license,
)

fun testComment(
    id: String,
    body: String = "Comment $id",
    author: ActorRef? = ActorRef("author-2", "commenter"),
    license: LicenseChoice = LicenseChoice.PublicDomain,
    landing: Landing = Landing.landed(1),
): CommentView = CommentView(
    id = id,
    content = testModeratedField(body),
    author = author,
    createdAt = Instant.EPOCH,
    updatedAt = Instant.EPOCH,
    landing = landing,
    license = license,
)

fun testHashtag(name: String, id: String = "hashtag-$name"): HashtagView = HashtagView(
    id = id,
    name = testModeratedField(name),
)

fun testTopicClaim(
    name: String,
    relevance: Double = 0.1,
    confidence: Double = 1.0,
    pending: Boolean = false,
): TopicClaimView = TopicClaimView(
    hashtag = testHashtag(name),
    relevance = relevance,
    confidence = confidence,
    pending = pending,
)

/** A citation toward a person — the target class that makes it a mention. */
fun testMentionTarget(
    handle: String,
    id: String = "user-$handle",
): ReferenceTargetView.Profile = ReferenceTargetView.Profile(
    id = id,
    handle = handle,
    displayName = handle.replaceFirstChar { it.uppercase() },
)

/** A citation toward a post or comment — a quote or an embed. */
fun testContentTarget(
    id: String,
    kind: ReferenceContentKind = ReferenceContentKind.POST,
    title: String? = "Title $id",
    snippet: String? = "Body $id",
    authorHandle: String? = "author",
): ReferenceTargetView.Content = ReferenceTargetView.Content(
    kind = kind,
    id = id,
    title = if (kind == ReferenceContentKind.POST) title else null,
    snippet = snippet,
    authorHandle = authorHandle,
    authorDisplayName = authorHandle?.replaceFirstChar { it.uppercase() },
)

/**
 * A standing citation. [targetId] defaults to an L1-shaped identifier
 * deliberately distinct from the typed target's L2 id: the two are not
 * the same string, and a fixture that conflated them would hide the
 * bug where a write names the wrong one.
 */
fun testReferenceClaim(
    target: ReferenceTargetView?,
    targetId: String = when (target) {
        is ReferenceTargetView.Profile -> "l1-${target.id}"
        is ReferenceTargetView.Content -> "l1-${target.id}"
        null -> "l1-untypeable"
    },
    relevance: Double = 0.1,
    support: Double = 0.1,
    withdrawalCost: Int = 1,
    pending: Boolean = false,
): ReferenceClaimView = ReferenceClaimView(
    target = target,
    targetId = targetId,
    relevance = relevance,
    support = support,
    withdrawalCost = withdrawalCost,
    pending = pending,
)

fun testTaggedContent(
    id: String,
    kind: TaggedContentKind = TaggedContentKind.POST,
    title: String? = "Title $id",
    snippet: String? = "Body $id",
    authorHandle: String? = "author",
    authorDisplayName: String? = "Author",
    relevance: Double = 0.1,
    confidence: Double = 1.0,
    pending: Boolean = false,
): TaggedContentView = TaggedContentView(
    kind = kind,
    id = id,
    title = title,
    snippet = snippet,
    authorHandle = authorHandle,
    authorDisplayName = authorDisplayName,
    relevance = relevance,
    confidence = confidence,
    pending = pending,
)
