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

// The Feed & Search page. Signed-in post cards carry standings, so the stance
// anchor differs from the entry boards'; the hidden "Choose your stance"
// skip-link shares the stance number. Sheet boards are scanExempt — only the
// sheet layer (and its scrim, the tap-outside dismiss) is stamped.
const signedPost = (at) => [
  { n: at.author, find: '<a href="/u/', tag: "a", all: true },
  { n: at.menu, find: 'aria-label="More on this post"', tag: "button", all: true },
  { n: at.more, find: ">More</button>", tag: "button", all: true },
  { n: at.topic, find: '<a href="/t/', tag: "a", all: true },
  { n: at.stance, find: 'aria-label="Your stance on this post', tag: "button", all: true },
  { n: at.stance, find: ">Choose your stance</button>", tag: "button", all: true },
  { n: at.score, find: ">Post Score</span>", tag: "button", all: true },
];
const searchShell = (fieldText, nRow) => [
  { n: 1, find: fieldText, tag: "div" },
  { n: 2, find: 'aria-label="What the search shows"', tag: "button" },
  { n: 3, find: 'aria-label="How searching works"', tag: "button" },
  ...nav(nRow),
];

Object.assign(FLOW_MARKERS, {
  Explore: [
    { n: 1, find: "Search people, posts, topics", tag: "div" },
    { n: 2, find: ">Enter the Sky</button>", tag: "button" },
    { n: 3, find: ">@sol salt</span>", tag: "button" },
    { n: 3, find: ">#saltmaps</span>", tag: "button" },
    { n: 3, find: ">coast road</span>", tag: "button" },
    ...nav(4),
  ],
  ExploreSearch: [
    ...searchShell("@sol salt", 9),
    { n: 4, find: "Salt maps of the coast road", tag: "button" },
    { n: 4, find: "First try at a rubbing", tag: "button" },
    { n: 5, find: "Salt-crust rubbing, framed", tag: "button" },
    { n: 6, find: "The wax-stick ones read like weather charts", tag: "button" },
    { n: 7, find: "Crust held all the way past the slipway today.", tag: "button" },
    { n: 8, find: "An offer by @sol", tag: "button" },
  ],
  ExploreFilter: [
    { n: 1, find: 'aria-label="How the filter works"', tag: "button" },
    { n: 2, find: 'role="switch"', tag: "button", all: true },
    { n: 3, find: "aria-pressed=", tag: "button", all: true },
    { n: 4, find: "already seen", tag: "label" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ExploreNone: [...searchShell("brackish cartography", 4)],
  Feed: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(11),
  ],
  FeedSheet: [
    { n: 1, find: 'aria-label="How the filter works"', tag: "button" },
    { n: 2, find: 'role="switch"', tag: "button", all: true },
    { n: 3, find: "aria-pressed=", tag: "button", all: true },
    { n: 4, find: "already seen", tag: "label" },
    { n: 5, find: ">Reset</button>", tag: "button" },
    { n: 6, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  FeedNarrowed: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="2 comments"', tag: "button" },
    ...nav(11),
  ],
  FeedNothing: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    { n: 2, find: ">Show posts again</button>", tag: "button" },
    ...nav(3),
  ],
  FeedFar: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="2 comments"', tag: "button" },
    ...nav(11),
  ],
});

// The Comments page (JSX boards; the three hand boards carry their attributes
// directly). Sheet boards are scanExempt; badges stamped on under-scrim
// repeats sit dimmed beneath the wash, which reads correctly.
Object.assign(FLOW_MARKERS, {
  ReplyEntry: [
    { n: 1, find: '<a href="/u/', tag: "a", all: true },
    { n: 2, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 3, find: '<a href="/t/', tag: "a", all: true },
    { n: 4, find: 'aria-label="Your stance on this comment', tag: "button", all: true },
    { n: 4, find: 'aria-label="Take a stance on this comment"', tag: "button", all: true },
    { n: 4, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 5, find: ">Reply</button>", tag: "button", all: true },
    { n: 6, find: "View 2 replies", tag: "button" },
    { n: 7, find: "Add a comment</label>", tag: "label" },
    { n: 8, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ReplyMedia: [
    { n: 1, find: '<a href="/u/', tag: "a", all: true },
    { n: 2, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 3, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 4, find: 'aria-label="Your stance on this comment', tag: "button", all: true },
    { n: 4, find: 'aria-label="Take a stance on this comment"', tag: "button", all: true },
    { n: 4, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 5, find: ">Reply</button>", tag: "button", all: true },
    { n: 6, find: ">Edit</button>", tag: "button" },
    { n: 7, find: "Add a comment</label>", tag: "label" },
    { n: 8, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  CommentEdit: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: 'rows="3"', tag: "textarea" },
    { n: 5, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 6, find: "+ Add · 1 of 4", tag: "button" },
    { n: 7, find: ">Describe the pictures</button>", tag: "button" },
    { n: 8, find: "#glovebox", tag: "span" },
    { n: 9, find: ">Add a topic</button>", tag: "button" },
    { n: 10, find: "+ Cite something", tag: "button" },
    { n: 11, find: "This creates 2 signed actions", tag: "div" },
    { n: 12, find: ">Sign the edit</button>", tag: "button" },
  ],
  CommentEditActs: [
    { n: 1, find: ">Done</button>", tag: "button" },
    { n: 2, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ReplyPictures: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "almost catches it.", tag: "p" },
    { n: 5, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 6, find: ">Describe the pictures</button>", tag: "button" },
    { n: 7, find: "+ Add pictures · 2 of 4", tag: "button" },
  ],
  ReplyPicturesWeb: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "almost catches it.", tag: "p" },
    { n: 5, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 6, find: ">Describe the pictures</button>", tag: "button" },
    { n: 7, find: "+ Add pictures · 2 of 4", tag: "button" },
    { n: 8, find: "…or drop them here.", tag: "span" },
  ],
});

