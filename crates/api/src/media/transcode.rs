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
//! **The target is 8-bit SDR**, the signal every reader decodes and
//! displays. A PQ or HLG source is tone-mapped into it rather than
//! re-labelled or clipped, and a rendition of one says BT.709 in its own
//! bitstream.
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

pub use super::video::Transfer;

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

/// HDR to SDR, after the scale step, for a PQ or HLG source.
///
/// The recipe is the one ffmpeg's `tonemap` documentation sets out: the
/// filter "only work[s] on linear light", "expects data in single
/// precision floating point", and needs `zscale` to get there and back.
/// So, in order: linearize (`zscale t=linear`), widen to float
/// (`gbrpf32le`), convert the BT.2020 gamut to BT.709 while the light is
/// still linear (`zscale p=bt709`), map the range, then encode BT.709
/// limited-range and drop to 8-bit 4:2:0. The scale step runs first, so
/// the float work is done on the served canvas rather than the source's.
///
/// - **`npl=203`**: zimg scales linear light so that "nominal white
///   (L = 1.0) matches the nominal SDR luminance", and 203 cd/m² is where
///   ITU-R BT.2408 places HDR reference white — so diffuse white in the
///   source lands on SDR white rather than twice as bright.
/// - **`mobius`**: of the documented curves, the one for "when color
///   accuracy is more important than detail preservation" — it maps
///   in-range values nearly 1:1 and rolls off only the highlights. `hable`
///   darkens everything to keep highlight detail, and `clip` is the hard
///   clipping this recipe exists to avoid.
///
/// The input transfer is stated rather than read off the frames, so the
/// linearization follows what the probe found even if a step before it
/// dropped the tag.
fn tone_map_filter(transfer: Transfer) -> Option<String> {
    let tin = match transfer {
        Transfer::Sdr => return None,
        Transfer::Pq => "smpte2084",
        Transfer::Hlg => "arib-std-b67",
    };
    Some(format!(
        "zscale=tin={tin}:t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,\
         tonemap=tonemap=mobius,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
    ))
}

/// The VUI a tone-mapped rendition states: BT.709 primaries, transfer and
/// matrix, limited range (ITU-T H.273 code 1 for each). Written by the
/// `h264_metadata` bitstream filter rather than left to the encoder,
/// because not every H.264 encoder ffmpeg drives writes a colour
/// description — `libopenh264` writes none — and an HDR source's rendition
/// that states nothing would leave a reader to guess the very thing the
/// tone map changed.
const BT709_VUI: &str = "h264_metadata=video_full_range_flag=0:colour_primaries=1\
                         :transfer_characteristics=1:matrix_coefficients=1";

/// What the HDR path needs beside the encoders: the two filters of the
/// tone-map recipe (`zscale` exists only in builds linked against zimg)
/// and the bitstream filter that stamps the rendition's VUI.
const TONE_MAP_FILTERS: [&str; 2] = ["zscale", "tonemap"];
const TONE_MAP_BSF: &str = "h264_metadata";

/// How the video track is carried into a rendition.
///
/// A stream copy and a filter graph are mutually exclusive in ffmpeg —
/// `-c:v copy` skips exactly the decode a scale or a tone-map step needs
/// — so copying is only ever offered when the video is already the
/// served target on its own terms (canvas, rate, and an SDR 8-bit 4:2:0
/// signal: [`within_target`] plus [`super::video::Signal::is_served`]).
/// A rendition is reached only because something in the upload was
/// outside target; when that something was audio alone, the video track
/// is bytes ffmpeg does not have to touch, and copying it costs nothing
/// and loses nothing a re-encode would.
#[derive(Debug, Clone, Copy)]
pub enum VideoPlan {
    /// The video stream is copied unchanged (`-c:v copy`).
    Copy,
    /// The video stream is re-encoded to `bps`, tone-mapped from
    /// `transfer` when it states HDR.
    Encode { bps: u64, transfer: Transfer },
}

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

/// A located ffmpeg, the H.264 encoder it will be driven with, and whether
/// it can tone-map an HDR source.
#[derive(Debug, Clone)]
pub struct Ffmpeg {
    program: PathBuf,
    h264: &'static str,
    tone_map: bool,
}

