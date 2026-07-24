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
 * backup blob), the applicant token, the sealed backup blob awaiting its
 * first-session upload, and the per-write handshake material the
 * approve step verifies against (the private nonce and pre-signature
 * exist only on the device — trusting the server's echo would weaken
 * "the device verifies what it signs").
 */
interface IdentityStore {
    suspend fun actorSeed(): ByteArray?

    suspend fun saveActorSeed(seed: ByteArray)

    suspend fun applicantToken(): String?

    suspend fun saveApplicantToken(token: String)

    suspend fun clearApplicantToken()

    /** The sealed blob waiting for the first session after landing. */
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
     * prompt was answered (signed or dismissed). Slice 1 has no read
     * surface over the viewer's own Opinions, so the device remembers.
     */
    suspend fun reciprocationHandled(): Boolean

    suspend fun markReciprocationHandled()
}
