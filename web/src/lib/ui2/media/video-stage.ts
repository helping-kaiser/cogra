// One clip plays at a time (design/readme.md: "One clip plays at a time, at
// 70% visibility or more — android's gate, blessed"). This mirrors the
// OWNERSHIP semantics of
// android/core/designsystem/.../v2/media/VideoStage.kt — the most recent
// claimant owns the stage, and claiming pauses whoever held it before — but
// not its player-pooling: Android shares one ExoPlayer across surfaces
// because a decoder is a scarce resource worth moving rather than
// duplicating, and that has no web analog. Each `<video>` element here owns
// its own decode; this module arbitrates PLAYBACK ownership only, so two
// autoplaying clips never fight.

type Owner = {
  readonly token: object;
  readonly video: HTMLVideoElement;
};

let current: Owner | null = null;

/**
 * Takes the stage for `token`, on `video`.
 *
 * If a different token currently holds the stage, that owner's video is
 * paused before the claim transfers — the newest claimant always wins, and
 * the stage holds exactly one playing clip. Claiming again with the same
 * token is a no-op past updating the held video.
 */
export function claim(token: object, video: HTMLVideoElement): void {
  if (current && current.token !== token && !current.video.paused) {
    current.video.pause();
  }
  current = { token, video };
}

/**
 * The surface is leaving.
 *
 * Ownership clears only if `token` still holds it — mirrors
 * `VideoStage.surrender`'s guard: a surface whose clip already lost the
 * stage to a newer claimant must not steal it back on its own way out.
 */
export function surrender(token: object): void {
  if (current?.token === token) {
    current = null;
  }
}

/** Test-only: clears the stage between tests, mirroring `resetMuteForTests`. */
export function resetVideoStageForTests(): void {
  current = null;
}
