// The PCE layer of the envelope reader (Envelope.kt holds the types; the
// reference is crates/common/src/envelope/pce.rs): the gates in the
// reference's order, and the re-serialization that checks canonicality.

package com.cogra.crypto

private const val MISSING_MAGIC = "not a content envelope (missing magic tag)"
private const val MAGIC_0 = 0xD9
private const val MAGIC_2 = 0xF7
private const val MAGIC_LEN = 3
private const val VERSION_AXES = 4
private const val MIN_TOP_KEYS: ULong = 2uL
private const val MAX_TOP_KEYS: ULong = 3uL
private const val TOP_EXTENSIONS: ULong = 2uL
private const val RESERVED_FLOOR: ULong = 4uL
private const val GUILD_FLOOR: ULong = 100uL

private const val MAJOR_UINT = 0
private const val MAJOR_BYTES = 2
private const val MAJOR_TEXT = 3
private const val MAJOR_ARRAY = 4
private const val MAJOR_MAP = 5
private const val MAJOR_SIMPLE = 7

/** One map's entries, keys strictly ascending or the bytes are not canonical. */
private fun decodeMapEntries(
    d: CborDecoder,
    len: ULong,
    admit: (ULong, EnvelopeValue) -> Unit,
): List<Pair<ULong, EnvelopeValue>> {
    // Never pre-sized from the declared count: the count is the sender's,
    // the bytes behind it are not, so growth stays bounded by what is there.
    val entries = mutableListOf<Pair<ULong, EnvelopeValue>>()
    var i = 0uL
    while (i < len) {
        val k = d.uint()
        val last = entries.lastOrNull()?.first
        ensure(last == null || k > last) { EnvelopeException(NON_CANONICAL) }
        val v = decodeValue(d)
        admit(k, v)
        entries.add(k to v)
        i++
    }
    return entries
}

private fun decodeArrayItems(d: CborDecoder): List<EnvelopeValue> {
    val len = d.array()
    val items = mutableListOf<EnvelopeValue>()
    var i = 0uL
    while (i < len) {
        items.add(decodeValue(d))
        i++
    }
    return items
}

private fun decodeValue(d: CborDecoder): EnvelopeValue =
    when (d.peekMajor()) {
        MAJOR_UINT -> EnvelopeValue.UintValue(d.uint())
        MAJOR_BYTES -> EnvelopeValue.BytesValue(d.bytes().toHex())
        MAJOR_TEXT -> EnvelopeValue.TextValue(d.text())
        MAJOR_SIMPLE -> EnvelopeValue.BoolValue(d.bool())
        MAJOR_ARRAY -> EnvelopeValue.ArrayValue(decodeArrayItems(d))
        MAJOR_MAP -> EnvelopeValue.MapValue(decodeMapEntries(d, d.map()) { _, _ -> })
        else -> throw shape("unsupported extension value type")
    }

private fun encodeValue(
    e: CborEncoder,
    v: EnvelopeValue,
) {
    when (v) {
        is EnvelopeValue.UintValue -> e.uint(v.value)
        is EnvelopeValue.TextValue -> e.text(v.value)
        is EnvelopeValue.BytesValue -> e.bytes(v.hex.hexToBytes())
        is EnvelopeValue.BoolValue -> e.bool(v.value)
        is EnvelopeValue.ArrayValue -> {
            e.array(v.items.size.toULong())
            v.items.forEach { encodeValue(e, it) }
        }
        is EnvelopeValue.MapValue -> {
            e.map(v.entries.size.toULong())
            v.entries.forEach { (k, item) ->
                e.uint(k)
                encodeValue(e, item)
            }
        }
    }
}

/** The canonical serialization of a decoded envelope (PCE §5). */
fun encodeEnvelope(envelope: Envelope): ByteArray {
    val e = CborEncoder()
    e.tag(MAGIC_TAG)
    e.map(if (envelope.extensions.isEmpty()) MIN_TOP_KEYS else MAX_TOP_KEYS)
    e.uint(0uL).array(VERSION_AXES.toULong())
    envelope.version.forEach { e.uint(it) }
    e.uint(1uL).text(envelope.body)
    if (envelope.extensions.isNotEmpty()) {
        e.uint(TOP_EXTENSIONS).map(envelope.extensions.size.toULong())
        envelope.extensions.forEach { (k, v) ->
            e.uint(k)
            encodeValue(e, v)
        }
    }
    return e.finish()
}

/** The §4.2 reserved range and the §4.4 registered-key empties, per extension key. */
private fun admitExtension(
    k: ULong,
    v: EnvelopeValue,
) {
    ensure(k < RESERVED_FLOOR || k >= GUILD_FLOOR) {
        EnvelopeException("reserved extension key $k is not allocated")
    }
    val empty =
        (v is EnvelopeValue.TextValue && v.value.isEmpty()) ||
            (v is EnvelopeValue.BytesValue && v.hex.isEmpty())
    ensure(k >= RESERVED_FLOOR || !empty) {
        EnvelopeException("empty value for optional key $k must be omitted")
    }
}

private fun decodeExtensions(d: CborDecoder): List<Pair<ULong, EnvelopeValue>> {
    val key = d.uint()
    ensure(key == TOP_EXTENSIONS) {
        EnvelopeException("top-level key $key is not allowed at package version 1")
    }
    val len = d.map()
    ensure(len != 0uL) { EnvelopeException("empty value for optional key 2 must be omitted") }
    return decodeMapEntries(d, len, ::admitExtension)
}

private fun decodePce(bytes: ByteArray): Envelope {
    val magic =
        bytes.size >= MAGIC_LEN &&
            bytes[0] == MAGIC_0.toByte() &&
            bytes[1] == MAGIC_0.toByte() &&
            bytes[2] == MAGIC_2.toByte()
    ensure(magic) { EnvelopeException(MISSING_MAGIC) }
    val d = CborDecoder(bytes)
    ensure(d.tag() == MAGIC_TAG) { EnvelopeException(MISSING_MAGIC) }
    val pairs = d.map()
    ensure(pairs in MIN_TOP_KEYS..MAX_TOP_KEYS) { shape("top-level map must have 2–3 keys") }
    ensure(d.uint() == 0uL) { shape("first key must be 0 (version)") }
    ensure(d.array() == VERSION_AXES.toULong()) { shape("version vector must have 4 axes") }
    val version = List(VERSION_AXES) { d.uint() }
    ensure(version[0] == 1uL) { EnvelopeException("unknown package version ${version[0]}") }
    ensure(d.uint() == 1uL) { shape("second key must be 1 (body)") }
    val body = d.text()
    val extensions = if (pairs == MAX_TOP_KEYS) decodeExtensions(d) else emptyList()
    d.finish()
    val envelope = Envelope(version, body, extensions)
    ensure(encodeEnvelope(envelope).contentEquals(bytes)) { EnvelopeException(NON_CANONICAL) }
    return envelope
}

/**
 * Decodes and admission-checks one envelope — the PCE gates the reference
 * runs (crates/common/src/envelope/pce.rs `Envelope::decode`).
 */
fun decodeEnvelope(bytes: ByteArray): Envelope =
    try {
        decodePce(bytes)
    } catch (e: CborDecodeException) {
        throw EnvelopeException("decode", e)
    }
