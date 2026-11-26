// The login's notice holder: the reuse notice is kept in the identity store
// for the sign-in's account and dismissed there; the dead lock's notice is
// held for the account whose lock it was and said only to that account
// (auth.md "Multi-account device custody").

package com.cogra.domain.identity

import com.cogra.domain.AuthTokens
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.time.Instant

class SecurityNoticesTest {

    private val identity = FakeIdentityStore()
    private val tokens = FakeTokenStore()
    private val notices = SecurityNotices(identity, tokens)
    private val detectedAt = Instant.parse("2026-11-25T09:30:00Z")

    private fun activate(account: String) {
        tokens.tokens.value = AuthTokens("a-$account", "r-$account", account)
    }

    @Test
    fun theReuseNoticeIsKeptForTheSignInsAccountUntilGotIt() = runTest {
        notices.post(detectedAt, "u1")
        assertThat(identity.securityNoticeAccount).isEqualTo("u1")
        assertThat(notices.reuseDetectedAt.first()).isEqualTo(detectedAt)

        notices.dismiss()
        assertThat(notices.reuseDetectedAt.first()).isNull()
    }

    @Test
    fun theDeadLocksNoticeIsSaidOnlyToItsOwnAccount() = runTest {
        notices.postLockLost("u1")
        activate("u2")
        assertThat(notices.lockLost.first()).isFalse()

        // `Got it` under another account leaves it held for its own.
        notices.dismissLockLost()
        activate("u1")
        assertThat(notices.lockLost.first()).isTrue()

        notices.dismissLockLost()
        assertThat(notices.lockLost.first()).isFalse()
    }

    @Test
    fun twoAccountsWhoseLocksDiedAreEachToldOnce() = runTest {
        // auth.md "Device lock": each account "is told so once" — a second
        // dead lock never erases the first account's notice.
        notices.postLockLost("u1")
        notices.postLockLost("u2")
        activate("u2")
        assertThat(notices.lockLost.first()).isTrue()
        notices.dismissLockLost()
        assertThat(notices.lockLost.first()).isFalse()

        activate("u1")
        assertThat(notices.lockLost.first()).isTrue()
    }

    @Test
    fun aStoreThatCannotWriteNeitherBlocksTheSignInNorLosesTheNotice() = runTest {
        // The write throws (a DataStore I/O fault): the sign-in's path goes on,
        // and the notice stands for the session's life instead.
        val broken = object : IdentityStore by identity {
            override suspend fun keepSecurityNotice(account: String, detectedAt: Instant) =
                throw IOException("disk full")

            override suspend fun dropSecurityNotice() = throw IOException("disk full")
        }
        val held = SecurityNotices(broken, tokens)

        held.post(detectedAt, "u1")
        activate("u1")
        assertThat(held.reuseDetectedAt.first()).isEqualTo(detectedAt)

        held.dismiss()
        assertThat(held.reuseDetectedAt.first()).isNull()
    }

    @Test
    fun signedOutNoLockNoticeShows() = runTest {
        notices.postLockLost("u1")
        assertThat(notices.lockLost.first()).isFalse()
    }
}
