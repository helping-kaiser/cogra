// The account deletion's client vocabulary (auth.md "Self-service
// deletion"; erasure.md §5; api-spec.md `requestAccountDeletion` and its
// siblings). Mapped from the generated operations by core:network.

package com.cogra.domain.deletion

import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.Outcome
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A confirmed deletion in its grace (`User.accountDeletion`): the deadline
 * fixed at confirmation, and whether the content sweep is in it. A
 * requested-but-unopened deletion has none — nothing is scheduled until the
 * link is opened.
 */
data class AccountDeletion(
    val scheduledFor: Instant,
    val includesContent: Boolean,
)

/**
 * Where the viewer's own account stands on deletion: which verb answers
 * ([path], server-computed — OS-15, never re-derived from the application)
 * and the confirmed deletion, if one is in its grace.
 */
data class DeletionStanding(
    val path: AccountDeletionPath,
    val deletion: AccountDeletion?,
)

/** The deletion's calls. Every one is the viewer's own but [confirm], whose token is the capability. */
interface AccountDeletionRepository {
    /** Null when the session is gone. */
    suspend fun standing(): Outcome<DeletionStanding?>

    /**
     * Records the request and mails the link (the member path, `BY_LINK`).
     * Answers the standing confirmed deletion — null after an ordinary
     * request, since nothing is confirmed until the link is opened.
     */
    suspend fun request(includeContent: Boolean): Outcome<AccountDeletion?>

    /**
     * Opens the mailed link. [includeContent] true adds the sweep; false
     * leaves the standing choice as it is (the election is opt-in only).
     */
    suspend fun confirm(token: String, includeContent: Boolean): Outcome<AccountDeletion?>

    /** Ends the standing deletion; idempotent, so nothing standing is no error. */
    suspend fun cancel(): Outcome<Unit>

    /** The unfunded applicant's immediate delete (`IMMEDIATE`); every session dies with it. */
    suspend fun deleteApplicantAccount(): Outcome<Unit>
}

/**
 * The account's deletion as this app last read it — what the deletion band
 * stands on, on every logged-in surface (`FeedDeleting.md:3`), and what the
 * settings row and the grace page read.
 *
 * In memory and app-wide, on the `SensitiveContentChoice` pattern: every
 * surface that reads the account's standing records it here, and every act
 * that changes it — a confirm, a cancel — records the answer, so the band
 * leaves the moment a cancel answers, wherever it was pressed
 * (`DeleteAccountCanceled.md:7`). Nothing is persisted: after a cold start
 * the band stands once the account's read answers.
 *
 * It also carries the one fact the shell needs when an applicant's account
 * is deleted at once: the session ends because the account is gone, so the
 * reader lands on the bare view under `Your account is deleted.` rather
 * than on sign-in (`DeleteAccount.md:29`).
 */
@Singleton
class AccountDeletionState @Inject constructor(
    private val repository: AccountDeletionRepository,
) {
    private val _standing = MutableStateFlow<DeletionStanding?>(null)
    private val _accountDeleted = MutableStateFlow(false)

    /** The last answered standing; null while unread, and once signed out. */
    val standing: StateFlow<DeletionStanding?> = _standing.asStateFlow()

    /** The applicant's account was deleted from this device; consumed by the landing. */
    val accountDeleted: StateFlow<Boolean> = _accountDeleted.asStateFlow()

    /** Reads the standing and records it; a failed read keeps what was known. */
    suspend fun refresh(): Outcome<DeletionStanding?> {
        val read = repository.standing()
        if (read is Outcome.Success) _standing.value = read.value
        return read
    }

    /** Records a confirmed deletion an act answered with, keeping the known path. */
    fun recordDeletion(deletion: AccountDeletion?) {
        _standing.value = _standing.value?.copy(deletion = deletion)
    }

    /** Calls the deletion off; on any answer but a fault, the band goes everywhere. */
    suspend fun cancel(): Outcome<Unit> {
        val outcome = repository.cancel()
        if (outcome is Outcome.Success) recordDeletion(null)
        return outcome
    }

    /** Forgets the account's standing — the session ended. */
    fun clear() {
        _standing.value = null
    }

    /** The applicant's account is gone: the landing says so once. */
    fun markAccountDeleted() {
        _standing.value = null
        _accountDeleted.value = true
    }

    fun consumeAccountDeleted() {
        _accountDeleted.value = false
    }
}
