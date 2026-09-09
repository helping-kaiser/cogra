// What a still may weigh when it leaves the device — and the only form
// of that question worth asking.
//
// The cap lives here rather than in a composer because three surfaces
// upload stills: the post wizard, the reply wizard, and the profile
// picture. A cap one of them enforced and another did not is exactly the
// hole HT-19 found, where the same file was refused for a post and taken
// as an avatar.

package com.cogra.domain.media

/** One still, matching the server's `DEFAULT_MAX_UPLOAD_BYTES` (D9). */
const val PICTURE_MAX_BYTES: Long = 10L * 1024 * 1024

/**
 * Whether an ENCODED still is over the cap.
 *
 * THE CAP GOVERNS THE BYTES THAT ARE SENT, and every still is downscaled
 * to 1080 and re-encoded to WebP before any of them leave
 * (`ImageProcessing`), so a phone camera's twelve-megabyte original
 * arrives at a few hundred kilobytes. Weighing the PICKED file against
 * the same number refused the ordinary camera photo the product would
 * have taken happily — so every path that uploads a still asks this about
 * the encode's output, which is the thing the server actually measures,
 * and the refusal is unreachable in practice rather than merely rare.
 */
fun ProcessedPicture.overPictureCap(): Boolean = bytes.size > PICTURE_MAX_BYTES
