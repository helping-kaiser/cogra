"use client";

// THE FIVE ILLUSTRATIONS (design/designs/canonical/screens/Onboarding*.jsx),
// each at its board's own geometry in its board's one coordinate space: the
// pieces are placed absolutely over one SVG carrying every line, so a drawing
// of lines-between-things cannot drift apart (`_shared.jsx`, the intro block's
// `IntroStage` / `IntroLines`). The stage scales to the column as one picture
// (`intro.tsx`), so the numbers here are the board's 342-wide ones.
//
// NOTHING ON A STAGE TAKES INPUT (the sidecars' ALWAYS lines): the pad is the
// real field, mounted inert; the post, the chat and the comment are likenesses
// built from their masters' fills, corners and anatomy, with nothing pressable.

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { STANCE_RANGES } from "@/lib/stance/pad-geometry";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { NameInText } from "@/lib/ui/names";
import { STANCE_AXES } from "@/lib/ui/stance-format";
import { PairField } from "@/lib/ui2/compose/pair-field";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";

import type { IntroCardId } from "./intro-cards";

/** The board's own drawing size for each card's stage. */
export const STAGE_SIZE: Readonly<Record<IntroCardId, { width: number; height: number }>> = {
  steps: { width: 342, height: 336 },
  shape: { width: 342, height: 392 },
  public: { width: 342, height: 396 },
  layers: { width: 342, height: 306 },
  vouch: { width: 342, height: 470 },
};

/** The fixture photographs the boards draw with, served beside the app. */
const PHOTO = {
  camera: "/intro/comment-camera.jpg",
  post: "/intro/post-photo.jpg",
  honey: "/intro/gallery-honey.jpg",
  grapes: "/intro/gallery-grapes.jpg",
  market: "/intro/gallery-market.jpg",
  inviter: "/intro/inviter.jpg",
} as const;

const STROKE = "var(--border-field)";

/** The reader the intro introduces: whose face the fifth card wears. */
export type IntroInviter = {
  readonly handle: string;
  readonly name: string;
  readonly avatarUrl: string | null;
};

function Lines({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      {children}
    </svg>
  );
}

/** A node's caption, label-small and quiet; a handle in it is one unit. */
function Caption({ children, x, y, width = 88, node }: { children: string; x: number; y: number; width?: number; node?: DataNode }) {
  return (
    <span
      {...testAttributes(node)}
      className="text-label-small"
      style={{ position: "absolute", left: x - width / 2, top: y, width, textAlign: "center", color: "var(--text-secondary)" }}
    >
      <NameInText text={children} />
    </span>
  );
}

/** A face on the stage, centred on (x, y) — the real avatar, placed. */
function Face({ x, y, size = 44, name, src, node }: { x: number; y: number; size?: number; name: string; src?: string | null; node?: DataNode }) {
  return (
    <span style={{ position: "absolute", left: x - size / 2, top: y - size / 2, display: "block" }}>
      <MonogramAvatar name={name} size={size} src={src} node={node} />
    </span>
  );
}

/** A photograph in a box of its own; the drawing's, so it carries no alt. */
function Photo({ src, style }: { src: string; style: CSSProperties }) {
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "block", overflow: "hidden", ...style }}>
      <Image src={src} alt="" fill sizes="342px" className="object-cover" />
    </span>
  );
}

/** A card's author line: face, handle, age (`PostCard` / `CommentCard`'s anatomy). */
function AuthorLine({ name, handle, src, age }: { name: string; handle: string; src?: string; age: string }) {
  return (
    <div className="flex items-center gap-2" style={{ padding: "10px 12px" }}>
      <MonogramAvatar name={name} src={src} />
      <span className="flex-1 text-label-large">@{handle}</span>
      <span className="text-body-small" style={{ color: "var(--text-secondary)" }}>
        {age}
      </span>
    </div>
  );
}