// The Compose page's JSX boards (the 13 hand boards carry their attributes
// directly). The sheet boards are scanExempt; only the sheet layer and its
// scrim are stamped.
Object.assign(FLOW_MARKERS, {
  ReferencePicker: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: 'aria-label="How searching works"', tag: "button" },
    { n: 3, find: ">salt<", tag: "div" },
    { n: 4, find: 'aria-label="What the search shows"', tag: "button" },
    { n: 5, find: ">Salt maps of the coast road<", tag: "button" },
    { n: 5, find: ">Sal Torres<", tag: "button" },
    { n: 5, find: ">Salt cellar, hand-carved<", tag: "button" },
    { n: 5, find: ">Keep the salt flats path open<", tag: "button" },
    { n: 5, find: ">Salt marsh survey crew<", tag: "button" },
    { n: 5, find: ">Sea salt collective — autumn run<", tag: "button" },
    { n: 5, find: "Offer on Salt cellar, hand-carved", tag: "button" },
  ],
  RefsSheet: [
    { n: 1, find: ">photography<", tag: "button" },
    { n: 1, find: ">coastroad<", tag: "button" },
    { n: 2, find: ">Mira Voss<", tag: "button" },
    { n: 2, find: ">Salt maps of the coast road<", tag: "button" },
    { n: 2, find: ">Low tide at six tomorrow — anyone walking the flats?<", tag: "button" },
    { n: 2, find: ">That stretch after the second bend…<", tag: "button" },
    { n: 2, find: ">Mark the flooded dip on the coast road<", tag: "button" },
    { n: 2, find: ">Salt-crust rubbing, framed<", tag: "button" },
    { n: 2, find: ">Coast road cleanup week<", tag: "button" },
    { n: 2, find: "Offer on: Salt-crust rubbing, framed", tag: "button" },
    { n: 2, find: ">Coast walkers<", tag: "button" },
    { n: 2, find: "Crust held all the way past the slipway today.", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  RemoveMenu: [
    { n: 1, find: ">Edit</button>", tag: "button" },
    { n: 2, find: ">Mark as sensitive</button>", tag: "button" },
    { n: 3, find: ">Remove</button>", tag: "button" },
    { n: 4, find: ">License terms</button>", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  RemoveConfirm: [
    { n: 1, find: ">Remove</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
    { n: 3, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  Removed: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: '<a href="/u/', tag: "a", all: true },
    { n: 3, find: 'aria-label="Take a stance on this post"', tag: "button", all: true },
    { n: 3, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 4, find: ">Post Score</span>", tag: "button", all: true },
    { n: 5, find: 'aria-label="2 comments"', tag: "button" },
    ...nav(6),
  ],
  ComposeLanded: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 3, find: '<a href="/u/', tag: "a", all: true },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 5, find: 'aria-label="Topics and references"', tag: "button" },
    { n: 6, find: 'aria-label="Your stance on this post', tag: "button", all: true },
    { n: 6, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 7, find: ">Post Score</span>", tag: "button", all: true },
    { n: 8, find: 'aria-label="0 comments"', tag: "button" },
    ...nav(9),
  ],
  ComposeExpired: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    { n: 2, find: ">Dismiss</button>", tag: "button" },
    { n: 3, find: ">Open the draft</button>", tag: "button" },
    { n: 4, find: '<a href="/u/', tag: "a", all: true },
    { n: 5, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 6, find: 'src="post-photo.jpg"', tag: "div" },
    { n: 7, find: ">More</button>", tag: "button" },
    { n: 8, find: '<a href="/t/', tag: "a", all: true },
    { n: 9, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="Your stance on this post', tag: "button", all: true },
    { n: 10, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 11, find: ">Post Score</span>", tag: "button", all: true },
    { n: 12, find: 'aria-label="3 comments"', tag: "button" },
    ...nav(13),
  ],
});

