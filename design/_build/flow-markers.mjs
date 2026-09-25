// Flow-number stamps for the JSX-rendered boards (backlog item 22): after a
// screen renders, each marker locates an element in the markup and stamps
// data-flow="n" onto its opening tag — the number graph.json's edges reference
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
  { n: at.stance, find: 'aria-label="Give your opinion on this post"', tag: "button", all: true },
  { n: at.score, find: ">Post score</span>", tag: "button", all: true },
  { n: at.comments, find: 'aria-label="3 comments"', tag: "button" },
];

const filter = { n: 1, find: 'aria-label="What your feed shows"', tag: "button" };
const guestBand = [
  { n: 2, find: ">Sign in or join</button>", tag: "button" },
  { n: 3, find: ">On Android? Download the app (APK)</span>", tag: "span" },
];
const secondComments = (n) => ({ n, find: 'aria-label="1 comment"', tag: "button" });

// The details stage's controls, shared by the stage and by the stage drawn
// against its caps — one anatomy, so one marker list.
const composeDetails = [
  { n: 12, find: "aria-label=\"#fieldnotes — set how it relates\"", tag: "button" },
  { n: 12, find: "aria-label=\"#coastroad — set how it relates\"", tag: "button" },
  { n: 13, find: "aria-label=\"The long way home — @ada — set how it relates\"", tag: "button" },
  { n: 1, find: 'aria-label="Back a step"', tag: "a" },
  { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
  { n: 3, find: 'aria-label="Manage the pictures"', tag: "button" },
  { n: 4, find: 'data-field="Title"', tag: "div" },
  { n: 5, find: 'data-field="Description"', tag: "div" },
  { n: 6, find: 'aria-label="Remove #fieldnotes"', tag: "button" },
  { n: 6, find: 'aria-label="Remove #coastroad"', tag: "button" },
  { n: 7, find: "+ Add a tag", tag: "button" },
  { n: 8, find: 'aria-label="Remove The long way home', tag: "button" },
  { n: 9, find: "+ Cite something", tag: "button" },
  { n: 10, find: ">Next</button>", tag: "button" },
  { n: 11, find: ">Describe the pictures</button>", tag: "button" },
];

// The words stage, likewise — the body box is found by its own outline, which
// is the one thing the cap state changes about it.
const composeWords = (bodyOutline) => [
  { n: 1, find: 'aria-label="Back a step"', tag: "a" },
  { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
  { n: 3, find: ">Next</button>", tag: "button" },
  { n: 4, find: ">Add pictures instead</button>", tag: "button" },
  { n: 5, find: bodyOutline, tag: "div" },
];

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
    { n: 17, find: ">Got it</button>", tag: "button" },
  ],
  VouchBack: [
    filter,
    { n: 2, find: ">Not now</button>", tag: "button" },
    { n: 3, find: ">Vouch back</button>", tag: "button" },
    ...post({ author: 4, menu: 5, media: 6, more: 7, topic: 8, refs: 9, stance: 10, score: 11, comments: 12 }),
    ...nav(13),
  ],
  VouchBackPad: [
    { n: 1, find: 'aria-label="Your first opinion"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion', tag: "div" },
    { n: 2, find: ">Choose your opinion on @mira</button>", tag: "button" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
  ],
  // The same pad with a history behind it, so `StanceControl` draws the
  // walk-away as well: it takes the third number and the two decisions shift
  // past it. The help label is the ordinary feed card's default, because that
  // is what this is — a named pad belongs to a board that named it.
  PadStanding: [
    { n: 1, find: 'aria-label="How opinions work"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion', tag: "div" },
    { n: 2, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 3, find: ">Walk it back</button>", tag: "button" },
    { n: 4, find: ">Cancel</button>", tag: "button" },
    { n: 5, find: ">Set</button>", tag: "button" },
  ],
  /* The ceremony has exactly one control, which is the whole point of it. */
  VouchedIn: [{ n: 1, find: ">Go to your feed</button>", tag: "button" }],
  KeyElsewhere: [
    filter,
    { n: 2, find: ">Restore the key</button>", tag: "button" },
    ...post({ author: 3, menu: 4, media: 5, more: 6, topic: 7, refs: 8, stance: 9, score: 10, comments: 11 }).filter(
      (m) => m.find !== 'aria-label="Give your opinion on this post"'
    ),
    { n: 9, find: 'aria-label="Your opinion on this post', tag: "button" },
    { n: 9, find: ">Choose your opinion on this post</button>", tag: "button" },
    ...nav(12),
  ],
};

// The Money & Wallet page. In V1.0 it holds the wallet slot's door alone (the
// V1.0 scope cut: the eleven wallet boards live in the post-MVP tree, their
// markers with the post-MVP rounds below). The door has no controls of its
// own, so it numbers like `WalletApplicant` did: the bar first, then the band's
// chats and bell in the sweeps further down (the active tab's edge is `self`).
Object.assign(FLOW_MARKERS, {
  WalletComingSoon: [...nav(1)],
});

// The Feed & Search page. Signed-in post cards carry standings, so the stance
// anchor differs from the entry boards'; the hidden "Choose your opinion"
// skip-link shares the stance number. Sheet boards are scanExempt — only the
// sheet layer (and its scrim, the tap-outside dismiss) is stamped.
const signedPost = (at) => [
  { n: at.author, find: '<a href="/u/', tag: "a", all: true },
  { n: at.menu, find: 'aria-label="More on this post"', tag: "button", all: true },
  { n: at.more, find: ">More</button>", tag: "button", all: true },
  { n: at.topic, find: '<a href="/t/', tag: "a", all: true },
  { n: at.stance, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
  { n: at.stance, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
  { n: at.score, find: ">Post score</span>", tag: "button", all: true },
];
const searchShell = (fieldText, nRow) => [
  { n: 1, find: fieldText, tag: "div" },
  { n: 2, find: 'aria-label="What the search shows"', tag: "button" },
  { n: 3, find: 'aria-label="How searching works"', tag: "button" },
  ...nav(nRow),
];

Object.assign(FLOW_MARKERS, {
  // The Sky hero carries no number: it announces rather than opens (jakob
  // 2026-09-14), and a board's numbers are its controls.
  Explore: [
    { n: 1, find: "Search people, posts, tags", tag: "div" },
    { n: 2, find: ">@sol salt</span>", tag: "button" },
    { n: 2, find: ">#saltmaps</span>", tag: "button" },
    { n: 2, find: ">coast road</span>", tag: "button" },
    ...nav(3),
    /* The topics door takes the board's next free number, the way the band's
       chats and bell and the card's share all did — the page's numbering is
       append-only, so a row added above the recents does not renumber them. */
    { n: 10, find: ">Your topics</span>", tag: "button" },
  ],
  /* Every row on Your topics opens the same page, so they share one via —
       the tag page in its HELD state, because a row on this list is held by
       definition. */
  YourTopics: [
    { n: 1, find: 'aria-label="Back to Explore"', tag: "a" },
    { n: 2, find: ">#saltmaps<", tag: "button" },
    { n: 2, find: ">#coastroad<", tag: "button" },
    { n: 2, find: ">#fieldnotes<", tag: "button" },
    { n: 2, find: ">#tidetables<", tag: "button" },
    { n: 2, find: ">#wellness<", tag: "button" },
  ],
  /* V1.0's rows only (readme §13, the V1.0 scope cut): posts, a comment, a
     tag. The rows number in reading order, the bar follows them, and the tag
     row keeps the last number, where the tag round appended it. */
  ExploreSearch: [
    { n: 11, find: ">saltmaps<", tag: "button" },
    ...searchShell("@sol salt", 6),
    { n: 4, find: "Salt maps of the coast road", tag: "button" },
    { n: 4, find: "First try at a rubbing", tag: "button" },
    { n: 5, find: "The wax-stick ones read like weather charts", tag: "button" },
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
  /* The sheet's chips all share via 2, the topic chips included (the topic
     round): every chip in here applies live and in place, which is one act
     whatever it narrows, and WHICH feed the reader lands on is what via 6 —
     the way out — enumerates. The door to the full list is the one new
     control, so it is the one new number. */
  FeedSheet: [
    { n: 1, find: 'aria-label="How the filter works"', tag: "button" },
    { n: 2, find: 'role="switch"', tag: "button", all: true },
    { n: 3, find: "aria-pressed=", tag: "button", all: true },
    { n: 4, find: "already seen", tag: "label" },
    { n: 5, find: ">Reset</button>", tag: "button" },
    { n: 6, find: 'class="cg-scrim-in"', tag: "div" },
    { n: 7, find: ">All your topics</button>", tag: "button" },
  ],
  /* The feed narrowed to one topic. Neither card carries a reference, so the
     numbering closes over the slot `FeedNarrowed` keeps for one. */
  FeedTopic: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 7, score: 8 }),
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 9, find: 'aria-label="2 comments"', tag: "button" },
    { n: 9, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(10),
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
  // The feed three screens down, the band scrolled back and the pill under it.
  // The same pair `FeedNarrowed` draws, so the same numbering — the pill takes
  // the next free number after the band's own.
  FeedScrolled: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="2 comments"', tag: "button" },
    { n: 19, find: ">Back to top</button>", tag: "button" },
    ...nav(11),
  ],
  // The feed a moment after Hide @ada: her card gone, the ranker's next posts
  // moved up, and the act's own line over them. Neither card carries a
  // reference, so the numbering closes over the slot `Feed` keeps for one.
  FeedHidden: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 7, score: 8 }),
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 9, find: 'aria-label="1 comment"', tag: "button" },
    { n: 9, find: 'aria-label="2 comments"', tag: "button" },
    { n: 18, find: ">Undo</button>", tag: "button" },
    ...nav(10),
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

// The Comments page. Sheet boards are scanExempt; badges stamped on under-scrim
// repeats sit dimmed beneath the wash, which reads correctly.
Object.assign(FLOW_MARKERS, {
  ReplyEntry: [
    { n: 1, find: '<a href="/u/', tag: "a", all: true },
    { n: 2, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 3, find: '<a href="/t/', tag: "a", all: true },
    { n: 4, find: 'aria-label="Your opinion on this comment', tag: "button", all: true },
    { n: 4, find: 'aria-label="Give your opinion on this comment"', tag: "button", all: true },
    { n: 4, find: ">Choose your opinion on this comment</button>", tag: "button", all: true },
    { n: 4, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 5, find: ">Reply</button>", tag: "button", all: true },
    { n: 6, find: "View 2 replies", tag: "button" },
    { n: 7, find: "Add a comment</label>", tag: "label" },
    { n: 8, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The same sheet at the end of the reply flow (item 85): the same controls,
  // minus the "View n replies" line the landing has already opened — so every
  // number below the sixth shifts up by one.
  ReplySettled: [
    { n: 1, find: '<a href="/u/', tag: "a", all: true },
    { n: 2, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 3, find: '<a href="/t/', tag: "a", all: true },
    { n: 4, find: 'aria-label="Your opinion on this comment', tag: "button", all: true },
    { n: 4, find: 'aria-label="Give your opinion on this comment"', tag: "button", all: true },
    { n: 4, find: ">Choose your opinion on this comment</button>", tag: "button", all: true },
    { n: 4, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 5, find: ">Reply</button>", tag: "button", all: true },
    { n: 6, find: "Add a comment</label>", tag: "label" },
    { n: 7, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ReplyMedia: [
    { n: 1, find: '<a href="/u/', tag: "a", all: true },
    { n: 2, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 3, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 4, find: 'aria-label="Your opinion on this comment', tag: "button", all: true },
    { n: 4, find: 'aria-label="Give your opinion on this comment"', tag: "button", all: true },
    { n: 4, find: ">Choose your opinion on this comment</button>", tag: "button", all: true },
    { n: 4, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 5, find: ">Reply</button>", tag: "button", all: true },
    { n: 6, find: ">Edit</button>", tag: "button" },
    { n: 7, find: "Add a comment</label>", tag: "label" },
    { n: 8, find: 'class="cg-scrim-in"', tag: "div" },
    { n: 9, find: 'aria-label="Turn sound on"', tag: "button" },
  ],
  CommentEdit: [
    { n: 14, find: "aria-label=\"#glovebox — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the edit is discarded"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: 'data-field="Words"', tag: "div" },
    { n: 5, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 6, find: "+ Add pictures · 1 of 4", tag: "button" },
    { n: 7, find: ">Describe the pictures</button>", tag: "button" },
    { n: 8, find: 'aria-label="Remove #glovebox"', tag: "button" },
    { n: 9, find: "+ Add a tag", tag: "button" },
    { n: 10, find: "+ Cite something", tag: "button" },
    { n: 11, find: "signing 2 things", tag: "button" },
    { n: 12, find: ">Sign the edit</button>", tag: "button" },
    { n: 13, find: ">Mark</button>", tag: "button" },
  ],
  CommentEditActs: [
    { n: 1, find: ">Done</button>", tag: "button" },
    { n: 2, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ReplyPictures: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "almost catches it.", tag: "p" },
    { n: 5, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 6, find: ">Describe the pictures</button>", tag: "button" },
    { n: 7, find: "+ Add pictures · 2 of 4", tag: "button" },
  ],
  ReplyVideo: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "if the light comes through at all.", tag: "p" },
    { n: 5, find: 'aria-label="Remove this video"', tag: "button" },
    { n: 6, find: ">Describe the video</button>", tag: "button" },
    { n: 7, find: 'class="cg-cover-frame"', tag: "div", all: true },
    { n: 8, find: 'class="cg-cover-own"', tag: "div" },
  ],
  ReplyMediaErrors: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "the ones that survived.", tag: "p" },
    { n: 5, find: ">Remove it</button>", tag: "button", all: true },
    { n: 6, find: "+ Add pictures · 4 of 4</button>", tag: "button" },
    { n: 7, find: 'aria-label="Remove this picture"', tag: "button", all: true },
    { n: 8, find: ">Describe the pictures</button>", tag: "button" },
  ],
  ReplyPicturesWeb: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "almost catches it.", tag: "p" },
    { n: 5, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 6, find: ">Describe the pictures</button>", tag: "button" },
    { n: 7, find: "+ Add pictures · 2 of 4", tag: "button" },
    { n: 8, find: "…or drop pictures or a video here.", tag: "span" },
  ],
});

