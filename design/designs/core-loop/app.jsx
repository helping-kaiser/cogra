// Item 1 of backlog.md — the core loop: feed → post detail → stance.
// A DESIGN, not design-system content: it composes the system's components and
// invents no new ones. Anything reusable it turns up gets ported back.
// Screen-transition motion is item 2, so navigation here is a plain swap.

const DS = window.CoGraDesignSystem_9084ba;
const { PostCard, CommentCard, BottomNav, CollapsingTop, PageHeader, Icon, Button, JoinPrompt, Snackbar, EmptyState, LoadingState, TransportError } = DS;

function TopBar({ guest, onJoin }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-6)" }}>
        <Icon name="mark" size={24} />
        <span className="text-title-large" style={{ fontWeight: 600 }}>cogra</span>
      </div>
      {guest && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "0 var(--space-6) var(--space-3)" }}>
          <span className="text-body-small" style={{ color: "var(--text-secondary)" }}>You're browsing as a guest — sign in or join to post and vouch.</span>
          <div style={{ flex: "none" }}><Button variant="text" size="sm" onClick={onJoin}>Sign in or join</Button></div>
        </div>
      )}
    </div>
  );
}

function Feed({ state, guest, bundles, taught, scrollHost, onOpen, onOpenComments, onCommit, onJoin }) {
  const posts = window.POSTS;
  return (
    <>
      <CollapsingTop scrollHost={scrollHost}><TopBar guest={guest} onJoin={onJoin} /></CollapsingTop>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4) var(--space-6) 96px" }}>
        {state === "offline" && <TransportError message="Can't reach the server — new posts can't load right now." />}
        {state === "loading" && <LoadingState />}
        {state === "empty" && <EmptyState title="Nothing here yet — write the first post." actionLabel="New post" onAction={guest ? onJoin : undefined} />}
        {state !== "loading" && state !== "empty" && posts.map((post) => (
          <PostCard
            key={post.id}
            variant="summary"
            author={post.author}
            title={post.title}
            description={post.description}
            content={post.content}
            timestamp={post.timestamp}
            media={post.media}
            pending={post.pending}
            edited={post.edited}
            score={post.score}
            comments={post.comments}
            signedIn={!guest}
            taught={taught}
            bundle={bundles[post.id]}
            onOpen={() => onOpen(post.id)}
            onOpenComments={() => onOpenComments(post.id)}
            onOpenScore={() => onOpen(post.id)}
            onCommit={(pick, bundle) => onCommit(post.id, bundle)}
          />
        ))}
      </div>
    </>
  );
}

