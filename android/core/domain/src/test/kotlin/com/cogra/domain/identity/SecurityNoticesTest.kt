// The login's notice holder: the reuse notice is kept in the identity store
// for the sign-in's account and dismissed there; the dead lock's notice is
// held for the account whose lock it was and said only to that account
// (auth.md "Multi-account device custody").

package com.cogra.domain.identity

import com.cogra.domain.AuthTokens
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Test
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
    fun signedOutNoLockNoticeShows() = runTest {
        notices.postLockLost("u1")
        assertThat(notices.lockLost.first()).isFalse()
    }
}
