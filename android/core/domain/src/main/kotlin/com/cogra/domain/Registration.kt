// The registration rules the joining form enforces (auth.md "Handle and
// email format"), mirrored from the server.
//
// They are mirrored rather than left to the API alone so the form can
// say no before a round trip — a refusal that arrives after the request
// is a refusal the reader waited for. Every number and pattern here is
// pinned to `client-constants.json` by ClientConstantsTest, which is
// what keeps a mirror from becoming a second opinion.
//
// [MIN_HANDLE_LENGTH] lives in Models.kt with the other identity types
// and is pinned alongside these.

package com.cogra.domain

/** Client mirror of the server's maximum handle length. */
const val MAX_HANDLE_LENGTH = 30

/**
 * The one handle charset: lowercase letters, digits, underscore.
 *
 * The field folds case as it is typed, so anything still outside this
 * set is a character the account cannot hold rather than one left to
 * normalise.
 */
val HANDLE_CHARSET = Regex("^[a-z0-9_]+$")

/** Client mirror of the server's password length floor. */
const val MIN_PASSWORD_LENGTH = 12

/** Whether the registration form may be submitted. */
fun registrationFormValid(handle: String, email: String, password: String): Boolean =
    handleValid(handle) && emailValid(email) && password.length >= MIN_PASSWORD_LENGTH

/**
 * Whether [email] is a valid email address by the WHATWG HTML standard —
 * the same check a browser's `<input type="email">` makes, ported so both
 * clients refuse exactly the same addresses (ruling 94). The value is
 * first sanitized the way that input sanitizes it (newlines stripped,
 * then leading and trailing ASCII whitespace), then matched against the
 * standard's own regular expression (html.spec.whatwg.org, "Valid email
 * address"). The server keeps its own lenient floor (one `@`, a dotted
 * domain) and answers BAD_INPUT past it; the
 * verification mail stays the real proof that the address exists.
 */
fun emailValid(email: String): Boolean = WHATWG_EMAIL.matches(sanitizedEmail(email))

/** The value an email input holds after the standard's sanitization. */
fun sanitizedEmail(email: String): String =
    email.filterNot { it == '\n' || it == '\r' }.trim { it in ASCII_WHITESPACE }

/** The standard's ASCII whitespace: tab, line feed, form feed, carriage return, space. */
private const val ASCII_WHITESPACE = "\t\n\u000C\r "

/** The WHATWG "valid email address" regular expression, verbatim. */
private val WHATWG_EMAIL = Regex(
    "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?" +
        "(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
)

/**
 * Length within the contract's bounds, and nothing outside its charset.
 *
 * Public because the handle-change form in settings answers to the same
 * rule the join form does — a second gate spelling out only half of it
 * disables its button for a length the server takes and enables it for a
 * charset the server refuses.
 */
fun handleValid(handle: String): Boolean =
    handle.length in MIN_HANDLE_LENGTH..MAX_HANDLE_LENGTH && HANDLE_CHARSET.matches(handle)
