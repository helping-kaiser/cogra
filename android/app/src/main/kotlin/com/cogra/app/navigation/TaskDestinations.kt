// The task flows a tab's stack carries: the composer and the post edit, the
// reply composer and the comment edit, the profile edit and its picture,
// Invites. Each owns the screen — the bar leaves for its back arrow.

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.cogra.feature.content.edit.PostEditRoute
import com.cogra.feature.content.reply.CommentEditRoute
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.content.reply.ReplyTargetKind
import com.cogra.feature.content.reply.ReplyWizardRoute
import com.cogra.feature.content.wizard.ComposeWizardRoute
import com.cogra.feature.invites.InvitesNotice
import com.cogra.feature.invites.InvitesRoute
import com.cogra.feature.profile.FramedPicture
import com.cogra.feature.profile.ProfileEditRoute
import com.cogra.feature.profile.avatar.AvatarFlowRoute

/** The task flows: what a tab's stack holds that owns the whole screen. */
internal fun NavGraphBuilder.taskFlows(shell: ShellScope) {
    composable<ComposePost> { entry -> shell.ComposeDestination(entry) }
    composable<ReplyWizard> { entry -> shell.ReplyDestination(entry) }
    with(shell) {
        composable<EditComment> { entry ->
            val route = entry.toRoute<EditComment>()
            CommentEditRoute(
                commentId = route.commentId,
                parentTitle = route.parentTitle,
                onSaved = {
                    navController.report(commentSignedKey, true)
                    navController.navigateUp()
                },
                onLeave = { navController.navigateUp() },
            )
        }
    }
    composable<ProfileEdit> { entry -> shell.ProfileEditDestination(entry) }
    composable<AvatarFlow> { entry -> shell.AvatarFlowDestination(entry) }
    composable<Invites> { entry -> shell.InvitesDestination(entry) }
}

/**
 * Invites, with the door it came through and what an ask link handed over on
 * the way here (VouchAsk.md:17, :27, :31). A reader who is not a member never
 * stands here (ProfileApplicant.md:18): they go back the way they came.
 */
@Composable
private fun ShellScope.InvitesDestination(entry: NavBackStackEntry) {
    val (notice, consumeNotice) = entry.navResult(invitesNoticeKey)
    InvitesRoute(
        from = entry.toRoute<Invites>().from,
        onBack = { navController.navigateUp() },
        onNotMember = { navController.navigateUp() },
        onRestoreKey = { navController.navigate(Restore) },
        arrival = InvitesNotice.decode(notice),
        onArrivalConsumed = consumeNotice,
        deletionBand = deletionBand(node = null),
    )
}

/**
 * `ReplyEntry` 5 and 7 — the composer, pinned to whatever the thread
 * said it answers.
 *
 * One route for every surface that raises the thread: the sheet over the
 * feed opens the same composer the sheet over the detail does, and two
 * copies of this call would be two chances for them to drift.
 */
internal fun NavController.openReplyWizard(target: ReplyTarget) {
    navigate(
        ReplyWizard(
            targetId = target.id,
            isComment = target.kind == ReplyTargetKind.Comment,
            title = target.title,
            snippet = target.snippet,
            authorHandle = target.authorHandle,
            avatarUrl = target.avatarUrl,
        ),
    )
}

