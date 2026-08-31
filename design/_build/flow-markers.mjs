// Flow-number stamps for the JSX-rendered boards (backlog item 22): after a
// screen renders, each marker locates an element in the markup and stamps
// data-flow="n" onto its opening tag — the number flows.json's edges reference
// as `via`, drawn as a badge by the shell. Annotation stays a canvas concern:
// the design-system components never carry flow ids.
//
// A marker is { n, find, tag, all? }: `find` is a substring inside (or right
// after the opening tag of) the target element, `tag` names the opening tag to
// walk back to, `all: true` stamps every occurrence (repeated per-post
// controls carry the same number on every instance — one edge covers them).
// A marker that matches nothing throws: markup drift breaks the build loudly
// instead of silently shedding a badge.

const nav = (base) => [
  { n: base, find: ">Feed</button>", tag: "button" },
  { n: base + 1, find: ">Explore</button>", tag: "button" },
  { n: base + 2, find: 'aria-label="New post"', tag: "button" },
  { n: base + 3, find: ">Wallet</button>", tag: "button" },
  { n: base + 4, find: ">Profile</button>", tag: "button" },
];

// The shared per-post anatomy; `at` maps slot -> number for the board.
const post = (at) => [
  { n: at.author, find: '<a href="/u/', tag: "a", all: true },
  { n: at.menu, find: 'aria-label="More on this post"', tag: "button", all: true },
  { n: at.media, find: "aspect-ratio:1.91 / 1", tag: "div" },
  { n: at.more, find: ">More</button>", tag: "button" },
  { n: at.topic, find: '<a href="/t/', tag: "a", all: true },
  { n: at.refs, find: ">· 1 reference<", tag: "span" },
  { n: at.stance, find: 'aria-label="Take a stance on this post"', tag: "button", all: true },
  { n: at.score, find: ">Post Score</span>", tag: "button", all: true },
  { n: at.comments, find: 'aria-label="3 comments"', tag: "button" },
];

const filter = { n: 1, find: 'aria-label="What your feed shows"', tag: "button" };
const guestBand = [
  { n: 2, find: ">Sign in or join</button>", tag: "button" },
  { n: 3, find: ">On Android? Download the app (APK)</span>", tag: "span" },
];
const secondComments = (n) => ({ n, find: 'aria-label="1 comment"', tag: "button" });

