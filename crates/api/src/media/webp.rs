//! ´mod:module:webp´
//!
//! The one stored format's reader: recognize it from the bytes, strip the
//! metadata that identifies its author, and refuse anything that does not
//! decode.
//!
//! WebP is a RIFF container (the WebP Container Specification, Google):
//! `'RIFF'`, a little-endian size, `'WEBP'`, then a sequence of chunks,
//! each a four-character code, a little-endian payload size, the payload,
//! and a pad byte when that size is odd. Personal data rides two of those
//! chunks — `EXIF` (GPS coordinates, camera serial, capture time) and
//! `XMP ` — and reads here are public and unauthenticated, so publishing
//! a phone photo untouched publishes where it was taken.
//!
//! The strip is a container rewrite rather than a re-encode: the pixel
//! chunks are copied through byte for byte, so nothing is recompressed
//! and no quality is lost, and the `VP8X` flags that advertise the
//! dropped chunks are cleared with them. `ICCP` is kept — a colour
//! profile is a rendering parameter, not a fact about the author, and
//! dropping it makes wide-gamut photographs render wrong.
//!
//! Everything here treats its input as hostile: sizes are read with
//! checked arithmetic, no chunk may reach past the container, trailing
//! bytes beyond the declared RIFF size are dropped rather than carried
//! (a file with a payload appended past its own end is a polyglot, not
//! an image), and the decode probe runs under explicit memory limits.

use std::io::Cursor;

use image::{ImageFormat, ImageReader, Limits};

use super::{MAX_PIXEL_DIMENSION, MediaError, Probe};

/// The single stored format (the media rulings, D9): clients re-encode on
/// device, so the server accepts one thing and knows exactly what it is.
pub const MIME: &str = "image/webp";

const RIFF: &[u8; 4] = b"RIFF";
const WEBP: &[u8; 4] = b"WEBP";
const CHUNK_VP8X: &[u8; 4] = b"VP8X";
const CHUNK_EXIF: &[u8; 4] = b"EXIF";
const CHUNK_XMP: &[u8; 4] = b"XMP ";
const CHUNK_ANMF: &[u8; 4] = b"ANMF";

/// The chunks the container specification defines and this reader
/// carries through. Everything else is refused rather than copied.
///
/// A deny-list would let any invented four-character code ride into
/// public storage under an image content type, bounded only by the still
/// cap — the same channel `video.rs` closes by taking an unknown
/// vendor's `uuid` box whole, and RIFF's vendor-extension surface is
/// every unrecognized code. `EXIF` and `XMP ` are recognized and
/// deliberately dropped; a code in neither list is not a WebP chunk.
const KEPT_CHUNKS: [&[u8; 4]; 7] = [
    b"VP8 ", b"VP8L", b"VP8X", b"ALPH", b"ANIM", b"ANMF", b"ICCP",
];

/// The `VP8X` flag byte's EXIF, XMP and animation bits. The container
/// specification draws the byte MSB-first as `Rsv Rsv I L E X A R`, so
/// ICC is 0x20, alpha 0x10, EXIF 0x08, XMP 0x04, animation 0x02. Only
/// the two that advertise dropped chunks are cleared; the animation bit
/// describes pixel data that stays, and is what makes a frame chunk
/// meaningful.
const FLAG_EXIF: u8 = 0x08;
const FLAG_XMP: u8 = 0x04;
const FLAG_ANIMATION: u8 = 0x02;

const HEADER_LEN: usize = 12;
const CHUNK_HEADER_LEN: usize = 8;

/// Whether the bytes are a WebP container, read from the bytes alone.
/// The client's declared content type is a claim about the file, never
/// evidence about it.
pub fn sniff(bytes: &[u8]) -> bool {
    bytes.len() >= HEADER_LEN
        && bytes.get(..4) == Some(RIFF.as_slice())
        && bytes.get(8..12) == Some(WEBP.as_slice())
}

fn le_u32(bytes: &[u8], at: usize) -> Option<usize> {
    let raw: [u8; 4] = bytes.get(at..at + 4)?.try_into().ok()?;
    Some(u32::from_le_bytes(raw) as usize)
}

/// One chunk as it sits in the container.
struct Chunk<'a> {
    fourcc: [u8; 4],
    payload: &'a [u8],
}