@Composable
private fun ShellScope.ComposeDestination(entry: NavBackStackEntry) {
    val editing = entry.toRoute<ComposePost>().postId != null
    // Creating a post runs the wizard (D19); editing one runs
    // the post edit, one screen and one batch (EditCompose).
    // Both live behind the same destination so the bottom
    // bar's centre action and the post menu's Edit keep their
    // routes.
    if (!editing) {
        ComposeWizardRoute(
            referenceTargetId = entry.toRoute<ComposePost>().referenceTargetId,
            stagedTag = entry.toRoute<ComposePost>().tag,
            // `ComposeLanded` lands on the post itself, not on
            // the feed: the author's next question is what
            // they just made, and a feed landing answers a
            // different one. The wizard leaves the stack
            // first, so back from the post reaches the feed
            // (ComposeLanded.md:11) rather than the composer
            // that made it — the feed's root, whichever tab the
            // wizard was opened over; that tab keeps its stack.
            onSigned = { nodeId ->
                navController.popBackStack()
                navController.landOnFeedRoot(keepLeaving = true)
                navController.reportToCurrent(contentSignedKey, true)
                navController.navigate(PostDetail(nodeId, published = true))
            },
            // "Nothing was spent — your draft is saved": the
            // notice belongs on the feed, which is where the
            // canonical `ComposeExpired` board draws it.
            onExpired = { label ->
                navController.popBackStack()
                navController.landOnFeedRoot(keepLeaving = true)
                navController.reportToCurrent(contentExpiredKey, label)
            },
            onLeave = { navController.navigateUp() },
            onRestoreKey = { navController.navigate(Restore) },
            keyBanner = keyBanner,
            deletionBand = deletionBand(node = null),
        )
        return
    }
    // The post edit, one screen and one batch (EditCompose). An
    // edit came from its post already and simply returns to it,
    // refreshed, the edit settling.
    PostEditRoute(
        postId = checkNotNull(entry.toRoute<ComposePost>().postId),
        onSaved = {
            navController.report(contentSignedKey, true)
            navController.popBackStack()
        },
        onBack = { navController.navigateUp() },
        keyCard = keyBanner,
        deletionBand = deletionBand(node = null),
    )
}

@Composable
private fun ShellScope.ReplyDestination(entry: NavBackStackEntry) {
    val route = entry.toRoute<ReplyWizard>()
    ReplyWizardRoute(
        target = ReplyTarget(
            id = route.targetId,
            kind = if (route.isComment) {
                ReplyTargetKind.Comment
            } else {
                ReplyTargetKind.Post
            },
            title = route.title,
            snippet = route.snippet,
            authorHandle = route.authorHandle,
            avatarUrl = route.avatarUrl,
        ),
        // Signed lands back on the thread it answers, which
        // re-reads and shows the comment settling — and, for
        // a reply, unfolds the branch it settled into. The
        // wizard's own target IS that branch's comment, so
        // the parent is known here and nowhere else.
        onSigned = {
            navController.report(commentSignedKey, true)
            navController.report(
                commentParentKey,
                route.targetId.takeIf { route.isComment },
            )
            navController.navigateUp()
        },
        // Leaving keeps nothing: comments have no drafts
        // (jakob 2026-09-01).
        onLeave = { navController.navigateUp() },
        onRestoreKey = { navController.navigate(Restore) },
        keyBanner = keyBanner,
    )
}

@Composable
private fun ShellScope.ProfileEditDestination(entry: NavBackStackEntry) {
    val (framedUri, consumeFramedUri) = entry.navResult(framedPictureUriKey)
    val (framedWindow, consumeFramedWindow) = entry.navResult(framedPictureWindowKey)
    ProfileEditRoute(
        onSaved = {
            navController.report(profileSavedKey, true)
            navController.popBackStack()
        },
        onPicturePicked = { uri -> navController.navigate(AvatarFlow(uri, fromEdit = true)) },
        onBack = { navController.navigateUp() },
        framedPicture = framedUri?.let { FramedPicture(it, framedWindow?.toCropWindow()) },
        onFramedPictureConsumed = {
            consumeFramedUri()
            consumeFramedWindow()
        },
    )
}

@Composable
private fun ShellScope.AvatarFlowDestination(entry: NavBackStackEntry) {
    val route = entry.toRoute<AvatarFlow>()
    AvatarFlowRoute(
        uri = route.uri,
        onSigned = {
            navController.reportTo<Profile, _>(profileSavedKey, true)
            navController.popBackStack()
        },
        onLeave = { navController.popBackStack() },
        onFramed = if (route.fromEdit) {
            { window ->
                navController.report(framedPictureWindowKey, window?.toFractions())
                navController.report(framedPictureUriKey, route.uri)
                navController.popBackStack()
            }
        } else {
            null
        },
    )
}
