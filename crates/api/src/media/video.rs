//! ´mod:module:video´
//!
//! The one accepted moving format's reader: recognize MP4 from the bytes,
//! prove its tracks carry the codecs the policy admits, and read the
//! duration the container states.
//!
//! **The server validates and never transcodes.** Clients re-encode on
//! device, exactly as they already do for stills, so the bytes that
//! arrive are the bytes that are stored and the server's whole job is to
//! refuse what it will not serve. That is what keeps an encoder — and the
//! CPU budget, the format matrix and the quality argument that come with
//! one — out of the upload path.
//!
//! MP4 is an ISO base media container: a sequence of boxes, each a
//! 32-bit big-endian size and a four-character type, with `ftyp` first
//! declaring the brand the file conforms to. The probe reads the header
//! boxes alone (`Mp4Reader::read_header`, the `mp4` crate's documented
//! entry point) and decodes no samples: track codecs and the movie
//! duration both live in `moov`, so nothing here has to touch a frame.

use std::io::Cursor;

use mp4::{MediaType, Mp4Reader, TrackType};

use super::MediaError;

/// The single stored moving format. Clients re-encode to it on device.
pub const MIME: &str = "video/mp4";

/// The `ftyp` brands an MP4 may announce.
///
/// A brand is the container's statement of which specification it
/// conforms to, and the ISO base media format is wider than MP4 — the
/// same box grammar carries QuickTime (`qt  `) and the image formats
/// (`avif`, `heic`). Checking the brand is the container half of
/// "container and codec validation": it refuses a file whose boxes would
/// parse but whose shape is not the one clients are asked to produce.
///
/// The set is the MP4 family a phone encoder actually stamps — Android's
/// `MediaMuxer` and iOS's `AVAssetWriter` both emit `isom` or `mp42`,
/// with the rest of the family reachable through the compatible-brand
/// list every writer carries.
const BRANDS: [&[u8; 4]; 7] = [
    b"isom", b"iso2", b"iso4", b"iso6", b"mp41", b"mp42", b"avc1",
];

const HEADER_LEN: usize = 12;

/// What the header probe learned. The pixels are never touched: the
/// dimensions and the duration are facts the container states about
/// itself, and a file that misstates them fails the codec check first.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Probe {
    pub width: u32,
    pub height: u32,
    /// The movie duration in milliseconds — written to the asset's
    /// options as `duration_ms`. A fact about the asset, never a limit
    /// on it: there is deliberately no duration cap.
    pub duration_ms: u64,
}

/// Whether the bytes are an MP4 container, read from the bytes alone.
///
/// `ftyp` sits at offset 4, after its own box size, and the brand
/// follows it. Both the major brand and the compatible-brand list count:
/// a writer states the strictest brand it meets as the major one and
/// lists the rest, so a file that says `mp42` among its compatible
/// brands is an MP4 whatever it leads with.
pub fn sniff(bytes: &[u8]) -> bool {
    if bytes.len() < HEADER_LEN || bytes.get(4..8) != Some(b"ftyp".as_slice()) {
        return false;
    }
    let declared = bytes
        .get(..4)
        .and_then(|raw| <[u8; 4]>::try_from(raw).ok())
        .map(|raw| u32::from_be_bytes(raw) as usize)
        .unwrap_or(0);
    let end = declared.min(bytes.len()).max(HEADER_LEN);
    bytes
        .get(8..end)
        .unwrap_or_default()
        .chunks_exact(4)
        .any(|brand| BRANDS.iter().any(|known| known.as_slice() == brand))
}

