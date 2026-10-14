// CoGra's guild schema under key 49258 (reference:
// crates/common/src/envelope/cogra.rs): the shared admission both families
// run, then each family's own key set.

package com.cogra.crypto

private const val UUID_LEN = 16
private const val KEY_SCHEMA: ULong = 0uL
private const val KEY_NODE: ULong = 1uL
private const val KEY_TITLE: ULong = 2uL
private const val KEY_DESCRIPTION: ULong = 3uL
private const val KEY_BODY: ULong = 4uL
private const val KEY_MEDIA: ULong = 5uL
private const val KEY_DISPLAY_NAME: ULong = 7uL
private const val KEY_BIO: ULong = 8uL
private const val KEY_WEBSITE: ULong = 9uL
private const val KEY_AVATAR: ULong = 11uL
private const val KEY_RETIRED_COVER: ULong = 12uL
private const val KEY_SENSITIVE: ULong = 13uL
private const val KEY_SENSITIVE_REASON: ULong = 14uL

private val CONTENT_KEYS: List<ULong> =
    listOf(
        KEY_SCHEMA,
        KEY_NODE,
        KEY_TITLE,
        KEY_DESCRIPTION,
        KEY_BODY,
        KEY_MEDIA,
        KEY_SENSITIVE,
        KEY_SENSITIVE_REASON,
    )
private val PROFILE_KEYS: List<ULong> =
    listOf(KEY_SCHEMA, KEY_NODE, KEY_DISPLAY_NAME, KEY_BIO, KEY_WEBSITE, KEY_AVATAR)
private val UUID_GROUPS = Regex("(.{8})(.{4})(.{4})(.{4})(.{12})")

/** The admission both families run first: v1 vector, empty body, one guild key, schema 1. */
private fun cograGuildMap(envelope: Envelope): GuildMap {
    ensure(envelope.version.all { it == 1uL }) { guild("unsupported version vector") }
    ensure(envelope.body.isEmpty()) { guild("key-1 body must be empty") }
    ensure(envelope.extensions.size == 1) { guild("exactly one guild key expected") }
    val map =
        envelope.extensions.at(COGRA_GUILD_KEY) as? EnvelopeValue.MapValue
            ?: throw guild("missing cogra guild map")
    ensure(map.entries.at(KEY_SCHEMA) == EnvelopeValue.UintValue(1uL)) {
        guild("unsupported cogra schema version")
    }
    return map.entries
}

private fun nodeId(map: GuildMap): String {
    val v = map.at(KEY_NODE) as? EnvelopeValue.BytesValue ?: throw guild("missing node id")
    ensure(v.hex.length == UUID_LEN * 2) { guild("node id must be 16 bytes") }
    return UUID_GROUPS.replace(v.hex, "$1-$2-$3-$4-$5")
}

private fun textField(
    map: GuildMap,
    key: ULong,
): String? =
    when (val v = map.at(key)) {
        null -> null
        is EnvelopeValue.TextValue -> v.value
        else -> throw guild("text field with non-text value")
    }

/** An absent manifest and an empty one are one state; only the absent form is legal. */
private fun guildMedia(map: GuildMap): List<EnvelopeAsset> {
    val v = map.at(KEY_MEDIA) ?: return emptyList()
    val items = (v as? EnvelopeValue.ArrayValue)?.items ?: throw guild("media manifest must be an array")
    ensure(items.isNotEmpty()) { guild("empty media manifest must be omitted") }
    return items.map { decodeAsset(it) }
}

/** The mark is presence; a reason without it is refused rather than dropped. */
private fun guildSensitive(map: GuildMap): SensitiveMark? {
    val reason = textField(map, KEY_SENSITIVE_REASON)
    val mark = map.at(KEY_SENSITIVE)
    ensure(mark != null || reason == null) { guild("sensitive reason without the mark") }
    ensure(mark == null || mark == EnvelopeValue.UintValue(1uL)) {
        guild("sensitive mark with an unexpected value")
    }
    return mark?.let { SensitiveMark(reason) }
}

/** Absent leaves the avatar alone, `[]` clears it, `[asset]` replaces it. */
private fun guildAvatar(map: GuildMap): AvatarSlot {
    val v = map.at(KEY_AVATAR) ?: return AvatarSlot.Untouched
    val items = (v as? EnvelopeValue.ArrayValue)?.items ?: throw guild("a profile image must be an array")
    ensure(items.size <= 1) { guild("a profile image is a single asset") }
    return items.firstOrNull()?.let { AvatarSlot.Replaced(decodeAsset(it)) } ?: AvatarSlot.Cleared
}

/** A Publish/Review payload: envelope gates, then the content family's admission. */
fun decodeContent(bytes: ByteArray): CograContent {
    val map = cograGuildMap(decodeEnvelope(bytes))
    ensure(map.all { it.first in CONTENT_KEYS }) { guild("unknown cogra field") }
    val node = nodeId(map)
    val title = textField(map, KEY_TITLE)
    val description = textField(map, KEY_DESCRIPTION)
    val body = textField(map, KEY_BODY)
    val media = guildMedia(map)
    val sensitive = guildSensitive(map)
    return CograContent(node, title, description, body, media, sensitive)
}

/** A profile update's payload: envelope gates, then the profile family's admission. */
fun decodeProfile(bytes: ByteArray): CograProfile {
    val map = cograGuildMap(decodeEnvelope(bytes))
    map.forEach { (k, _) ->
        ensure(k != KEY_RETIRED_COVER) { guild("retired cogra profile field") }
        ensure(k in PROFILE_KEYS) { guild("unknown cogra profile field") }
    }
    val node = nodeId(map)
    val displayName = textField(map, KEY_DISPLAY_NAME)
    val bio = textField(map, KEY_BIO)
    val websiteUrl = textField(map, KEY_WEBSITE)
    val avatar = guildAvatar(map)
    return CograProfile(node, displayName, bio, websiteUrl, avatar)
}