/// Walks the container's chunks within its own declared bounds.
///
/// The declared RIFF size, not the buffer length, is the end of the
/// image: bytes past it were never part of the picture, and copying them
/// forward would carry an attacker's payload into public storage under an
/// image's content type.
fn chunks(bytes: &[u8]) -> Result<Vec<Chunk<'_>>, MediaError> {
    if !sniff(bytes) {
        return Err(MediaError::Unsupported);
    }
    let declared = le_u32(bytes, 4).ok_or(MediaError::Malformed("truncated RIFF header"))?;
    let end = declared
        .checked_add(CHUNK_HEADER_LEN)
        .filter(|end| *end <= bytes.len() && *end >= HEADER_LEN)
        .ok_or(MediaError::Malformed("RIFF size overruns the file"))?;

    let mut chunks = Vec::new();
    let mut at = HEADER_LEN;
    while at < end {
        let next = at
            .checked_add(CHUNK_HEADER_LEN)
            .filter(|next| *next <= end)
            .ok_or(MediaError::Malformed("truncated chunk header"))?;
        let fourcc: [u8; 4] = bytes
            .get(at..at + 4)
            .and_then(|slice| slice.try_into().ok())
            .ok_or(MediaError::Malformed("truncated chunk header"))?;
        let size = le_u32(bytes, at + 4).ok_or(MediaError::Malformed("truncated chunk header"))?;
        let payload_end = next
            .checked_add(size)
            .filter(|payload_end| *payload_end <= end)
            .ok_or(MediaError::Malformed("chunk overruns the container"))?;
        let payload = bytes
            .get(next..payload_end)
            .ok_or(MediaError::Malformed("chunk overruns the container"))?;
        chunks.push(Chunk { fourcc, payload });
        at = payload_end
            .checked_add(size % 2)
            .ok_or(MediaError::Malformed(
                "chunk padding overruns the container",
            ))?;
    }
    if chunks.is_empty() {
        return Err(MediaError::Malformed("no image data"));
    }
    Ok(chunks)
}

/// Rewrites the container without its metadata chunks.
///
/// An animation is rewritten exactly as a single frame is: the animation
/// chunks are pixel data and travel through untouched, and only the
/// chunks that identify the author are dropped. GIF never reaches this
/// function — it is not a WebP container, so the sniff refuses it, and
/// clients convert to animated WebP on device rather than the server
/// growing an encoder to do it for them.
pub fn strip_metadata(bytes: &[u8]) -> Result<Vec<u8>, MediaError> {
    let chunks = chunks(bytes)?;

    let mut out = Vec::with_capacity(bytes.len());
    out.extend_from_slice(RIFF);
    out.extend_from_slice(&[0, 0, 0, 0]);
    out.extend_from_slice(WEBP);

    for chunk in &chunks {
        if &chunk.fourcc == CHUNK_EXIF || &chunk.fourcc == CHUNK_XMP {
            continue;
        }
        if !KEPT_CHUNKS.contains(&&chunk.fourcc) {
            return Err(MediaError::Malformed(
                "a chunk the container specification does not define",
            ));
        }
        out.extend_from_slice(&chunk.fourcc);
        let size = u32::try_from(chunk.payload.len())
            .map_err(|_| MediaError::Malformed("chunk larger than the container allows"))?;
        out.extend_from_slice(&size.to_le_bytes());
        let start = out.len();
        out.extend_from_slice(chunk.payload);
        if &chunk.fourcc == CHUNK_VP8X
            && let Some(flags) = out.get_mut(start)
        {
            *flags &= !(FLAG_EXIF | FLAG_XMP);
        }
        if chunk.payload.len() % 2 == 1 {
            out.push(0);
        }
    }

    let declared = u32::try_from(out.len() - CHUNK_HEADER_LEN)
        .map_err(|_| MediaError::Malformed("stripped image larger than a RIFF container"))?;
    if let Some(size) = out.get_mut(4..8) {
        size.copy_from_slice(&declared.to_le_bytes());
    }
    Ok(out)
}

