"use client";

// The compose wizard: pick → (crop) → details → seal.
//
// This component owns the three things a step cannot: the draft on the device,
// the uploads in flight, and the one signing pass at the end. The steps
// themselves are given values and callbacks and hold nothing, which is what
// keeps the flow's rules in `lib/compose/wizard.ts` where they can be tested.
//
// The wizard replaces the composer for CREATION only. Editing an existing post
// is still the 1.0 form: an edit is a different act with a different batch rule
// (D19 split it out as its own bite), and routing it through a body-first pick
// screen would ask an author to re-choose a body they already have.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { HeaderBar } from "@/lib/ui2/header-bar";
import { HelpDot } from "@/lib/ui2/help-dot";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { DialogSurface } from "@/lib/ui2/dialog-surface";
import { PillButton } from "@/lib/ui2/pill-button";
import { preparePost } from "@/lib/api/content-api";
import { fetchDefaultLicense } from "@/lib/api/settings-api";
import { isPublicDomain } from "@/lib/license";
import { sealFaultOf, type SealFault } from "@/lib/compose/seal-fault";
import { SLOW_NETWORK_MS, useSlowAnswer, useWaitedPast } from "@/lib/ui2/waiting-commit";
import { fetchReferenceCandidates } from "@/lib/api/references-api";
import { newReferenceDraft } from "@/lib/references/draft";
import { untypedTargetView } from "@/lib/references/normalize";
import { newTagDraft } from "@/lib/topics/draft";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { fetchGraphIds } from "@/lib/api/graph-ids-api";
import { postExpectation } from "@/lib/compose/intent";
import { snapDimension } from "@/lib/stance/model";
import { contentExpectation } from "@/lib/compose/payload-expectation";
import type { Expectation } from "@/lib/signing/intent";
import {
  advanceGate,
  attachmentClaims,
  bodyContent,
  COVER_FROM_PICTURE,
  descriptionContent,
  effectiveCover,
  emptyWizard,
  isVideoPost,
  shapeRatio,
  skipsCoverStep,
  stepIndex,
  uploadsFailed,
  uploadsPending,
  wizardLedger,
  wizardReducer,
  type PickedAsset,
  type WizardAction,
  type WizardState,
} from "@/lib/compose/wizard";
import { captureFrames, captureFrameZero, probeVideo } from "@/lib/ui2/media/video";
import { newComposeId } from "@/lib/compose/ids";
import { POST_SCALE, screenPick, type PickRefusal } from "@/lib/compose/pick";
import {
  composeDraftStore,
  draftIsWorthKeeping,
  draftSummary,
  type ComposeDraftStore,
} from "@/lib/compose/draft-store";
import { fateOf, sealedDraftStore, type SealedDraftStore } from "@/lib/compose/sealed-draft";
import { fetchStagedWrite } from "@/lib/api/writes-api";
import { useStageHistory } from "@/lib/compose/stage-history";
import { runUpload, runVideoUpload } from "@/lib/compose/uploads";
import { findPublishedMatch, publishedOn, type MediaKey, type PublishedMatch } from "@/lib/compose/published-match";
import { useObjectUrl, usePreviewUrls, useRevokeOnChange } from "@/lib/compose/previews";
import { PickStep } from "./pick-step";
import { CropStep } from "./crop-step";
import { CoverStep } from "./cover-step";
import { DetailsStep } from "./details-step";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { PickedSheet } from "@/lib/ui2/compose/picked-sheet";
import { ReferencePicker } from "@/lib/ui2/compose/reference-picker";
import { TagPicker } from "@/lib/ui2/compose/tag-picker";
import { SealStep, type SealSheet } from "./seal-step";

/** A stable empty list, so the preview effect does not re-run on every render. */
const NO_ASSETS: readonly PickedAsset[] = [];
const NO_FRAMES: readonly Blob[] = [];
const NO_URLS: readonly string[] = [];
const NO_REFUSALS: readonly PickRefusal[] = [];

/**
 * The clip's length and displayed shape (width ÷ height after rotation), read
 * off its header. A decoder that reported no dimensions gives a null ratio
 * rather than NaN — "shape unknown", which keeps the cover step and draws the
 * neutral square — and a clip whose header states no duration still uploads:
 * only the badge is poorer for it, and the server writes the authoritative
 * number.
 */
/** The stage's landed media back out of its signature (`id:digest,…`). */
function keysOf(signature: string): MediaKey[] {
  return signature.split(",").map((entry) => {
    const [mediaId = "", digest = ""] = entry.split(":");
    return { mediaId, digest: digest === "" ? null : digest };
  });
}

async function readClip(file: Blob): Promise<{ durationMs: number; ratio: number | null }> {
  try {
    const probe = await probeVideo(file);
    return {
      durationMs: probe.durationMs,
      ratio: probe.width > 0 && probe.height > 0 ? probe.width / probe.height : null,
    };
  } catch {
    return { durationMs: 0, ratio: null };
  }
}

/** The faces one clip offers, and the URLs drawn from them. */
type Captured = {
  file: Blob;
  frames: readonly Blob[];
  urls: readonly string[];
};

const HEADINGS: Record<WizardState["step"], string> = {
  pick: "New post",
  crop: "Crop",
  cover: "The video's face",
  details: "Details",
  seal: "What you sign",
};


