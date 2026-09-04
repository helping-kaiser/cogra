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
//! **Metadata is stripped on the device, and checked here.** The same
//! posture the picture path carries: the client removes what identifies
//! its author before uploading, and the server looks again rather than
//! trusting that it happened. A file that carries nothing passes through
//! byte for byte; one whose strip was faulty is repaired rather than
//! refused, because the author did nothing wrong and the video is still
//! the one they meant to publish. The repair is a container rewrite —
//! boxes dropped, offsets corrected — and never a re-encode.
//!
//! MP4 is an ISO base media container: a sequence of boxes, each a
//! 32-bit big-endian size and a four-character type, with `ftyp` first
//! declaring the brand the file conforms to. The probe reads the header
//! boxes alone (`Mp4Reader::read_header`, the `mp4` crate's documented
//! entry point) and decodes no samples: track codecs and the movie
//! duration both live in `moov`, so nothing here has to touch a frame.

use std::io::Cursor;

use mp4::{MediaType, Mp4Reader, TrackType};

use super::{MAX_PIXEL_DIMENSION, MediaError, Probe};

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

/// The boxes that carry what identifies an author, removed on the way in.
///
/// - `udta` is the user-data box, and it is where a phone writes the
///   location: QuickTime's `©xyz` (ISO 6709 coordinates) rides here, as
///   do capture dates and device strings.
/// - `meta` is the metadata box — the iTunes-style key/value store, and
///   the usual carrier for XMP packets and maker notes.
/// - `uuid` is the vendor-extension box. Its contents are by definition
///   not the specification's, and it is the box Adobe's XMP and the
///   action-camera telemetry formats claim.
///
/// The set is deliberately by box rather than by field: an unknown
/// vendor's `uuid` payload cannot be inspected for what it reveals, so
/// the box goes whole. Everything the specification defines as media —
/// `ftyp`, `moov`'s sample tables, `mdat` — is copied through untouched.
///
/// Sources: ISO/IEC 14496-12 (the ISO base media file format, `udta`,
/// `meta` and `uuid`) and the QuickTime File Format specification, whose
/// `©xyz` user-data atom is what a phone's location ends up in.
const META_BOXES: [&[u8; 4]; 3] = [b"udta", b"meta", b"uuid"];