/** Intro 1 of 5 — the feed is your own steps (OnboardingSteps.jsx). */
function StepsStage() {
  return (
    <>
      <Lines {...STAGE_SIZE.steps}>
        <path d="M 87 44 H 143" stroke={STROKE} strokeWidth="2" fill="none" />
        <polygon points="143,39 153,44 143,49" fill={STROKE} />
        <path d="M 197 44 H 253" stroke={STROKE} strokeWidth="2" fill="none" />
        <polygon points="253,39 263,44 253,49" fill={STROKE} />
        <path d="M 281 66 C 281 104, 171 92, 171 118" stroke={STROKE} strokeWidth="2" fill="none" />
        <polygon points="166,118 176,118 171,128" fill={STROKE} />
      </Lines>
      <Face x={61} y={44} name="Sol Ferreira" />
      <Face x={171} y={44} name="Ada Okonkwo" src={PHOTO.camera} />
      <Face x={281} y={44} name="Tobias Lindqvist" />
      <Caption x={61} y={72}>you</Caption>
      <Caption x={171} y={72}>@ada</Caption>
      <Caption x={281} y={72}>@tobias</Caption>
      <div style={{ position: "absolute", left: 0, top: 130, width: "100%" }}>
        <div
          className="overflow-hidden rounded-medium"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}
        >
          <AuthorLine name="Tobias Lindqvist" handle="tobias" age="1h" />
          <div className="text-body-medium" style={{ padding: "0 12px 10px" }}>
            Low tide at six tomorrow — anyone walking the flats?
          </div>
          <Photo src={PHOTO.post} style={{ width: "100%", height: 130 }} />
        </div>
      </div>
    </>
  );
}

/** The anchor pairs card 2 draws, glyph and words `STANCE_ANCHORS`' own. */
const SHAPE_EDGES = [
  { emoji: "😍", label: "Love this", x: 40 },
  { emoji: "👀", label: "Show me more", x: 127 },
  { emoji: "😌", label: "Good, but not in my world", x: 215 },
  { emoji: "😕", label: "Not for me", x: 302 },
] as const;

const NO_CHANGE = () => {};

/** Intro 2 of 5 — opinions have a shape (OnboardingShape.jsx). */
function ShapeStage() {
  return (
    <>
      {/* The pad is the pad, at its own geometry — and inert: it takes no
          input here (OnboardingShape.md:7). */}
      <div inert style={{ position: "absolute", left: 31, top: 0, width: 280 }}>
        <PairField
          value={{ pDirected: 0.9, pInterest: 0.25 }}
          onChange={NO_CHANGE}
          axes={STANCE_AXES}
          ranges={STANCE_RANGES}
          ariaLabel=""
          testId="intro-pad"
        />
      </div>
      <Lines {...STAGE_SIZE.shape}>
        {SHAPE_EDGES.map((edge) => (
          <path key={edge.x} d={`M 171 268 L ${edge.x} 337`} stroke={STROKE} strokeWidth="2" fill="none" />
        ))}
      </Lines>
      <Face x={171} y={250} size={36} name="Sol Ferreira" />
      <Caption x={171} y={212}>you</Caption>
      {SHAPE_EDGES.map((edge) => (
        // The glyph rides its own edge's midpoint: the sentiment IS the edge.
        <span
          key={edge.emoji}
          data-testid="intro-edge-face"
          className="flex items-center justify-center rounded-full"
          style={{
            position: "absolute",
            left: (171 + edge.x) / 2 - 16,
            top: 287,
            width: 32,
            height: 32,
            background: "var(--surface)",
            fontSize: 20,
            lineHeight: "20px",
          }}
        >
          <span aria-hidden="true">{edge.emoji}</span>
          <span className="sr-only">{edge.label}</span>
        </span>
      ))}
      <Face x={40} y={352} size={30} name="Ada Okonkwo" src={PHOTO.camera} />
      <Photo src={PHOTO.post} style={{ position: "absolute", left: 112, top: 337, width: 30, height: 30, borderRadius: "var(--radius-small)" }} />
      <span
        aria-hidden="true"
        className="flex items-center justify-center text-label-large"
        style={{
          position: "absolute",
          left: 200,
          top: 337,
          width: 30,
          height: 30,
          borderRadius: "var(--radius-small)",
          background: "var(--surface-container-highest)",
          color: "var(--text-secondary)",
        }}
      >
        #
      </span>
      <Face x={302} y={352} size={30} name="Tobias Lindqvist" />
      <Caption x={40} y={370} width={80}>@ada</Caption>
      <Caption x={127} y={370} width={80}>a post</Caption>
      <Caption x={215} y={370} width={80}>#coastroad</Caption>
      <Caption x={302} y={370} width={80}>@tobias</Caption>
    </>
  );
}

