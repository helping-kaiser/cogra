//! ´mod:module:transcode´
//!
//! What a video is served as, and the one tool that makes it so.
//!
//! **The target is the Android composer's, number for number.** 1080 on
//! the short side, H.264 at four megabits scaled down so a long clip still
//! fits the cap, never below one megabit, AAC at 128 kbps. Clients
//! compress on the device wherever they can; the server is where the rule
//! is enforced for the uploads that could not — a browser without an
//! encoder, a client that skipped it. The constants below mirror
//! `VideoBitrate.kt` and `AndroidVideoProcessor.kt`, so a clip the phone
//! produced is, by construction, one this module leaves alone.
//!
//! **Deciding costs nothing new.** Whether an upload is within target is
//! read off what the upload's own probe already learned — the displayed
//! canvas, the duration the container states, and the byte count — so a
//! clip that needs no work pays exactly what it paid before this module
//! existed.
//!
//! **The work is ffmpeg's**, run as a child process. It is the reference
//! implementation of every format involved, and a re-encoder is not
//! something to write again (docs/implementation/api-spec.md "Upload and
//! gallery limits"). The process is driven through `tokio::process`, so a
//! transcode that takes minutes holds a task rather than a runtime thread.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

/// The everyday video rate: 1080p at about four megabits
/// (`VideoBitrate.STANDARD_VIDEO_BPS`).
pub const STANDARD_VIDEO_BPS: u64 = 4_000_000;

/// AAC at 128 kbps (`VideoBitrate.AUDIO_BPS`).
pub const AUDIO_BPS: u64 = 128_000;

/// The lowest rate worth shipping (`VideoBitrate.FLOOR_VIDEO_BPS`). A clip
/// too long to fit the cap above it is encoded at the floor, and the cap
/// check on the result does the refusing.
pub const FLOOR_VIDEO_BPS: u64 = 1_000_000;

/// How much of the cap the video and its audio plan to fill
/// (`VideoBitrate.CAP_HEADROOM`). The remainder absorbs container overhead
/// and a VBR encoder overshooting its target on a busy passage.
pub const CAP_HEADROOM: f64 = 0.92;

/// The served resolution: 1080 on the short side
/// (`AndroidVideoProcessor.MAX_SHORT_SIDE_PX`).
pub const MAX_SHORT_SIDE_PX: u32 = 1080;

/// The video rate for a clip of `duration_ms` headed for a store that
/// holds at most `cap_bytes` — `VideoBitrate.forClip`, restated.
///
/// A clip of unknown length gets the standard rate: guessing lower for
/// something that may be five seconds long would degrade it for nothing,
/// and the cap check after the encode catches the rest.
pub fn video_bps_for(duration_ms: Option<u64>, cap_bytes: u64) -> u64 {
    let Some(duration_ms) = duration_ms.filter(|ms| *ms > 0) else {
        return STANDARD_VIDEO_BPS;
    };
    let seconds = duration_ms as f64 / 1000.0;
    let budget_bits = CAP_HEADROOM * cap_bytes as f64 * 8.0;
    let for_video = budget_bits / seconds - AUDIO_BPS as f64;
    if for_video >= STANDARD_VIDEO_BPS as f64 {
        STANDARD_VIDEO_BPS
    } else if for_video <= FLOOR_VIDEO_BPS as f64 {
        FLOOR_VIDEO_BPS
    } else {
        for_video.round() as u64
    }
}

