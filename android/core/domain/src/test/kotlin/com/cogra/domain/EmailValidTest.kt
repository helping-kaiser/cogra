package com.cogra.domain

import com.google.common.truth.Truth.assertWithMessage
import org.junit.Test

/**
 * The WHATWG email check (ruling 94). The vectors are the web's own
 * (`registration-rules.test.ts`), which run through the browser-native
 * `<input type="email">` check: the same list answering the same way on
 * both sides is the parity the ruling asks for.
 */
class EmailValidTest {

    @Test
    fun theStandardsValidAddressesPass() {
        VALID.forEach { assertWithMessage("valid: [$it]").that(emailValid(it)).isTrue() }
    }

    @Test
    fun theStandardsInvalidAddressesFail() {
        INVALID.forEach { assertWithMessage("invalid: [$it]").that(emailValid(it)).isFalse() }
    }

    @Test
    fun registrationAsksForAValidAddress() {
        val password = "a".repeat(MIN_PASSWORD_LENGTH)
        assertWithMessage("valid").that(registrationFormValid("sol", "sol@ferreira.studio", password)).isTrue()
        assertWithMessage("an @ alone").that(registrationFormValid("sol", "sol@", password)).isFalse()
    }

    @Test
    fun sanitizingStripsNewlinesThenTrims() {
        assertWithMessage("sanitized").that(sanitizedEmail(" sol@ferr\neira.studio\r\n")).isEqualTo("sol@ferreira.studio")
    }

    companion object {
        val VALID = listOf(
            "sol@ferreira.studio",
            // No dot is needed: a single-label domain is valid by the standard.
            "sol@ferreira",
            "a.b+tag@sub-domain.example.org",
            "o'neil@example.com",
            "x!#$%&'*+/=?^_`{|}~-@x.io",
            " sol@ferreira.studio ",
            "sol@ferreira.studio\n",
            "sol@ferr\neira.studio",
            "sol@" + "a".repeat(63) + ".studio",
        )

        val INVALID = listOf(
            "",
            "   ",
            "sol.ferreira",
            "sol@",
            "@ferreira.studio",
            "sol@ferreira.",
            "sol@-ferreira.studio",
            "sol@ferreira-.studio",
            "sol @ferreira.studio",
            "sol@ferr eira.studio",
            "sol@@ferreira.studio",
            "sol@ferreira..studio",
            "sol@ferreira_studio.com",
            "jöse@example.com",
            "sol@" + "a".repeat(64) + ".studio",
        )
    }
}