/// The animation's length, summed over its frames.
///
/// Each `ANMF` chunk states its own frame duration — a 24-bit
/// little-endian millisecond count at offset 12 of the payload, after the
/// frame's x, y, width and height (the WebP Container Specification,
/// "Animation"). The total is their sum, which is what a reader sees one
/// loop take.
///
/// Two things are refused rather than substituted, because the duration
/// is a *declared* number this function sums out of untrusted bytes
/// rather than a property of realized samples. A frame chunk too short
/// to carry its own duration is malformed, like every other truncation
/// in this file — reading it as zero would let a broken file state a
/// duration it never declared. And a frame chunk in a file whose `VP8X`
/// does not set the animation bit is not a frame: without that check,
/// junk `ANMF` chunks beside a one-pixel `VP8L` fabricate a duration for
/// a still.
///
/// `None` when the file carries no frame chunks at all, which is the
/// single-frame case: a still has no duration to state, and `durationMs`
/// reads null for it.
fn animation_duration_ms(chunks: &[Chunk<'_>]) -> Result<Option<u64>, MediaError> {
    let animated = chunks.iter().any(|chunk| {
        &chunk.fourcc == CHUNK_VP8X
            && chunk
                .payload
                .first()
                .is_some_and(|flags| flags & FLAG_ANIMATION != 0)
    });

    let mut total: u64 = 0;
    let mut frames = 0usize;
    for frame in chunks.iter().filter(|chunk| &chunk.fourcc == CHUNK_ANMF) {
        if !animated {
            return Err(MediaError::Malformed(
                "a frame chunk in a file that declares no animation",
            ));
        }
        let raw = frame
            .payload
            .get(12..15)
            .ok_or(MediaError::Malformed("a truncated animation frame"))?;
        total += u64::from(raw[0]) | u64::from(raw[1]) << 8 | u64::from(raw[2]) << 16;
        frames += 1;
    }
    Ok((frames > 0).then_some(total))
}

/// The refusal gate: bytes that do not decode as the format they claim to
/// be are not an image, whatever their header says. The dimensions come
/// out of the same pass, so the derived aspect ratio describes the pixels
/// that were actually there rather than a number read out of a header.
///
/// The limits are explicit because the decoder's own default allows a
/// 512 MiB allocation, which a small file can ask for — a compressed
/// image declares its canvas, and the buffer is the canvas, not the file.
/// At the 4096-pixel cap the worst case is a square RGBA canvas of
/// 4096 × 4096 × 4 = 64 MiB, so 96 MiB leaves the decoder scratch space
/// without leaving room for a bomb.
pub fn probe(bytes: &[u8]) -> Result<Probe, MediaError> {
    let duration_ms = animation_duration_ms(&chunks(bytes)?)?;
    let mut reader = ImageReader::with_format(Cursor::new(bytes), ImageFormat::WebP);
    let mut limits = Limits::no_limits();
    limits.max_image_width = Some(MAX_PIXEL_DIMENSION);
    limits.max_image_height = Some(MAX_PIXEL_DIMENSION);
    limits.max_alloc = Some(96 * 1024 * 1024);
    reader.limits(limits);

    let decoded = reader.decode().map_err(|_| MediaError::Undecodable)?;
    let (width, height) = (decoded.width(), decoded.height());
    if width == 0 || height == 0 {
        return Err(MediaError::Undecodable);
    }
    Ok(Probe {
        width,
        height,
        duration_ms,
    })
}

/// One RIFF chunk, padded when its payload length is odd.
///
/// Test-only, and shared with the pipeline's own tests one module up:
/// four copies of this eight-line builder is four places a fixture can
/// stop describing the same container.
#[cfg(test)]
pub(super) fn chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(fourcc);
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
        out.push(0);
    }
    out
}

