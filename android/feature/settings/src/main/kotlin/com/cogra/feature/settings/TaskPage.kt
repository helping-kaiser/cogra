package com.cogra.feature.settings

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.emailValid
import com.cogra.domain.has

// The credential task pages' shared rules. The page anatomy itself is the
// design system's `TaskPage`, which the entry funnel's doors draw too.

/**
 * The malformed-address check New email answers on the press: the WHATWG
 * standard's, which registration and the web's `type="email"` share
 * (ruling 94, [com.cogra.domain.emailValid]). The server's
 * `BAD_INPUT@newEmail` maps to the same line — which is how the board's own
 * malformed example, `sol@ferreira`, reads it: the standard takes a
 * single-label domain, the server's normalization asks for a dotted one.
 */
internal fun looksLikeEmail(value: String): Boolean = emailValid(value)

/** The password ceiling (auth.md "Credentials"); the floor is the domain's [com.cogra.domain.MIN_PASSWORD_LENGTH]. */
internal const val PASSWORD_MAX = 128

internal fun String.scalarLength(): Int = codePointCount(0, length)

/** Whether this outcome is a refusal carrying [code]. */
internal fun Outcome<*>.refusedWith(code: ErrorCode): Boolean = this is Outcome.Refused && has(code)