export const FLOW_MARKERS = {
  Main: [
    filter,
    ...guestBand,
    ...post({ author: 4, menu: 5, media: 6, more: 7, topic: 8, refs: 9, stance: 10, score: 11, comments: 12 }),
    secondComments(12),
    ...nav(13),
  ],
  FeedBare: [
    filter,
    ...guestBand,
    ...post({ author: 4, menu: 5, media: 6, more: 7, topic: 8, refs: 9, stance: 10, score: 11, comments: 12 }),
    secondComments(12),
    ...nav(13),
  ],
  ApplicantFeed: [
    filter,
    { n: 2, find: ">Resend the link</button>", tag: "button" },
    { n: 3, find: ">Create my key</button>", tag: "button" },
    ...post({ author: 4, menu: 5, media: 6, more: 7, topic: 8, refs: 9, stance: 10, score: 11, comments: 12 }),
    ...nav(13),
  ],
  ApplicantWaiting: [
    ...post({ author: 1, menu: 2, media: 3, more: 4, topic: 5, refs: 6, stance: 7, score: 8, comments: 9 }),
    secondComments(9),
    ...nav(10),
  ],
  VouchBack: [
    filter,
    { n: 2, find: ">Not now</button>", tag: "button" },
    { n: 3, find: ">Vouch back</button>", tag: "button" },
    ...post({ author: 4, menu: 5, media: 6, more: 7, topic: 8, refs: 9, stance: 10, score: 11, comments: 12 }),
    ...nav(13),
  ],
  VouchBackPad: [
    { n: 1, find: 'aria-label="How stances work"', tag: "button" },
    { n: 2, find: 'aria-label="Stance', tag: "div" },
    { n: 2, find: ">Choose your stance</button>", tag: "button" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
  ],
  KeyElsewhere: [
    filter,
    { n: 2, find: ">Restore the key</button>", tag: "button" },
    ...post({ author: 3, menu: 4, media: 5, more: 6, topic: 7, refs: 8, stance: 9, score: 10, comments: 11 }).filter(
      (m) => m.find !== 'aria-label="Take a stance on this post"'
    ),
    { n: 9, find: 'aria-label="Your stance on this post', tag: "button" },
    { n: 9, find: ">Choose your stance</button>", tag: "button" },
    ...nav(12),
  ],
};

// The Money & Wallet page. PageHeader/WizardHeader backs render as <a href>;
// nav ports the shared helper (the active tab's edge is `self` in flows.json).
Object.assign(FLOW_MARKERS, {
  Wallet: [
    { n: 1, find: 'aria-label="What is CGT?"', tag: "button" },
    { n: 2, find: "Payouts land at", tag: "button" },
    { n: 3, find: 'aria-label="Settlement', tag: "button", all: true },
    { n: 4, find: "1 open · start a new one", tag: "button" },
    { n: 5, find: "Payout · settling", tag: "button" },
    { n: 6, find: "Campaign settled", tag: "button" },
    { n: 7, find: "Campaign return ·", tag: "button" },
    { n: 8, find: "Tip from @tobias", tag: "button" },
    ...nav(9),
  ],
  WalletEmpty: [
    { n: 1, find: 'aria-label="What is CGT?"', tag: "button" },
    { n: 2, find: 'aria-label="Copy the address"', tag: "button" },
    { n: 3, find: ">Change</button>", tag: "button" },
    ...nav(4),
  ],
  WalletSetup: [
    { n: 1, find: 'aria-label="Your wallet key"', tag: "button" },
    { n: 2, find: ">Create and publish</button>", tag: "button" },
    ...nav(3),
  ],
  WalletAddressSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave"', tag: "button" },
    { n: 3, find: 'aria-label="Signed actions"', tag: "button" },
    { n: 4, find: 'aria-label="Copy the address"', tag: "button" },
    { n: 5, find: ">Sign and publish</button>", tag: "button" },
    { n: 6, find: ">Back</button>", tag: "button" },
  ],
  WalletChange: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Signed actions"', tag: "button" },
    { n: 4, find: 'aria-label="Copy the address"', tag: "button" },
    { n: 5, find: ">Sign the change</button>", tag: "button" },
    { n: 6, find: ">Back</button>", tag: "button" },
  ],
  WalletKeyAbsent: [
    { n: 1, find: ">Restore the key</button>", tag: "button" },
    { n: 2, find: 'aria-label="What is CGT?"', tag: "button" },
    { n: 3, find: "Campaign settled", tag: "button" },
    { n: 4, find: "Tip from @tobias", tag: "button" },
    ...nav(5),
  ],
  WalletGuest: [
    { n: 1, find: ">Keep browsing</button>", tag: "button" },
    { n: 2, find: ">Sign in or join</button>", tag: "button" },
    ...nav(3),
  ],
  WalletApplicant: [...nav(1)],
  WalletCampaign: [
    { n: 1, find: 'aria-label="Back to the wallet"', tag: "a" },
    { n: 2, find: "Campaign deposit", tag: "button" },
  ],
  WalletCampaigns: [
    { n: 1, find: 'aria-label="Back to the wallet"', tag: "a" },
    { n: 2, find: ">Start a campaign</button>", tag: "button" },
    { n: 3, find: ">Yours</button>", tag: "button" },
    { n: 4, find: ">You took part</button>", tag: "button" },
    { n: 5, find: "In escrow · runs 6 more days", tag: "button" },
    { n: 6, find: "Settled 28 Aug", tag: "button" },
    { n: 6, find: "Settled 12 Jul", tag: "button" },
  ],
});

export function applyFlowMarkers(name, html) {
  const markers = FLOW_MARKERS[name];
  if (!markers) return html;
  for (const { n, find, tag, all } of markers) {
    let from = 0;
    let hits = 0;
    for (;;) {
      const at = html.indexOf(find, from);
      if (at === -1) break;
      const tagStart = html.lastIndexOf(`<${tag}`, at);
      if (tagStart === -1) throw new Error(`${name}: no <${tag}> before marker ${n} (${find})`);
      const stamped = html.slice(tagStart).replace(new RegExp(`^<(${tag})(?=[\\s>])`), `<$1 data-flow="${n}"`);
      if (stamped === html.slice(tagStart)) throw new Error(`${name}: marker ${n} failed to stamp <${tag}>`);
      html = html.slice(0, tagStart) + stamped;
      from = at + find.length + 16;
      hits += 1;
      if (!all) break;
    }
    if (hits === 0) throw new Error(`${name}: marker ${n} (${find}) matched nothing — markup drifted`);
  }
  return html;
}
