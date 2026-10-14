// One manifest entry's admission (reference:
// crates/common/src/envelope/media.rs `MediaAsset::decode`), shared by a
// gallery's entries and the avatar slot's one.

package com.cogra.crypto

private const val ASSET_DIGEST: ULong = 0uL
private const val ASSET_MIME: ULong = 1uL
private const val ASSET_ALT: ULong = 2uL
private const val ASSET_COVER: ULong = 3uL
private const val ASSET_COVER_TAKEN: ULong = 4uL
private const val ASSET_UPLOAD_DIGEST: ULong = 5uL

private fun sizedDigest(
    v: EnvelopeValue.BytesValue,
    message: String,
): String {
    ensure(v.hex.length == MEDIA_DIGEST_LEN * 2) { guild(message) }
    return v.hex
}

private fun assetMime(map: GuildMap): String {
    val mime = map.at(ASSET_MIME) as? EnvelopeValue.TextValue ?: throw guild("missing media mime")
    ensure(mime.value.isNotEmpty()) { guild("media mime must not be empty") }
    return mime.value
}

private fun assetAltText(map: GuildMap): String? =
    when (val alt = map.at(ASSET_ALT)) {
        null -> null
        is EnvelopeValue.TextValue -> alt.value.ifEmpty { throw guild("empty media alt text must be omitted") }
        else -> throw guild("media alt text must be text")
    }

private fun assetCover(map: GuildMap): String? =
    when (val cover = map.at(ASSET_COVER)) {
        null -> null
        is EnvelopeValue.BytesValue -> sizedDigest(cover, "media cover must be 32 bytes")
        else -> throw guild("media cover must be a digest")
    }

private fun assetCoverTaken(
    map: GuildMap,
    cover: String?,
): Boolean {
    val taken = map.at(ASSET_COVER_TAKEN) ?: return false
    ensure(cover != null) { guild("media cover-taken requires a cover") }
    ensure(taken is EnvelopeValue.BoolValue) { guild("media cover-taken must be a boolean") }
    ensure(taken == EnvelopeValue.BoolValue(true)) {
        guild("media cover-taken must be omitted rather than false")
    }
    return true
}

private fun assetUploadDigest(map: GuildMap): String? =
    when (val upload = map.at(ASSET_UPLOAD_DIGEST)) {
        null -> null
        is EnvelopeValue.BytesValue -> sizedDigest(upload, "media upload digest must be 32 bytes")
        else -> throw guild("media upload digest must be a digest")
    }

/** One entry's admission: unknown keys refused, every field typed and sized. */
internal fun decodeAsset(value: EnvelopeValue): EnvelopeAsset {
    val map = (value as? EnvelopeValue.MapValue)?.entries ?: throw guild("media entry must be a map")
    ensure(map.none { it.first > ASSET_UPLOAD_DIGEST }) { guild("unknown media entry field") }
    val digest = map.at(ASSET_DIGEST) as? EnvelopeValue.BytesValue ?: throw guild("missing media digest")
    val rendition = sizedDigest(digest, "media digest must be 32 bytes")
    val mime = assetMime(map)
    val altText = assetAltText(map)
    val cover = assetCover(map)
    val coverTaken = assetCoverTaken(map, cover)
    val uploadDigest = assetUploadDigest(map)
    return EnvelopeAsset(rendition, mime, altText, cover, coverTaken, uploadDigest)
}
