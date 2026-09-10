import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 130) * 40;
  const drift2 = Math.cos(frame / 170) * 55;
  const pulse = interpolate(Math.sin(frame / 90), [-1, 1], [0.22, 0.4]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 700px at ${960 + drift}px ${
            240 + drift2
          }px, rgba(59,130,246,${pulse}) 0%, rgba(4,5,7,0) 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 620px at ${300 - drift2}px ${
            940 + drift
          }px, rgba(24,60,120,0.35) 0%, rgba(4,5,7,0) 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(7,8,11,0.35) 0%, rgba(7,8,11,0.85) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