/// A WebP container around a chunk sequence.
#[cfg(test)]
pub(super) fn container(body: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(RIFF);
    out.extend_from_slice(&((4 + body.len()) as u32).to_le_bytes());
    out.extend_from_slice(WEBP);
    out.extend_from_slice(body);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal lossless WebP: the smallest thing the decoder accepts,
    /// built here rather than checked in so the fixtures stay readable.
    /// The VP8L payload is a 1×1 opaque pixel.
    fn one_pixel_vp8l() -> Vec<u8> {
        let payload: [u8; 8] = [0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08];
        let mut out = Vec::new();
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&((12 + payload.len()) as u32).to_le_bytes());
        out.extend_from_slice(b"WEBP");
        out.extend_from_slice(b"VP8L");
        out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        out.extend_from_slice(&payload);
        out
    }

    /// An extended-format file whose flags advertise EXIF and XMP, with
    /// both chunks present — the shape a phone camera produces.
    fn extended_with_metadata() -> Vec<u8> {
        let mut vp8x = vec![FLAG_EXIF | FLAG_XMP | 0x20, 0, 0, 0];
        vp8x.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
        let mut body = chunk(CHUNK_VP8X, &vp8x);
        body.extend_from_slice(&chunk(b"ICCP", b"colour-profile"));
        body.extend_from_slice(&chunk(
            b"VP8L",
            &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08],
        ));
        body.extend_from_slice(&chunk(CHUNK_EXIF, b"GPS 52.5200 N 13.4050 E"));
        body.extend_from_slice(&chunk(CHUNK_XMP, b"<x:xmpmeta>author</x:xmpmeta>"));
        container(&body)
    }

    /// (´claim:media:the-bytes-decide-the-type´)
    #[test]
    fn sniffing_reads_the_container_not_the_claim() {
        assert!(sniff(&one_pixel_vp8l()));
        assert!(!sniff(b"\x89PNG\r\n\x1a\n and then some"));
        assert!(!sniff(b"RIFF\x04\x00\x00\x00AVI "));
        assert!(!sniff(b"RIFF"));
        assert!(!sniff(b""));
    }

    /// Stripping removes the metadata chunks and clears the flags that announced them, leaving nothing to say they were there.
    /// ´claim:media:stripping-removes-the-chunks-and-their-flags´
    #[test]
    fn stripping_removes_the_metadata_chunks_and_their_flags() {
        let stripped = strip_metadata(&extended_with_metadata()).expect("a valid container");
        let windows: Vec<&[u8]> = stripped.windows(4).collect();
        assert!(!windows.contains(&CHUNK_EXIF.as_slice()));
        assert!(!windows.contains(&CHUNK_XMP.as_slice()));
        assert!(
            !stripped
                .windows(23)
                .any(|w| w == b"GPS 52.5200 N 13.4050 E")
        );

        let parsed = chunks(&stripped).expect("the rewrite is a valid container");
        let vp8x = parsed.first().expect("the VP8X chunk");
        assert_eq!(&vp8x.fourcc, CHUNK_VP8X);
        let flags = vp8x.payload.first().copied().expect("the flag byte");
        assert_eq!(flags & (FLAG_EXIF | FLAG_XMP), 0, "the flags go with them");
        assert_eq!(flags & 0x20, 0x20, "the colour profile stays advertised");
    }

    /// Stripping keeps the colour profile and every pixel, taking only what identifies the author.
    /// ´claim:media:stripping-keeps-the-picture´
    #[test]
    fn stripping_keeps_the_colour_profile_and_the_pixels() {
        let stripped = strip_metadata(&extended_with_metadata()).expect("a valid container");
        let parsed = chunks(&stripped).expect("a valid container");
        let kept: Vec<&[u8; 4]> = parsed.iter().map(|chunk| &chunk.fourcc).collect();
        assert_eq!(kept, vec![CHUNK_VP8X, b"ICCP", b"VP8L"]);
        assert_eq!(
            parsed.get(1).map(|chunk| chunk.payload),
            Some(b"colour-profile".as_slice())
        );
    }

    /// Stripping a file that carries no metadata still produces a valid
    /// container, and stripping twice is stripping once.
    ///
    /// Stripping a file with nothing to strip still yields a valid container, and stripping twice is stripping once.
    /// ´claim:media:stripping-is-idempotent-and-total´
    #[test]
    fn stripping_is_idempotent_and_total() {
        let clean = one_pixel_vp8l();
        let once = strip_metadata(&clean).expect("a valid container");
        let twice = strip_metadata(&once).expect("a valid container");
        assert_eq!(once, twice);
        assert!(sniff(&once));
    }

    /// Bytes appended past the declared RIFF size are not part of the
    /// image and must not reach public storage under its content type.
    ///
    /// Bytes appended past the declared container size are dropped, so nothing rides into public storage under the image content type.
    /// ´claim:media:nothing-rides-past-the-container´
    #[test]
    fn stripping_drops_a_payload_appended_past_the_container() {
        let mut polyglot = one_pixel_vp8l();
        let honest = polyglot.len();
        polyglot.extend_from_slice(b"#!/bin/sh\nrm -rf /\n");
        let stripped = strip_metadata(&polyglot).expect("a valid container");
        assert_eq!(stripped.len(), honest);
        assert!(!stripped.windows(9).any(|w| w == b"#!/bin/sh"));
    }

    /// A malformed container is refused rather than repaired into something servable.
    /// ´claim:media:a-malformed-container-is-refused´
    #[test]
    fn a_malformed_container_is_refused_not_repaired() {
        assert_eq!(
            strip_metadata(b"not an image"),
            Err(MediaError::Unsupported)
        );

        let mut truncated = one_pixel_vp8l();
        truncated.truncate(HEADER_LEN + 4);
        assert!(matches!(
            strip_metadata(&truncated),
            Err(MediaError::Malformed(_))
        ));

        let mut overrunning = one_pixel_vp8l();
        if let Some(size) = overrunning.get_mut(16..20) {
            size.copy_from_slice(&u32::MAX.to_le_bytes());
        }
        assert!(matches!(
            strip_metadata(&overrunning),
            Err(MediaError::Malformed(_))
        ));

        let empty = container(&[]);
        assert!(matches!(
            strip_metadata(&empty),
            Err(MediaError::Malformed(_))
        ));
    }

    /// A three-frame animation at the durations given, built to the
    /// container specification's `ANMF` layout: x, y, width-minus-one and
    /// height-minus-one as 24-bit little-endian triples, then the frame
    /// duration, then a flag byte, then the frame's own image chunk.
    fn animation(frame_durations: &[u32]) -> Vec<u8> {
        let mut vp8x = vec![FLAG_ANIMATION, 0, 0, 0];
        vp8x.extend_from_slice(&[0, 0, 0]);
        vp8x.extend_from_slice(&[0, 0, 0]);
        let mut body = chunk(CHUNK_VP8X, &vp8x);
        body.extend_from_slice(&chunk(b"ANIM", &[0, 0, 0, 0, 0, 0]));
        for duration in frame_durations {
            let mut frame = Vec::new();
            for triple in [0u32, 0, 0, 0, *duration] {
                frame.extend_from_slice(&triple.to_le_bytes()[..3]);
            }
            frame.push(0);
            frame.extend_from_slice(&chunk(
                b"VP8L",
                &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08],
            ));
            body.extend_from_slice(&chunk(CHUNK_ANMF, &frame));
        }
        container(&body)
    }

    /// An animation is carried through the strip rather than refused, its frame chunks being pixel data like any other.
    /// ´claim:media:an-animation-is-carried-not-refused´
    #[test]
    fn an_animation_survives_the_strip() {
        let stripped = strip_metadata(&animation(&[40, 40, 40])).expect("a valid container");
        let parsed = chunks(&stripped).expect("the rewrite is a valid container");
        let kept: Vec<&[u8; 4]> = parsed.iter().map(|chunk| &chunk.fourcc).collect();
        assert_eq!(
            kept,
            vec![CHUNK_VP8X, b"ANIM", CHUNK_ANMF, CHUNK_ANMF, CHUNK_ANMF]
        );
        let flags = parsed
            .first()
            .and_then(|vp8x| vp8x.payload.first().copied())
            .expect("the flag byte");
        assert_eq!(
            flags & FLAG_ANIMATION,
            FLAG_ANIMATION,
            "the animation bit describes pixels that stayed"
        );
    }

    /// An animation's duration is the sum of its frames' own durations, and a single frame states none at all.
    /// ´claim:media:an-animations-duration-is-its-frames´
    #[test]
    fn an_animations_duration_is_the_sum_of_its_frames() {
        let animated = animation(&[40, 60, 100]);
        let parsed = chunks(&animated).expect("a valid container");
        assert_eq!(animation_duration_ms(&parsed), Ok(Some(200)));

        let single = one_pixel_vp8l();
        let still = chunks(&single).expect("a valid container");
        assert_eq!(
            animation_duration_ms(&still),
            Ok(None),
            "a still has no duration to state"
        );
    }

    /// A frame chunk too short to carry its own duration is malformed
    /// like every other truncation here, and frame chunks beside a still
    /// that declares no animation cannot fabricate one for it.
    ///
    /// A duration is refused rather than substituted when the frames are truncated or the file declares no animation.
    /// ´claim:media:a-fabricated-duration-is-refused´
    #[test]
    fn a_fabricated_duration_is_refused() {
        let mut truncated = animation(&[40, 40]);
        let full = animation_duration_ms(&chunks(&truncated).expect("valid"));
        assert_eq!(full, Ok(Some(80)), "the honest file reads its own frames");

        // Shorten the first frame's payload to less than its own header.
        truncated = {
            let mut vp8x = vec![FLAG_ANIMATION, 0, 0, 0];
            vp8x.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
            let mut body = chunk(CHUNK_VP8X, &vp8x);
            body.extend_from_slice(&chunk(CHUNK_ANMF, &[0u8; 14]));
            container(&body)
        };
        assert!(matches!(
            animation_duration_ms(&chunks(&truncated).expect("valid container")),
            Err(MediaError::Malformed(_))
        ));

        let mut frame = Vec::new();
        for triple in [0u32, 0, 0, 0, 0xFF_FFFF] {
            frame.extend_from_slice(&triple.to_le_bytes()[..3]);
        }
        frame.push(0);
        let mut body = chunk(b"VP8L", &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08]);
        body.extend_from_slice(&chunk(CHUNK_ANMF, &frame));
        assert!(
            matches!(
                animation_duration_ms(&chunks(&container(&body)).expect("valid container")),
                Err(MediaError::Malformed(_))
            ),
            "a still cannot be given a duration by junk frame chunks"
        );
    }

    /// A four-character code the container specification does not define
    /// is refused rather than copied into public storage under an image
    /// content type.
    ///
    /// A chunk the container specification does not define is refused, not carried through.
    /// ´claim:media:an-unknown-chunk-is-refused´
    #[test]
    fn stripping_refuses_an_unrecognized_chunk() {
        let mut body = chunk(b"VP8L", &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08]);
        body.extend_from_slice(&chunk(b"EVIL", b"#!/bin/sh\nrm -rf /\n"));
        assert!(matches!(
            strip_metadata(&container(&body)),
            Err(MediaError::Malformed(_))
        ));
    }

    /// An odd-length kept chunk is padded on the way out, which no
    /// fixture in the crate exercised: every kept chunk was even and the
    /// only odd ones were dropped before the pad branch.
    ///
    /// A kept chunk of odd payload length is padded, and the rewrite re-parses to the same chunks.
    /// ´claim:media:an-odd-chunk-is-padded´
    #[test]
    fn an_odd_length_kept_chunk_is_padded() {
        let profile = b"odd-profile-abc";
        assert_eq!(profile.len() % 2, 1, "the fixture must be odd");
        let mut vp8x = vec![0x20, 0, 0, 0];
        vp8x.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
        let mut body = chunk(CHUNK_VP8X, &vp8x);
        body.extend_from_slice(&chunk(b"ICCP", profile));
        body.extend_from_slice(&chunk(
            b"VP8L",
            &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08],
        ));

        let once = strip_metadata(&container(&body)).expect("a valid container");
        assert_eq!(once.len() % 2, 0, "the pad byte lands");
        let parsed = chunks(&once).expect("the rewrite re-parses");
        let kept: Vec<&[u8; 4]> = parsed.iter().map(|chunk| &chunk.fourcc).collect();
        assert_eq!(kept, vec![CHUNK_VP8X, b"ICCP", b"VP8L"]);
        assert_eq!(
            parsed.get(1).map(|chunk| chunk.payload),
            Some(profile.as_slice()),
            "the odd payload survives its pad byte"
        );
        assert_eq!(
            strip_metadata(&once).expect("a valid container"),
            once,
            "stripping twice is stripping once"
        );
    }

    /// The walker advances past a final chunk whose pad byte is missing,
    /// and the rewrite supplies it — so such a file is normalised rather
    /// than refused, and the normalised form is then stable.
    ///
    /// A final chunk missing its pad byte is normalised, and the normalised file strips to itself.
    /// ´claim:media:an-unpadded-final-chunk-is-normalised´
    #[test]
    fn an_unpadded_final_chunk_is_normalised() {
        let profile = b"odd-profile-abc";
        let mut body = chunk(b"VP8L", &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08]);
        body.extend_from_slice(b"ICCP");
        body.extend_from_slice(&(profile.len() as u32).to_le_bytes());
        body.extend_from_slice(profile);

        let unpadded = container(&body);
        let once = strip_metadata(&unpadded).expect("a valid container");
        assert_ne!(once, unpadded, "the missing pad byte is supplied");
        assert_eq!(
            strip_metadata(&once).expect("a valid container"),
            once,
            "and the normalised form is then stable"
        );
    }

    /// Probing a real image reports the pixel dimensions it decodes to.
    /// ´claim:media:probing-reports-the-pixel-size´
    #[test]
    fn probing_accepts_a_real_image_and_reports_its_size() {
        assert_eq!(
            probe(&one_pixel_vp8l()),
            Ok(Probe {
                width: 1,
                height: 1,
                duration_ms: None,
            })
        );
    }

    /// A container that parses is not an image; only a decode says so.
    ///
    /// A container that parses is not yet an image: only a decode says so, and bytes that will not decode are refused.
    /// ´claim:media:only-a-decode-proves-an-image´
    #[test]
    fn probing_refuses_bytes_that_do_not_decode() {
        let body = chunk(b"VP8L", b"\x2f not a bitstream at all");
        assert_eq!(probe(&container(&body)), Err(MediaError::Undecodable));
    }
}
