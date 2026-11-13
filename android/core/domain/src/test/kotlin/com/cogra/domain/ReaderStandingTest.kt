package com.cogra.domain

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class ReaderStandingTest {

    @Test
    fun `nothing is known before a read answers`() {
        val standing = ReaderStanding()
        assertThat(standing.state.value).isNull()
        assertThat(standing.applicant).isFalse()
    }

    @Test
    fun `an applicant's read makes the reader an applicant`() {
        val standing = ReaderStanding()
        standing.record(AccountState.APPLICANT)
        assertThat(standing.applicant).isTrue()
    }

    @Test
    fun `the landing's read lets the reader in`() {
        val standing = ReaderStanding()
        standing.record(AccountState.APPLICANT)
        standing.record(AccountState.MEMBER)
        assertThat(standing.applicant).isFalse()
    }

    @Test
    fun `a sign-out forgets the standing`() {
        val standing = ReaderStanding()
        standing.record(AccountState.APPLICANT)
        standing.record(null)
        assertThat(standing.state.value).isNull()
        assertThat(standing.applicant).isFalse()
    }
}