// The Media page (HelpDialog, the one Patterns board, carries its attributes
// directly as a hand board).
Object.assign(FLOW_MARKERS, {
  FeedGallery: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    { n: 2, find: '<a href="/u/', tag: "a", all: true },
    { n: 3, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 5, find: ">More</button>", tag: "button" },
    { n: 6, find: '<a href="/t/', tag: "a", all: true },
    { n: 7, find: 'aria-label="Your stance on this post', tag: "button", all: true },
    { n: 7, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 8, find: ">Post Score</span>", tag: "button", all: true },
    { n: 9, find: 'aria-label="2 comments"', tag: "button" },
    { n: 9, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(10),
  ],
  ComposePicked: [
    { n: 1, find: "cursor:grab", tag: "span", all: true },
    { n: 2, find: ">Describe</button>", tag: "button", all: true },
    { n: 3, find: 'aria-label="Remove', tag: "button", all: true },
    { n: 4, find: ">Done</button>", tag: "button" },
    { n: 5, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  ComposeDescribe: [
    { n: 1, find: 'aria-label="Describing pictures"', tag: "button" },
    { n: 2, find: 'rows="2"', tag: "textarea" },
    { n: 3, find: ">Done</button>", tag: "button" },
    { n: 4, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  ComposeUploading: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Manage the pictures"', tag: "button" },
    { n: 4, find: ">Retry</button>", tag: "button" },
    { n: 5, find: ">Remove it</button>", tag: "button" },
    { n: 6, find: ">Describe the pictures</button>", tag: "button" },
    { n: 7, find: 'type="text"', tag: "input" },
    { n: 8, find: 'rows="2"', tag: "textarea" },
    { n: 9, find: "#tidemarket", tag: "span" },
    { n: 10, find: ">Add a topic</button>", tag: "button" },
    { n: 11, find: ">Next</button>", tag: "button" },
  ],
  ComposeSealUploading: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Signed actions"', tag: "button" },
    { n: 4, find: ">Change</button>", tag: "button" },
    { n: 5, find: ">Adjust</button>", tag: "button" },
    { n: 6, find: ">Mark</button>", tag: "button" },
    { n: 7, find: 'disabled=""', tag: "button" },
    { n: 8, find: ">Back</button>", tag: "button" },
  ],
  ComposePickWeb: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: ">Write words instead</button>", tag: "button" },
    { n: 5, find: ">Show all</span>", tag: "span" },
    { n: 6, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 7, find: "1px dashed var(--border-field)", tag: "div" },
    { n: 8, find: ">Choose from your files</button>", tag: "button" },
  ],
  AvatarCrop: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "transform:scale(1.2)", tag: "div" },
  ],
  AvatarSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave"', tag: "button" },
    { n: 3, find: 'aria-label="Changing your picture"', tag: "button" },
    { n: 4, find: ">Sign the change</button>", tag: "button" },
    { n: 5, find: ">Back</button>", tag: "button" },
  ],
});

