package com.cogra.feature.profile

import com.cogra.domain.media.CropWindow

/**
 * The picture `AvatarCrop` hands back: the picked URI and the framing the
 * author left the crop at, as fractions of the picture (null for one never
 * framed). A one-shot navigation result, consumed once taken.
 */
data class FramedPicture(val uri: String, val window: CropWindow?)
