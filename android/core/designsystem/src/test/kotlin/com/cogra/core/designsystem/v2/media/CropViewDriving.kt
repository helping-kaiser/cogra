package com.cogra.core.designsystem.v2.media

import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import com.canhub.cropper.CropImageView

/**
 * Delivers the library's own decode completion — the entry point its
 * background worker calls once the bitmap has landed.
 *
 * Reached reflectively because both the callback and its result type
 * are `internal` to the cropper. The alternative is a real decode on
 * a background dispatcher against a `ContentResolver`, which would
 * make every crop test a race; this drives the identical code path,
 * `setBitmap` and then the uri-complete listener, with no timing in
 * it at all.
 */
internal fun CropImageView.completeDecode(url: String, wide: Int, high: Int) {
    val resultType = Class.forName("com.canhub.cropper.BitmapLoadingWorkerJob\$Result")
    val result = resultType.getConstructor(
        Uri::class.java,
        Bitmap::class.java,
        Int::class.javaPrimitiveType,
        Int::class.javaPrimitiveType,
        Boolean::class.javaPrimitiveType,
        Boolean::class.javaPrimitiveType,
        Exception::class.java,
    ).newInstance(
        Uri.parse(url),
        Bitmap.createBitmap(wide, high, Bitmap.Config.ARGB_8888),
        1,
        0,
        false,
        false,
        null,
    )
    CropImageView::class.java
        .getMethod("onSetImageUriAsyncComplete\$cropper_release", resultType)
        .invoke(this, result)
}

/** The crop view somewhere under [this], if one is showing. */
internal fun View.findCropView(): CropImageView? = when {
    this is CropImageView -> this
    this is ViewGroup -> (0 until childCount).firstNotNullOfOrNull {
        getChildAt(it).findCropView()
    }
    else -> null
}