function Thread({ post, guest, bundles, taught, scrollHost, commentsRef, onBack, onCommit }) {
  const comments = window.COMMENTS[post.id] || [];
  const decorate = (comment) => ({
    author: comment.author,
    content: comment.content,
    timestamp: comment.timestamp,
    pending: comment.pending,
    edited: comment.edited,
    signedIn: !guest,
    taught,
    targetLabel: "this comment",
    bundle: bundles[comment.id],
    onCommit: (pick, bundle) => onCommit(comment.id, bundle),
    replies: (comment.replies || []).map((reply) => ({ id: reply.id, ...decorate(reply) })),
  });
  return (
    <>
      <CollapsingTop scrollHost={scrollHost}>
        <div style={{ background: "var(--surface)" }}>
          <PageHeader title="Post" backLabel="Back to feed" onBack={onBack} />
        </div>
      </CollapsingTop>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4) var(--space-6) 96px" }}>
        <PostCard
          variant="detail"
          author={post.author}
          title={post.title}
          description={post.description}
          content={post.content}
          timestamp={post.timestamp}
          media={post.media}
          pending={post.pending}
          edited={post.edited}
          score={post.score}
          signedIn={!guest}
          taught={taught}
          bundle={bundles[post.id]}
          onCommit={(pick, bundle) => onCommit(post.id, bundle)}
        />
        <div ref={commentsRef} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <span className="text-label-large" style={{ color: "var(--text-secondary)" }}>
            {comments.length === 0 ? "No comments yet." : comments.length === 1 ? "1 comment" : comments.length + " comments"}
          </span>
          {comments.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {comments.map((comment) => <CommentCard key={comment.id} {...decorate(comment)} />)}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function Phone({ guest, feedState }) {
  const [view, setView] = React.useState({ name: "feed" });
  const [bundles, setBundles] = React.useState(() => {
    const seed = {};
    window.POSTS.forEach((post) => { seed[post.id] = post.stance; });
    Object.values(window.COMMENTS).forEach((list) => list.forEach(function walk(comment) {
      seed[comment.id] = comment.stance;
      (comment.replies || []).forEach(walk);
    }));
    return seed;
  });
  const [taught, setTaught] = React.useState(false);
  const [dir, setDir] = React.useState("forward");
  const [joining, setJoining] = React.useState(false);
  const [note, setNote] = React.useState(null);
  const host = React.useRef(null);
  const commentsRef = React.useRef(null);

  const commit = (id, bundle) => {
    setBundles((prev) => ({ ...prev, [id]: bundle }));
    setTaught(true);
  };
  const open = (id, atComments) => {
    setDir("forward");
    setView({ name: "post", id });
    requestAnimationFrame(() => {
      if (!host.current) return;
      host.current.scrollTop = atComments && commentsRef.current ? commentsRef.current.offsetTop - 8 : 0;
    });
  };
  const slot = (name) => {
    if (name === "feed") { setDir("back"); setView({ name: "feed" }); if (host.current) host.current.scrollTop = 0; return; }
    if (guest) { setJoining(true); return; }
    setNote(name === "compose" ? "The composer is a session of its own." : "Profiles are a session of their own.");
  };

  const post = view.name === "post" ? window.POSTS.find((p) => p.id === view.id) : null;
  return (
    <div className="phone">
      <div className="screen" ref={host}>
        <div key={view.name + (view.id || "")} className={dir === "back" ? "cg-nav-back-in" : "cg-nav-in"}>
        {post ? (
          <Thread post={post} guest={guest} bundles={bundles} taught={taught} scrollHost={host} commentsRef={commentsRef}
                  onBack={() => { setDir("back"); setView({ name: "feed" }); if (host.current) host.current.scrollTop = 0; }}
                  onCommit={commit} />
        ) : (
          <Feed state={feedState} guest={guest} bundles={bundles} taught={taught} scrollHost={host}
                onOpen={(id) => open(id, false)} onOpenComments={(id) => open(id, true)}
                onCommit={commit} onJoin={() => setJoining(true)} />
        )}
        </div>
      </div>
      <BottomNav active={view.name === "feed" ? "feed" : null} slots={["feed", "compose", "profile"]} onSelect={slot} />
      <JoinPrompt open={joining} onClose={() => setJoining(false)} onSignIn={() => { setJoining(false); setNote("Joining is a session of its own."); }} />
      <Snackbar message={note} onDismiss={() => setNote(null)} offset={80} />
    </div>
  );
}

function Session() {
  const [dark, setDark] = React.useState(false);
  const [guest, setGuest] = React.useState(true);
  const [feedState, setFeedState] = React.useState("loaded");
  const [run, setRun] = React.useState(0);
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);
  const Group = ({ label, options, value, onPick }) => (
    <div className="ctl">
      <span className="ctl-label">{label}</span>
      <div className="ctl-row">
        {options.map((option) => (
          <button key={option.value} className={"ctl-btn" + (value === option.value ? " on" : "")} onClick={() => onPick(option.value)}>{option.label}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="desk">
      <Phone key={run + ":" + guest + ":" + feedState} guest={guest} feedState={feedState} />
      <aside className="notes">
        <h1 className="text-title-medium" style={{ margin: 0 }}>Core loop — feed, post, stance</h1>
        <p className="text-body-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          Backlog item 1. Built only from components already in the system. Hold a stance target for half a second to bloom the pad; release parks the pick, <b>Set</b> signs it. The first tap ever teaches and signs nothing.
        </p>
        <Group label="Theme" value={dark ? "dark" : "light"} onPick={(v) => setDark(v === "dark")}
               options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <Group label="Viewer" value={guest ? "guest" : "member"} onPick={(v) => setGuest(v === "guest")}
               options={[{ value: "guest", label: "Guest" }, { value: "member", label: "Member" }]} />
        <Group label="Feed" value={feedState} onPick={setFeedState}
               options={[{ value: "loaded", label: "Loaded" }, { value: "loading", label: "Loading" }, { value: "empty", label: "Empty" }, { value: "offline", label: "Offline" }]} />
        <button className="ctl-btn wide" onClick={() => setRun((n) => n + 1)}>Reset the session</button>
        <p className="text-body-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          Out of scope here, by backlog order: the sheet behind the overflow menu (3), replying and signing (6), profiles (5), the Post Score's screens (13).
        </p>
      </aside>
    </div>
  );
}

const mount = document.getElementById("root");
if (mount) ReactDOM.createRoot(mount).render(<Session />);
