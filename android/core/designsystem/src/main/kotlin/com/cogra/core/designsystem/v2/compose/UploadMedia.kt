package com.cogra.core.designsystem.v2.compose

/**
 * What the seal's upload gate waits for (`UploadStatusLine`'s `media`, jakob
 * 2026-10-02: "per content of course"): pictures by default, a clip as `the
 * video`, and an edit's new face for its clip as `the cover` (`media="cover"`,
 * the edit's gate, jakob 2026-10-05) — the cover being one picture, its fault
 * keeps the one-picture line.
 */
enum class UploadMedia { Pictures, Video, Cover }

/**
 * The failure's fact for [failed] pictures (copy-voice, *A clip that didn't
 * upload*): `One picture didn't upload.`, and from two up its plural, `3
 * pictures didn't upload.` (seam 245, ask 13 G).
 */
fun failedPicturesLine(failed: Int): String =
    if (failed <= 1) "One picture didn't upload." else "$failed pictures didn't upload."

/** The plural's way out: `Remove it` for one, `Remove them` from two up (copy-voice, ask 13 G). */
fun removeFailedLabel(failed: Int): String = if (failed <= 1) "Remove it" else "Remove them"