export function ComposeWizard({
  store = identityStore,
  drafts = composeDraftStore,
  seals = sealedDraftStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
  drafts?: ComposeDraftStore;
  seals?: SealedDraftStore;
}) {
  const client = useApolloClient();
  const router = useRouter();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const keyOnDevice = useKeyOnDevice(store);

  // The Reference affordance (D20): a detail surface sends the author here
  // with the node it wants cited, and the chip arrives STAGED — not merely
  // offered. It is INITIAL STATE rather than an effect: the citation is
  // part of what this wizard opened as, and the id alone is enough to
  // stage it. The label is filled in behind it, below.
  //
  // A TARGET THE LOOKUP CANNOT TYPE IS STILL STAGED: the citation names
  // its target by id, so the write stands whatever this instance can
  // render, and dropping the gesture silently would be worse than a chip
  // with no label (`ReferenceClaim.target` is nullable for exactly this).
  //
  // `?tag=` IS THE TAG CARD'S ACT (`Tag a new post with it`, History.md:63;
  // FeedKinds.md): the composer opens at its first stage with the tag
  // riding staged among the new post's tags, the same initial-state way.
  const params = useSearchParams();
  const prefill = params.get("reference");
  const prefillTag = params.get("tag");
  const [state, setState] = useState<WizardState>(() => ({
    ...emptyWizard(),
    ...(prefill === null ? {} : { references: [newReferenceDraft(prefill, untypedTargetView(prefill))] }),
    ...(prefillTag === null || prefillTag === "" ? {} : { tags: [newTagDraft(prefillTag)] }),
  }));
  const dispatch = useCallback((action: WizardAction) => {
    setState((current) => wizardReducer(current, action));
  }, []);

  /** A draft found on this device, offered before it is adopted. */
  const [offered, setOffered] = useState<WizardState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<SealSheet>("none");
  // The pad's own pick, staged until Set — Cancel and the wash stage nothing.
  const [stagedPDirected, setStagedPDirected] = useState(state.pDirected);
  // `Start it unreachable?` over the pad — Set was pressed at exactly 0.00.
  const [confirmingUnreachable, setConfirmingUnreachable] = useState(false);
  // Show all, and the describe sheet it can open. Describing holds an asset id
  // rather than an index so a remove or a reorder underneath it cannot silently
  // move the sheet onto a different picture.
  const [managing, setManaging] = useState(false);
  const [describing, setDescribing] = useState<string | null>(null);
  // Which explanation is open, if any — the `?`s share one dialog because only
  // one can be open at a time and each names its own topic.
  const [help, setHelp] = useState<HelpTopic | null>(null);
  // Which picker stands in the details stage's place, if any — `+ Add a tag`
  // and `+ Cite something` open them; Done and the arrow close them, every
  // staged pick already applied (TagPicker.md, ReferencePicker.md).
  const [picker, setPicker] = useState<"tags" | "references" | null>(null);
  const [busy, setBusy] = useState(false);
  // A press made while uploads still run is HELD and signs the moment the
  // last one lands (ComposeSealUploading.md); the commit is inert from the
  // press either way, and both clocks count from it (SealSigning.md).
  const [held, setHeld] = useState(false);
  const signing = busy || held;
  const swapped = useSlowAnswer(signing);
  const slow = useWaitedPast(signing, SLOW_NETWORK_MS);
  // What became of the last press, when it did not leave the seal.
  const [fault, setFault] = useState<SealFault | null>(null);
  const [discarding, setDiscarding] = useState(false);
  // `Discard your draft?`, raised by a tap on the roll under a kept draft.
  const [askingDraft, setAskingDraft] = useState(false);
  // `Discard the words?` / `the pictures?` / `the video?` — the body fork's ask.
  const [bodyDiscard, setBodyDiscard] = useState<"words" | "pictures" | "video" | null>(null);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>({});

  const previews = usePreviewUrls(state.assets);
  // The offered draft's own cover, which the card draws before the draft has
  // been adopted and its assets are still nobody's.
  const offeredPreviews = usePreviewUrls(offered?.assets ?? NO_ASSETS);

  // Which assets have been handed to an upload runner already. A ref rather
  // than state because it must not re-run the effect that writes it — and
  // because React mounts effects twice in development, which without this would
  // upload every picture twice. Declared here because choosing a cover clears
  // entries from it, and that happens above the upload effect.
  //
  // EACH RUN CARRIES ITS OWN TOKEN, and a run whose token is no longer the
  // asset's writes nothing. A runner cannot be cancelled, so forgetting an
  // asset (a new face chosen, a retry, a re-crop) used to leave the old run
  // free to land "done" on top of the fresh "waiting" — the clip then counted
  // as uploaded with the face it no longer has, and the chosen cover waited
  // forever. The details door makes that path ordinary: a vertical clip is
  // already going up when `Add a cover` opens the step.
  const started = useRef(new Map<string, number>());
  const runCount = useRef(0);

  // ---- the video, its length, and the faces it offers -----------------------

  const video = isVideoPost(state) ? state.assets[0] : undefined;
  const videoFile = video?.file ?? null;
  const videoId = video?.id;
  // Both of these are keyed BY THE CLIP THEY DESCRIBE rather than reset when it
  // changes: a result that belongs to a file the draft no longer holds is
  // simply not read, which is the same outcome as clearing it without the
  // cascading render that clearing from an effect would cost.
  const [probed, setProbed] = useState<{
    file: Blob;
    durationMs: number;
    ratio: number | null;
  } | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const mine = captured !== null && captured.file === videoFile ? captured : null;
  const forThisClip = probed !== null && probed.file === videoFile ? probed : null;
  const durationMs = forThisClip?.durationMs ?? 0;
  // The shape the clip will BE once it is posted: its own, clamped to tall —
  // the same derivation the feed tile makes, so the preview and the post agree
  // (jakob 2026-09-11: the preview shows the actual output format).
  const clipRatio = forThisClip === null ? null : forThisClip.ratio;
  const frames = mine?.frames ?? NO_FRAMES;
  const framePreviews = mine?.urls ?? NO_URLS;
  const capturing = videoFile !== null && captured?.file !== videoFile;
  // THE SILENT STILL'S OWN EXTRACTION, kept apart from the tray's offers
  // above. FRAME 1 MEANS FRAME 0, STRICTLY (jakob, 2026-09-24): a coverless
  // clip's stored face is `captureFrameZero`'s read of the clip's true
  // start, never `frames[0]` — which stays the tray's ~1s "opening" tile.
  const [silentCover, setSilentCover] = useState<{ file: Blob; frame: Blob | null } | null>(null);
  const forSilentCover = silentCover !== null && silentCover.file === videoFile ? silentCover : null;
  const silentCovering = videoFile !== null && forSilentCover === null;
  useRevokeOnChange(framePreviews);
  // The files that did not get in. Not part of the draft — a refused file never
  // joined the batch — so this is view state, and it PERSISTS until the author
  // dismisses each line rather than clearing on the next pick.
  const [refusals, setRefusals] = useState<readonly PickRefusal[]>(NO_REFUSALS);
  const cover = state.cover;
  // The face itself, wherever it came from — a captured frame or the
  // author's own picture — so the cover row's own tile can show it rather
  // than the video's bytes or a bare outline.
  const coverPreview = useObjectUrl(cover?.file ?? null);
  // THE CLIP'S FACE IS ALWAYS ITS OWN FIRST FRAME, never the chosen cover —
  // a cover rides a tile only as the small ringed inset, never as the face
  // itself (`design/designs/canonical/screens/ComposeDetailsVideo.jsx`,
  // jakob's hand-test ruling 2026-09-23). An `img` cannot decode the clip's
  // own bytes, so the pick tray, the details tile, and the describe sheet all
  // need this still in its place — null while extraction has not landed or
  // found nothing, which draws the neutral tile rather than a borrowed
  // picture. THE PREVIEW FACE IS THE STORED FACE (jakob 2026-09-24, backlog
  // item 106): this is `forSilentCover`'s frame 0, never `framePreviews[0]` —
  // the tray's own ~1s offer — because a tray face that differs from what
  // every reader will see is a lie in the one place the author is deciding
  // whether they need a cover.
  const clipFace = useObjectUrl(forSilentCover?.frame ?? null);

  // The badge's number AND the clip's shape, read off the clip as it is
  // picked rather than waiting for the cover screen — the details row shows
  // the length too, the cover screen draws the preview at the shape the post
  // will take, and THE SHAPE DECIDES THE ROUTE (`isVerticalClip`): it is read
  // in `takeFiles`, before the clip joins the draft, so Next can never be
  // pressed on a clip whose shape is still on its way. This effect is the
  // fallback for a clip that arrived without that read — a draft kept before
  // the shape was — and fills the draft's shape in when it lands.
  useEffect(() => {
    if (videoFile === null || probed?.file === videoFile) return;
    let cancelled = false;
    void readClip(videoFile).then((read) => {
      if (cancelled) return;
      setProbed({ file: videoFile, ...read });
      if (videoId !== undefined) dispatch({ type: "clipRatio", id: videoId, clipRatio: read.ratio });
    });
    return () => {
      cancelled = true;
    };
  }, [videoFile, videoId, probed, dispatch]);

  // THE FACE IS EXTRACTED AS SOON AS THE CLIP IS PICKED, not only once the
  // cover screen is reached (`design/designs/canonical/screens/
  // ComposeDetailsVideo.jsx`, jakob's 2026-09-23 ruling: "the device silently
  // extracts the clip's first frame ... using the frame picker's own
  // extraction"). The pick tray and the details tile both stand the clip on
  // this same still, so both need it from the moment there is a clip —
  // waiting for the cover screen left them with nothing to show but the
  // video's own bytes, which an `<img>` cannot decode.
  useEffect(() => {
    if (videoFile === null || captured?.file === videoFile) return;
    let cancelled = false;
    void captureFrames(videoFile)
      .then((taken) => {
        if (cancelled) return;
        // The URLs are minted here, beside the bytes that need them, so no
        // effect has to write them into state afterwards.
        setCaptured({
          file: videoFile,
          frames: taken,
          urls: taken.map((frame) => URL.createObjectURL(frame)),
        });
        // EXTRACTION OFFERS; IT NEVER CHOOSES. The frames arriving changes
        // what the author can pick and not what they have picked — a cover
        // is optional and its own standalone asset, so a face nobody tapped
        // is a face nobody signed, and it would upload on the way out.
      })
      .catch(() => {
        // No frames is a state the screen draws: "A picture" still works, and a
        // clip that never found a face goes up without one.
        if (!cancelled) setCaptured({ file: videoFile, frames: NO_FRAMES, urls: NO_URLS });
      });
    return () => {
      cancelled = true;
    };
  }, [videoFile, captured]);

  // A SECOND, INDEPENDENT EXTRACTION for the silent still alone — never tied
  // to the tray's capture above, so retiming the tray's offers can never
  // retime what a coverless clip stores (`captureFrameZero`'s own docblock).
  useEffect(() => {
    if (videoFile === null || silentCover?.file === videoFile) return;
    let cancelled = false;
    void captureFrameZero(videoFile)
      .then((frame) => {
        if (!cancelled) setSilentCover({ file: videoFile, frame });
      })
      .catch(() => {
        if (!cancelled) setSilentCover({ file: videoFile, frame: null });
      });
    return () => {
      cancelled = true;
    };
  }, [videoFile, silentCover]);

  const chooseCover = (file: Blob, frame: number) => {
    // A new face is a new upload: the old one may already be on the server, and
    // it is attached to nothing, so the sweeper takes it (D5).
    if (cover !== null) started.current.delete(cover.id);
    dispatch({
      type: "cover",
      cover: { id: newComposeId(), file, frame, upload: { kind: "waiting" } },
    });
    if (video !== undefined) {
      started.current.delete(video.id);
      dispatch({ type: "upload", id: video.id, upload: { kind: "waiting" } });
    }
  };

  /**
   * What a pick becomes: the screening decides, and both halves of its answer
   * are used — what was accepted joins the draft, what was refused joins the
   * list of lines the author can read and dismiss. Nothing already picked is
   * ever replaced.
   */
  const takeFiles = async (files: readonly File[]) => {
    const outcome = await screenPick(files, {
      hasVideo: isVideoPost(state),
      count: state.assets.length,
    });
    if (outcome.refusals.length > 0) {
      setRefusals((current) => [...current, ...outcome.refusals]);
    }
    if (outcome.accepted.length === 0) return;
    // A CLIP JOINS WITH ITS SHAPE (Android reads it in the same step that
    // stages the clip, `onTogglePick`): the shape decides whether Next opens
    // the cover step, so it is known before the tray can offer Next at all.
    const clip = outcome.kind === "video" ? outcome.accepted[0] : undefined;
    const read = clip === undefined ? null : await readClip(clip);
    if (clip !== undefined && read !== null) setProbed({ file: clip, ...read });
    dispatch({
      type: "pick",
      assets: outcome.accepted.map((file) => ({
        id: newComposeId(),
        file,
        kind: outcome.kind,
        ...(file === clip && read !== null ? { clipRatio: read.ratio } : {}),
      })),
    });
  };

  // The staged citation's label, which the finder's own lookup answers —
  // so the affordance needs no second endpoint and the chip reads the same
  // as a picked one. A miss leaves the chip standing on its id.
  useEffect(() => {
    if (prefill === null) return;
    let cancelled = false;
    void fetchReferenceCandidates(client, prefill, 1).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      const candidate = outcome.value[0];
      if (candidate === undefined || candidate.targetId !== prefill) return;
      setState((current) => ({
        ...current,
        references: current.references.map((reference) =>
          reference.targetId === prefill
            ? { ...reference, target: candidate.target }
            : reference,
        ),
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [client, prefill]);

  // ---- the license a new post starts from -----------------------------------

  // A NEW POST STARTS FROM THE ACCOUNT'S DEFAULT LICENSE (SettingsLicense.md;
  // api-spec.md `UserPreferences.defaultLicense`, null = public domain). It
  // seeds the fresh wizard only: a draft taken up keeps the license it was
  // written under, and a failed read leaves public domain standing.
  const adoptedDraft = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void guard.run(() => fetchDefaultLicense(client)).then((outcome) => {
      if (cancelled || outcome.kind !== "success" || outcome.value === null) return;
      const seed = outcome.value;
      setState((current) =>
        adoptedDraft.current || !isPublicDomain(current.license)
          ? current
          : { ...current, license: { attribution: seed.attribution, provenance: seed.provenance } },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard]);

  // ---- the draft on this device -------------------------------------------

  // THE SEALED COPIES SETTLE FIRST (FC-G5). A post whose signing was taken has
  // its draft held out of the composer until the write lands or expires; an
  // expired one comes back here as the kept draft, so the load below offers
  // it — which is what makes "Open the draft" lead with it
  // (ComposeExpired.md:3-5). A copy whose write is still open stays sealed and
  // is never offered. Asking costs one read per waiting write, and nothing at
  // all when no copy waits; a settle that cannot finish never holds the
  // composer shut.
  useEffect(() => {
    let cancelled = false;
    void seals
      .settle(async (id) => fateOf(await guard.run(() => fetchStagedWrite(client, id))))
      .catch(() => {})
      .then(() => drafts.load())
      .then((draft) => {
        if (cancelled) return;
        if (draft !== null && draftIsWorthKeeping(draft)) setOffered(draft);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [drafts, seals, client, guard]);

  // THE DRAFT IS KEPT CONTINUOUSLY. Every meaningful change is written, and
  // leaving never discards — the only way a draft goes is the offer's Discard.
  //
  // The timer is a coalescing window, not a save policy: the draft carries the
  // picked bytes, and `save` reads every one of them back out of its Blob, so a
  // write per character typed would stutter the title field with ten pictures
  // attached. 200ms is short enough that a change is on disk before a reader
  // can reach for anything, and every departure flushes below regardless.
  // The departure handlers are bound once but must write what the draft holds
  // NOW, so the state is mirrored into a ref — updated in an effect, because a
  // ref written during render is a value React is free to discard.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  // ONCE THE POST HAS LANDED THERE IS NO DRAFT TO KEEP. The coalescing timer is
  // armed by the last change before signing and fires on its own schedule, so
  // without this latch it can land after the clear and put the published draft
  // straight back. Checked where each write actually happens rather than in the
  // effect body, because the write is what has to be stopped.
  const landed = useRef(false);

  const keep = useCallback(() => {
    if (landed.current || !loaded || offered !== null || !draftIsWorthKeeping(latest.current)) return;
    void drafts.save(latest.current);
  }, [loaded, offered, drafts]);

  useEffect(() => {
    if (!loaded || offered !== null || !draftIsWorthKeeping(state)) return;
    const timer = setTimeout(() => {
      if (landed.current) return;
      void drafts.save(state);
    }, 200);
    return () => clearTimeout(timer);
  }, [state, loaded, offered, drafts]);

  // Closing the tab, reloading, or switching away. `beforeunload` is not used:
  // it is unreliable on mobile, where a tab is far more often discarded than
  // closed. `visibilitychange` to hidden is the transition browsers do
  // guarantee, and `pagehide` covers the bfcache path.
  // (https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") keep();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", keep);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", keep);
    };
  }, [keep]);

  // ---- the uploads ---------------------------------------------------------

  const ratio = shapeRatio(state);
  // The crop is fixed once the reader leaves the crop screen, so that is when
  // the bytes can be encoded — earlier and every nudge would invalidate an
  // upload in flight.
  const uploading = state.step === "details" || state.step === "seal";

  useEffect(() => {
    if (!uploading) return;

    // A VIDEO IS ONE SEQUENCE, NOT TWO RACES. The cover must exist as an asset
    // before the video can name it, so the pair goes through a single runner
    // and neither is started independently.
    //
    // A MISSING COVER IS NOT A REASON TO WAIT. The face has been optional since
    // the cover pick stopped being a wall, so `null` is a settled answer rather
    // than a not-yet — and three ordinary routes reach it: the author skipped
    // the screen, the capture found no frames to offer, or they stepped off
    // before the capture resolved. Waiting on it stranded the clip at
    // "waiting", with nothing on screen to say so, for as long as they looked.
    if (video !== undefined) {
      if (video.upload.kind !== "waiting" || started.current.has(video.id)) {
        return;
      }

      // THE STORED FRAME, NOT A CHOICE (the feed-video rulings, 2026-09-23,
      // sharpened 2026-09-24; `ComposeDetailsVideo.jsx`'s docblock). Nothing
      // was picked, so before this clip goes up faceless the silent
      // extraction gets one chance to hand back the clip's own frame 0 —
      // through the same cover leg a chosen face would ride. This only
      // decides once: `autoCover` staying null is what lets the branch below
      // tell "never tried" from "tried and failed".
      if (cover === null && state.autoCover === null) {
        // Waiting for the silent extraction to settle rather than for a
        // cover to exist — the same distinction `capturing` draws for the
        // tray. Deciding early would read "not back yet" as "never coming"
        // and ship the clip faceless on a capture that was about to hand
        // back a perfectly good frame.
        if (silentCovering) return;
        const frame = forSilentCover?.frame ?? undefined;
        if (frame !== undefined) {
          // THE RULE IS DISABLED DELIBERATELY, as `previews.ts` already does:
          // the capture is an external system, and its settled frame set is
          // exactly what this reads — there is no render-time or event-handler
          // moment that could make this decision instead.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          dispatch({
            type: "autoCover",
            cover: { id: newComposeId(), file: frame, frame: 0, upload: { kind: "waiting" } },
          });
          return;
        }
        // No frames came back at all: falls through and uploads faceless,
        // exactly as an author-skipped cover always has.
      }

      const effective = effectiveCover(cover, state.autoCover);
      runCount.current += 1;
      const run = runCount.current;
      started.current.set(video.id, run);
      if (effective !== null) started.current.set(effective.id, run);
      void runVideoUpload(
        client,
        guard,
        video,
        effective,
        (upload) => {
          if (started.current.get(video.id) === run) dispatch({ type: "upload", id: video.id, upload });
        },
        // A CHOSEN COVER'S PROGRESS IS THE ONLY ONE EVER DRAWN. The auto-cover
        // has no screen of its own, so its steps land on `autoCoverUpload`
        // where only the gate and `attachmentClaims` read them — never on
        // `coverUpload`, which is what the (nonexistent) cover UI would watch.
        (upload) => {
          if (started.current.get(video.id) === run) {
            dispatch({ type: cover !== null ? "coverUpload" : "autoCoverUpload", upload });
          }
        },
        POST_SCALE,
      );
      return;
    }

    for (const asset of state.assets) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      runCount.current += 1;
      const run = runCount.current;
      started.current.set(asset.id, run);
      void runUpload(client, guard, asset, ratio, (upload) => {
        if (started.current.get(asset.id) === run) dispatch({ type: "upload", id: asset.id, upload });
      });
    }
  }, [
    uploading,
    state.assets,
    state.autoCover,
    video,
    cover,
    silentCovering,
    forSilentCover,
    ratio,
    client,
    guard,
    dispatch,
  ]);

  // ---- the already-published marker ---------------------------------------

  // WHICH OF THE STAGE'S MEDIA THE SERVER KNOWS (ComposeDetailsReused.md):
  // only a landed upload has an id and a rendition to match against the
  // author's published posts. The signature is what the lookup is keyed by,
  // so a result for media the stage no longer holds is simply not read.
  const mediaKeys: MediaKey[] =
    state.mode === "media"
      ? state.assets.flatMap((asset) =>
          asset.upload.kind === "done"
            ? [{ mediaId: asset.upload.mediaId, digest: asset.upload.media?.digest ?? null }]
            : [],
        )
      : [];
  const mediaSignature = mediaKeys.map((key) => `${key.mediaId}:${key.digest ?? ""}`).join(",");
  const [publishedFor, setPublishedFor] = useState<{
    signature: string;
    match: PublishedMatch | null;
  } | null>(null);
  useEffect(() => {
    if (mediaSignature === "") return;
    let cancelled = false;
    void guard.run(() => findPublishedMatch(client, keysOf(mediaSignature))).then((outcome) => {
      // A failed read draws the stage at rest: the marker never blocks, and
      // its absence costs nothing but the hint.
      if (!cancelled && outcome.kind === "success") {
        setPublishedFor({ signature: mediaSignature, match: outcome.value });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mediaSignature, client, guard]);
  const publishedMatch =
    publishedFor !== null && publishedFor.signature === mediaSignature ? publishedFor.match : null;

  const retry = (id: string) => {
    started.current.delete(id);
    // The video's retry takes its cover with it: the two go up as one sequence,
    // and a cover left "failed" would hold the seal shut behind a video that
    // just succeeded.
    if (video !== undefined && id === video.id && cover !== null) {
      started.current.delete(cover.id);
      dispatch({ type: "coverUpload", upload: { kind: "waiting" } });
    }
    dispatch({ type: "upload", id, upload: { kind: "waiting" } });
  };

  // THIS STAGE NEVER STANDS ON AN EMPTY BODY (jakob's ruling, 2026-09-23;
  // design commit 27aaa1cb, `ComposeDetails.jsx`/`ComposePicked.jsx`
  // docblocks). Removing an asset that empties the draft — the video's own
  // ×, or the last picture in the Show-all manager — gives the pick step
  // back rather than leaving Details standing on nothing. The staged title,
  // description, tags and references stay in the draft, waiting for a body.
  const removeAsset = (id: string) => {
    const emptying = state.assets.length === 1;
    dispatch({ type: "unpick", id });
    if (emptying) dispatch({ type: "goto", step: "pick" });
  };

  // Re-cropping invalidates the bytes that were uploaded from the old framing,
  // so everything starts again. The orphaned assets are the server's to sweep —
  // they are attached to nothing (D5).
  //
  // This hangs off the step change rather than off a button: the picked row
  // carries no "Crop" shortcut any more (jakob 2026-08-31, "none"), so Back is
  // the only way to the crop step and it is where the invalidation belongs.
  const invalidateUploads = () => {
    started.current.clear();
    setState((current) => ({
      ...current,
      assets: current.assets.map((asset) => ({ ...asset, upload: { kind: "waiting" } })),
      // The cover goes back with them: stepping off details on a video post
      // lands on the cover screen, and the face is what may be about to change.
      cover:
        current.cover === null ? null : { ...current.cover, upload: { kind: "waiting" as const } },
      // The silent one resets the same way, so a re-tried clip re-tries its
      // stored frame too rather than standing on a stale done or failed.
      autoCover:
        current.autoCover === null
          ? null
          : { ...current.autoCover, upload: { kind: "waiting" as const } },
    }));
  };

  // ---- signing -------------------------------------------------------------

  const submit = async () => {
    setBusy(true);
    setHeld(false);
    setFault(null);
    setTagErrors({});
    setReferenceErrors({});

    // The cited nodes' L1 ids, read before anything is staged: the batch
    // is checked against them before its first pre-signature (intent.ts).
    const graphIds = await guard.run(() =>
      fetchGraphIds(
        client,
        state.references.map((reference) => reference.targetId),
      ),
    );
    if (graphIds.kind !== "success") {
      setBusy(false);
      setFault({ kind: "offline" });
      return;
    }

    // One request, read twice: once by the API layer and once by the payload
    // expectation, so the device checks the envelope against exactly what it
    // asked for (payload-expectation.ts).
    const sent = {
      title: state.title.trim() === "" ? null : state.title,
      description: descriptionContent(state),
      content: bodyContent(state),
      sensitive: state.sensitive,
      sensitiveReason: state.sensitiveReason,
      license: state.license,
      pDirected: state.pDirected,
      tags: state.tags,
      references: state.references,
      attachments: attachmentClaims(state) ?? undefined,
    };
    const prepared = await guard.run(() => preparePost(client, sent));

    if (prepared.kind === "failed") {
      setBusy(false);
      setFault({ kind: "offline" });
      return;
    }
    if (prepared.kind === "refused") {
      // A refusal at prepare stages nothing, and the seal says it where it
      // stands — on the refused citation's row, or in the commit's place —
      // never by walking the reader back a stage (SealFaultRow.md).
      setBusy(false);
      setFault(sealFaultOf(prepared.errors, state.references));
      return;
    }

    const node = prepared.value.node;
    const content = contentExpectation(node, sent, "post", wizardLedger(state));
    await finish(node, prepared.value.writes, postExpectation(state, content, graphIds.value));
  };

  const finish = async (
    node: string,
    writes: readonly StagedWriteView[],
    expected: Expectation,
  ) => {
    const results = await signer.sign(writes, expected);
    setBusy(false);

    if (results.every((result) => result.kind === "done")) {
      // The draft has become a post, so it stops being a draft. The latch goes
      // up BEFORE the clear, so a save the reader's last keystroke armed cannot
      // slip in behind it.
      landed.current = true;
      // TAKEN IS NOT LANDED (FC-G5). A write still relaying can be collected
      // unlanded epochs from now, and the expiry notice promises the draft is
      // kept then (ComposeExpired.md:3). So the composed state is SEALED — out
      // of the composer, never offered while the write is alive — and the
      // same transaction drops the working draft, so there is no instant at
      // which neither holds the post. A batch that has already landed has no
      // fate left open and needs no copy.
      if (results.some((result) => result.kind === "done" && result.state !== "LANDED")) {
        try {
          await seals.seal(state, { node, writes: writes.map((write) => write.id) });
        } catch {
          // The seal did not take, so the working draft was not dropped
          // either (one transaction). It is written current and LEFT: a draft
          // offered while its post settles is the lesser fault next to one
          // the expiry would find gone.
          await drafts.save(state).catch(() => {});
          router.push(`/posts/${node}?published=1`);
          return;
        }
      }
      // Still cleared here, after the seal: `clear` is what retires a save
      // already reading blobs when the post was signed (draft-store.ts).
      await drafts.clear();
      // ComposeLanded is the POST'S OWN PAGE carrying a confirmation, not the
      // feed carrying a card: what an author wants after publishing is to see
      // the thing they published, and the board draws exactly that.
      router.push(`/posts/${node}?published=1`);
      return;
    }

    // The batch lands together or not at all, so one unlanded write means the
    // post did not land — and nothing was spent. The draft is kept exactly
    // because this screen promises it is.
    const expired = results.some(
      (result) =>
        result.kind === "refused" &&
        result.errors.some((error) => error.code === "STAGED_WRITE_EXPIRED"),
    );
    await drafts.save(state);
    if (expired) {
      router.push("/feed?compose=expired");
      return;
    }
    const refused = results.find((result) => result.kind === "refused");
    setFault(
      refused !== undefined && refused.kind === "refused"
        ? sealFaultOf(refused.errors, state.references)
        : { kind: "offline" },
    );
  };

  // ---- rendering -----------------------------------------------------------

  const gate = advanceGate(state);

  // The arrow: ONE STAGE BACK, never out of the flow (jakob, round 4). From the
  // first stage there is no stage to step to, so that one lands on the feed.
  const leave = () => {
    const previous = state.step;
    // A going stage back clears a refusal reading: the seal shows its plain
    // commit again until the next press (SealSigning.md).
    setFault(null);
    // Leaving keeps the draft — written here rather than left to the coalescing
    // timer, which the navigation would otherwise outrun.
    keep();
    // Stepping back off Details lands on Crop in a media post, and whatever was
    // uploaded came from the framing the author is about to change.
    if (previous === "details" && state.mode === "media") invalidateUploads();
    dispatch({ type: "back" });
    if (previous === "pick") router.push("/feed");
  };

  // A picker belongs to the details stage that opened it; a stage change (a
  // draft adopted, a body emptied) leaves it unshown rather than standing it
  // over a stage it was never opened on.
  const pickerOpen = picker !== null && state.step === "details";

  // The browser's Back is the same arrow (design/readme.md: "the platform
  // back gesture does the same"). Each stage past the pick rides its own
  // history entry, so a Back press never reaches the page behind the wizard
  // until the pick — the arrival entry — is where it stands, and from there
  // the browser leaves exactly as it always did.
  useStageHistory({
    surface: "compose",
    // A picker rides an entry above its stage, so the browser's Back closes it
    // the way its own arrow does.
    level: stepIndex(state) + (pickerOpen ? 1 : 0),
    onBack: () => {
      if (pickerOpen) setPicker(null);
      else leave();
    },
    onForward: () => dispatch({ type: "advance" }),
  });

  // The X: OUT OF THE FLOW from any stage, draft kept, NO confirmation —
  // nothing is lost, and the draft prompt is the return surface. Without it an
  // author five stages deep was stuck backing out tap by tap.
  const leaveFlow = () => {
    keep();
    router.push("/feed");
  };

  // THE BODY FORK ASKS FIRST WHEN THE BODY HOLDS SOMETHING (jakob 2026-10-02,
  // ComposeBodyDiscard.md): a post's body is words or pictures, never both,
  // so switching halves with something in the body discards it — after the
  // ask. An empty body switches silently.
  const switchBody = (mode: "words" | "media") => {
    if (mode === state.mode) return;
    if (mode === "media" && state.words.trim() !== "") setBodyDiscard("words");
    else if (mode === "words" && state.assets.length > 0) setBodyDiscard(isVideoPost(state) ? "video" : "pictures");
    else dispatch({ type: "mode", mode });
  };
  const discardBody = () => {
    // Only the half being left goes: the title, the tags and the citations
    // ride on (`The rest of the draft stays.`).
    if (bodyDiscard === "words") {
      dispatch({ type: "words", words: "" });
      dispatch({ type: "mode", mode: "media" });
    } else {
      for (const asset of state.assets) dispatch({ type: "unpick", id: asset.id });
      dispatch({ type: "mode", mode: "words" });
    }
    setBodyDiscard(null);
  };
  const discardOffered = () => {
    setOffered(null);
    setAskingDraft(false);
    void drafts.clear();
  };

  // WHILE IT SIGNS, THE SEAL HOLDS THE READER (jakob 2026-10-01): past the
  // label swap the header's arrow and X refuse a press and keep their face,
  // because leaving mid-sign would orphan the outcome (SealSigning.md).
  const locked = state.step === "seal" && swapped;

  // A HELD PRESS signs the moment the last upload lands, with no second press;
  // an upload that fails drops it and the commit reads its resting label
  // again (ComposeSealUploading.md). Nothing signs before the bytes exist.
  const pendingUploads = uploadsPending(state);
  const failedUploads = uploadsFailed(state);
  // A failure drops the press during render, the state an upload's own
  // outcome leaves behind (React, "adjusting some state when a prop changes").
  if (held && failedUploads > 0) setHeld(false);
  // Signing is the side effect: the last upload landing releases the press
  // into `submit`, which takes the press over as `busy` (it clears `held`).
  // It starts as a task of its own, as the network answer it waits on is.
  useEffect(() => {
    if (!held || pendingUploads > 0 || failedUploads > 0) return;
    const release = setTimeout(() => void submit(), 0);
    return () => clearTimeout(release);
    // `submit` reads the state it is handed this render; the press is the
    // trigger, and the upload counts are what release it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, pendingUploads, failedUploads]);

  const sign = () => {
    if (signing) return;
    setFault(null);
    if (uploadsPending(state) > 0) setHeld(true);
    else void submit();
  };

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        <HeaderBar title="New post" onBack={() => router.push("/feed")} backLabel="Back to feed" />
        <p className="px-6">Loading…</p>
      </main>
    );
  }

  // THE PICKERS ARE TASK PAGES, standing in the details stage's place with
  // their own header and foot (TagPicker.jsx, ReferencePicker.jsx: "NO SKY
  // ENTRY AND NO BOTTOM NAV — picking is a task"). Every pick lands in the
  // draft the moment it is made, so leaving — Done, the arrow, the browser's
  // Back — has nothing left to apply.
  if (pickerOpen) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
        {picker === "tags" ? (
          <TagPicker
            tags={state.tags}
            onTags={(tags) => dispatch({ type: "tags", tags })}
            onDone={() => setPicker(null)}
          />
        ) : (
          <ReferencePicker
            references={state.references}
            onReferences={(references) => dispatch({ type: "references", references })}
            onDone={() => setPicker(null)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <HeaderBar
        title={HEADINGS[state.step]}
        onBack={() => {
          if (!locked) leave();
        }}
        backLabel={state.step === "pick" ? "Back to feed" : "Back a step"}
        onLeave={() => {
          if (!locked) leaveFlow();
        }}
        // The seal board's `?` (`HelpDot`), opening the house help dialog with
        // copy-voice's "How signing works". One `?` per screen, so only the
        // seal carries one — beside its stage's name, "Last step".
        // The stage's name in the header's own slot (WizardHeader's
        // `stageLabel`): the seal's "Last step", the cover's "Video only".
        stageLabel={
          state.step === "seal" ? "Last step" : state.step === "cover" ? "Video only" : undefined
        }
        help={
          state.step === "seal" ? (
            <HelpDot
              ariaLabel="How signing works"
              onOpen={() => setHelp(HELP_TOPICS.howSigningWorks)}
              testId="header-help"
            />
          ) : undefined
        }
        // THE HEADER CARRIES ONLY THE WAYS OUT (jakob 2026-09-01). Next lived
        // here on the early stages and moved to the bottom from Details on, so
        // the top-right corner changed meaning mid-flow and an author reaching
        // for Next hit the X instead. Every stage's forward action now sits at
        // the bottom of its own content column.
        testId="wizard-header"
        // The registered ComposeDetails screen names its band; the other
        // stages' boards are not registered yet and keep the wizard's ids.
        node={state.step === "details" ? { path: "composeDetails.header" } : undefined}
      />

      {offered !== null && (
        <DraftCard
          draft={offered}
          previews={offeredPreviews}
          onContinue={() => {
            // A taken-up draft keeps the license it was written under.
            adoptedDraft.current = true;
            // THE CITATION CROSSES THE RESTORE. The author reached this
            // screen by asking to cite a node (D20), and the draft answers
            // a different question — what they were writing last week.
            // Taking it up must not undo the gesture that opened the
            // wizard, or `Cite in a new post` silently opens an ordinary
            // composer.
            setState((current) => ({
              ...offered,
              references: current.references.some(
                (reference) => reference.targetId === prefill,
              )
                ? [
                    ...offered.references.filter(
                      (reference) => reference.targetId !== prefill,
                    ),
                    ...current.references.filter(
                      (reference) => reference.targetId === prefill,
                    ),
                  ]
                : offered.references,
              // THE STAGED TAG CROSSES THE RESTORE for the citation's reason.
              tags:
                prefillTag === null || prefillTag === "" || offered.tags.some((tag) => tag.name === prefillTag)
                  ? offered.tags
                  : [...offered.tags, newTagDraft(prefillTag)],
            }));
            setOffered(null);
          }}
          onDiscard={discardOffered}
        />
      )}

      {/* The other way out of the offer, said rather than drawn: the pick screen
          below is already the way to start fresh, so this names it instead of
          adding a second control that would compete with Continue. Discarding
          is the card's own affordance and the only route to it. */}
      {offered !== null && (
        <div className="flex flex-none items-center gap-2 px-6 py-2">
          <p
            data-testid="wizard-draft-fresh"
            className="m-0 flex-1 text-body-medium text-on-surface-variant"
          >
            Or start fresh —
          </p>
        </div>
      )}

      {state.step === "pick" && (
        // CW-42 (ComposeDraft.jsx): while the draft offer shows, the pick
        // step underneath is present, clearly not the subject, and the
        // thing Discard hands the author back — dimmed to 55% AND inert,
        // mirroring ComposeWizardScreen.kt's `DIMMED = 0.55f` gated by
        // `draftOffer != null`. `inert` takes pointer, keyboard and AT
        // reach away together; the opacity alone would still let a stray
        // tab or click land on a grid the draft's own pair should decide.
        <div className="relative flex flex-1 flex-col">
        <div
          data-testid="wizard-pick-region"
          className="flex flex-1 flex-col"
          style={offered !== null ? { opacity: 0.55 } : undefined}
          inert={offered !== null}
        >
          <PickStep
            mode={state.mode}
            words={state.words}
            assets={state.assets}
            previews={previews}
            refusals={refusals}
            // The refusals carry their own words now, so this is only the
            // empty-body gate again.
            error={gate.ok ? null : gate.reason}
            blocked={!gate.ok}
            coverSrc={coverPreview}
            vertical={skipsCoverStep(state)}
            durationMs={durationMs}
            clipFace={clipFace}
            onWords={(words) => dispatch({ type: "words", words })}
            onMode={switchBody}
            onPick={(files) => void takeFiles(files)}
            onUnpick={(id) => dispatch({ type: "unpick", id })}
            onDismissRefusal={(id) =>
              setRefusals((current) => current.filter((refusal) => refusal.id !== id))
            }
            onManage={() => setManaging(true)}
            onNext={() => dispatch({ type: "advance" })}
          />
        </div>
        {/* THE ROLL'S SHIELD (ComposeDraftDiscard, jakob 2026-09-15): a
            blocked surface owes an answer, so a tap on the dimmed pictures
            raises the discard ask instead of finding nothing, and focus
            meets one control named for what the reader has to do first. */}
        {offered !== null && (
          <button
            type="button"
            data-testid="wizard-draft-shield"
            aria-label="Answer your draft before starting a new post"
            onClick={() => setAskingDraft(true)}
            className="cg-focus absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
          />
        )}
        </div>
      )}

      {state.step === "crop" && (
        <CropStep
          assets={state.assets}
          previews={previews}
          shape={state.shape}
          focused={state.focused}
          onShape={(shape) => dispatch({ type: "shape", shape })}
          onFocus={(index) => dispatch({ type: "focus", index })}
          onCrop={(id, crop) => dispatch({ type: "crop", id, crop })}
          onNext={() => dispatch({ type: "advance" })}
        />
      )}

      {state.step === "cover" && (
        <CoverStep
          videoUrl={video === undefined ? null : (previews[video.id] ?? null)}
          durationMs={durationMs}
          clipRatio={clipRatio}
          framePreviews={framePreviews}
          cover={cover}
          coverPreview={coverPreview}
          capturing={capturing}
          error={gate.ok ? null : gate.reason}
          blocked={!gate.ok}
          onPickFrame={(index) => {
            const frame = frames[index];
            if (frame) chooseCover(frame, index);
          }}
          onPickPicture={(file) => chooseCover(file, COVER_FROM_PICTURE)}
          onNext={() => dispatch({ type: "advance" })}
        />
      )}

      {state.step === "details" && (
        <DetailsStep
          mode={state.mode}
          assets={state.assets}
          previews={previews}
          clipFace={clipFace}
          coverPreview={coverPreview}
          durationMs={durationMs}
          coverDoor={skipsCoverStep(state) && state.cover === null}
          onCover={() => dispatch({ type: "openCover" })}
          title={state.title}
          description={state.description}
          tags={state.tags}
          references={state.references}
          tagErrors={tagErrors}
          referenceErrors={referenceErrors}
          onTitle={(title) => dispatch({ type: "title", title })}
          onDescription={(description) => dispatch({ type: "description", description })}
          onTags={(tags) => dispatch({ type: "tags", tags })}
          onReferences={(references) => dispatch({ type: "references", references })}
          onOpenTagPicker={() => setPicker("tags")}
          onOpenReferencePicker={() => setPicker("references")}
          onManage={() => setManaging(true)}
          onDescribe={() => setDescribing(state.assets[0]?.id ?? null)}
          onRetry={retry}
          onRemove={removeAsset}
          onNext={() => dispatch({ type: "advance" })}
          blocked={!gate.ok}
          published={
            publishedMatch === null
              ? null
              : { postId: publishedMatch.postId, date: publishedOn(publishedMatch.publishedAt) }
          }
          // The door leaves the flow for the post it names, the draft kept —
          // the same way out the X takes (ComposeDetails.md: "the earliest
          // matching post opens").
          onOpenPublished={(postId) => {
            keep();
            router.push(`/posts/${postId}`);
          }}
        />
      )}

      {state.step === "seal" && (
        <SealStep
          state={state}
          sheet={sheet}
          signing={signing}
          swapped={swapped}
          slow={slow}
          keyOnDevice={keyOnDevice}
          fault={fault}
          discarding={discarding}
          stagedPDirected={stagedPDirected}
          confirmingUnreachable={confirmingUnreachable}
          onSheet={(next) => {
            // Opening the pad starts it from the backing the row reads, so
            // Cancel can put it back exactly.
            if (next === "stance") setStagedPDirected(state.pDirected);
            setConfirmingUnreachable(false);
            setSheet(next);
          }}
          // CHANGING A FACT clears a refusal reading (SealSigning.md): the seal
          // shows its plain commit again until the next press.
          onLicense={(license) => {
            setFault(null);
            dispatch({ type: "license", license });
          }}
          // The sheets' removals and re-pairs land in the SAME staged sets the
          // details step owns — one reducer action, not a second copy kept by
          // the seal.
          onReferences={(references) => {
            setFault(null);
            dispatch({ type: "references", references });
          }}
          onTags={(tags) => {
            setFault(null);
            dispatch({ type: "tags", tags });
          }}
          onStagedPDirected={setStagedPDirected}
          onSetStance={() => {
            // EXACTLY 0.00 ASKS FIRST (ComposePad.md): the post's own path
            // starts unreachable. It warns and never refuses. The pick is a
            // hundredth (the release lands it there), so reading 0.00 IS 0.
            const picked = snapDimension(stagedPDirected);
            if (picked === 0) {
              setStagedPDirected(picked);
              setConfirmingUnreachable(true);
              return;
            }
            setFault(null);
            dispatch({ type: "pDirected", pDirected: picked });
            setSheet("none");
          }}
          onKeepAdjusting={() => setConfirmingUnreachable(false)}
          onSetAnyway={() => {
            setConfirmingUnreachable(false);
            setFault(null);
            dispatch({ type: "pDirected", pDirected: 0 });
            setSheet("none");
          }}
          onStanceHelp={() => setHelp(HELP_TOPICS.yourBackingOnYourPost)}
          onSensitive={(next) => {
            setFault(null);
            dispatch({ type: "sensitive", sensitive: next.sensitive });
            dispatch({ type: "sensitiveReason", sensitiveReason: next.sensitiveReason });
          }}
          onHelp={() => setHelp(HELP_TOPICS.markingAsSensitive)}
          onLicenseHelp={() => setHelp(HELP_TOPICS.license)}
          onKeyHelp={() => setHelp(HELP_TOPICS.yourKey)}
          onWriteRuleHelp={() => setHelp(HELP_TOPICS.whySigningWaits)}
          onSign={sign}
          // The same signing, asked again: Retry is the only re-send, and
          // past 200ms its slot reads the commit's own in-flight label.
          onRetry={() => {
            setFault(null);
            void submit();
          }}
          // The failed upload's Retry re-runs the gate; nothing signs until
          // the commit is pressed again.
          onRetryUploads={() => {
            for (const asset of state.assets) {
              if (asset.upload.kind === "failed") retry(asset.id);
            }
          }}
          onBack={() => {
            setFault(null);
            dispatch({ type: "back" });
          }}
          onRestoreKey={() => router.push("/restore")}
          // The key-absent panel's and the write rule's keep-draft LEAVE the
          // wizard (graph: a terminal `back`), not a step back — `leaveFlow`
          // is the same exit the header's X already uses.
          onKeepDraft={leaveFlow}
          onRemoveRefused={(targetId) => {
            // The citation leaves the staged set, the count and the total
            // fall by one, and the seal is ready to sign again.
            setFault(null);
            dispatch({
              type: "references",
              references: state.references.filter((reference) => reference.targetId !== targetId),
            });
          }}
          // The report page Settings opens is not built on the web yet
          // (HAND TO FABLE): the word stands where the board draws it.
          onReport={() => {}}
          onDiscard={() => setDiscarding(true)}
          onDiscardConfirmed={() => {
            // The draft goes, with its pictures, tags and citations; nothing
            // was ever signed. The flow is left for where composing began.
            setDiscarding(false);
            landed.current = true;
            void drafts.clear().then(() => router.push("/feed"));
          }}
          onKeepDiscarding={() => setDiscarding(false)}
        />
      )}

      {/* Show all and the describe sheet live on the wizard rather than inside a
          step, because both are reached from more than one screen and a sheet
          owned by a step would close when the step changed under it. */}
      <PickedSheet
        open={managing}
        onClose={() => setManaging(false)}
        items={state.assets.map((asset) => ({
          id: asset.id,
          src: previews[asset.id] ?? null,
          crop: asset.crop,
          altText: asset.altText === "" ? null : asset.altText,
          described: asset.altText.trim() !== "",
        }))}
        onDescribe={(id) => setDescribing(id)}
        // THE LAST × GIVES THE PICK STEP BACK (jakob's ruling, 2026-09-23;
        // design commit 27aaa1cb, `ComposePicked.jsx`): removing the last
        // picture closes the manager itself, the way the video path's own ×
        // gives its step back — whether the manager was opened from the pick
        // step (already showing it) or from Details (which never stands on
        // an empty body).
        onRemove={(id) => {
          const last = state.assets.length === 1;
          removeAsset(id);
          if (last) setManaging(false);
        }}
        onMove={(from, to) => dispatch({ type: "reorder", from, to })}
        testId="wizard-picked-sheet"
      />

      <DescribeSheet
        open={describing !== null}
        onClose={() => setDescribing(null)}
        // A video's own bytes are what `previews` holds for it — an `<img>`
        // cannot decode them, so the sheet stands the clip on its first
        // frame the same way its other tiles do (same defect as W1, this
        // surface just never had its own test).
        src={
          describing === null
            ? null
            : isVideoPost(state)
              ? clipFace
              : (previews[describing] ?? null)
        }
        crop={state.assets.find((asset) => asset.id === describing)?.crop ?? null}
        value={state.assets.find((asset) => asset.id === describing)?.altText ?? ""}
        onChange={(altText) => {
          if (describing !== null) dispatch({ type: "altText", id: describing, altText });
        }}
        video={isVideoPost(state)}
        testId="wizard-describe-sheet"
      />

      {askingDraft && (
        // ComposeDraftDiscard: the safe answer is the filled one, both words
        // take their object, no error colour, and the scrim is Keep's.
        <DialogSurface
          title="Discard your draft?"
          body={[
            "Picking pictures starts a new post, and this draft is what stands in the way. Discarding is the only thing that loses it.",
          ]}
          onDismiss={() => setAskingDraft(false)}
          testId="wizard-draft-discard-ask"
          actions={
            <>
              <PillButton testId="wizard-draft-discard-it" variant="text" onClick={discardOffered}>
                Discard it
              </PillButton>
              <PillButton testId="wizard-draft-keep" onClick={() => setAskingDraft(false)}>
                Keep the draft
              </PillButton>
            </>
          }
        />
      )}

      {bodyDiscard !== null && (
        // ComposeBodyDiscard: one dialog for both directions, the body naming
        // only what goes. Keep is filled; Discard quiet; no error colour.
        <DialogSurface
          title={
            bodyDiscard === "words"
              ? "Discard the words?"
              : bodyDiscard === "video"
                ? "Discard the video?"
                : "Discard the pictures?"
          }
          body={["The rest of the draft stays."]}
          onDismiss={() => setBodyDiscard(null)}
          testId="wizard-body-discard"
          actions={
            <>
              <PillButton testId="wizard-body-discard-it" variant="text" onClick={discardBody}>
                Discard
              </PillButton>
              <PillButton testId="wizard-body-keep" onClick={() => setBodyDiscard(null)}>
                {bodyDiscard === "video" ? "Keep it" : "Keep them"}
              </PillButton>
            </>
          }
        />
      )}

      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help ?? HELP_TOPICS.howSigningWorks}
        testId="wizard-help"
      />
    </main>
  );
}

// ComposeDraft — the card that sits above a fresh pick screen when this device
// is already holding an unpublished post.
function DraftCard({
  draft,
  previews,
  onContinue,
  onDiscard,
}: {
  draft: WizardState;
  previews: Readonly<Record<string, string>>;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const summary = draftSummary(draft);
  const cover = draft.assets[0];
  return (
    <div
      data-testid="wizard-draft-card"
      // A `Card` (gap 12, padding 16) wearing the brand's task ring, so the
      // reason the screen is held is legible before a word is read
      // (ComposeDraft.md: "the draft card wears the brand ring").
      className="cg-task-ring mx-6 my-2 flex flex-none flex-col gap-3 rounded-medium p-4 text-on-surface"
    >
      <h2 className="m-0 text-title-medium">Your draft is here</h2>
      <div className="flex items-center gap-2">
        {/* The restored draft's cover shows the framing it was left with, so a
            returning author recognises the picture they framed. */}
        {cover !== undefined && (
          <MediaThumb
            src={previews[cover.id] ?? null}
            crop={cover.crop}
            size={40}
            testId="wizard-draft-cover"
          />
        )}
        <span className="flex flex-1 flex-col">
          <span className="text-body-medium">{summary.title}</span>
          <span className="text-body-small text-on-surface-variant">{summary.detail}</span>
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <PillButton testId="wizard-draft-discard" variant="text" onClick={onDiscard}>
          Discard
        </PillButton>
        <PillButton testId="wizard-draft-continue" onClick={onContinue}>
          Continue
        </PillButton>
      </div>
    </div>
  );
}