/// One ffmpeg capability listing (`-encoders`, `-filters`, `-bsfs`), as
/// text.
async fn listing(program: &Path, flag: &str) -> Result<String, FfmpegUnavailable> {
    let output = tokio::process::Command::new(program)
        .args(["-hide_banner", flag])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|source| FfmpegUnavailable::NotRunnable {
            program: program.to_path_buf(),
            source,
        })?;
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

impl Ffmpeg {
    /// Finds out whether `program` is an ffmpeg this server can use.
    ///
    /// Asked once, when the server starts, rather than discovered by the
    /// first upload that needs it: a missing encoder is a deployment fact,
    /// and the log line at startup is where an operator reads those.
    ///
    /// The tone map is asked about the same way but is not a condition of
    /// use: without it every SDR re-encode still works, and only an HDR
    /// source fails — with a reason its author reads
    /// (`ingest_queue::REASON_NO_TONE_MAP`), because a rendition that is
    /// not tone-mapped would serve washed-out colours under a digest that
    /// can never be replaced.
    ///
    /// `-encoders` and `-filters` list one entry per line, flags first and
    /// the name second; `-bsfs` lists bare names under a heading.
    pub async fn detect(program: impl Into<PathBuf>) -> Result<Self, FfmpegUnavailable> {
        let program = program.into();
        let encoders = listing(&program, "-encoders").await?;
        let named = |listing: &str, name: &str| {
            listing
                .lines()
                .any(|line| line.split_whitespace().nth(1) == Some(name))
        };
        let h264 = H264_ENCODERS
            .into_iter()
            .find(|name| named(&encoders, name))
            .ok_or_else(|| FfmpegUnavailable::NoH264Encoder {
                program: program.clone(),
            })?;
        if !named(&encoders, "aac") {
            return Err(FfmpegUnavailable::NoAacEncoder { program });
        }
        let filters = listing(&program, "-filters").await?;
        let bsfs = listing(&program, "-bsfs").await?;
        let tone_map = TONE_MAP_FILTERS
            .into_iter()
            .all(|name| named(&filters, name))
            && bsfs.lines().any(|line| line.trim() == TONE_MAP_BSF);
        Ok(Self {
            program,
            h264,
            tone_map,
        })
    }

