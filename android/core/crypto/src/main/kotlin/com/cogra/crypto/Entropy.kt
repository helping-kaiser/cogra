// The module's randomness, in one place. Key backup used to reach into
// the actor-key class for it, which put the entropy source on the type
// least related to it.

package com.cogra.crypto

import java.security.SecureRandom

/**
 * Where every secret in this module comes from.
 *
 * One [SecureRandom] rather than a fresh instance per call: the JDK's
 * implementation is thread-safe and self-seeding, and constructing one
 * per key is work with no security value.
 */
internal object Entropy {

    private val random = SecureRandom()

    fun bytes(len: Int): ByteArray = ByteArray(len).also { random.nextBytes(it) }
}
