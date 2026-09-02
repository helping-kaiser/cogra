package com.cogra.core.media

import android.content.ContentResolver
import android.content.ContentUris
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import com.cogra.domain.media.DeviceMedia
import com.cogra.domain.media.DeviceMediaSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * [DeviceMediaSource] over `MediaStore` — the newest pictures and clips
 * the app is allowed to see, for `ComposePick`'s in-app grid.
 *
 * The query asks only for the id, the two dimensions and the date, so a
 * grid of a hundred tiles costs one cursor per collection and no
 * decoding: the thumbnails are loaded lazily by the image loader from
 * the content URIs this returns.
 *
 * **Pictures and video are two queries, not one.** `MediaStore` types
 * each collection separately and the columns differ — only video
 * carries `DURATION` — so each is asked with its own projection and the
 * two are merged newest-first. A single `MediaStore.Files` query would
 * cost a `MEDIA_TYPE` filter and a projection narrowed to the columns
 * both share, which is exactly the column this grid needs to tell them
 * apart (developer.android.com/training/data-storage/shared/media).
 *
 * **What comes back depends on what was granted.** With
 * `READ_MEDIA_VISUAL_USER_SELECTED` alone the store returns only the
 * items the reader chose in the system's selection dialog, and that
 * is not an error state — it is the reader's answer, and the grid draws
 * exactly what it is given
 * (developer.android.com/training/data-storage/shared/media#partial-access).
 */
class MediaStoreMediaSource(
    private val resolver: ContentResolver,
) : DeviceMediaSource {

    override suspend fun newestMedia(limit: Int): List<DeviceMedia> =
        withContext(Dispatchers.IO) {
            // Each collection is asked for the whole limit and the merge
            // takes the newest of the union: asking each for half would
            // hide a reader's newest pictures behind old clips they
            // happen to keep, and the cursors are cheap.
            val pictures = runCatching { queryPictures(limit) }.getOrDefault(emptyList())
            val videos = runCatching { queryVideos(limit) }.getOrDefault(emptyList())
            (pictures + videos)
                .sortedByDescending { it.addedAt }
                .take(limit)
                .map { it.media }
        }

    /** One row, still carrying the sort key the merge needs. */
    private data class Row(val media: DeviceMedia, val addedAt: Long)

    private fun queryPictures(limit: Int): List<Row> = query(
        collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL),
        projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
            MediaStore.Images.Media.DATE_ADDED,
        ),
        limit = limit,
        isVideo = false,
    )

    private fun queryVideos(limit: Int): List<Row> = query(
        collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL),
        projection = arrayOf(
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.WIDTH,
            MediaStore.Video.Media.HEIGHT,
            MediaStore.Video.Media.DATE_ADDED,
            MediaStore.Video.Media.DURATION,
        ),
        limit = limit,
        isVideo = true,
    )

    /**
     * The shared cursor walk. `WIDTH`/`HEIGHT`/`DATE_ADDED`/`_ID` are
     * spelled the same on both collections — they are `MediaColumns` —
     * so only the duration column differs.
     *
     * [isVideo] rather than the duration column's presence is what marks
     * a row: the collection queried is what makes a row a video, and a
     * store that never filled its `DURATION` in must not turn one back
     * into a picture the pick rule would then allow ten of.
     */
    private fun query(
        collection: Uri,
        projection: Array<String>,
        limit: Int,
        isVideo: Boolean,
    ): List<Row> {
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
                "${MediaStore.MediaColumns.DATE_ADDED} DESC LIMIT $limit",
            )
        }
        return cursor?.use { rows ->
            val idColumn = rows.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val widthColumn = rows.getColumnIndexOrThrow(MediaStore.MediaColumns.WIDTH)
            val heightColumn = rows.getColumnIndexOrThrow(MediaStore.MediaColumns.HEIGHT)
            val addedColumn = rows.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
            val durationIndex =
                if (isVideo) rows.getColumnIndex(MediaStore.Video.Media.DURATION) else -1
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
                    // A video row whose duration the store never filled in
                    // is still a video — the collection said so. Zero
                    // stands in, and the badge reads 0:00 rather than the
                    // tile pretending to be a picture.
                    val duration = when {
                        !isVideo -> null
                        durationIndex >= 0 -> rows.getInt(durationIndex)
                        else -> 0
                    }
                    add(
                        Row(
                            media = DeviceMedia(
                                uri = ContentUris
                                    .withAppendedId(collection, rows.getLong(idColumn))
                                    .toString(),
                                aspectRatio = ratio,
                                durationMs = duration,
                            ),
                            addedAt = rows.getLong(addedColumn),
                        ),
                    )
                }
            }
        }.orEmpty()
    }

    private fun queryArgs(limit: Int): Bundle = Bundle().apply {
        putStringArray(
            ContentResolver.QUERY_ARG_SORT_COLUMNS,
            arrayOf(MediaStore.MediaColumns.DATE_ADDED),
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
