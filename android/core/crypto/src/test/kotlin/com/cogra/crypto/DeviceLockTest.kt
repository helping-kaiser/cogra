// The device lock against the Rust reference's golden vectors
// (`client-crypto-vectors.json` `deviceLock`) — read from the file, never
// copied into the test.

package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import java.io.File
import java.util.Base64
import java.util.UUID
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertThrows
import org.junit.Test

private val deviceLock: JsonElement by lazy {
    Json.parseToJsonElement(File("../../../client-crypto-vectors.json").readText())
        .jsonObject.getValue("deviceLock")
}

private fun JsonElement.str(key: String): String = jsonObject.getValue(key).jsonPrimitive.content

private fun bindingOf(json: JsonElement) = DeviceLockBinding(
    account = UUID.fromString(json.str("accountId")),
    kind = json.str("recordKindUtf8"),
    key = json.str("recordKeyUtf8"),
)

class DeviceLockTest {

    private val secret = deviceLock.str("secretHex").hexToBytes()
    private val binding = bindingOf(deviceLock)

    @Test
    fun sealsTheReferenceRecordByteForByteAndOpensItBack() {
        assertThat(Base64.getDecoder().decode(deviceLock.str("secretBase64"))).isEqualTo(secret)
        assertThat(deviceLock.str("hkdfInfoUtf8")).isEqualTo("cogra:device-lock:v1")
        val record = sealDeviceLockRecordWith(
            secret = secret,
            binding = binding,
            plaintext = deviceLock.str("plaintextHex").hexToBytes(),
            salt = deviceLock.str("hkdfSaltHex").hexToBytes(),
            nonce = deviceLock.str("aesNonceHex").hexToBytes(),
        )
        assertThat(record.toHex()).isEqualTo(deviceLock.str("recordHex"))
        assertThat(openDeviceLockRecord(secret, deviceLock.str("recordHex").hexToBytes(), binding).toHex())
            .isEqualTo(deviceLock.str("plaintextHex"))
    }

    @Test
    fun derivesTheReferenceLockKeyAndAssociatedData() {
        assertThat(deviceLockKey(secret, deviceLock.str("hkdfSaltHex").hexToBytes()).toHex())
            .isEqualTo(deviceLock.str("lockKeyHex"))
        val header = deviceLock.str("recordHex").hexToBytes().copyOfRange(0, 29)
        assertThat(deviceLockAssociatedData(header, binding).toHex())
            .isEqualTo(deviceLock.str("associatedDataHex"))
    }

    @Test
    fun `lock_ciphertext_is_bound_to_its_account_and_record`() {
        val record = deviceLock.str("recordHex").hexToBytes()
        for (refused in deviceLock.jsonObject.getValue("refusedBindings").jsonArray) {
            assertThrows(DeviceLockException::class.java) {
                openDeviceLockRecord(secret, record, bindingOf(refused))
            }
        }
    }

    @Test
    fun anotherSecretNeverOpensTheRecord() {
        val other = secret.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
        assertThrows(DeviceLockException::class.java) {
            openDeviceLockRecord(other, deviceLock.str("recordHex").hexToBytes(), binding)
        }
    }

    @Test
    fun aFreshSealRoundTripsAndNeverRepeatsItsHeader() {
        val first = sealDeviceLockRecord(secret, binding, byteArrayOf(1, 2, 3))
        val second = sealDeviceLockRecord(secret, binding, byteArrayOf(1, 2, 3))
        assertThat(openDeviceLockRecord(secret, first, binding)).isEqualTo(byteArrayOf(1, 2, 3))
        assertThat(first.copyOfRange(0, 29)).isNotEqualTo(second.copyOfRange(0, 29))
    }

    @Test
    fun refusesAMalformedRecordAndAForeignVersion() {
        assertThrows(DeviceLockException::class.java) { openDeviceLockRecord(secret, ByteArray(29), binding) }
        val foreign = deviceLock.str("recordHex").hexToBytes().also { it[0] = 0x02 }
        assertThrows(DeviceLockException::class.java) { openDeviceLockRecord(secret, foreign, binding) }
    }
}