// The Compose page's boards. The sheet boards are scanExempt; only the sheet
// layer and its scrim are stamped.
Object.assign(FLOW_MARKERS, {
  ReferencePicker: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: 'aria-label="How searching works"', tag: "button" },
    { n: 3, find: ">salt<", tag: "div" },
    { n: 4, find: 'aria-label="What the search shows"', tag: "button" },
    { n: 5, find: ">Salt maps of the coast road<", tag: "button" },
    { n: 5, find: ">Sal Torres<", tag: "button" },
  ],
  /* A reference row per V1.0 kind, each its own edge to its own board (readme
     §13, the V1.0 scope cut): the person, the posts, the comment, numbered in
     reading order, the scrim last. */
  RefsSheet: [
    { n: 1, find: ">photography<", tag: "button" },
    { n: 1, find: ">coastroad<", tag: "button" },
    { n: 2, find: ">Mira Voss<", tag: "button" },
    { n: 3, find: ">Salt maps of the coast road<", tag: "button" },
    { n: 3, find: ">Low tide at six tomorrow — anyone walking the flats?<", tag: "button" },
    { n: 4, find: ">That stretch after the second bend…<", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  RemoveMenu: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Edit</button>", tag: "button" },
    { n: 3, find: ">Mark as sensitive</button>", tag: "button" },
    { n: 4, find: ">Remove</button>", tag: "button" },
    { n: 5, find: ">License terms</button>", tag: "button" },
    { n: 6, find: 'class="cg-scrim-in"', tag: "div" },
    // Citing arrived after this sheet was numbered and took the next free
    // number rather than the second one it reads at — the settings page's
    // rule, for its reason: the badge is an identity, not a position.
    { n: 7, find: ">Cite in a new post</button>", tag: "button" },
  ],
  // The menus round: four sheet boards, one per surface a ⋮ opens on. Each is
  // scanExempt, so only the sheet's own rows and its scrim carry numbers, and
  // the numbers run in the order the rows are read.
  ReaderPostMenu: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Cite in a new post</button>", tag: "button" },
    { n: 3, find: ">Hide @ada</button>", tag: "button" },
    { n: 4, find: ">License terms</button>", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The same sheet on a phone too narrow for four actions: share has moved in
  // from the action row and leads, so every number below it shifts by one.
  ReaderPostMenuNarrow: [
    { n: 1, find: ">Share</button>", tag: "button" },
    { n: 2, find: ">Save</button>", tag: "button" },
    { n: 3, find: ">Cite in a new post</button>", tag: "button" },
    { n: 4, find: ">Hide @ada</button>", tag: "button" },
    { n: 5, find: ">License terms</button>", tag: "button" },
    { n: 6, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // TWO WASHES on this board — the thread's, and the menu's stacked over the
  // thread it dims — and both take the same number: the edge is "tap outside",
  // and outside the menu is the whole screen.
  CommentMenu: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Cite in a new post</button>", tag: "button" },
    { n: 3, find: ">License terms</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div", all: true },
    { n: 5, find: ">Opinions on this</button>", tag: "button" },
    { n: 6, find: ">Cited by</button>", tag: "button" },
  ],
  ProfileMenu: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Mention in a new post</button>", tag: "button" },
    { n: 3, find: ">Share this profile</button>", tag: "button" },
    { n: 4, find: ">Hide @ada</button>", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // A deleted account's menu: the master's rows minus Mention, which stages a
  // Reference at a person and has no handle left to spell.
  ProfileDeletedMenu: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Share this profile</button>", tag: "button" },
    { n: 3, find: ">Hide this account</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // Your own profile's menu (the private-viewer-state round): the two private
  // lists and the share row, over the page they belong to.
  ProfileOwnMenu: [
    { n: 1, find: ">Saved</button>", tag: "button" },
    { n: 2, find: ">History</button>", tag: "button" },
    { n: 3, find: ">Share your profile</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The license sheet, over the post and over the thread. Both are scanExempt:
  // the terms are a block to read, not a set of controls, so the only thing
  // either board wires is the wash that drops the sheet. CommentLicense has two
  // — the thread's and the sheet's stacked over it — and they take the same
  // number, as on CommentMenu: outside the sheet is outside it.
  PostLicense: [{ n: 1, find: 'class="cg-scrim-in"', tag: "div" }],
  CommentLicense: [{ n: 1, find: 'class="cg-scrim-in"', tag: "div", all: true }],
  ComposeCited: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'data-field="Title"', tag: "div" },
    { n: 4, find: 'data-field="Description"', tag: "div" },
    { n: 5, find: "+ Add a tag", tag: "button" },
    { n: 6, find: 'aria-label="Remove The long way home', tag: "button" },
    { n: 7, find: "+ Cite something", tag: "button" },
    { n: 8, find: ">Next</button>", tag: "button" },
    { n: 9, find: "aria-label=\"The long way home — @ada — set how it relates\"", tag: "button" },
  ],
  ComposeDetails: composeDetails,
  ComposeDetailsCaps: composeDetails,
  RemoveConfirm: [
    { n: 1, find: ">Remove</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
    { n: 3, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  Removed: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: '<a href="/u/', tag: "a", all: true },
    { n: 3, find: 'aria-label="Give your opinion on this post"', tag: "button", all: true },
    { n: 3, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
    { n: 4, find: ">Post score</span>", tag: "button", all: true },
    { n: 5, find: 'aria-label="2 comments"', tag: "button" },
    ...nav(6),
  ],
  ComposeLanded: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 3, find: '<a href="/u/', tag: "a", all: true },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 5, find: 'aria-label="Tags and references"', tag: "button" },
    { n: 6, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
    { n: 6, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
    { n: 7, find: ">Post score</span>", tag: "button", all: true },
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
    { n: 10, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
    { n: 10, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
    { n: 11, find: ">Post score</span>", tag: "button", all: true },
    { n: 12, find: 'aria-label="3 comments"', tag: "button" },
    ...nav(13),
  ],
});

// The compose wizard's LEGACY BOARDS, converted (the conformance round): ten
// boards that were hand-authored `.dc.html` with no source behind them now
// render from `screens/`, so their inline `data-flow` stamps become markers
// here. Same numbers, same elements, same edges — only the authorship moved.
// The seal's three sheet boards are scanExempt; only the sheet layer and its
// scrim are stamped, and the seal beneath them is inert in those states.
Object.assign(FLOW_MARKERS, {
  ComposeWords: composeWords("1px solid var(--border-field)"),
  ComposeWordsCaps: composeWords("1px solid var(--error)"),
  ComposePick: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: ">Write words instead</button>", tag: "button" },
    { n: 5, find: ">Show all</button>", tag: "button" },
    { n: 6, find: ">Cover</span>", tag: "div" },
    { n: 7, find: 'aria-label="Remove this picture"', tag: "button" },
    { n: 8, find: ">Your photos app</span>", tag: "button" },
    // Every tile of the roll is the same control repeated — one edge covers
    // them, the way one edge covers a feed's repeated per-post affordances.
    { n: 9, find: "position:relative;width:125px", tag: "div", all: true },
  ],
  ComposeCrop: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: ">Tall 4:5</button>", tag: "button" },
    { n: 4, find: ">Square 1:1</button>", tag: "button" },
    { n: 4, find: ">Wide 1.91:1</button>", tag: "button" },
    { n: 5, find: "transform:scale(1.15)", tag: "div" },
    { n: 6, find: "position:relative;width:48px", tag: "div", all: true },
  ],
  ComposeCover: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: "transform:translate(-50%, -50%)", tag: "span" },
    { n: 4, find: 'class="cg-cover-frame"', tag: "div", all: true },
    { n: 5, find: 'class="cg-cover-own"', tag: "div" },
    { n: 6, find: ">Next</button>", tag: "button" },
  ],
  ComposeCoverPlaying: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Pause"', tag: "button" },
    { n: 4, find: 'aria-label="Back ten seconds"', tag: "button" },
    { n: 4, find: 'aria-label="Forward ten seconds"', tag: "button" },
    { n: 5, find: 'aria-label="Seek"', tag: "div" },
    { n: 6, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 7, find: 'class="cg-cover-frame"', tag: "div", all: true },
    { n: 8, find: 'class="cg-cover-own"', tag: "div" },
    { n: 9, find: ">Next</button>", tag: "button" },
  ],
  ComposeDraft: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Discard</button>", tag: "button" },
    { n: 4, find: ">Continue</button>", tag: "button" },
    /* The roll's shield (the re-review, 2026-09-15): one control over a region
       that is out of reach, so a tap on the pictures reaches the discard
       instead of nothing. */
    { n: 5, find: 'aria-label="Answer your draft before starting a new post"', tag: "button" },
  ],
  /* The same stage with the shield's answer raised. Only the DIALOG's pair is
     stamped — the body beneath the scrim is inert and every one of its controls
     is wired on `ComposeDraft`. Its words carry their object for the reason the
     board gives: a bare `Discard` already stands, inert, behind the wash. */
  ComposeDraftDiscard: [
    { n: 1, find: ">Discard it</button>", tag: "button" },
    { n: 2, find: ">Keep the draft</button>", tag: "button" },
  ],
  ComposeSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: ">Change</button>", tag: "button" },
    { n: 5, find: ">Adjust</button>", tag: "button" },
    { n: 6, find: ">Mark</button>", tag: "button" },
    { n: 7, find: ">Sign and publish</button>", tag: "button" },
    { n: 8, find: ">Back</button>", tag: "button" },
  ],
  // The seal at more than one staged citation (item 70): `ComposeSeal`'s own
  // eight controls, and the References row that has become a door.
  ComposeSealCited: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: ">Change</button>", tag: "button" },
    { n: 5, find: ">Adjust</button>", tag: "button" },
    { n: 6, find: ">Mark</button>", tag: "button" },
    { n: 7, find: ">Sign and publish</button>", tag: "button" },
    { n: 8, find: ">Back</button>", tag: "button" },
    { n: 9, find: 'aria-label="Manage the 3 citations"', tag: "button" },
  ],
  // The seal at more tags than the row holds (jakob 2026-09-15): the same
  // eight controls, and the Tags row that has become a door — the References
  // row beside it is the single reading, which carries no control of its own.
  ComposeSealTagged: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: ">Change</button>", tag: "button" },
    { n: 5, find: ">Adjust</button>", tag: "button" },
    { n: 6, find: ">Mark</button>", tag: "button" },
    { n: 7, find: ">Sign and publish</button>", tag: "button" },
    { n: 8, find: ">Back</button>", tag: "button" },
    { n: 9, find: 'aria-label="Manage the 7 tags"', tag: "button" },
  ],
  // What that door opens. The board is scanExempt, so only the sheet's own
  // controls and its scrim carry numbers; the three rows' name-buttons share
  // one number and their ×s another, one edge covering each control.
  ComposeCitations: [
    { n: 1, find: 'aria-label="The long way home — @ada — set how it relates"', tag: "button" },
    { n: 1, find: 'aria-label="Mira Voss — set how it relates"', tag: "button" },
    { n: 1, find: 'aria-label="Tide tables and the third headland — @juno — set how it relates"', tag: "button" },
    { n: 2, find: 'aria-label="Remove The long way home — @ada"', tag: "button" },
    { n: 2, find: 'aria-label="Remove Mira Voss"', tag: "button" },
    { n: 2, find: 'aria-label="Remove Tide tables and the third headland — @juno"', tag: "button" },
    { n: 3, find: ">Done</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The tags door's twin of the sheet above (item 95). scanExempt likewise, so
  // only the sheet's own controls and its scrim carry numbers; the seven pills'
  // name-buttons share one number and their ×s another, one edge covering each
  // control — `ComposeCitations`' rule, arriving at the row above it.
  ComposeTags: [
    { n: 1, find: "— set how it relates\"", tag: "button", all: true },
    { n: 2, find: 'aria-label="Remove #', tag: "button", all: true },
    { n: 3, find: ">Done</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ComposeKeyAbsent: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Change</button>", tag: "button" },
    { n: 4, find: 'aria-label="Your key"', tag: "button" },
    { n: 5, find: ">Restore the key</button>", tag: "button" },
    { n: 6, find: ">Keep the draft, restore later</button>", tag: "button" },
  ],
  ComposeLicense: [
    { n: 1, find: 'aria-label="License"', tag: "button" },
    { n: 2, find: 'data-axis="credit"', tag: "label", all: true },
    { n: 3, find: 'data-axis="record"', tag: "label", all: true },
    { n: 4, find: ">Done</button>", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ComposeSensitive: [
    { n: 1, find: 'aria-label="Sensitive"', tag: "button" },
    { n: 2, find: 'role="switch"', tag: "button" },
    { n: 3, find: 'data-field="Why?"', tag: "div" },
    { n: 4, find: ">Done</button>", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ComposePad: [
    { n: 1, find: 'aria-label="Your opinion on your post"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion pad', tag: "div" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
    { n: 5, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
});

// The Media page.
Object.assign(FLOW_MARKERS, {
  FeedGallery: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    { n: 2, find: '<a href="/u/', tag: "a", all: true },
    { n: 3, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 5, find: ">More</button>", tag: "button" },
    { n: 6, find: '<a href="/t/', tag: "a", all: true },
    { n: 7, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
    { n: 7, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
    { n: 8, find: ">Post score</span>", tag: "button", all: true },
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
  ComposePickedErrors: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: ">Write words instead</button>", tag: "button" },
    { n: 5, find: ">Show all</button>", tag: "button" },
    { n: 6, find: 'aria-label="Remove this picture"', tag: "button", all: true },
    { n: 7, find: ">Remove it</button>", tag: "button", all: true },
  ],
  ComposeDescribe: [
    { n: 1, find: 'aria-label="Describing pictures"', tag: "button" },
    { n: 2, find: 'data-field="What&#x27;s in the picture"', tag: "div" },
    { n: 3, find: ">Done</button>", tag: "button" },
    { n: 4, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  ComposeDescribeVideo: [
    { n: 1, find: 'aria-label="Describing pictures"', tag: "button" },
    { n: 2, find: 'data-field="What&#x27;s in the video"', tag: "div" },
    { n: 3, find: ">Done</button>", tag: "button" },
    { n: 4, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  ComposePickVideo: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: ">Write words instead</button>", tag: "button" },
    { n: 5, find: 'aria-label="Remove this video"', tag: "button" },
  ],
  // The same step once a cover exists: one anatomy, so one marker list.
  ComposePickVideoCover: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: ">Write words instead</button>", tag: "button" },
    { n: 5, find: 'aria-label="Remove this video"', tag: "button" },
  ],
  CoverCrop: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "transform:scale(1.15)", tag: "div" },
  ],
  // The video-cover round's two wizard boards. The cover step with no frames
  // keeps ComposeCover's numbering minus the strip and the preview's disc,
  // which is what "the same step, smaller" means in the graph as well.
  ComposeCoverNoFrames: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'class="cg-cover-own"', tag: "div" },
    { n: 4, find: ">Next</button>", tag: "button" },
  ],
  ComposeDetailsVideo: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: ">Describe the video</button>", tag: "button" },
    { n: 4, find: ">Add a cover</button>", tag: "button" },
    { n: 5, find: 'data-field="Title"', tag: "div" },
    { n: 6, find: 'data-field="Description"', tag: "div" },
    { n: 7, find: "+ Add a tag", tag: "button" },
    { n: 8, find: "+ Cite something", tag: "button" },
    { n: 9, find: ">Next</button>", tag: "button" },
    { n: 10, find: 'aria-label="Remove this video"', tag: "button" },
  ],
  ReplyVideoFailed: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    { n: 4, find: "if the light comes through at all.", tag: "p" },
    { n: 5, find: ">Retry</button>", tag: "button" },
    { n: 6, find: ">Remove it</button>", tag: "button" },
    { n: 7, find: ">Describe the video</button>", tag: "button" },
    { n: 8, find: ">Add a cover</button>", tag: "button" },
  ],
  CommentEditVideo: [
    { n: 14, find: "aria-label=\"#glovebox — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the edit is discarded"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: 'data-field="Words"', tag: "div" },
    { n: 5, find: 'aria-label="Remove this video"', tag: "button" },
    { n: 6, find: ">Describe the video</button>", tag: "button" },
    { n: 7, find: ">Change the cover</button>", tag: "button" },
    { n: 8, find: 'aria-label="Remove #glovebox"', tag: "button" },
    { n: 9, find: "+ Add a tag", tag: "button" },
    { n: 10, find: "+ Cite something", tag: "button" },
    { n: 11, find: "signing 2 things", tag: "button" },
    { n: 12, find: ">Sign the edit</button>", tag: "button" },
    { n: 13, find: ">Mark</button>", tag: "button" },
  ],
  EditComposeVideo: [
    { n: 14, find: "aria-label=\"#coastroad — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: 'aria-label="Remove this video"', tag: "button" },
    { n: 5, find: ">Describe the video</button>", tag: "button" },
    { n: 6, find: ">Add a cover</button>", tag: "button" },
    { n: 7, find: 'data-field="Title"', tag: "div" },
    { n: 8, find: 'data-field="Description"', tag: "div" },
    { n: 9, find: 'aria-label="Remove #coastroad"', tag: "button" },
    { n: 10, find: "+ Add a tag", tag: "button" },
    { n: 11, find: "signing 3 things", tag: "button" },
    { n: 12, find: ">Sign the edit</button>", tag: "button" },
    { n: 13, find: ">Mark</button>", tag: "button" },
  ],
  ComposeUploading: [
    { n: 12, find: "aria-label=\"#tidemarket — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Manage the pictures"', tag: "button" },
    { n: 4, find: ">Retry</button>", tag: "button" },
    { n: 5, find: ">Remove it</button>", tag: "button" },
    { n: 6, find: ">Describe the pictures</button>", tag: "button" },
    { n: 7, find: 'data-field="Title"', tag: "div" },
    { n: 8, find: 'data-field="Description"', tag: "div" },
    { n: 9, find: 'aria-label="Remove #tidemarket"', tag: "button" },
    { n: 10, find: "+ Add a tag", tag: "button" },
    { n: 11, find: ">Next</button>", tag: "button" },
  ],
  ReplyCited: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: "+ Add a tag", tag: "button" },
    { n: 5, find: "+ Cite something", tag: "button" },
    { n: 6, find: ">Adjust</button>", tag: "button" },
    { n: 7, find: ">Change</button>", tag: "button" },
    { n: 8, find: ">Mark</button>", tag: "button" },
    { n: 9, find: ">Sign comment</button>", tag: "button" },
    { n: 10, find: ">Back</button>", tag: "button" },
    { n: 11, find: 'aria-label="Remove Tide tables', tag: "button" },
    { n: 12, find: "aria-label=\"Tide tables and the third headland — set how it relates\"", tag: "button" },
  ],
  // The same seal counting its citations (item 70). Ten of the eleven numbers
  // are `ReplyCited`'s own — the states differ in one row — and 11, which was
  // the staged row's ×, is here the door the counting row has become.
  ReplyCitedMany: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: "+ Add a tag", tag: "button" },
    { n: 5, find: "+ Cite something", tag: "button" },
    { n: 6, find: ">Adjust</button>", tag: "button" },
    { n: 7, find: ">Change</button>", tag: "button" },
    { n: 8, find: ">Mark</button>", tag: "button" },
    { n: 9, find: ">Sign comment</button>", tag: "button" },
    { n: 10, find: ">Back</button>", tag: "button" },
    { n: 11, find: 'aria-label="Manage the 3 citations"', tag: "button" },
  ],
  ComposeSealUploading: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
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
    { n: 5, find: ">Show all</button>", tag: "button" },
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