    /// The H.264 encoder this ffmpeg drives.
    pub fn h264_encoder(&self) -> &'static str {
        self.h264
    }

    /// Whether this ffmpeg carries the tone-map recipe an HDR source
    /// needs ([`tone_map_filter`]).
    pub fn tone_maps(&self) -> bool {
        self.tone_map
    }

    /// The ffmpeg this was detected at.
    pub fn program(&self) -> &Path {
        &self.program
    }

    /// The arguments for one transcode, in the order ffmpeg reads them.
    ///
    /// - The first video stream and the first audio stream, if there is
    ///   one — the upload's probe already refused any other kind of track.
    /// - **Video, per [`VideoPlan`].** A copy carries no filter graph and
    ///   no video encoding flags at all — `-vf` and stream copy cannot
    ///   share an invocation. An encode runs the scale step, then H.264 at
    ///   the stated rate in 8-bit 4:2:0, the profile every reader decodes.
    /// - **Audio is always re-encoded to AAC at 128 kbps.** Audio is the
    ///   one track a rendition may exist purely to fix, so unlike video it
    ///   is never a candidate for a stream copy.
    /// - **No metadata out.** `-map_metadata -1` and `-map_chapters -1`
    ///   carry nothing of the source's container or streams across, and
    ///   `+bitexact` keeps the muxer from stamping its own version and a
    ///   creation time — so the same upload always becomes the same bytes.
    ///   The byte pipeline strips the output again regardless.
    /// - `+faststart` puts the movie header ahead of the media, so a reader
    ///   can start playing before the whole file has arrived.
    /// - **An HDR source is tone-mapped** after the scale step
    ///   ([`tone_map_filter`]), and its rendition states BT.709 in the
    ///   container and in the bitstream's own VUI ([`BT709_VUI`]). An SDR
    ///   source's invocation carries neither, and is otherwise the same.
    ///   Only [`VideoPlan::Encode`] carries a transfer at all: a copied
    ///   video is, by construction, already the SDR signal readers are
    ///   served ([`VideoPlan`]).
    pub fn args(&self, input: &Path, output: &Path, video: VideoPlan) -> Vec<OsString> {
        let mut args: Vec<OsString> =
            ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i"]
                .into_iter()
                .map(OsString::from)
                .collect();
        args.push(input.as_os_str().to_owned());
        let audio_bps = AUDIO_BPS.to_string();
        args.extend(
            ["-map", "0:v:0", "-map", "0:a:0?"]
                .into_iter()
                .map(OsString::from),
        );

        let video_bps;
        match video {
            VideoPlan::Copy => {
                args.extend(["-c:v", "copy"].into_iter().map(OsString::from));
            }
            VideoPlan::Encode { bps, transfer } => {
                video_bps = bps.to_string();
                let tone_map = tone_map_filter(transfer);
                let filter = match &tone_map {
                    Some(tone_map) => format!("{SCALE_FILTER},{tone_map}"),
                    None => SCALE_FILTER.to_string(),
                };
                args.push("-vf".into());
                args.push(filter.into());
                if tone_map.is_some() {
                    args.extend(
                        [
                            "-color_primaries",
                            "bt709",
                            "-color_trc",
                            "bt709",
                            "-colorspace",
                            "bt709",
                            "-color_range",
                            "tv",
                            "-bsf:v",
                            BT709_VUI,
                        ]
                        .into_iter()
                        .map(OsString::from),
                    );
                }
                args.extend(
                    [
                        "-c:v",
                        self.h264,
                        "-b:v",
                        video_bps.as_str(),
                        "-pix_fmt",
                        "yuv420p",
                    ]
                    .into_iter()
                    .map(OsString::from),
                );
            }
        }

        args.extend(
            [
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
        video: VideoPlan,
        deadline: Duration,
    ) -> Result<(), TranscodeError> {
        let run = tokio::process::Command::new(&self.program)
            .args(self.args(input, output, video))
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

#[cfg(test)]
impl Ffmpeg {
    /// An ffmpeg as [`Ffmpeg::detect`] describes one built without zimg:
    /// it encodes, and it cannot tone-map.
    pub(crate) fn without_tone_map() -> Self {
        Self {
            program: "ffmpeg".into(),
            h264: "libx264",
            tone_map: false,
        }
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
        let bytes_at = |bps: u64, seconds: u64| bps * seconds / 8;

        assert!(
            within_target(1080, 1920, Some(30_000), bytes_at(4_300_000, 30), CAP),
            "a 30 s phone clip at 4.3 Mbps overall — the planned 4.128 plus a \
             busy passage's overshoot — is under 4.128 / 0.92 = 4.487"
        );
        assert!(
            !within_target(1920, 1080, Some(30_000), bytes_at(9_700_000, 30), CAP),
            "the web clip the feed audit found: 1080p at 9.7 Mbps"
        );
        assert!(
            !within_target(1080, 1080, Some(30_000), bytes_at(4_500_000, 30), CAP),
            "just over the headroom line"
        );
        assert!(
            !within_target(2560, 1440, Some(30_000), bytes_at(1_000_000, 30), CAP),
            "a lean clip whose canvas is too big is still scaled"
        );
        assert!(
            within_target(1920, 1080, Some(402_000), 101_000_000, CAP),
            "6.7 min at 2 Mbps, the long clip already in the dev store: its \
             rate is scaled to the cap, so the rule reads \"fits the cap\""
        );
        assert!(
            !within_target(720, 1280, None, 1_000, CAP),
            "a clip that states no duration is treated as too rich"
        );
    }

    /// The same clip can be in target for a post and not for a comment:
    /// at 150 s a post still gets the standard rate, while a comment's half
    /// cap scales its budget to 2 444 506 + 128 000 bps, and 4.2 Mbps
    /// overall is over that budget's headroom line (2 796 202).
    ///
    /// Whether a clip is within target depends on the cap of the destination it was uploaded for.
    /// ´claim:media:within-target-is-read-against-the-destinations-cap´
    #[test]
    fn a_clip_in_target_for_a_post_may_not_be_for_a_comment() {
        const COMMENT_CAP: u64 = 50 * 1024 * 1024;
        let long_phone_clip = 4_200_000 * 150 / 8;
        assert!(within_target(
            1080,
            1920,
            Some(150_000),
            long_phone_clip,
            CAP
        ));
        assert!(!within_target(
            1080,
            1920,
            Some(150_000),
            long_phone_clip,
            COMMENT_CAP
        ));
        assert_eq!(video_bps_for(Some(150_000), COMMENT_CAP), 2_444_506);
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
            tone_map: true,
        };
        let args: Vec<String> = ffmpeg
            .args(
                Path::new("in.mp4"),
                Path::new("out.mp4"),
                VideoPlan::Encode {
                    bps: 1_791_781,
                    transfer: Transfer::Sdr,
                },
            )
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
        assert_eq!(after("-bsf:v"), None, "an SDR source's VUI is its own");
    }

    /// A copy carries no filter graph and no video encoding flags at all —
    /// `-c:v copy` alone for the video track, ffmpeg's own reason being
    /// that a filter graph requires the decode a copy exists to skip —
    /// while audio is still always re-encoded to the AAC target.
    ///
    /// A copied video carries no filter graph, and its audio is still re-encoded to AAC.
    /// ´claim:media:a-copied-video-carries-no-filter-graph´
    #[test]
    fn a_video_copy_carries_no_filter_or_encode_flags() {
        let ffmpeg = Ffmpeg {
            program: "ffmpeg".into(),
            h264: "libx264",
            tone_map: true,
        };
        let args: Vec<String> = ffmpeg
            .args(Path::new("in.mp4"), Path::new("out.mp4"), VideoPlan::Copy)
            .into_iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        let after = |flag: &str| {
            args.iter()
                .position(|a| a == flag)
                .and_then(|i| args.get(i + 1))
                .map(String::as_str)
        };
        assert_eq!(after("-c:v"), Some("copy"));
        assert_eq!(after("-c:a"), Some("aac"), "audio is still re-encoded");
        assert_eq!(after("-b:a"), Some("128000"));
        assert!(
            !args.iter().any(|a| a == "-vf"),
            "no filter graph: {args:?}"
        );
        assert!(!args.iter().any(|a| a == "-b:v"), "no video rate: {args:?}");
        assert!(
            !args.iter().any(|a| a == "-pix_fmt"),
            "no pixel format: {args:?}"
        );
        assert!(
            !args.iter().any(|a| a == "-bsf:v"),
            "no bitstream filter: {args:?}"
        );
    }

    /// An HDR source's invocation scales, then tone-maps from the transfer
    /// the probe found — linear light, float, BT.709 gamut, the curve, back
    /// to BT.709 8-bit 4:2:0 — and states BT.709 in the container and the
    /// bitstream.
    ///
    /// A PQ or HLG source is tone-mapped to 8-bit BT.709 after the scale step, and its rendition says so.
    /// ´claim:media:an-hdr-source-is-tone-mapped-to-the-target´
    #[test]
    fn an_hdr_invocation_tone_maps_after_the_scale() {
        let ffmpeg = Ffmpeg {
            program: "ffmpeg".into(),
            h264: "libopenh264",
            tone_map: true,
        };
        for (transfer, tin) in [(Transfer::Pq, "smpte2084"), (Transfer::Hlg, "arib-std-b67")] {
            let args: Vec<String> = ffmpeg
                .args(
                    Path::new("in.mp4"),
                    Path::new("out.mp4"),
                    VideoPlan::Encode {
                        bps: 4_000_000,
                        transfer,
                    },
                )
                .into_iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            let after = |flag: &str| {
                args.iter()
                    .position(|a| a == flag)
                    .and_then(|i| args.get(i + 1))
                    .map(String::as_str)
            };
            let filter = after("-vf").expect("a filter graph");
            assert!(filter.starts_with(SCALE_FILTER), "scale first: {filter}");
            let steps = [
                format!("zscale=tin={tin}:t=linear:npl=203"),
                "format=gbrpf32le".to_string(),
                "zscale=p=bt709".to_string(),
                "tonemap=tonemap=mobius".to_string(),
                "zscale=t=bt709:m=bt709:r=tv".to_string(),
                "format=yuv420p".to_string(),
            ];
            let mut from = SCALE_FILTER.len();
            for step in &steps {
                let at = filter[from..]
                    .find(step.as_str())
                    .unwrap_or_else(|| panic!("{step} after position {from} in {filter}"));
                from += at + step.len();
            }
            assert_eq!(after("-color_trc"), Some("bt709"));
            assert_eq!(after("-color_primaries"), Some("bt709"));
            assert_eq!(after("-colorspace"), Some("bt709"));
            assert_eq!(after("-bsf:v"), Some(BT709_VUI));
            assert_eq!(after("-pix_fmt"), Some("yuv420p"));
        }
    }
}
