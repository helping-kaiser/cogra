// Stand-in content for the session. Not from the product — the source ships no
// fixtures — but written in the product's voice, and every photograph is a real
// one from assets/photos at its true ratio.

const bundleOf = (pd, pi, records, rawPd, rawPi) => ({
  current: { pDirected: pd, pInterest: pi },
  rawSum: { pDirected: rawPd ?? pd, pInterest: rawPi ?? pi },
  records,
  severance: { records },
});

const PHOTOS = "../../assets/photos/";

const POSTS = [
  {
    id: "p1",
    author: { handle: "ada", displayName: "Ada Okonkwo" },
    title: "The long way home",
    description: "Took the coast road instead of the tunnel. Four hours longer, worth every minute.",
    content:
      "The light does something at the third headland that I have never managed to photograph properly, and I have tried maybe a dozen times now. This is the closest I have come.",
    timestamp: "2h",
    score: "15.20",
    comments: 3,
    media: [{ src: PHOTOS + "03-landscape-16x9.jpg", ratio: "wide", alt: "A coast road curving around a headland at low sun." }],
    stance: bundleOf(0.55, 0.2, 4, 0.9, 0.3),
  },
  {
    id: "p2",
    author: { handle: "tobias", displayName: "Tobias Lindqvist" },
    content:
      "Spent the morning re-reading the routing notes from March. Half of what we argued about turned out to be the same disagreement wearing two different words.",
    timestamp: "5h",
    score: "8.40",
    comments: 1,
    stance: bundleOf(0, 0, 0),
  },
  {
    id: "p3",
    author: { handle: "mira", displayName: "Mira Halvorsen" },
    title: "Sunday, eventually",
    description: "Nobody in this house is in a hurry.",
    content: "The dog least of all. He has moved twice since breakfast, both times about a foot, both times to stay in the sun.",
    timestamp: "9h",
    score: "-2.10",
    comments: 0,
    edited: true,
    media: [
      { src: PHOTOS + "05-portrait-4x5.jpg", ratio: "tall", alt: "A dog asleep in a patch of sun on a wooden floor." },
      { src: PHOTOS + "10-square-1x1.jpg", ratio: "square" },
      { src: PHOTOS + "04-square-1x1.jpg", ratio: "square" },
      { src: PHOTOS + "09-landscape-4x3.jpg", ratio: "wide" },
    ],
    stance: bundleOf(-0.4, 0.3, 2),
  },
  {
    id: "p4",
    author: { handle: "juno", displayName: "Juno Baptiste" },
    content: "Signed this one twice by accident. Leaving both up — the second one says it better and I would rather show the work.",
    timestamp: "just now",
    pending: true,
    score: "3.05",
    comments: 0,
    stance: bundleOf(0.2, 0.1, 1),
  },
];

const COMMENTS = {
  p1: [
    {
      id: "c1",
      author: { handle: "mira", displayName: "Mira Halvorsen" },
      content: "The third headland is the one with the cattle grid, right? I have never got it either.",
      timestamp: "1h",
      stance: bundleOf(0.4, 0.2, 2),
      replies: [
        {
          id: "c1r1",
          author: { handle: "ada", displayName: "Ada Okonkwo" },
          content: "That one. The light is gone by the time you have parked.",
          timestamp: "48m",
          stance: bundleOf(0, 0, 0),
        },
      ],
    },
    {
      id: "c2",
      author: { handle: "tobias", displayName: "Tobias Lindqvist" },
      content: "Four hours is not a detour, it is a decision.",
      timestamp: "40m",
      edited: true,
      stance: bundleOf(0.75, 0.55, 3),
    },
    {
      id: "c3",
      author: { handle: "juno", displayName: "Juno Baptiste" },
      content: "Signed a minute ago, so this may sit out of order for a bit.",
      timestamp: "just now",
      pending: true,
      stance: bundleOf(0, 0, 0),
    },
  ],
  p2: [
    {
      id: "c4",
      author: { handle: "ada", displayName: "Ada Okonkwo" },
      content: "Say more about which half.",
      timestamp: "3h",
      stance: bundleOf(0.1, 0.1, 1),
    },
  ],
  p3: [],
  p4: [],
};

Object.assign(window, { POSTS, COMMENTS, bundleOf });
