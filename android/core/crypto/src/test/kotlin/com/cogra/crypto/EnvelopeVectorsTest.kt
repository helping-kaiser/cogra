// Pins the envelope reader to `envelope-vectors.json` (repo root), exported
// from the Rust reference (`crates/common/tests/envelope_vectors.rs`): the
// same bytes, decoded to the same fields, refused for the same reasons the
// web client's envelope.test.ts reads. Never transcribe a vector value.

package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Test
import java.io.File

private val vectors: JsonElement by lazy {
    Json.parseToJsonElement(File("../../../envelope-vectors.json").readText())
}

private fun group(name: String): List<JsonElement> = vectors.jsonObject.getValue(name).jsonArray

private fun JsonElement.str(key: String): String = jsonObject.getValue(key).jsonPrimitive.content

private fun text(s: String?): JsonElement = if (s == null) JsonNull else JsonPrimitive(s)

// The reference's own rendering (envelope_vectors.rs), so a decode is
// compared field for field rather than through this reader's types.

private fun valueJson(v: EnvelopeValue): JsonElement =
    when (v) {
        is EnvelopeValue.UintValue -> buildJsonObject { put("uint", v.value.toLong()) }
        is EnvelopeValue.TextValue -> buildJsonObject { put("text", v.value) }
        is EnvelopeValue.BytesValue -> buildJsonObject { put("bytes", v.hex) }
        is EnvelopeValue.BoolValue -> buildJsonObject { put("bool", v.value) }
        is EnvelopeValue.ArrayValue -> buildJsonObject { put("array", JsonArray(v.items.map { valueJson(it) })) }
        is EnvelopeValue.MapValue -> buildJsonObject { put("map", entriesJson(v.entries)) }
    }

private fun entriesJson(entries: List<Pair<ULong, EnvelopeValue>>): JsonElement =
    JsonArray(entries.map { (k, v) -> JsonArray(listOf(JsonPrimitive(k.toLong()), valueJson(v))) })

private fun assetJson(a: EnvelopeAsset): JsonElement =
    buildJsonObject {
        put("digest", a.digest)
        put("mime", a.mime)
        put("altText", text(a.altText))
        put("cover", text(a.cover))
        put("coverTaken", a.coverTaken)
        put("uploadDigest", text(a.uploadDigest))
    }

private fun contentJson(c: CograContent): JsonElement =
    buildJsonObject {
        put("node", c.node)
        put("title", text(c.title))
        put("description", text(c.description))
        put("body", text(c.body))
        put("media", JsonArray(c.media.map { assetJson(it) }))
        put("sensitive", c.sensitive?.let { buildJsonObject { put("reason", text(it.reason)) } } ?: JsonNull)
    }

private fun avatarJson(slot: AvatarSlot): JsonElement =
    when (slot) {
        AvatarSlot.Untouched -> buildJsonObject { put("state", "untouched") }
        AvatarSlot.Cleared -> buildJsonObject { put("state", "cleared") }
        is AvatarSlot.Replaced ->
            buildJsonObject {
                put("state", "set")
                put("asset", assetJson(slot.asset))
            }
    }

private fun profileJson(p: CograProfile): JsonElement =
    buildJsonObject {
        put("node", p.node)
        put("displayName", text(p.displayName))
        put("bio", text(p.bio))
        put("websiteUrl", text(p.websiteUrl))
        put("avatar", avatarJson(p.avatar))
    }

private fun envelopeJson(e: Envelope): JsonElement =
    buildJsonObject {
        put("version", JsonArray(e.version.map { JsonPrimitive(it.toLong()) }))
        put("body", e.body)
        put("extensions", entriesJson(e.extensions))
    }

private fun refusalOf(decode: () -> Unit): String? =
    try {
        decode()
        null
    } catch (e: EnvelopeException) {
        e.refusal
    }

private fun refusalAt(
    layer: String,
    bytes: ByteArray,
): String? =
    when (layer) {
        "envelope" -> refusalOf { decodeEnvelope(bytes) }
        "content" -> refusalOf { decodeContent(bytes) }
        else -> refusalOf { decodeProfile(bytes) }
    }

class EnvelopeVectorsTest {
    @Test
    fun `the file is the version this reader reads`() {
        assertThat(vectors.jsonObject.getValue("version").jsonPrimitive.int).isEqualTo(1)
    }

    @Test
    fun `the device decodes every envelope vector exactly as the server does`() {
        group("values").forEach { v ->
            assertWithMessage(v.str("name"))
                .that(envelopeJson(decodeEnvelope(v.str("hex").hexToBytes())))
                .isEqualTo(v.jsonObject.getValue("envelope"))
        }
        group("content").forEach { v ->
            assertWithMessage(v.str("name"))
                .that(contentJson(decodeContent(v.str("hex").hexToBytes())))
                .isEqualTo(v.jsonObject.getValue("content"))
        }
        group("profile").forEach { v ->
            assertWithMessage(v.str("name"))
                .that(profileJson(decodeProfile(v.str("hex").hexToBytes())))
                .isEqualTo(v.jsonObject.getValue("profile"))
        }
    }

    @Test
    fun `a re-encoded decode reproduces the envelope bytes`() {
        (group("values") + group("content") + group("profile")).forEach { v ->
            val hex = v.str("hex")
            assertWithMessage(v.str("name"))
                .that(encodeEnvelope(decodeEnvelope(hex.hexToBytes())).toHex())
                .isEqualTo(hex)
        }
    }

    @Test
    fun `the device refuses every negative envelope vector`() {
        group("refusals").forEach { v ->
            assertWithMessage(v.str("name"))
                .that(refusalAt(v.str("layer"), v.str("hex").hexToBytes()))
                .isEqualTo(v.str("refusal"))
        }
    }

    @Test
    fun `an envelope with an unknown guild field is refused on device`() {
        val provenance = group("refusals").single { it.str("name") == "the unbuilt provenance key" }
        assertThat(refusalOf { decodeContent(provenance.str("hex").hexToBytes()) })
            .isEqualTo("cogra guild schema: unknown cogra field")
    }

    @Test
    fun `a manifest entry with an unknown key is refused on device`() {
        val unknown = group("refusals").single { it.str("name") == "a manifest entry with an unknown key" }
        assertThat(refusalOf { decodeContent(unknown.str("hex").hexToBytes()) })
            .isEqualTo("cogra guild schema: unknown media entry field")
    }

    @Test
    fun `landed history without an upload digest still reads`() {
        val landed = group("content").filterNot { it.jsonObject.getValue("admittedAtPrepare").jsonPrimitive.boolean }
        assertThat(landed).isNotEmpty()
        landed.forEach { v ->
            val media = decodeContent(v.str("hex").hexToBytes()).media
            assertWithMessage(v.str("name")).that(media.any { it.uploadDigest == null }).isTrue()
        }
    }

    @Test
    fun `every manifest entry carries both the rendition and the upload digest`() {
        group("content")
            .filter { it.jsonObject.getValue("admittedAtPrepare").jsonPrimitive.boolean }
            .forEach { v ->
                decodeContent(v.str("hex").hexToBytes()).media.forEach { asset ->
                    assertWithMessage(v.str("name")).that(asset.uploadDigest).isNotNull()
                }
            }
    }
}
