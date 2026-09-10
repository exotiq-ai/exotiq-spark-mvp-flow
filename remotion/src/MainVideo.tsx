import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { Backdrop } from "./components/Backdrop";
import { Caption } from "./components/Caption";
import { ShotFrame } from "./components/ShotFrame";
import { BrandCard } from "./scenes/BrandCard";
import { SEGMENTS, LEAD_IN } from "./timeline";
import { FPS } from "./theme";

const sora = loadSora("normal", { weights: ["600", "700"], subsets: ["latin"] });
const manrope = loadManrope("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const segmentPlan = () => {
  let cursor = LEAD_IN;
  return SEGMENTS.map((s) => {
    const dur = Math.round(s.len * FPS) + (s.pad ?? 30) + 10;
    const plan = { ...s, start: cursor, duration: dur };
    cursor += dur;
    return plan;
  });
};

export const TOTAL_FRAMES = (() => {
  const plan = segmentPlan();
  const last = plan[plan.length - 1];
  return last.start + last.duration + 20;
})();

export const MainVideo: React.FC = () => {
  const plan = segmentPlan();

  return (
    <AbsoluteFill style={{ backgroundColor: "#040507" }}>
      <Backdrop />
      {plan.map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.duration}>
          <Audio src={staticFile(`audio/${s.audio}`)} />
          {s.kind ? (
            <BrandCard
              variant={s.kind}
              duration={s.duration}
              display={sora.fontFamily}
              body={manrope.fontFamily}
            />
          ) : (
            <ShotFrame shot={s.shot!} from={s.from!} to={s.to!} duration={s.duration} />
          )}
          {!s.kind && (
            <Caption text={s.caption} duration={s.duration} fontFamily={manrope.fontFamily} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