/// Whether a clip may be served as it arrived.
///
/// Two questions, the composer's own (`AndroidVideoProcessor.editedItem`):
/// is it too big on screen, and does it carry more bits than we mean to
/// send. The second compares the container's average rate against the
/// whole budget — video and the audio beside it — because a container's
/// figure covers both.
///
/// **The budget is read with the cap's own headroom.** The composer plans
/// to [`CAP_HEADROOM`] of its target and lets the encoder overshoot into
/// the rest; a phone's output therefore lands a little above the planned
/// rate on a busy clip, and judging it against the plan alone would
/// re-encode — and degrade — the very uploads that were already done
/// right. Dividing by the headroom gives back exactly the overshoot the
/// plan allowed for. For a clip long enough that its rate is scaled to
/// the cap, the same division makes the rule "fits the cap", which is the
/// statement the scaling was making in the first place.
///
/// A clip that states no duration is treated as too rich, as the composer
/// treats one that states no rate: re-encoding a lean clip costs a little
/// quality, waving through a fat one is the fault this exists to fix.
pub fn within_target(
    width: u32,
    height: u32,
    duration_ms: Option<u64>,
    size_bytes: u64,
    cap_bytes: u64,
) -> bool {
    if width.min(height) > MAX_SHORT_SIDE_PX {
        return false;
    }
    let Some(duration_ms) = duration_ms.filter(|ms| *ms > 0) else {
        return false;
    };
    let bitrate = size_bytes as f64 * 8.0 * 1000.0 / duration_ms as f64;
    let budget = (video_bps_for(Some(duration_ms), cap_bytes) + AUDIO_BPS) as f64;
    bitrate <= budget / CAP_HEADROOM
}

/// The scale step, as an ffmpeg filter.
///
/// The short side is bounded, whichever side that is — a portrait clip
/// comes out 1080 wide, a landscape one 1080 tall — and a clip already
/// under it keeps its size, the way the composer re-encodes such a clip
/// "at the size it already is". Both sides land on even numbers because
/// 4:2:0 chroma needs them to (`-2` keeps the aspect ratio and rounds to
/// even; the explicit side is truncated to even for the same reason).
///
/// `iw`/`ih` are the displayed dimensions: ffmpeg applies a container's
/// rotation before the filter graph runs (its `autorotate` default), so
/// the rendition carries upright frames and no rotation of its own.
const SCALE_FILTER: &str = "scale=w='if(lte(iw,ih),trunc(min(iw,1080)/2)*2,-2)'\
                            :h='if(lte(iw,ih),-2,trunc(min(ih,1080)/2)*2)'";

/// The H.264 encoders the server can drive, in order of preference.
///
/// `libx264` is the reference encoder and what a standard ffmpeg build
/// carries. `libopenh264` is Cisco's, and the only H.264 encoder in
/// distributions that ship ffmpeg without x264 for licensing reasons —
/// Fedora's `ffmpeg-free`, which is what the development toolbox has.
const H264_ENCODERS: [&str; 2] = ["libx264", "libopenh264"];

/// Why ffmpeg cannot be used, found once at startup.
#[derive(Debug, thiserror::Error)]
pub enum FfmpegUnavailable {
    #[error("ffmpeg could not be run at {program:?}: {source}")]
    NotRunnable {
        program: PathBuf,
        source: std::io::Error,
    },
    #[error("ffmpeg at {program:?} has no H.264 encoder (looked for {H264_ENCODERS:?})")]
    NoH264Encoder { program: PathBuf },
    #[error("ffmpeg at {program:?} has no AAC encoder")]
    NoAacEncoder { program: PathBuf },
}

/// Why one transcode did not produce a file.
#[derive(Debug, thiserror::Error)]
pub enum TranscodeError {
    #[error("ffmpeg could not be started: {0}")]
    Spawn(std::io::Error),
    /// ffmpeg ran and refused the input. Deterministic: the same bytes
    /// will be refused again.
    #[error("ffmpeg exited with {status}: {stderr}")]
    Failed { status: String, stderr: String },
    #[error("ffmpeg did not finish within {0:?}")]
    TimedOut(Duration),
}

/// A located ffmpeg, and the H.264 encoder it will be driven with.
#[derive(Debug, Clone)]
pub struct Ffmpeg {
    program: PathBuf,
    h264: &'static str,
}

