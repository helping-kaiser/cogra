package com.cogra.core.designsystem.v2.media

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * WHAT A LAYER RAISED OVER THE POST DOES TO ITS CLIP (PostDetailVideo.md:41-51;
 * the web's `covering-layer.tsx`).
 *
 * A sheet or a dialog [Suspend]s: "the clip stops where it is" (:41), and its
 * dismissal resumes it only where the device allows autoplay (:43, :47). The
 * opinion pad [Pause]s: "the clip pauses where it is" (:49), and its closing
 * resumes it "under suppressed autoplay included" (:51).
 */
enum class CoverKind { Suspend, Pause }

/** What covers the post: the strongest kind among the layers raised over it. */
enum class SurfaceCover { Suspended, Paused }

/**
 * The layers raised over one page, in the order they rose.
 *
 * **Why a signal and not geometry.** A `ModalBottomSheet`, an `AlertDialog` and
 * the stance pad's `Popup` are each a window of their own, so the page beneath
 * cannot see them from its own layout — a clip under a raised sheet still
 * stands whole in its own window. The layer has to SAY it is there.
 *
 * **Why a registry and not one boolean per sheet.** Most layers over the
 * detail are the screen's own open-state, which it could pass down; the
 * opinion pad is not — it is the stance control's, behind a slot and a view
 * model the screen never sees. A page-scoped registry both can announce into,
 * read where the clip stands, is the one shape that covers both — the same
 * hoisting Compose documents for state several callers write
 * (developer.android.com/develop/ui/compose/state-hoisting).
 *
 * Scoped by [CoveringLayersHost], never global: a sheet raised over the feed
 * announces into nothing, because the feed's own stage already takes its
 * suspension as a parameter ([ScrollStageHost]).
 */
@Stable
class CoveringLayers {

    private val raised = mutableStateListOf<Raised>()

    /** What covers the page now, or null when nothing does. Snapshot state. */
    val cover: SurfaceCover?
        get() = when {
            raised.any { it.kind == CoverKind.Suspend } -> SurfaceCover.Suspended
            raised.isNotEmpty() -> SurfaceCover.Paused
            else -> null
        }

    internal fun raise(token: Any, kind: CoverKind) {
        raised += Raised(token, kind)
    }

    internal fun lower(token: Any) {
        raised.removeAll { it.token === token }
    }

    private class Raised(val token: Any, val kind: CoverKind)
}

/** The layers raised over the page this composition stands on; null outside any host. */
val LocalCoveringLayers = staticCompositionLocalOf<CoveringLayers?> { null }

/** Gives [content] one page's registry of covering layers. */
@Composable
fun CoveringLayersHost(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalCoveringLayers provides remember { CoveringLayers() }, content = content)
}

/**
 * Announces a covering layer while [open]: from the composition that raises
 * it until the one that dismisses it — or until it leaves the composition,
 * whichever comes first. A no-op outside a [CoveringLayersHost].
 *
 * A layer handing over to another in one composition — one sheet dropping as
 * the next rises — is never read as a lifting: both writes land in the same
 * applied snapshot, and the reader sees the page covered throughout.
 */
@Composable
fun CoversSurface(open: Boolean, kind: CoverKind) {
    val layers = LocalCoveringLayers.current ?: return
    DisposableEffect(layers, open, kind) {
        val token = Any()
        if (open) layers.raise(token, kind)
        onDispose { layers.lower(token) }
    }
}
