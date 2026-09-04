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

/**
 * Whether the registration form may be submitted.
 *
 * The email test is deliberately the weak one: an address is valid if
 * the mail server accepts it, and a client-side pattern that is
 * stricter than that refuses addresses that work. The verification mail
 * is the real check, so this only catches the empty field and the
 * missing `@`.
 */
fun registrationFormValid(handle: String, email: String, password: String): Boolean =
    handleValid(handle) && email.contains('@') && password.length >= MIN_PASSWORD_LENGTH

/** Length within the contract's bounds, and nothing outside its charset. */
private fun handleValid(handle: String): Boolean =
    handle.length in MIN_HANDLE_LENGTH..MAX_HANDLE_LENGTH && HANDLE_CHARSET.matches(handle)
