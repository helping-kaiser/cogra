package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * A SHEET OVER A SHEET TAKES THE NEXT TONAL RUNG (design/readme.md:2364):
 * "its surface moves to `surfaceContainerHighest` — elevation is tonal, and
 * two surfaces at one rung claim one elevation." Plain rather than
 * `@Composable` so the rung itself — not just its use inside a sheet — is
 * unit-testable against a [ColorScheme] built with no composition running,
 * the way `fieldCountReading` pins the late counter's own arithmetic.
 *
 * An unstacked sheet keeps whatever container colour it already draws —
 * [default] rides through untouched, since the base rung is this sheet's own
 * concern, not this one's to redraw.
 */
fun sheetContainerColor(stacked: Boolean, colors: ColorScheme, default: Color): Color =
    if (stacked) colors.surfaceContainerHighest else default

/**
 * THE SLIVER A SHEET AT ITS CEILING LEAVES BEHIND (`_shared.jsx:1249` —
 * `height="calc(100% - 72px)"`).
 */
val SheetCeilingSliver = 72.dp

/**
 * THE SHEET CEILING — how tall a sheet may ever be (jakob 2026-09-22).
 *
 * A sheet's top edge never rises above a [SheetCeilingSliver] strip measured
 * from the top of the SAFE AREA: below the status bar and the display cutout,
 * never the physical top of the glass. The rounded corners keep a strip of
 * the surface behind visible, and no sheet ever touches or passes the safe
 * area — the describe sheet grew to the device's top edge and took its Done
 * button off the screen with it, which is the bug this height kills.
 *
 * ONE MECHANISM, NOT TWO. The comments sheet already drew exactly this shape
 * against the window; naming it here is what lets every other sheet cap
 * itself with the same number instead of inventing a second one. The safe
 * inset is what the comments sheet was missing, and the sliver is now
 * measured from where content may actually start.
 *
 * The IME is deliberately NOT subtracted: a sheet pads itself clear of the
 * keyboard from INSIDE this height ([CograSheetSurface]), so the top edge
 * stays exactly where it is when the keyboard arrives and the content yields
 * instead.
 *
 * `safeDrawing` is the documented inset for content that must not overlap the
 * system bars or the cutout
 * ([WindowInsets](https://developer.android.com/develop/ui/compose/layouts/insets)).
 */
@Composable
fun sheetCeilingHeight(): Dp {
    val density = LocalDensity.current
    val window = LocalWindowInfo.current.containerSize.height
    val safeTop = WindowInsets.safeDrawing.getTop(density)
    return (with(density) { (window - safeTop).toDp() } - SheetCeilingSliver).coerceAtLeast(0.dp)
}

/**
 * The bottom sheet's *surface*, extracted from its presentation.
 *
 * A sheet is a drawer the reader opened and can drop (design/readme.md §7):
 * it comes from the edge it goes back to, covers the bottom bar, and traps
 * nothing. Presentation is Material's `ModalBottomSheet` — the documented
 * component, with its own scrim, drag behaviour and back handling — and this
 * is what goes inside it, so a screen never restates the geometry and a
 * static preview can draw a sheet without driving a sheet state. That is the
 * same split `StancePad` already uses to draw a bloomed pad without the
 * gesture.
 *
 * Geometry is the canonical seal board's: the extra-large (28dp) rung on the
 * top corners only, `surfaceContainerHigh`, a 32×4 handle in `outlineVariant`,
 * and 24dp side padding.
 */
