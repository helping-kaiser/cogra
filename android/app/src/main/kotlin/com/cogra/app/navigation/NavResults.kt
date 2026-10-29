// Navigation results: values a destination hands back to the one it
// returns to, riding the back-stack entries' savedStateHandle
// (android/CLAUDE.md "Navigation").

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import com.cogra.domain.media.CropWindow
import com.cogra.feature.content.CommentsReturn
import com.cogra.feature.content.CommentsScroll

/**
 * A navigation result: the name it rides under, bound to the value that
 * means "nothing to report".
 *
 * The two belong together. A key read with the wrong default, or cleared
 * with a value of the wrong type, compiles perfectly well and fails at
 * runtime — binding them into one thing is what makes that unsayable.
 */
internal class NavResultKey<T>(val name: String, val absent: T)

/**
 * The Restore result key. It rides the back-stack ENTRY's
 * savedStateHandle — a different object from the one injected into the
 * entry's ViewModels, so it must be read here, where the entry is in
 * hand (android/CLAUDE.md "Navigation").
 */
internal val actorRestoredKey = NavResultKey("actor_restored", false)

/** The (ChangeHandle)→Profile result key: the handle changed, re-read. */
internal val handleChangedKey = NavResultKey("handle_changed", false)

/**
 * The subpage→Settings result key: what to say over the page on return
 * (`Password changed — other devices are signed out.`, `Your handle is now
 * @x.`, …). The page re-reads on every arrival; this carries the words.
 */
internal val settingsNoticeKey = NavResultKey<String?>("settings_notice", null)

/** The manage-space door's ask: settings opens with Clearing data in view (Settings.md). */
internal val settingsClearingKey = NavResultKey("settings_clearing", false)

/** The Compose→(Feed|PostDetail) result key: a write signed, re-read. */
internal val contentSignedKey = NavResultKey("content_signed", false)

/**
 * The (ReplyWizard|CommentEdit)→thread result key: a comment or an edit
 * signed, so the thread re-reads and says so once.
 *
 * Distinct from [contentSignedKey] because the surfaces answer them
 * differently — a signed comment earns the thread's snackbar, a
 * returning post edit only the refetch.
 */
internal val commentSignedKey = NavResultKey("comment_signed", false)

/**
 * THE OTHER HALF OF THE SHEET'S RETURN (jakob 2026-09-15): which comment
 * the reply that just landed hangs under, so its branch unfolds and the
 * author sees what they wrote. Null is a comment on the post itself.
 *
 * "A comment landed" alone cannot draw the return — a reply arrives one
 * level down, behind a count that was collapsed when the reader left —
 * which is why this rides beside [commentSignedKey] rather than being
 * folded into it.
 */
internal val commentParentKey = NavResultKey<String?>("comment_parent", null)

/**
 * …and where the reader was in the thread when it gave way.
 *
 * Reported by the surface to ITSELF on the way out, not by the composer
 * on the way back: the place is the sheet's own fact, and the composer
 * never knew it. It rides the same savedStateHandle the results do, so
 * it survives process death exactly as they do.
 *
 * A LazyColumn's place is two ints and an `IntArray` is what a Bundle
 * carries without a Parcelable of its own; [CommentsScroll] is the shape
 * everything above this layer speaks.
 */
internal val commentsPlaceKey = NavResultKey<IntArray?>("comments_place", null)

private fun IntArray?.asCommentsScroll(): CommentsScroll? =
    this?.takeIf { it.size == 2 }?.let { CommentsScroll(it[0], it[1]) }

/**
 * The Wizard→Feed result key: a staged act was collected before it
 * landed. The value is the post's own label, so the feed's calm notice
 * can name what did not land (`ComposeExpired`).
 */
internal val contentExpiredKey = NavResultKey<String?>("content_expired", null)

/**
 * The VouchAsk→Invites result key: what Invites says on arrival from an ask
 * link — its snackbar and the row to stand at (VouchAsk.md:17, :27, :31) —
 * as `InvitesNotice.encode()` carries it.
 */
