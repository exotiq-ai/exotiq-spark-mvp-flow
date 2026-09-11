import React from "react";
import { Composition } from "remotion";
import { MainVideo, TOTAL_FRAMES } from "./MainVideo";
import { Reel } from "./components/Reel";
import { REEL_TIMELINES } from "./reelTimelines";
import { FPS } from "./theme";
import { MobileProofReel, MOBILE_PROOF_REEL_FRAMES } from "./components/MobileProofReel";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="reel-double-booking-mobile-proof"
      component={MobileProofReel}
      durationInFrames={MOBILE_PROOF_REEL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
    {REEL_TIMELINES.map((t) => (
      <React.Fragment key={t.id}>
        <Composition
          id={`reel-${t.id}`}
          component={Reel}
          durationInFrames={t.totalFrames}
          fps={t.fps}
          width={t.width}
          height={t.height}
          defaultProps={{ reelId: t.id, aspect: "vertical" }}
        />
        <Composition
          id={`reel-${t.id}-feed`}
          component={Reel}
          durationInFrames={t.totalFrames}
          fps={t.fps}
          width={1080}
          height={1350}
          defaultProps={{ reelId: t.id, aspect: "feed" }}
        />
      </React.Fragment>
    ))}
  </>
);