@Composable
fun CograSheetSurface(
    modifier: Modifier = Modifier,
    showHandle: Boolean = true,
    testTag: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            // THE CEILING, ON EVERY SHEET (see [sheetCeilingHeight]). A
            // content-sized sheet grows with what it carries and stops here;
            // the surface never reaches the safe area, so whatever the sheet
            // stacks at its foot stays on the screen.
            .heightIn(max = sheetCeilingHeight())
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            // The surface reaches the screen's edge; only its content steps
            // clear of the navigation bar. [CograSheetHost] hands the sheet no
            // insets of its own, so the drawn background is what covers them.
            //
            // THE KEYBOARD TAKES THE SAME PADDING, whichever is larger: the
            // IME replaces the navigation bar rather than stacking on it, and
            // `union` is the documented way to pad by one inset or the other
            // rather than both (developer.android.com's inset guidance). It
            // pads from INSIDE the ceiling, so a raised keyboard shortens the
            // content instead of pushing the sheet's top edge up.
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
            .padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x6)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        if (showHandle) {
            Spacer(
                Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(32.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.outlineVariant),
            )
        }
        content()
    }
}

/**
 * THE PRESENTATION FOR A [CograSheetSurface] — and the reason a wizard sheet
 * is ONE sheet rather than two.
 *
 * [CograSheetSurface] draws the whole drawn sheet: the 28dp top corners, the
 * `surfaceContainerHigh` surface, and the 32×4 handle. Material's
 * `ModalBottomSheet` draws all three as well, from its own defaults — so a
 * host that takes those defaults and puts a surface inside stacks two
 * chromes, and the reader sees a handle over a handle and a rounded surface
 * inside a rounded surface.
 *
 * The geometry lives in ONE place, which [CograSheetSurface]'s own contract
 * already names ("a screen never restates the geometry"): this host therefore
 * keeps only what Material is here for — the scrim, the drag behaviour, the
 * back handling and the window — and draws nothing. Transparent container, no
 * handle, no insets of its own; the surface inside is the sheet.
 *
 * [skipPartiallyExpanded] defaults to true, as every reader-side sheet
 * already asks for it: a sheet opens showing its own top, not at a half
 * detent the reader has to drag out of.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CograSheetHost(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        modifier = modifier,
        sheetState = sheetState,
        containerColor = Color.Transparent,
        dragHandle = null,
        contentWindowInsets = { WindowInsets(0) },
        content = content,
    )
}

/**
 * A sheet's heading, with the optional `?` that opens the screen's one
 * explanation (design/readme.md §13: at most one per screen).
 */
@Composable
fun SheetTitle(
    text: String,
    modifier: Modifier = Modifier,
    onHelp: (() -> Unit)? = null,
    helpContentDescription: String = "What this means",
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (onHelp != null) {
            HelpDot(onHelp, helpContentDescription)
        }
        trailing?.invoke()
    }
}

/**
 * The circled `?`, drawn as the canonical boards draw it (`HelpDialog`): a
 * 24dp outlined circle in `onSurfaceVariant`. It taps at 48dp while drawing
 * at 24dp, and its label rides `onClickLabel` so the glyph is never the only
 * thing announced.
 *
 * **At most one per screen** (design/readme.md §13), and every one opens
 * [HelpDialog] — the house plain dialog — rather than a tooltip of its own.
 *
 * [tint] is the board's `inverse` for the same dot standing on a TONAL PANEL
 * instead of the page: on the page the ring and glyph read `onSurfaceVariant`
 * (the default), and inside a panel like the key-absent notice a caller
 * passes the panel's own on-colour instead, so the dot doesn't argue with a
 * second colour family (HelpDot.jsx:10-16).
 */
@Composable
fun HelpDot(
    onHelp: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    testTag: String? = null,
    tint: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Box(
        modifier = modifier
            .minimumInteractiveComponentSize()
            .size(24.dp)
            .clip(CircleShape)
            .border(1.dp, tint, CircleShape)
            .clickable(role = Role.Button, onClickLabel = contentDescription, onClick = onHelp)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "?",
            style = MaterialTheme.typography.labelMedium,
            color = tint,
        )
    }
}

@ThemePreviews
@Composable
private fun CograSheetSurfacePreview() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            CograSheetSurface {
                SheetTitle("Mark as sensitive", onHelp = {})
                Text(
                    "Veils the pictures and the words until a reader chooses to look.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                CograButton("Done", {})
            }
        }
    }
}