internal val invitesNoticeKey = NavResultKey<String?>("invites_notice", null)

/** The ProfileEdit→Profile result key: the update signed, re-read. */
internal val profileSavedKey = NavResultKey("profile_saved", false)

/**
 * The AvatarCrop→ProfileEdit result keys: the picture the crop brings back
 * to the edit form, and the framing it was left at — `[left, top, right,
 * bottom]` as fractions of the picture, absent for one never framed.
 */
internal val framedPictureUriKey = NavResultKey<String?>("framed_picture_uri", null)
internal val framedPictureWindowKey = NavResultKey<FloatArray?>("framed_picture_window", null)

/** A framing as the saved-state handle carries it. */
internal fun CropWindow.toFractions(): FloatArray = floatArrayOf(left, top, right, bottom)

/** The framing back from the handle; anything not four fractions is no framing. */
internal fun FloatArray.toCropWindow(): CropWindow? =
    if (size == CROP_WINDOW_SIDES) CropWindow(first(), this[1], this[2], last()) else null

private const val CROP_WINDOW_SIDES = 4

/**
 * A destination's own view of one result: what it says, and the lambda
 * that marks it read.
 *
 * Consuming is half of the pattern — a result left in the handle re-fires
 * on the next recomposition — so the read hands back the way to consume
 * it rather than leaving each site to remember the key and its default a
 * second time.
 */
@Composable
internal fun <T> NavBackStackEntry.navResult(key: NavResultKey<T>): Pair<T, () -> Unit> {
    val value by savedStateHandle
        .getStateFlow(key.name, key.absent)
        .collectAsStateWithLifecycle()
    return value to { savedStateHandle[key.name] = key.absent }
}

/** Reports [value] to the destination this one returns to. */
internal fun <T> NavController.report(key: NavResultKey<T>, value: T) {
    previousBackStackEntry?.savedStateHandle?.set(key.name, value)
}

/**
 * Reports [value] to the destination now on top — the shape a pop uses,
 * where the destination being answered is the one popped back to rather
 * than the one behind this.
 */
internal fun <T> NavController.reportToCurrent(key: NavResultKey<T>, value: T) {
    currentBackStackEntry?.savedStateHandle?.set(key.name, value)
}

/**
 * Reports [value] to the named destination further down the stack.
 *
 * The avatar flow's own seal answers the profile by name rather than
 * whatever entry sits under the flow: a signed picture's news belongs to
 * the profile, and [report] would hand it to whichever screen pushed the
 * flow, which may read no such result at all.
 */
internal inline fun <reified R : Any, T> NavController.reportTo(key: NavResultKey<T>, value: T) {
    val entry = runCatching { getBackStackEntry<R>() }.getOrNull() ?: return
    entry.savedStateHandle[key.name] = value
}

/**
 * The comments sheet's return as one surface reads it: what landed, the
 * branch it landed under, and where the reader was when the sheet gave way.
 *
 * Every surface that raises the thread — the feed, the detail, Saved —
 * reads the same three results and reports the same place on the way out,
 * because the return belongs to the sheet and not to the surface under it.
 */
internal class ThreadReturn(
    val value: CommentsReturn,
    val onConsumed: () -> Unit,
    val onDepart: (CommentsScroll) -> Unit,
)

@Composable
internal fun NavBackStackEntry.threadReturn(navController: NavController): ThreadReturn {
    val (commentSigned, consumeCommentSigned) = navResult(commentSignedKey)
    val (commentParent, consumeCommentParent) = navResult(commentParentKey)
    val (commentsPlace, consumeCommentsPlace) = navResult(commentsPlaceKey)
    return ThreadReturn(
        value = CommentsReturn(
            scroll = commentsPlace.asCommentsScroll(),
            landed = commentSigned,
            parentCommentId = commentParent,
        ),
        onConsumed = {
            consumeCommentSigned()
            consumeCommentParent()
            consumeCommentsPlace()
        },
        onDepart = { scroll ->
            navController.reportToCurrent(commentsPlaceKey, intArrayOf(scroll.index, scroll.offset))
        },
    )
}
