# Photos · `guide:design:photo-assets`

**Mock material, not brand assets.** Ten real photographs at true aspect
ratios, so media layouts can be judged at real ratios instead of grey
boxes. From the Lorem Picsum archive (picsum.photos, the Unsplash photo
corpus, free to use); reproducible as
`https://picsum.photos/id/<id>/<w>/<h>` with ids 1080, 292, 1011, 312,
823, 64, 433, 447, 365, 674 in file order.

| File | Ratio | Pixels | Subject |
|---|---|---|---|
| 01-landscape-4x3.jpg | 4:3 | 1600×1200 | strawberries at a market |
| 02-landscape-3x2.jpg | 3:2 | 1620×1080 | vegetables on a cutting board |
| 03-landscape-16x9.jpg | 16:9 | 1600×900 | canoeing on a mountain lake |
| 04-square-1x1.jpg | 1:1 | 1200×1200 | honey jar close-up |
| 05-portrait-4x5.jpg | 4:5 | 1080×1350 | person with a film camera |
| 06-portrait-3x4.jpg | 3:4 | 1200×1600 | sunlit portrait with flowers |
| 07-portrait-2x3.jpg | 2:3 | 1080×1620 | brown bear close-up |
| 08-portrait-9x16.jpg | 9:16 | 900×1600 | man at a lakeside — the crop stress case |
| 09-landscape-4x3.jpg | 4:3 | 1600×1200 | tea and journal on a bed |
| 10-square-1x1.jpg | 1:1 | 1200×1200 | hands holding grapes |

**The register they set:** food, people, animals, scenery — the
everyday-post register, warm and human (`design.md` §1). Not brand stock,
not illustration, no grain filter, no duotone.

**Portrait caps at 4:5.** The 3:4, 2:3, and 9:16 files are here to be
cropped: `MediaAttachment` never renders taller than 4:5. Use
`08-portrait-9x16.jpg` when you need to prove the crop holds — a
picture is fitted inside the cap, a clip centre-crops to it, and the
9:16 frame is whole again only on the stream and in the viewer, where
downsampled copies of this file and of `03-landscape-16x9.jpg` stand in
for the clips (`designs/canonical/img/clip-lakeside.jpg`,
`clip-canoe.jpg`).