/// The refusal gate for video: the container's tracks must be the codecs
/// the policy admits, and nothing else may ride along.
///
/// H.264 video and AAC audio are the accepted pair, so every other track
/// is refused rather than ignored — a stored file carrying a codec the
/// readers were never promised is a render that fails on someone's
/// device, and the upload is the only place that can still say no. A
/// file with no video track at all is not a video whatever its brand
/// says.
pub fn probe(bytes: &[u8]) -> Result<Probe, MediaError> {
    let size = u64::try_from(bytes.len()).map_err(|_| MediaError::Undecodable)?;
    let mp4 = Mp4Reader::read_header(Cursor::new(bytes), size)
        .map_err(|_| MediaError::Malformed("the video container does not parse"))?;

    let mut video: Option<(u32, u32)> = None;
    for track in mp4.tracks().values() {
        match track.track_type() {
            Ok(TrackType::Video) => {
                if !matches!(track.media_type(), Ok(MediaType::H264)) {
                    return Err(MediaError::Codec("the video track is not H.264"));
                }
                if video.is_none() {
                    video = Some((u32::from(track.width()), u32::from(track.height())));
                }
            }
            Ok(TrackType::Audio) => {
                if !matches!(track.media_type(), Ok(MediaType::AAC)) {
                    return Err(MediaError::Codec("the audio track is not AAC"));
                }
            }
            _ => {
                return Err(MediaError::Codec(
                    "the file carries a track that is neither H.264 video nor AAC audio",
                ));
            }
        }
    }

    let Some((width, height)) = video else {
        return Err(MediaError::Codec("the file carries no video track"));
    };
    if width == 0 || height == 0 {
        return Err(MediaError::Undecodable);
    }

    Ok(Probe {
        width,
        height,
        duration_ms: u64::try_from(mp4.duration().as_millis()).unwrap_or(u64::MAX),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ftyp(major: &[u8; 4], compatible: &[&[u8; 4]]) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(major);
        body.extend_from_slice(&[0, 0, 0, 0]);
        for brand in compatible {
            body.extend_from_slice(brand.as_slice());
        }
        let mut out = Vec::new();
        out.extend_from_slice(&((body.len() + 8) as u32).to_be_bytes());
        out.extend_from_slice(b"ftyp");
        out.extend_from_slice(&body);
        out
    }

    /// An MP4 is recognized from its brand rather than from a name or a declared content type, and a container of another family wearing the same box grammar is not one.
    /// ´claim:media:an-mp4-is-recognized-by-its-brand´
    #[test]
    fn sniffing_reads_the_brand_not_the_claim() {
        assert!(sniff(&ftyp(b"isom", &[b"mp42"])));
        assert!(sniff(&ftyp(b"mp42", &[])));
        assert!(
            sniff(&ftyp(b"qt  ", &[b"isom"])),
            "a compatible brand counts, whatever the file leads with"
        );

        assert!(!sniff(&ftyp(b"qt  ", &[])), "QuickTime is not MP4");
        assert!(!sniff(&ftyp(b"avif", &[b"mif1"])), "nor is an AVIF still");
        assert!(!sniff(b"RIFF\x04\x00\x00\x00WEBP"));
        assert!(!sniff(b"GIF89a"));
        assert!(!sniff(b""));
    }

    /// Bytes that announce an MP4 brand but carry no parsable movie are refused rather than stored on the strength of their header.
    /// ´claim:media:an-mp4-header-is-not-a-movie´
    #[test]
    fn a_brand_without_a_movie_is_refused() {
        assert!(matches!(
            probe(&ftyp(b"isom", &[b"mp42"])),
            Err(MediaError::Malformed(_))
        ));
        assert!(matches!(probe(b""), Err(MediaError::Malformed(_))));
    }

    /// A real MP4, written with the same library that reads it, carrying
    /// one track of the given media configuration and one sample of the
    /// given length. Building the fixture through the writer is what
    /// makes it a container the reader genuinely accepts rather than a
    /// hand-laid guess at one.
    fn movie(media: mp4::MediaConfig, sample_ms: u32) -> Vec<u8> {
        let config = mp4::Mp4Config {
            major_brand: "isom".parse().expect("a brand"),
            minor_version: 512,
            compatible_brands: vec![
                "isom".parse().expect("a brand"),
                "iso2".parse().expect("a brand"),
                "avc1".parse().expect("a brand"),
                "mp41".parse().expect("a brand"),
            ],
            timescale: 1000,
        };
        let mut writer = mp4::Mp4Writer::write_start(Cursor::new(Vec::new()), &config)
            .expect("the writer starts");
        writer
            .add_track(&mp4::TrackConfig {
                track_type: match &media {
                    mp4::MediaConfig::AacConfig(_) => TrackType::Audio,
                    _ => TrackType::Video,
                },
                timescale: 1000,
                language: "und".into(),
                media_conf: media,
            })
            .expect("a track");
        writer
            .write_sample(
                1,
                &mp4::Mp4Sample {
                    start_time: 0,
                    duration: sample_ms,
                    rendering_offset: 0,
                    is_sync: true,
                    bytes: bytes::Bytes::from_static(&[0, 0, 0, 1]),
                },
            )
            .expect("a sample");
        writer.write_end().expect("the writer finishes");
        writer.into_writer().into_inner()
    }

    fn h264(width: u16, height: u16) -> mp4::MediaConfig {
        mp4::MediaConfig::AvcConfig(mp4::AvcConfig {
            width,
            height,
            seq_param_set: vec![0x67, 0x42, 0x00, 0x1E, 0x00],
            pic_param_set: vec![0x68, 0xCE, 0x3C, 0x80],
        })
    }

    /// An H.264 video is admitted and reports the size and the duration the container states.
    /// ´claim:media:an-h264-movie-is-admitted-with-its-duration´
    #[test]
    fn an_h264_movie_is_admitted_and_timed() {
        let probed = probe(&movie(h264(1920, 1080), 2_500)).expect("an H.264 movie");
        assert_eq!(probed.width, 1920);
        assert_eq!(probed.height, 1080);
        assert_eq!(
            probed.duration_ms, 2_500,
            "the duration is read, never capped"
        );
    }

    /// A container carrying any codec but H.264 video and AAC audio is refused, whatever its brand promised.
    /// ´claim:media:only-h264-and-aac-are-admitted´
    #[test]
    fn a_codec_outside_the_policy_is_refused() {
        let hevc = movie(
            mp4::MediaConfig::HevcConfig(mp4::HevcConfig {
                width: 1920,
                height: 1080,
            }),
            1_000,
        );
        assert!(
            matches!(probe(&hevc), Err(MediaError::Codec(_))),
            "H.265 is not the stored format"
        );

        let audio_only = movie(
            mp4::MediaConfig::AacConfig(mp4::AacConfig {
                bitrate: 128_000,
                profile: mp4::AudioObjectType::AacLowComplexity,
                freq_index: mp4::SampleFreqIndex::Freq48000,
                chan_conf: mp4::ChannelConfig::Stereo,
            }),
            1_000,
        );
        assert!(
            matches!(probe(&audio_only), Err(MediaError::Codec(_))),
            "sound alone is not a video"
        );
    }
}