// The reel round's boards (item 33). The stream and the viewer draw their own
// chrome, so their markers name the controls rather than the card anatomy; the
// two viewer boards are scanExempt (the detail beneath the scrim is inactive)
// and their transport markers stamp `all`, so the under-scrim repeat carries the
// same badge, dimmed beneath the wash.
Object.assign(FLOW_MARKERS, {
  FeedCover: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    { n: 2, find: '<a href="/u/', tag: "a", all: true },
    { n: 3, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 4, find: "aspect-ratio:4 / 5", tag: "div" },
    { n: 4, find: "aspect-ratio:16 / 9", tag: "div" },
    { n: 5, find: ">More</button>", tag: "button", all: true },
    { n: 6, find: '<a href="/t/', tag: "a", all: true },
    { n: 7, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
    { n: 7, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
    { n: 8, find: ">Post score</span>", tag: "button", all: true },
    { n: 9, find: 'aria-label="2 comments"', tag: "button" },
    { n: 9, find: 'aria-label="1 comment"', tag: "button" },
    { n: 10, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 11, find: 'aria-label="Play this video"', tag: "button" },
    ...nav(12),
  ],
  Reel: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "button" },
    { n: 2, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 3, find: '<a href="/u/', tag: "a" },
    { n: 4, find: 'aria-label="Give your opinion on this post"', tag: "button" },
    { n: 4, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 5, find: 'aria-label="2 comments"', tag: "button" },
    { n: 6, find: 'aria-label="Share this post"', tag: "button" },
    { n: 7, find: ">Post score</span>", tag: "button" },
    { n: 8, find: ">More</button>", tag: "button" },
    { n: 9, find: 'alt="A man standing at the edge', tag: "img" },
    { n: 10, find: 'aria-label="Seek"', tag: "div" },
    ...nav(11),
  ],
  PostDetail: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: 'aria-label="More on this post"', tag: "button" },
    { n: 3, find: '<a href="/u/', tag: "a" },
    { n: 4, find: "scroll-snap-type:x mandatory", tag: "div" },
    { n: 5, find: 'aria-label="Tags and references"', tag: "button" },
    { n: 6, find: 'aria-label="Give your opinion on this post"', tag: "button" },
    { n: 6, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 7, find: ">Post score</span>", tag: "button" },
    { n: 8, find: 'aria-label="2 comments"', tag: "button" },
    { n: 9, find: 'aria-label="Share this post"', tag: "button" },
    ...nav(10),
    { n: 15, find: 'aria-label="Opinions on this post"', tag: "button" },
    { n: 16, find: 'aria-label="Cited by"', tag: "button" },
  ],
  PostDetailVideo: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: 'aria-label="More on this post"', tag: "button" },
    { n: 3, find: "aspect-ratio:4 / 5", tag: "div" },
    { n: 4, find: 'aria-label="Pause"', tag: "button" },
    { n: 5, find: 'aria-label="Seek"', tag: "div" },
    { n: 6, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 7, find: '<a href="/u/', tag: "a" },
    { n: 8, find: 'aria-label="Tags and references"', tag: "button" },
    { n: 9, find: 'aria-label="Give your opinion on this post"', tag: "button" },
    { n: 9, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 10, find: ">Post score</span>", tag: "button" },
    { n: 11, find: 'aria-label="2 comments"', tag: "button" },
    { n: 12, find: 'aria-label="Share this post"', tag: "button" },
    ...nav(13),
    { n: 18, find: 'aria-label="Back ten seconds"', tag: "button" },
    { n: 18, find: 'aria-label="Forward ten seconds"', tag: "button" },
    { n: 19, find: 'aria-label="Full screen"', tag: "button" },
    { n: 20, find: 'aria-label="Opinions on this post"', tag: "button" },
  ],
  PostDetailVideoSensitive: [
    { n: 1, find: 'aria-label="Back to feed"', tag: "a" },
    { n: 2, find: 'aria-label="More on this post"', tag: "button" },
    { n: 3, find: 'aria-label="Sensitive — tap to view.', tag: "button" },
    { n: 4, find: '<a href="/u/', tag: "a" },
    { n: 5, find: ">Show</button>", tag: "button" },
    { n: 6, find: 'aria-label="Tags and references"', tag: "button" },
    { n: 7, find: 'aria-label="Opinions on this post"', tag: "button" },
    { n: 8, find: 'aria-label="Give your opinion on this post"', tag: "button" },
    { n: 8, find: ">Choose your opinion on this post</button>", tag: "button" },
    { n: 9, find: ">Post score</span>", tag: "button" },
    { n: 10, find: 'aria-label="2 comments"', tag: "button" },
    { n: 11, find: 'aria-label="Share this post"', tag: "button" },
    ...nav(12),
  ],
  ViewerPicture: [
    { n: 1, find: 'aria-label="Close"', tag: "button" },
    { n: 2, find: 'class="cg-viewer-stage"', tag: "div" },
  ],
  ViewerVideo: [
    { n: 1, find: 'aria-label="Close"', tag: "button" },
    { n: 2, find: 'aria-label="Pause"', tag: "button" },
    { n: 3, find: 'aria-label="Seek"', tag: "div" },
    { n: 4, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 5, find: 'aria-label="Back ten seconds"', tag: "button" },
    { n: 5, find: 'aria-label="Forward ten seconds"', tag: "button" },
  ],
  ViewerLandscape: [
    { n: 1, find: 'aria-label="Close"', tag: "button" },
    { n: 2, find: 'aria-label="Pause"', tag: "button" },
    { n: 3, find: 'aria-label="Seek"', tag: "div" },
    { n: 4, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 5, find: 'aria-label="Back ten seconds"', tag: "button" },
    { n: 5, find: 'aria-label="Forward ten seconds"', tag: "button" },
  ],
});

// The Profile page's boards (profile round, item 23). The own-profile boards
// share the band cluster and the header anatomy; the chats marker for these
// boards lives here (not in BAND_CHATS below) so each list reads complete.
const ownProfile = () => [
  { n: 1, find: 'aria-label="Chats"', tag: "button" },
  { n: 2, find: 'aria-label="More on your profile"', tag: "button" },
  { n: 3, find: 'aria-label="Settings"', tag: "button" },
  { n: 4, find: 'aria-label="Change your picture"', tag: "button" },
  { n: 5, find: 'aria-label="Your opinions, both directions"', tag: "button" },
  { n: 6, find: ">Edit profile</button>", tag: "button" },
  // The waiting dot rides inside the button (the invites round), so the label
  // is no longer the last thing before the closing tag: the find stops at the
  // word, which matches the applicant's dotless button just as well.
  { n: 7, find: ">Invites<", tag: "button" },
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
  // The failed next page is this board's whole subject; the profile beneath it
  // is `Profile`'s and is wired there (the pattern-exemplar exemption).
  ProfileMoreFailed: [{ n: 1, find: ">Retry</button>", tag: "button" }],
  ProfileNotFound: [{ n: 1, find: 'aria-label="Back"', tag: "a" }, ...nav(2)],
  ProfileUnreachable: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Retry</button>", tag: "button" },
    ...nav(3),
  ],
  ProfileApplicant: [
    ...ownProfile(),
    { n: 9, find: "First light over the flats", tag: "button" },
    ...nav(10),
  ],
  ProfileOther: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Opinions on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Give your opinion on @ada"', tag: "button" },
    { n: 4, find: ">Choose your opinion on @ada</button>", tag: "button" },
    { n: 5, find: ">Message</button>", tag: "button" },
    { n: 6, find: 'aria-label="Posts"', tag: "button" },
    { n: 6, find: 'aria-label="Comments"', tag: "button" },
    { n: 6, find: 'aria-label="Everything"', tag: "button" },
    { n: 7, find: "The long way home — the light does something", tag: "button" },
    { n: 7, find: "The glovebox camera earns its keep", tag: "button" },
    { n: 7, find: "Took the coast road instead of the tunnel", tag: "button" },
    ...nav(8),
  ],
  ProfileOtherHeld: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Opinions on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Your opinion on @ada', tag: "button" },
    { n: 4, find: ">Choose your opinion on @ada</button>", tag: "button" },
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
    { n: 3, find: ">By them</button>", tag: "button" },
    { n: 4, find: ">Tobias Lindqvist</span>", tag: "button" },
    { n: 4, find: ">Sol Ferreira</span>", tag: "button" },
    { n: 4, find: ">Mira Voss</span>", tag: "button" },
    { n: 4, find: ">Juno Baptiste</span>", tag: "button" },
    ...nav(6),
  ],
  ProfilePosts: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Opinions on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Give your opinion on @ada"', tag: "button" },
    { n: 4, find: ">Choose your opinion on @ada</button>", tag: "button" },
    { n: 4, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
    { n: 5, find: ">Message</button>", tag: "button" },
    { n: 6, find: 'aria-label="Posts"', tag: "button" },
    { n: 6, find: 'aria-label="Comments"', tag: "button" },
    { n: 6, find: 'aria-label="Everything"', tag: "button" },
    { n: 7, find: '<a href="/u/', tag: "a", all: true },
    { n: 8, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 9, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 10, find: ">More</button>", tag: "button", all: true },
    { n: 11, find: '<a href="/t/', tag: "a", all: true },
    { n: 12, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
    { n: 12, find: 'aria-label="Give your opinion on this post"', tag: "button", all: true },
    { n: 13, find: ">Post score</span>", tag: "button", all: true },
    { n: 14, find: ">· 1 reference<", tag: "span" },
    { n: 15, find: 'aria-label="3 comments"', tag: "button" },
    { n: 15, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(16),
  ],
  ProfileComments: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="More about @ada"', tag: "button" },
    { n: 3, find: 'aria-label="Opinions on and by @ada"', tag: "button" },
    { n: 4, find: 'aria-label="Give your opinion on @ada"', tag: "button" },
    { n: 5, find: ">Message</button>", tag: "button" },
    { n: 6, find: 'aria-label="Posts"', tag: "button" },
    { n: 6, find: 'aria-label="Comments"', tag: "button" },
    { n: 6, find: 'aria-label="Everything"', tag: "button" },
    { n: 7, find: '<a href="/u/', tag: "a", all: true },
    { n: 8, find: 'aria-label="More on this comment"', tag: "button", all: true },
    { n: 9, find: 'aria-label="Your opinion on this comment', tag: "button", all: true },
    { n: 9, find: 'aria-label="Give your opinion on this comment"', tag: "button", all: true },
    { n: 9, find: ">Choose your opinion on this comment</button>", tag: "button", all: true },
    /* The own-profile skip-link ("@ada") is the profile's own stance control's
       accessible-text twin, not the comment's — via 4 (its face two rows up),
       matching ProfileOther's convention of stamping both the aria-label and
       the skip-link text under the same via (jakob 2026-09-10). */
    { n: 4, find: ">Choose your opinion on @ada</button>", tag: "button" },
    { n: 10, find: ">Reply</button>", tag: "button", all: true },
    { n: 11, find: "View 2 replies", tag: "button" },
    { n: 17, find: ">On “", tag: "button", all: true },
    ...nav(12),
  ],
  ProfileEdit: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Change picture</button>", tag: "button" },
    { n: 3, find: 'data-field="Display name"', tag: "div" },
    { n: 4, find: 'data-field="Bio"', tag: "div" },
    { n: 5, find: 'data-field="Website"', tag: "div" },
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

/* The settings round's three boards. A `SettingsRow` is anchored on its own
   label — the words are what a reader presses, and the row is the element the
   marker walks back to whichever variant it is (a button, or the label around
   a choice's radio). The stance choice's three radios share one number the way
   the chronicle's three tabs do: one control, one edge. */
Object.assign(FLOW_MARKERS, {
  Settings: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">Light</button>", tag: "button" },
    { n: 2, find: ">Dark</button>", tag: "button" },
    { n: 2, find: ">Auto</button>", tag: "button" },
    { n: 3, find: 'name="settings-stance-input"', tag: "label", all: true },
    { n: 4, find: ">Confirm multi-action submits</span>", tag: "button" },
    { n: 5, find: ">Default license</span>", tag: "button" },
    { n: 6, find: ">What your feed shows</span>", tag: "button" },
    { n: 7, find: ">Show exact values</span>", tag: "button" },
    { n: 8, find: ">Recovery code</span>", tag: "button" },
    { n: 9, find: ">Your key</span>", tag: "button" },
    { n: 10, find: ">Revoke</button>", tag: "button", all: true },
    { n: 11, find: ">Sign out everywhere else</span>", tag: "button" },
    { n: 12, find: ">Password</span>", tag: "button" },
    { n: 13, find: ">Handle</span>", tag: "button" },
    { n: 14, find: ">Email</span>", tag: "button" },
    { n: 15, find: ">Don&#x27;t remember this account on this device</span>", tag: "button" },
    { n: 16, find: ">Sign out</span>", tag: "button" },
    // The People group arrived after the page was numbered, and a row inserted
    // mid-page would renumber nine edges to say nothing new: the badge is an
    // identity, not a position.
    { n: 17, find: ">Hidden accounts</span>", tag: "button" },
    // Deleting the account is the page's last row and its next free number —
    // the same rule the People group followed, for the same reason.
    { n: 18, find: ">Delete account</span>", tag: "button" },
    // The About group, likewise: four rows added after the page was numbered,
    // taking the next four free numbers rather than the four they read at.
    { n: 19, find: ">Watch the intro again</span>", tag: "button" },
    { n: 20, find: ">About CoGra</span>", tag: "button" },
    { n: 21, find: ">Privacy</span>", tag: "button" },
    { n: 22, find: ">Terms</span>", tag: "button" },
  ],
  // The hidden-accounts sheet over the settings page (the private-viewer-state
  // round). scanExempt like its two siblings, so only the sheet is numbered —
  // and every Unhide is one control drawn three times, so they share a number.
  SettingsHidden: [
    { n: 1, find: ">Unhide</button>", tag: "button", all: true },
    { n: 2, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // Saved and History: the back arrow, the rows (one control, one number, drawn
  // once per row) and the bar.
  Saved: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">The long way home<", tag: "button" },
    { n: 2, find: ">The third headland light is real<", tag: "button" },
    { n: 2, find: ">Mira Voss<", tag: "button" },
    { n: 2, find: ">Sunday at the tide market<", tag: "button" },
    // The row's own unsave, drawn once per row — one edge covers all four.
    { n: 8, find: 'aria-label="Unsave"', tag: "button", all: true },
    ...nav(3),
  ],
  // The same list a moment after one row was unsaved. It borrows `Saved`'s
  // numbering — the same controls in the same places — and appends `Undo`
  // rather than inserting it, so no via renumbers.
  SavedUndo: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">The third headland light is real<", tag: "button" },
    { n: 2, find: ">Mira Voss<", tag: "button" },
    { n: 2, find: ">Sunday at the tide market<", tag: "button" },
    { n: 8, find: 'aria-label="Unsave"', tag: "button", all: true },
    { n: 9, find: ">Undo</button>", tag: "button" },
    ...nav(3),
  ],
  SavedEmpty: [{ n: 1, find: 'aria-label="Back to your profile"', tag: "a" }, ...nav(2)],
  History: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">Sunday at the tide market<", tag: "button" },
    { n: 2, find: ">The long way home<", tag: "button" },
    { n: 2, find: ">Low tide at six tomorrow", tag: "button" },
    { n: 2, find: ">Crossing at the narrows before the wind got up<", tag: "button" },
    { n: 2, find: ">The lake, doing nothing, for forty seconds<", tag: "button" },
    ...nav(3),
  ],
  HistoryEmpty: [{ n: 1, find: 'aria-label="Back to your profile"', tag: "a" }, ...nav(2)],
  SettingsBackup: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'data-field="Current recovery code"', tag: "div" },
    { n: 3, find: ">Create a new recovery code</button>", tag: "button" },
  ],
  YourKey: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'aria-label="Copy the PEM block"', tag: "button" },
    { n: 3, find: 'aria-label="Copy the raw hex"', tag: "button" },
  ],
  // Both key-absent twins carry the same three controls in the same order —
  // the back arrow, the panel's one "?", and the restore — because they draw
  // the same notice over two bodies.
  SettingsBackupKeyAbsent: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'aria-label="Your key"', tag: "button" },
    { n: 3, find: ">Restore the key</button>", tag: "button" },
  ],
  YourKeyAbsent: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'aria-label="Your key"', tag: "button" },
    { n: 3, find: ">Restore the key</button>", tag: "button" },
  ],
});

