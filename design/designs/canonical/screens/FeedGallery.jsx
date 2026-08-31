/* The gallery post in the feed (media slice, 2026-08-31): four pictures, one
   crop shape (tall), one frame swiped — dots only, no count pill. The card's
   height is one frame's height however many pictures ride it; the cap is ten. */
const MIRA_GALLERY_POST = {
  author: MIRA,
  title: "Sunday at the tide market",
  content:
    "Everything the flats give up in one morning — the stand by the sea wall had honey from the headland hives again.",
  timestamp: "4h",
  media: [
    { src: "gallery-market.jpg", ratio: "tall", fit: "cover", alt: "Crates of strawberries on a market stand." },
    { src: "gallery-veg.jpg", ratio: "tall", fit: "cover", alt: "Vegetables laid out on a cutting board." },
    { src: "gallery-honey.jpg", ratio: "tall", fit: "cover", alt: "A jar of honey in low sun." },
    { src: "gallery-grapes.jpg", ratio: "tall", fit: "cover", alt: "Two hands holding a bunch of grapes." },
  ],
  topics: ["tidemarket", "coastroad"],
  score: "6.40",
  comments: 2,
  license: { attribution: 0, provenance: 0 },
  menuItems: CITE_MENU,
};

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...MIRA_GALLERY_POST} bundle={mkBundle(0.3, 0.15)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
