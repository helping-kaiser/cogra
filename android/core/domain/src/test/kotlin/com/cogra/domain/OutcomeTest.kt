package com.cogra.domain

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class OutcomeTest {

    private val refused = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no")))
    private val failed = Outcome.Failed(RuntimeException("down"))

    @Test
    fun mapTransformsOnlySuccess() {
        assertThat(Outcome.Success(2).map { it * 3 }).isEqualTo(Outcome.Success(6))
        assertThat((refused as Outcome<Int>).map { it * 3 }).isEqualTo(refused)
        assertThat((failed as Outcome<Int>).map { it * 3 }).isEqualTo(failed)
    }

    @Test
    fun flatMapChainsOnlySuccess() {
        assertThat(Outcome.Success(2).flatMap { Outcome.Success(it * 3) }).isEqualTo(Outcome.Success(6))
        assertThat(Outcome.Success(2).flatMap { refused }).isEqualTo(refused)
        assertThat((refused as Outcome<Int>).flatMap { Outcome.Success(it) }).isEqualTo(refused)
        assertThat((failed as Outcome<Int>).flatMap { Outcome.Success(it) }).isEqualTo(failed)
    }
}