impl Ffmpeg {
    /// Finds out whether `program` is an ffmpeg this server can use.
    ///
    /// Asked once, when the server starts, rather than discovered by the
    /// first upload that needs it: a missing encoder is a deployment fact,
    /// and the log line at startup is where an operator reads those.
    pub async fn detect(program: impl Into<PathBuf>) -> Result<Self, FfmpegUnavailable> {
        let program = program.into();
        let output = tokio::process::Command::new(&program)
            .args(["-hide_banner", "-encoders"])
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .output()
            .await
            .map_err(|source| FfmpegUnavailable::NotRunnable {
                program: program.clone(),
                source,
            })?;
        let listing = String::from_utf8_lossy(&output.stdout);
        let has = |name: &str| {
            listing
                .lines()
                .any(|line| line.split_whitespace().nth(1) == Some(name))
        };
        let h264 = H264_ENCODERS
            .into_iter()
            .find(|name| has(name))
            .ok_or_else(|| FfmpegUnavailable::NoH264Encoder {
                program: program.clone(),
            })?;
        if !has("aac") {
            return Err(FfmpegUnavailable::NoAacEncoder { program });
        }
        Ok(Self { program, h264 })
    }

    /// The H.264 encoder this ffmpeg drives.
    pub fn h264_encoder(&self) -> &'static str {
        self.h264
    }

    /// The arguments for one transcode, in the order ffmpeg reads them.
    ///
    /// - The first video stream and the first audio stream, if there is
    ///   one — the upload's probe already refused any other kind of track.
    /// - The scale step, then H.264 at the stated rate in 8-bit 4:2:0, the
    ///   profile every reader decodes.
    /// - AAC at 128 kbps.
    /// - **No metadata out.** `-map_metadata -1` and `-map_chapters -1`
    ///   carry nothing of the source's container or streams across, and
    ///   `+bitexact` keeps the muxer from stamping its own version and a
    ///   creation time — so the same upload always becomes the same bytes.
    ///   The byte pipeline strips the output again regardless.
    /// - `+faststart` puts the movie header ahead of the media, so a reader
    ///   can start playing before the whole file has arrived.
    pub fn args(&self, input: &Path, output: &Path, video_bps: u64) -> Vec<OsString> {
        let mut args: Vec<OsString> = [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
        ]
        .into_iter()
        .map(OsString::from)
        .collect();
        args.push(input.as_os_str().to_owned());
        let video_bps = video_bps.to_string();
        let audio_bps = AUDIO_BPS.to_string();
        args.extend(
            [
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-vf",
                SCALE_FILTER,
                "-c:v",
                self.h264,
                "-b:v",
                video_bps.as_str(),
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                audio_bps.as_str(),
                "-map_metadata",
                "-1",
                "-map_chapters",
                "-1",
                "-fflags",
                "+bitexact",
                "-movflags",
                "+faststart",
                "-f",
                "mp4",
            ]
            .into_iter()
            .map(OsString::from),
        );
        args.push(output.as_os_str().to_owned());
        args
    }

    /// Re-encodes `input` into `output`, or says why not.
    ///
    /// The child is spawned with `kill_on_drop`, so the deadline is
    /// enforced by dropping it: when the timeout fires, or the task that
    /// owns this future is dropped because its lease was lost, ffmpeg is
    /// killed rather than left running on a job nobody will collect
    /// (tokio's `Command::kill_on_drop`). Stdout is discarded and stderr
    /// kept, bounded by `-loglevel error`, for the log line a failure
    /// earns.
    pub async fn transcode(
        &self,
        input: &Path,
        output: &Path,
        video_bps: u64,
        deadline: Duration,
    ) -> Result<(), TranscodeError> {
        let run = tokio::process::Command::new(&self.program)
            .args(self.args(input, output, video_bps))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .output();
        let finished = tokio::time::timeout(deadline, run)
            .await
            .map_err(|_| TranscodeError::TimedOut(deadline))?
            .map_err(TranscodeError::Spawn)?;
        if finished.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&finished.stderr);
        let tail: String = stderr
            .chars()
            .rev()
            .take(STDERR_TAIL_CHARS)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        Err(TranscodeError::Failed {
            status: finished.status.to_string(),
            stderr: tail.trim().to_string(),
        })
    }
}

/// How much of ffmpeg's complaint a failure keeps for the log.
const STDERR_TAIL_CHARS: usize = 600;

/// The target, unit-tested against the composer's own numbers.
#[cfg(test)]
mod tests {
    use super::*;

    const CAP: u64 = 100 * 1024 * 1024;

