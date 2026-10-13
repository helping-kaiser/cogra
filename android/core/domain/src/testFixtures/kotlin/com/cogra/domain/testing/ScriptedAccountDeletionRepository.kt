package com.cogra.domain.testing

import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionRepository
import com.cogra.domain.deletion.DeletionStanding
import kotlinx.coroutines.CompletableDeferred

/**
 * The deletion's calls, scripted: each answer is a field a test sets, and
 * every call is recorded. [gate], when set, holds a call open until the test
 * completes it — the in-flight states (`Sending the confirmation link…`)
 * are drawn only while a call has not answered.
 */
class ScriptedAccountDeletionRepository : AccountDeletionRepository {
    var standing: Outcome<DeletionStanding?> =
        Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, null))
    var request: Outcome<AccountDeletion?> = Outcome.Success(null)
    var confirm: Outcome<AccountDeletion?> = Outcome.Success(null)
    var cancel: Outcome<Unit> = Outcome.Success(Unit)
    var deleteApplicant: Outcome<Unit> = Outcome.Success(Unit)
    var gate: CompletableDeferred<Unit>? = null

    val requests = mutableListOf<Boolean>()
    val confirms = mutableListOf<Pair<String, Boolean>>()
    var standingReads = 0
    var cancels = 0
    var applicantDeletes = 0

    override suspend fun standing(): Outcome<DeletionStanding?> {
        standingReads += 1
        return standing
    }

    override suspend fun request(includeContent: Boolean): Outcome<AccountDeletion?> {
        requests += includeContent
        gate?.await()
        return request
    }

    override suspend fun confirm(token: String, includeContent: Boolean): Outcome<AccountDeletion?> {
        confirms += token to includeContent
        gate?.await()
        return confirm
    }

    override suspend fun cancel(): Outcome<Unit> {
        cancels += 1
        gate?.await()
        return cancel
    }

    override suspend fun deleteApplicantAccount(): Outcome<Unit> {
        applicantDeletes += 1
        gate?.await()
        return deleteApplicant
    }
}
