// Pins this module's mirrors of backend numbers to
// `client-constants.json` (repo root, `make constants`) — the same
// arrangement core:crypto has with the golden vectors and `app` has
// with the design tokens. A number the backend moved and a client did
// not is a refusal the reader meets after the work, not before it, so
// the value is never transcribed into code that the artifact does not
// also state.

package com.cogra.domain

import com.cogra.domain.media.RESUMABLE_THRESHOLD_BYTES
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.signing.TERMINAL_REFUSALS
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test

private val constants: JsonObject by lazy {
    Json.parseToJsonElement(File("../../../client-constants.json").readText()).jsonObject
}

private fun group(name: String): JsonObject = constants.getValue(name).jsonObject

private fun JsonObject.int(key: String): Int = getValue(key).jsonPrimitive.content.toInt()

private fun JsonObject.long(key: String): Long = getValue(key).jsonPrimitive.content.toLong()

private fun JsonObject.text(key: String): String = getValue(key).jsonPrimitive.content

class ClientConstantsTest {

    @Test
    fun `the media caps this module owns are the contract's`() {
        val media = group("media")
        assertThat(RESUMABLE_THRESHOLD_BYTES).isEqualTo(media.long("resumableThresholdBytes"))
        assertThat(ContentRepository.MAX_COMMENT_ATTACHMENTS)
            .isEqualTo(media.int("commentAttachments"))
    }

    // Both axes, because the tap is one policy and not two: a default
    // that moved on one axis only would tilt every plain tap.
    @Test
    fun `a plain tap commits the contract's low default`() {
        val tapDefault = group("stance").getValue("tapDefault").jsonPrimitive.content.toDouble()
        assertThat(StancePair.TapDefault.pDirected).isEqualTo(tapDefault)
        assertThat(StancePair.TapDefault.pInterest).isEqualTo(tapDefault)
    }

    @Test
    fun `the registration rules the form enforces are the contract's`() {
        val registration = group("registration")
        assertThat(MIN_HANDLE_LENGTH).isEqualTo(registration.int("handleMinChars"))
        assertThat(MAX_HANDLE_LENGTH).isEqualTo(registration.int("handleMaxChars"))
        assertThat(MIN_PASSWORD_LENGTH).isEqualTo(registration.int("passwordMinChars"))
        assertThat(HANDLE_CHARSET.pattern).isEqualTo(registration.text("handleCharsetPattern"))
    }

    // Set equality, not containment: a code the backend added to the
    // terminal list and this build did not would leave spent handshake
    // material behind forever, and a code this build treats as terminal
    // that the backend does not would throw away material a `resume`
    // could still have used. Both directions are bugs.
    @Test
    fun `the terminal refusals are exactly the contract's`() {
        val declared = group("writeSigner").getValue("terminalRefusals").jsonArray
            .map { ErrorCode.valueOf(it.jsonPrimitive.content) }
        assertThat(TERMINAL_REFUSALS).containsExactlyElementsIn(declared)
    }

    @Test
    fun `the seal-await budget is the contract's`() {
        val declared = group("writeSigner")
        val signer = WriteSigner(ThrowingWriteRepository(), FakeIdentityStore())
        assertThat(signer.sealPollAttempts).isEqualTo(declared.int("sealPollAttempts"))
        assertThat(signer.sealPollDelayMs).isEqualTo(declared.long("sealPollIntervalMs"))
    }
}