    /// A short clip gets the standard rate, a long one is scaled to fit
    /// the cap, and scaling stops at the floor — `VideoBitrate.forClip`'s
    /// three arms, with the scaled value recomputed by hand: 92 % of
    /// 100 MiB is 771 751 936 bits, over 402 s is 1 919 781 bps, less the
    /// 128 000 of audio is 1 791 781.
    ///
    /// The server's video rate is the Android composer's, arm for arm.
    /// ´claim:media:the-server-rate-is-the-composers´
    #[test]
    fn the_rate_mirrors_the_composer() {
        assert_eq!(video_bps_for(Some(30_000), CAP), STANDARD_VIDEO_BPS);
        assert_eq!(video_bps_for(Some(402_000), CAP), 1_791_781);
        assert_eq!(
            video_bps_for(Some(3_600_000), CAP),
            FLOOR_VIDEO_BPS,
            "an hour cannot fit above the floor"
        );
        assert_eq!(video_bps_for(None, CAP), STANDARD_VIDEO_BPS);
        assert_eq!(video_bps_for(Some(0), CAP), STANDARD_VIDEO_BPS);
    }

    /// What passes through untouched: a phone's own output, including its
    /// overshoot, and a long clip that fits the cap. What does not: a
    /// canvas over 1080 on its short side, a camera-rate original, and a
    /// clip that states no duration.
    ///
    /// A clip within the composer's target, overshoot included, is served as it arrived.
    /// ´claim:media:a-clip-within-target-passes-through´
    #[test]
    fn within_target_is_the_composers_rule_with_its_headroom() {
        let mb_per_s = |bps: u64, seconds: u64| bps * seconds / 8;

        // A 30 s phone clip at 4.3 Mbps overall: the planned 4.128 Mbps
        // plus a busy passage's overshoot, under 4.128 / 0.92 = 4.487.
        assert!(within_target(1080, 1920, Some(30_000), mb_per_s(4_300_000, 30), CAP));
        // The web clip the feed audit found: 1080p at 9.7 Mbps.
        assert!(!within_target(1920, 1080, Some(30_000), mb_per_s(9_700_000, 30), CAP));
        // Just over the headroom line.
        assert!(!within_target(1080, 1080, Some(30_000), mb_per_s(4_500_000, 30), CAP));
        // A lean clip whose canvas is too big still gets scaled.
        assert!(!within_target(2560, 1440, Some(30_000), mb_per_s(1_000_000, 30), CAP));
        // 6.7 min at 2 Mbps, the long clip already in the dev store: its
        // rate is scaled to the cap, so the rule reads "fits the cap".
        assert!(within_target(1920, 1080, Some(402_000), 101_000_000, CAP));
        assert!(!within_target(720, 1280, None, 1_000, CAP));
    }

    /// The invocation carries every part of the target: the rate, the
    /// audio rate, the scale step, and the metadata and layout flags.
    ///
    /// The ffmpeg invocation states the whole target and strips the source's metadata.
    /// ´claim:media:the-transcode-states-the-whole-target´
    #[test]
    fn the_invocation_states_the_whole_target() {
        let ffmpeg = Ffmpeg {
            program: "ffmpeg".into(),
            h264: "libx264",
        };
        let args: Vec<String> = ffmpeg
            .args(Path::new("in.mp4"), Path::new("out.mp4"), 1_791_781)
            .into_iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        let after = |flag: &str| {
            args.iter()
                .position(|a| a == flag)
                .and_then(|i| args.get(i + 1))
                .map(String::as_str)
        };
        assert_eq!(after("-i"), Some("in.mp4"));
        assert_eq!(after("-c:v"), Some("libx264"));
        assert_eq!(after("-b:v"), Some("1791781"));
        assert_eq!(after("-c:a"), Some("aac"));
        assert_eq!(after("-b:a"), Some("128000"));
        assert_eq!(after("-vf"), Some(SCALE_FILTER));
        assert_eq!(after("-map_metadata"), Some("-1"));
        assert_eq!(after("-movflags"), Some("+faststart"));
        assert_eq!(args.last().map(String::as_str), Some("out.mp4"));
    }
}