// The settings subpages (jakob's review 2026-09-09): the two sheets its rows
// open, and the three credential screens behind its Credentials rows.
//
// THE TWO SHEETS DRAW THE SETTINGS PAGE BENEATH THEM, which is why neither
// takes `FeedSheet`'s or `ComposeLicense`'s markers verbatim: the page under
// the wash has switches and a segmented pill of its own, so a `role="switch"`
// or `aria-pressed=` sweep would badge the theme control through the scrim.
// The sheet's own controls are matched by what only they carry — the chip's
// pill geometry, the order options' words.
Object.assign(FLOW_MARKERS, {
  SettingsLicense: [
    { n: 1, find: 'aria-label="License"', tag: "button" },
    { n: 2, find: 'data-axis="credit"', tag: "label", all: true },
    { n: 3, find: 'data-axis="record"', tag: "label", all: true },
    { n: 4, find: ">Done</button>", tag: "button" },
    { n: 5, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  SettingsReading: [
    { n: 1, find: 'aria-label="How the filter works"', tag: "button" },
    { n: 2, find: 'style="display:inline-flex;align-items:center;position:relative;height:32px', tag: "button", all: true },
    { n: 3, find: ">Ranked</button>", tag: "button" },
    { n: 3, find: ">Newest</button>", tag: "button" },
    { n: 4, find: "already seen", tag: "label" },
    { n: 5, find: ">Reset</button>", tag: "button" },
    { n: 6, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // Two password fields, one reveal affordance: the toggle is the same control
  // drawn twice, so it carries one number on both — the rule the repeated
  // per-post controls keep.
  ChangePassword: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'data-field="Current password"', tag: "div" },
    { n: 3, find: 'data-field="New password"', tag: "div" },
    { n: 4, find: 'aria-label="Show password"', tag: "button", all: true },
    { n: 5, find: ">Change password</button>", tag: "button" },
  ],
  ChangeHandle: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'data-field="New handle"', tag: "div" },
    { n: 3, find: ">Change handle</button>", tag: "button" },
  ],
  ChangeEmail: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'data-field="New email"', tag: "div" },
    { n: 3, find: 'data-field="Current password"', tag: "div" },
    { n: 4, find: 'aria-label="Show password"', tag: "button" },
    { n: 5, find: ">Change email</button>", tag: "button" },
  ],
  ChangeEmailConfirm: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: 'data-field="Confirmation code"', tag: "div" },
    { n: 3, find: ">Confirm the code</button>", tag: "button" },
  ],
});

// The entry round's boards, componentized off the real masters (input-errors
// bite 1, 2026-09-03): PasswordField and Checkbox bring their own real
// <input>/<button> elements the hand markup only drew as shapes, so every
// field and toggle carries its own number now, matched by `id` where the
// field starts empty (no distinguishing value text to key off).
Object.assign(FLOW_MARKERS, {
  Join: [
    { n: 8, find: 'aria-label="About CoGra"', tag: "button" },
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Handle"', tag: "div" },
    { n: 3, find: 'data-field="Email"', tag: "div" },
    { n: 4, find: 'data-field="Password"', tag: "div" },
    { n: 5, find: 'aria-label="Show password"', tag: "button" },
    { n: 6, find: ">Create account</button>", tag: "button" },
    { n: 7, find: ">Already have an account? Sign in</button>", tag: "button" },
  ],
  SignIn: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Email"', tag: "div" },
    { n: 3, find: 'data-field="Password"', tag: "div" },
    { n: 4, find: 'aria-label="Show password"', tag: "button" },
    { n: 5, find: "Don&#x27;t remember this account on this device", tag: "label" },
    { n: 6, find: ">Sign in</button>", tag: "button" },
    { n: 7, find: ">Forgot password?</button>", tag: "button" },
    { n: 8, find: ">New here? Enter your invite</button>", tag: "button" },
    { n: 9, find: ">Just looking? Browse the feed", tag: "button" },
    { n: 10, find: ">On Android? Download the app (APK)</button>", tag: "button" },
  ],
  Restore: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Recovery code"', tag: "div" },
    { n: 3, find: "Don&#x27;t remember this account on this device", tag: "label" },
    { n: 4, find: ">Restore the key</button>", tag: "button" },
  ],
  RecoveryCode: [
    { n: 1, find: ">Copy</button>", tag: "button" },
    { n: 2, find: 'data-field="Type or paste the code to confirm"', tag: "div" },
    { n: 3, find: ">I&#x27;ve written it down</button>", tag: "button" },
  ],
});

/* The errored boards (input-errors bite 3, 2026-09-03): each copies its
   parent's control anatomy exactly, so its markers reuse the parent's
   `find` patterns 1:1 — the error props change styling and a supporting
   line, never the elements a reader can tap. */
Object.assign(FLOW_MARKERS, {
  JoinErrors: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Handle"', tag: "div" },
    { n: 3, find: 'data-field="Email"', tag: "div" },
    { n: 4, find: 'data-field="Password"', tag: "div" },
    { n: 5, find: 'aria-label="Show password"', tag: "button" },
    { n: 6, find: ">Create account</button>", tag: "button" },
    { n: 7, find: ">Already have an account? Sign in</button>", tag: "button" },
  ],
  SignInError: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Email"', tag: "div" },
    { n: 3, find: 'data-field="Password"', tag: "div" },
    { n: 4, find: 'aria-label="Show password"', tag: "button" },
    { n: 5, find: "Don&#x27;t remember this account on this device", tag: "label" },
    { n: 6, find: ">Sign in</button>", tag: "button" },
    { n: 7, find: ">Forgot password?</button>", tag: "button" },
    { n: 8, find: ">New here? Enter your invite</button>", tag: "button" },
    { n: 9, find: ">Just looking? Browse the feed", tag: "button" },
    { n: 10, find: ">On Android? Download the app (APK)</button>", tag: "button" },
  ],
  RestoreError: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Recovery code"', tag: "div" },
    { n: 3, find: "Don&#x27;t remember this account on this device", tag: "label" },
    { n: 4, find: ">Restore the key</button>", tag: "button" },
  ],
  RecoveryCodeMismatch: [
    { n: 1, find: ">Copy</button>", tag: "button" },
    { n: 2, find: 'data-field="Type or paste the code to confirm"', tag: "div" },
    { n: 3, find: ">I&#x27;ve written it down</button>", tag: "button" },
  ],
});

/* The entry-and-keys family, converted off the masters (legacy-conversion lane
   A, 2026-09-04): the eight boards that had only hand markup until now. The
   via numbers are the hand boards' own — every one of them re-anchored to the
   element the master renders in that slot, so graph.json needed no edit. The
   fields key off `id` (they start empty, so there is no value text to key
   off), and the back arrows off PageHeader's accessible name. */
Object.assign(FLOW_MARKERS, {
  InviteEntry: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Invite link"', tag: "div" },
    { n: 3, find: ">Continue</button>", tag: "button" },
    { n: 4, find: ">Already have an account? Sign in</button>", tag: "button" },
    { n: 5, find: ">Just looking? Browse the feed", tag: "button" },
  ],
  InviteEntryError: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Invite link"', tag: "div" },
    { n: 3, find: ">Continue</button>", tag: "button" },
    { n: 4, find: ">Already have an account? Sign in</button>", tag: "button" },
    { n: 5, find: ">Just looking? Browse the feed", tag: "button" },
  ],
  JoinInvalid: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Invite link"', tag: "div" },
    { n: 3, find: ">Continue</button>", tag: "button" },
    { n: 4, find: ">Already have an account? Sign in</button>", tag: "button" },
    { n: 5, find: ">Just looking? Browse the feed", tag: "button" },
  ],
  Reset: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'data-field="Email"', tag: "div" },
    { n: 3, find: ">Send reset link</button>", tag: "button" },
  ],
  // No back arrow: a mail link has no previous screen of ours behind it.
  ResetNew: [
    { n: 1, find: 'data-field="New password"', tag: "div" },
    { n: 2, find: 'aria-label="Show password"', tag: "button" },
    { n: 3, find: ">Set the new password</button>", tag: "button" },
  ],
  KeyCeremony: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Create my recovery code</button>", tag: "button" },
    { n: 3, find: ">Not now</button>", tag: "button" },
  ],
  // The ceremony's two dialogs. Both are scanExempt: the arrow and the words
  // beneath the scrim are inactive while the ask is open, so only the
  // dialog's own pair carries a number — the hand boards stamped exactly
  // these two and left the arrow bare.
  KeyConfirm: [
    { n: 1, find: ">Cancel</button>", tag: "button" },
    { n: 2, find: ">Show my code</button>", tag: "button" },
  ],
  KeyDecline: [
    { n: 1, find: ">I accept the risk</button>", tag: "button" },
    { n: 2, find: ">Go back</button>", tag: "button" },
  ],
  Verified: [{ n: 1, find: ">Back to CoGra</button>", tag: "button" }],
  // Neither draws a back arrow: a mail link has no previous screen of ours.
  VerifiedApp: [{ n: 1, find: ">Go to the feed</button>", tag: "button" }],
  VerifyExpired: [
    { n: 1, find: ">Resend the link</button>", tag: "button" },
    { n: 2, find: ">Go to the feed</button>", tag: "button" },
  ],
  // The ask over the borrowed view, also scanExempt. TWO "Sign in or join"
  // buttons stand on this board — the band's and the ask's — and both take
  // the number, the way the comments page's under-scrim repeats do: one edge
  // covers them, because both words lead to the same screen.
  GuestGate: [
    { n: 1, find: ">Keep browsing</button>", tag: "button" },
    { n: 2, find: ">Sign in or join</button>", tag: "button", all: true },
  ],
});

/* The reply and edit wizards, the two overlays and the pattern boards
   (legacy-conversion lane C, 2026-09-04): the last nine boards that had only
   hand markup. Their via numbers are the hand boards' own — every one
   re-anchored to the element the master renders in that slot, so graph.json
   needed no edit. Five of the nine are overlay states and were already drawn
   with only the top layer live; they take a `scanExempt` line saying so, and
   `NetworkError` takes one saying why a pattern exemplar wires only its
   retry. */
