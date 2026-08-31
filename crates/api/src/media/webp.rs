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

use super::{MAX_PIXEL_DIMENSION, MediaError};

/// The single stored format (the media rulings, D9): clients re-encode on
/// device, so the server accepts one thing and knows exactly what it is.
pub const MIME: &str = "image/webp";

const RIFF: &[u8; 4] = b"RIFF";
const WEBP: &[u8; 4] = b"WEBP";
const CHUNK_VP8X: &[u8; 4] = b"VP8X";
const CHUNK_EXIF: &[u8; 4] = b"EXIF";
const CHUNK_XMP: &[u8; 4] = b"XMP ";
const CHUNK_ANIM: &[u8; 4] = b"ANIM";

/// The `VP8X` flag byte's animation, EXIF, and XMP bits. The container
/// specification draws the byte MSB-first as `Rsv Rsv I L E X A R`, so
/// ICC is 0x20, alpha 0x10, EXIF 0x08, XMP 0x04, animation 0x02.
const FLAG_EXIF: u8 = 0x08;
const FLAG_XMP: u8 = 0x04;
const FLAG_ANIMATION: u8 = 0x02;

const HEADER_LEN: usize = 12;
const CHUNK_HEADER_LEN: usize = 8;

/// What the decode probe learned. Only the dimensions survive it — the
/// pixels are decoded to prove they decode, then dropped.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Probe {
    pub width: u32,
    pub height: u32,
}

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
        return Err(MediaError::NotWebp);
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
/// Animated images are refused here rather than stripped: an animation is
/// video wearing an image's content type, and the size cap, the feed's
/// playback rules, and the poster frame it needs are all the video
/// slice's, not this one's.
pub fn strip_metadata(bytes: &[u8]) -> Result<Vec<u8>, MediaError> {
    let chunks = chunks(bytes)?;

    let animated = chunks.iter().any(|chunk| {
        &chunk.fourcc == CHUNK_ANIM
            || (&chunk.fourcc == CHUNK_VP8X
                && chunk
                    .payload
                    .first()
                    .is_some_and(|f| f & FLAG_ANIMATION != 0))
    });
    if animated {
        return Err(MediaError::Animated);
    }

    let mut out = Vec::with_capacity(bytes.len());
    out.extend_from_slice(RIFF);
    out.extend_from_slice(&[0, 0, 0, 0]);
    out.extend_from_slice(WEBP);

    for chunk in &chunks {
        if &chunk.fourcc == CHUNK_EXIF || &chunk.fourcc == CHUNK_XMP {
            continue;
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
    Ok(Probe { width, height })
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

    fn chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(fourcc);
        out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        out.extend_from_slice(payload);
        if payload.len() % 2 == 1 {
            out.push(0);
        }
        out
    }

    fn container(body: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&((4 + body.len()) as u32).to_le_bytes());
        out.extend_from_slice(b"WEBP");
        out.extend_from_slice(body);
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
        assert_eq!(strip_metadata(b"not an image"), Err(MediaError::NotWebp));

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

    /// An animated image is refused, the accepted form being a single still frame.
    /// ´claim:media:an-animated-image-is-refused´
    #[test]
    fn an_animated_image_is_refused() {
        let vp8x = vec![FLAG_ANIMATION, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let mut body = chunk(CHUNK_VP8X, &vp8x);
        body.extend_from_slice(&chunk(CHUNK_ANIM, &[0, 0, 0, 0, 0, 0]));
        assert_eq!(strip_metadata(&container(&body)), Err(MediaError::Animated));
    }

    /// Probing a real image reports the pixel dimensions it decodes to.
    /// ´claim:media:probing-reports-the-pixel-size´
    #[test]
    fn probing_accepts_a_real_image_and_reports_its_size() {
        assert_eq!(
            probe(&one_pixel_vp8l()),
            Ok(Probe {
                width: 1,
                height: 1
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
