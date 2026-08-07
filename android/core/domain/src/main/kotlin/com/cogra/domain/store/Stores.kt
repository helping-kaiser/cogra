// The device's at-rest secret stores, as interfaces — core:network
// implements them over an encrypted DataStore (Tink AEAD under a
// Keystore master key; android/CLAUDE.md "Auth / tokens"). The recovery
// code is NEVER stored — displayed once at ceremony time, held only by
// the user.

package com.cogra.domain.store

import com.cogra.crypto.PreSignedProposal
import com.cogra.domain.AuthTokens
import kotlinx.coroutines.flow.Flow

/**
 * Session tokens. The refresh token rotates on every use — [save]
 * overwrites the stored pair each refresh.
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
}