Object.assign(FLOW_MARKERS, {
  ReplyCompose: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: ">Next</button>", tag: "button" },
    // The words the reply is made of — the body itself is the "control",
    // the way the composer boards stamp their fields.
    { n: 4, find: "The third headland light is real", tag: "p" },
    { n: 5, find: "+ Add pictures or a video", tag: "button" },
  ],
  ReplyPad: [
    { n: 1, find: 'aria-label="Toward what you answer"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion pad for the post you answer"', tag: "div" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
    { n: 5, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  // The bare seal. `ReplyCited` is this list plus its staged reference's ×.
  ReplySeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — the reply is discarded"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: "+ Add a tag", tag: "button" },
    { n: 5, find: "+ Cite something", tag: "button" },
    { n: 6, find: ">Adjust</button>", tag: "button" },
    { n: 7, find: ">Change</button>", tag: "button" },
    { n: 8, find: ">Mark</button>", tag: "button" },
    { n: 9, find: ">Sign comment</button>", tag: "button" },
    { n: 10, find: ">Back</button>", tag: "button" },
  ],
  EditCompose: [
    { n: 14, find: "aria-label=\"#fieldnotes — set how it relates\"", tag: "button" },
    { n: 14, find: "aria-label=\"#saltmaps — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: 'aria-label="Manage the pictures"', tag: "button" },
    { n: 5, find: 'data-field="Title"', tag: "div" },
    { n: 6, find: 'data-field="Description"', tag: "div" },
    { n: 7, find: 'aria-label="Remove #fieldnotes"', tag: "button" },
    { n: 7, find: 'aria-label="Remove #saltmaps"', tag: "button" },
    { n: 8, find: "+ Add a tag", tag: "button" },
    { n: 9, find: 'aria-label="Remove The long way home', tag: "button" },
    { n: 10, find: "+ Cite something", tag: "button" },
    { n: 11, find: "signing 3 things", tag: "button" },
    { n: 12, find: ">Sign the edit</button>", tag: "button" },
    { n: 13, find: ">Mark</button>", tag: "button" },
    { n: 15, find: "aria-label=\"The long way home — @ada — set how it relates\"", tag: "button" },
    { n: 16, find: "+ Add pictures · 2 of 10", tag: "button" },
  ],
  /* The same edit with an empty batch — `EditCompose`'s markers, minus the one
     control that stops being one. The acts footer is a plain span at zero, so
     it carries no number and has no edge; the Sign is still a button, disabled,
     and its edge says out loud that it goes nowhere. */
  EditComposeUnchanged: [
    { n: 14, find: "aria-label=\"#fieldnotes — set how it relates\"", tag: "button" },
    { n: 14, find: "aria-label=\"#saltmaps — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: 'aria-label="Manage the pictures"', tag: "button" },
    { n: 5, find: 'data-field="Title"', tag: "div" },
    { n: 6, find: 'data-field="Description"', tag: "div" },
    { n: 7, find: 'aria-label="Remove #fieldnotes"', tag: "button" },
    { n: 7, find: 'aria-label="Remove #saltmaps"', tag: "button" },
    { n: 8, find: "+ Add a tag", tag: "button" },
    { n: 9, find: 'aria-label="Remove The long way home', tag: "button" },
    { n: 10, find: "+ Cite something", tag: "button" },
    { n: 12, find: ">Sign the edit</button>", tag: "button" },
    { n: 13, find: ">Mark</button>", tag: "button" },
    { n: 15, find: "aria-label=\"The long way home — @ada — set how it relates\"", tag: "button" },
    { n: 16, find: "+ Add pictures · 2 of 10", tag: "button" },
  ],
  // Show all over the edit. The sheet is the same `PickedSheet` ComposePicked
  // draws, so the markers are its markers — but the REMOVE anchors are spelled
  // exactly rather than by the "Remove" prefix, because the edit beneath this
  // sheet has remove buttons of its own (its tag chips, its staged citation)
  // and a prefix match with `all` would badge them through the scrim.
  EditPicked: [
    { n: 1, find: "cursor:grab", tag: "span", all: true },
    { n: 2, find: ">Describe</button>", tag: "button" },
    { n: 3, find: 'aria-label="Remove the cover"', tag: "button" },
    { n: 3, find: 'aria-label="Remove picture 2"', tag: "button" },
    { n: 4, find: ">Done</button>", tag: "button" },
    { n: 5, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  // The words edit. Marker 4 is the growing body box, anchored on the field
  // border: it is the FIRST such border on the board, standing above the
  // title's own field, and `applyFlowMarkers` takes the first match.
  EditWords: [
    { n: 12, find: "aria-label=\"#fieldnotes — set how it relates\"", tag: "button" },
    { n: 12, find: "aria-label=\"#saltmaps — set how it relates\"", tag: "button" },
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="Editing"', tag: "button" },
    { n: 4, find: "1px solid var(--border-field)", tag: "div" },
    { n: 5, find: "+ Add pictures or a video", tag: "button" },
    { n: 6, find: 'data-field="Title"', tag: "div" },
    { n: 7, find: 'aria-label="Remove #fieldnotes"', tag: "button" },
    { n: 7, find: 'aria-label="Remove #saltmaps"', tag: "button" },
    { n: 8, find: "+ Add a tag", tag: "button" },
    { n: 9, find: "signing 3 things", tag: "button" },
    { n: 10, find: ">Sign the edit</button>", tag: "button" },
    { n: 11, find: ">Mark</button>", tag: "button" },
  ],
  EditActs: [
    { n: 1, find: ">Done</button>", tag: "button" },
    { n: 2, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  NetworkError: [{ n: 1, find: ">Retry</button>", tag: "button" }],
  // TWO "Restore the key" buttons stand on this board — the feed's own card
  // beneath the wash and the pad's notice above it — and both take the number,
  // the way the guest gate's two asks do: one edge covers them, because both
  // words lead to the same screen.
  PadKeyAbsent: [
    { n: 1, find: 'aria-label="Your key"', tag: "button" },
    { n: 2, find: ">Restore the key</button>", tag: "button", all: true },
    { n: 3, find: ">Keep it pending, restore later</button>", tag: "button" },
  ],
  // The pad's one irreversible gesture. scanExempt like every dialog board, so
  // only the dialog's own pair and the scrim it sits on carry numbers.
  SeveranceConfirm: [
    { n: 1, find: ">Walk it back</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
    { n: 3, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  HelpDialog: [
    { n: 1, find: ">Close</button>", tag: "button" },
    { n: 2, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  ReplyPadHelp: [
    { n: 1, find: ">Close</button>", tag: "button" },
    { n: 2, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  DiscardConfirm: [
    { n: 1, find: ">Keep writing</button>", tag: "button" },
    { n: 2, find: ">Discard</button>", tag: "button" },
  ],
});

/* THE NOTIFICATIONS ROUND'S THREE BOARDS. The list borrows the chronicle's row
   anatomy, and each row is its own via — seven kinds, seven destinations. The
   lit feed is `Feed`'s numbering exactly; only its bell's accessible name
   differs, which is why that marker sits here and not in the sweep below. */
Object.assign(FLOW_MARKERS, {
  Notifications: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">@ada commented on your post<", tag: "button" },
    { n: 3, find: ">@tobias replied to your comment<", tag: "button" },
    { n: 4, find: ">@sol gave an opinion on you<", tag: "button" },
    { n: 5, find: ">@mira mentioned you<", tag: "button" },
    { n: 6, find: ">@ada cited your post<", tag: "button" },
    { n: 7, find: ">@juno landed through your invite<", tag: "button" },
    { n: 8, find: ">@mira approved your application<", tag: "button" },
    ...nav(9),
    // The eighth kind arrived after the list was numbered, and a row inserted
    // mid-list would renumber five nav edges to say nothing new: the badge is
    // an identity, not a position (the settings page's own rule).
    { n: 14, find: ">@rafa is ready for your approval<", tag: "button" },
    // The ninth, the eighth's twin (the reject extension), taking its next
    // free number for the same reason.
    { n: 15, find: ">@kel closed your application<", tag: "button" },
  ],
  /* ── The Post score’s drill-down (backlog item 13) ─────────────────────
     The path rows and the step rows carry one number each: they are one control
     the reader meets four times and twice, exactly as a repeated per-post control
     is, so one edge covers them (readme §13, canvas pages and flows). Each is
     found by the words it ends on rather than by an accessible name, because the
     row IS its content — a label naming it "a path" would say less than the
     trace already does. */
  FeedEntry: [
    { n: 1, find: `aria-label="Back to the post"`, tag: "a" },
    { n: 2, find: ">Through ", tag: "button", all: true },
    { n: 3, find: `aria-label="Show 2 more paths"`, tag: "button" },
    ...nav(4),
  ],
  FeedEntryMoved: [
    { n: 1, find: `aria-label="Back to the post"`, tag: "a" },
    ...nav(2),
  ],
  RankPath: [
    { n: 1, find: `aria-label="Back to the paths"`, tag: "a" },
    { n: 2, find: "border-radius:var(--radius-medium);background:var(--surface-card);padding:var(--space-3)", tag: "button", all: true },
    ...nav(3),
  ],
  RankHop: [
    { n: 1, find: `aria-label="Back to the path"`, tag: "a" },
    { n: 2, find: ">Show them</button>", tag: "button" },
    ...nav(3),
  ],
  RankRecords: [
    { n: 1, find: `aria-label="Back to the step"`, tag: "a" },
    ...nav(2),
  ],
  /* The opinions sheet (backlog item 55). Its rows are `StanceRow`s and carry no
     accessible name of their own — the person IS the row — so the marker finds
     the master’s own geometry, the way the media markers find a crop’s
     aspect ratio. */
  PostOpinions: [
    { n: 1, find: "min-height:56px;border:0;background:none;padding:6px 16px", tag: "button", all: true },
    { n: 2, find: `class="cg-scrim-in"`, tag: "div", all: true },
  ],
  CommentOpinionsEmpty: [
    { n: 1, find: `class="cg-scrim-in"`, tag: "div", all: true },
  ],
  /* The inbound sheet and its empty twin — the opinions pair's anatomy exactly,
     because they are the same two doors onto a different list. */
  CitedBy: [
    { n: 1, find: "min-height:var(--touch-target-min);width:100%;border:0", tag: "button", all: true },
    { n: 2, find: `class="cg-scrim-in"`, tag: "div", all: true },
  ],
  CommentCitedByEmpty: [
    { n: 1, find: `class="cg-scrim-in"`, tag: "div", all: true },
  ],
  NotificationsEmpty: [{ n: 1, find: 'aria-label="Back"', tag: "a" }, ...nav(2)],
  /* The chats coming-soon screen (item 68) numbers like the bell's empty list:
     the same back-plus-nav anatomy, because it is the same list surface with
     nothing in it. */
  ChatsComingSoon: [{ n: 1, find: 'aria-label="Back"', tag: "a" }, ...nav(2)],
  FeedUnread: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(11),
    { n: 18, find: 'aria-label="Notifications — something new"', tag: "button" },
  ],
});

/* The account-deletion round (jakob 2026-09-11). The request screen and its
   mail state are task-flow columns and number like the credential screens; the
   grace state and its cancel are `Feed`'s numbering exactly, for `FeedUnread`'s
   reason — they draw the same root under a band and a snackbar, so a different
   numbering would say the surface changed when only the shell did. The band's
   Cancel takes the board's next free number after the three sweeps below. */
Object.assign(FLOW_MARKERS, {
  DeleteAccount: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: ">Also remove what I posted</span>", tag: "label" },
    { n: 3, find: ">Send the confirmation link</button>", tag: "button" },
  ],
  DeleteAccountMail: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: ">Resend the link</button>", tag: "button" },
  ],
  FeedDeleting: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(11),
    { n: 19, find: ">Cancel</button>", tag: "button" },
  ],
  DeleteAccountCanceled: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    ...signedPost({ author: 2, menu: 3, more: 5, topic: 6, stance: 8, score: 9 }),
    { n: 4, find: "aspect-ratio:1.91 / 1", tag: "div" },
    { n: 7, find: ">· 1 reference<", tag: "span" },
    { n: 10, find: 'aria-label="3 comments"', tag: "button" },
    { n: 10, find: 'aria-label="1 comment"', tag: "button" },
    ...nav(11),
  ],
  // The husk's page is the other-profile page with its identity placeholdered
  // (the redacted-actor law), so it wires like one — minus Message, which needs
  // a person there is none of. The ⋮ is appended last (jakob 2026-09-12), so no
  // via on this board renumbers behind it.
  ProfileDeleted: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="Opinions on and by this account"', tag: "button" },
    { n: 3, find: 'aria-label="Give your opinion on this account"', tag: "button" },
    { n: 3, find: ">Choose your opinion on this account</button>", tag: "button" },
    { n: 4, find: 'aria-label="Posts"', tag: "button" },
    { n: 4, find: 'aria-label="Comments"', tag: "button" },
    { n: 4, find: 'aria-label="Everything"', tag: "button" },
    { n: 5, find: "Three mornings on the wall", tag: "button" },
    { n: 5, find: "The tunnel is faster", tag: "button" },
    { n: 5, find: "Low sun on the salt crust", tag: "button" },
    ...nav(6),
    { n: 11, find: 'aria-label="More about this account"', tag: "button" },
  ],
});

/* THE REJECT EXTENSION'S TWO BOARDS (jakob 2026-09-15). They are declared
   ABOVE the three band sweeps on purpose: a sweep pushes onto
   `FLOW_MARKERS[board] ??= []`, so an Object.assign running after one would
   replace the array it filled and drop the markers it had just added.

   `ApplicantRejected` IS `ApplicantWaiting`'S NUMBERING, to the number. It is
   the same shell with one card swapped, so every control it shares keeps the
   badge it already had — the three sweeps below name it beside its sibling at
   the same numbers — and the card's own control takes 17, the number the
   dismissal it replaced was using. A board that renumbers what it inherited
   makes two boards of one anatomy disagree for no reason.

   `VouchAskPad` IS `ApprovePad`'S, for the same reason: the same pad doing the
   same act, so the same four numbers in the same order. Its card's `Not now`
   and its way back sit under the wash and carry none, exactly as
   `VouchBackPad`'s do — they carry their numbers one board earlier instead, on
   `VouchAsk`, which is the same surface with the pad closed and nothing
   dimmed. The landing numbers what a landing has: the way back, the decline,
   and the affordance that opens the pad. */
Object.assign(FLOW_MARKERS, {
  ApplicantRejected: [
    ...post({ author: 1, menu: 2, media: 3, more: 4, topic: 5, refs: 6, stance: 7, score: 8, comments: 9 }),
    secondComments(9),
    ...nav(10),
    { n: 17, find: 'aria-label="Copy your ask link"', tag: "button" },
  ],
  VouchAsk: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Not now</button>", tag: "button" },
    { n: 3, find: 'aria-label="Give your opinion on @noor"', tag: "button" },
    { n: 3, find: ">Choose your opinion on @noor</button>", tag: "button" },
  ],
  VouchAskPad: [
    { n: 1, find: 'aria-label="How vouching works"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion', tag: "div" },
    { n: 2, find: ">Choose your opinion on @noor</button>", tag: "button" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
  ],
});

/* The band's Chats affordance (jakob 2026-09-01): CograBand carries it on
   every tab root, so every wired band board gets the marker in one sweep —
   the number is each board's next free one, the edge points at the chat
   surface's gap (guest boards: the guest gate's). */
const BAND_CHATS = {
  Main: 18, FeedBare: 18, ApplicantFeed: 18, ApplicantWaiting: 15,
  ApplicantRejected: 15,
  VouchBack: 18, KeyElsewhere: 17, ComposeExpired: 18, Explore: 8,
  Feed: 16, FeedUnread: 16, FeedScrolled: 16, FeedDeleting: 16, DeleteAccountCanceled: 16,
  FeedNarrowed: 16, FeedNothing: 8, FeedFar: 16, FeedHidden: 15, FeedTopic: 15,
  FeedGallery: 15, FeedCover: 17,
  WalletComingSoon: 6,
};
for (const [board, n] of Object.entries(BAND_CHATS)) {
  (FLOW_MARKERS[board] ??= []).push({ n, find: 'aria-label="Chats"', tag: "button" });
}

/* THE BELL RIDES THE BAND (jakob 2026-09-11), right-most on every bottom-bar
   root, so it sweeps exactly as chats does: each board's next free number, and
   one edge each into the notifications list. The guest boards are absent
   because they opt out of the bell — nothing can be addressed to an account
   that does not exist. `FeedUnread` is absent because its bell wears the unread
   name and carries its marker in its own list above. */
const BAND_BELL = {
  ApplicantFeed: 20, ApplicantWaiting: 18, VouchBack: 20, KeyElsewhere: 19,
  ApplicantRejected: 18,
  ComposeExpired: 20, Explore: 9,
  Feed: 18, FeedScrolled: 18, FeedDeleting: 18, DeleteAccountCanceled: 18,
  FeedNarrowed: 18, FeedNothing: 9, FeedFar: 18, FeedGallery: 17, FeedHidden: 17, FeedTopic: 17,
  FeedCover: 19,
  WalletComingSoon: 7,
  Profile: 15, ProfileApplicant: 15,
};
for (const [board, n] of Object.entries(BAND_BELL)) {
  (FLOW_MARKERS[board] ??= []).push({ n, find: 'aria-label="Notifications"', tag: "button" });
}

/* SHARE JOINED THE ACTION ROW (jakob, review round 1), so every board drawing a
   post card grew one control. Like the band's chats, it is stamped in one sweep
   at each board's next free number — one edge each, all of them handing off to
   the platform's own sheet. */
const CARD_SHARE = {
  Main: 19, FeedBare: 19, ApplicantFeed: 19, ApplicantWaiting: 16, VouchBack: 19,
  ApplicantRejected: 16,
  KeyElsewhere: 18, Feed: 17, FeedUnread: 17, FeedDeleting: 17, DeleteAccountCanceled: 17,
  FeedNarrowed: 17, FeedScrolled: 17, FeedFar: 17, FeedGallery: 16, FeedHidden: 16, FeedTopic: 16,
  FeedCover: 18, ComposeExpired: 19, ComposeLanded: 14, Removed: 11, ProfilePosts: 21,
};
for (const [board, n] of Object.entries(CARD_SHARE)) {
  (FLOW_MARKERS[board] ??= []).push({ n, find: 'aria-label="Share this post"', tag: "button", all: true });
}

/* THE TAG ROUND'S FIVE BOARDS. The page borrows the feed card's whole anatomy,
   so it borrows the feed boards' numbering with it; the two picker states
   borrow `ReferencePicker`'s.

   ONE VIA STILL CARRIES EVERY SKIP-LINK ON THE PAGE (backlog item 46.1). The
   skip-link's text now names its target — `StanceControl`'s `targetLabel`,
   the same source the face beside it reads — so the three on this page (two
   posts, one comment) no longer share one anonymous "Choose your opinion". The
   VIA NUMBERING ITSELF is unchanged here: it is still one edge for all three,
   where each FACE keeps its own (a post's, a comment's). Splitting the via to
   match is a graph.json call, left standing for jakob to rule on. THE TOPIC'S
   OWN skip-link (the topic round, 2026-09-14) joins via 2 under that same
   convention \u2014 it is the page's accessible path, and the page has one; its
   FACE takes the next free number, 15, because every other face on the page
   has its own.

   BOTH STATES OF THE PAGE READ THE SAME LIST. The body is one helper
   (`TagPageBody`), so the markers are one list too: `topicStance` is the only
   thing the held state changes, since an anchor with a bundle behind it says so
   in its accessible name. */
const tagPageBody = ({ topicStance }) => [
  { n: 1, find: 'aria-label="Back to Explore"', tag: "a" },
  { n: 2, find: ">Choose your opinion on #saltmaps</button>", tag: "button" },
  { n: 2, find: ">Choose your opinion on this post</button>", tag: "button", all: true },
  { n: 2, find: ">Choose your opinion on this comment</button>", tag: "button" },
  { n: 3, find: '<a href="/u/', tag: "a", all: true },
  { n: 4, find: 'aria-label="More on this post"', tag: "button", all: true },
  { n: 5, find: ">More</button>", tag: "button", all: true },
  { n: 6, find: "scroll-snap-type:x mandatory", tag: "div" },
  { n: 7, find: '<a href="/t/', tag: "a", all: true },
  { n: 8, find: 'aria-label="Your opinion on this post', tag: "button", all: true },
  { n: 9, find: ">Post score</span>", tag: "button", all: true },
  { n: 10, find: 'aria-label="2 comments"', tag: "button" },
  { n: 10, find: 'aria-label="1 comment"', tag: "button" },
  { n: 11, find: 'aria-label="Share this post"', tag: "button", all: true },
  { n: 12, find: ">On \u201c", tag: "button", all: true },
  { n: 13, find: 'aria-label="More on this comment"', tag: "button" },
  { n: 14, find: 'aria-label="Your opinion on this comment', tag: "button" },
  { n: 15, find: topicStance, tag: "button" },
];

Object.assign(FLOW_MARKERS, {
  TagPage: tagPageBody({ topicStance: 'aria-label="Give your opinion on #saltmaps"' }),
  /* The same page with the topic held \u2014 the same markers, one find apart: an
     anchor with a bundle behind it says so in its own accessible name. */
  TagPageHeld: tagPageBody({ topicStance: 'aria-label="Your opinion on #saltmaps' }),
  /* The topic's own pad, bloomed over the held page. `PadStanding`'s five
     numbers exactly — same anatomy, the walk-away taking the third and the two
     decisions shifting past it — because the record family changes the words
     at the edges and nothing else. Only the PAD's controls are stamped: the
     page beneath is drawn whole and its own controls are `TagPageHeld`'s, read
     on that board. The "?" keeps the ordinary control's name, since a named
     pad belongs to a board that named it (ruling A7) and this one does not. */
  TagPageHeldPad: [
    { n: 1, find: 'aria-label="How opinions work"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion pad for #saltmaps"', tag: "div" },
    { n: 2, find: ">Choose your opinion on #saltmaps</button>", tag: "button" },
    { n: 3, find: ">Disconnect</button>", tag: "button" },
    { n: 4, find: ">Cancel</button>", tag: "button" },
    { n: 5, find: ">Set</button>", tag: "button" },
  ],
  /* The emptied page carries the topic's own row and nothing else, so the two
     numbers the row needs are the two it gets: the page's accessible path at 2,
     by the family's convention, and the face at the next free number — which
     here is 3, because no post or comment face stands between them. */
  TagPageEmpty: [
    { n: 1, find: 'aria-label="Back to Explore"', tag: "a" },
    { n: 2, find: ">Choose your opinion on #slipwaylight</button>", tag: "button" },
    { n: 3, find: 'aria-label="Give your opinion on #slipwaylight"', tag: "button" },
  ],
  TagPicker: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: 'aria-label="How searching works"', tag: "button" },
    { n: 3, find: ">salt<", tag: "div" },
    { n: 4, find: ">saltmaps<", tag: "button" },
    { n: 4, find: ">saltmarsh<", tag: "button" },
    { n: 4, find: ">saltcrust<", tag: "button" },
    { n: 4, find: ">saltflats<", tag: "button" },
  ],
  TagPickerTyping: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: 'aria-label="How searching works"', tag: "button" },
    { n: 3, find: ">#SaltMaps<", tag: "div" },
    { n: 4, find: ">saltmaps<", tag: "button" },
  ],
  TagPickerRefused: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: 'aria-label="How searching works"', tag: "button" },
    { n: 3, find: ">#salt maps<", tag: "div" },
  ],
  TagPad: [
    { n: 1, find: 'aria-label="The pair this tag signs"', tag: "div" },
    { n: 2, find: ">Un-tag</button>", tag: "button" },
    { n: 3, find: ">Done</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The composer's twin of the pad. It has no `Withdraw` — nothing is signed on
  // that path yet — so its three live things are the pad, `Done` and the scrim.
  TagPadCompose: [
    { n: 1, find: 'aria-label="The pair this tag signs"', tag: "div" },
    { n: 2, find: ">Done</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The citation's twin of TagPad — the same pad over two signed axes, because
  // both of a citation's parameters are signed. Same three controls.
  RefPair: [
    { n: 1, find: 'aria-label="The pair this citation signs"', tag: "div" },
    { n: 2, find: ">Done</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
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

/* THE INVITES ROUND'S SEVEN BOARDS (2026-09-15).

   `Invites` IS THE ONLY ONE THAT SCANS. The other five over it are `scanExempt`
   — a sheet, a wash or a dialog covers the page, and what is covered is inert —
   so they number the surface on top and nothing beneath it.

   A REPEATED CONTROL KEEPS ONE NUMBER, the rule the feed's post cards and the
   Saved list's Unsave already follow. Two live-link cards means two copies and
   two Revokes, and on `InviteCreated` a third copy inside the sheet: one act,
   one outcome, one edge. The sheet carries one copy control and it is the
   link's: the link is the only shape the capability takes on screen.

   THE CLOSE IS ONE CONTROL ON TWO ROWS, so one edge covers it — and the dialog
   it raises names one of them, the way `SeveranceConfirm` names one target for
   the two routes into it. */
Object.assign(FLOW_MARKERS, {
  Invites: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">New invite</button>", tag: "button" },
    { n: 3, find: ">@imke<", tag: "button" },
    { n: 3, find: ">@vora81<", tag: "button" },
    { n: 3, find: ">@vora82<", tag: "button" },
    { n: 3, find: ">@vora83<", tag: "button" },
    { n: 4, find: ">@rafa<", tag: "button" },
    { n: 5, find: 'aria-label="Close @imke&#x27;s application"', tag: "button" },
    { n: 5, find: 'aria-label="Close @vora81&#x27;s application"', tag: "button" },
    { n: 5, find: 'aria-label="Close @vora82&#x27;s application"', tag: "button" },
    { n: 5, find: 'aria-label="Close @vora83&#x27;s application"', tag: "button" },
    { n: 5, find: 'aria-label="Close @rafa&#x27;s application"', tag: "button" },
    { n: 6, find: 'aria-label="Copy the link"', tag: "button", all: true },
    { n: 7, find: ">Revoke</button>", tag: "button", all: true },
    { n: 8, find: ">Close all</button>", tag: "button" },
  ],
  RejectAllConfirm: [
    { n: 1, find: ">Close them</button>", tag: "button" },
    { n: 2, find: ">Keep them</button>", tag: "button" },
    { n: 3, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
  InvitesEmpty: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">Create invite</button>", tag: "button" },
  ],
  InviteNew: [
    { n: 1, find: ">Only one person can use it</span>", tag: "button" },
    { n: 2, find: ">Expires after</span>", tag: "button" },
    { n: 3, find: ">Create invite</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // Two sheets, two washes, one number: outside the sheet is outside it
  // (`CommentMenu`'s own rule, cited).
  InviteExpiry: [
    { n: 1, find: 'name="invite-expiry"', tag: "label", all: true },
    { n: 2, find: 'class="cg-scrim-in"', tag: "div", all: true },
  ],
  InviteCreated: [
    { n: 1, find: 'aria-label="Copy the link"', tag: "button", all: true },
    { n: 2, find: ">Share link</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // The pad's own anatomy, `VouchBackPad`'s numbering exactly — the same four
  // controls in the same order, because it is the same master doing the same
  // job from the other side of the handshake. No `Walk it back`: a first vouch
  // has no bundle to walk back, so the third number is Cancel here as it is
  // there. The wash carries no edge, likewise: it is a wash, and the pad's own
  // Cancel is the way out.
  ApprovePad: [
    { n: 1, find: 'aria-label="How vouching works"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion', tag: "div" },
    { n: 2, find: ">Choose your opinion on @rafa</button>", tag: "button" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
  ],
  RejectConfirm: [
    { n: 1, find: ">Close it</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
    { n: 3, find: "background:var(--scrim-dialog)", tag: "div" },
  ],
});

// The onboarding intro (the batch-rulings round). Two controls per card and the
// same two numbers on all five, because it is one frame drawn five times: Skip
// leads, the way it stands top-right on every card, and the forward button
// follows. The pager dots carry no number — they are an indicator, not a
// control (`_shared.jsx`, the intro block).
// The About page: the way out, and the nine topic rows.
Object.assign(FLOW_MARKERS, {
  About: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    // Nine rows, one control doing the same thing to its own topic — so they
    // share a number the way a feed's repeated per-post controls do, and one
    // edge covers them all.
    { n: 2, find: "aria-expanded=", tag: "button", all: true },
  ],
});

const introCard = (forward) => [
  { n: 1, find: ">Skip</button>", tag: "button" },
  { n: 2, find: `>${forward}</button>`, tag: "button" },
];

Object.assign(FLOW_MARKERS, {
  OnboardingSteps: introCard("Next"),
  OnboardingShape: introCard("Next"),
  OnboardingPublic: introCard("Next"),
  OnboardingLayers: introCard("Next"),
  OnboardingVouch: introCard("Start reading"),
});

/* THE POST-MVP TREE'S BOARDS (the push round, 2026-09-22).

   THIS TABLE IS KEYED BY BOARD NAME ACROSS EVERY TREE, which is why a
   post-MVP board never takes a canonical board's name: two `Settings` would
   stamp one tree's numbers onto the other's markup, and the mismatch would
   surface as a marker matching nothing rather than as the wrong badge — but
   only if the two boards happened to differ. The names carry their round.

   ONLY THE ROUND'S OWN CONTROLS ARE NUMBERED. The push page is not wired: its
   settings boards are EXCERPTS, and the rows on either side of the new group
   lead to canonical boards this tree's graph cannot name (readme §14 — a
   tree's graph stops at the tree). Numbering them would owe each one an edge,
   and the only honest edge available would be a gap that is not a gap. They
   get their numbers when the round migrates. */
Object.assign(FLOW_MARKERS, {
  PushSettings: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">Push notifications</span>", tag: "button" },
  ],
  PushKinds: [
    { n: 1, find: 'aria-label="Back to settings"', tag: "a" },
    { n: 2, find: ">Push notifications</span>", tag: "button" },
    { n: 3, find: ">Comments on your posts</span>", tag: "button" },
    { n: 4, find: ">Replies to your comments</span>", tag: "button" },
    { n: 5, find: ">Mentions of you</span>", tag: "button" },
    { n: 6, find: ">Citations of your posts and comments</span>", tag: "button" },
    { n: 7, find: ">Opinions on you</span>", tag: "button" },
    { n: 8, find: ">Applicants ready for your approval</span>", tag: "button" },
    { n: 9, find: ">People landing through your invites</span>", tag: "button" },
    { n: 10, find: ">Your application approved</span>", tag: "button" },
    { n: 11, find: ">Your application closed</span>", tag: "button" },
    { n: 12, find: ">Invitations to chats</span>", tag: "button" },
    { n: 13, find: ">Requests to join your chats</span>", tag: "button" },
    { n: 14, find: ">Your requests to join approved</span>", tag: "button" },
    { n: 15, find: ">New messages</span>", tag: "button" },
  ],
  NotificationsOffer: [
    { n: 1, find: ">Want these announced as they happen?<", tag: "button" },
    { n: 2, find: 'aria-label="No thanks', tag: "button" },
  ],
  PushDenied: [{ n: 1, find: 'aria-label="Back to your profile"', tag: "a" }],

  // ── The change-histories round (post-MVP) ────────────────────────────────
  // A version card's own door is its text link, and the two versions are told
  // apart by the href the board gives each one — the one part of a card that
  // is a version's own address rather than shared anatomy.
  PostHistory: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: 'href="/p/salt-maps/v/12-september"', tag: "a" },
    { n: 3, find: 'href="/p/salt-maps/v/8-september"', tag: "a" },
  ],
  PostHistoryOwn: [
    { n: 1, find: 'aria-label="Back to the post"', tag: "a" },
    { n: 2, find: ">Remove the whole post</button>", tag: "button" },
    { n: 3, find: ">Remove this version</button>", tag: "button" },
    { n: 4, find: 'href="/p/salt-maps/v/12-september"', tag: "a" },
    { n: 5, find: 'href="/p/salt-maps/v/8-september"', tag: "a" },
  ],
  PostVersionDetail: [
    { n: 1, find: 'aria-label="Back to the edit history"', tag: "a" },
    { n: 2, find: ">See the current version</button>", tag: "button" },
  ],
  PostVersionDetailMedia: [
    { n: 1, find: 'aria-label="Back to the edit history"', tag: "a" },
    { n: 2, find: ">See the current version</button>", tag: "button" },
  ],
  VersionRemoveConfirm: [
    { n: 1, find: ">Remove version</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
  ],
  CommentHistory: [{ n: 1, find: 'aria-label="Back to the comment"', tag: "a" }],
  ProfileHistory: [{ n: 1, find: 'aria-label="Back to the profile"', tag: "a" }],
  // The registers' per-version act is marked on its FIRST row only — the
  // repeated-element convention; one edge covers every version that carries it.
  CommentHistoryOwn: [
    { n: 1, find: 'aria-label="Back to the comment"', tag: "a" },
    { n: 2, find: ">Remove the whole comment</button>", tag: "button" },
    { n: 3, find: ">Remove this version</button>", tag: "button" },
  ],
  ProfileHistoryOwn: [
    { n: 1, find: 'aria-label="Back to the profile"', tag: "a" },
    { n: 2, find: ">Remove every version</button>", tag: "button" },
    { n: 3, find: ">Remove this version</button>", tag: "button" },
  ],
  HistoryMenu: [{ n: 1, find: ">Edit history</button>", tag: "button" }],
  EditedMarkerDoor: [{ n: 1, find: ">Edited</button>", tag: "button" }],
  // The split row: the two halves are marked on the FIRST row only, the
  // repeated-element convention — one edge covers every row, and two badges on
  // five rows would bury the row the split is being shown on.
  OpinionsRowDoors: [
    { n: 1, find: ">Mira Voss</span>", tag: "button" },
    { n: 2, find: 'aria-label="See how this opinion built"', tag: "button" },
  ],
  ProfileStancesDoors: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Tobias Lindqvist</span>", tag: "button" },
    { n: 3, find: 'aria-label="See how this opinion built"', tag: "button" },
  ],
  PadHistoryDoor: [{ n: 1, find: ">Current opinion · see how it built</button>", tag: "button" }],
  // The timeline sheets' one "?", on the title row (`SheetTitle`'s trailing).
  StanceTimeline: [{ n: 1, find: 'aria-label="How opinions build"', tag: "button" }],
  StanceTimelinePost: [{ n: 1, find: 'aria-label="How opinions build"', tag: "button" }],
  // Two washes stack under this dialog — the sheet's and its own — so the scrim
  // is found by the DIALOG's wrapper, the one that centres the surface; the
  // bare wash string would land on the sheet's.
  TimelineHelp: [
    { n: 1, find: ">Close</button>", tag: "button" },
    { n: 2, find: "place-items:center;background:var(--scrim-dialog)", tag: "div" },
  ],

  // ── The chats round (post-MVP) ───────────────────────────────────────────
  // A list's row is marked on its FIRST row only, the repeated-element
  // convention: one edge covers every row, and its cases say where each kind
  // of row lands. The explorer's two join words are marked where each first
  // appears, for the same reason. A row's tap and its long-press are one
  // element and one number — the edge's two outcomes say which gesture lands
  // where — and the same holds for the send arrow's tap and hold. A bubble's
  // long-press lands on the bubble, found by the `data-message` name the
  // board gives it.
  ChatsHome: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="How chats work"', tag: "button" },
    { n: 3, find: ">All chats</button>", tag: "button" },
    { n: 4, find: 'aria-label="New chat"', tag: "button" },
    { n: 5, find: ">Coast walkers</span>", tag: "button" },
  ],
  ChatsExplore: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="How chats work"', tag: "button" },
    { n: 3, find: ">Your chats</button>", tag: "button" },
    { n: 4, find: ">Hide chats you", tag: "button" },
    { n: 5, find: ">Harbour office</span>", tag: "button" },
    { n: 6, find: ">Join</button>", tag: "button" },
    { n: 7, find: ">Ask to join</button>", tag: "button" },
    { n: 8, find: 'aria-label="New chat"', tag: "button" },
    { n: 9, find: ">You&#x27;re invited</button>", tag: "button" },
  ],
  // The foot's field is found by its wrapper — a replaced element cannot host
  // the badge (`TextField`'s own note) — and the seal by its accessible name.
  ChatThread: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: ">Show the encrypted text</button>", tag: "button" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Sign and send"', tag: "button" },
    { n: 7, find: 'data-message="boots"', tag: "div" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatCreate: [
    { n: 1, find: 'aria-label="Back to the people you picked"', tag: "a" },
    { n: 2, find: ">Choose a picture</button>", tag: "button" },
    { n: 3, find: 'data-field="Name"', tag: "div" },
    { n: 4, find: 'data-field="Description"', tag: "div" },
    { n: 5, find: ">Open</span>", tag: "label" },
    { n: 6, find: ">Next</button>", tag: "button" },
  ],
  ChatRowMenu: [
    { n: 1, find: ">Mute</button>", tag: "button" },
    { n: 2, find: ">Chat details</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ChatMessageMenu: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Cite in a new post</button>", tag: "button" },
    { n: 3, find: ">Give your opinion</button>", tag: "button" },
    { n: 4, find: ">Reply</button>", tag: "button" },
    { n: 5, find: ">Cited by</button>", tag: "button" },
    { n: 6, find: ">Opinions on this</button>", tag: "button" },
    { n: 7, find: ">License terms</button>", tag: "button" },
    { n: 8, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ChatPicker: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: ">Search people<", tag: "div" },
    { n: 3, find: ">New group chat</span>", tag: "button" },
    { n: 4, find: ">Ada Okonkwo<", tag: "button" },
  ],
  ChatPickerGroup: [
    { n: 1, find: 'aria-label="Back to new chat"', tag: "a" },
    { n: 2, find: ">Search people<", tag: "div" },
    { n: 3, find: 'aria-label="Remove Ada Okonkwo"', tag: "button" },
    { n: 4, find: ">Mira Voss<", tag: "button" },
    { n: 5, find: ">Next</button>", tag: "button" },
  ],
  // Dialogs are found by their own wrapper's wash, `TimelineHelp`'s way.
  ChatExistingAsk: [
    { n: 1, find: ">Open that chat</button>", tag: "button" },
    { n: 2, find: ">Start a new chat</button>", tag: "button" },
    { n: 3, find: "place-items:center;background:var(--scrim-dialog)", tag: "div" },
  ],
  ChatSignSheet: [
    { n: 1, find: 'aria-label="How signing works"', tag: "button" },
    { n: 2, find: ">Sign and send</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
    { n: 4, find: ">Adjust</button>", tag: "button" },
  ],
  ChatsHelp: [
    { n: 1, find: ">Close</button>", tag: "button" },
    { n: 2, find: "place-items:center;background:var(--scrim-dialog)", tag: "div" },
  ],
  ChatThreadMedia: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: 'alt="A pot of dark honey', tag: "div" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'aria-label="Turn sound on"', tag: "button" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatThreadKeyboard: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 4, find: 'data-field="Message"', tag: "div" },
    { n: 5, find: 'aria-label="Sign and send"', tag: "button" },
    { n: 6, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatThreadReader: [
    { n: 1, find: 'aria-label="Back to all chats"', tag: "a" },
    { n: 2, find: 'aria-label="Harbour office — chat details"', tag: "button" },
    { n: 3, find: ">Show the encrypted text</button>", tag: "button" },
    { n: 4, find: ">Ask to join</button>", tag: "button" },
    { n: 5, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatCreateSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — nothing is started"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: ">Sign and start the chat</button>", tag: "button" },
    { n: 5, find: ">Back</button>", tag: "button" },
    { n: 6, find: 'aria-label="Your opinion on Low-tide walks', tag: "button" },
    { n: 6, find: ">Choose your opinion on Low-tide walks</button>", tag: "button" },
  ],

  // ── The chat details round (post-MVP) ───────────────────────────────────
  // The opinion face and its skip-link are one control and one number
  // (`ProfileOther`'s pair). A member list's row is marked on its FIRST row
  // only, the repeated-element convention — the edge's cases say where each
  // kind of row lands — and so are its role door, the chronicle's remove
  // act, the gallery's first tile and the search's first result. The thread
  // headers' search glyph takes the next free number on each thread board.
  ChatDetails: [
    { n: 1, find: 'aria-label="Back to the chat"', tag: "a" },
    { n: 2, find: 'aria-label="Give your opinion on Coast walkers"', tag: "button" },
    { n: 2, find: ">Choose your opinion on Coast walkers</button>", tag: "button" },
    { n: 3, find: ">Edit chat</button>", tag: "button" },
    { n: 4, find: ">Media in this chat</span>", tag: "button" },
    { n: 5, find: ">Add people</span>", tag: "button" },
    { n: 6, find: ">Sol Ferreira</span>", tag: "button" },
    { n: 7, find: 'aria-label="Admin — change the role"', tag: "button" },
    { n: 8, find: ">Mute this chat</span>", tag: "button" },
    { n: 9, find: ">Edit history</span>", tag: "button" },
    { n: 10, find: ">Leave this chat</span>", tag: "button" },
  ],
  ChatDetailsReader: [
    { n: 1, find: 'aria-label="Back to the chat"', tag: "a" },
    { n: 2, find: 'aria-label="Give your opinion on Harbour office"', tag: "button" },
    { n: 2, find: ">Choose your opinion on Harbour office</button>", tag: "button" },
    { n: 3, find: ">Ask to join</button>", tag: "button" },
    { n: 4, find: ">Media in this chat</span>", tag: "button" },
    { n: 5, find: ">Tobias Lindqvist</span>", tag: "button" },
    { n: 6, find: ">Edit history</span>", tag: "button" },
  ],
  ChatEdit: [
    { n: 1, find: 'aria-label="Back to chat details"', tag: "a" },
    { n: 2, find: ">Change picture</button>", tag: "button" },
    { n: 3, find: 'data-field="Name"', tag: "div" },
    { n: 4, find: 'data-field="Description"', tag: "div" },
    { n: 5, find: ">Save</button>", tag: "button" },
  ],
  ChatEditSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: ">Sign the change</button>", tag: "button" },
    { n: 5, find: ">Back</button>", tag: "button" },
  ],
  ChatHistory: [
    { n: 1, find: 'aria-label="Back to chat details"', tag: "a" },
    { n: 2, find: ">Remove this version</button>", tag: "button" },
  ],
  ChatSearchIn: [
    { n: 1, find: 'aria-label="Back to the chat"', tag: "a" },
    { n: 2, find: ">tide<", tag: "div" },
    { n: 3, find: ">Mira Voss</span>", tag: "button" },
  ],
  ChatMediaGallery: [
    { n: 1, find: 'aria-label="Back to chat details"', tag: "a" },
    { n: 2, find: 'alt="A pot of dark honey', tag: "div" },
    { n: 3, find: 'aria-label="Turn sound on"', tag: "button" },
  ],
  // The dialog's field by its wrapper (`TextField`'s own note), its scrim by
  // the dialog's own wash, `TimelineHelp`'s way.
  ChatLeaveConfirm: [
    { n: 1, find: 'data-field="Why?"', tag: "div" },
    { n: 2, find: ">Leave</button>", tag: "button" },
    { n: 3, find: ">Stay</button>", tag: "button" },
    { n: 4, find: "place-items:center;background:var(--scrim-dialog)", tag: "div" },
  ],

  // ── The chats governance round (post-MVP) ───────────────────────────────
  // A decision's act is found by its spoken name, which carries what it agrees
  // to — two cards in one thread would otherwise share one `>Agree<`. The
  // details' decision row is marked on its FIRST row (the repeated-element
  // convention), its door and its act as two numbers, `RoleDoor`'s split. A
  // sheet or dialog over a surface marks only its own controls, as the leave
  // dialog and the message's seal do.
  ChatThreadDecisions: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Salt-crust rubbings — chat details"', tag: "button" },
    { n: 3, find: 'aria-label="Agree — Mira Voss wants to remove Kel Moreau from the chat"', tag: "button" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 8, find: ' — see the decision"', tag: "button", all: true },
    { n: 9, find: 'aria-label="Disagree — Mira Voss wants to remove Kel Moreau from the chat"', tag: "button" },
  ],
  // The vote's small seal marks only its own controls, `ChatSignSheet`'s way.
  ChatAgreeSheet: [
    { n: 1, find: 'aria-label="How signing works"', tag: "button" },
    { n: 2, find: ">Sign and agree</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  // A vote row is marked on its FIRST row, the repeated-element convention.
  ChatDecisionDetail: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">Mira Voss<", tag: "button" },
    { n: 3, find: ">Disagree instead</button>", tag: "button" },
    { n: 4, find: ">Take back your vote</button>", tag: "button" },
    { n: 5, find: 'aria-label="Open the proposed picture"', tag: "button" },
  ],
  ChatDetailsDecisions: [
    { n: 1, find: 'aria-label="Back to the chat"', tag: "a" },
    { n: 2, find: 'aria-label="Give your opinion on Salt-crust rubbings"', tag: "button" },
    { n: 2, find: ">Choose your opinion on Salt-crust rubbings</button>", tag: "button" },
    { n: 3, find: ">Edit chat</button>", tag: "button" },
    { n: 4, find: ">Media in this chat</span>", tag: "button" },
    { n: 5, find: 'aria-label="Mira Voss wants to remove Kel Moreau from the chat, 2 of 5 so far — see the decision"', tag: "button" },
    { n: 6, find: 'aria-label="Agree — Mira Voss wants to remove Kel Moreau from the chat"', tag: "button" },
    { n: 7, find: ">Add people</span>", tag: "button" },
    { n: 8, find: ">Juno Baptiste</span>", tag: "button" },
    { n: 9, find: 'aria-label="Admin — change the role"', tag: "button" },
    { n: 10, find: ">Mute this chat</span>", tag: "button" },
    { n: 11, find: ">Edit history</span>", tag: "button" },
    { n: 12, find: ">Leave this chat</span>", tag: "button" },
    { n: 13, find: 'aria-label="Disagree — Mira Voss wants to remove Kel Moreau from the chat"', tag: "button" },
  ],
  ChatInvitePicker: [
    { n: 1, find: 'aria-label="Back to chat details"', tag: "a" },
    { n: 2, find: ">Search people<", tag: "div" },
    { n: 3, find: 'aria-label="Remove Wren Aliyev"', tag: "button" },
    { n: 4, find: ">Sal Torres<", tag: "button" },
    { n: 5, find: ">Next</button>", tag: "button" },
  ],
  ChatInviteSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — nobody is invited"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: ">Sign and invite</button>", tag: "button" },
    { n: 5, find: ">Back</button>", tag: "button" },
    { n: 6, find: 'data-field="Message"', tag: "div" },
  ],
  ChatThreadInvited: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: 'aria-label="Night fishing crew — chat details"', tag: "button" },
    { n: 3, find: ">Show the encrypted text</button>", tag: "button" },
    { n: 4, find: ">Join</button>", tag: "button" },
    { n: 5, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatJoinSeal: [
    { n: 1, find: 'aria-label="How signing works"', tag: "button" },
    { n: 2, find: ">Sign and join</button>", tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
    { n: 4, find: 'aria-label="Your opinion on Night fishing crew', tag: "button" },
    { n: 4, find: ">Choose your opinion on Night fishing crew</button>", tag: "button" },
  ],
  // The pad over a seal marks only the pad's own controls, `PadStanding`'s way;
  // the seal beneath is under the wash.
  ChatJoinSealPad: [
    { n: 1, find: 'aria-label="How opinions work"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion', tag: "div" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
  ],
  ChatMessagePad: [
    { n: 1, find: 'aria-label="How opinions work"', tag: "button" },
    { n: 2, find: 'aria-label="Opinion', tag: "div" },
    { n: 3, find: ">Cancel</button>", tag: "button" },
    { n: 4, find: ">Set</button>", tag: "button" },
  ],
  // The opinions sheet's rows split person and value (`OpinionsRowDoors`'
  // grammar), marked on the FIRST row, the repeated-element convention.
  ChatMessageOpinions: [
    { n: 1, find: ">Sol Ferreira</span>", tag: "button" },
    { n: 2, find: 'aria-label="See how this opinion built"', tag: "button" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ChatThreadRecording: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: ">Describe</button>", tag: "button" },
    { n: 4, find: 'aria-label="Delete the recording"', tag: "button" },
    { n: 5, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 6, find: 'aria-label="Pause the recording"', tag: "button" },
    { n: 7, find: 'aria-label="Sign and send"', tag: "button" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 9, find: ">Show the encrypted text</button>", tag: "button" },
  ],
  ChatThreadRecordingPaused: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: ">Describe</button>", tag: "button" },
    { n: 4, find: 'aria-label="Delete the recording"', tag: "button" },
    { n: 5, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 6, find: 'aria-label="Keep recording"', tag: "button" },
    { n: 7, find: 'aria-label="Sign and send"', tag: "button" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 9, find: ">Show the encrypted text</button>", tag: "button" },
  ],
  ChatThreadRequested: [
    { n: 1, find: 'aria-label="Back to all chats"', tag: "a" },
    { n: 2, find: 'aria-label="Harbour office — chat details"', tag: "button" },
    { n: 3, find: ">Show the encrypted text</button>", tag: "button" },
    { n: 4, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 5, find: ' — see the decision"', tag: "button" },
  ],
  ChatThreadApproved: [
    { n: 1, find: 'aria-label="Back to all chats"', tag: "a" },
    { n: 2, find: 'aria-label="Harbour office — chat details"', tag: "button" },
    { n: 3, find: ">Show the encrypted text</button>", tag: "button" },
    { n: 4, find: ">Join</button>", tag: "button" },
    { n: 5, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatRequestApprove: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Headland honey — chat details"', tag: "button" },
    { n: 3, find: 'aria-label="Approve — Sal Torres asks to join"', tag: "button" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 8, find: ' — see the decision"', tag: "button" },
  ],
  // The choice rows are found by their words; the details beneath print the
  // same role words only inside the role doors' buttons.
  ChatRoleSheet: [
    { n: 1, find: ">Admin</span>", tag: "label" },
    { n: 2, find: ">Member</span>", tag: "label" },
    { n: 3, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ChatVersionRemoveConfirm: [
    { n: 1, find: ">Remove version</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
    { n: 3, find: "place-items:center;background:var(--scrim-dialog)", tag: "div" },
  ],
  ChatHistoryRemoved: [
    { n: 1, find: 'aria-label="Back to chat details"', tag: "a" },
    { n: 2, find: ">Remove this version</button>", tag: "button" },
  ],

  // ── The chats integration round (post-MVP) ──────────────────────────────
  // An empty foot carries the mic where the arrow stood, found by its
  // accessible name. A trace, a play control and a quote door recur per
  // bubble and are one edge each (`all`), the repeated-element convention. A
  // stance face and its skip-link are one control and one number
  // (`ChatDetails`' pair). Excerpts of canonical surfaces number only the
  // round's own controls and the rows standing beside them.
  ChatThreadReactions: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: ">Show the encrypted text</button>", tag: "button" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'data-message="boots"', tag: "div" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 9, find: 'aria-label="Opinions on this — ', tag: "button", all: true },
  ],
  ChatThreadReply: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 4, find: 'data-field="Message"', tag: "div" },
    { n: 5, find: 'aria-label="Sign and send"', tag: "button" },
    { n: 6, find: 'aria-label="Cancel the reply"', tag: "button" },
    { n: 7, find: 'aria-label="Replying to Mira Voss: ', tag: "button" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 9, find: 'data-message="boots"', tag: "div" },
  ],
  ChatThreadVoice: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: 'aria-label="Play — ', tag: "button", all: true },
    { n: 4, find: 'aria-label="Seek"', tag: "div", all: true },
    { n: 5, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 6, find: 'data-field="Message"', tag: "div" },
    { n: 7, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatThreadSealedMedia: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: 'alt="A pot of dark honey', tag: "div" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatThreadPending: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: ">Dismiss</button>", tag: "button" },
    { n: 4, find: ">Try again</button>", tag: "button" },
    { n: 5, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 6, find: 'data-field="Message"', tag: "div" },
    { n: 7, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 8, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 9, find: 'data-message="boots"', tag: "div" },
  ],
  ChatThreadRemoved: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: 'aria-label="Replying to You: ', tag: "button" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'aria-label="Search in this chat"', tag: "button" },
  ],
  ChatMessageMenuOwn: [
    { n: 1, find: ">Save</button>", tag: "button" },
    { n: 2, find: ">Cite in a new post</button>", tag: "button" },
    { n: 3, find: ">Give your opinion</button>", tag: "button" },
    { n: 4, find: ">Reply</button>", tag: "button" },
    { n: 5, find: ">Remove</button>", tag: "button" },
    { n: 6, find: ">Cited by</button>", tag: "button" },
    { n: 7, find: ">Opinions on this</button>", tag: "button" },
    { n: 8, find: ">License terms</button>", tag: "button" },
    { n: 9, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ChatMessageRemoveConfirm: [
    { n: 1, find: ">Remove</button>", tag: "button" },
    { n: 2, find: ">Keep it</button>", tag: "button" },
    { n: 3, find: "place-items:center;background:var(--scrim-dialog)", tag: "div" },
  ],
  ChatThreadSentPost: [
    { n: 1, find: 'aria-label="Back to your chats"', tag: "a" },
    { n: 2, find: 'aria-label="Coast walkers — chat details"', tag: "button" },
    { n: 3, find: ">Sunday at the tide market<", tag: "button" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Record a voice message"', tag: "button" },
    { n: 7, find: 'aria-label="Search in this chat"', tag: "button" },
    { n: 8, find: 'data-message="boots"', tag: "div" },
  ],
  // The sheet marks only its own controls, `ChatSignSheet`'s way; a chat row
  // is marked on its FIRST row, the repeated-element convention.
  ChatSendSheet: [
    { n: 1, find: ">Search your chats<", tag: "div" },
    { n: 2, find: ">Share outside CoGra</span>", tag: "button" },
    { n: 3, find: ">Coast walkers</span>", tag: "label" },
    { n: 4, find: 'aria-label="Encrypt end to end"', tag: "button" },
    { n: 5, find: 'data-field="Message"', tag: "div" },
    { n: 6, find: 'aria-label="Sign and send"', tag: "button" },
    { n: 7, find: 'class="cg-scrim-in"', tag: "div" },
  ],
  ChatAskSheet: [
    { n: 1, find: 'aria-label="How signing works"', tag: "button" },
    { n: 2, find: 'data-field="Message"', tag: "div" },
    { n: 3, find: ">Sign and ask</button>", tag: "button" },
    { n: 4, find: 'class="cg-scrim-in"', tag: "div" },
    { n: 5, find: 'aria-label="Your opinion on Harbour office', tag: "button" },
    { n: 5, find: ">Choose your opinion on Harbour office</button>", tag: "button" },
  ],
  ChatNotifications: [
    { n: 1, find: 'aria-label="Back"', tag: "a" },
    { n: 2, find: ">@mira invited you to Night fishing crew</span>", tag: "button" },
    { n: 3, find: ">@saltorres asks to join Headland honey</span>", tag: "button" },
    { n: 4, find: ">Harbour office approved your request to join</span>", tag: "button" },
    { n: 5, find: ">@ada commented on your post</span>", tag: "button" },
    { n: 5, find: ">@tobias replied to your comment</span>", tag: "button" },
  ],
  // Three real `PostCard`s: each card's own door (its text link) takes its own
  // number because each lands somewhere different; the affordances every card
  // repeats — the face, the score, the comments, the share, the ⋮ — are one
  // number each across all three (`all`), the per-post convention.
  ChatFeedCards: [
    { n: 1, find: 'aria-label="What your feed shows"', tag: "button" },
    { n: 2, find: ">Honey is back on the stand from Saturday.<", tag: "a" },
    { n: 3, find: ">Six it is. Meet at the harbour office.", tag: "a" },
    { n: 4, find: '<a href="/u/', tag: "a", all: true },
    { n: 5, find: 'aria-label="Give your opinion on', tag: "button", all: true },
    { n: 5, find: ">Choose your opinion on", tag: "button", all: true },
    { n: 6, find: ">Post score</span>", tag: "button", all: true },
    { n: 7, find: 'aria-label="4 comments"', tag: "button" },
    { n: 7, find: 'aria-label="1 comment"', tag: "button" },
    { n: 7, find: 'aria-label="2 comments"', tag: "button" },
    { n: 8, find: 'aria-label="Share ', tag: "button", all: true },
    { n: 9, find: 'aria-label="More on this post"', tag: "button", all: true },
    { n: 10, find: ">Salt maps of the coast road —", tag: "a" },
    { n: 11, find: '<a href="/t/', tag: "a", all: true },
  ],
  ChatSearchResults: [
    { n: 1, find: "harbour", tag: "div" },
    { n: 2, find: 'aria-label="What the search shows"', tag: "button" },
    { n: 3, find: 'aria-label="How searching works"', tag: "button" },
    { n: 4, find: ">Harbour office<", tag: "button" },
    { n: 4, find: ">Harbour seal watch<", tag: "button" },
    { n: 5, find: ">Harbour Rowing Club<", tag: "button" },
    { n: 5, find: ">Harbour lights at dusk<", tag: "button" },
  ],
  ChatSaved: [
    { n: 1, find: 'aria-label="Back to your profile"', tag: "a" },
    { n: 2, find: ">Six it is. Meet at the harbour office.<", tag: "button" },
    { n: 3, find: 'aria-label="Unsave"', tag: "button", all: true },
    { n: 4, find: ">Salt maps of the coast road<", tag: "button" },
    { n: 4, find: ">The third headland light is real<", tag: "button" },
  ],
});

/* THE WALLET (post-MVP since the V1.0 scope cut, readme §13). The eleven
   boards came across from canonical's Money & Wallet page with the numbers
   they carried there, minus the shell's: the bottom bar and the band's chats
   and bell are canonical's controls, and a tree's graph stops at the tree
   (readme §14), so on this side they carry no numbers — the push round's rule,
   "only the round's own controls are numbered". The wallet's own controls keep
   theirs unchanged, which is why no board here was renumbered: the shell's
   numbers always came after them. `WalletApplicant` has no control of its own
   and so no entry. PageHeader/WizardHeader backs render as <a href>. */
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
  ],
  WalletEmpty: [
    { n: 1, find: 'aria-label="What is CGT?"', tag: "button" },
    { n: 2, find: 'aria-label="Copy the address"', tag: "button" },
    { n: 3, find: ">Change</button>", tag: "button" },
  ],
  WalletSetup: [
    { n: 1, find: 'aria-label="Your wallet key"', tag: "button" },
    { n: 2, find: ">Create and publish</button>", tag: "button" },
  ],
  WalletAddressSeal: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: 'aria-label="Copy the address"', tag: "button" },
    { n: 5, find: ">Sign and publish</button>", tag: "button" },
    { n: 6, find: ">Back</button>", tag: "button" },
  ],
  WalletChange: [
    { n: 1, find: 'aria-label="Back a step"', tag: "a" },
    { n: 2, find: 'aria-label="Leave — your draft is kept"', tag: "button" },
    { n: 3, find: 'aria-label="How signing works"', tag: "button" },
    { n: 4, find: 'aria-label="Copy the address"', tag: "button" },
    { n: 5, find: ">Sign the change</button>", tag: "button" },
    { n: 6, find: ">Back</button>", tag: "button" },
  ],
  WalletKeyAbsent: [
    { n: 1, find: ">Restore the key</button>", tag: "button" },
    { n: 2, find: 'aria-label="What is CGT?"', tag: "button" },
    { n: 3, find: "Campaign settled", tag: "button" },
    { n: 4, find: "Tip from @tobias", tag: "button" },
  ],
  WalletGuest: [
    { n: 1, find: ">Keep browsing</button>", tag: "button" },
    { n: 2, find: ">Sign in or join</button>", tag: "button" },
  ],
  WalletCampaign: [
    { n: 1, find: 'aria-label="Back to the wallet"', tag: "a" },
    { n: 2, find: "Campaign deposit", tag: "button" },
  ],
  WalletCampaigns: [
    { n: 1, find: 'aria-label="Back to the wallet"', tag: "a" },
    { n: 2, find: ">Start a campaign</button>", tag: "button" },
    { n: 3, find: ">Yours</button>", tag: "button" },
    { n: 4, find: ">You took part</button>", tag: "button" },
    { n: 5, find: "In escrow · ends in 6 days", tag: "button" },
    { n: 6, find: "Settled 3d", tag: "button" },
    { n: 6, find: "Settled 12.07.2026", tag: "button" },
  ],
});
