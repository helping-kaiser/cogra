// The fake host whose answers can be lost on the way back: the server takes
// the leg, the device hears nothing. This is the sequence a Retry has to
// survive without signing anything twice (SealSigning.md:31 "WHEN press
// Retry -> the same signing is asked again").

package com.cogra.domain.testing

import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.WriteState
import com.cogra.domain.repo.WriteRepository
import java.io.IOException

/** The account a signing surface's tests press as. */
const val TEST_ACCOUNT_ID = "acct-a"

/**
 * A session signed in as [account] — a signing surface acts only for the
 * account that pressed, so its tests need one.
 */
fun signedInSession(account: String = TEST_ACCOUNT_ID): FakeTokenStore =
    FakeTokenStore().apply { tokens.value = AuthTokens("access-$account", "refresh-$account", account) }

/**
 * [inner] with a switch per leg: while [loseSubmits] or [loseApproves] is
 * above zero, the next such call reaches the host — the host keeps what it
 * took — and its answer comes back as a transport failure. Every call is
 * recorded, so a test can say which ids were asked and how often.
 */
class AnswerLosingWriteRepository(private val inner: SealingWriteRepository) : WriteRepository by inner {
    var loseSubmits = 0
    var loseApproves = 0

    /** Fails every staged-write read while set — the read leg of a Retry with no network. */
    var readsFail = false

    val submitted = mutableListOf<String>()
    val approved = mutableListOf<String>()
    val read = mutableListOf<String>()

    /** What the host holds for [id] now; a test moves it (expiry, landing) here. */
    fun hostSays(id: String, state: WriteState) {
        val held = checkNotNull(inner.staged[id]) { "the host holds no $id" }
        inner.staged[id] = held.copy(state = state)
    }

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        submitted += stagedWriteId
        val answer = inner.submitProposal(stagedWriteId, signatureBase64)
        if (loseSubmits > 0) {
            loseSubmits -= 1
            return Outcome.Failed(IOException("the submit's answer was lost"))
        }
        return answer
    }

    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        approved += stagedWriteId
        val answer = inner.approveAct(stagedWriteId, signatureBase64)
        if (loseApproves > 0) {
            loseApproves -= 1
            return Outcome.Failed(IOException("the approval's answer was lost"))
        }
        return answer
    }

    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> {
        read += id
        if (readsFail) return Outcome.Failed(IOException("no network"))
        return inner.stagedWrite(id)
    }
}
