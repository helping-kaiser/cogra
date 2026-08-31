package com.cogra.core.media

import android.content.ContentResolver
import android.content.ContentUris
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import com.cogra.domain.media.DeviceImage
import com.cogra.domain.media.DeviceImageSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * [DeviceImageSource] over `MediaStore` — the newest pictures the app is
 * allowed to see, for `ComposePick`'s in-app grid.
 *
 * The query asks only for the id and the two dimensions, so a grid of a
 * hundred tiles costs one cursor and no decoding: the thumbnails are
 * loaded lazily by the image loader from the content URIs this returns.
 *
 * **What comes back depends on what was granted.** With
 * `READ_MEDIA_VISUAL_USER_SELECTED` alone the store returns only the
 * pictures the reader chose in the system's selection dialog, and that
 * is not an error state — it is the reader's answer, and the grid draws
 * exactly what it is given
 * (developer.android.com/training/data-storage/shared/media#partial-access).
 */
class MediaStoreImageSource(
    private val resolver: ContentResolver,
) : DeviceImageSource {

    override suspend fun newestImages(limit: Int): List<DeviceImage> =
        withContext(Dispatchers.IO) {
            runCatching { query(limit) }.getOrDefault(emptyList())
        }

    private fun query(limit: Int): List<DeviceImage> {
        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
        )
        val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val cursor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // The documented way to bound a MediaStore query from API 26:
            // a `ContentResolver.QUERY_ARG_LIMIT` bundle rather than a
            // `LIMIT` glued onto the sort order, which is provider-specific
            // and not part of the contract.
            resolver.query(collection, projection, queryArgs(limit), null)
        } else {
            resolver.query(
                collection,
                projection,
                null,
                null,
                "${MediaStore.Images.Media.DATE_ADDED} DESC LIMIT $limit",
            )
        }
        return cursor?.use { rows ->
            val idColumn = rows.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val widthColumn = rows.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)
            val heightColumn = rows.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)
            buildList {
                while (rows.moveToNext() && size < limit) {
                    val width = rows.getInt(widthColumn)
                    val height = rows.getInt(heightColumn)
                    // A row the store has no dimensions for still draws
                    // fine; a square is the honest default for a tile that
                    // is cropped to a square anyway.
                    val ratio = if (width > 0 && height > 0) {
                        width.toFloat() / height.toFloat()
                    } else {
                        SQUARE
                    }
                    add(
                        DeviceImage(
                            uri = ContentUris.withAppendedId(collection, rows.getLong(idColumn)).toString(),
                            aspectRatio = ratio,
                        ),
                    )
                }
            }
        }.orEmpty()
    }

    private fun queryArgs(limit: Int): Bundle = Bundle().apply {
        putStringArray(
            ContentResolver.QUERY_ARG_SORT_COLUMNS,
            arrayOf(MediaStore.Images.Media.DATE_ADDED),
        )
        putInt(
            ContentResolver.QUERY_ARG_SORT_DIRECTION,
            ContentResolver.QUERY_SORT_DIRECTION_DESCENDING,
        )
        putInt(ContentResolver.QUERY_ARG_LIMIT, limit)
    }

    private companion object {
        const val SQUARE = 1f
    }
}
