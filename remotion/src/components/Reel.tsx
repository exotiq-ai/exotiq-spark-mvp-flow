import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { REELS } from "../reels";
import { REEL_TIMELINES } from "../reelTimelines";
import { COLORS } from "../theme";
import { ReelCaption } from "./ReelCaption";
import { ReelCTAText } from "./ReelCTAText";
import { ReelEndCard } from "./ReelEndCard";
import { ReelHookText } from "./ReelHookText";
import { ReelMusic } from "./ReelMusic";
import { ReelPayoffText } from "./ReelPayoffText";
import { ReelShotFrame } from "./ReelShotFrame";

const sora = loadSora("normal", { weights: ["600", "700"], subsets: ["latin"] });
const manrope = loadManrope("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const Reel: React.FC<{ reelId: string; aspect?: "vertical" | "feed" }> = ({
  reelId,
  aspect = "vertical",
}) => {
  const def = REELS.find((r) => r.id === reelId)!;
  const timeline = REEL_TIMELINES.find((t) => t.id === reelId)!;

  const narration = [...timeline.lines, timeline.cta];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <ReelShotFrame
        shot={def.shot}
        from={def.from}
        to={def.to}
        duration={timeline.totalFrames}
        aspect={aspect}
      />

      <ReelHookText text={def.hookText} fontFamily={sora.fontFamily} aspect={aspect} />

      {timeline.lines.map((line) => (
        <Sequence key={line.file} from={line.from} durationInFrames={line.duration}>
          <Audio src={staticFile(`audio/reels/${line.file}`)} />
          <ReelCaption
            text={line.text}
            duration={line.duration}
            fontFamily={manrope.fontFamily}
            aspect={aspect}
          />
        </Sequence>
      ))}

      <ReelPayoffText
        text={def.payoffText}
        fontFamily={sora.fontFamily}
        aspect={aspect}
        from={timeline.payoff.from}
      />

      <Sequence from={timeline.cta.from} durationInFrames={timeline.cta.duration}>
        <Audio src={staticFile(`audio/reels/${timeline.cta.file}`)} />
        <ReelCaption
          text={timeline.cta.text}
          duration={timeline.cta.duration}
          fontFamily={manrope.fontFamily}
          aspect={aspect}
        />
        <ReelCTAText
          keyword={def.ctaKeyword}
          fontFamily={sora.fontFamily}
          aspect={aspect}
          from={timeline.cta.from}
        />
      </Sequence>

      <Sequence from={timeline.endCard.from} durationInFrames={timeline.endCard.duration}>
        <ReelEndCard display={sora.fontFamily} body={manrope.fontFamily} from={timeline.endCard.from} />
      </Sequence>

      <ReelMusic
        narration={narration.map((n) => ({ from: n.from, duration: n.duration }))}
        endCardFrom={timeline.endCard.from}
        endCardDuration={timeline.endCard.duration}
      />
    </AbsoluteFill>
  );
};