// The Profile page's boards (profile round, item 23). The own-profile boards
// share the band cluster and the header anatomy; the chats marker for these
// boards lives here (not in BAND_CHATS below) so each list reads complete.
const ownProfile = () => [
  { n: 1, find: 'aria-label="Chats"', tag: "button" },
  { n: 2, find: 'aria-label="More — share your profile"', tag: "button" },
  { n: 3, find: 'aria-label="Settings"', tag: "button" },
  { n: 4, find: 'aria-label="Change your picture"', tag: "button" },
  { n: 5, find: 'aria-label="Your stances, both directions"', tag: "button" },
  { n: 6, find: ">Edit profile</button>", tag: "button" },
  { n: 7, find: ">Invites</button>", tag: "button" },
  { n: 8, find: 'aria-label="Posts"', tag: "button" },
  { n: 8, find: 'aria-label="Comments"', tag: "button" },
  { n: 8, find: 'aria-label="Everything"', tag: "button" },
];
Object.assign(FLOW_MARKERS, {
  Profile: [
    ...ownProfile(),
    { n: 9, find: "Salt maps of the coast road — rubbings", tag: "button" },
    { n: 9, find: "The third headland light is real", tag: "button" },
    { n: 9, find: "Three weekends of walking the same stretch", tag: "button" },
    ...nav(10),
  ],
  ProfileApplicant: [
    ...ownProfile(),
    { n: 9, find: "First light over the flats", tag: "button" },
    ...nav(10),
  ],
  ProfileOther: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Stances on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Take a stance on @ada"', tag: "button" },
    { n: 4, find: ">Choose your stance</button>", tag: "button" },
    { n: 5, find: ">Message</button>", tag: "button" },
    { n: 6, find: 'aria-label="Posts"', tag: "button" },
    { n: 6, find: 'aria-label="Comments"', tag: "button" },
    { n: 6, find: 'aria-label="Everything"', tag: "button" },
    { n: 7, find: "The long way home — the light does something", tag: "button" },
    { n: 7, find: "The glovebox camera earns its keep", tag: "button" },
    { n: 7, find: "Took the coast road instead of the tunnel", tag: "button" },
    ...nav(8),
  ],
  ProfileStances: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">On them</button>", tag: "button" },
    { n: 3, find: ">They&#x27;ve taken</button>", tag: "button" },
    { n: 4, find: ">Tobias Lindqvist</span>", tag: "button" },
    { n: 4, find: ">Sol Ferreira</span>", tag: "button" },
    { n: 4, find: ">Mira Voss</span>", tag: "button" },
    { n: 4, find: ">Juno Baptiste</span>", tag: "button" },
    ...nav(6),
  ],
  ProfilePosts: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Stances on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Take a stance on @ada"', tag: "button" },
    { n: 4, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 5, find: ">Message</button>", tag: "button" },
    { n: 6, find: 'aria-label="Posts"', tag: "button" },
    { n: 6, find: 'aria-label="Comments"', tag: "button" },
    { n: 6, find: 'aria-label="Everything"', tag: "button" },
    { n: 7, find: '<a href="/u/', tag: "a", all: true },
    { n: 8, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 9, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 10, find: ">More</button>", tag: "button", all: true },
    { n: 11, find: '<a href="/t/', tag: "a", all: true },
    { n: 12, find: 'aria-label="Your stance on this post', tag: "button", all: true },
    { n: 12, find: 'aria-label="Take a stance on this post"', tag: "button", all: true },
    { n: 13, find: ">Post Score</span>", tag: "button", all: true },
    { n: 14, find: ">· 1 reference<", tag: "span" },
    { n: 15, find: 'aria-label="3 comments"', tag: "button" },
    { n: 15, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(16),
  ],
  ProfileComments: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Stances on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Take a stance on @ada"', tag: "button" },
    { n: 5, find: ">Message</button>", tag: "button" },
    { n: 6, find: 'aria-label="Posts"', tag: "button" },
    { n: 6, find: 'aria-label="Comments"', tag: "button" },
    { n: 6, find: 'aria-label="Everything"', tag: "button" },
    { n: 7, find: '<a href="/u/', tag: "a", all: true },
    { n: 8, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 9, find: 'aria-label="Your stance on this comment', tag: "button", all: true },
    { n: 9, find: 'aria-label="Take a stance on this comment"', tag: "button", all: true },
    { n: 9, find: ">Choose your stance</button>", tag: "button", all: true },
    { n: 10, find: ">Reply</button>", tag: "button", all: true },
    { n: 11, find: "View 2 replies", tag: "button" },
    { n: 17, find: ">On “", tag: "button", all: true },
    ...nav(12),
  ],
  ProfileEdit: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Change picture</button>", tag: "button" },
    { n: 3, find: 'value="Sol Ferreira"', tag: "input" },
    { n: 4, find: "whatever the wind allows.</textarea>", tag: "textarea" },
    { n: 5, find: 'value="solferreira.art"', tag: "input" },
    { n: 6, find: ">Save</button>", tag: "button" },
  ],
  ProfileEditSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave"', tag: "button" },
    { n: 3, find: 'aria-label="Changing your profile"', tag: "button" },
    { n: 4, find: ">Sign the change</button>", tag: "button" },
    { n: 5, find: ">Back</button>", tag: "button" },
  ],
});

/* The band's Chats affordance (jakob 2026-09-01): CograBand carries it on
   every tab root, so every wired band board gets the marker in one sweep —
   the number is each board's next free one, the edge points at the chat
   surface's gap (guest boards: the guest gate's). */
const BAND_CHATS = {
  Main: 18, FeedBare: 18, ApplicantFeed: 18, ApplicantWaiting: 15,
  VouchBack: 18, KeyElsewhere: 17, ComposeExpired: 18, Explore: 9,
  Feed: 16, FeedNarrowed: 16, FeedNothing: 8, FeedFar: 16, FeedGallery: 15,
  Wallet: 14, WalletEmpty: 9, WalletSetup: 8, WalletKeyAbsent: 10,
  WalletGuest: 8, WalletApplicant: 6,
};
for (const [board, n] of Object.entries(BAND_CHATS)) {
  (FLOW_MARKERS[board] ??= []).push({ n, find: 'aria-label="Chats"', tag: "button" });
}

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
