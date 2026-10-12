package com.cogra.core.designsystem.v2.media

import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver

/**
 * THE DETAIL CLIP'S STAGE (PostDetailVideo.md:7-13, :39-51; ruling 100 —
 * design/readme.md §13, "The clip detail rulings"): the web's `stage.ts`
 * detail mode, as the rules alone. Framework-free, so every line of the law
 * is a plain test ([DetailClip] feeds it what the stage and the layers say and
 * carries out the [Command] it answers).
 *
 * - **The open is the only start.** "WHEN the detail opens GIVEN the clip
 *   stands unveiled and the device allows autoplay -> the clip plays" (:7);
 *   "GIVEN the device suppresses autoplay -> NEVER the clip starts on its own"
 *   (:9). A clip carried in from the card already playing plays on: that is no
 *   start (the web's `open`, ruling 96). Nothing later starts it on its own —
 *   not autoplay coming back, not the scroll (:13).
 * - **Whatever rises over the post stops a playing clip where it is and
 *   remembers it** — a sheet or a dialog (:39, :41) and the opinion pad alike
 *   (:49). A clip not playing when the cover rose — the reader had paused it,
 *   it had played to its end, the open never started it — is not remembered,
 *   so nothing resumes it (:45, :47).
 * - **When the last layer lifts, that same clip resumes where it stopped**:
 *   always after the pad alone (:51, "under suppressed autoplay included"),
 *   and after a sheet or a dialog only where autoplay is allowed at the
 *   dismissal (:43, :47 — the GIVEN reads at dismissal).
 *
 * **What a surface binding the player asserts — [bindPlays].** The surface
 * re-binds the one player when the app returns from the background, when the
 * fullscreen viewer hands the clip back, and when the detail reclaims it. Under
 * a cover the answer is "still", so nothing plays under a sheet the reader
 * left standing (the comment composer's round trip, the app's). Otherwise it
 * is the open's own answer — exactly what the surface asserted before the
 * cover rules existed, so the viewer's return keeps its present behavior: the
 * explicit carry of the viewer's play state (:59/:61) is its own item, and
 * this neither builds it nor moves it.
 *
 * **The clip can be taken while it stands stopped.** A sheet's own stage —
 * the comment thread's — claims the one player for its clip ([VideoStage]),
 * swapping the detail's clip out of it — in either order with the cover
 * reaching the detail, so the clip is read as the player holds it or, swapped
 * out first, as the swap left it ([VideoStage.swappedOut]). The position is
 * recorded when the cover rises, so the lifting can claim the clip back where it stood
 * ([Command.Reclaim]), whether or not it resumes: a detail whose clip never
 * came back would stand without its transport, which is drawn from a player.
 */
internal class DetailPlayback private constructor(
    private val openPlays: Boolean,
    bindPlays: Boolean,
    private var lastCover: SurfaceCover?,
    private var owed: Boolean,
    private var suspended: Boolean,
    private var standingMs: Long?,
) {

    /** What a surface binding the player now asserts (see the class note). */
    var bindPlays: Boolean = bindPlays
        private set

    /** The detail's own reclaim is about to bind: its lifting already decided. */
    private var ownClaim = false

    /**
     * What covers the post changed. [clip] is the clip as the stage holds it
     * now; [suppressed] is asked only at a lifting that owes a resume.
     */
    fun coverChanged(next: SurfaceCover?, clip: ClipNow, suppressed: () -> Boolean): Command {
        val prev = lastCover
        if (prev == next) return Command.None
        lastCover = next
        if (next != null) {
            if (next == SurfaceCover.Suspended) suspended = true
            // A second layer over the first changes nothing but the kind.
            if (prev != null) return Command.None
            // Read wherever the clip stands: the sheet's own stage may have
            // taken the player for its clip in the frame the sheet rose,
            // before this — then the swap is what says (ClipNow).
            bindPlays = false
            standingMs = clip.positionMs
            owed = clip.playing
            return if (owed) Command.Pause else Command.None
        }
        val resume = owed && (!suspended || !suppressed())
        val at = standingMs
        owed = false
        suspended = false
        standingMs = null
        bindPlays = openPlays
        return when {
            !clip.onStage -> Command.Reclaim(atMs = at ?: 0L, play = resume).also { ownClaim = true }
            resume -> Command.Play
            else -> Command.None
        }
    }

    /**
     * Whether the bind about to be asserted is the detail's own reclaim —
     * answered once, so the next bind is asserted as usual.
     */
    fun consumeOwnClaim(): Boolean = ownClaim.also { ownClaim = false }

    /** What the detail does to its clip. */
    sealed interface Command {
        data object None : Command

        /** Stop it where it is (:41, :49). */
        data object Pause : Command

        /** Resume it where it stopped (:43, :51). */
        data object Play : Command

        /** Claim it back where it stood at [atMs], and resume it only if [play]. */
        data class Reclaim(val atMs: Long, val play: Boolean) : Command
    }

    companion object {

        /**
         * The detail opens on its clip (:7, :9). [clip] is the card's clip
         * as the one player still holds it — playing, when the reader came
         * from a card that was showing it.
         */
        fun open(clip: ClipNow, suppressed: Boolean): DetailPlayback {
            val plays = !suppressed || (clip.onStage && clip.playing)
            return DetailPlayback(
                openPlays = plays,
                bindPlays = plays,
                lastCover = null,
                owed = false,
                suspended = false,
                standingMs = null,
            )
        }

        /**
         * Kept across the detail leaving the composition and coming back —
         * the comment composer is a destination of its own, and the thread's
         * sheet stands again when the reader returns to it — so a clip the
         * cover stopped is still owed its resume, and the return is no second
         * open.
         */
        val Saver: Saver<DetailPlayback, Any> = listSaver(
            save = {
                listOf(
                    it.openPlays,
                    it.bindPlays,
                    it.lastCover?.name,
                    it.owed,
                    it.suspended,
                    it.standingMs,
                )
            },
            restore = {
                DetailPlayback(
                    openPlays = it[0] as Boolean,
                    bindPlays = it[1] as Boolean,
                    lastCover = (it[2] as String?)?.let(SurfaceCover::valueOf),
                    owed = it[3] as Boolean,
                    suspended = it[4] as Boolean,
                    standingMs = it[5] as Long?,
                )
            },
        )
    }
}

/**
 * The detail's clip as the one player holds it right now — or, swapped out
 * of it, as it stood at the swap ([VideoStage.swappedOut]).
 *
 * @property onStage the player holds this clip — no other clip has been
 *   swapped into it.
 * @property playing it is playing, or about to: told to play and not run out
 *   — or was, the moment another clip took the player.
 * @property positionMs where it stands, or stood at the swap; null when
 *   nothing says.
 */
internal data class ClipNow(val onStage: Boolean, val playing: Boolean, val positionMs: Long?)