/// Boxes that hold other boxes, and so have to be walked into rather
/// than copied whole. Everything else is a leaf as far as the strip is
/// concerned.
const CONTAINERS: [&[u8; 4]; 6] = [b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts"];

const CHUNK_OFFSET_32: &[u8; 4] = b"stco";
const CHUNK_OFFSET_64: &[u8; 4] = b"co64";

/// One box as it sits in the container.
#[derive(Debug, Clone, Copy)]
struct BoxRef {
    fourcc: [u8; 4],
    start: usize,
    /// The whole box, header included.
    len: usize,
    /// 8 ordinarily, 16 when the box declares a 64-bit `largesize`.
    header: usize,
}

/// Walks one run of sibling boxes, within its own declared bounds.
///
/// A box is a 32-bit big-endian size and a four-character type. A size
/// of 1 means the real size follows as a 64-bit `largesize`; a size of 0
/// means the box runs to the end of the file, which only the last box
/// may say. Sizes are read with checked arithmetic and nothing may
/// overrun its parent: the input is an upload, and an upload is hostile
/// until it has been proven otherwise.
fn boxes(bytes: &[u8], from: usize, to: usize) -> Result<Vec<BoxRef>, MediaError> {
    let mut out = Vec::new();
    let mut at = from;
    while at < to {
        let next = at
            .checked_add(8)
            .filter(|next| *next <= to)
            .ok_or(MediaError::Malformed("truncated box header"))?;
        let declared = bytes
            .get(at..at + 4)
            .and_then(|raw| <[u8; 4]>::try_from(raw).ok())
            .map(|raw| u32::from_be_bytes(raw) as usize)
            .ok_or(MediaError::Malformed("truncated box header"))?;
        let fourcc: [u8; 4] = bytes
            .get(at + 4..at + 8)
            .and_then(|raw| raw.try_into().ok())
            .ok_or(MediaError::Malformed("truncated box header"))?;

        let (len, header) = match declared {
            0 => (to - at, 8),
            1 => {
                let large = bytes
                    .get(next..next + 8)
                    .and_then(|raw| <[u8; 8]>::try_from(raw).ok())
                    .map(u64::from_be_bytes)
                    .ok_or(MediaError::Malformed("truncated large box header"))?;
                (
                    usize::try_from(large)
                        .map_err(|_| MediaError::Malformed("box larger than the file"))?,
                    16,
                )
            }
            size => (size, 8),
        };

        if len < header || at.checked_add(len).is_none_or(|end| end > to) {
            return Err(MediaError::Malformed("a box overruns its container"));
        }
        out.push(BoxRef {
            fourcc,
            start: at,
            len,
            header,
        });
        at += len;
    }
    Ok(out)
}

/// Every metadata box in the tree, as absolute ranges in the original
/// file. Containers are descended into; anything else is a leaf.
fn metadata_ranges(
    bytes: &[u8],
    from: usize,
    to: usize,
    out: &mut Vec<(usize, usize)>,
) -> Result<(), MediaError> {
    for item in boxes(bytes, from, to)? {
        if META_BOXES.contains(&&item.fourcc) {
            out.push((item.start, item.len));
        } else if CONTAINERS.contains(&&item.fourcc) {
            metadata_ranges(bytes, item.start + item.header, item.start + item.len, out)?;
        }
    }
    Ok(())
}

/// How many bytes the strip removes ahead of a position.
///
/// Chunk offsets are absolute from the start of the file, so a box
/// dropped before one moves it by exactly that box's length. Summing the
/// removals that lie ahead of an offset is the whole of the correction,
/// and it is correct whether the media sits before or after the boxes
/// that went.
fn shift_before(removals: &[(usize, usize)], position: u64) -> u64 {
    removals
        .iter()
        .filter(|(start, _)| (*start as u64) < position)
        .map(|(_, len)| *len as u64)
        .sum()
}

/// Whether the file carries anything the strip would remove.
///
/// Test-only: the production path calls [`strip_metadata`]
/// unconditionally, which makes the same check internally and returns
/// the file unchanged when there is nothing to remove. Exposing a
/// separate check half would invite a caller to ask twice and act on the
/// answer between the two.
#[cfg(test)]
fn carries_metadata(bytes: &[u8]) -> bool {
    let mut found = Vec::new();
    metadata_ranges(bytes, 0, bytes.len(), &mut found).is_ok() && !found.is_empty()
}

/// Rewrites the container without its metadata boxes.
///
/// **Clients strip on the device**, exactly as they do for pictures.
/// This is the check that makes that true rather than hoped for: a file
/// that carries nothing comes back byte for byte, and one whose strip was
/// faulty is repaired rather than refused — the author did nothing wrong
/// and their video is still the video they meant to publish.
///
/// The rewrite is not a re-mux. Media samples are copied through
/// untouched and nothing is re-encoded; what changes is that the
/// metadata boxes are gone, the containers that held them declare their
/// new sizes, and — the part that makes this surgery rather than
/// deletion — every chunk offset is corrected.
///
/// **Why the offsets have to move.** `stco` and `co64` address media by
/// absolute position from the start of the file. Dropping a box that sits
/// ahead of the media shifts all of it earlier, and a file whose offsets
/// were left alone still parses, still reports its duration, and plays
/// nothing but garbage. Each offset is therefore reduced by the bytes
/// removed ahead of it, which is why the removals are collected as
/// ranges rather than as a single total.
pub fn strip_metadata(bytes: &[u8]) -> Result<Vec<u8>, MediaError> {
    let mut removals = Vec::new();
    metadata_ranges(bytes, 0, bytes.len(), &mut removals)?;
    if removals.is_empty() {
        return Ok(bytes.to_vec());
    }
    removals.sort_unstable();

    let mut out = Vec::with_capacity(bytes.len());
    rewrite(bytes, 0, bytes.len(), &removals, &mut out)?;
    Ok(out)
}

/// Emits one run of sibling boxes without the removed ones, shrinking
/// the containers that held them and correcting the chunk offsets.
///
/// Every container is descended into once anything has been removed,
/// even one holding no removal itself: chunk offsets are absolute from
/// the start of the file, so a table in an otherwise untouched track
/// still has to move by what went from ahead of it. Skipping the
/// containers that looked unaffected is precisely the bug that leaves a
/// file parsing perfectly and playing garbage. Only a true leaf is
/// copied without being looked into.
fn rewrite(
    bytes: &[u8],
    from: usize,
    to: usize,
    removals: &[(usize, usize)],
    out: &mut Vec<u8>,
) -> Result<(), MediaError> {
    for item in boxes(bytes, from, to)? {
        if META_BOXES.contains(&&item.fourcc) {
            continue;
        }
        let offsets = &item.fourcc == CHUNK_OFFSET_32 || &item.fourcc == CHUNK_OFFSET_64;
        let container = CONTAINERS.contains(&&item.fourcc);

        if !container && !offsets {
            out.extend_from_slice(
                bytes
                    .get(item.start..item.start + item.len)
                    .ok_or(MediaError::Malformed("a box overruns its container"))?,
            );
            continue;
        }

        let inside: usize = removals
            .iter()
            .filter(|(start, _)| *start > item.start && *start < item.start + item.len)
            .map(|(_, len)| *len)
            .sum();
        write_header(&item, item.len - inside, out)?;
        if offsets {
            write_chunk_offsets(bytes, &item, removals, out)?;
        } else {
            rewrite(
                bytes,
                item.start + item.header,
                item.start + item.len,
                removals,
                out,
            )?;
        }
    }
    Ok(())
}

/// Re-emits a box's own header at its new size, keeping the width the
/// original declared so that nothing downstream of it moves by more than
/// the bytes actually removed.
fn write_header(item: &BoxRef, size: usize, out: &mut Vec<u8>) -> Result<(), MediaError> {
    if item.header == 16 {
        out.extend_from_slice(&1u32.to_be_bytes());
        out.extend_from_slice(&item.fourcc);
        out.extend_from_slice(&(size as u64).to_be_bytes());
        return Ok(());
    }
    let size =
        u32::try_from(size).map_err(|_| MediaError::Malformed("box larger than a header"))?;
    out.extend_from_slice(&size.to_be_bytes());
    out.extend_from_slice(&item.fourcc);
    Ok(())
}

/// Copies a chunk-offset table with every entry moved back by the bytes
/// the strip removed ahead of it.
fn write_chunk_offsets(
    bytes: &[u8],
    item: &BoxRef,
    removals: &[(usize, usize)],
    out: &mut Vec<u8>,
) -> Result<(), MediaError> {
    let wide = &item.fourcc == CHUNK_OFFSET_64;
    let width = if wide { 8 } else { 4 };
    let body = item.start + item.header;
    let head = bytes
        .get(body..body + 8)
        .ok_or(MediaError::Malformed("a truncated chunk offset table"))?;
    out.extend_from_slice(head);

    let count = u32::from_be_bytes(
        head.get(4..8)
            .and_then(|raw| <[u8; 4]>::try_from(raw).ok())
            .ok_or(MediaError::Malformed("a truncated chunk offset table"))?,
    ) as usize;
    let entries = body + 8;
    if entries + count * width > item.start + item.len {
        return Err(MediaError::Malformed(
            "a chunk offset table overruns its box",
        ));
    }

    for index in 0..count {
        let at = entries + index * width;
        let offset = if wide {
            u64::from_be_bytes(
                bytes
                    .get(at..at + 8)
                    .and_then(|raw| <[u8; 8]>::try_from(raw).ok())
                    .ok_or(MediaError::Malformed("a truncated chunk offset"))?,
            )
        } else {
            u64::from(u32::from_be_bytes(
                bytes
                    .get(at..at + 4)
                    .and_then(|raw| <[u8; 4]>::try_from(raw).ok())
                    .ok_or(MediaError::Malformed("a truncated chunk offset"))?,
            ))
        };
        let moved = offset.saturating_sub(shift_before(removals, offset));
        if wide {
            out.extend_from_slice(&moved.to_be_bytes());
        } else {
            let narrow = u32::try_from(moved)
                .map_err(|_| MediaError::Malformed("a chunk offset past its own table"))?;
            out.extend_from_slice(&narrow.to_be_bytes());
        }
    }
    Ok(())
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
        .as_chunks::<4>()
        .0
        .iter()
        .any(|brand| BRANDS.contains(&brand))
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
    if width > MAX_PIXEL_DIMENSION || height > MAX_PIXEL_DIMENSION {
        return Err(MediaError::Codec(
            "the video canvas is wider than the pipeline admits",
        ));
    }

    Ok(Probe {
        width,
        height,
        duration_ms: Some(u64::try_from(mp4.duration().as_millis()).unwrap_or(u64::MAX)),
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
            probed.duration_ms,
            Some(2_500),
            "the duration is read, never capped"
        );
    }

    /// A box carrying the given payload.
    fn boxed(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&((payload.len() + 8) as u32).to_be_bytes());
        out.extend_from_slice(fourcc);
        out.extend_from_slice(payload);
        out
    }

    /// The chunk offsets a file's `stco` table states, read back out of
    /// it — what a test has to inspect to know the media is still
    /// addressed correctly.
    fn chunk_offsets(bytes: &[u8]) -> Vec<u32> {
        fn walk(bytes: &[u8], from: usize, to: usize, out: &mut Vec<u32>) {
            for item in boxes(bytes, from, to).unwrap_or_default() {
                if &item.fourcc == CHUNK_OFFSET_32 {
                    let body = item.start + item.header;
                    let count = u32::from_be_bytes(
                        bytes
                            .get(body + 4..body + 8)
                            .and_then(|raw| <[u8; 4]>::try_from(raw).ok())
                            .unwrap_or_default(),
                    ) as usize;
                    for index in 0..count {
                        let at = body + 8 + index * 4;
                        out.push(u32::from_be_bytes(
                            bytes
                                .get(at..at + 4)
                                .and_then(|raw| <[u8; 4]>::try_from(raw).ok())
                                .unwrap_or_default(),
                        ));
                    }
                } else if CONTAINERS.contains(&&item.fourcc) {
                    walk(bytes, item.start + item.header, item.start + item.len, out);
                }
            }
        }
        let mut out = Vec::new();
        walk(bytes, 0, bytes.len(), &mut out);
        out
    }

    /// A file laid out the way a phone writes one: a `moov` whose
    /// sample table addresses media in an `mdat` that follows it, with
    /// the location box the strip exists to remove sitting in front of
    /// the media.
    ///
    /// The offsets are computed from the real layout, so they are
    /// correct before the strip and must stay correct after it.
    fn located_movie(with_metadata: bool) -> (Vec<u8>, Vec<u32>) {
        let udta = boxed(b"udta", &boxed(b"\xA9xyz", b"+52.5200+013.4050/"));
        let stbl_without = boxed(
            CHUNK_OFFSET_32,
            &[0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
        );
        let mut moov_body = Vec::new();
        if with_metadata {
            moov_body.extend_from_slice(&udta);
        }
        let stbl = boxed(b"stbl", &stbl_without);
        let minf = boxed(b"minf", &stbl);
        let mdia = boxed(b"mdia", &minf);
        let trak = boxed(b"trak", &mdia);
        moov_body.extend_from_slice(&trak);
        let moov = boxed(b"moov", &moov_body);
        let ftyp = boxed(b"ftyp", b"isommp41");

        let mdat_body = b"first-chunk second-chunk";
        let mdat_start = ftyp.len() + moov.len();
        let offsets = vec![
            (mdat_start + 8) as u32,
            (mdat_start + 8 + b"first-chunk ".len()) as u32,
        ];

        let mut table = vec![0u8, 0, 0, 0, 0, 0, 0, 2];
        for offset in &offsets {
            table.extend_from_slice(&offset.to_be_bytes());
        }
        let stbl = boxed(b"stbl", &boxed(CHUNK_OFFSET_32, &table));
        let minf = boxed(b"minf", &stbl);
        let mdia = boxed(b"mdia", &minf);
        let trak = boxed(b"trak", &mdia);
        let mut moov_body = Vec::new();
        if with_metadata {
            moov_body.extend_from_slice(&udta);
        }
        moov_body.extend_from_slice(&trak);
        let moov = boxed(b"moov", &moov_body);

        let mut file = Vec::new();
        file.extend_from_slice(&ftyp);
        file.extend_from_slice(&moov);
        file.extend_from_slice(&boxed(b"mdat", mdat_body));
        (file, offsets)
    }

    /// A file already stripped on the device comes back exactly as it arrived, the check finding nothing to repair.
    /// ´claim:media:a-clean-video-is-stored-unchanged´
    #[test]
    fn a_file_with_nothing_to_strip_is_byte_stable() {
        let (clean, offsets) = located_movie(false);
        assert!(!carries_metadata(&clean), "nothing to repair");
        let stripped = strip_metadata(&clean).expect("a valid container");
        assert_eq!(stripped, clean, "a clean file is not rewritten at all");
        assert_eq!(chunk_offsets(&stripped), offsets);
    }

    /// A faulty client strip is repaired: the location box goes, and every chunk offset moves back by what was removed ahead of it so the media stays addressed.
    /// ´claim:media:a-repaired-video-keeps-its-media-addressed´
    #[test]
    fn stripping_removes_the_location_and_moves_the_offsets() {
        let (dirty, _) = located_movie(true);
        let (clean, _) = located_movie(false);
        assert!(carries_metadata(&dirty), "the check sees the faulty strip");

        let stripped = strip_metadata(&dirty).expect("a valid container");
        assert!(
            !stripped.windows(4).any(|w| w == b"udta"),
            "the user-data box is gone"
        );
        assert!(
            !stripped.windows(18).any(|w| w == b"+52.5200+013.4050/"),
            "and the coordinates with it"
        );
        assert!(!carries_metadata(&stripped), "the repair is complete");

        assert_eq!(
            stripped, clean,
            "a repaired file is the file the client should have sent"
        );

        let moved = chunk_offsets(&stripped);
        for offset in &moved {
            let at = *offset as usize;
            assert!(
                stripped.get(at..at + 5) == Some(b"first".as_slice())
                    || stripped.get(at..at + 6) == Some(b"second".as_slice()),
                "every offset still lands on the chunk it named"
            );
        }
    }

    /// Metadata sitting after the media is removed without moving anything, the offsets ahead of it being untouched by a box that follows them.
    /// ´claim:media:a-trailing-box-moves-no-offsets´
    #[test]
    fn metadata_after_the_media_leaves_the_offsets_alone() {
        let (clean, offsets) = located_movie(false);
        let mut trailing = clean.clone();
        trailing.extend_from_slice(&boxed(b"uuid", b"an XMP packet from some vendor"));

        assert!(carries_metadata(&trailing));
        let stripped = strip_metadata(&trailing).expect("a valid container");
        assert_eq!(stripped, clean, "only the trailing box goes");
        assert_eq!(
            chunk_offsets(&stripped),
            offsets,
            "a box behind the media moves none of it"
        );
    }

    /// A stripped file is still a movie: it parses, and reports the same tracks, size and duration it did before the repair.
    /// ´claim:media:a-repaired-video-still-parses´
    #[test]
    fn a_stripped_movie_still_reads_as_the_same_movie() {
        let original = movie(h264(1920, 1080), 2_500);
        let mut dirty = original.clone();
        dirty.extend_from_slice(&boxed(b"uuid", b"vendor telemetry"));

        let before = probe(&original).expect("the original probes");
        let after = probe(&strip_metadata(&dirty).expect("a valid container"))
            .expect("the repaired file probes");
        assert_eq!(before, after, "the same movie, minus what named its author");
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
