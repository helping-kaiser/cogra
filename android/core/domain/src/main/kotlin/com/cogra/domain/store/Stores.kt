// The device's at-rest secret stores, as interfaces — core:network
// implements them over an encrypted DataStore (Tink AEAD under a
// Keystore master key; android/CLAUDE.md "Auth / tokens"). The recovery
// code is NEVER stored — displayed once at ceremony time, held only by
// the user.

package com.cogra.domain.store

import com.cogra.crypto.PreSignedProposal
import com.cogra.domain.AuthTokens
import com.cogra.domain.stance.StanceInputMode
import kotlinx.coroutines.flow.Flow

/**
 * Session tokens — one slot, one active session at a time. The refresh
 * token rotates on every use — [save] overwrites the stored pair each
 * refresh. The pair carries the account it authenticates
 * ([AuthTokens.accountId]); that is what scopes the [IdentityStore].
 */
interface TokenStore {
    /** The current pair; null when signed out. Drives auth-state navigation. */
    val tokens: Flow<AuthTokens?>

    suspend fun current(): AuthTokens?

    suspend fun save(tokens: AuthTokens)

    /** Sign-out: forget both tokens. */
    suspend fun clear()
}

/**
 * The device-held actor identity and the onboarding state that must
 * survive process death: the actor seed (exportable — it goes into the
 * backup blob), the sealed backup blob awaiting a retried upload, and
 * the per-write handshake material the approve step verifies against
 * (the private nonce and pre-signature exist only on the device —
 * trusting the server's echo would weaken "the device verifies what it
 * signs").
 *
 * Every value is bound to the account it belongs to, never to a
 * device-global slot (auth.md "Multi-account device custody"). The
 * interface stays account-implicit: every consumer acts for the
 * signed-in account, so the implementation resolves the active account
 * from the token store — an explicit account parameter would push
 * session plumbing into every use-case and fake for no caller that
 * needs it. With no active account, reads return null/empty and writes
 * are dropped.
 */
interface IdentityStore {
    suspend fun actorSeed(): ByteArray?

    suspend fun saveActorSeed(seed: ByteArray)

    /** A sealed blob whose upload has not succeeded yet. */
    suspend fun pendingBackupBlob(): ByteArray?

    suspend fun savePendingBackupBlob(blob: ByteArray)

    suspend fun clearPendingBackupBlob()

    /** The pre-signed material of one staged write, keyed by its id. */
    suspend fun handshake(stagedWriteId: String): PreSignedProposal?

    suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal)

    suspend fun clearHandshake(stagedWriteId: String)

    /** Every staged-write id with persisted material — the resume set. */
    suspend fun handshakeIds(): Set<String>

    /**
     * Device-local UX state: whether the first-login reciprocation
     * prompt was dismissed on this device. Dismissal memory only —
     * whether the pair is complete is the graph-derived
     * `User.hasReciprocated` (auth.md "Reciprocation is the joiner's
     * own act"); the offer legitimately reappears on a new device.
     */
    suspend fun reciprocationDismissed(): Boolean

    suspend fun markReciprocationDismissed()

    /**
     * Device-local UX state: whether the tap that teaches the held
     * gesture has been spent. Set when the coach mark opens, so a
     * restart cannot swallow a second priced tap in silence
     * (design.md §8.7). Account-scoped like the rest of this store: the
     * lesson belongs to the person, not to the hardware.
     */
    suspend fun stancePadTaught(): Boolean

    suspend fun markStancePadTaught()

    /**
     * Which surface the stance control offers, everywhere (design.md
     * §8.6). A rendering preference with nothing private in it, kept
     * here because this is the device's preference store; a Flow because
     * changing it in Settings has to reach controls already composed on
     * another destination.
     */
    val stanceInputMode: Flow<StanceInputMode>

    suspend fun setStanceInputMode(mode: StanceInputMode)

    /**
     * Whether a submit that stages more than one signed action asks
     * first (fix round 1, F4). On by default — a batch of priced acts is
     * exactly what a reader should get to see before signing — and
     * turned off from the confirm itself or back on in Settings. A
     * rendering preference like [stanceInputMode], and a Flow for the
     * same reason: Settings has to reach a composer already open.
     */
    val confirmMultiActionSubmits: Flow<Boolean>

    suspend fun setConfirmMultiActionSubmits(value: Boolean)

    /**
     * The "don't remember me" opt-in (auth.md "Sign-out"): whether the
     * active account's material is purged when its session ends.
     */
    suspend fun forgetOnSignOut(): Boolean

    suspend fun setForgetOnSignOut(value: Boolean)

    /**
     * The opt-in's teeth: remove ALL of the active account's material —
     * seed, pending blob, handshake material, and flags. Other
     * accounts' slots are untouched.
     */
    suspend fun purge()
}

/**
 * Visibility of secure-store data loss — the store-side echo of "never
 * erase silently". Marked when the store file was replaced after
 * corruption or a stored value could not be opened or decoded; the app
 * shell surfaces the mark once, and it persists until acknowledged.
 */
interface StorageHealth {
    /** Whether an unacknowledged storage-loss mark exists. */
    val storageLost: Flow<Boolean>

    suspend fun acknowledge()
}