const BUBBLE: CSSProperties = { boxSizing: "border-box", padding: "8px 12px" };

/** Intro 3 of 5 — everything here is public (OnboardingPublic.jsx). */
function PublicStage() {
  return (
    // The stage flows; nothing on it is pinned (the board's own note).
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        className="rounded-large"
        style={{ width: 342, boxSizing: "border-box", background: "var(--surface-container)", padding: 12 }}
      >
        <div className="flex items-center gap-2">
          <MonogramAvatar name="Ada Okonkwo" src={PHOTO.camera} />
          <MonogramAvatar name="Tobias Lindqvist" />
          <span className="text-label-small" style={{ color: "var(--text-secondary)" }}>
            @ada and @tobias
          </span>
        </div>
        <div className="flex flex-col text-body-small" style={{ gap: 12, marginTop: 12 }}>
          <div style={{ ...BUBBLE, alignSelf: "flex-start", maxWidth: 226, borderRadius: "16px 16px 16px 4px", background: "var(--surface-container-highest)" }}>
            Feels weird chatting where anyone can read it.
          </div>
          <div style={{ ...BUBBLE, alignSelf: "flex-end", maxWidth: 236, textAlign: "right", borderRadius: "16px 16px 4px 16px", background: "var(--surface-container-high)" }}>
            Nobody here pretends my thumbs have privacy. Meta and TikTok just read quieter.
          </div>
          <div
            style={{
              ...BUBBLE,
              alignSelf: "flex-start",
              maxWidth: 250,
              borderRadius: "16px 16px 16px 4px",
              background: "var(--surface-loud)",
              color: "var(--on-surface-loud)",
            }}
          >
            At least our eavesdroppers can say hi.
          </div>
        </div>
      </div>
      <svg aria-hidden="true" viewBox="0 0 342 46" width={342} height={46} style={{ display: "block" }}>
        <path d="M 200 46 C 200 30, 120 28, 120 12" stroke={STROKE} strokeWidth="2" fill="none" />
        <polygon points="115,12 125,12 120,2" fill={STROKE} />
      </svg>
      <div
        className="rounded-medium"
        style={{ width: 342, boxSizing: "border-box", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", padding: "10px 12px" }}
      >
        <div className="flex items-center gap-2">
          <MonogramAvatar name="Sol Ferreira" />
          <span className="flex-1 text-label-large">@sol</span>
          <span className="text-body-small" style={{ color: "var(--text-secondary)" }}>
            2h
          </span>
        </div>
        <div
          className="text-body-small"
          style={{ margin: "8px 0 0", paddingLeft: 12, borderLeft: "2px solid var(--border-field)", color: "var(--text-secondary)" }}
        >
          At least our eavesdroppers can say hi.
        </div>
        <div className="text-body-medium" style={{ margin: "8px 0 0" }}>
          Hi.
        </div>
      </div>
    </div>
  );
}

const PLATE: CSSProperties = {
  position: "absolute",
  height: 40,
  borderRadius: "var(--radius-medium)",
  border: "1px solid var(--border-hairline)",
  boxSizing: "border-box",
};

/** Intro 4 of 5 — nothing is lost (OnboardingLayers.jsx). */
function LayersStage() {
  return (
    <>
      <Photo src={PHOTO.honey} style={{ position: "absolute", left: 44, top: 0, width: 100, height: 76, borderRadius: "var(--radius-small)" }} />
      <Photo src={PHOTO.grapes} style={{ position: "absolute", left: 198, top: 0, width: 100, height: 76, borderRadius: "var(--radius-small)" }} />
      <Lines {...STAGE_SIZE.layers}>
        <path d="M 94 84 C 94 102, 140 96, 140 104" stroke={STROKE} strokeWidth="2" fill="none" />
        <polygon points="135,104 145,104 140,114" fill={STROKE} />
        <path d="M 248 84 C 248 102, 202 96, 202 104" stroke={STROKE} strokeWidth="2" fill="none" />
        <polygon points="197,104 207,104 202,114" fill={STROKE} />
      </Lines>
      <div style={{ ...PLATE, left: 28, top: 120, width: 286, background: "var(--surface-container)" }} />
      <div style={{ ...PLATE, left: 14, top: 130, width: 314, background: "var(--surface-container-high)" }} />
      <div
        className="overflow-hidden rounded-medium"
        style={{ position: "absolute", left: 0, top: 140, width: 342, boxSizing: "border-box", background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}
      >
        <AuthorLine name="Mira Voss" handle="mira" src={PHOTO.inviter} age="4h" />
        <div className="text-body-medium" style={{ padding: "0 12px 10px" }}>
          Sunday at the tide market
        </div>
        <div className="flex" style={{ gap: 2 }}>
          <Photo src={PHOTO.market} style={{ width: "33.34%", height: 88 }} />
          <Photo src={PHOTO.honey} style={{ width: "33.33%", height: 88 }} />
          <Photo src={PHOTO.grapes} style={{ width: "33.33%", height: 88 }} />
        </div>
      </div>
    </>
  );
}

/* The graph above the inviter, hand-placed as the board places it
   (OnboardingVouch.jsx MEMBERS / MESH / LOOSE / GATE). */
const MEMBERS = {
  l1: { x: 132, y: 246 },
  l2: { x: 206, y: 232 },
  m1: { x: 72, y: 186 },
  m2: { x: 152, y: 168 },
  m3: { x: 234, y: 176 },
  m4: { x: 296, y: 146 },
  u1: { x: 36, y: 108 },
  u2: { x: 112, y: 76 },
  u3: { x: 192, y: 98 },
  u4: { x: 258, y: 58 },
  t1: { x: 148, y: 20 },
  t2: { x: 306, y: 30 },
} as const;
type Member = keyof typeof MEMBERS;

const MESH: readonly (readonly [Member, Member])[] = [
  ["l1", "l2"],
  ["l1", "m1"],
  ["l1", "m2"],
  ["l2", "m3"],
  ["l2", "m4"],
  ["m1", "u1"],
  ["m1", "u2"],
  ["m2", "u2"],
  ["m2", "u3"],
  ["m2", "m3"],
  ["m3", "u3"],
  ["m3", "u4"],
  ["m4", "u4"],
  ["u2", "t1"],
  ["u3", "t1"],
  ["u4", "t2"],
];

const LOOSE: readonly { from: Member; to: readonly [number, number]; far?: true }[] = [
  { from: "u1", to: [-28, 78], far: true },
  { from: "u1", to: [-20, 160] },
  { from: "m1", to: [-24, 234] },
  { from: "l1", to: [40, 298] },
  { from: "t1", to: [126, -36], far: true },
  { from: "u2", to: [84, -28] },
  { from: "u4", to: [280, -34] },
  { from: "t2", to: [350, -14], far: true },
  { from: "m4", to: [372, 108], far: true },
  { from: "m4", to: [364, 186] },
  { from: "l2", to: [304, 274] },
];

const GATE: readonly Member[] = ["l1", "l2"];
const INVITER_AT = { x: 171, y: 324 };

/** Intro 5 of 5 — someone brings you in (OnboardingVouch.jsx). */
function VouchStage({ inviter, node }: { inviter: IntroInviter | null; node: DataNode }) {
  return (
    <>
      <Lines {...STAGE_SIZE.vouch}>
        <defs>
          {LOOSE.map((edge, index) => (
            <linearGradient
              key={`fade-${index}`}
              id={`vouch-fade-${index}`}
              gradientUnits="userSpaceOnUse"
              x1={MEMBERS[edge.from].x}
              y1={MEMBERS[edge.from].y}
              x2={edge.to[0]}
              y2={edge.to[1]}
            >
              <stop offset="0" style={{ stopColor: STROKE, stopOpacity: 1 }} />
              <stop offset="0.5" style={{ stopColor: STROKE, stopOpacity: 0.45 }} />
              <stop offset="1" style={{ stopColor: STROKE, stopOpacity: 0 }} />
            </linearGradient>
          ))}
        </defs>
        {LOOSE.map((edge, index) => (
          <path
            key={`loose-${index}`}
            d={`M ${MEMBERS[edge.from].x} ${MEMBERS[edge.from].y} L ${edge.to[0]} ${edge.to[1]}`}
            stroke={`url(#vouch-fade-${index})`}
            strokeWidth="2"
            fill="none"
          />
        ))}
        {LOOSE.filter((edge) => edge.far).map((edge) => (
          <circle
            key={`far-${edge.to[0]}-${edge.to[1]}`}
            cx={edge.to[0]}
            cy={edge.to[1]}
            r="7"
            style={{ fill: "var(--secondary-container)", opacity: 0.4 }}
          />
        ))}
        {MESH.map(([from, to]) => (
          <path
            key={`${from}${to}`}
            d={`M ${MEMBERS[from].x} ${MEMBERS[from].y} L ${MEMBERS[to].x} ${MEMBERS[to].y}`}
            stroke={STROKE}
            strokeWidth="2"
            fill="none"
          />
        ))}
        {inviter !== null &&
          GATE.map((id) => (
            <path
              key={`gate-${id}`}
              d={`M ${INVITER_AT.x} ${INVITER_AT.y} L ${MEMBERS[id].x} ${MEMBERS[id].y}`}
              stroke={STROKE}
              strokeWidth="2"
              fill="none"
            />
          ))}
        {inviter !== null && (
          <>
            <path d="M 171 360 L 171 398" stroke={STROKE} strokeWidth="2" strokeDasharray="4 5" fill="none" />
            <polygon points="165,398 177,398 171,406" fill={STROKE} />
          </>
        )}
      </Lines>

      {(Object.keys(MEMBERS) as Member[]).map((id) => (
        <span
          key={id}
          aria-hidden="true"
          className="rounded-full"
          style={{
            position: "absolute",
            left: MEMBERS[id].x - 10,
            top: MEMBERS[id].y - 10,
            width: 20,
            height: 20,
            background: "var(--secondary-container)",
          }}
        />
      ))}

      {inviter !== null && (
        <>
          <Face
            x={INVITER_AT.x}
            y={INVITER_AT.y}
            size={64}
            name={inviter.name}
            src={inviter.avatarUrl}
            node={part(node, "inviter")}
          />
          <Caption x={252} y={316} node={part(node, "inviterCaption")}>
            {`@${inviter.handle}`}
          </Caption>
        </>
      )}

      <span
        aria-hidden="true"
        {...testAttributes(part(node, "youRing"))}
        className="rounded-full"
        style={{ position: "absolute", left: 143, top: 406, width: 56, height: 56, boxSizing: "border-box", border: "1px dashed var(--border-field)" }}
      />
      <span
        aria-hidden="true"
        {...testAttributes(part(node, "you"))}
        className="rounded-full"
        style={{ position: "absolute", left: 159, top: 422, width: 24, height: 24, background: "var(--primary)" }}
      />
      <Caption x={252} y={426} node={part(node, "youCaption")}>
        you
      </Caption>
    </>
  );
}

/** The illustration a card draws, on the stage `node` names. */
export function IntroIllustration({
  card,
  inviter,
  node,
}: {
  card: IntroCardId;
  inviter: IntroInviter | null;
  node: DataNode;
}) {
  switch (card) {
    case "steps":
      return <StepsStage />;
    case "shape":
      return <ShapeStage />;
    case "public":
      return <PublicStage />;
    case "layers":
      return <LayersStage />;
    case "vouch":
      return <VouchStage inviter={inviter} node={node} />;
  }
}
